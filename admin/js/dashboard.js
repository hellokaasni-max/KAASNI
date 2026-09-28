// admin/js/dashboard.js
if (requireAdminSession()) {
  loadDashboard();
}

const STATUS_LABEL = { pending: 'Pending', confirmed: 'Confirmed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled' };

async function loadDashboard() {
  try {
    const data = await adminRequest('/admin/dashboard');

    qs('#stat-grid').innerHTML = `
      <div class="stat-card"><div class="label">Revenue</div><div class="value">${formatMoney(data.revenue)}</div></div>
      <div class="stat-card"><div class="label">Orders <span class="muted">(${data.pending_orders} pending)</span></div><div class="value">${data.order_count}</div></div>
      <div class="stat-card"><div class="label">Products live</div><div class="value ${data.low_stock > 0 ? 'warn' : ''}">${data.product_count}</div></div>
      <div class="stat-card"><div class="label">Customers</div><div class="value">${data.customer_count}</div></div>
    `;

    const ordersBody = qs('#recent-orders-body');
    if (data.recent_orders.length === 0) {
      ordersBody.innerHTML = '<tr><td colspan="5" class="table-empty">No orders yet.</td></tr>';
    } else {
      ordersBody.innerHTML = data.recent_orders.map((o) => `
        <tr onclick="window.location.href='/admin/orders.html?id=${o.id}'" style="cursor:pointer;">
          <td>${escapeHtml(o.order_number)}</td>
          <td>${escapeHtml(o.shipping_name)}</td>
          <td><span class="pill ${o.status}">${STATUS_LABEL[o.status] || o.status}</span></td>
          <td>${formatMoney(o.total)}</td>
          <td>${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
        </tr>
      `).join('');
    }

    const topBody = qs('#top-products-body');
    if (data.top_products.length === 0) {
      topBody.innerHTML = '<tr><td colspan="2" class="table-empty">No sales yet.</td></tr>';
    } else {
      topBody.innerHTML = data.top_products.map((p) => `
        <tr><td>${escapeHtml(p.name)}</td><td>${p.units_sold}</td></tr>
      `).join('');
    }
  } catch (e) {
    console.error(e);
  }
}
