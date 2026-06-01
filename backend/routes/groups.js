const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 老师获取自己创建的小组列表
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const groups = db.prepare('SELECT g.* FROM groups g WHERE g.teacher_id = ? ORDER BY created_at DESC').all(req.user.id);
  const result = groups.map(g => {
    const members = db.prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND status = ?').get(g.id, 'approved');
    const pending = db.prepare('SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND status = ?').get(g.id, 'pending');
    return { ...g, member_count: members.count, pending_count: pending.count };
  });
  res.json({ groups: result });
});

// 学生获取自己加入的小组列表
router.get('/my', authMiddleware, (req, res) => {
  const groups = db.prepare(`SELECT g.*, gm.status, u.username as teacher_name
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.teacher_id = u.id
    WHERE gm.member_id = ?
    ORDER BY g.created_at DESC`).all(req.user.id);
  res.json({ groups });
});

// 获取所有小组列表（学生浏览用）
router.get('/all', authMiddleware, (req, res) => {
  const groups = db.prepare(`SELECT g.*, u.username as teacher_name,
    (SELECT status FROM group_members WHERE group_id = g.id AND member_id = ?) as my_status
    FROM groups g
    JOIN users u ON g.teacher_id = u.id
    ORDER BY g.created_at DESC`).all(req.user.id);
  res.json({ groups });
});

// 创建小组（老师）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: '小组名称不能为空' });
  const result = db.prepare('INSERT INTO groups (name, teacher_id, description) VALUES (?, ?, ?)').run(name, req.user.id, description || '');
  res.json({ id: result.lastInsertRowid, name, teacher_id: req.user.id });
});

// 删除小组（老师）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!group) return res.status(403).json({ error: '无权限或小组不存在' });
  
  // 删除成员、题单关联、题单、小组
  db.transaction(() => {
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(req.params.id);
    const lists = db.prepare('SELECT id FROM problem_lists WHERE group_id = ?').all(req.params.id);
    lists.forEach(list => {
      db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(list.id);
    });
    db.prepare('DELETE FROM problem_lists WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  })();
  
  res.json({ message: '删除成功' });
});

// 学生申请加入小组
router.post('/:id/join', authMiddleware, (req, res) => {
  const groupId = req.params.id;
  const existing = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND member_id = ?').get(groupId, req.user.id);
  if (existing) return res.status(400).json({ error: '已经申请过或已加入' });
  db.prepare('INSERT INTO group_members (group_id, member_id, status) VALUES (?, ?, ?)').run(groupId, req.user.id, 'pending');
  res.json({ message: '申请已提交，等待老师审核' });
});

// 获取小组详情（含题单列表）
router.get('/:id', authMiddleware, (req, res) => {
  const group = db.prepare('SELECT g.*, u.username as teacher_name FROM groups g LEFT JOIN users u ON g.teacher_id = u.id WHERE g.id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: '小组不存在' });
  
  const members = db.prepare(`SELECT u.id, u.username, u.email, gm.joined_at, gm.status, gm.id as member_id
    FROM group_members gm
    JOIN users u ON gm.member_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at DESC`).all(req.params.id);
  
  // 获取小组的题单列表
  const lists = db.prepare(`
    SELECT pl.*, 
      (SELECT COUNT(*) FROM problem_list_questions WHERE problem_list_id = pl.id) as question_count
    FROM problem_lists pl
    WHERE pl.group_id = ?
    ORDER BY pl.sort_order, pl.created_at DESC
  `).all(req.params.id);
  
  res.json({
    group,
    members: members.filter(m => m.status === 'approved'),
    pending_members: members.filter(m => m.status === 'pending'),
    problem_lists: lists
  });
});

// 老师审核成员
router.post('/:groupId/members/:memberId/approve', authMiddleware, adminMiddleware, (req, res) => {
  const { groupId, memberId } = req.params;
  const { action } = req.body;
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(groupId, req.user.id);
  if (!group) return res.status(403).json({ error: '无权限' });
  const status = action === 'approve' ? 'approved' : 'rejected';
  db.prepare('UPDATE group_members SET status = ? WHERE group_id = ? AND member_id = ?').run(status, groupId, memberId);
  res.json({ message: action === 'approve' ? '已通过' : '已拒绝' });
});

// ========== 题单管理 ==========

// 创建题单
router.post('/:id/lists', authMiddleware, adminMiddleware, (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: '题单标题不能为空' });
  
  const group = db.prepare('SELECT * FROM groups WHERE id = ? AND teacher_id = ?').get(req.params.id, req.user.id);
  if (!group) return res.status(403).json({ error: '无权限' });
  
  const result = db.prepare('INSERT INTO problem_lists (title, description, group_id, created_by) VALUES (?, ?, ?, ?)')
    .run(title, description || '', req.params.id, req.user.id);
  
  res.json({ id: result.lastInsertRowid, title, description });
});

// 获取题单详情（含题目列表）
router.get('/:groupId/lists/:listId', authMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT pl.*, g.teacher_id
    FROM problem_lists pl
    LEFT JOIN groups g ON pl.group_id = g.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  
  if (!list) return res.status(404).json({ error: '题单不存在' });
  
  const questions = db.prepare(`
    SELECT q.id, q.title, q.type, q.language, q.difficulty, plq.order_num
    FROM problem_list_questions plq
    JOIN questions q ON plq.question_id = q.id
    WHERE plq.problem_list_id = ?
    ORDER BY plq.order_num
  `).all(req.params.listId);
  
  res.json({ list, questions });
});

// 更新题单
router.put('/:groupId/lists/:listId', authMiddleware, adminMiddleware, (req, res) => {
  const { title, description } = req.body;
  const list = db.prepare(`
    SELECT pl.*, g.teacher_id
    FROM problem_lists pl
    LEFT JOIN groups g ON pl.group_id = g.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  
  if (!list) return res.status(404).json({ error: '题单不存在' });
  if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  
  db.prepare('UPDATE problem_lists SET title = ?, description = ? WHERE id = ?')
    .run(title || list.title, description !== undefined ? description : list.description, req.params.listId);
  
  res.json({ message: '更新成功' });
});

// 删除题单
router.delete('/:groupId/lists/:listId', authMiddleware, adminMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT pl.*, g.teacher_id
    FROM problem_lists pl
    LEFT JOIN groups g ON pl.group_id = g.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  
  if (!list) return res.status(404).json({ error: '题单不存在' });
  if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  
  db.transaction(() => {
    db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(req.params.listId);
    db.prepare('DELETE FROM problem_lists WHERE id = ?').run(req.params.listId);
  })();
  
  res.json({ message: '删除成功' });
});

// 添加题目到题单
router.post('/:groupId/lists/:listId/questions', authMiddleware, adminMiddleware, (req, res) => {
  const { question_ids } = req.body;
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return res.status(400).json({ error: '请选择题目' });
  }
  
  const list = db.prepare(`
    SELECT pl.*, g.teacher_id
    FROM problem_lists pl
    LEFT JOIN groups g ON pl.group_id = g.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  
  if (!list) return res.status(404).json({ error: '题单不存在' });
  if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  
  const maxOrder = db.prepare('SELECT MAX(order_num) as max FROM problem_list_questions WHERE problem_list_id = ?').get(req.params.listId);
  let nextOrder = (maxOrder.max || 0) + 1;
  
  const stmt = db.prepare('INSERT OR IGNORE INTO problem_list_questions (problem_list_id, question_id, order_num) VALUES (?, ?, ?)');
  
  db.transaction(() => {
    question_ids.forEach(qid => {
      stmt.run(req.params.listId, qid, nextOrder++);
    });
  })();
  
  res.json({ message: '添加成功', added: question_ids.length });
});

// 从题单移除题目
router.delete('/:groupId/lists/:listId/questions/:questionId', authMiddleware, adminMiddleware, (req, res) => {
  const list = db.prepare(`
    SELECT pl.*, g.teacher_id
    FROM problem_lists pl
    LEFT JOIN groups g ON pl.group_id = g.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  
  if (!list) return res.status(404).json({ error: '题单不存在' });
  if (list.teacher_id !== req.user.id) return res.status(403).json({ error: '无权限' });
  
  db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ? AND question_id = ?')
    .run(req.params.listId, req.params.questionId);
  
  res.json({ message: '移除成功' });
});

// 获取小组作业列表
router.get('/:id/assignments', authMiddleware, (req, res) => {
  const assignments = db.prepare(`SELECT a.*,
    (SELECT COUNT(*) FROM assignment_questions WHERE assignment_id = a.id) as question_count
    FROM assignments a
    WHERE a.group_id = ?
    ORDER BY a.created_at DESC`).all(req.params.id);
  res.json({ assignments });
});

module.exports = router;
