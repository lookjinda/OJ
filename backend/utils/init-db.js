const db = require('../models/db');
const bcrypt = require('bcryptjs');

function initDatabase() {
  console.log('初始化数据库...');

  // 创建用户表
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
  `);

  // 创建题目表
  db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('programming', 'choice', 'fill')),
    language TEXT,
    difficulty TEXT DEFAULT 'medium' CHECK(difficulty IN ('easy', 'medium', 'hard')),
    content TEXT NOT NULL,
    options TEXT,
    answer TEXT NOT NULL,
    test_cases TEXT,
    scratch_template TEXT,
    points INTEGER DEFAULT 10,
    tags TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);

  // 创建提交记录表
  db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    language TEXT,
    code TEXT NOT NULL,
    scratch_project TEXT,
    answer TEXT,
    result TEXT NOT NULL CHECK(result IN ('pending', 'pass', 'fail', 'partial', 'error')),
    score INTEGER DEFAULT 0,
    feedback TEXT,
    execution_time INTEGER,
    memory_usage INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
  `);

  // 创建排行榜视图
  db.exec(`
  CREATE VIEW IF NOT EXISTS leaderboard AS
  SELECT 
    u.id,
    u.username,
    COUNT(DISTINCT s.question_id) as solved_count,
    SUM(s.score) as total_score,
    MAX(s.submitted_at) as last_submit
  FROM users u
  LEFT JOIN submissions s ON u.id = s.user_id AND s.result = 'pass'
  GROUP BY u.id
  ORDER BY total_score DESC, solved_count DESC;
  `);

  // 创建题单表
  db.exec(`
  CREATE TABLE IF NOT EXISTS problem_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    is_public INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);

  // 题单题目关联表
  db.exec(`
  CREATE TABLE IF NOT EXISTS problem_list_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    problem_list_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (problem_list_id) REFERENCES problem_lists(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
  `);

  // 创建比赛表
  db.exec(`
  CREATE TABLE IF NOT EXISTS contests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    cover_image TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    status TEXT DEFAULT 'upcoming' CHECK(status IN ('upcoming', 'ongoing', 'ended')),
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);

  // 比赛题目关联表
  db.exec(`
  CREATE TABLE IF NOT EXISTS contest_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    order_num INTEGER DEFAULT 0,
    FOREIGN KEY (contest_id) REFERENCES contests(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
  `);

  // 比赛参与表
  db.exec(`
  CREATE TABLE IF NOT EXISTS contest_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contest_id) REFERENCES contests(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(contest_id, user_id)
  );
  `);

  // 考试表
  db.exec(`
  CREATE TABLE IF NOT EXISTS exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    difficulty TEXT DEFAULT '',
    duration INTEGER DEFAULT 60,
    total_score INTEGER DEFAULT 100,
    question_count INTEGER DEFAULT 0,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `);

  // 考试题目关联表
  db.exec(`
  CREATE TABLE IF NOT EXISTS exam_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE(exam_id, question_id)
  );
  `);

  // 考试记录表
  db.exec(`
  CREATE TABLE IF NOT EXISTS exam_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    answers TEXT DEFAULT '{}',
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'in_progress',
    started_at DATETIME,
    submitted_at DATETIME,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(exam_id, user_id)
  );
  `);

  // 插入默认管理员
  const adminPassword = bcrypt.hashSync('admin123', 10);
  const insertAdmin = db.prepare(`
  INSERT OR IGNORE INTO users (username, password, role)
  VALUES ('admin', ?, 'admin');
  `);
  insertAdmin.run(adminPassword);

  // 插入示例题目
  const insertQuestion = db.prepare(`
  INSERT INTO questions (title, type, language, difficulty, content, options, answer, test_cases, points, tags)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
  `);

  // 检查是否已有题目，避免重复插入
  const countStmt = db.prepare('SELECT COUNT(*) as count FROM questions');
  const count = countStmt.get();

  if (count.count === 0) {
    // Python编程题
    insertQuestion.run(
      '两数之和',
      'programming',
      'python',
      'easy',
      '给定一个整数数组 nums 和一个目标值 target，请在数组中找出和为目标值的两个整数，返回它们的索引。\n\n示例:\n输入: nums = [2, 7, 11, 15], target = 9\n输出: [0, 1]',
      null,
      JSON.stringify([{input: 'nums=[2,7,11,15],target=9', expected_output: '[0,1]'}]),
      JSON.stringify([
        {input: {nums: [2,7,11,15], target: 9}, expected: [0,1]},
        {input: {nums: [3,2,4], target: 6}, expected: [1,2]},
        {input: {nums: [3,3], target: 6}, expected: [0,1]}
      ]),
      20,
      '数组,哈希表'
    );

    // C++编程题
    insertQuestion.run(
      '反转字符串',
      'programming',
      'cpp',
      'easy',
      '编写一个函数，将输入的字符串反转。\n\n示例:\n输入: "hello"\n输出: "olleh"',
      null,
      JSON.stringify([{input: 'hello', expected_output: 'olleh'}]),
      JSON.stringify([
        {input: 'hello', expected: 'olleh'},
        {input: 'world', expected: 'dlrow'},
        {input: 'a', expected: 'a'}
      ]),
      15,
      '字符串'
    );

    // Scratch编程题
    insertQuestion.run(
      '绘制正方形',
      'programming',
      'scratch',
      'easy',
      '使用Scratch编程让角色绘制一个正方形。\n\n要求:\n1. 使用画笔工具\n2. 正方形边长为100步\n3. 角度旋转90度',
      null,
      JSON.stringify({check_type: 'sprite_movement', expected_path: 'square'}),
      JSON.stringify([
        {check: 'has_pen_block', required: true},
        {check: 'has_move_block', value: 100},
        {check: 'has_turn_block', value: 90}
      ]),
      20,
      'Scratch,画笔,图形'
    );

    // 选择题
    insertQuestion.run(
      'Python基础语法',
      'choice',
      null,
      'easy',
      '以下哪个是Python中正确的变量命名？',
      JSON.stringify(['A. 1variable', 'B. my_var', 'C. class', 'D. @name']),
      'B',
      null,
      5,
      'Python,基础'
    );

    // 填空题
    insertQuestion.run(
      'Python列表操作',
      'fill',
      'python',
      'easy',
      '完成以下代码，使其输出列表的最后一个元素：\n```python\nmy_list = [1, 2, 3, 4, 5]\nprint(my_list[____])\n```',
      null,
      '-1',
      null,
      5,
      'Python,列表'
    );

    console.log('默认管理员账号: admin / admin123');
  }
}

module.exports = { initDatabase };