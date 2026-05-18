const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data.db');

function getDb() {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function init() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      badge_no TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('operator','engineer','qa','admin'))
    );

    CREATE TABLE IF NOT EXISTS forms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_type TEXT NOT NULL DEFAULT 'CX1E_16AUD',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','engineering','approved','rejected')),
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS form_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      field_key TEXT NOT NULL,
      field_value TEXT DEFAULT '',
      UNIQUE(form_id, field_key)
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      form_id INTEGER NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      action TEXT NOT NULL CHECK(action IN ('approve','reject')),
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `);

  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count === 0) {
    const insert = db.prepare('INSERT INTO users (badge_no, name, role) VALUES (?, ?, ?)');
    const users = [
      ['P001', '张三', 'operator'],
      ['P002', '李四', 'operator'],
      ['E001', '王工', 'engineer'],
      ['Q001', '赵质', 'qa'],
      ['A001', '管理员', 'admin'],
    ];
    const tx = db.transaction(() => { users.forEach(u => insert.run(...u)); });
    tx();
  }

  db.close();
}

module.exports = { getDb, init };
