const API = '';

function getUser() {
  const s = localStorage.getItem('user');
  return s ? JSON.parse(s) : null;
}

function requireLogin() {
  if (!getUser()) { location.href = '/login.html'; return null; }
  return getUser();
}

function logout() {
  localStorage.removeItem('user');
  location.href = '/login.html';
}

function renderNav(active) {
  const user = getUser();
  if (!user) return '';
  const roleMap = { operator: '操作员', engineer: '工程师', qa: '质量', admin: '管理员' };
  const links = [
    { href: '/index.html', text: '首页', id: 'home' },
    { href: '/form.html', text: '新建检查表', id: 'form' },
    { href: '/review.html', text: '待审批', id: 'review' },
    { href: '/history.html', text: '历史记录', id: 'history' },
  ];
  return `<nav class="navbar">
    <span class="brand">首末件检查表系统</span>
    <div class="nav-links">
      ${links.map(l => `<a href="${l.href}" class="${active === l.id ? 'active' : ''}">${l.text}</a>`).join('')}
    </div>
    <span class="user-info">${user.name}(${roleMap[user.role]}) <a href="#" onclick="logout()" style="color:#fcc;margin-left:8px;">退出</a></span>
  </nav>`;
}

function statusText(s) {
  const m = { draft: '草稿', submitted: '已提交', engineering: '工程已确认', approved: '已通过', rejected: '已驳回' };
  return m[s] || s;
}

function statusBadge(s) {
  return `<span class="badge badge-${s}">${statusText(s)}</span>`;
}

async function api(url, opts = {}) {
  const res = await fetch(API + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '请求失败');
  return data;
}
