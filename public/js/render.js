// public/js/render.js
// Shared rendering helpers used on the home, collection, and search pages.

function renderProductCard(product) {
  const imgs = (product.images || [])
    .map((i) => i.image_url || i.image_path)
    .filter(Boolean);

  const imageHtml = imgs.length
    ? `<img src="${escapeHtml(imgs[0])}" alt="${escapeHtml(product.name)}" loading="lazy">` +
      (imgs[1] ? `<img class="alt" src="${escapeHtml(imgs[1])}" alt="" loading="lazy" aria-hidden="true">` : '')
    : `<div class="product-placeholder"><span class="mono">Kaasni</span></div>`;

  const outOfStock = product.stock <= 0;
  const lowStock = product.stock > 0 && product.stock <= 3;
  const onSale = product.compare_at_price && product.compare_at_price > product.price;

  const badge = outOfStock
    ? '<span class="badge low">Sold out</span>'
    : (lowStock ? '<span class="badge low">Only a few left</span>' : '');
  const saleBadge = onSale && !outOfStock
    ? `<span class="badge sale">${Math.round((1 - product.price / product.compare_at_price) * 100)}% off</span>`
    : '';

  const comparePrice = onSale
    ? `<span class="compare">${formatMoney(product.compare_at_price)}</span>`
    : '';

  return `
    <a class="product-card${outOfStock ? ' sold-out' : ''}" href="/product.html?slug=${encodeURIComponent(product.slug)}">
      <div class="product-image">
        ${imageHtml}
        ${badge}${saleBadge}
        ${outOfStock ? '' : '<span class="quick">View details</span>'}
      </div>
      <div class="name">${escapeHtml(product.name)}</div>
      <div class="fabric">${escapeHtml([product.category && product.category.name, product.fabric].filter(Boolean).join(' · '))}</div>
      <div class="price">${formatMoney(product.price)}${comparePrice}</div>
    </a>
  `;
}

function renderProductGrid(container, products) {
  if (!container) return;
  if (!products || products.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:60px 20px">
      <h2>Nothing here yet</h2><p>Try a different search, or browse everything.</p>
      <a href="/collection.html" class="btn">View all products</a></div>`;
    return;
  }
  container.innerHTML = products.map(renderProductCard).join('');
}
