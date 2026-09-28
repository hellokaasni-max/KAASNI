// public/js/cart-page.js

async function renderCartPage() {
  const cart = getCart();
  const root = document.querySelector('#cart-root');

  if (!root) return;

  if (cart.length === 0) {
    root.innerHTML = `
      <div class="empty-state">
        <h2>Your bag is empty</h2>
        <p>Browse the collection and add something you love.</p>
        <a href="/collection.html" class="btn">Shop now</a>
      </div>
    `;
    return;
  }

  const fee = await getShippingFee();

  const lines = cart.map((item) => {
    const thumb = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}">`
      : `
        <div class="product-placeholder" style="height:100%">
          <span class="mono" style="font-size:9px;padding:6px 8px;">
            Kaasni
          </span>
        </div>
      `;

    const quantity = Number(item.quantity) || 1;
    const price = Number(item.price) || 0;
    const stock = Number(item.stock) || 99;

    const sizeHtml = item.size
      ? `<div class="fabric">Size: ${escapeHtml(item.size)}</div>`
      : '';

    return `
      <div
        class="cart-line"
        data-id="${item.product_id}"
        data-size="${escapeHtml(item.size || '')}"
      >

        ${cartLink(item, `<div class="thumb">${thumb}</div>`, 'thumb-link')}

        <div>
          <div class="name">
            ${cartLink(item, escapeHtml(item.name))}
          </div>

          <div class="fabric">
            ${formatMoney(price)} each
          </div>

          ${sizeHtml}
        </div>

        <div class="qty-control">

          <button
            type="button"
            class="qty-btn"
            data-action="dec"
            aria-label="Decrease quantity">
            −
          </button>

          <span class="qty-value">
            ${quantity}
          </span>

          <button
            type="button"
            class="qty-btn"
            data-action="inc"
            aria-label="Increase quantity">
            +
          </button>

        </div>

        <div style="text-align:right;">

          <div style="margin-bottom:8px;font-weight:500;">
            ${formatMoney(price * quantity)}
          </div>

          <button
            type="button"
            class="remove-link"
            data-action="remove">
            Remove
          </button>

        </div>

      </div>
    `;
  }).join('');

  const subtotal = cartSubtotal();

  root.innerHTML = `
    <div class="cart-layout">

      <div>
        ${lines}
      </div>

      <div class="summary-box">

        <div class="summary-row">
          <span>Subtotal</span>
          <span>${formatMoney(subtotal)}</span>
        </div>

        <div class="summary-row">
          <span>Shipping</span>
          <span>${shippingLabel(fee)}</span>
        </div>

        <div class="summary-row total">
          <span>${fee === null ? 'Estimated total' : 'Total'}</span>
          <span>${formatMoney(subtotal + (fee || 0))}</span>
        </div>

        <a
          href="/checkout.html"
          class="btn full"
          style="margin-top:18px;">
          Proceed to checkout
        </a>

        <a
          href="/collection.html"
          class="btn outline full"
          style="margin-top:10px;">
          Continue shopping
        </a>

      </div>

    </div>
  `;
}


// --------------------------------------------------
// CART BUTTONS
// --------------------------------------------------

document.addEventListener('click', function (e) {

  const button = e.target.closest('[data-action]');

  if (!button) return;

  const line = button.closest('.cart-line');

  if (!line) return;

  const id = Number(line.dataset.id);

  if (!Number.isFinite(id)) return;

  const size = line.dataset.size || null;

  const item = getCart().find(
    (i) =>
      Number(i.product_id) === id &&
      String(i.size || '') === String(size || '')
  );

  if (!item) return;

  const action = button.dataset.action;

  // Increase quantity
  if (action === 'inc') {

    const currentQuantity =
      Number(item.quantity) || 1;

    const stock =
      Number(item.stock) || 99;

    if (currentQuantity < stock) {
      updateCartQuantity(
        id,
        currentQuantity + 1,
        size
      );
    }

    renderCartPage();
    return;
  }

  // Decrease quantity
  if (action === 'dec') {

    const currentQuantity =
      Number(item.quantity) || 1;

    updateCartQuantity(
      id,
      currentQuantity - 1,
      size
    );

    renderCartPage();
    return;
  }

  // Remove item completely
  if (action === 'remove') {

    removeFromCart(id, size);

    renderCartPage();
    return;
  }

});


// --------------------------------------------------
// SEARCH
// --------------------------------------------------

const searchForm =
  document.querySelector('#search-form');

if (searchForm) {

  searchForm.addEventListener(
    'submit',
    function (e) {

      e.preventDefault();

      const input =
        searchForm.querySelector(
          'input[name="q"]'
        );

      if (!input) return;

      const q = input.value.trim();

      window.location.href =
        `/collection.html?search=${encodeURIComponent(q)}`;

    }
  );

}


// --------------------------------------------------
// INITIAL RENDER
// --------------------------------------------------

document.addEventListener(
  'DOMContentLoaded',
  function () {
    renderCartPage();
  }
);