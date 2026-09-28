// public/js/api.js
const API_BASE = '/api';

async function apiRequest(path, { method = 'GET', body } = {}) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}${path}`, opts);
  let data = null;
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const message = (data && data.error) || 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return data;
}

function formatMoney(amount) {
  const n = Number(amount) || 0;
  return '\u20B9' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function productImageSrc(product) {
  if (product && product.images && product.images.length > 0) {
    return product.images[0].image_url || product.images[0].image_path|| null;
  }
  return null;
}

function showToast(message, action) {
  let toast = qs('#kaasni-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'kaasni-toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.toggle('has-action', !!action);
  if (action) {
    const a = document.createElement('a');
    a.href = action.href || '#';
    a.textContent = action.label;
    if (action.onClick) a.addEventListener('click', (e) => { e.preventDefault(); action.onClick(); toast.classList.remove('show'); });
    toast.append(' ', a);
  }
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), action ? 4000 : 2200);
}
