const SUPABASE_URL = 'https://zeqdztwcokuyjajaljqn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DBqOvz9tKJhqrR3fa4rX8A_9OWUbR17';
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/4bca2958-28d9-4532-811a-b7a427f08320';
const FEISHU_APP_ID = 'cli_aa806c873d78dcc2';
const FEISHU_APP_SECRET = 'L4l2s3JL5U4UHFiVsyKKTdspRduZHjWf';
const FEISHU_CHAT_ID = 'oc_4746b481014b142b43e04788a5b35686';

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

async function getFeishuToken() {
  const res = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: FEISHU_APP_SECRET })
  });
  const data = await res.json();
  return data.tenant_access_token;
}

async function sendFeishuMessage(title, content, color) {
  const token = await getFeishuToken();
  const card = { header: { title: { tag: 'plain_text', content: title }, template: color || 'blue' }, elements: [{ tag: 'div', text: { tag: 'lark_md', content } }] };
  const res = await fetch('https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ receive_id: FEISHU_CHAT_ID, msg_type: 'interactive', content: JSON.stringify(card) })
  });
  const data = await res.json();
  return data.data?.message_id || null;
}

async function replyFeishuMessage(messageId, title, content, color) {
  if (!messageId) return sendFeishuMessage(title, content, color);
  const token = await getFeishuToken();
  const card = { header: { title: { tag: 'plain_text', content: title }, template: color || 'blue' }, elements: [{ tag: 'div', text: { tag: 'lark_md', content } }] };
  await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}/reply`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ msg_type: 'interactive', content: JSON.stringify(card) })
  });
}

async function notifyFeishu(title, content, color) {
  try { await sendFeishuMessage(title, content, color); } catch (e) { console.error('推送失败', e); }
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
