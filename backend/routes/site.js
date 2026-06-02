const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

function parseTags(tags) {
  return String(tags || '')
    .split(/[,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function getSettings() {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  return rows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {});
}

router.get('/home-meta', (req, res) => {
  try {
    const announcements = db.prepare(`
      SELECT id, title, content, priority, created_at
      FROM announcements
      WHERE is_active = 1
      ORDER BY priority DESC, created_at DESC
      LIMIT 8
    `).all();

    const questions = db.prepare('SELECT id, tags FROM questions WHERE is_public = 1').all();
    const tagMap = new Map();
    questions.forEach((question) => {
      parseTags(question.tags).forEach((tag) => tagMap.set(tag, (tagMap.get(tag) || 0) + 1));
    });
    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 30);

    const stats = {
      questions: db.prepare('SELECT COUNT(*) as count FROM questions WHERE is_public = 1').get().count,
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      submissions: db.prepare('SELECT COUNT(*) as count FROM submissions').get().count,
      accepted: db.prepare("SELECT COUNT(*) as count FROM submissions WHERE status = 'accepted' OR result = 'pass'").get().count,
    };

    const recommendedLists = db.prepare(`
      SELECT pl.id, pl.title, pl.description,
        (SELECT COUNT(*) FROM problem_list_questions WHERE problem_list_id = pl.id) as question_count
      FROM problem_lists pl
      WHERE pl.is_public = 1
      ORDER BY pl.created_at DESC
      LIMIT 5
    `).all();

    res.json({ announcements, tags, stats, recommended_lists: recommendedLists, settings: getSettings() });
  } catch (err) {
    console.error('获取首页信息失败:', err);
    res.status(500).json({ error: '获取首页信息失败' });
  }
});

router.get('/settings', (req, res) => {
  try {
    res.json({ settings: getSettings() });
  } catch (err) {
    res.status(500).json({ error: '获取站点设置失败' });
  }
});

router.put('/settings', authMiddleware, adminMiddleware, (req, res) => {
  try {
    const allowed = [
      'site_name',
      'site_subtitle',
      'primary_color',
      'show_ai_assistant',
      'home_notice_title',
      'home_stats_title',
      'home_tags_title',
    ];
    const upsert = db.prepare(`
      INSERT INTO site_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `);
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) upsert.run(key, String(req.body[key]));
    });
    res.json({ settings: getSettings(), message: '站点设置已保存' });
  } catch (err) {
    console.error('保存站点设置失败:', err);
    res.status(500).json({ error: '保存站点设置失败' });
  }
});

router.get('/announcements', authMiddleware, adminMiddleware, (req, res) => {
  const announcements = db.prepare(`
    SELECT a.*, u.username as creator_name
    FROM announcements a
    LEFT JOIN users u ON a.created_by = u.id
    ORDER BY a.priority DESC, a.created_at DESC
  `).all();
  res.json({ announcements });
});

router.post('/announcements', authMiddleware, adminMiddleware, (req, res) => {
  const { title, content = '', priority = 0, is_active = 1 } = req.body;
  if (!title || !String(title).trim()) return res.status(400).json({ error: '公告标题不能为空' });
  const result = db.prepare(`
    INSERT INTO announcements (title, content, priority, is_active, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(String(title).trim(), content, Number(priority) || 0, is_active ? 1 : 0, req.user.id);
  res.status(201).json({ id: result.lastInsertRowid, message: '公告已创建' });
});

router.put('/announcements/:id', authMiddleware, adminMiddleware, (req, res) => {
  const { title, content, priority, is_active } = req.body;
  if (title !== undefined && !String(title).trim()) return res.status(400).json({ error: '公告标题不能为空' });
  const result = db.prepare(`
    UPDATE announcements
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        priority = COALESCE(?, priority),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    title === undefined ? null : String(title).trim(),
    content === undefined ? null : content,
    priority === undefined ? null : Number(priority) || 0,
    is_active === undefined ? null : (is_active ? 1 : 0),
    req.params.id
  );
  if (result.changes === 0) return res.status(404).json({ error: '公告不存在' });
  res.json({ message: '公告已更新' });
});

router.delete('/announcements/:id', authMiddleware, adminMiddleware, (req, res) => {
  const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: '公告不存在' });
  res.json({ message: '公告已删除' });
});

module.exports = router;
