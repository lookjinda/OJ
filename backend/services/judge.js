const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;


const db = require('../models/db');

// 从 test_data_files 表加载测试数据（优先于 test_cases JSON 字段）
function loadTestData(questionId) {
  try {
    const files = db.prepare('SELECT * FROM test_data_files WHERE question_id = ? ORDER BY sort_order, id').all(questionId);
    if (!files || files.length === 0) return null;
    const inputs = files.filter(f => f.file_type === 'input');
    const outputs = files.filter(f => f.file_type === 'output');
    const cases = [];
    for (const inp of inputs) {
      const baseName = inp.filename.replace(/\.in$/i, '');
      const out = outputs.find(o => o.filename.replace(/\.out$/i, '') === baseName) || outputs[inputs.indexOf(inp)];
      if (out) cases.push({ input: inp.content, expected: out.content });
    }
    return cases.length > 0 ? cases : null;
  } catch (e) { return null; }
}

// 判题服务
async function judgeSubmission(question, submission) {
  const { type, language, test_cases, answer: correctAnswer, points, id: qid } = question;
  const { code, scratch_project } = submission;

  // 优先从 test_data_files 表加载测试数据
  let effectiveTestCases = loadTestData(qid) || test_cases;

  if (language === 'scratch' || scratch_project) {
    return judgeScratch(scratch_project, effectiveTestCases, points);
  }

  if (language === 'python') {
    return judgePython(code, effectiveTestCases, points);
  }

  if (language === 'cpp') {
    return judgeCpp(code, effectiveTestCases, points);
  }

  return { result: 'error', score: 0, feedback: '不支持的编程语言' };
}

// 通用比较：统一为字符串比较，避免 JSON.stringify 差异
// 例如期望 "7"，输出 7，都转为字符串 "7" 再比较
function compare(actual, expected) {
  if (actual === expected) return true;
  // 转为字符串后比较（处理数字vs字符串、尾部空格等差异）
  const a = typeof actual === 'string' ? actual.trim() : String(actual);
  const e = typeof expected === 'string' ? expected.toString().trim() : String(expected);
  return a === e;
}

// Python判题
async function judgePython(code, testCases, points) {
  try {
    const results = [];
    const tempDir = '/tmp/judge';

    await fs.mkdir(tempDir, { recursive: true });

    const codeFile = path.join(tempDir, `solution_${Date.now()}.py`);
    await fs.writeFile(codeFile, code);

    let passCount = 0;

    for (const testCase of testCases) {
      try {
        const rawOutput = await runPythonCode(codeFile, testCase.input);
        const expectedVal = testCase.expected !== undefined ? testCase.expected : testCase.output;
        const passed = compare(rawOutput, expectedVal);

        if (passed) {
          passCount++;
          results.push({ pass: true, input: testCase.input, expected: String(expectedVal), actual: String(rawOutput) });
        } else {
          results.push({ pass: false, input: testCase.input, expected: String(expectedVal), actual: String(rawOutput) });
        }
      } catch (err) {
        results.push({ pass: false, input: testCase.input, error: err.message });
      }
    }

    const score = Math.round((passCount / testCases.length) * points);
    const result = passCount === testCases.length ? 'pass' : passCount > 0 ? 'partial' : 'fail';

    let feedback = `通过 ${passCount}/${testCases.length} 个测试用例\n`;
    feedback += results.map((r, i) =>
      `用例${i+1}: ${r.pass ? '✓' : '✗'} ${r.error ? `错误: ${r.error}` : `期望=${r.expected} 实际=${r.actual}`}`
    ).join('\n');

    await fs.unlink(codeFile).catch(() => {});

    return { result, score, feedback };
  } catch (err) {
    return { result: 'error', score: 0, feedback: `执行错误: ${err.message}` };
  }
}

// 运行Python代码
function runPythonCode(codeFile, input) {
  return new Promise((resolve, reject) => {
    const python = spawn('python3', [codeFile], { timeout: 5000 });
    let stdout = '';
    let stderr = '';

    if (typeof input === 'object') {
      python.stdin.write(JSON.stringify(input));
    } else if (typeof input === 'string') {
      python.stdin.write(input);
    }

    python.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    python.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(stderr || '执行失败'));
      }
    });

    python.on('error', (err) => {
      reject(err);
    });

    python.stdin.end();
  });
}

// C++判题
async function judgeCpp(code, testCases, points) {
  try {
    const tempDir = '/tmp/judge';
    await fs.mkdir(tempDir, { recursive: true });

    const baseName = `solution_${Date.now()}`;
    const sourceFile = path.join(tempDir, `${baseName}.cpp`);
    const execFile = path.join(tempDir, baseName);

    await fs.writeFile(sourceFile, code);

    const compileResult = await compileCpp(sourceFile, execFile);
    if (!compileResult.success) {
      return { result: 'error', score: 0, feedback: `编译错误:\n${compileResult.error}` };
    }

    let passCount = 0;
    const results = [];

    for (const testCase of testCases) {
      try {
        const rawOutput = await runExecutable(execFile, testCase.input);
        const expectedVal = testCase.expected !== undefined ? testCase.expected : testCase.output;
        const passed = compare(rawOutput, expectedVal);

        if (passed) {
          passCount++;
          results.push({ pass: true, input: testCase.input, expected: String(expectedVal), actual: String(rawOutput) });
        } else {
          results.push({ pass: false, input: testCase.input, expected: String(expectedVal), actual: String(rawOutput) });
        }
      } catch (err) {
        results.push({ pass: false, input: testCase.input, error: err.message });
      }
    }

    const score = Math.round((passCount / testCases.length) * points);
    const result = passCount === testCases.length ? 'pass' : passCount > 0 ? 'partial' : 'fail';

    let feedback = `通过 ${passCount}/${testCases.length} 个测试用例\n`;
    feedback += results.map((r, i) =>
      `用例${i+1}: ${r.pass ? '✓' : '✗'} ${r.error ? `错误: ${r.error}` : `期望=${r.expected} 实际=${r.actual}`}`
    ).join('\n');

    await Promise.all([
      fs.unlink(sourceFile).catch(() => {}),
      fs.unlink(execFile).catch(() => {})
    ]);

    return { result, score, feedback };
  } catch (err) {
    return { result: 'error', score: 0, feedback: `执行错误: ${err.message}` };
  }
}

// 编译C++
function compileCpp(sourceFile, execFile) {
  return new Promise((resolve) => {
    const gpp = spawn('g++', ['-o', execFile, sourceFile, '-std=c++17', '-O2'], { timeout: 10000 });
    let stderr = '';

    gpp.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    gpp.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: stderr });
      }
    });

    gpp.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });
  });
}

// 运行可执行文件
function runExecutable(execFile, input) {
  return new Promise((resolve, reject) => {
    const proc = spawn(execFile, [], { timeout: 5000 });
    let stdout = '';
    let stderr = '';

    if (typeof input === 'object') {
      proc.stdin.write(JSON.stringify(input));
    } else if (typeof input === 'string') {
      proc.stdin.write(input);
    }

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          resolve(stdout.trim());
        }
      } else {
        reject(new Error(stderr || '执行失败'));
      }
    });

    proc.on('error', reject);
    proc.stdin.end();
  });
}

// Scratch判题
function judgeScratch(scratchProject, testCases, points) {
  try {
    if (scratchProject && scratchProject._base64) {
      return {
        result: 'partial',
        score: Math.round(points * 0.6),
        feedback: `Scratch项目文件(${scratchProject._filename || 'project.sb3'})已收到。\n由于.sb3文件需要人工审核，暂给${Math.round(points * 0.6)}/${points}分。\n老师将检查你的项目是否包含要求的积木和逻辑。`
      };
    }

    const project = typeof scratchProject === 'string' ? JSON.parse(scratchProject) : scratchProject;

    let passCount = 0;
    const checks = [];

    for (const testCase of testCases) {
      const { check, required, value } = testCase;
      let passed = false;

      if (project.targets) {
        for (const target of project.targets) {
          if (target.blocks) {
            for (const blockId in target.blocks) {
              const block = target.blocks[blockId];

              if (check === 'has_pen_block' && block.opcode.includes('pen')) {
                passed = true;
              }
              if (check === 'has_move_block' && block.opcode === 'motion_movesteps') {
                if (!value || block.inputs.STEPS?.[1]?.[1] == value) {
                  passed = true;
                }
              }
              if (check === 'has_turn_block' && block.opcode.includes('turn')) {
                if (!value || block.inputs.DEGREES?.[1]?.[1] == value) {
                  passed = true;
                }
              }
            }
          }
        }
      }

      checks.push({ check, passed });
      if (passed || !required) passCount++;
    }

    const score = Math.round((passCount / testCases.length) * points);
    const result = passCount === testCases.length ? 'pass' : 'partial';

    let feedback = `通过 ${passCount}/${testCases.length} 个检查项\n`;
    feedback += checks.map((c, i) =>
      `${c.check}: ${c.passed ? '✓' : '✗'}`
    ).join('\n');

    return { result, score, feedback };
  } catch (err) {
    return { result: 'error', score: 0, feedback: `Scratch项目解析错误: ${err.message}` };
  }
}

module.exports = { judgeSubmission };