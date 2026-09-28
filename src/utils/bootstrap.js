// src/utils/bootstrap.js
// PostgreSQL bootstrap for Kaasni.
// Safe to run every time the server starts.

const bcrypt = require('bcryptjs');
const db = require('../db');

// Brings older databases in line with what the code expects. Every statement is
// idempotent, so it is safe on every start.
async function ensureSchema() {
  const statements = [
    'ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[] NOT NULL DEFAULT \'{}\'',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS image_url TEXT',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS storage_key TEXT',
    'ALTER TABLE product_images ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE',
    'ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size TEXT',
    // Stops the same Razorpay payment from creating two orders if the
    // browser retries after a slow response.
    'ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_razorpay_payment_id ON orders(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL',
  ];

  for (const sql of statements) {
    try {
      await db.query(sql);
    } catch (error) {
      console.warn('[bootstrap] Schema sync skipped:', sql, '-', error.message);
    }
  }
}

async function ensureAdminUser() {
  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM admin_users'
  );

  if (result.rows[0].count > 0) return;

  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'Kaasni Admin';

  if (!password) {
    throw new Error('ADMIN_PASSWORD is not configured.');
  }

  const hash = bcrypt.hashSync(password, 10);

  await db.query(
    `
      INSERT INTO admin_users (
        username,
        password_hash,
        name
      )
      VALUES ($1, $2, $3)
    `,
    [username, hash, name]
  );

  console.log(
    `[bootstrap] Created default admin user "${username}". Change this password after first login.`
  );
}

const defaultCategories = [
  {
    slug: 'kurtis',
    name: 'Kurtis',
    description:
      'Elegant women’s kurtis crafted for everyday and occasion wear.',
    image_url: '',
    sort_order: 0,
  },
];

async function ensureCategories() {
  for (let i = 0; i < defaultCategories.length; i++) {
    const cat = defaultCategories[i];

    const existing = await db.query(
      'SELECT id FROM categories WHERE slug = $1',
      [cat.slug]
    );

    if (existing.rows.length > 0) continue;

    await db.query(
      `
        INSERT INTO categories (
          slug,
          name,
          description,
          sort_order
        )
        VALUES ($1, $2, $3, $4)
      `,
      [
        cat.slug,
        cat.name,
        cat.description,
        i,
      ]
    );
  }
}

async function ensureBanners() {
  const result = await db.query(
    'SELECT COUNT(*)::int AS count FROM banners'
  );

  if (result.rows[0].count > 0) return;

  const banners = [
    [
      'hero',
      'Kaasni',
      'Elegant kurtis, crafted for today',
      null,
      'Shop the Collection',
      '/collection.html',
      0,
    ],
    [
      'promo',
      'Kurtis',
      'Discover our collection of everyday and occasion kurtis',
      null,
      'Shop Kurtis',
      '/collection.html?category=kurtis',
      1,
    ],
  ];

  for (const banner of banners) {
    await db.query(
      `
        INSERT INTO banners (
          position,
          title,
          subtitle,
          image_path,
          cta_text,
          cta_link,
          sort_order,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
      `,
      banner
    );
  }
}

async function ensureSettings() {
  const defaults = {
    site_name: 'Kaasni',

    site_tagline:
      'Elegant kurtis, crafted for today',

    contact_email:
      'hello.kaasni@gmail.com',

    contact_phone:
      '+91 98311 50476',

    footer_about:
      'Kaasni brings thoughtfully designed Indian ethnic wear together with timeless craftsmanship and contemporary style.',

    instagram_url: '',

    facebook_url: '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    const existing = await db.query(
      'SELECT key FROM site_settings WHERE key = $1',
      [key]
    );

    if (existing.rows.length > 0) {
      continue;
    }

    await db.query(
      `
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
      `,
      [key, value]
    );
  }
}

async function ensureDemoProducts() {
  // Kaasni uses real catalogue products only.
  // Products are added through the admin panel.
  return;
}

async function runBootstrap() {
  await ensureSchema();
  await ensureAdminUser();
  await ensureCategories();
  await ensureBanners();
  await ensureSettings();
  await ensureDemoProducts();
}

module.exports = {
  runBootstrap,
};