const express = require('express');
const router = express.Router();
const db = require('../models/db');
const authMiddleware = require('../middleware/auth').authMiddleware;
const multer = require('multer');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

// 配置上传
const upload = multer({ dest: '/tmp/uploads/' });

function getExamLanguage(exam) {
  const text = `${exam.title || ''} ${exam.description || ''}`.toLowerCase();
  if (text.includes('c++') || text.includes('cpp')) return 'C++';
  if (text.includes('python')) return 'Python';
  if (text.includes('scratch')) return 'Scratch';
  if (text.includes('图形化')) return '图形化';
  return '其他';
}

function getExamContest(exam) {
  const text = `${exam.title || ''} ${exam.description || ''}`;
  if (text.includes('数字守艺人')) return '数字守艺人';
  if (text.includes('GESP')) return 'GESP';
  if (text.includes('电子学会') || text.includes('青少年软件编程')) return '电子学会';
  if (text.includes('信息素养大赛')) return '信息素养大赛';
  return '其他';
}

function withExamCategories(exam) {
  return {
    ...exam,
    language_category: getExamLanguage(exam),
    contest_category: getExamContest(exam),
  };
}

// 获取考试列表
router.get('/', (req, res) => {
  const { search = '', language = '', contest = '' } = req.query;
  const keyword = String(search || '').trim().toLowerCase();
  const languageFilter = String(language || '').trim();
  const contestFilter = String(contest || '').trim();

  let exams = db.prepare(`
    SELECT id, title, description, difficulty, duration, total_score, question_count, start_time, end_time, created_at
    FROM exams
    ORDER BY created_at DESC
  `).all().map(withExamCategories);

  if (keyword) {
    exams = exams.filter((exam) => {
      const haystack = [
        exam.title,
        exam.description,
        exam.difficulty,
        exam.language_category,
        exam.contest_category,
      ].join(' ').toLowerCase();
      return haystack.includes(keyword);
    });
  }

  if (languageFilter && languageFilter !== '全部') {
    exams = exams.filter((exam) => exam.language_category === languageFilter);
  }

  if (contestFilter && contestFilter !== '全部') {
    exams = exams.filter((exam) => exam.contest_category === contestFilter);
  }

  res.json(exams);
});

// 获取用户的历史考试记录
router.get('/records', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const records = db.prepare(`
    SELECT er.*, e.title, e.duration, e.total_score, e.question_count
    FROM exam_records er
    JOIN exams e ON e.id = er.exam_id
    WHERE er.user_id = ?
    ORDER BY er.started_at DESC
  `).all(userId);

  const parsed = records.map(r => ({
    ...r,
    answers: r.answers ? JSON.parse(r.answers) : {},
  }));

  res.json(parsed);
});

// 获取考试详情（含题目，管理员/本人可看答案）
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  // 查题目
  const questions = db.prepare(`
    SELECT q.id, q.title, q.type, q.content, q.options, q.answer, q.difficulty, q.desc_images, q.subtype, eq.sort_order
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.sort_order
  `).all(id);

  // 解析 JSON 字段
  const parsed = questions.map(q => ({
    ...q,
    options: q.options ? JSON.parse(q.options) : null,
    answer: q.answer || null,
    descImages: (q.desc_images ? JSON.parse(q.desc_images) : []).map(f =>
      f.startsWith('http') ? f : `/media/${f}`
    ),
  }));

  // 查该用户最近的进行中记录（用于恢复答题）
  let inProgressRecord = null;
  let existingRecords = [];
  if (userId) {
    inProgressRecord = db.prepare(
      "SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? AND status = 'in_progress' ORDER BY id DESC LIMIT 1"
    ).get(id, userId);
    if (inProgressRecord && inProgressRecord.answers) {
      inProgressRecord.answers = JSON.parse(inProgressRecord.answers);
    }
    existingRecords = db.prepare(
      "SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 20"
    ).all(id, userId).map(r => ({
      ...r,
      answers: r.answers ? JSON.parse(r.answers) : {},
    }));
  }

  res.json({ exam, questions: parsed, inProgressRecord, existingRecords });
});

// 开始考试（每次都新建记录，允许重复做）
router.post('/:id/start', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  // 每次都新建一条记录
  db.prepare('INSERT INTO exam_records (exam_id, user_id, started_at) VALUES (?, ?, ?)')
    .run(id, userId, new Date().toISOString());

  const record = db.prepare(
    "SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1"
  ).get(id, userId);

  res.json({ record: { ...record, answers: record.answers ? JSON.parse(record.answers) : {} } });
});

// 提交答案（自动评分）
router.post('/:id/submit', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const { answers } = req.body; // { questionId: answer }

  const exam = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  // 获取所有题目
  const questions = db.prepare(`
    SELECT q.id, q.type, q.answer, eq.sort_order
    FROM exam_questions eq
    JOIN questions q ON q.id = eq.question_id
    WHERE eq.exam_id = ?
    ORDER BY eq.sort_order
  `).all(id);

  // 评分
  let score = 0;
  const results = [];
  for (const q of questions) {
    const userAns = answers[q.id] || null;
    let correct = false;
    if (q.type === 'choice' && q.answer) {
      correct = String(userAns).trim().toUpperCase() === String(q.answer).trim().toUpperCase();
    } else if (q.type === 'judge' && q.answer) {
      const ans = String(q.answer).trim().toLowerCase();
      const ua = String(userAns).trim().toLowerCase();
      correct = (ua === 'true' || ua === '正确' || ua === '1') === (ans === 'true' || ans === '正确' || ans === '1');
    } else if (q.type === 'programming') {
      correct = null;
    }

    if (correct === true) {
      const pts = q.type === 'choice' ? 2 : (q.type === 'judge' ? 2 : 0);
      score += pts;
    }

    results.push({
      question_id: q.id,
      user_answer: userAns,
      correct,
    });
  }

  const now = new Date().toISOString();
  const activeRecord = db.prepare(`
    SELECT id FROM exam_records
    WHERE exam_id = ? AND user_id = ? AND status = 'in_progress'
    ORDER BY id DESC LIMIT 1
  `).get(id, userId);

  if (!activeRecord) {
    return res.status(400).json({ error: '没有进行中的考试记录，请重新开始考试' });
  }

  db.prepare(`
    UPDATE exam_records SET answers = ?, score = ?, submitted_at = ?, status = 'submitted'
    WHERE id = ?
  `).run(JSON.stringify(answers), score, now, activeRecord.id);

  const record = db.prepare(
    "SELECT * FROM exam_records WHERE exam_id = ? AND user_id = ? ORDER BY id DESC LIMIT 1"
  ).get(id, userId);

  res.json({
    record: { ...record, answers: record.answers ? JSON.parse(record.answers) : {} },
    score,
    total: exam.total_score,
    results,
  });
});

// 管理员：修改考试基本信息
router.put('/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以修改考试' });
  }
  const { id } = req.params;
  const { title, description, difficulty, duration, start_time, end_time } = req.body;

  const existing = db.prepare('SELECT id FROM exams WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: '考试不存在' });

  db.prepare(`
    UPDATE exams SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      difficulty = COALESCE(?, difficulty),
      duration = COALESCE(?, duration),
      start_time = COALESCE(?, start_time),
      end_time = COALESCE(?, end_time)
    WHERE id = ?
  `).run(title||null, description||null, difficulty||null, duration||null, start_time||null, end_time||null, id);

  res.json({ message: '考试信息已更新' });
});

// 管理员：修改考试中的题目（卷面内容）
router.put('/:id/questions/:qid', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以修改题目' });
  }
  const { id, qid } = req.params;
  const { title, content, options, answer, subtype, desc_images } = req.body;

  // 检查题目是否属于该考试
  const eq = db.prepare('SELECT id FROM exam_questions WHERE exam_id = ? AND question_id = ?').get(id, qid);
  if (!eq) return res.status(404).json({ error: '该题目不在此考试中' });

  const optStr = options ? JSON.stringify(options) : null;
  const descStr = desc_images ? JSON.stringify(desc_images) : null;

  db.prepare(`
    UPDATE questions SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      options = COALESCE(?, options),
      answer = COALESCE(?, answer),
      subtype = COALESCE(?, subtype),
      desc_images = COALESCE(?, desc_images)
    WHERE id = ?
  `).run(title||null, content||null, optStr, answer||null, subtype||null, descStr, qid);

  res.json({ message: '题目已更新' });
});

// 管理员：删除考试中的题目
router.delete('/:id/questions/:qid', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以删除题目' });
  }
  const { id, qid } = req.params;
  db.prepare('DELETE FROM exam_questions WHERE exam_id = ? AND question_id = ?').run(id, qid);
  db.prepare('UPDATE exams SET question_count = question_count - 1 WHERE id = ?').run(id);
  res.json({ message: '题目已从考试中移除' });
});

// 管理员：新增题目到考试
router.post('/:id/questions', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以添加题目' });
  }
  const { id } = req.params;
  const { title, type, content, options, answer, subtype, difficulty } = req.body;

  const exam = db.prepare('SELECT id FROM exams WHERE id = ?').get(id);
  if (!exam) return res.status(404).json({ error: '考试不存在' });

  const optStr = options ? JSON.stringify(options) : null;

  const qResult = db.prepare(`
    INSERT INTO questions (title, type, content, options, answer, difficulty, subtype)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title||'', type||'choice', content||'', optStr, answer||'', difficulty||'medium', subtype||null);

  const qId = qResult.lastInsertRowid;

  // 查当前最大 sort_order
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM exam_questions WHERE exam_id = ?').get(id);
  db.prepare('INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (?, ?, ?)').run(id, qId, (maxOrder.m||0)+1);
  db.prepare('UPDATE exams SET question_count = question_count + 1 WHERE id = ?').run(id);

  res.json({ message: '题目已添加', questionId: qId });
});

// 管理员：创建考试
router.post('/', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以创建考试' });
  }
  const { title, description, difficulty, duration, start_time, end_time, question_ids } = req.body;

  const result = db.prepare(`
    INSERT INTO exams (title, description, difficulty, duration, total_score, question_count, start_time, end_time)
    VALUES (?, ?, ?, ?, 100, ?, ?, ?)
  `).run(title, description || '', difficulty || '', duration || 60, question_ids?.length || 0,
    start_time || null, end_time || null);

  const examId = result.lastInsertRowid;

  if (question_ids && question_ids.length > 0) {
    const insert = db.prepare('INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (?, ?, ?)');
    question_ids.forEach((qid, i) => insert.run(examId, qid, i + 1));
  }

  res.json({ id: examId, message: '考试创建成功' });
});

// 管理员：删除考试
router.delete('/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以删除考试' });
  }
  const { id } = req.params;
  db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(id);
  db.prepare('DELETE FROM exam_records WHERE exam_id = ?').run(id);
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
  res.json({ message: '删除成功' });
});

// 管理员：导入试卷（PDF/DOCX）
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
    return res.status(403).json({ error: '只有管理员可以导入试卷' });
  }

  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  const { title, difficulty, duration } = req.body;
  const examTitle = title || req.file.originalname.replace(/\.(pdf|docx)$/i, '');

  try {
    let text = '';
    let images = [];

    // 解析文件
    if (req.file.originalname.toLowerCase().endsWith('.docx')) {
      console.log('Parsing DOCX:', req.file.path);
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
      console.log('Extracted text length:', text.length);
      console.log('First 500 chars:', text.substring(0, 500));
    } else if (req.file.originalname.toLowerCase().endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const dataBuffer = fs.readFileSync(req.file.path);
      const data = await pdfParse(dataBuffer);
      text = data.text;
    } else {
      return res.status(400).json({ error: '仅支持 PDF 或 DOCX 格式' });
    }

    // 解析题目
    const questions = parseQuestions(text);
    console.log('Parsed questions:', questions.length);

    if (questions.length === 0) {
      return res.status(400).json({ error: '未能识别任何题目，请检查文件格式' });
    }

    // 创建考试
    const examResult = db.prepare(`
      INSERT INTO exams (title, description, difficulty, duration, total_score, question_count)
      VALUES (?, ?, ?, ?, 100, ?)
    `).run(examTitle, '通过文件导入', difficulty || 'medium', duration || 60, questions.length);

    const examId = examResult.lastInsertRowid;

    // 插入题目
    const insertQ = db.prepare(`
      INSERT INTO questions (title, type, content, options, answer, difficulty, subtype)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertEQ = db.prepare('INSERT INTO exam_questions (exam_id, question_id, sort_order) VALUES (?, ?, ?)');

    const questionIds = [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qResult = insertQ.run(
        q.title,
        q.type,
        q.content,
        q.options ? JSON.stringify(q.options) : null,
        q.answer || '',
        difficulty || 'medium',
        q.subtype || null
      );
      const qId = qResult.lastInsertRowid;
      questionIds.push(qId);
      insertEQ.run(examId, qId, i + 1);
    }

    // 清理临时文件
    fs.unlinkSync(req.file.path);

    res.json({
      message: '导入成功',
      examId,
      questionCount: questions.length,
      preview: questions.slice(0, 3).map(q => ({ title: q.title, type: q.type }))
    });

  } catch (err) {
    console.error('导入失败:', err);
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

// 解析题目（基础版，支持常见格式）
function parseQuestions(text) {
  const questions = [];
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l);

  let currentQ = null;
  let currentOptions = [];
  let currentContent = [];

  for (const line of lines) {
    // 匹配题号：1. 或 1、或 一、等
    const qMatch = line.match(/^(\d+)[.、．]\s*(.+)/);
    // 匹配选项：A. B. C. D. 或 A、B、C、D、
    const optMatch = line.match(/^([A-D])[.、．]\s*(.+)/i);
    // 匹配答案
    const ansMatch = line.match(/^(答案|正确答案|参考答案)[：:＝]\s*([A-D正确错误√×]+)/i);

    if (qMatch) {
      // 保存上一题
      if (currentQ) {
        currentQ.content = currentContent.join('\n');
        if (currentOptions.length > 0) {
          currentQ.options = currentOptions;
          currentQ.type = currentQ.subtype === 'judge' ? 'choice' : 'choice';
        }
        questions.push(currentQ);
      }
      // 新题目
      currentQ = {
        title: `第${qMatch[1]}题`,
        type: 'choice',
        content: qMatch[2],
        options: [],
        answer: ''
      };
      currentOptions = [];
      currentContent = [qMatch[2]];
    } else if (optMatch && currentQ) {
      currentOptions.push({ label: optMatch[1].toUpperCase(), display: optMatch[2] });
    } else if (ansMatch && currentQ) {
      const ans = ansMatch[2].trim().toUpperCase();
      // 判断题答案转换
      if (ans === '正确' || ans === '√' || ans === 'TRUE') {
        currentQ.answer = 'A';
        currentQ.subtype = 'judge';
        currentQ.options = [
          { label: 'A', display: '正确' },
          { label: 'B', display: '错误' }
        ];
      } else if (ans === '错误' || ans === '×' || ans === 'FALSE') {
        currentQ.answer = 'B';
        currentQ.subtype = 'judge';
        currentQ.options = [
          { label: 'A', display: '正确' },
          { label: 'B', display: '错误' }
        ];
      } else {
        currentQ.answer = ans.charAt(0);
      }
    } else if (currentQ && !optMatch && !ansMatch) {
      // 继续追加题目内容
      currentContent.push(line);
    }
  }

  // 最后一题
  if (currentQ) {
    currentQ.content = currentContent.join('\n');
    if (currentOptions.length > 0) {
      currentQ.options = currentOptions;
    }
    questions.push(currentQ);
  }

  return questions;
}

module.exports = router;
