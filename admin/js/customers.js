// admin/js/customers.js
if (requireAdminSession()) {
  init();
}

const ORDER_STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

function init() {
  loadCustomers();
  qs('#search-input').addEventListener('input', debounce(loadCustomers, 300));
  qs('#customer-drawer-close').addEventListener('click', closeDrawer);
  qs('#customer-overlay').addEventListener('click', (e) => { if (e.target.id === 'customer-overlay') closeDrawer(); });
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function loadCustomers() {
  const search = qs('#search-input').value.trim();
  const params = new URLSearchParams();
  if (search) params.set('search', search);

  const body = qs('#customers-body');
  try {
    const { customers } = await adminRequest(`/admin/customers?${params.toString()}`);
    if (customers.length === 0) {
      body.innerHTML = '<tr><td colspan="6" class="table-empty">No customers yet.</td></tr>';
      return;
    }
    body.innerHTML = customers.map((c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.phone)}</td>
        <td>${escapeHtml(c.email || '—')}</td>
        <td>${c.order_count}</td>
        <td>${formatMoney(c.lifetime_spend)}</td>
        <td><button class="icon-btn-mini" onclick="openCustomerDrawer(${c.id})">View</button></td>
      </tr>
    `).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="6" class="table-empty">${escapeHtml(e.message)}</td></tr>`;
  }
}

async function openCustomerDrawer(id) {
  const bodyEl = qs('#customer-detail-body');
  bodyEl.innerHTML = '<p class="muted">Loading…</p>';
  qs('#customer-overlay').classList.add('open');

  try {
    const { customer, orders } = await adminRequest(`/admin/customers/${id}`);
    qs('#customer-drawer-title').textContent = customer.name;

    const ordersHtml = orders.length === 0
      ? '<p class="muted" style="font-size:13px;">No orders yet.</p>'
      : `<table><thead><tr><th>Order</th><th>Status</th><th>Total</th><th>Placed</th></tr></thead><tbody>
          ${orders.map((o) => `
            <tr style="cursor:pointer;" onclick="window.location.href='/admin/orders.html?id=${o.id}'">
              <td>${escapeHtml(o.order_number)}</td>
              <td><span class="pill ${o.status}">${ORDER_STATUS_LABEL[o.status] || o.status}</span></td>
              <td>${formatMoney(o.total)}</td>
              <td>${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
            </tr>
          `).join('')}
        </tbody></table>`;

    bodyEl.innerHTML = `
      <div class="field">
        <label>Contact</label>
        <p style="margin:0;font-size:13.5px;">
          ${escapeHtml(customer.phone)}${customer.email ? ' · ' + escapeHtml(customer.email) : ''}<br>
          ${escapeHtml(customer.address || '')}<br>
          ${escapeHtml(customer.city || '')} ${escapeHtml(customer.state || '')} ${escapeHtml(customer.pincode || '')}
        </p>
      </div>
      <h3 style="font-family:var(--font-display);font-size:18px;margin:22px 0 12px;">Order history</h3>
      ${ordersHtml}
    `;
  } catch (e) {
    bodyEl.innerHTML = `<p class="form-error">${escapeHtml(e.message)}</p>`;
  }
}

function closeDrawer() {
  qs('#customer-overlay').classList.remove('open');
}
