const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const express = require('express');
const cors = require('cors');

const db = require('./models/db');
const { initDatabase } = require('./utils/init-db');
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const submissionRoutes = require('./routes/submissions');
const listRoutes = require('./routes/lists');
const contestRoutes = require('./routes/contests');
const groupRoutes = require('./routes/groups');
const aiRoutes = require('./routes/ai');
const examRoutes = require('./routes/exams');
const siteRoutes = require('./routes/site');
const { startJudgeWorker } = require('./services/judge');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件（Scratch项目）
app.use('/static', express.static(path.join(__dirname, '../static')));

// 静态文件（考试图片）
app.use('/media', express.static(path.join(__dirname, '../media')));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/contests', contestRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/site', siteRoutes);


// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || '服务器内部错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  // 自动初始化数据库
  try {
    initDatabase();
    startJudgeWorker();
    console.log('✅ 数据库初始化完成');
  } catch (err) {
    console.error('❌ 数据库初始化失败:', err.message);
  }
  console.log(`🚀 后端服务运行在 http://localhost:${PORT}`);
});
