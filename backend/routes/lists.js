const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 获取题单列表（公开）
router.get('/', (req, res) => {
  try {
    const { page = 1, limit = 100 } = req.query;
    const offset = (page - 1) * limit;
    
    const stmt = db.prepare(`
      SELECT pl.*, u.username as creator_name,
        (SELECT COUNT(*) FROM problem_list_questions WHERE problem_list_id = pl.id) as question_count
      FROM problem_lists pl
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.is_public = 1
      ORDER BY pl.sort_order ASC, pl.id ASC
      LIMIT ? OFFSET ?
    `);
    const lists = stmt.all(Number(limit), Number(offset));
    
    const total = db.prepare('SELECT COUNT(*) as total FROM problem_lists WHERE is_public = 1').get().total;
    
    res.json({ lists, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: '获取题单列表失败' });
  }
});

// 获取题单详情（包含题目列表）
router.get('/:id', (req, res) => {
  try {
    const userId = req.user?.id || 0;
    
    const listStmt = db.prepare(`
      SELECT pl.*, u.username as creator_name
      FROM problem_lists pl
      LEFT JOIN users u ON pl.created_by = u.id
      WHERE pl.id = ?
    `);
    const list = listStmt.get(req.params.id);
    
    if (!list) {
      return res.status(404).json({ error: '题单不存在' });
    }
    
    // 获取题单中的题目
    const questionsStmt = db.prepare(`
      SELECT q.id, q.title, q.type, q.language, q.difficulty, q.points, q.tags,
        plq.order_num,
        (SELECT COUNT(*) FROM submissions WHERE question_id = q.id AND user_id = ? AND result = 'pass') as solved
      FROM problem_list_questions plq
      JOIN questions q ON plq.question_id = q.id
      WHERE plq.problem_list_id = ?
      ORDER BY plq.order_num
    `);
    const questions = questionsStmt.all(userId, req.params.id);
    
    list.questions = questions;
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: '获取题单详情失败' });
  }
});

// 创建题单（需要登录）
router.post('/', authMiddleware, (req, res) => {
  try {
    const { title, description, cover_image, question_ids, is_public = 1 } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '题单标题不能为空' });
    }
    
    const stmt = db.prepare(`
      INSERT INTO problem_lists (title, description, cover_image, is_public, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description || null, cover_image || null, is_public, req.user.id);
    
    // 添加题目到题单（过滤无效题目ID）
    if (question_ids && question_ids.length > 0) {
      const insertQuestionStmt = db.prepare(`
        INSERT INTO problem_list_questions (problem_list_id, question_id, order_num)
        VALUES (?, ?, ?)
      `);
      // 只插入真实存在的题目
      const validIds = db.prepare(
        `SELECT id FROM questions WHERE id IN (${question_ids.map(() => '?').join(',')})`
      ).all(...question_ids).map(r => r.id);
      validIds.forEach((qid, idx) => {
        insertQuestionStmt.run(result.lastInsertRowid, qid, idx);
      });
      if (validIds.length < question_ids.length) {
        const skipped = question_ids.length - validIds.length;
        res.status(201).json({ id: result.lastInsertRowid, message: `题单创建成功（跳过${skipped}个无效题目ID）` });
        return;
      }
    }
    res.status(201).json({ id: result.lastInsertRowid, message: '题单创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建题单失败' });
  }
});

// 更新题单
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const { title, description, cover_image, question_ids, is_public } = req.body;
    
    // 检查权限
    const list = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(req.params.id);
    if (!list) {
      return res.status(404).json({ error: '题单不存在' });
    }
    if (list.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限修改此题单' });
    }
    
    db.prepare(`
      UPDATE problem_lists SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        cover_image = COALESCE(?, cover_image),
        is_public = COALESCE(?, is_public)
      WHERE id = ?
    `).run(title, description, cover_image, is_public, req.params.id);
    
    // 更新题目列表（过滤无效题目ID）
    if (question_ids) {
      db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(req.params.id);
      if (question_ids.length > 0) {
        const validIds = db.prepare(
          `SELECT id FROM questions WHERE id IN (${question_ids.map(() => '?').join(',')})`
        ).all(...question_ids).map(r => r.id);
        const insertStmt = db.prepare(`
          INSERT INTO problem_list_questions (problem_list_id, question_id, order_num)
          VALUES (?, ?, ?)
        `);
        validIds.forEach((qid, idx) => {
          insertStmt.run(req.params.id, qid, idx);
        });
        if (validIds.length < question_ids.length) {
          const skipped = question_ids.length - validIds.length;
          res.json({ message: `题单更新成功（跳过${skipped}个无效题目ID）` });
          return;
        }
      }
    }
    res.json({ message: '题单更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新题单失败' });
  }
});

// 删除题单
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM problem_lists WHERE id = ?').get(req.params.id);
    if (!list) {
      return res.status(404).json({ error: '题单不存在' });
    }
    if (list.created_by !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '无权限删除此题单' });
    }
    
    db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(req.params.id);
    db.prepare('DELETE FROM problem_lists WHERE id = ?').run(req.params.id);
    
    res.json({ message: '题单删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除题单失败' });
  }
});

// 获取我的题单
router.get('/my', authMiddleware, (req, res) => {
  try {
    const stmt = db.prepare(`
      SELECT pl.*,
        (SELECT COUNT(*) FROM problem_list_questions WHERE problem_list_id = pl.id) as question_count
      FROM problem_lists pl
      WHERE pl.created_by = ?
      ORDER BY pl.sort_order ASC, pl.id ASC
    `);
    const lists = stmt.all(req.user.id);
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: '获取我的题单失败' });
  }
});

// 批量更新题单顺序（管理员）
router.patch('/reorder', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { order } = req.body; // [{id: number, sort_order: number}, ...]
    if (!Array.isArray(order)) {
      return res.status(400).json({ error: 'order 必须是数组' });
    }
    const updateStmt = db.prepare('UPDATE problem_lists SET sort_order = ? WHERE id = ?');
    const updateMany = db.transaction((items) => {
      for (const item of items) {
        updateStmt.run(item.sort_order, item.id);
      }
    });
    updateMany(order);
    res.json({ message: '顺序更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新顺序失败' });
  }
});

module.exports = router;