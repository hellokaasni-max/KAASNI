// src/routes/products.routes.js

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { upload, UPLOAD_DIR } = require('../middleware/upload');

const {
  uploadBuffer,
  deleteFile,
} = require('../utils/storage');

const publicRouter = express.Router();
const adminRouter = express.Router();

const ALLOWED_SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

function normalizeSizes(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((size) =>
    ALLOWED_SIZES.includes(size)
  );
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function attachImages(product) {
  const result = await db.query(
    `
      SELECT
        id,
        image_url,
        storage_key,
        alt_text,
        sort_order,
        is_primary
      FROM product_images
      WHERE product_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [product.id]
  );

  return {
    ...product,
    images: result.rows,
  };
}

async function attachCategory(product) {
  if (!product.category_id) {
    return {
      ...product,
      category: null,
    };
  }

  const result = await db.query(
    `
      SELECT id, slug, name
      FROM categories
      WHERE id = $1
    `,
    [product.category_id]
  );

  return {
    ...product,
    category: result.rows[0] || null,
  };
}

async function attachProduct(product) {
  const withCategory = await attachCategory(product);
  return attachImages(withCategory);
}

// ============================================================
// PUBLIC
// ============================================================

// GET /api/products
// ?category=kurtis&featured=1&search=silk&sort=price_asc&page=1&limit=12

publicRouter.get('/', async (req, res, next) => {
  try {
    const {
      category,
      featured,
      search,
      sort,
      page = 1,
      limit = 24,
    } = req.query;

    let sql = `
      SELECT
        p.*,
        c.id AS category_ref_id,
        c.slug AS category_slug,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.is_active = true
    `;

    const params = [];

    if (category) {
      params.push(category);
      sql += ` AND c.slug = $${params.length}`;
    }

    if (featured === '1' || featured === 'true') {
      sql += ' AND p.is_featured = true';
    }

    if (search) {
      params.push(`%${search}%`);

      const searchParam = `$${params.length}`;

      sql += `
        AND (
          p.name ILIKE ${searchParam}
          OR p.description ILIKE ${searchParam}
          OR p.fabric ILIKE ${searchParam}
        )
      `;
    }

    const sortMap = {
      price_asc: 'p.price ASC',
      price_desc: 'p.price DESC',
      newest: 'p.created_at DESC',
      name_asc: 'p.name ASC',
    };

    sql += ` ORDER BY ${sortMap[sort] || 'p.created_at DESC'}`;

    const requestedLimit = parseInt(limit, 10) || 24;
    const lim = Math.min(Math.max(requestedLimit, 1), 100);

    const requestedPage = parseInt(page, 10) || 1;
    const currentPage = Math.max(requestedPage, 1);

    const offset = (currentPage - 1) * lim;

    params.push(lim);
    sql += ` LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await db.query(sql, params);

    const products = [];

    for (const row of result.rows) {
      const product = {
        ...row,
        category: row.category_ref_id
          ? {
              id: row.category_ref_id,
              slug: row.category_slug,
              name: row.category_name,
            }
          : null,
      };

      delete product.category_ref_id;
      delete product.category_slug;
      delete product.category_name;

      products.push(await attachImages(product));
    }

    res.json({
      products,
      page: currentPage,
      limit: lim,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/products/:slug

publicRouter.get('/:slug', async (req, res, next) => {
  try {
    const result = await db.query(
      `
        SELECT *
        FROM products
        WHERE slug = $1
          AND is_active = true
      `,
      [req.params.slug]
    );

    const product = result.rows[0];

    if (!product) {
      return res.status(404).json({
        error: 'Product not found.',
      });
    }

    res.json({
      product: await attachProduct(product),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// ADMIN
// ============================================================

// GET /api/admin/products

adminRouter.get('/', requireAdmin, async (req, res, next) => {
  try {
    const {
      search,
      category,
      page = 1,
      limit = 50,
    } = req.query;

    let sql = `
      SELECT
        p.*,
        c.id AS category_ref_id,
        c.slug AS category_slug,
        c.name AS category_name
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE true
    `;

    const params = [];

    if (category) {
      params.push(category);
      sql += ` AND c.slug = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND p.name ILIKE $${params.length}`;
    }

    sql += ' ORDER BY p.created_at DESC';

    const requestedLimit = parseInt(limit, 10) || 50;
    const lim = Math.min(Math.max(requestedLimit, 1), 200);

    const requestedPage = parseInt(page, 10) || 1;
    const currentPage = Math.max(requestedPage, 1);

    const offset = (currentPage - 1) * lim;

    params.push(lim);
    sql += ` LIMIT $${params.length}`;

    params.push(offset);
    sql += ` OFFSET $${params.length}`;

    const result = await db.query(sql, params);

    const countResult = await db.query(
      'SELECT COUNT(*)::int AS total FROM products'
    );

    const products = [];

    for (const row of result.rows) {
      const product = {
        ...row,
        category: row.category_ref_id
          ? {
              id: row.category_ref_id,
              slug: row.category_slug,
              name: row.category_name,
            }
          : null,
      };

      delete product.category_ref_id;
      delete product.category_slug;
      delete product.category_name;

      products.push(await attachImages(product));
    }

    res.json({
      products,
      total: countResult.rows[0].total,
      page: currentPage,
      limit: lim,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/admin/products/:id

adminRouter.get('/:id', requireAdmin, async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.id]
    );

    const product = result.rows[0];

    if (!product) {
      return res.status(404).json({
        error: 'Product not found.',
      });
    }

    res.json({
      product: await attachProduct(product),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/admin/products

adminRouter.post('/', requireAdmin, async (req, res, next) => {
  try {
    const b = req.body || {};

    if (!b.name || b.price == null) {
      return res.status(400).json({
        error: 'Name and price are required.',
      });
    }

    const sizes = normalizeSizes(b.sizes);

    let slug = slugify(b.name);

    const clash = await db.query(
      'SELECT id FROM products WHERE slug = $1',
      [slug]
    );

    if (clash.rows.length > 0) {
      slug = `${slug}-${Date.now().toString(36)}`;
    }

    const result = await db.query(
      `
        INSERT INTO products (
          slug,
          name,
          category_id,
          price,
          compare_at_price,
          fabric,
          colour,
          dimensions,
          description,
          care_instructions,
          stock,
          sizes,
          is_featured,
          is_active
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
          $11, $12, $13, $14
        )
        RETURNING id, slug
      `,
      [
        slug,
        b.name,
        b.category_id || null,
        Number(b.price),
        b.compare_at_price != null
          ? Number(b.compare_at_price)
          : null,
        b.fabric || '',
        b.colour || '',
        b.dimensions || '',
        b.description || '',
        b.care_instructions || '',
        Number(b.stock) || 0,
        sizes,
        b.is_featured ? true : false,
        b.is_active === false ? false : true,
      ]
    );

    res.status(201).json({
      id: Number(result.rows[0].id),
      slug: result.rows[0].slug,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/admin/products/:id

adminRouter.put('/:id', requireAdmin, async (req, res, next) => {
  try {
    const existingResult = await db.query(
      'SELECT * FROM products WHERE id = $1',
      [req.params.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({
        error: 'Product not found.',
      });
    }

    const b = req.body || {};

    const sizes =
      b.sizes !== undefined
        ? normalizeSizes(b.sizes)
        : existing.sizes || [];

    await db.query(
      `
        UPDATE products SET
          name = $1,
          category_id = $2,
          price = $3,
          compare_at_price = $4,
          fabric = $5,
          colour = $6,
          dimensions = $7,
          description = $8,
          care_instructions = $9,
          stock = $10,
          sizes = $11,
          is_featured = $12,
          is_active = $13,
          updated_at = now()
        WHERE id = $14
      `,
      [
        b.name ?? existing.name,

        b.category_id !== undefined
          ? (b.category_id || null)
          : existing.category_id,

        b.price != null
          ? Number(b.price)
          : existing.price,

        b.compare_at_price !== undefined
          ? (
              b.compare_at_price == null ||
              b.compare_at_price === ''
                ? null
                : Number(b.compare_at_price)
            )
          : existing.compare_at_price,

        b.fabric ?? existing.fabric,

        b.colour ?? existing.colour,

        b.dimensions ?? existing.dimensions,

        b.description ?? existing.description,

        b.care_instructions ??
          existing.care_instructions,

        b.stock != null
          ? Number(b.stock)
          : existing.stock,

        sizes,

        b.is_featured != null
          ? !!b.is_featured
          : existing.is_featured,

        b.is_active != null
          ? !!b.is_active
          : existing.is_active,

        req.params.id,
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/admin/products/:id

adminRouter.delete('/:id', requireAdmin, async (req, res, next) => {
  try {
    const imagesResult = await db.query(
      `
        SELECT storage_key
        FROM product_images
        WHERE product_id = $1
      `,
      [req.params.id]
    );

    const result = await db.query(
      'DELETE FROM products WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Product not found.',
      });
    }

    // Delete images from Supabase Storage.
    for (const image of imagesResult.rows) {
      if (image.storage_key) {
        try {
          await deleteFile(image.storage_key);
        } catch (storageError) {
          console.error(
            '[storage] Failed to delete product image:',
            storageError.message
          );
        }
      }
    }

    // Delete local legacy files if they still exist.
    for (const image of imagesResult.rows) {
      if (!image.storage_key) continue;

      const filename = path.basename(image.storage_key);
      const file = path.join(UPLOAD_DIR, filename);

      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PRODUCT IMAGE UPLOAD
// ============================================================

// Upload one or more images for a product.
// Original images are optimized with Sharp before Supabase upload.
// multipart/form-data, field name: "images"

adminRouter.post(
  '/:id/images',
  requireAdmin,
  upload.array('images', 8),
  async (req, res, next) => {
    try {
      const productResult = await db.query(
        'SELECT id, slug FROM products WHERE id = $1',
        [req.params.id]
      );

      if (productResult.rows.length === 0) {
        return res.status(404).json({
          error: 'Product not found.',
        });
      }

      const maxResult = await db.query(
        `
          SELECT COALESCE(MAX(sort_order), -1) AS max_sort
          FROM product_images
          WHERE product_id = $1
        `,
        [req.params.id]
      );

      let nextSort =
        Number(maxResult.rows[0].max_sort) + 1;

      const created = [];

      for (const file of req.files || []) {
        // Optimize the original image before uploading to Supabase.
        const optimizedBuffer = await sharp(file.buffer)
          .rotate()
          .resize({
            width: 2000,
            height: 2000,
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({
            quality: 82,
            effort: 4,
          })
          .toBuffer();

        const storagePath =
          `products/${req.params.id}/${Date.now()}-${Math.random()
            .toString(36)
            .slice(2)}.webp`;

        const uploaded = await uploadBuffer(
          optimizedBuffer,
          storagePath,
          'image/webp'
        );

        const result = await db.query(
          `
            INSERT INTO product_images (
              product_id,
              image_url,
              storage_key,
              alt_text,
              sort_order,
              is_primary
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING
              id,
              image_url,
              storage_key,
              alt_text,
              sort_order,
              is_primary
          `,
          [
            req.params.id,
            uploaded.publicUrl,
            uploaded.storagePath,
            '',
            nextSort,
            nextSort === 0,
          ]
        );

        created.push(result.rows[0]);

        nextSort += 1;
      }

      res.status(201).json({
        images: created,
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/admin/products/:id/images/:imageId

adminRouter.delete(
  '/:id/images/:imageId',
  requireAdmin,
  async (req, res, next) => {
    try {
      const result = await db.query(
        `
          SELECT *
          FROM product_images
          WHERE id = $1
            AND product_id = $2
        `,
        [req.params.imageId, req.params.id]
      );

      const image = result.rows[0];

      if (!image) {
        return res.status(404).json({
          error: 'Image not found.',
        });
      }

      await db.query(
        `
          DELETE FROM product_images
          WHERE id = $1
            AND product_id = $2
        `,
        [req.params.imageId, req.params.id]
      );

      // Delete from Supabase Storage.
      if (image.storage_key) {
        try {
          await deleteFile(image.storage_key);
        } catch (storageError) {
          console.error(
            '[storage] Failed to delete image:',
            storageError.message
          );
        }
      }

      // If the deleted image was primary,
      // promote the first remaining image.
      if (image.is_primary) {
        await db.query(
          `
            UPDATE product_images
            SET is_primary = true
            WHERE id = (
              SELECT id
              FROM product_images
              WHERE product_id = $1
              ORDER BY sort_order ASC, id ASC
              LIMIT 1
            )
          `,
          [req.params.id]
        );
      }

      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = {
  publicRouter,
  adminRouter,
};