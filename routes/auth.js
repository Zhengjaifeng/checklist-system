const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

router.post('/login', (req, res) => {
  const { badge_no } = req.body;
  if (!badge_no) return res.status(400).json({ error: '请输入工号' });
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE badge_no = ?').get(badge_no.trim().toUpperCase());
  db.close();
  if (!user) return res.status(404).json({ error: '工号不存在' });
  res.json(user);
});

router.get('/users', (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, badge_no, name, role FROM users').all();
  db.close();
  res.json(users);
});

router.post('/users', (req, res) => {
  const { badge_no, name, role } = req.body;
  if (!badge_no || !name || !role) return res.status(400).json({ error: '参数不完整' });
  const db = getDb();
  try {
    db.prepare('INSERT INTO users (badge_no, name, role) VALUES (?, ?, ?)').run(badge_no.trim().toUpperCase(), name, role);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: '工号已存在' });
  } finally { db.close(); }
});

module.exports = router;
