const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || 'https://open.feishu.cn/open-apis/bot/v2/hook/4bca2958-28d9-4532-811a-b7a427f08320';

async function notifyFeishu(title, content, formId) {
  try {
    const res = await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: title }, template: 'blue' },
          elements: [
            { tag: 'div', text: { tag: 'lark_md', content } },
            { tag: 'action', actions: [{ tag: 'button', text: { tag: 'plain_text', content: '查看详情' }, type: 'primary', url: `${process.env.BASE_URL || 'http://localhost:3000'}/review.html?id=${formId}` }] }
          ]
        }
      })
    });
  } catch (e) { console.error('飞书推送失败:', e.message); }
}

router.post('/', (req, res) => {
  const { created_by, fields } = req.body;
  if (!created_by || !fields) return res.status(400).json({ error: '参数不完整' });
  const db = getDb();
  const tx = db.transaction(() => {
    const r = db.prepare('INSERT INTO forms (created_by, status) VALUES (?, ?)').run(created_by, 'submitted');
    const formId = r.lastInsertRowid;
    const ins = db.prepare('INSERT INTO form_data (form_id, field_key, field_value) VALUES (?, ?, ?)');
    for (const [k, v] of Object.entries(fields)) {
      ins.run(formId, k, v || '');
    }
    return formId;
  });
  try {
    const formId = tx();
    const model = fields.f_model || fields.model || 'CX1E_16AUD';
    const sn = fields.f_sn || fields.sn || '';
    const db2 = getDb();
    const user = db2.prepare('SELECT name FROM users WHERE id = ?').get(created_by);
    db2.close();
    notifyFeishu('📋 新检查表已提交', `**提交人**: ${user?.name || '未知'}\n**机型**: ${model}\n**SN**: ${sn}\n**时间**: ${new Date().toLocaleString('zh-CN')}`, formId);
    res.json({ id: formId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally { db.close(); }
});

router.get('/', (req, res) => {
  const { status, created_by } = req.query;
  const db = getDb();
  let sql = `SELECT f.*, u.name as creator_name, u.badge_no as creator_badge
             FROM forms f JOIN users u ON f.created_by = u.id WHERE 1=1`;
  const params = [];
  if (status) { sql += ' AND f.status = ?'; params.push(status); }
  if (created_by) { sql += ' AND f.created_by = ?'; params.push(created_by); }
  sql += ' ORDER BY f.created_at DESC';
  const forms = db.prepare(sql).all(...params);
  db.close();
  res.json(forms);
});

router.get('/:id', (req, res) => {
  const db = getDb();
  const form = db.prepare(`SELECT f.*, u.name as creator_name, u.badge_no as creator_badge
                           FROM forms f JOIN users u ON f.created_by = u.id WHERE f.id = ?`).get(req.params.id);
  if (!form) { db.close(); return res.status(404).json({ error: '表单不存在' }); }
  const data = db.prepare('SELECT field_key, field_value FROM form_data WHERE form_id = ?').all(req.params.id);
  const approvals = db.prepare(`SELECT a.*, u.name as user_name, u.badge_no
                                FROM approvals a JOIN users u ON a.user_id = u.id
                                WHERE a.form_id = ? ORDER BY a.created_at`).all(req.params.id);
  db.close();
  const fields = {};
  data.forEach(d => { fields[d.field_key] = d.field_value; });
  res.json({ ...form, fields, approvals });
});

router.put('/:id', (req, res) => {
  const { fields } = req.body;
  if (!fields) return res.status(400).json({ error: '参数不完整' });
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare("UPDATE forms SET status = 'submitted', updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
    const ins = db.prepare(`INSERT INTO form_data (form_id, field_key, field_value) VALUES (?, ?, ?)
                            ON CONFLICT(form_id, field_key) DO UPDATE SET field_value = excluded.field_value`);
    for (const [k, v] of Object.entries(fields)) {
      ins.run(req.params.id, k, v || '');
    }
  });
  try { tx(); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
  finally { db.close(); }
});

module.exports = router;
