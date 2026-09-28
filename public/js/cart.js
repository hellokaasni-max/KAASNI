// public/js/cart.js

const CART_KEY = 'kaasni_cart_v1';

function getCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Cart read error:', e);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartBadge();
}

function cartCount() {
  return getCart().reduce(
    (sum, item) => sum + Number(item.quantity || 0),
    0
  );
}

function cartSubtotal() {
  return getCart().reduce(
    (sum, item) =>
      sum +
      Number(item.price || 0) *
        Number(item.quantity || 0),
    0
  );
}

function sameProduct(a, b) {
  return String(a) === String(b);
}

function sameCartItem(item, product, size) {
  return (
    sameProduct(item.product_id, product.id) &&
    String(item.size || '') === String(size || '')
  );
}

function addToCart(product, quantity = 1, size = null) {
  const cart = getCart();

  const existing = cart.find((item) =>
    sameCartItem(item, product, size)
  );

  const image = productImageSrc(product);

  if (existing) {
    const stock = Number(product.stock) || 99;

    existing.quantity = Math.min(
      Number(existing.quantity || 0) +
        Number(quantity || 1),
      stock
    );
  } else {
    cart.push({
      product_id: product.id,
      slug: product.slug || null,
      name: product.name,
      price: Number(product.price) || 0,
      image,
      size: size || null,
      quantity: Math.max(
        1,
        Number(quantity) || 1
      ),
      stock: Number(product.stock) || 99,
    });
  }

  saveCart(cart);
}

function updateCartQuantity(productId, quantity, size = null) {
  const cart = getCart();

  const item = cart.find(
    (item) =>
      sameProduct(item.product_id, productId) &&
      String(item.size || '') === String(size || '')
  );

  if (!item) {
    console.warn(
      'Cart item not found:',
      productId,
      size
    );
    return;
  }

  const newQuantity = Number(quantity);

  if (newQuantity <= 0) {
    removeFromCart(productId, size);
    return;
  }

  const stock = Number(item.stock) || 99;

  item.quantity = Math.min(
    newQuantity,
    stock
  );

  saveCart(cart);
}

function removeFromCart(productId, size = null) {
  const cart = getCart();

  const updatedCart = cart.filter(
    (item) =>
      !(
        sameProduct(item.product_id, productId) &&
        String(item.size || '') === String(size || '')
      )
  );

  saveCart(updatedCart);
}

function clearCart() {
  saveCart([]);
}

function updateCartBadge() {
  const el = document.querySelector('.cart-count');

  if (el) {
    const prev = el.textContent;
    el.textContent = cartCount();
    if (prev !== el.textContent && prev !== '0' || (prev === '0' && cartCount() > 0 && document.readyState === 'complete')) {
      el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
    }
  }
}

document.addEventListener(
  'DOMContentLoaded',
  updateCartBadge
);

// Link to a cart line's product page (older saved carts may not have a slug yet).
function cartLink(item, inner, cls = '') {
  if (!item.slug) return inner;
  return `<a href="/product.html?slug=${encodeURIComponent(item.slug)}"${cls ? ` class="${cls}"` : ''}>${inner}</a>`;
}

// Shipping fee comes from the server (SHIPPING_FEE) so the bag and checkout
// show the same amount that will actually be charged.
let _shippingFeePromise = null;
function getShippingFee() {
  if (!_shippingFeePromise) {
    _shippingFeePromise = apiRequest('/settings')
      .then(({ settings }) => {
        const n = Number(settings && settings.shipping_fee);
        return Number.isFinite(n) && n >= 0 ? n : null;
      })
      .catch(() => null);
  }
  return _shippingFeePromise;
}
function shippingLabel(fee) {
  if (fee === null || fee === undefined) return 'Calculated at checkout';
  return fee === 0 ? 'Free' : formatMoney(fee);
}
