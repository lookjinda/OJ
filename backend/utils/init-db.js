const db = require('../models/db');
const bcrypt = require('bcryptjs');

function initDatabase() {
  console.log('初始化数据库...');

  const ensureColumn = (table, column, definition) => {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  };

  const migrateExamRecordsUniqueness = () => {
    const indexes = db.prepare('PRAGMA index_list(exam_records)').all();
    const hasUniqueUserExamIndex = indexes.some((idx) => idx.unique);
    if (!hasUniqueUserExamIndex) return;

    db.exec(`
      PRAGMA foreign_keys=OFF;
      BEGIN;
      CREATE TABLE exam_records_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        answers TEXT DEFAULT '{}',
        score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'in_progress',
        started_at DATETIME,
        submitted_at DATETIME,
        FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      INSERT OR IGNORE INTO exam_records_new (id, exam_id, user_id, answers, score, status, started_at, submitted_at)
        SELECT id, exam_id, user_id, answers, score, status, started_at, submitted_at FROM exam_records;
      DROP TABLE exam_records;
      ALTER TABLE exam_records_new RENAME TO exam_records;
      COMMIT;
      PRAGMA foreign_keys=ON;
    `);
  };

  // 创建用户表
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    email TEXT UNIQUE,
    phone TEXT UNIQUE,
    role TEXT DEFAULT 'student',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );
  `);

  ensureColumn('users', 'email', 'TEXT');
  ensureColumn('users', 'phone', 'TEXT');
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email != ''");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone != ''");

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
    samples TEXT,
    desc_images TEXT,
    subtype TEXT,
    source TEXT DEFAULT '',
    time_limit_ms INTEGER DEFAULT 1000,
    memory_limit_mb INTEGER DEFAULT 128,
    is_public INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);

  ensureColumn('questions', 'source', "TEXT DEFAULT ''");
  ensureColumn('questions', 'samples', 'TEXT');
  ensureColumn('questions', 'desc_images', 'TEXT');
  ensureColumn('questions', 'subtype', 'TEXT');
  ensureColumn('questions', 'time_limit_ms', 'INTEGER DEFAULT 1000');
  ensureColumn('questions', 'memory_limit_mb', 'INTEGER DEFAULT 128');
  ensureColumn('questions', 'is_public', 'INTEGER DEFAULT 1');

  db.exec(`
  CREATE INDEX IF NOT EXISTS idx_questions_public_id ON questions(is_public, id);
  CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
  CREATE INDEX IF NOT EXISTS idx_questions_language ON questions(language);
  CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
  CREATE INDEX IF NOT EXISTS idx_questions_public_tags ON questions(is_public, tags);
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
    status TEXT DEFAULT 'pending',
    score INTEGER DEFAULT 0,
    feedback TEXT,
    compile_output TEXT,
    runtime_output TEXT,
    case_results TEXT,
    execution_time INTEGER,
    memory_usage INTEGER,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    judged_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
  );
  `);

  ensureColumn('submissions', 'status', "TEXT DEFAULT 'pending'");
  ensureColumn('submissions', 'compile_output', 'TEXT');
  ensureColumn('submissions', 'runtime_output', 'TEXT');
  ensureColumn('submissions', 'case_results', 'TEXT');
  ensureColumn('submissions', 'judged_at', 'DATETIME');

  db.exec(`
  CREATE INDEX IF NOT EXISTS idx_submissions_question_id ON submissions(question_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_user_question ON submissions(user_id, question_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_question_status ON submissions(question_id, status, result);
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS test_data_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    file_type TEXT NOT NULL CHECK(file_type IN ('input', 'output')),
    content TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE
  );
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    priority INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);

  db.exec(`
  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  `);

  const defaultSettings = {
    site_name: 'bi lin',
    site_subtitle: '在线评测与编程训练平台',
    primary_color: '#0284c7',
    show_ai_assistant: '1',
    home_notice_title: '公告',
    home_stats_title: '站点统计',
    home_tags_title: '标签',
  };
  const insertSetting = db.prepare('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)');
  Object.entries(defaultSettings).forEach(([key, value]) => insertSetting.run(key, value));

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
    group_id INTEGER,
    sort_order INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (group_id) REFERENCES groups(id)
  );
  `);

  ensureColumn('problem_lists', 'group_id', 'INTEGER');
  ensureColumn('problem_lists', 'sort_order', 'INTEGER DEFAULT 0');

  // 小组表
  db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    teacher_id INTEGER NOT NULL,
    invite_code TEXT UNIQUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (teacher_id) REFERENCES users(id)
  );
  `);

  // 小组成员表
  db.exec(`
  CREATE TABLE IF NOT EXISTS group_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    member_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reviewed_at DATETIME,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (member_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(group_id, member_id)
  );
  `);

  // 兼容旧库字段名
  ensureColumn('groups', 'description', "TEXT DEFAULT ''");
  ensureColumn('groups', 'invite_code', 'TEXT');
  ensureColumn('groups', 'updated_at', 'DATETIME');
  ensureColumn('group_members', 'member_id', 'INTEGER');
  ensureColumn('group_members', 'status', "TEXT DEFAULT 'pending'");
  ensureColumn('group_members', 'joined_at', 'DATETIME');
  ensureColumn('group_members', 'reviewed_at', 'DATETIME');
  const memberColumns = db.prepare('PRAGMA table_info(group_members)').all().map((c) => c.name);
  if (memberColumns.includes('student_id')) {
    db.exec('UPDATE group_members SET member_id = student_id WHERE member_id IS NULL');
  }

  // 小组作业表
  db.exec(`
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    due_at DATETIME,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id)
  );
  `);
  ensureColumn('assignments', 'created_by', 'INTEGER');

  // 小组作业题目关联表
  db.exec(`
  CREATE TABLE IF NOT EXISTS assignment_questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    assignment_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    sort_order INTEGER DEFAULT 0,
    FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    UNIQUE(assignment_id, question_id)
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
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  `);
  migrateExamRecordsUniqueness();

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

  const announcementCount = db.prepare('SELECT COUNT(*) as count FROM announcements').get();
  if (announcementCount.count === 0) {
    const admin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    db.prepare(`
      INSERT INTO announcements (title, content, priority, is_active, created_by)
      VALUES (?, ?, ?, 1, ?)
    `).run('欢迎来到 bi lin OJ', '题库、比赛、题单和小组已开放浏览，登录后即可提交代码。', 10, admin?.id || null);
  }
}

module.exports = { initDatabase };
