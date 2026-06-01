const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const svgCaptcha = require('svg-captcha');
const db = require('../models/db');
const { generateToken, authMiddleware } = require('../middleware/auth');

// 简易内存存储验证码
const captchaStore = new Map();

// 生成图形验证码
router.get('/captcha', (req, res) => {
  const captcha = svgCaptcha.create({
    size: 4,
    ignoreChars: '0oO1ilI',
    noise: 2,
    color: true,
    background: '#f0f0f0',
    width: 120,
    height: 40,
  });
  const captchaId = Math.random().toString(36).substring(2, 10);
  captchaStore.set(captchaId, { text: captcha.text.toLowerCase(), expires: Date.now() + 5 * 60 * 1000 });
  // 清理过期验证码
  for (const [key, val] of captchaStore) {
    if (val.expires < Date.now()) captchaStore.delete(key);
  }
  res.json({ captchaId, svg: captcha.data });
});

// 注册
router.post('/register', (req, res) => {
  try {
    const { username, password, captchaId, captchaCode } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    // 校验验证码
    if (!captchaId || !captchaCode) {
      return res.status(400).json({ error: '请输入验证码' });
    }
    const stored = captchaStore.get(captchaId); console.log("[CAPTCHA] captchaStore size:", captchaStore.size, "req captchaId:", captchaId, "req captchaCode:", captchaCode);
    if (!stored || stored.expires < Date.now()) {
      return res.status(400).json({ error: '验证码已过期，请刷新' });
    }
    if (stored.text !== captchaCode.toLowerCase()) {
      captchaStore.delete(captchaId);
      return res.status(400).json({ error: '验证码错误' });
    }
    captchaStore.delete(captchaId);

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: '用户名长度应为3-20个字符' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6个字符' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);
    
    const token = generateToken({ id: result.lastInsertRowid, username, role: 'student' });
    
    res.status(201).json({
      message: '注册成功',
      token,
      user: { id: result.lastInsertRowid, username, role: 'student' }
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: '用户名已存在' });
    } else {
      res.status(500).json({ error: '注册失败' });
    }
  }
});

// 登录
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码不能为空' });
    }

    const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
    const user = stmt.get(username);
    
    if (!user) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    const isValidPassword = bcrypt.compareSync(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: '用户名或密码错误' });
    }

    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    
    res.json({
      message: '登录成功',
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', authMiddleware, (req, res) => {
  try {
    const stmt = db.prepare('SELECT id, username, role, created_at, last_login FROM users WHERE id = ?');
    const user = stmt.get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: '获取用户信息失败' });
  }
});

// 获取用户列表（管理员）
router.get('/users', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    const users = db.prepare('SELECT id, username, role, created_at, last_login FROM users ORDER BY id DESC').all();
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

// 更新用户角色（管理员）
router.put('/users/:id/role', authMiddleware, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    const { role } = req.body;
    if (!['admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    res.json({ message: '角色更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

module.exports = router;
