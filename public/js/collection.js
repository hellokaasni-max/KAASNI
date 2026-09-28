// public/js/collection.js
// Category names, pills and headings all come from /api/categories so the
// storefront always matches what the admin has set up.

let allProducts = [];
let categories = [];
const quick = { inStock: false, onSale: false };

function currentParams() {
  return {
    category: getQueryParam('category') || '',
    search: getQueryParam('search') || '',
    sort: getQueryParam('sort') || 'newest',
    featured: getQueryParam('featured') || '',
  };
}

function categoryBySlug(slug) {
  return categories.find((c) => c.slug === slug) || null;
}

function collectionUrl(params, overrides = {}) {
  const merged = { ...params, ...overrides };
  const qp = new URLSearchParams();
  if (merged.category) qp.set('category', merged.category);
  if (merged.search) qp.set('search', merged.search);
  if (merged.sort && merged.sort !== 'newest') qp.set('sort', merged.sort);
  const q = qp.toString();
  return '/collection.html' + (q ? '?' + q : '');
}

function applyHeading(params) {
  const h = document.querySelector('#collection-heading');
  const t = document.querySelector('#page-title');
  const sub = document.querySelector('#collection-sub');
  const cat = categoryBySlug(params.category);

  if (params.search) {
    h.textContent = `Results for "${params.search}"`;
    t.textContent = `Search: ${params.search} — Kaasni`;
    if (sub) sub.textContent = cat ? `In ${cat.name}` : '';
  } else if (params.category) {
    const name = cat ? cat.name : params.category.replace(/-/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
    h.textContent = name;
    t.textContent = `${name} — Kaasni`;
    if (sub) sub.textContent = (cat && cat.description) || '';
  } else if (params.featured) {
    h.textContent = 'Featured Pieces';
    t.textContent = 'Featured Pieces — Kaasni';
    if (sub) sub.textContent = 'Hand-picked by our team.';
  } else {
    h.textContent = 'All Products';
    t.textContent = 'All Products — Kaasni';
    if (sub) sub.textContent = '';
  }
}

function renderPills(params) {
  const wrap = document.querySelector('#filter-pills');
  if (!wrap) return;
  const pill = (slug, label) =>
    `<a class="filter-pill ${params.category === slug ? 'active' : ''}" data-category="${escapeHtml(slug)}"
        href="${collectionUrl(params, { category: slug })}" ${params.category === slug ? 'aria-current="page"' : ''}>${escapeHtml(label)}</a>`;
  wrap.innerHTML = pill('', 'All Products') + categories.map((c) => pill(c.slug, c.name)).join('');
}

function renderFiltered() {
  const grid = document.querySelector('#collection-grid');
  let list = allProducts.slice();
  if (quick.inStock) list = list.filter((p) => p.stock > 0);
  if (quick.onSale) list = list.filter((p) => p.compare_at_price && p.compare_at_price > p.price);
  renderProductGrid(grid, list);
  const c = document.querySelector('#results-count');
  if (c) c.textContent = `${list.length} ${list.length === 1 ? 'piece' : 'pieces'}`;
}

function buildQuickFilters() {
  const bar = document.querySelector('.filters-bar');
  if (!bar || document.querySelector('#quick-filters')) return;
  const wrap = document.createElement('div');
  wrap.id = 'quick-filters';
  wrap.className = 'quick-filters';
  wrap.innerHTML = `<span id="results-count" class="results-count" aria-live="polite"></span>
    <button type="button" class="chip" data-k="inStock" aria-pressed="false">In stock</button>
    <button type="button" class="chip" data-k="onSale" aria-pressed="false">On sale</button>`;
  bar.querySelector('#sort-select').before(wrap);
  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    quick[b.dataset.k] = !quick[b.dataset.k];
    b.classList.toggle('active', quick[b.dataset.k]);
    b.setAttribute('aria-pressed', String(quick[b.dataset.k]));
    renderFiltered();
  });
}

async function loadCollection() {
  const params = currentParams();
  buildQuickFilters();
  document.querySelector('#sort-select').value = params.sort;

  try {
    const res = await apiRequest('/categories');
    categories = Array.isArray(res.categories) ? res.categories : [];
  } catch (e) {
    categories = [];
  }
  applyHeading(params);
  renderPills(params);

  const search = new URLSearchParams();
  if (params.category) search.set('category', params.category);
  if (params.search) search.set('search', params.search);
  if (params.sort) search.set('sort', params.sort);
  if (params.featured) search.set('featured', '1');
  search.set('limit', '48');

  const grid = document.querySelector('#collection-grid');
  try {
    const { products } = await apiRequest(`/products?${search.toString()}`);
    allProducts = products || [];
    renderFiltered();
  } catch (e) {
    grid.innerHTML = `<p style="color:var(--error);grid-column:1/-1;">${escapeHtml(e.message)}</p>`;
  }
}

document.querySelector('#sort-select').addEventListener('change', (e) => {
  const url = new URL(window.location.href);
  url.searchParams.set('sort', e.target.value);
  window.location.href = url.toString();
});

loadCollection();
