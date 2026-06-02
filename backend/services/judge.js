const { spawn } = require('child_process');
const fs = require('fs').promises;
const os = require('os');
const path = require('path');
const db = require('../models/db');

const RESULT_MAP = {
  accepted: 'pass',
  wrong_answer: 'fail',
  time_limit_exceeded: 'fail',
  runtime_error: 'error',
  compile_error: 'error',
  system_error: 'error',
  partial: 'partial',
};

let workerStarted = false;
let workerBusy = false;

function normalizeTestCases(question) {
  const fileCases = loadTestData(question.id);
  if (fileCases && fileCases.length) return fileCases;
  if (!question.test_cases) return [];
  if (Array.isArray(question.test_cases)) return question.test_cases;
  try {
    const parsed = JSON.parse(question.test_cases);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadTestData(questionId) {
  try {
    const files = db.prepare('SELECT * FROM test_data_files WHERE question_id = ? ORDER BY sort_order, id').all(questionId);
    if (!files.length) return null;
    const inputs = files.filter((file) => file.file_type === 'input');
    const outputs = files.filter((file) => file.file_type === 'output');
    return inputs.map((input, index) => {
      const base = input.filename.replace(/\.in$/i, '');
      const output = outputs.find((item) => item.filename.replace(/\.out$/i, '') === base) || outputs[index];
      return output ? { input: input.content, expected: output.content } : null;
    }).filter(Boolean);
  } catch {
    return null;
  }
}

function stringifyInput(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function expectedValue(testCase) {
  return testCase.expected !== undefined ? testCase.expected : testCase.output;
}

function compareOutput(actual, expected) {
  const a = String(actual ?? '').replace(/\r\n/g, '\n').trim();
  const e = String(expected ?? '').replace(/\r\n/g, '\n').trim();
  return a === e;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs || 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let killedByOutput = false;
    const limit = options.outputLimit || 1024 * 256;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > limit) {
        killedByOutput = true;
        child.kill('SIGKILL');
      }
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > limit) {
        killedByOutput = true;
        child.kill('SIGKILL');
      }
    });
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: err.message, error: err }));
    child.on('close', (code, signal) => {
      resolve({ code, signal, stdout, stderr, timedOut: signal === 'SIGTERM' || signal === 'SIGKILL', killedByOutput });
    });
    if (options.input) child.stdin.write(options.input);
    child.stdin.end();
  });
}

async function dockerAvailable() {
  const result = await runCommand('docker', ['--version'], { timeoutMs: 3000 });
  return result.code === 0;
}

function dockerArgs(image, workDir, command, limits) {
  return [
    'run', '--rm',
    '--network', 'none',
    '--cpus', '1',
    '--memory', `${limits.memoryLimitMb || 128}m`,
    '--pids-limit', '128',
    '-v', `${workDir}:/work:rw`,
    '-w', '/work',
    image,
    'sh', '-lc', command,
  ];
}

async function runInDocker(image, workDir, command, input, limits) {
  return runCommand('docker', dockerArgs(image, workDir, command, limits), {
    input,
    timeoutMs: (limits.timeLimitMs || 1000) + 2500,
    outputLimit: 1024 * 128,
  });
}

async function judgePython(question, code, testCases, workDir) {
  await fs.writeFile(path.join(workDir, 'main.py'), code || '');
  return runCases('python:3.12-alpine', workDir, 'python /work/main.py', question, testCases);
}

async function judgeCpp(question, code, testCases, workDir) {
  await fs.writeFile(path.join(workDir, 'main.cpp'), code || '');
  const compile = await runInDocker(
    'gcc:13',
    workDir,
    'g++ main.cpp -std=c++17 -O2 -pipe -static -s -o main',
    '',
    { timeLimitMs: 10000, memoryLimitMb: Math.max(question.memory_limit_mb || 128, 256) }
  );
  if (compile.code !== 0) {
    return {
      status: 'compile_error',
      score: 0,
      feedback: compile.stderr || compile.stdout || '编译失败',
      compile_output: compile.stderr || compile.stdout,
      runtime_output: '',
      case_results: [],
    };
  }
  return runCases('gcc:13', workDir, './main', question, testCases, compile.stderr || compile.stdout);
}

async function runCases(image, workDir, command, question, testCases, compileOutput = '') {
  const caseResults = [];
  let passCount = 0;
  for (let index = 0; index < testCases.length; index += 1) {
    const testCase = testCases[index];
    const input = stringifyInput(testCase.input);
    const expected = expectedValue(testCase);
    const result = await runInDocker(image, workDir, command, input, {
      timeLimitMs: question.time_limit_ms || 1000,
      memoryLimitMb: question.memory_limit_mb || 128,
    });

    let status = 'accepted';
    if (result.timedOut) status = 'time_limit_exceeded';
    else if (result.code !== 0) status = 'runtime_error';
    else if (!compareOutput(result.stdout, expected)) status = 'wrong_answer';

    if (status === 'accepted') passCount += 1;
    caseResults.push({
      index: index + 1,
      status,
      input,
      expected: String(expected ?? ''),
      actual: String(result.stdout ?? '').trim(),
      error: result.stderr || (result.killedByOutput ? '输出超过限制' : ''),
    });
  }

  const status = passCount === testCases.length ? 'accepted' : passCount > 0 ? 'partial' : caseResults[0]?.status || 'wrong_answer';
  const score = testCases.length ? Math.round((passCount / testCases.length) * (question.points || 0)) : 0;
  const feedback = `通过 ${passCount}/${testCases.length} 个测试点`;
  return {
    status,
    score,
    feedback,
    compile_output: compileOutput,
    runtime_output: caseResults.map((item) => item.actual).join('\n---\n'),
    case_results: caseResults,
  };
}

async function judgeSubmissionRecord(submissionId) {
  const submission = db.prepare(`
    SELECT s.*, q.title, q.type, q.language as question_language, q.test_cases, q.points,
      q.time_limit_ms, q.memory_limit_mb
    FROM submissions s
    JOIN questions q ON s.question_id = q.id
    WHERE s.id = ?
  `).get(submissionId);
  if (!submission) return;

  db.prepare("UPDATE submissions SET status = 'judging', result = 'pending' WHERE id = ?").run(submissionId);

  try {
    const question = {
      id: submission.question_id,
      type: submission.type,
      language: submission.question_language,
      test_cases: submission.test_cases,
      points: submission.points,
      time_limit_ms: submission.time_limit_ms,
      memory_limit_mb: submission.memory_limit_mb,
    };
    const testCases = normalizeTestCases(question);
    if (!testCases.length) throw new Error('题目没有可用测试数据');
    if (!(await dockerAvailable())) throw new Error('Docker 不可用，请确认已安装并启动 Docker');

    const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `bilin-judge-${submissionId}-`));
    let judgeResult;
    try {
      const language = submission.language || question.language;
      if (language === 'python') judgeResult = await judgePython(question, submission.code, testCases, workDir);
      else if (language === 'cpp') judgeResult = await judgeCpp(question, submission.code, testCases, workDir);
      else throw new Error(`不支持的编程语言: ${language || 'unknown'}`);
    } finally {
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
    }

    db.prepare(`
      UPDATE submissions
      SET status = ?, result = ?, score = ?, feedback = ?, compile_output = ?,
          runtime_output = ?, case_results = ?, judged_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      judgeResult.status,
      RESULT_MAP[judgeResult.status] || 'error',
      judgeResult.score,
      judgeResult.feedback,
      judgeResult.compile_output || '',
      judgeResult.runtime_output || '',
      JSON.stringify(judgeResult.case_results || []),
      submissionId
    );
  } catch (err) {
    db.prepare(`
      UPDATE submissions
      SET status = 'system_error', result = 'error', score = 0, feedback = ?,
          compile_output = '', runtime_output = '', case_results = '[]', judged_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(err.message || '系统错误', submissionId);
  }
}

async function processNextSubmission() {
  if (workerBusy) return;
  const next = db.prepare(`
    SELECT id FROM submissions
    WHERE status = 'pending' AND (language = 'python' OR language = 'cpp')
    ORDER BY submitted_at ASC
    LIMIT 1
  `).get();
  if (!next) return;
  workerBusy = true;
  try {
    await judgeSubmissionRecord(next.id);
  } finally {
    workerBusy = false;
  }
}

function startJudgeWorker() {
  if (workerStarted) return;
  workerStarted = true;
  setInterval(() => {
    processNextSubmission().catch((err) => console.error('判题队列错误:', err));
  }, 1500);
}

module.exports = { startJudgeWorker, judgeSubmissionRecord };
