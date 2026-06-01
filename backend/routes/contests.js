const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// 获取比赛列表
router.get('/', (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `
      SELECT c.*, u.username as creator_name,
        (SELECT COUNT(*) FROM contest_participants WHERE contest_id = c.id) as participant_count
      FROM contests c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      sql += ' AND c.status = ?';
      params.push(status);
    }
    
    sql += ' ORDER BY c.start_time DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const stmt = db.prepare(sql);
    const contests = stmt.all(...params);
    
    // 更新比赛状态（自动）
    const now = new Date().toISOString();
    contests.forEach(contest => {
      if (contest.status === 'upcoming' && new Date(contest.start_time) <= new Date(now)) {
        db.prepare("UPDATE contests SET status = 'ongoing' WHERE id = ?").run(contest.id);
        contest.status = 'ongoing';
      }
      if (contest.status === 'ongoing' && new Date(contest.end_time) <= new Date(now)) {
        db.prepare("UPDATE contests SET status = 'ended' WHERE id = ?").run(contest.id);
        contest.status = 'ended';
      }
    });
    
    res.json({ contests, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: '获取比赛列表失败' });
  }
});

// 获取比赛详情
router.get('/:id', (req, res) => {
  try {
    const userId = req.user?.id || 0;
    
    const contestStmt = db.prepare(`
      SELECT c.*, u.username as creator_name,
        (SELECT COUNT(*) FROM contest_participants WHERE contest_id = c.id) as participant_count,
        (SELECT COUNT(*) FROM contest_participants WHERE contest_id = c.id AND user_id = ?) as joined
      FROM contests c
      LEFT JOIN users u ON c.created_by = u.id
      WHERE c.id = ?
    `);
    const contest = contestStmt.get(userId, req.params.id);
    
    if (!contest) {
      return res.status(404).json({ error: '比赛不存在' });
    }
    
    // 获取比赛题目（只有在进行中或已结束才显示）
    if (contest.status !== 'upcoming' || (userId && contest.created_by === userId)) {
      const questionsStmt = db.prepare(`
        SELECT q.id, q.title, q.type, q.difficulty, q.points,
          cq.order_num,
          (SELECT COUNT(*) FROM submissions WHERE question_id = q.id AND user_id = ? AND result = 'pass') as solved
        FROM contest_questions cq
        JOIN questions q ON cq.question_id = q.id
        WHERE cq.contest_id = ?
        ORDER BY cq.order_num
      `);
      contest.questions = questionsStmt.all(userId, req.params.id);
    } else {
      contest.questions = [];
    }
    
    res.json(contest);
  } catch (err) {
    res.status(500).json({ error: '获取比赛详情失败' });
  }
});

// 参加比赛
router.post('/:id/join', authMiddleware, (req, res) => {
  try {
    const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: '比赛不存在' });
    }
    
    if (contest.status === 'ended') {
      return res.status(400).json({ error: '比赛已结束' });
    }
    
    // 检查是否已参加
    const existing = db.prepare('SELECT * FROM contest_participants WHERE contest_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (existing) {
      return res.status(400).json({ error: '已参加此比赛' });
    }
    
    db.prepare('INSERT INTO contest_participants (contest_id, user_id) VALUES (?, ?)').run(req.params.id, req.user.id);
    
    res.json({ message: '成功参加比赛' });
  } catch (err) {
    res.status(500).json({ error: '参加比赛失败' });
  }
});

// 创建比赛（管理员）
router.post('/', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, cover_image, start_time, end_time, question_ids } = req.body;
    
    if (!title || !start_time || !end_time) {
      return res.status(400).json({ error: '缺少必要字段' });
    }
    
    const status = new Date(start_time) > new Date() ? 'upcoming' : 'ongoing';
    
    const stmt = db.prepare(`
      INSERT INTO contests (title, description, cover_image, start_time, end_time, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description || null, cover_image || null, start_time, end_time, status, req.user.id);
    
    // 添加题目（过滤无效题目ID）
    if (question_ids && question_ids.length > 0) {
      const validIds = db.prepare(
        `SELECT id FROM questions WHERE id IN (${question_ids.map(() => '?').join(',')})`
      ).all(...question_ids).map(r => r.id);
      const insertStmt = db.prepare(`
        INSERT INTO contest_questions (contest_id, question_id, order_num)
        VALUES (?, ?, ?)
      `);
      validIds.forEach((qid, idx) => {
        insertStmt.run(result.lastInsertRowid, qid, idx);
      });
      if (validIds.length < question_ids.length) {
        const skipped = question_ids.length - validIds.length;
        res.status(201).json({ id: result.lastInsertRowid, message: `比赛创建成功（跳过${skipped}个无效题目ID）` });
        return;
      }
    }
    res.status(201).json({ id: result.lastInsertRowid, message: '比赛创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建比赛失败' });
  }
});

// 更新比赛（管理员）
router.put('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const { title, description, cover_image, start_time, end_time, question_ids } = req.body;
    
    db.prepare(`
      UPDATE contests SET
        title = COALESCE(?, title),
        description = COALESCE(?, description),
        cover_image = COALESCE(?, cover_image),
        start_time = COALESCE(?, start_time),
        end_time = COALESCE(?, end_time)
      WHERE id = ?
    `).run(title, description, cover_image, start_time, end_time, req.params.id);
    
    // 更新题目列表（过滤无效题目ID）
    if (question_ids) {
      db.prepare('DELETE FROM contest_questions WHERE contest_id = ?').run(req.params.id);
      if (question_ids.length > 0) {
        const validIds = db.prepare(
          `SELECT id FROM questions WHERE id IN (${question_ids.map(() => '?').join(',')})`
        ).all(...question_ids).map(r => r.id);
        const insertStmt = db.prepare(`
          INSERT INTO contest_questions (contest_id, question_id, order_num)
          VALUES (?, ?, ?)
        `);
        validIds.forEach((qid, idx) => {
          insertStmt.run(req.params.id, qid, idx);
        });
        if (validIds.length < question_ids.length) {
          const skipped = question_ids.length - validIds.length;
          res.json({ message: `比赛更新成功（跳过${skipped}个无效题目ID）` });
          return;
        }
      }
    }
    res.json({ message: '比赛更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新比赛失败' });
  }
});

// 删除比赛（管理员）
router.delete('/:id', authMiddleware, adminMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM contest_questions WHERE contest_id = ?').run(req.params.id);
    db.prepare('DELETE FROM contest_participants WHERE contest_id = ?').run(req.params.id);
    db.prepare('DELETE FROM contests WHERE id = ?').run(req.params.id);
    
    res.json({ message: '比赛删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除比赛失败' });
  }
});

// 比赛排行榜
router.get('/:id/ranking', (req, res) => {
  try {
    const contest = db.prepare('SELECT * FROM contests WHERE id = ?').get(req.params.id);
    if (!contest) {
      return res.status(404).json({ error: '比赛不存在' });
    }
    
    // 只在比赛进行中或结束后显示排名
    if (contest.status === 'upcoming') {
      return res.json([]);
    }
    
    const rankingStmt = db.prepare(`
      SELECT 
        u.id, u.username,
        COUNT(DISTINCT s.question_id) as solved_count,
        SUM(s.score) as total_score,
        MAX(s.submitted_at) as last_submit
      FROM contest_participants cp
      JOIN users u ON cp.user_id = u.id
      LEFT JOIN submissions s ON s.user_id = u.id 
        AND s.question_id IN (SELECT question_id FROM contest_questions WHERE contest_id = ?)
        AND s.result = 'pass'
        AND s.submitted_at BETWEEN ? AND ?
      WHERE cp.contest_id = ?
      GROUP BY u.id
      ORDER BY total_score DESC, solved_count DESC, last_submit ASC
    `);
    
    const ranking = rankingStmt.all(req.params.id, contest.start_time, contest.end_time, req.params.id);
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ error: '获取排名失败' });
  }
});

module.exports = router;