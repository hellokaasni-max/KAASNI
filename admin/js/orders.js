// admin/js/orders.js

if (requireAdminSession()) {
  init();
}

const STATUS_LABEL = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const VALID_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

function init() {
  loadOrders();

  qs('#search-input').addEventListener(
    'input',
    debounce(loadOrders, 300)
  );

  qs('#status-filter').addEventListener(
    'change',
    loadOrders
  );

  qs('#order-drawer-close').addEventListener(
    'click',
    closeDrawer
  );

  qs('#order-overlay').addEventListener(
    'click',
    (e) => {
      if (e.target.id === 'order-overlay') {
        closeDrawer();
      }
    }
  );

  const deepLinkId =
    new URLSearchParams(
      window.location.search
    ).get('id');

  if (deepLinkId) {
    openOrderDrawer(deepLinkId);
  }
}

function debounce(fn, ms) {
  let t;

  return (...args) => {
    clearTimeout(t);

    t = setTimeout(
      () => fn(...args),
      ms
    );
  };
}

async function loadOrders() {
  const search =
    qs('#search-input').value.trim();

  const status =
    qs('#status-filter').value;

  const params =
    new URLSearchParams();

  if (search) {
    params.set('search', search);
  }

  if (status) {
    params.set('status', status);
  }

  const body =
    qs('#orders-body');

  try {
    const { orders } =
      await adminRequest(
        `/admin/orders?${params.toString()}`
      );

    if (orders.length === 0) {
      body.innerHTML =
        '<tr><td colspan="7" class="table-empty">No orders found.</td></tr>';

      return;
    }

    body.innerHTML =
      orders
        .map(
          (o) => `
            <tr>
              <td>
                ${escapeHtml(o.order_number)}
              </td>

              <td>
                ${escapeHtml(o.shipping_name)}
              </td>

              <td>
                ${escapeHtml(o.shipping_phone)}
              </td>

              <td>
                <span class="pill ${o.status}">
                  ${STATUS_LABEL[o.status] || o.status}
                </span>
              </td>

              <td>
                ${formatMoney(o.total)}
              </td>

              <td>
                ${new Date(
                  o.created_at
                ).toLocaleDateString('en-IN')}
              </td>

              <td>
                <button
                  class="icon-btn-mini"
                  onclick="openOrderDrawer(${o.id})">
                  View
                </button>
              </td>
            </tr>
          `
        )
        .join('');
  } catch (e) {
    body.innerHTML = `
      <tr>
        <td
          colspan="7"
          class="table-empty">
          ${escapeHtml(e.message)}
        </td>
      </tr>
    `;
  }
}

async function openOrderDrawer(id) {
  const bodyEl =
    qs('#order-detail-body');

  bodyEl.innerHTML =
    '<p class="muted">Loading…</p>';

  qs('#order-overlay')
    .classList
    .add('open');

  try {
    const { order } =
      await adminRequest(
        `/admin/orders/${id}`
      );

    qs('#order-drawer-title')
      .textContent =
      order.order_number;

    const itemsHtml =
      order.items
        .map(
          (i) => `
            <tr>
              <td>
                ${escapeHtml(
                  i.product_name
                )}
              </td>

              <td>
                ${
                  i.size
                    ? escapeHtml(i.size)
                    : '—'
                }
              </td>

              <td>
                ${i.quantity}
              </td>

              <td>
                ${formatMoney(
                  i.line_total
                )}
              </td>
            </tr>
          `
        )
        .join('');

    bodyEl.innerHTML = `
      <div class="field">
        <label>Shipping to</label>

        <p
          style="
            margin:0;
            font-size:13.5px;
          ">
          ${escapeHtml(
            order.shipping_name
          )}<br>

          ${escapeHtml(
            order.shipping_phone
          )}

          ${
            order.shipping_email
              ? ' · ' +
                escapeHtml(
                  order.shipping_email
                )
              : ''
          }

          <br>

          ${escapeHtml(
            order.shipping_address
          )}<br>

          ${escapeHtml(
            order.shipping_city
          )},

          ${escapeHtml(
            order.shipping_state
          )}

          ${escapeHtml(
            order.shipping_pincode
          )}
        </p>
      </div>

      ${
        order.notes
          ? `
            <div class="field">
              <label>Notes</label>

              <p
                style="
                  margin:0;
                  font-size:13.5px;
                ">
                ${escapeHtml(
                  order.notes
                )}
              </p>
            </div>
          `
          : ''
      }

      <table
        style="
          margin:18px 0;
          width:100%;
        ">

        <thead>
          <tr>
            <th>Item</th>
            <th>Size</th>
            <th>Qty</th>
            <th>Total</th>
          </tr>
        </thead>

        <tbody>
          ${itemsHtml}
        </tbody>

      </table>

      <div
        class="flex-between"
        style="
          font-size:14px;
          font-weight:600;
          margin-bottom:20px;
        ">

        <span>
          Subtotal
        </span>

        <span>
          ${formatMoney(
            order.subtotal
          )}
        </span>
      </div>

      <div
        class="flex-between"
        style="
          font-size:14px;
          font-weight:600;
          margin-bottom:20px;
        ">

        <span>
          Shipping
        </span>

        <span>
          ${formatMoney(
            order.shipping_fee
          )}
        </span>
      </div>

      <div
        class="flex-between"
        style="
          font-size:16px;
          font-weight:700;
          margin-bottom:24px;
          border-top:1px solid var(--line);
          padding-top:12px;
        ">

        <span>
          Total
        </span>

        <span>
          ${formatMoney(
            order.total
          )}
        </span>
      </div>

      <form id="status-form">

        <div class="field-row">

          <div class="field">

            <label
              for="status-select">
              Order status
            </label>

            <select
              id="status-select">

              ${VALID_STATUSES
                .map(
                  (s) => `
                    <option
                      value="${s}"
                      ${
                        s === order.status
                          ? 'selected'
                          : ''
                      }>
                      ${STATUS_LABEL[s]}
                    </option>
                  `
                )
                .join('')}

            </select>

          </div>

          <div class="field">

            <label
              for="payment-status-select">
              Payment status
            </label>

            <select
              id="payment-status-select">

              <option
                value="unpaid"
                ${
                  order.payment_status ===
                  'unpaid'
                    ? 'selected'
                    : ''
                }>
                Unpaid
              </option>

              <option
                value="paid"
                ${
                  order.payment_status ===
                  'paid'
                    ? 'selected'
                    : ''
                }>
                Paid
              </option>

              <option
                value="refunded"
                ${
                  order.payment_status ===
                  'refunded'
                    ? 'selected'
                    : ''
                }>
                Refunded
              </option>

            </select>

          </div>

        </div>

        <p
          class="muted"
          style="font-size:12px;">

          Payment method:
          ${escapeHtml(
            order.payment_method
          )}

        </p>

        <div
          id="status-error"
          class="form-error"
          style="display:none;">
        </div>

        <div
          id="status-success"
          class="form-success"
          style="display:none;">
          Updated.
        </div>

        <button
          class="btn"
          type="submit"
          style="margin-top:8px;">
          Update order
        </button>

      </form>
    `;

    qs('#status-form')
      .addEventListener(
        'submit',
        async (e) => {
          e.preventDefault();

          const errorEl =
            qs('#status-error');

          const successEl =
            qs('#status-success');

          errorEl.style.display =
            'none';

          successEl.style.display =
            'none';

          try {
            await adminRequest(
              `/admin/orders/${id}/status`,
              {
                method: 'PUT',

                body: {
                  status:
                    qs(
                      '#status-select'
                    ).value,

                  payment_status:
                    qs(
                      '#payment-status-select'
                    ).value,
                },
              }
            );

            closeDrawer();
            showAdminToast('Order updated');
            loadOrders();
          } catch (err) {
            errorEl.textContent =
              err.message;

            errorEl.style.display =
              'block';
          }
        }
      );
  } catch (e) {
    bodyEl.innerHTML = `
      <p class="form-error">
        ${escapeHtml(e.message)}
      </p>
    `;
  }
}

function closeDrawer() {
  qs('#order-overlay')
    .classList
    .remove('open');

  const url =
    new URL(
      window.location.href
    );

  url.searchParams.delete('id');

  window.history.replaceState(
    {},
    '',
    url.toString()
  );
}