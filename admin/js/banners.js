// admin/js/banners.js

if (requireAdminSession()) {
  init();
}

let currentBannerId = null;
let pendingImageFile = null;

function init() {
  loadBanners();

  qs('#add-hero-btn').addEventListener('click', async () => {
    try {
      const { banners } = await adminRequest('/banners/all');

      const heroCount = banners.filter(
        (b) => String(b.position) === 'hero'
      ).length;

      if (heroCount >= 4) {
        alert('You can have a maximum of 4 hero slides.');
        return;
      }

      openBannerDrawer(null, 'hero');
    } catch (e) {
      alert(e.message);
    }
  });

  qs('#banner-drawer-close').addEventListener(
    'click',
    closeDrawer
  );

  qs('#banner-cancel-btn')?.addEventListener(
    'click',
    closeDrawer
  );

  qs('#banner-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'banner-overlay') {
      closeDrawer();
    }
  });

  qs('#banner-form').addEventListener(
    'submit',
    saveBanner
  );

  qs('#delete-banner-btn').addEventListener(
    'click',
    deleteBanner
  );

  qs('#b-image-input').addEventListener('change', (e) => {
    pendingImageFile = e.target.files[0] || null;

    if (pendingImageFile) {
      qs('#b-preview').src =
        URL.createObjectURL(pendingImageFile);

      qs('#b-preview').style.display = 'block';
    }
  });
}

async function loadBanners() {
  try {
    const { banners } =
      await adminRequest('/banners/all');

    const heroes = banners
      .filter(
        (b) => String(b.position) === 'hero'
      )
      .sort(
        (a, b) =>
          Number(a.sort_order || 0) -
          Number(b.sort_order || 0)
      );

    qs('#hero-card-body').innerHTML =
      heroes.length
        ? `
        <div class="banner-grid">
          ${heroes
            .map(
              (hero, index) => `
            <div class="banner-card">

              <img
                src="${hero.image_path || ''}"
                class="banner-preview"
                alt="Hero banner ${index + 1}"
              >

              <div class="banner-card-body">

                <div class="banner-card-top">
                  <strong>
                    ${escapeHtml(
                      hero.title ||
                        `Hero ${index + 1}`
                    )}
                  </strong>

                  <span class="pill ${
                    hero.is_active
                      ? 'active-yes'
                      : 'active-no'
                  }">
                    ${
                      hero.is_active
                        ? 'Active'
                        : 'Hidden'
                    }
                  </span>
                </div>

                <p class="muted banner-subtitle">
                  ${escapeHtml(
                    hero.subtitle || ''
                  )}
                </p>

                <div class="banner-card-footer">
                  <span class="muted">
                    Slide ${index + 1}
                  </span>

                  <button
                    class="btn small outline"
                    onclick='openBannerDrawer("${String(
                      hero.id
                    )}", "hero")'
                  >
                    Edit
                  </button>
                </div>

              </div>
            </div>
          `
            )
            .join('')}
        </div>
      `
        : `
        <p class="muted">
          No hero banners yet.
        </p>

        <button
          class="btn small"
          onclick='openBannerDrawer(null, "hero")'
        >
          Create hero banner
        </button>
      `;
  } catch (e) {
    qs('#hero-card-body').innerHTML = `
      <p class="form-error">
        ${escapeHtml(e.message)}
      </p>
    `;
  }
}

async function openBannerDrawer(id, position) {
  currentBannerId = id;
  pendingImageFile = null;

  qs('#banner-form').reset();
  qs('#banner-error').style.display = 'none';
  qs('#b-preview').style.display = 'none';
  qs('#b-preview').src = '';
  qs('#b-position').value = position;

  /*
   * This field existed for the old promo UI.
   * Keep it hidden/available so the existing form
   * structure continues to work safely.
   */
  if (qs('#b-promo-only')) {
    qs('#b-promo-only').style.display = 'flex';
  }

  qs('#delete-banner-btn').style.display =
    id && position === 'hero'
      ? 'inline-flex'
      : 'none';

  qs('#banner-drawer-title').textContent =
    'Edit hero banner';

  if (id) {
    try {
      const { banners } =
        await adminRequest('/banners/all');

      const banner = banners.find(
        (b) =>
          String(b.id) === String(id)
      );

      if (banner) {
        qs('#b-id').value = banner.id;
        qs('#b-position').value =
          banner.position || position;

        qs('#b-title').value =
          banner.title || '';

        qs('#b-subtitle').value =
          banner.subtitle || '';

        qs('#b-cta-text').value =
          banner.cta_text || '';

        qs('#b-cta-link').value =
          banner.cta_link || '';

        qs('#b-sort').value =
          Number(banner.sort_order || 0);

        qs('#b-active').checked =
          !!banner.is_active;

        if (banner.image_path) {
          qs('#b-preview').src =
            banner.image_path;

          qs('#b-preview').style.display =
            'block';
        }
      }
    } catch (e) {
      qs('#banner-error').textContent =
        e.message;

      qs('#banner-error').style.display =
        'block';
    }
  } else {
    qs('#b-id').value = '';
    qs('#b-active').checked = true;
    qs('#b-sort').value = 0;
  }

  qs('#banner-overlay').classList.add('open');
}

function closeDrawer() {
  qs('#banner-overlay').classList.remove(
    'open'
  );

  pendingImageFile = null;
}

async function saveBanner(e) {
  e.preventDefault();

  const errorEl = qs('#banner-error');
  errorEl.style.display = 'none';

  const payload = {
    position: qs('#b-position').value,
    title: qs('#b-title').value.trim(),
    subtitle: qs('#b-subtitle').value.trim(),
    cta_text: qs('#b-cta-text').value.trim(),
    cta_link: qs('#b-cta-link').value.trim(),
    sort_order:
      qs('#b-sort').value || 0,
    is_active:
      qs('#b-active').checked
  };

  try {
    let id = qs('#b-id').value;

    if (id) {
      await adminRequest(`/banners/${id}`, {
        method: 'PUT',
        body: payload
      });
    } else {
      const result =
        await adminRequest('/banners', {
          method: 'POST',
          body: payload
        });

      id = result.id;
    }

    if (pendingImageFile) {
      const formData = new FormData();

      formData.append(
        'image',
        pendingImageFile
      );

      await adminRequest(
        `/banners/${id}/image`,
        {
          method: 'POST',
          body: formData,
          isMultipart: true
        }
      );
    }

    closeDrawer();
    await loadBanners();
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.style.display = 'block';
  }
}

async function deleteBanner() {
  const id = qs('#b-id').value;

  if (!id) return;

  if (
    !confirm(
      'Delete this hero banner?'
    )
  ) {
    return;
  }

  try {
    await adminRequest(`/banners/${id}`, {
      method: 'DELETE'
    });

    closeDrawer();
    await loadBanners();
  } catch (e) {
    alert(e.message);
  }
}