const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware, verifyToken } = require('../middleware/auth');

const jsonField = (value) => {
  if (!value) return null;
  return typeof value === 'string' ? value : JSON.stringify(value);
};

// 获取题目列表（公开，登录用户可看每题状态）
router.get('/', (req, res) => {
  try {
    const { type, language, difficulty, search, qid, tag, source, page = 1, limit = 50 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const limitNumber = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const offset = (pageNumber - 1) * limitNumber;
    
    // 尝试解析用户token（可选登录）
    let userId = 0;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded) userId = decoded.id;
    }
    
    const where = ['q.is_public = 1'];
    const params = [];
    
    if (type) {
      where.push('q.type = ?');
      params.push(type);
    }
    if (language) {
      where.push('q.language = ?');
      params.push(language);
    }
    if (difficulty) {
      where.push('q.difficulty = ?');
      params.push(difficulty);
    }
    if (search) {
      where.push('q.title LIKE ?');
      params.push(`%${search}%`);
    }
    if (qid) {
      where.push('q.id = ?');
      params.push(Number(qid));
    }
    if (tag) {
      where.push('q.tags LIKE ?');
      params.push(`%${tag}%`);
    }
    if (source) {
      where.push('q.source LIKE ?');
      params.push(`%${source}%`);
    }

    const whereSql = where.join(' AND ');
    const questions = db.prepare(`
      SELECT q.id, q.title, q.type, q.language, q.difficulty, q.points, q.tags, q.source,
        q.time_limit_ms, q.memory_limit_mb
      FROM questions q
      WHERE ${whereSql}
      ORDER BY q.id ASC
      LIMIT ? OFFSET ?
    `).all(...params, limitNumber, offset);
    
    // 获取总数
    const total = db.prepare(`SELECT COUNT(*) as total FROM questions q WHERE ${whereSql}`).get(...params).total;

    const questionIds = questions.map((q) => q.id);
    const placeholders = questionIds.map(() => '?').join(',');
    const statsByQuestion = {};
    if (questionIds.length > 0) {
      const stats = db.prepare(`
        SELECT question_id,
          COUNT(id) as submission_count,
          COUNT(DISTINCT CASE WHEN status = 'accepted' OR result = 'pass' THEN user_id END) as accepted_count,
          SUM(CASE WHEN status = 'accepted' OR result = 'pass' THEN 1 ELSE 0 END) as accepted_submissions
        FROM submissions
        WHERE question_id IN (${placeholders})
        GROUP BY question_id
      `).all(...questionIds);
      stats.forEach((item) => {
        statsByQuestion[item.question_id] = item;
      });
    }
    
    // 如果用户已登录，获取每题的提交状态
    let questionStatuses = {};
    if (userId && questionIds.length > 0) {
      const statuses = db.prepare(`
        SELECT question_id,
          CASE
            WHEN SUM(CASE WHEN result = 'pass' OR status = 'accepted' THEN 1 ELSE 0 END) > 0 THEN 'pass'
            WHEN COUNT(*) > 0 THEN 'fail'
            ELSE 'none'
          END as status
        FROM submissions
        WHERE user_id = ? AND question_id IN (${placeholders})
        GROUP BY question_id
      `).all(userId, ...questionIds);
      statuses.forEach(s => { questionStatuses[s.question_id] = s.status; });
    }
    
    // 给每题附加 status
    const questionsWithStatus = questions.map(q => {
      const stats = statsByQuestion[q.id] || {};
      const submissionCount = stats.submission_count || 0;
      const acceptedSubmissions = stats.accepted_submissions || 0;
      return {
        ...q,
        submission_count: submissionCount,
        accepted_count: stats.accepted_count || 0,
        accepted_submissions: acceptedSubmissions,
        status: questionStatuses[q.id] || 'none',
        ac_rate: submissionCount > 0 ? Math.round((acceptedSubmissions / submissionCount) * 100) : 0,
      };
    });
    
    res.json({ questions: questionsWithStatus, total, page: pageNumber, limit: limitNumber });
  } catch (err) {
    console.error('获取题目列表失败:', err);
    res.status(500).json({ error: '获取题目列表失败' });
  }
});

// 获取单个题目详情（公开，但登录用户可看是否已解）
router.get('/:id', (req, res) => {
  try {
    const userId = req.user?.id || 0;
    const stmt = db.prepare(`
      SELECT q.*, 
        (SELECT COUNT(*) FROM submissions WHERE question_id = q.id AND user_id = ? AND (result = 'pass' OR status = 'accepted')) as solved,
        (SELECT COUNT(*) FROM submissions WHERE question_id = q.id) as submission_count,
        (SELECT COUNT(DISTINCT user_id) FROM submissions WHERE question_id = q.id AND (result = 'pass' OR status = 'accepted')) as accepted_count
      FROM questions q WHERE q.id = ?
    `);
    const question = stmt.get(userId, req.params.id);
    
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    
    // 解析JSON字段
    if (question.options) question.options = JSON.parse(question.options);
    if (question.test_cases) question.test_cases = JSON.parse(question.test_cases);
    if (question.scratch_template) question.scratch_template = JSON.parse(question.scratch_template);
    
    res.json(question);
  } catch (err) {
    res.status(500).json({ error: '获取题目详情失败' });
  }
});

// 创建题目（管理员）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags, source, time_limit_ms, memory_limit_mb, is_public } = req.body;
    
    if (!title || !type || !content || !answer) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO questions (title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags, source, time_limit_ms, memory_limit_mb, is_public, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      title,
      type,
      language || null,
      difficulty || 'medium',
      content,
      jsonField(options),
      answer,
      jsonField(test_cases),
      jsonField(scratch_template),
      points || 10,
      tags || null,
      source || '',
      Number(time_limit_ms) || 1000,
      Number(memory_limit_mb) || 128,
      is_public === undefined ? 1 : (is_public ? 1 : 0),
      req.user.id
    );
    
    res.status(201).json({ id: result.lastInsertRowid, message: '题目创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建题目失败' });
  }
});

// 更新题目（管理员）
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags, source, time_limit_ms, memory_limit_mb, is_public } = req.body;
    
    const stmt = db.prepare(`
      UPDATE questions SET
        title = COALESCE(?, title),
        type = COALESCE(?, type),
        language = COALESCE(?, language),
        difficulty = COALESCE(?, difficulty),
        content = COALESCE(?, content),
        options = COALESCE(?, options),
        answer = COALESCE(?, answer),
        test_cases = COALESCE(?, test_cases),
        scratch_template = COALESCE(?, scratch_template),
        points = COALESCE(?, points),
        tags = COALESCE(?, tags),
        source = COALESCE(?, source),
        time_limit_ms = COALESCE(?, time_limit_ms),
        memory_limit_mb = COALESCE(?, memory_limit_mb),
        is_public = COALESCE(?, is_public),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      title,
      type,
      language,
      difficulty,
      content,
      jsonField(options),
      answer,
      jsonField(test_cases),
      jsonField(scratch_template),
      points,
      tags,
      source,
      time_limit_ms === undefined ? null : Number(time_limit_ms) || 1000,
      memory_limit_mb === undefined ? null : Number(memory_limit_mb) || 128,
      is_public === undefined ? null : (is_public ? 1 : 0),
      req.params.id
    );
    
    res.json({ message: '题目更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新题目失败' });
  }
});

// 删除题目（管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM questions WHERE id = ?').run(req.params.id);
    res.json({ message: '题目删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除题目失败' });
  }
});

module.exports = router;
// ========== 测试数据文件 API ==========

// 获取某题的所有测试数据文件
router.get('/:id/test-data', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM test_data_files WHERE question_id = ? ORDER BY sort_order, id').all(req.params.id);
    res.json({ files: rows });
  } catch (err) {
    res.status(500).json({ error: '获取测试数据失败: ' + err.message });
  }
});

// 上传测试数据文件（支持多文件）
router.post('/:id/test-data', (req, res) => {
  try {
    const { files } = req.body;
    if (!Array.isArray(files) || files.length === 0) return res.status(400).json({ error: '请提供文件' });

    const insert = db.prepare('INSERT INTO test_data_files (question_id, filename, file_type, content, sort_order) VALUES (?, ?, ?, ?, ?)');
    const qid = Number(req.params.id);

    db.prepare('DELETE FROM test_data_files WHERE question_id = ?').run(qid);

    let order = 0;
    for (const f of files) {
      const ext = f.filename.split('.').pop().toLowerCase();
      const fileType = (ext === 'in' || f.file_type === 'input') ? 'input' : 'output';
      insert.run(qid, f.filename, fileType, f.content, order++);
    }

    res.json({ message: '成功上传 ' + files.length + ' 个文件' });
  } catch (err) {
    res.status(500).json({ error: '保存失败: ' + err.message });
  }
});

// 删除单个测试数据文件
router.delete('/test-data/:fileId', (req, res) => {
  try {
    db.prepare('DELETE FROM test_data_files WHERE id = ?').run(req.params.fileId);
    res.json({ message: '已删除' });
  } catch (err) {
    res.status(500).json({ error: '删除失败: ' + err.message });
  }
});
