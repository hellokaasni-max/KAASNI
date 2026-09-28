// public/js/main.js
// Kaasni homepage

let heroBanners = [];
let heroIndex = 0;
let heroTimer = null;

async function loadHero() {
  try {
    const { banners } = await apiRequest('/banners');

   heroBanners = (banners || [])
  .filter((banner) =>
    String(banner.position || '').toLowerCase() === 'hero' &&
    (
      banner.is_active === true ||
      banner.is_active === 'true' ||
      banner.is_active === 1 ||
      banner.is_active === '1'
    )
  )
  .sort(
    (a, b) =>
      Number(a.sort_order || 0) -
      Number(b.sort_order || 0)
  )
  .slice(0, 4);

    if (!heroBanners.length) {
      return;
    }

    renderHeroSlides();
    renderHeroDots();
    showHeroSlide(0);

    document.querySelector('#hero-prev')?.addEventListener('click', () => {
      showHeroSlide(heroIndex - 1);
      restartHeroTimer();
    });

    document.querySelector('#hero-next')?.addEventListener('click', () => {
      showHeroSlide(heroIndex + 1);
      restartHeroTimer();
    });

    if (heroBanners.length > 1) {
      startHeroTimer();
    }
  } catch (e) {
    console.error('Could not load hero banners', e);
  }
}

function renderHeroSlides() {
  const container = document.querySelector('#hero-slides');

  if (!container) return;

  container.innerHTML = heroBanners
    .map((banner, index) => {
      const imageUrl = banner.image_path || '';

      return `
        <div
          class="hero-slide ${index === 0 ? 'active' : ''}"
          data-index="${index}"
        >
          <img
            src="${imageUrl}"
            alt="${escapeHtml(banner.title || 'Kaasni banner')}"
            style="
              width:100%;
              height:100%;
              object-fit:cover;
              object-position:center;
              display:block;
            "
            onerror="console.error('Banner image failed to load:', this.src)"
          >
        </div>
      `;
    })
    .join('');
}

function renderHeroDots() {
  const container = document.querySelector('#hero-dots');

  if (!container) return;

  if (heroBanners.length <= 1) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = heroBanners
    .map(
      (_, index) => `
        <button
          type="button"
          class="hero-dot ${index === 0 ? 'active' : ''}"
          data-index="${index}"
          aria-label="Go to banner ${index + 1}"
        ></button>
      `
    )
    .join('');

  container.querySelectorAll('.hero-dot').forEach((dot) => {
    dot.addEventListener('click', () => {
      showHeroSlide(Number(dot.dataset.index));
      restartHeroTimer();
    });
  });
}

function showHeroSlide(index) {
  if (!heroBanners.length) return;

  heroIndex =
    (index + heroBanners.length) %
    heroBanners.length;

  const banner = heroBanners[heroIndex];

  document
    .querySelectorAll('.hero-slide')
    .forEach((slide, slideIndex) => {
      slide.classList.toggle(
        'active',
        slideIndex === heroIndex
      );
    });

  document
    .querySelectorAll('.hero-dot')
    .forEach((dot, dotIndex) => {
      dot.classList.toggle(
        'active',
        dotIndex === heroIndex
      );
    });

  const title = document.querySelector('#hero-title');
  const subtitle = document.querySelector('#hero-subtitle');
  const cta = document.querySelector('#hero-cta');

  if (title) {
    title.textContent = banner.title || 'Kaasni';
  }

  if (subtitle) {
    subtitle.textContent =
      banner.subtitle ||
      'Thoughtfully designed pieces rooted in Indian craftsmanship.';
  }

  if (cta) {
    cta.textContent =
      banner.cta_text || 'Shop the Collection';

    cta.href =
      banner.cta_link ||
      '/collection.html';
  }
}

function startHeroTimer() {
  clearInterval(heroTimer);

  heroTimer = setInterval(() => {
    showHeroSlide(heroIndex + 1);
  }, 4500);
}

function restartHeroTimer() {
  if (heroBanners.length > 1) {
    startHeroTimer();
  }
}

async function loadFeatured() {
  try {
    const { products } = await apiRequest(
      '/products?featured=1&limit=4'
    );

    if (!products || !products.length) {
      const fallback = await apiRequest('/products?sort=newest&limit=4');
      renderProductGrid(document.querySelector('#featured-grid'), fallback.products);
      return;
    }

    renderProductGrid(
      document.querySelector('#featured-grid'),
      products
    );
  } catch (e) {
    document.querySelector('#featured-grid').innerHTML =
      '<p style="color:var(--error)">Could not load featured pieces.</p>';
  }
}

async function loadNewArrivals() {
  try {
    const { products } = await apiRequest(
      '/products?sort=newest&limit=8'
    );

    renderProductGrid(
      document.querySelector('#new-grid'),
      products.slice(0, 8)
    );
  } catch (e) {
    document.querySelector('#new-grid').innerHTML =
      '<p style="color:var(--error)">Could not load new arrivals.</p>';
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

loadHero();
loadFeatured();
loadNewArrivals();



// Shop-by-category tiles, driven by /api/categories.
(async function categoryTiles() {
  try {
    const { categories } = await apiRequest('/categories');
    if (!categories || !categories.length) return;
    const tiles = document.querySelector('#category-tiles');
    tiles.innerHTML = categories.map((c) => `
      <a class="category-tile" href="/collection.html?category=${encodeURIComponent(c.slug)}">
        <span class="category-tile-name">${escapeHtml(c.name)}</span>
        ${c.description ? `<span class="category-tile-desc">${escapeHtml(c.description)}</span>` : ''}
        <span class="category-tile-cta">Shop ${escapeHtml(c.name)} &rarr;</span>
      </a>`).join('');
    document.querySelector('#category-section').hidden = false;
  } catch (e) { /* optional section */ }
})();
