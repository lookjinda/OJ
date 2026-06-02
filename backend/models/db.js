const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const DB_PATH = path.join(__dirname, '../../database.sqlite');

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

function quote(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function bind(sql, params) {
  let index = 0;
  return String(sql).replace(/\?/g, () => quote(params[index++]));
}

function runSql(sql, json = false) {
  const args = ['-cmd', 'PRAGMA foreign_keys=ON'];
  if (json) args.push('-json');
  args.push(DB_PATH, sql);
  const output = execFileSync('/usr/bin/sqlite3', args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 50 });
  if (!json) return output;
  const text = output.trim();
  return text ? JSON.parse(text) : [];
}

class SqliteCliStatement {
  constructor(sql) {
    this.sql = sql;
  }

  all(...params) {
    return runSql(bind(this.sql, params), true);
  }

  get(...params) {
    return this.all(...params)[0];
  }

  run(...params) {
    const sql = bind(this.sql, params);
    const rows = runSql(`${sql}; SELECT last_insert_rowid() AS lastInsertRowid, changes() AS changes;`, true);
    return rows[rows.length - 1] || { lastInsertRowid: 0, changes: 0 };
  }
}

class SqliteCliDatabase {
  prepare(sql) {
    return new SqliteCliStatement(sql);
  }

  exec(sql) {
    runSql(sql, false);
  }

  pragma(sql) {
    return runSql(`PRAGMA ${sql}`, true);
  }

  transaction(fn) {
    return (...args) => fn(...args);
  }
}

let db;
try {
  const Database = require('better-sqlite3');
  db = new Database(DB_PATH);
} catch (err) {
  console.warn('[db] better-sqlite3 不可用，已切换到系统 sqlite3 兼容模式:', err.message);
  db = new SqliteCliDatabase();
}

// 启用WAL模式，提升并发性能
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;
