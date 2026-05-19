const SUPABASE_URL = 'https://zeqdztwcokuyjajaljqn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DBqOvz9tKJhqrR3fa4rX8A_9OWUbR17';
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/4bca2958-28d9-4532-811a-b7a427f08320';

const headers = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };

const db = {
  async query(table, params = '') {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
    return res.json();
  },
  async insert(table, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers, body: JSON.stringify(data) });
    return res.json();
  },
  async update(table, id, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, { method: 'PATCH', headers, body: JSON.stringify(data) });
    return res.json();
  }
};

async function notifyFeishu(title, content, color) {
  try {
    await fetch(FEISHU_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        msg_type: 'interactive',
        card: {
          header: { title: { tag: 'plain_text', content: title }, template: color || 'blue' },
          elements: [{ tag: 'div', text: { tag: 'lark_md', content } }]
        }
      })
    });
  } catch (e) { console.error('推送失败', e); }
}

function getUser() { const s = localStorage.getItem('user'); return s ? JSON.parse(s) : null; }
function setUser(u) { localStorage.setItem('user', JSON.stringify(u)); }
function logout() { localStorage.removeItem('user'); location.reload(); }

function statusText(s) {
  return { draft:'草稿', submitted:'已提交', engineering:'工程已确认', approved:'已通过', rejected:'已驳回' }[s] || s;
}
function statusBadge(s) {
  const colors = { submitted:'#ffc107', engineering:'#17a2b8', approved:'#28a745', rejected:'#dc3545' };
  return `<span style="background:${colors[s]||'#999'};color:${s==='submitted'?'#333':'#fff'};padding:2px 8px;border-radius:10px;font-size:11px;">${statusText(s)}</span>`;
}
