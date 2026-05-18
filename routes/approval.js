const express = require('express');
const router = express.Router();
const { getDb } = require('../db/init');

const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK || 'https://open.feishu.cn/open-apis/bot/v2/hook/4bca2958-28d9-4532-811a-b7a427f08320';

async function notifyFeishu(title, content, formId) {
  try {
    await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: title }, template: form.status === 'approved' ? 'green' : form.status === 'rejected' ? 'red' : 'blue' },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content } }]
        }
      })
    });
  } catch (e) { console.error('飞书推送失败:', e.message); }
}

const STATUS_FLOW = {
  submitted: 'engineering',
  engineering: 'approved',
};

router.post('/:formId', (req, res) => {
  const { user_id, action, comment } = req.body;
  if (!user_id || !action) return res.status(400).json({ error: '参数不完整' });
  const db = getDb();
  const form = db.prepare('SELECT * FROM forms WHERE id = ?').get(req.params.formId);
  if (!form) { db.close(); return res.status(404).json({ error: '表单不存在' }); }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(user_id);
  if (!user) { db.close(); return res.status(404).json({ error: '用户不存在' }); }

  if (action === 'approve') {
    const nextStatus = STATUS_FLOW[form.status];
    if (!nextStatus) { db.close(); return res.status(400).json({ error: '当前状态不可审批' }); }
    if (form.status === 'submitted' && user.role !== 'engineer' && user.role !== 'admin') {
      db.close(); return res.status(403).json({ error: '需要工程师确认' });
    }
    if (form.status === 'engineering' && user.role !== 'qa' && user.role !== 'admin') {
      db.close(); return res.status(403).json({ error: '需要质量人员审批' });
    }
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO approvals (form_id, role, user_id, action, comment) VALUES (?, ?, ?, ?, ?)').run(
        form.id, user.role, user_id, 'approve', comment || '');
      db.prepare("UPDATE forms SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?").run(nextStatus, form.id);
    });
    tx();
    const statusText = nextStatus === 'engineering' ? '工程已确认，待质量审批' : '已通过 ✅';
    fetch(FEISHU_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'interactive', card: {
        header: { title: { tag: 'plain_text', content: `审批通过：${statusText}` }, template: nextStatus === 'approved' ? 'green' : 'blue' },
        elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**审批人**: ${user.name}\n**操作**: 通过\n**备注**: ${comment || '无'}` } }]
      }})
    }).catch(() => {});
  } else if (action === 'reject') {
    if (user.role !== 'engineer' && user.role !== 'qa' && user.role !== 'admin') {
      db.close(); return res.status(403).json({ error: '无权驳回' });
    }
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO approvals (form_id, role, user_id, action, comment) VALUES (?, ?, ?, ?, ?)').run(
        form.id, user.role, user_id, 'reject', comment || '');
      db.prepare("UPDATE forms SET status = 'rejected', updated_at = datetime('now','localtime') WHERE id = ?").run(form.id);
    });
    tx();
    fetch(FEISHU_WEBHOOK, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ msg_type: 'interactive', card: {
        header: { title: { tag: 'plain_text', content: '❌ 检查表已驳回' }, template: 'red' },
        elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**驳回人**: ${user.name}\n**原因**: ${comment || '未填写'}` } }]
      }})
    }).catch(() => {});
  } else {
    db.close(); return res.status(400).json({ error: '无效操作' });
  }

  db.close();
  res.json({ ok: true });
});

router.get('/pending', (req, res) => {
  const { role } = req.query;
  const db = getDb();
  let status = '';
  if (role === 'engineer') status = 'submitted';
  else if (role === 'qa') status = 'engineering';
  else { db.close(); return res.json([]); }

  const forms = db.prepare(`SELECT f.*, u.name as creator_name, u.badge_no as creator_badge
                            FROM forms f JOIN users u ON f.created_by = u.id
                            WHERE f.status = ? ORDER BY f.created_at DESC`).all(status);
  db.close();
  res.json(forms);
});

module.exports = router;
