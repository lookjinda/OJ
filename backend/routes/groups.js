const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware, verifyToken } = require('../middleware/auth');

const isAdmin = (user) => user?.role === 'admin' || user?.role === 'teacher';

function groupSummaryRows(rows) {
  return rows.map((g) => ({
    ...g,
    member_count: db.prepare(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND status = ?'
    ).get(g.id, 'approved').count,
    pending_count: db.prepare(
      'SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND status = ?'
    ).get(g.id, 'pending').count,
    list_count: db.prepare('SELECT COUNT(*) as count FROM problem_lists WHERE group_id = ?').get(g.id).count,
  }));
}

function requireGroupOwner(req, res, groupId) {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId);
  if (!group) {
    res.status(404).json({ error: '小组不存在' });
    return null;
  }
  if (group.teacher_id !== req.user.id && req.user.role !== 'admin') {
    res.status(403).json({ error: '无权限管理该小组' });
    return null;
  }
  return group;
}

function canViewGroup(user, groupId) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const membership = db.prepare(
    'SELECT status FROM group_members WHERE group_id = ? AND member_id = ?'
  ).get(groupId, user.id);
  return membership?.status === 'approved';
}

function optionalUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return verifyToken(authHeader.substring(7));
}

// 管理员获取自己创建的小组，超级管理员可看到全部
router.get('/', authMiddleware, adminMiddleware, (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare(`SELECT g.*, u.username as teacher_name FROM groups g JOIN users u ON g.teacher_id = u.id ORDER BY g.created_at DESC`).all()
    : db.prepare(`SELECT g.*, u.username as teacher_name FROM groups g JOIN users u ON g.teacher_id = u.id WHERE g.teacher_id = ? ORDER BY g.created_at DESC`).all(req.user.id);
  res.json({ groups: groupSummaryRows(rows) });
});

// 当前用户加入/申请的小组
router.get('/my', authMiddleware, (req, res) => {
  const rows = db.prepare(`
    SELECT g.*, gm.status as my_status, gm.joined_at, u.username as teacher_name
    FROM groups g
    JOIN group_members gm ON g.id = gm.group_id
    JOIN users u ON g.teacher_id = u.id
    WHERE gm.member_id = ?
    ORDER BY gm.joined_at DESC
  `).all(req.user.id);
  res.json({ groups: groupSummaryRows(rows) });
});

// 全部小组，学生用于浏览和申请加入
router.get('/all', (req, res) => {
  const user = optionalUser(req);
  const rows = db.prepare(`
    SELECT g.*, u.username as teacher_name,
      (SELECT status FROM group_members WHERE group_id = g.id AND member_id = ?) as my_status
    FROM groups g
    JOIN users u ON g.teacher_id = u.id
    ORDER BY g.created_at DESC
  `).all(user?.id || 0);
  res.json({ groups: groupSummaryRows(rows) });
});

// 创建小组
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  const { name, description } = req.body;
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: '小组名称不能为空' });
  }

  const inviteCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  const result = db.prepare(
    'INSERT INTO groups (name, description, teacher_id, invite_code) VALUES (?, ?, ?, ?)'
  ).run(String(name).trim(), description || '', req.user.id, inviteCode);

  res.status(201).json({ id: result.lastInsertRowid, name: String(name).trim(), invite_code: inviteCode });
});

// 更新小组
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.id);
  if (!group) return;

  const { name, description } = req.body;
  if (name !== undefined && !String(name).trim()) {
    return res.status(400).json({ error: '小组名称不能为空' });
  }

  db.prepare(`
    UPDATE groups
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(name === undefined ? null : String(name).trim(), description === undefined ? null : description, req.params.id);

  res.json({ message: '更新成功' });
});

// 删除小组
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.id);
  if (!group) return;

  db.transaction(() => {
    const lists = db.prepare('SELECT id FROM problem_lists WHERE group_id = ?').all(req.params.id);
    lists.forEach((list) => {
      db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(list.id);
    });
    db.prepare('DELETE FROM group_members WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM problem_lists WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM assignment_questions WHERE assignment_id IN (SELECT id FROM assignments WHERE group_id = ?)').run(req.params.id);
    db.prepare('DELETE FROM assignments WHERE group_id = ?').run(req.params.id);
    db.prepare('DELETE FROM groups WHERE id = ?').run(req.params.id);
  })();

  res.json({ message: '删除成功' });
});

// 申请加入小组
router.post('/:id/join', authMiddleware, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: '小组不存在' });
  if (group.teacher_id === req.user.id) return res.status(400).json({ error: '不能申请加入自己创建的小组' });

  const existing = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND member_id = ?').get(req.params.id, req.user.id);
  if (existing?.status === 'approved') return res.status(400).json({ error: '你已经在该小组中' });
  if (existing?.status === 'pending') return res.status(400).json({ error: '申请已提交，请等待审核' });

  if (existing?.status === 'rejected') {
    db.prepare('UPDATE group_members SET status = ?, joined_at = CURRENT_TIMESTAMP, reviewed_at = NULL WHERE id = ?')
      .run('pending', existing.id);
  } else {
    db.prepare('INSERT INTO group_members (group_id, member_id, status) VALUES (?, ?, ?)')
      .run(req.params.id, req.user.id, 'pending');
  }

  res.json({ message: '申请已提交，等待管理员审核' });
});

// 退出小组或撤销申请
router.delete('/:id/membership', authMiddleware, (req, res) => {
  const membership = db.prepare('SELECT * FROM group_members WHERE group_id = ? AND member_id = ?').get(req.params.id, req.user.id);
  if (!membership) return res.status(404).json({ error: '尚未加入或申请该小组' });
  db.prepare('DELETE FROM group_members WHERE id = ?').run(membership.id);
  res.json({ message: membership.status === 'pending' ? '已撤销申请' : '已退出小组' });
});

// 小组详情
router.get('/:id', (req, res) => {
  const user = optionalUser(req);
  const group = db.prepare(`
    SELECT g.*, u.username as teacher_name,
      (SELECT status FROM group_members WHERE group_id = g.id AND member_id = ?) as my_status
    FROM groups g
    LEFT JOIN users u ON g.teacher_id = u.id
    WHERE g.id = ?
  `).get(user?.id || 0, req.params.id);
  if (!group) return res.status(404).json({ error: '小组不存在' });

  const owner = user && (group.teacher_id === user.id || user.role === 'admin');
  if (!owner && !canViewGroup(user, req.params.id)) {
    const listCount = db.prepare('SELECT COUNT(*) as count FROM problem_lists WHERE group_id = ?').get(req.params.id).count;
    const memberCount = db.prepare("SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND status = 'approved'").get(req.params.id).count;
    return res.json({
      group: { ...group, is_owner: false, list_count: listCount, member_count: memberCount },
      members: [],
      pending_members: [],
      problem_lists: [],
      assignments: [],
      public_preview: true,
    });
  }

  const members = db.prepare(`
    SELECT u.id, u.username, u.role, gm.joined_at, gm.status
    FROM group_members gm
    JOIN users u ON gm.member_id = u.id
    WHERE gm.group_id = ?
    ORDER BY gm.joined_at DESC
  `).all(req.params.id);

  const problemLists = db.prepare(`
    SELECT pl.*,
      (SELECT COUNT(*) FROM problem_list_questions WHERE problem_list_id = pl.id) as question_count
    FROM problem_lists pl
    WHERE pl.group_id = ?
    ORDER BY pl.sort_order ASC, pl.created_at DESC
  `).all(req.params.id);

  const assignments = db.prepare(`
    SELECT a.*,
      (SELECT COUNT(*) FROM assignment_questions WHERE assignment_id = a.id) as question_count
    FROM assignments a
    WHERE a.group_id = ?
    ORDER BY a.created_at DESC
  `).all(req.params.id);

  res.json({
    group: { ...group, is_owner: owner },
    members: members.filter((m) => m.status === 'approved'),
    pending_members: owner ? members.filter((m) => m.status === 'pending') : [],
    problem_lists: problemLists,
    assignments,
  });
});

// 审核成员
router.post('/:groupId/members/:memberId/review', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  const { action } = req.body;
  if (!['approve', 'reject'].includes(action)) {
    return res.status(400).json({ error: '无效操作' });
  }
  const status = action === 'approve' ? 'approved' : 'rejected';
  const result = db.prepare(`
    UPDATE group_members
    SET status = ?, reviewed_at = CURRENT_TIMESTAMP
    WHERE group_id = ? AND member_id = ?
  `).run(status, req.params.groupId, req.params.memberId);

  if (result.changes === 0) return res.status(404).json({ error: '成员申请不存在' });
  res.json({ message: action === 'approve' ? '已通过' : '已拒绝' });
});

// 移除成员
router.delete('/:groupId/members/:memberId', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  db.prepare('DELETE FROM group_members WHERE group_id = ? AND member_id = ?').run(req.params.groupId, req.params.memberId);
  res.json({ message: '已移除成员' });
});

// 创建小组题单
router.post('/:id/lists', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.id);
  if (!group) return;

  const { title, description, question_ids = [] } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: '题单标题不能为空' });

  const result = db.prepare(`
    INSERT INTO problem_lists (title, description, group_id, created_by, is_public)
    VALUES (?, ?, ?, ?, 0)
  `).run(String(title).trim(), description || '', req.params.id, req.user.id);

  if (Array.isArray(question_ids) && question_ids.length > 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO problem_list_questions (problem_list_id, question_id, order_num) VALUES (?, ?, ?)');
    question_ids.forEach((questionId, index) => insert.run(result.lastInsertRowid, questionId, index + 1));
  }

  res.status(201).json({ id: result.lastInsertRowid, message: '题单创建成功' });
});

// 小组题单详情
router.get('/:groupId/lists/:listId', authMiddleware, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.groupId);
  if (!group) return res.status(404).json({ error: '小组不存在' });
  if (!canViewGroup(req.user, req.params.groupId) && group.teacher_id !== req.user.id) {
    return res.status(403).json({ error: '无权限查看该题单' });
  }

  const list = db.prepare(`
    SELECT pl.*, u.username as creator_name
    FROM problem_lists pl
    LEFT JOIN users u ON pl.created_by = u.id
    WHERE pl.id = ? AND pl.group_id = ?
  `).get(req.params.listId, req.params.groupId);
  if (!list) return res.status(404).json({ error: '题单不存在' });

  const questions = db.prepare(`
    SELECT q.id, q.title, q.type, q.language, q.difficulty, q.points, q.tags, plq.order_num,
      (SELECT COUNT(*) FROM submissions WHERE question_id = q.id AND user_id = ? AND result = 'pass') as solved
    FROM problem_list_questions plq
    JOIN questions q ON plq.question_id = q.id
    WHERE plq.problem_list_id = ?
    ORDER BY plq.order_num
  `).all(req.user.id, req.params.listId);

  res.json({ list, questions });
});

// 更新小组题单
router.put('/:groupId/lists/:listId', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  const { title, description, question_ids } = req.body;
  db.prepare(`
    UPDATE problem_lists
    SET title = COALESCE(?, title), description = COALESCE(?, description)
    WHERE id = ? AND group_id = ?
  `).run(title ? String(title).trim() : null, description === undefined ? null : description, req.params.listId, req.params.groupId);

  if (Array.isArray(question_ids)) {
    db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(req.params.listId);
    const insert = db.prepare('INSERT OR IGNORE INTO problem_list_questions (problem_list_id, question_id, order_num) VALUES (?, ?, ?)');
    question_ids.forEach((questionId, index) => insert.run(req.params.listId, questionId, index + 1));
  }

  res.json({ message: '题单更新成功' });
});

// 删除小组题单
router.delete('/:groupId/lists/:listId', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  db.transaction(() => {
    db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ?').run(req.params.listId);
    db.prepare('DELETE FROM problem_lists WHERE id = ? AND group_id = ?').run(req.params.listId, req.params.groupId);
  })();
  res.json({ message: '题单删除成功' });
});

// 添加题目到题单
router.post('/:groupId/lists/:listId/questions', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  const { question_ids } = req.body;
  if (!Array.isArray(question_ids) || question_ids.length === 0) {
    return res.status(400).json({ error: '请选择题目' });
  }

  const maxOrder = db.prepare('SELECT MAX(order_num) as max FROM problem_list_questions WHERE problem_list_id = ?').get(req.params.listId);
  const insert = db.prepare('INSERT OR IGNORE INTO problem_list_questions (problem_list_id, question_id, order_num) VALUES (?, ?, ?)');
  question_ids.forEach((questionId, index) => {
    insert.run(req.params.listId, questionId, (maxOrder.max || 0) + index + 1);
  });

  res.json({ message: '添加成功' });
});

// 移除题目
router.delete('/:groupId/lists/:listId/questions/:questionId', authMiddleware, adminMiddleware, (req, res) => {
  const group = requireGroupOwner(req, res, req.params.groupId);
  if (!group) return;

  db.prepare('DELETE FROM problem_list_questions WHERE problem_list_id = ? AND question_id = ?')
    .run(req.params.listId, req.params.questionId);
  res.json({ message: '移除成功' });
});

module.exports = router;
