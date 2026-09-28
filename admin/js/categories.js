// admin/js/categories.js
if (requireAdminSession()) init();

let categories = [];

function slugPreview(name) {
  return String(name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

async function init() {
  await loadCategories();
  qs('#new-category-btn').addEventListener('click', () => openDrawer());
  qs('#drawer-close').addEventListener('click', closeDrawer);
  qs('#category-overlay').addEventListener('click', (e) => { if (e.target.id === 'category-overlay') closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  qs('#category-form').addEventListener('submit', saveCategory);
  qs('#delete-category-btn').addEventListener('click', deleteCategory);
  qs('#c-name').addEventListener('input', () => {
    const slug = slugPreview(qs('#c-name').value);
    qs('#c-slug-hint').textContent = slug ? `Link: /collection.html?category=${slug}` : '';
  });
  qs('#categories-body').addEventListener('click', (e) => {
    const row = e.target.closest('tr[data-id]');
    if (row) openDrawer(categories.find((c) => String(c.id) === row.dataset.id));
  });
}

async function loadCategories() {
  const body = qs('#categories-body');
  try {
    const data = await adminRequest('/categories');
    categories = data.categories || [];
    if (!categories.length) {
      body.innerHTML = '<tr><td colspan="5" class="table-empty">No categories yet. Add your first one.</td></tr>';
      return;
    }
    body.innerHTML = categories.map((c) => `
      <tr data-id="${c.id}" style="cursor:pointer;">
        <td>${Number(c.sort_order) || 0}</td>
        <td><b>${escapeHtml(c.name)}</b>${c.description ? `<div class="muted" style="font-size:12px;">${escapeHtml(c.description)}</div>` : ''}</td>
        <td><a href="/collection.html?category=${encodeURIComponent(c.slug)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">/collection.html?category=${escapeHtml(c.slug)}</a></td>
        <td>${c.product_count} <span class="muted">(${c.active_product_count} live)</span></td>
        <td><button class="btn small outline" type="button">Edit</button></td>
      </tr>`).join('');
  } catch (e) {
    body.innerHTML = `<tr><td colspan="5" class="table-empty">${escapeHtml(e.message)}</td></tr>`;
  }
}

function showError(msg) {
  const el = qs('#category-error');
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function openDrawer(cat) {
  showError('');
  qs('#drawer-title').textContent = cat ? 'Edit category' : 'Add category';
  qs('#category-id').value = cat ? cat.id : '';
  qs('#c-name').value = cat ? cat.name : '';
  qs('#c-description').value = cat ? (cat.description || '') : '';
  qs('#c-sort').value = cat ? cat.sort_order : categories.length;
  qs('#delete-category-btn').style.display = cat ? '' : 'none';
  qs('#c-slug-hint').textContent = cat ? `Link: /collection.html?category=${cat.slug}` : '';
  qs('#category-overlay').classList.add('open');
  qs('#c-name').focus();
}

function closeDrawer() { qs('#category-overlay').classList.remove('open'); }

async function saveCategory(e) {
  e.preventDefault();
  showError('');
  const id = qs('#category-id').value;
  const payload = {
    name: qs('#c-name').value.trim(),
    description: qs('#c-description').value.trim(),
    sort_order: Number(qs('#c-sort').value) || 0,
  };
  if (!payload.name) return showError('Please enter a category name.');

  if (id) {
    const existing = categories.find((c) => String(c.id) === String(id));
    if (existing && slugPreview(payload.name) !== existing.slug &&
        !confirm('Renaming changes this category\'s link. Any banner or menu link pointing to the old link will need updating. Continue?')) return;
  }

  const btn = qs('#save-category-btn');
  btn.disabled = true;
  try {
    await adminRequest(id ? `/categories/${id}` : '/categories', { method: id ? 'PUT' : 'POST', body: payload });
    closeDrawer();
    await loadCategories();
  } catch (err) {
    showError(err.message);
  } finally {
    btn.disabled = false;
  }
}

async function deleteCategory() {
  const id = qs('#category-id').value;
  if (!id || !confirm('Delete this category? This cannot be undone.')) return;
  try {
    await adminRequest(`/categories/${id}`, { method: 'DELETE' });
    closeDrawer();
    await loadCategories();
  } catch (err) {
    showError(err.message);
  }
}
