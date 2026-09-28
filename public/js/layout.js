// public/js/layout.js
// Runs on every storefront page. Builds ONE consistent header, mobile drawer,
// footer and WhatsApp button (replacing the per-page copies), then fills in
// footer details from site settings.

const WA_NUMBER = '919831150476';
const WA_PATH = 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.149-.672.15-.198.297-.768.967-.94 1.166-.173.198-.345.223-.642.075-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.019-.458.13-.606.134-.133.298-.347.446-.52.149-.173.198-.298.298-.497.099-.198.05-.372-.025-.521-.075-.149-.672-1.611-.92-2.207-.242-.579-.487-.5-.672-.51l-.573-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.262.489 1.693.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.414-.074-.124-.273-.198-.57-.347z';

const ICON = {
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  bag: '<svg viewBox="0 0 24 24"><path d="M5 8h14l-1 12H6L5 8z"/><path d="M9 8V6a3 3 0 016 0v2"/></svg>',
  box: '<svg viewBox="0 0 24 24"><path d="M3 7l9-4 9 4v10l-9 4-9-4V7z"/><path d="M3 7l9 4 9-4M12 11v10"/></svg>',
  menu: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

let siteCategories = [];

function navLinks() {
    const path = location.pathname;
    const cat = new URLSearchParams(location.search).get('category');
    const onCollection = path.endsWith('collection.html');
    const allActive = onCollection && !cat;

    const categoryLinks = siteCategories.map((category) => {
      const active = onCollection && cat === category.slug;
      return `<a href="/collection.html?category=${encodeURIComponent(category.slug)}" class="${active ? 'active' : ''}">${escapeHtml(category.name)}</a>`;
    }).join('');

    return `
      <a href="/collection.html" class="${allActive ? 'active' : ''}">All Products</a>
      ${categoryLinks}`;
  }
function searchFormHtml(id) {
  return `
    <form class="search-box" id="${id}" role="search">
      <input name="q" type="search" placeholder="Search products" aria-label="Search products" autocomplete="off">
      <button type="submit" aria-label="Search">${ICON.search}</button>
    </form>`;
}

function buildChrome() {
  // ----- Header + announcement + drawer -----
  const oldHeader = document.querySelector('.site-header');
  const headerHtml = `
    <div class="announce"><span><span class="ann-long">Handcrafted Indian ethnic wear &nbsp;&middot;&nbsp; </span><b>Dispatched in 3&ndash;5 business days</b></span></div>
    <header class="site-header">
      <div class="container header-row">
        <button class="icon-btn mobile-nav-toggle" type="button" aria-label="Open menu" aria-expanded="false">${ICON.menu}</button>
        <nav class="main-nav" aria-label="Main navigation">${navLinks()}</nav>
        <a href="/" class="logo" aria-label="Kaasni &mdash; Home"><img src="/images/kaasni-logo.png" alt="Kaasni" class="brand-logo"></a>
        <div class="header-actions">
          ${searchFormHtml('search-form')}
          <button class="icon-btn search-toggle" type="button" aria-label="Search products" aria-expanded="false" aria-controls="header-search-bar">${ICON.search}</button>
          <a href="/track-order.html" class="icon-btn track-link" title="Track order" aria-label="Track order">${ICON.box}</a>
          <a href="/cart.html" class="icon-btn" title="Bag" aria-label="Shopping bag">${ICON.bag}<span class="cart-count">0</span></a>
          <a href="https://wa.me/${WA_NUMBER}?text=Hi%20Kaasni" class="whatsapp-btn" target="_blank" rel="noopener">
            <span class="whatsapp-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="${WA_PATH}"/></svg></span>WhatsApp
          </a>
        </div>
      </div>
      <div class="header-search-bar" id="header-search-bar" hidden>
        <div class="container">${searchFormHtml('header-search-form')}</div>
      </div>
    </header>
    <div class="drawer-backdrop"></div>
    <aside class="mobile-drawer" aria-label="Menu">
      <div class="drawer-top">
        <a href="/" class="logo"><img src="/images/kaasni-logo.png" alt="Kaasni" class="brand-logo"></a>
        <button class="icon-btn drawer-close" type="button" aria-label="Close menu">${ICON.close}</button>
      </div>
      ${searchFormHtml('mobile-search-form')}
      <nav>${navLinks()}<a href="/track-order.html">Track Order</a><a href="/cart.html">My Bag</a></nav>
      <div class="drawer-links">
        <a href="https://wa.me/${WA_NUMBER}?text=Hi%20Kaasni" target="_blank" rel="noopener">Chat on WhatsApp</a>
        <a href="tel:+${WA_NUMBER}">Call us</a>
      </div>
    </aside>
    <div class="drawer-backdrop mc-backdrop"></div>
    <aside class="mini-cart" id="mini-cart" aria-label="Shopping bag"></aside>`;
  if (oldHeader) {
    oldHeader.insertAdjacentHTML('beforebegin', headerHtml);
    oldHeader.remove();
  } else {
    document.body.insertAdjacentHTML('afterbegin', headerHtml);
  }

  // ----- Footer -----
  const minimalFooter = /\/checkout\.html$/.test(location.pathname);
  const footerHtml = minimalFooter ? `
    <footer class="site-footer minimal">
      <div class="container">
        <div class="footer-min-links">
          <a href="https://wa.me/${WA_NUMBER}?text=Hi%20Kaasni" target="_blank" rel="noopener">Need help? WhatsApp us</a>
          <a href="/terms.html">Terms &amp; policies</a>
          <a href="/cart.html">Back to bag</a>
        </div>
        <div class="footer-bottom">&copy; <span id="footer-year"></span> Kaasni. All rights reserved.</div>
      </div>
    </footer>
    <a class="whatsapp-float" href="https://wa.me/${WA_NUMBER}?text=Hi%20Kaasni" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
      <svg viewBox="0 0 24 24"><path d="${WA_PATH}"/></svg>
    </a>` : `
    <footer class="site-footer">
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="footer-logo">Kaasni</div>
            <p id="footer-about">Kaasni brings thoughtfully designed Indian ethnic wear together with timeless craftsmanship and contemporary style.</p>
          </div>
          <div class="footer-col">
            <h4>Shop</h4>
            <a href="/collection.html">All Products</a>
            ${siteCategories.map((c) => `<a href="/collection.html?category=${encodeURIComponent(c.slug)}">${escapeHtml(c.name)}</a>`).join('')}
            <a href="/collection.html?sort=newest">New In</a>
            <a href="/cart.html">My Bag</a>
          </div>
          <div class="footer-col">
            <h4>Help</h4>
            <a href="/track-order.html">Track an order</a>
            <a href="mailto:hello.kaasni@gmail.com" id="footer-email">hello.kaasni@gmail.com</a>
            <a href="tel:+919831150476" id="footer-phone">+91 98311 50476</a>
            <a href="https://wa.me/${WA_NUMBER}" target="_blank" rel="noopener">WhatsApp chat</a>
          </div>
          <div class="footer-col">
            <h4>Visit &amp; Follow</h4>
            <div class="footer-address">Kaasni India<br>GST No. 19AAUFK6020G1Z3<br>34/1Q Ballygunge Circular Road<br>Kolkata 700019</div>
            <a href="#" id="footer-instagram" target="_blank" rel="noopener">Instagram</a>
            <a href="#" id="footer-facebook" target="_blank" rel="noopener">Facebook</a>
          </div>
        </div>
        <div class="footer-bottom">&copy; <span id="footer-year"></span> Kaasni. All rights reserved.</div>
      </div>
    </footer>
    <a class="whatsapp-float" href="https://wa.me/${WA_NUMBER}?text=Hi%20Kaasni" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">
      <svg viewBox="0 0 24 24"><path d="${WA_PATH}"/></svg>
    </a>`;
  const oldFooter = document.querySelector('.site-footer');
  if (oldFooter) {
    oldFooter.insertAdjacentHTML('beforebegin', footerHtml);
    oldFooter.remove();
  } else {
    document.body.insertAdjacentHTML('beforeend', footerHtml);
  }
}

function wireChrome() {
  // Search (desktop + drawer)
  ['#search-form', '#mobile-search-form', '#header-search-form'].forEach((sel) => {
    const form = document.querySelector(sel);
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = form.q.value.trim();
      if (q) window.location.href = `/collection.html?search=${encodeURIComponent(q)}`;
    });
  });

  // Phone search: icon in the header opens a search bar right under it
  const searchToggle = document.querySelector('.search-toggle');
  const searchBar = document.querySelector('#header-search-bar');
  if (searchToggle && searchBar) {
    const setSearch = (open) => {
      searchBar.hidden = !open;
      searchToggle.setAttribute('aria-expanded', String(open));
      if (open) searchBar.querySelector('input').focus();
    };
    searchToggle.addEventListener('click', () => setSearch(searchBar.hidden));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !searchBar.hidden) { setSearch(false); searchToggle.focus(); } });
  }

  // Header shadow on scroll
  const header = document.querySelector('.site-header');
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Mobile drawer
  const toggle = document.querySelector('.mobile-nav-toggle');
  const setDrawer = (open) => {
    document.body.classList.toggle('drawer-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setDrawer(true));
  document.querySelector('.drawer-close').addEventListener('click', () => setDrawer(false));
  document.querySelector('.drawer-backdrop').addEventListener('click', () => setDrawer(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setDrawer(false); });
}

async function loadSettings() {
  const yearEl = document.querySelector('#footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  try {
    const { settings } = await apiRequest('/settings');
    const aboutEl = document.querySelector('#footer-about');
    if (aboutEl && settings.footer_about) aboutEl.textContent = settings.footer_about.replace(/kaas?h?ni/gi, 'Kaasni');

    const emailEl = document.querySelector('#footer-email');
    if (emailEl && settings.contact_email) {
      emailEl.textContent = settings.contact_email;
      emailEl.href = `mailto:${settings.contact_email}`;
    }
    const phoneEl = document.querySelector('#footer-phone');
    if (phoneEl && settings.contact_phone) {
      phoneEl.textContent = settings.contact_phone;
      phoneEl.href = `tel:${settings.contact_phone.replace(/\s+/g, '')}`;
    }
    const igEl = document.querySelector('#footer-instagram');
    if (igEl) { if (settings.instagram_url) igEl.href = settings.instagram_url; else igEl.style.display = 'none'; }
    const fbEl = document.querySelector('#footer-facebook');
    if (fbEl) { if (settings.facebook_url) fbEl.href = settings.facebook_url; else fbEl.style.display = 'none'; }
  } catch (e) { /* settings are non-critical */ }
}

// Build chrome immediately (scripts sit at the end of <body>) so page scripts
// that run afterwards can find #search-form and .cart-count.
(async function initSiteChrome() {
  try {
    const result = await apiRequest('/categories');
    siteCategories = Array.isArray(result.categories)
      ? result.categories
      : [];
  } catch (error) {
    console.error('[layout] Unable to load categories:', error);
  }

  buildChrome();
  wireChrome();
  wireMiniCart();
  updateCartBadge();
  loadSettings();
  document.dispatchEvent(new CustomEvent('kaasni:chrome-ready', { detail: { categories: siteCategories } }));
})();


// ---------- Head extras (favicon, theme colour, social) ----------
(function () {
  const add = (html) => document.head.insertAdjacentHTML('beforeend', html);
  if (!document.querySelector('link[rel="icon"]')) add('<link rel="icon" type="image/svg+xml" href="/images/favicon.svg">');
  if (!document.querySelector('meta[name="theme-color"]')) add('<meta name="theme-color" content="#6E1423">');
  add('<meta property="og:site_name" content="Kaasni"><meta property="og:type" content="website"><meta property="og:title" content="' + document.title.replace(/"/g, '&quot;') + '">');
})();

// ---------- Mini cart (slide-in bag) ----------
function miniCartHtml() {
  const cart = getCart();
  if (!cart.length) {
    return `<div class="mc-head"><h3>Your bag</h3><button class="icon-btn mc-close" aria-label="Close bag">${ICON.close}</button></div>
      <div class="mc-empty"><p>Your bag is empty.</p><a class="btn" href="/collection.html">Continue shopping</a></div>`;
  }
  const lines = cart.map((i) => `
    <div class="mc-line" data-id="${escapeHtml(String(i.product_id))}" data-size="${escapeHtml(i.size || '')}">
      ${cartLink(i, `<div class="mc-thumb">${i.image ? `<img src="${escapeHtml(i.image)}" alt="">` : ''}</div>`, 'mc-thumb-link')}
      <div class="mc-info">
        <div class="mc-name">${cartLink(i, escapeHtml(i.name))}</div>
        ${i.size ? `<div class="mc-meta">Size ${escapeHtml(i.size)}</div>` : ''}
        <div class="mc-row">
          <div class="qty-control"><button data-a="dec" aria-label="Decrease">&minus;</button><span>${i.quantity}</span><button data-a="inc" aria-label="Increase">+</button></div>
          <b>${formatMoney(i.price * i.quantity)}</b>
        </div>
        <button class="remove-link" data-a="rm">Remove</button>
      </div>
    </div>`).join('');
  return `<div class="mc-head"><h3>Your bag (${cartCount()})</h3><button class="icon-btn mc-close" aria-label="Close bag">${ICON.close}</button></div>
    <div class="mc-items">${lines}</div>
    <div class="mc-foot">
      <div class="summary-row total"><span>Subtotal</span><span>${formatMoney(cartSubtotal())}</span></div>
      <p class="form-note" style="margin:0 0 14px">Final total is confirmed at checkout.</p>
      <a class="btn full" href="/checkout.html">Checkout</a>
      <a class="btn outline full" style="margin-top:10px" href="/cart.html">View bag</a>
    </div>`;
}
function renderMiniCart() { const el = document.querySelector('#mini-cart'); if (el) el.innerHTML = miniCartHtml(); }
function openMiniCart() { renderMiniCart(); document.body.classList.add('cart-open'); }
function closeMiniCart() { document.body.classList.remove('cart-open'); }
function wireMiniCart() {
  const box = document.querySelector('#mini-cart');
  if (!box) return;
  document.querySelector('.mc-backdrop').addEventListener('click', closeMiniCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMiniCart(); });
  renderMiniCart();
  box.addEventListener('click', (e) => {
    if (e.target.closest('.mc-close')) return closeMiniCart();
    const btn = e.target.closest('[data-a]'); if (!btn) return;
    const line = btn.closest('.mc-line'); const id = line.dataset.id; const size = line.dataset.size || null;
    const item = getCart().find((c) => String(c.product_id) === id && String(c.size || '') === String(size || ''));
    if (!item) return;
    if (btn.dataset.a === 'inc') updateCartQuantity(id, item.quantity + 1, size);
    if (btn.dataset.a === 'dec') updateCartQuantity(id, item.quantity - 1, size);
    if (btn.dataset.a === 'rm') removeFromCart(id, size);
    renderMiniCart();
  });
  if (!/\/(cart|checkout)\.html$/.test(location.pathname)) {
    document.querySelectorAll('.site-header a[href="/cart.html"]').forEach((a) =>
      a.addEventListener('click', (e) => { e.preventDefault(); openMiniCart(); }));
  }
}

// ---------- Scroll reveal ----------
(function reveal() {
  const targets = document.querySelectorAll('.section-head, .trust-item, .story-inner, .step, .faq-item, .filters-bar');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { threshold: 0.12 });
  targets.forEach((t) => { t.classList.add('reveal'); io.observe(t); });
})();




