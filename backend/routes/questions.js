const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware, verifyToken } = require('../middleware/auth');

// 获取题目列表（公开，登录用户可看每题状态）
router.get('/', (req, res) => {
  try {
    const { type, language, difficulty, search, qid, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    // 尝试解析用户token（可选登录）
    let userId = 0;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const decoded = verifyToken(authHeader.substring(7));
      if (decoded) userId = decoded.id;
    }
    
    let sql = 'SELECT id, title, type, language, difficulty, points, tags FROM questions WHERE 1=1';
    const params = [];
    
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (language) {
      sql += ' AND language = ?';
      params.push(language);
    }
    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }
    if (search) {
      sql += ' AND title LIKE ?';
      params.push(`%${search}%`);
    }
    if (qid) {
      sql = sql.replace(' WHERE 1=1', ' WHERE 1=1 AND id = ?');
      params.unshift(Number(qid));
    }
    
    sql += ' ORDER BY id ASC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const stmt = db.prepare(sql);
    const questions = stmt.all(...params);
    
    // 获取总数
    let countSql = 'SELECT COUNT(*) as total FROM questions WHERE 1=1';
    const countParams = [];
    if (type) { countSql += ' AND type = ?'; countParams.push(type); }
    if (language) { countSql += ' AND language = ?'; countParams.push(language); }
    if (difficulty) { countSql += ' AND difficulty = ?'; countParams.push(difficulty); }
    if (search) { countSql += ' AND title LIKE ?'; countParams.push(`%${search}%`); }
    if (qid) { countSql = countSql.replace(' WHERE 1=1', ' WHERE 1=1 AND id = ?'); countParams.unshift(Number(qid)); }
    const total = db.prepare(countSql).get(...countParams).total;
    
    // 如果用户已登录，获取每题的提交状态
    let questionStatuses = {};
    if (userId) {
      const statuses = db.prepare(`
        SELECT question_id,
          CASE
            WHEN SUM(CASE WHEN result = 'pass' THEN 1 ELSE 0 END) > 0 THEN 'pass'
            WHEN SUM(CASE WHEN result = 'accepted' THEN 1 ELSE 0 END) > 0 THEN 'pass'
            WHEN COUNT(*) > 0 THEN 'fail'
            ELSE 'none'
          END as status
        FROM submissions
        WHERE user_id = ?
        GROUP BY question_id
      `).all(userId);
      statuses.forEach(s => { questionStatuses[s.question_id] = s.status; });
    }
    
    // 给每题附加 status
    const questionsWithStatus = questions.map(q => ({
      ...q,
      status: questionStatuses[q.id] || 'none'
    }));
    
    res.json({ questions: questionsWithStatus, total, page: Number(page), limit: Number(limit) });
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
        (SELECT COUNT(*) FROM submissions WHERE question_id = q.id AND user_id = ? AND result = 'pass') as solved
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
    const { title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags } = req.body;
    
    if (!title || !type || !content || !answer) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO questions (title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      title,
      type,
      language || null,
      difficulty || 'medium',
      content,
      options ? JSON.stringify(options) : null,
      answer,
      test_cases ? JSON.stringify(test_cases) : null,
      scratch_template ? JSON.stringify(scratch_template) : null,
      points || 10,
      tags || null,
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
    const { title, type, language, difficulty, content, options, answer, test_cases, scratch_template, points, tags } = req.body;
    
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
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);
    
    stmt.run(
      title,
      type,
      language,
      difficulty,
      content,
      options ? JSON.stringify(options) : null,
      answer,
      test_cases ? JSON.stringify(test_cases) : null,
      scratch_template ? JSON.stringify(scratch_template) : null,
      points,
      tags,
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
