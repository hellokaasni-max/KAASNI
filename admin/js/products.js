// admin/js/products.js

if (requireAdminSession()) {
  init();
}

let categories = [];
let currentProductId = null;

async function init() {
  await loadCategories();
  await loadProducts();

  qs('#search-input').addEventListener(
    'input',
    debounce(loadProducts, 300)
  );

  qs('#category-filter').addEventListener(
    'change',
    loadProducts
  );

  qs('#new-product-btn').addEventListener(
    'click',
    openNewProductDrawer
  );

  qs('#drawer-close').addEventListener(
    'click',
    closeDrawer
  );

  qs('#product-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'product-overlay') {
      closeDrawer();
    }
  });

  qs('#product-form').addEventListener(
    'submit',
    saveProduct
  );

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeDrawer();
  });

  qs('#delete-product-btn').addEventListener(
    'click',
    deleteProduct
  );

  qs('#image-upload-input').addEventListener(
    'change',
    uploadImages
  );
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

async function loadCategories() {
  const { categories: cats } =
    await adminRequest('/categories');

  categories = cats;

  const filterSelect =
    qs('#category-filter');

  const formSelect =
    qs('#p-category');

  const options = cats
    .map(
      (c) =>
        `<option value="${escapeHtml(c.slug)}">
          ${escapeHtml(c.name)}
        </option>`
    )
    .join('');

  filterSelect.innerHTML =
    '<option value="">All categories</option>' +
    options;

  formSelect.innerHTML =
    '<option value="">Uncategorised</option>' +
    cats
      .map(
        (c) =>
          `<option value="${c.id}">
            ${escapeHtml(c.name)}
          </option>`
      )
      .join('');
}

async function loadProducts() {
  const search =
    qs('#search-input').value.trim();

  const category =
    qs('#category-filter').value;

  const params =
    new URLSearchParams();

  if (search) {
    params.set('search', search);
  }

  if (category) {
    params.set('category', category);
  }

  const body =
    qs('#products-body');

  try {
    const { products } =
      await adminRequest(
        `/admin/products?${params.toString()}`
      );

    if (products.length === 0) {
      body.innerHTML =
        '<tr><td colspan="8" class="table-empty">No products found.</td></tr>';

      return;
    }

    body.innerHTML = products
      .map(
        (p) => `
          <tr>
            <td>
              ${
                p.images[0]
                  ? `<img
                      class="table-thumb"
                      src="${escapeHtml(
                        p.images[0].image_url
                      )}"
                    >`
                  : '<div class="table-thumb"></div>'
              }
            </td>

            <td>
              ${escapeHtml(p.name)}
            </td>

            <td>
              ${
                escapeHtml(
                  p.category
                    ? p.category.name
                    : '—'
                )
              }
            </td>

            <td>
              ${formatMoney(p.price)}
            </td>

            <td>
              ${p.stock}
            </td>

            <td>
              ${
                p.is_featured
                  ? 'Yes'
                  : '—'
              }
            </td>

            <td>
              <span
                class="pill ${
                  p.is_active
                    ? 'active-yes'
                    : 'active-no'
                }"
              >
                ${
                  p.is_active
                    ? 'Active'
                    : 'Hidden'
                }
              </span>
            </td>

            <td>
              <button
                class="icon-btn-mini"
                data-id="${p.id}"
                onclick="openEditProductDrawer(${p.id})"
              >
                Edit
              </button>
            </td>
          </tr>
        `
      )
      .join('');

  } catch (e) {
    body.innerHTML = `
      <tr>
        <td colspan="8" class="table-empty">
          ${escapeHtml(e.message)}
        </td>
      </tr>
    `;
  }
}

function resetForm() {
  qs('#product-form').reset();

  qs('#product-id').value = '';

  qs('#p-active').checked = true;

  // Reset all size checkboxes
  document
    .querySelectorAll('.product-size')
    .forEach((checkbox) => {
      checkbox.checked = false;
    });

  qs('#image-grid').innerHTML = '';

  qs('#product-error').style.display = 'none';
}

function openNewProductDrawer() {
  currentProductId = null;

  resetForm();

  qs('#drawer-title').textContent =
    'Add product';

  qs('#delete-product-btn').style.display =
    'none';

  qs('#image-section').style.display =
    'none';

  qs('#image-hint').style.display =
    'block';

  // Default new products to the first category so they never end up
  // uncategorised (and therefore missing from the storefront menus).
  if (categories.length && !qs('#p-category').value) {
    qs('#p-category').value = categories[0].id;
  }

  qs('#product-overlay')
    .classList
    .add('open');
}

async function openEditProductDrawer(id) {
  resetForm();

  try {
    const { product } =
      await adminRequest(
        `/admin/products/${id}`
      );

    currentProductId = id;

    qs('#drawer-title').textContent =
      'Edit product';

    qs('#product-id').value = id;

    qs('#p-name').value =
      product.name;

    qs('#p-category').value =
      product.category_id || '';

    qs('#p-colour').value =
      product.colour || '';

    qs('#p-price').value =
      product.price;

    qs('#p-compare').value =
      product.compare_at_price || '';

    qs('#p-fabric').value =
      product.fabric || '';

    qs('#p-stock').value =
      product.stock;

    // Load saved sizes
    document
      .querySelectorAll('.product-size')
      .forEach((checkbox) => {
        checkbox.checked =
          Array.isArray(product.sizes) &&
          product.sizes.includes(
            checkbox.value
          );
      });

    qs('#p-dimensions').value =
      product.dimensions || '';

    qs('#p-description').value =
      product.description || '';

    qs('#p-care').value =
      product.care_instructions || '';

    qs('#p-featured').checked =
      !!product.is_featured;

    qs('#p-active').checked =
      !!product.is_active;

    qs('#delete-product-btn').style.display =
      'inline-flex';

    qs('#image-section').style.display =
      'block';

    qs('#image-hint').style.display =
      'none';

    renderImageGrid(product.images);

    qs('#product-overlay')
      .classList
      .add('open');

  } catch (e) {
    alert(e.message);
  }
}

function renderImageGrid(images) {
  const grid =
    qs('#image-grid');

  if (!images || images.length === 0) {
    grid.innerHTML =
      '<p class="muted" style="font-size:12px;">No photos yet.</p>';

    return;
  }

  grid.innerHTML = images
    .map(
      (img) => `
        <div class="image-thumb">
          <img
            src="${escapeHtml(
              img.image_url
            )}"
          >

          <button
            type="button"
            onclick="deleteImage(${img.id})"
          >
            &times;
          </button>
        </div>
      `
    )
    .join('');
}

function closeDrawer() {
  qs('#product-overlay')
    .classList
    .remove('open');
}

async function saveProduct(e) {
  e.preventDefault();

  const errorEl =
    qs('#product-error');

  errorEl.style.display =
    'none';

  // Collect selected sizes
  const sizes = Array
    .from(
      document.querySelectorAll(
        '.product-size:checked'
      )
    )
    .map(
      (checkbox) =>
        checkbox.value
    );

  const payload = {
    name:
      qs('#p-name').value.trim(),

    category_id:
      qs('#p-category').value || null,

    colour:
      qs('#p-colour').value.trim(),

    price:
      qs('#p-price').value,

    compare_at_price:
      qs('#p-compare').value || null,

    fabric:
      qs('#p-fabric').value.trim(),

    stock:
      qs('#p-stock').value,

    sizes,

    dimensions:
      qs('#p-dimensions').value.trim(),

    description:
      qs('#p-description').value.trim(),

    care_instructions:
      qs('#p-care').value.trim(),

    is_featured:
      qs('#p-featured').checked,

    is_active:
      qs('#p-active').checked,
  };

  const saveBtn = qs('#product-form button[type="submit"]');
  if (saveBtn.disabled) return; // ignore double-clicks
  saveBtn.disabled = true;

  try {
    if (currentProductId) {
      await adminRequest(
        `/admin/products/${currentProductId}`,
        {
          method: 'PUT',
          body: payload,
        }
      );

      // Updating an existing product is finished: close and confirm.
      closeDrawer();
      showAdminToast('Product updated');
      await loadProducts();
      return;

    } else {
      const result =
        await adminRequest(
          '/admin/products',
          {
            method: 'POST',
            body: payload,
          }
        );

      currentProductId =
        result.id;

      qs('#product-id').value =
        result.id;

      qs('#drawer-title').textContent =
        'Edit product';

      qs('#delete-product-btn')
        .style
        .display = 'inline-flex';

      qs('#image-section')
        .style
        .display = 'block';

      qs('#image-hint')
        .style
        .display = 'none';

      renderImageGrid([]);

      // A new product stays open on purpose: photos can only be
      // uploaded once the product exists.
      showAdminToast('Product created. Add photos below, then close.');
    }

    await loadProducts();

  } catch (e) {
    errorEl.textContent =
      e.message;

    errorEl.style.display =
      'block';
  } finally {
    saveBtn.disabled = false;
  }
}

async function deleteProduct() {
  if (!currentProductId) {
    return;
  }

  if (
    !confirm(
      'Delete this product? This cannot be undone.'
    )
  ) {
    return;
  }

  try {
    await adminRequest(
      `/admin/products/${currentProductId}`,
      {
        method: 'DELETE',
      }
    );

    closeDrawer();

    await loadProducts();

  } catch (e) {
    alert(e.message);
  }
}

async function uploadImages(e) {
  const files =
    Array.from(
      e.target.files || []
    );

  if (
    files.length === 0 ||
    !currentProductId
  ) {
    return;
  }

  const formData =
    new FormData();

  files.forEach((f) => {
    formData.append(
      'images',
      f
    );
  });

  try {
    await adminRequest(
      `/admin/products/${currentProductId}/images`,
      {
        method: 'POST',
        body: formData,
        isMultipart: true,
      }
    );

    const { product } =
      await adminRequest(
        `/admin/products/${currentProductId}`
      );

    renderImageGrid(
      product.images
    );

    await loadProducts();

  } catch (e) {
    alert(e.message);
  }

  e.target.value = '';
}

async function deleteImage(imageId) {
  if (!currentProductId) {
    return;
  }

  if (
    !confirm(
      'Remove this photo?'
    )
  ) {
    return;
  }

  try {
    await adminRequest(
      `/admin/products/${currentProductId}/images/${imageId}`,
      {
        method: 'DELETE',
      }
    );

    const { product } =
      await adminRequest(
        `/admin/products/${currentProductId}`
      );

    renderImageGrid(
      product.images
    );

    await loadProducts();

  } catch (e) {
    alert(e.message);
  }
}