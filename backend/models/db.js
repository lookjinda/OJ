const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '../../database.sqlite');

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// 启用WAL模式，提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
