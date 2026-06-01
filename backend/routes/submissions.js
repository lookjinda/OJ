const express = require('express');
const router = express.Router();
const db = require('../models/db');
const { authMiddleware } = require('../middleware/auth');
const { judgeSubmission } = require('../services/judge');

// 提交答案
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { question_id, language, code, scratch_project, scratch_filename, answer } = req.body;
    
    if (!question_id) {
      return res.status(400).json({ error: '缺少题目ID' });
    }

    // 获取题目信息
    const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(question_id);
    if (!question) {
      return res.status(404).json({ error: '题目不存在' });
    }
    // 解析 JSON 字段
    if (question.options) question.options = JSON.parse(question.options);
    if (question.test_cases) question.test_cases = JSON.parse(question.test_cases);
    if (question.scratch_template) question.scratch_template = JSON.parse(question.scratch_template);

    // 根据题型验证提交内容
    let codeContent = '';
    let result = 'pending';
    let score = 0;
    let feedback = '';

    if (question.type === 'programming') {
      if (!code && !scratch_project) {
        return res.status(400).json({ error: '请提交代码或Scratch项目' });
      }

      // 处理Scratch项目：base64 .sb3 → JSON项目对象
      let scratchData = scratch_project;
      if (scratch_project && typeof scratch_project === 'string') {
        try {
          // 前端上传的是base64编码的.sb3文件
          // 尝试解析为JSON（如果已经是项目对象）
          scratchData = JSON.parse(scratch_project);
        } catch {
          // base64二进制数据，记录文件名，判题时检查积木需要JSON格式
          // .sb3是zip格式，暂时存为base64，判题反馈为手动检查
          scratchData = { _base64: true, _filename: scratch_filename || 'project.sb3' };
        }
      }

      // 异步判题
      const judgeResult = await judgeSubmission(question, { language, code, scratch_project: scratchData });
      result = judgeResult.result;
      score = judgeResult.score;
      feedback = judgeResult.feedback;
      codeContent = code || (scratch_filename || 'Scratch项目');
    } else if (question.type === 'choice') {
      if (!answer) {
        return res.status(400).json({ error: '请提交答案' });
      }
      const correctAnswer = question.answer;
      result = answer === correctAnswer ? 'pass' : 'fail';
      score = result === 'pass' ? question.points : 0;
      feedback = result === 'pass' ? '回答正确！' : `正确答案是 ${correctAnswer}`;
    } else if (question.type === 'fill') {
      if (!answer) {
        return res.status(400).json({ error: '请提交答案' });
      }
      const correctAnswer = question.answer.trim();
      result = answer.trim() === correctAnswer ? 'pass' : 'fail';
      score = result === 'pass' ? question.points : 0;
      feedback = result === 'pass' ? '回答正确！' : `正确答案是 ${correctAnswer}`;
    }

    // 保存提交记录
    const stmt = db.prepare(`
      INSERT INTO submissions (user_id, question_id, language, code, scratch_project, answer, result, score, feedback)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertResult = stmt.run(
      req.user.id,
      question_id,
      language || question.language,
      codeContent,
      scratch_project ? scratch_project : null,
      answer || null,
      result,
      score,
      feedback
    );

    res.status(201).json({
      id: insertResult.lastInsertRowid,
      result,
      score,
      feedback
    });
  } catch (err) {
    console.error('提交失败:', err);
    res.status(500).json({ error: '提交失败' });
  }
});

// 获取用户提交历史
router.get('/history', authMiddleware, (req, res) => {
  try {
    const { question_id, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let sql = `
      SELECT s.*, q.title as question_title, q.type as question_type
      FROM submissions s
      JOIN questions q ON s.question_id = q.id
      WHERE s.user_id = ?
    `;
    const params = [req.user.id];
    
    if (question_id) {
      sql += ' AND s.question_id = ?';
      params.push(question_id);
    }
    
    sql += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));
    
    const submissions = db.prepare(sql).all(...params);
    
    res.json({ submissions, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: '获取提交历史失败' });
  }
});

// 获取排行榜
router.get('/leaderboard', (req, res) => {
  try {
    const leaderboard = db.prepare('SELECT * FROM leaderboard LIMIT 50').all();
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

// 获取用户统计
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT CASE WHEN result = 'pass' THEN question_id END) as solved_count,
        SUM(CASE WHEN result = 'pass' THEN score ELSE 0 END) as total_score,
        COUNT(*) as total_submissions,
        COUNT(DISTINCT question_id) as attempted_questions
      FROM submissions WHERE user_id = ?
    `).get(req.user.id);
    
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: '获取统计失败' });
  }
});

// 下载/预览 Scratch 项目文件 (sb3)
router.get('/:id/scratch-file', authMiddleware, (req, res) => {
  try {
    const submission = db.prepare(`
      SELECT s.*, q.type as question_type, u.username
      FROM submissions s
      JOIN questions q ON s.question_id = q.id
      JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!submission) {
      return res.status(404).json({ error: '提交记录不存在' });
    }

    // 只有管理员或提交者本人可以查看
    if (req.user.role !== 'admin' && req.user.role !== 'teacher' && req.user.id !== submission.user_id) {
      return res.status(403).json({ error: '无权限查看此文件' });
    }

    const scratchProject = submission.scratch_project;
    if (!scratchProject) {
      return res.status(404).json({ error: '没有Scratch项目文件' });
    }

    // scratch_project 存的是 base64 编码的 sb3 文件
    const buffer = Buffer.from(scratchProject, 'base64');

    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="submission_${submission.id}_${submission.username}.sb3"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) {
    console.error('获取Scratch文件失败:', err);
    res.status(500).json({ error: '获取Scratch文件失败' });
  }
});

// 获取某题目的所有提交（管理员用）
router.get('/all', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '需要管理员权限' });
    }

    const { question_id, user_id, page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    let sql = `
      SELECT s.*, q.title as question_title, q.type as question_type, u.username
      FROM submissions s
      JOIN questions q ON s.question_id = q.id
      JOIN users u ON s.user_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (question_id) {
      sql += ' AND s.question_id = ?';
      params.push(question_id);
    }
    if (user_id) {
      sql += ' AND s.user_id = ?';
      params.push(user_id);
    }

    sql += ' ORDER BY s.submitted_at DESC LIMIT ? OFFSET ?';
    params.push(Number(limit), Number(offset));

    const submissions = db.prepare(sql).all(...params);
    const total = db.prepare(`SELECT COUNT(*) as count FROM submissions WHERE 1=1 ${question_id ? 'AND question_id = ' + question_id : ''} ${user_id ? 'AND user_id = ' + user_id : ''}`).get();

    res.json({ submissions, total: total.count, page: Number(page), limit: Number(limit) });
  } catch (err) {
    console.error('获取提交列表失败:', err);
    res.status(500).json({ error: '获取提交列表失败' });
  }
});

// 管理员手动评分
router.patch('/:id/grade', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'teacher') {
      return res.status(403).json({ error: '需要管理员或教师权限' });
    }
    const { result, score, feedback } = req.body;
    const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
    if (!submission) return res.status(404).json({ error: '提交记录不存在' });
    if (!result || score === undefined) return res.status(400).json({ error: '缺少参数' });
    const validResults = ['pass', 'fail', 'pending'];
    if (!validResults.includes(result)) return res.status(400).json({ error: 'result 必须为 pass / fail / pending' });
    db.prepare('UPDATE submissions SET result = ?, score = ?, feedback = ? WHERE id = ?')
      .run(result, Number(score), feedback || '', req.params.id);
    res.json({ success: true, message: '评分已更新' });
  } catch (err) {
    console.error('评分失败:', err);
    res.status(500).json({ error: '评分失败' });
  }
});

module.exports = router;
