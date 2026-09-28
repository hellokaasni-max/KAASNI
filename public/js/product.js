// public/js/product.js

let currentProduct = null;
let selectedSize = null;

function renderGallery(product) {
  const images = ((product.images && product.images.length > 0) ? product.images : [])
    .map((img) => img.image_url || img.image_path || null)
    .filter(Boolean);

  const slides = images.length
    ? images.map((src, i) => `
        <div class="pdp-slide" data-index="${i}">
          <img src="${escapeHtml(src)}" alt="${escapeHtml(product.name)}${images.length > 1 ? ` — photo ${i + 1} of ${images.length}` : ''}"
               ${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'} data-full="${escapeHtml(src)}">
        </div>`).join('')
    : `<div class="pdp-slide"><div class="product-placeholder" style="height:100%"><span class="mono">Kaasni</span></div></div>`;

  const many = images.length > 1;
  const thumbsHtml = many ? `
    <div class="pdp-thumbs">
      ${images.map((src, i) => `<img src="${escapeHtml(src)}" class="${i === 0 ? 'active' : ''}" data-index="${i}" alt="Show photo ${i + 1}">`).join('')}
    </div>` : '';
  const dotsHtml = many ? `
    <div class="pdp-dots" aria-hidden="true">
      ${images.map((_, i) => `<span class="${i === 0 ? 'active' : ''}"></span>`).join('')}
    </div>` : '';

  return `
    <div class="pdp-gallery-main">
      <div class="pdp-track" id="pdp-track" tabindex="0" aria-label="Product photos">${slides}</div>
      ${dotsHtml}
    </div>
    ${thumbsHtml}
  `;
}

function wireGallery() {
  const track = document.querySelector('#pdp-track');
  if (!track) return;
  const slides = qsa('.pdp-slide', track);
  const thumbs = qsa('.pdp-thumbs img');
  const dots = qsa('.pdp-dots span');

  const setActive = (i) => {
    thumbs.forEach((t, n) => t.classList.toggle('active', n === i));
    dots.forEach((d, n) => d.classList.toggle('active', n === i));
  };

  // Swiping (or scrolling) the track updates thumbnails + dots
  let raf = 0;
  track.addEventListener('scroll', () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => setActive(Math.round(track.scrollLeft / track.clientWidth)));
  }, { passive: true });

  thumbs.forEach((thumb) => thumb.addEventListener('click', () => {
    track.scrollTo({ left: Number(thumb.dataset.index) * track.clientWidth, behavior: 'smooth' });
  }));

  // Tap a photo to zoom
  track.addEventListener('click', (e) => {
    const img = e.target.closest('img[data-full]');
    if (!img) return;
    openLightbox(qsa('img[data-full]', track).map((i) => i.dataset.full), slides.indexOf(img.closest('.pdp-slide')), img.alt);
  });
}

// Full-screen viewer: swipe between photos, tap a photo to zoom in/out.
function openLightbox(srcs, start, alt) {
  let index = start;
  let zoomed = false;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Photo viewer');
  box.innerHTML = `
    <button type="button" class="lb-close" aria-label="Close photo viewer">${ICON.close}</button>
    <div class="lb-stage">${srcs.map((src) => `<div class="lb-slide"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt || '')}" draggable="false"></div>`).join('')}</div>
    ${srcs.length > 1 ? '<div class="lb-count" aria-live="polite"></div>' : ''}`;
  document.body.appendChild(box);
  document.body.classList.add('lightbox-open');

  const stage = box.querySelector('.lb-stage');
  const count = box.querySelector('.lb-count');
  const updateCount = () => { if (count) count.textContent = `${index + 1} / ${srcs.length}`; };
  stage.scrollLeft = index * stage.clientWidth;
  updateCount();

  stage.addEventListener('scroll', () => {
    const i = Math.round(stage.scrollLeft / stage.clientWidth);
    if (i !== index) { index = i; updateCount(); }
  }, { passive: true });

  const setZoom = (on, img, e) => {
    zoomed = on;
    box.classList.toggle('zoomed', on);
    if (!img) return;
    if (on && e) {
      const r = img.getBoundingClientRect();
      img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
    }
  };
  stage.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return close();          // tap the dark area to close
    setZoom(!zoomed, img, e);
  });

  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') stage.scrollBy({ left: stage.clientWidth, behavior: 'smooth' });
    if (e.key === 'ArrowLeft') stage.scrollBy({ left: -stage.clientWidth, behavior: 'smooth' });
  };
  function close() {
    document.removeEventListener('keydown', onKey);
    document.body.classList.remove('lightbox-open');
    box.remove();
  }
  box.querySelector('.lb-close').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  box.querySelector('.lb-close').focus();
}

function renderSizeSelector(product) {
  const sizes = Array.isArray(product.sizes)
    ? product.sizes
    : [];

  if (sizes.length === 0) {
    return '';
  }

  return `
    <div class="pdp-size-section">
      <div class="pdp-size-heading">
        <span>Size</span>
        <span id="selected-size-label"></span>
      </div>

      <div class="pdp-size-options">
        ${sizes.map((size) => `
          <button
            type="button"
            class="pdp-size-btn"
            data-size="${escapeHtml(size)}"
          >
            ${escapeHtml(size)}
          </button>
        `).join('')}
      </div>

      <div
        id="size-error"
        class="stock-note low"
        style="display:none;"
      >
        Please select a size.
      </div>
    </div>
  `;
}

function wireSizeSelector(product) {
  const sizeButtons = qsa('.pdp-size-btn');

  sizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedSize = button.dataset.size;

      sizeButtons.forEach((btn) =>
        btn.classList.remove('active')
      );

      button.classList.add('active');

      const label = document.querySelector('#selected-size-label');

      if (label) {
        label.textContent = selectedSize;
      }

      const error = document.querySelector('#size-error');

      if (error) {
        error.style.display = 'none';
      }
    });
  });
}

function renderPdp(product) {
  selectedSize = null;

  document.querySelector('#page-title').textContent =
    `${product.name} — Kaasni`;

  document.querySelector('#breadcrumb').innerHTML =
    `<a href="/">Home</a> / <a href="/collection.html${product.category ? '?category=' + product.category.slug : ''}">${escapeHtml(product.category ? product.category.name : 'Shop')}</a> / ${escapeHtml(product.name)}`;

  const outOfStock = product.stock <= 0;
  const lowStock =
    product.stock > 0 && product.stock <= 3;

  const comparePrice =
    product.compare_at_price &&
    product.compare_at_price > product.price
      ? `<span class="compare">${formatMoney(product.compare_at_price)}</span>`
      : '';

  const root = document.querySelector('#pdp-root');

  root.innerHTML = `
    <div class="pdp-layout">
      <div>${renderGallery(product)}</div>

      <div class="pdp-info">
        <div class="eyebrow">
          ${escapeHtml(
            product.category
              ? product.category.name
              : ''
          )}
        </div>

        <h1>${escapeHtml(product.name)}</h1>

        <div class="pdp-price">
          ${formatMoney(product.price)}
          ${comparePrice}
        </div>

        <div class="pdp-meta">
          ${
            product.fabric
              ? `<div><span>Fabric</span>${escapeHtml(product.fabric)}</div>`
              : ''
          }

          ${
            product.colour
              ? `<div><span>Colour</span>${escapeHtml(product.colour)}</div>`
              : ''
          }

          ${
            product.dimensions
              ? `<div><span>Dimensions</span>${escapeHtml(product.dimensions)}</div>`
              : ''
          }
        </div>

        ${renderSizeSelector(product)}

        <p class="pdp-desc">
          ${escapeHtml(product.description || '')}
        </p>

        <div class="qty-row">
          <div class="qty-control" id="pdp-qty">
            <button
              type="button"
              data-action="dec"
            >
              &minus;
            </button>

            <span id="pdp-qty-value">1</span>

            <button
              type="button"
              data-action="inc"
            >
              +
            </button>
          </div>

          <button
            class="btn full"
            id="pdp-add-btn"
            style="max-width:280px;"
            ${outOfStock ? 'disabled' : ''}
          >
            ${outOfStock ? 'Sold out' : 'Add to bag'}
          </button>
        </div>

        ${
          lowStock
            ? `<div class="stock-note low">
                Only ${product.stock} left in stock
              </div>`
            : ''
        }

        ${
          product.care_instructions
            ? `
            <div class="accordion-item">
              <details>
                <summary>Care instructions</summary>
                <p>
                  ${escapeHtml(product.care_instructions)}
                </p>
              </details>
            </div>
            `
            : ''
        }

        <div class="accordion-item">
          <details>
            <summary>Shipping &amp; returns</summary>
            <p>
              Orders are confirmed by our team and dispatched
              within 3–5 business days. Reach out via the contact
              details in the footer for return or exchange requests.
            </p>
          </details>
        </div>
      </div>
    </div>
  `;

  wireGallery();
  wireSizeSelector(product);

  let qty = 1;

  const qtyValueEl =
    document.querySelector('#pdp-qty-value');

  document
    .querySelector('#pdp-qty')
    .addEventListener('click', (e) => {
      const action = e.target.dataset.action;

      if (!action) return;

      if (action === 'inc') {
        qty = Math.min(
          qty + 1,
          product.stock || 99
        );
      }

      if (action === 'dec') {
        qty = Math.max(1, qty - 1);
      }

      qtyValueEl.textContent = qty;
    });

  document
    .querySelector('#pdp-add-btn')
    ?.addEventListener('click', () => {

      const sizes = Array.isArray(product.sizes)
        ? product.sizes
        : [];

      if (sizes.length > 0 && !selectedSize) {
        const error =
          document.querySelector('#size-error');

        if (error) {
          error.style.display = 'block';
        }

        // The sticky bar on phones can sit far from the size picker,
        // so bring the picker into view and draw the eye to it.
        const section = document.querySelector('.pdp-size-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'center' });
          section.classList.remove('needs-attention');
          void section.offsetWidth;
          section.classList.add('needs-attention');
        }

        return;
      }

      addToCart(
        product,
        qty,
        selectedSize
      );

      // Quiet confirmation instead of pulling the bag over the product
      const addBtn = document.querySelector('#pdp-add-btn');
      addBtn.textContent = 'Added \u2713';
      clearTimeout(addBtn._t);
      addBtn._t = setTimeout(() => { addBtn.textContent = 'Add to bag'; }, 1800);
      showToast(`${product.name} added to your bag.`, { label: 'View bag', href: '/cart.html', onClick: openMiniCart });
    });
}

async function loadProduct() {
  const slug = getQueryParam('slug');

  if (!slug) {
    document.querySelector('#pdp-root').innerHTML =
      '<p>Product not found.</p>';

    return;
  }

  try {
    const { product } =
      await apiRequest(
        `/products/${encodeURIComponent(slug)}`
      );

    currentProduct = product;

    renderPdp(product);
    enhanceProduct(product);
  } catch (e) {
    document.querySelector('#pdp-root').innerHTML = `
      <div class="empty-state">
        <h2>Product not found</h2>

        <p>${escapeHtml(e.message)}</p>

        <a
          href="/collection.html"
          class="btn"
        >
          Back to shop
        </a>
      </div>
    `;
  }
}

document
  .querySelector('#search-form')
  ?.addEventListener('submit', (e) => {
    e.preventDefault();

    const q = e.target.q.value.trim();

    window.location.href =
      `/collection.html?search=${encodeURIComponent(q)}`;
  });

loadProduct();

function enhanceProduct(product) {
  // Trust row + WhatsApp enquiry
  const row = document.querySelector('.qty-row');
  if (row) {
    row.insertAdjacentHTML('afterend', `
      <ul class="pdp-perks">
        <li>Handcrafted with Indian craftsmanship</li>
        <li>Dispatched in 3&ndash;5 business days</li>
        <li>Need help with size? <a href="https://wa.me/919831150476?text=${encodeURIComponent('Hi Kaasni, I have a question about ' + product.name)}" target="_blank" rel="noopener">Ask us on WhatsApp</a></li>
      </ul>`);
  }
  // SEO: structured data
  const img = productImageSrc(product);
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: product.name, description: product.description || '',
    brand: { '@type': 'Brand', name: 'Kaasni' }, ...(img ? { image: [img] } : {}),
    offers: { '@type': 'Offer', priceCurrency: 'INR', price: String(product.price), availability: product.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' } };
  const tag = document.createElement('script'); tag.type = 'application/ld+json'; tag.textContent = JSON.stringify(ld); document.head.appendChild(tag);
  document.head.insertAdjacentHTML('beforeend', `<meta name="description" content="${escapeHtml((product.description || product.name).slice(0, 155))}">` + (img ? `<meta property="og:image" content="${escapeHtml(img)}">` : ''));
  loadRelated(product);
}

async function loadRelated(product) {
  try {
    const { products } = await apiRequest('/products?' + (product.category ? 'category=' + encodeURIComponent(product.category.slug) + '&' : '') + 'limit=6');
    const list = products.filter((p) => p.slug !== product.slug).slice(0, 4);
    if (!list.length) return;
    const sec = document.createElement('section');
    sec.className = 'section';
    sec.innerHTML = `<div class="container"><div class="section-head"><div><span class="section-eyebrow">Complete the look</span><h2>You may also like</h2></div><a class="section-link" href="/collection.html${product.category ? '?category=' + encodeURIComponent(product.category.slug) : ''}">View all</a></div><div class="product-grid" id="related-grid"></div></div>`;
    document.querySelector('#pdp-root').after(sec);
    renderProductGrid(document.querySelector('#related-grid'), list);
  } catch (e) { /* optional section */ }
}
