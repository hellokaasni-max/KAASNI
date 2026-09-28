// admin/js/admin-api.js
const ADMIN_TOKEN_KEY = 'kaasni_admin_token';
const ADMIN_INFO_KEY = 'kaasni_admin_info';

function getAdminToken() { return localStorage.getItem(ADMIN_TOKEN_KEY); }
function getAdminInfo() {
  try { return JSON.parse(localStorage.getItem(ADMIN_INFO_KEY) || 'null'); }
  catch (e) { return null; }
}
function setAdminSession(token, admin) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_INFO_KEY, JSON.stringify(admin));
}
function clearAdminSession() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_INFO_KEY);
}

// Redirects to login if there's no token. Call at the top of every
// protected admin page (everything except index.html).
function requireAdminSession() {
  if (!getAdminToken()) {
    window.location.href = '/admin/index.html';
    return false;
  }
  return true;
}

async function adminRequest(path, { method = 'GET', body, isMultipart = false } = {}) {
  const headers = { Authorization: `Bearer ${getAdminToken()}` };
  const opts = { method, headers };

  if (isMultipart) {
    opts.body = body; // FormData — browser sets the content-type boundary
  } else if (body) {
    headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  const res = await fetch(`/api${path}`, opts);

  if (res.status === 401) {
    clearAdminSession();
    window.location.href = '/admin/index.html';
    throw new Error('Session expired. Please log in again.');
  }

  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error((data && data.error) || 'Something went wrong.');
  return data;
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '\u20B9' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

// Small confirmation message, e.g. after a save closes a drawer.
function showAdminToast(message, type = 'success') {
  let el = document.querySelector('#admin-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'admin-toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.className = 'admin-toast show ' + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

function fillAdminName() {
  const info = getAdminInfo();
  const el = qs('#admin-name');
  if (el && info) el.textContent = info.name;
}

function wireLogout() {
  const btn = qs('#logout-btn');
  if (btn) btn.addEventListener('click', () => {
    clearAdminSession();
    window.location.href = '/admin/index.html';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  fillAdminName();
  wireLogout();
});
