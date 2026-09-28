// src/routes/categories.routes.js
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(str) {
  return String(str)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Public: list all categories
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT
          c.*,
          (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id) AS product_count,
          (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id AND p.is_active = true) AS active_product_count
        FROM categories c
        ORDER BY c.sort_order ASC, c.name ASC
      `
    );

    res.json({
      categories: result.rows,
    });
  } catch (error) {
    console.error('[categories] List error:', error);
    res.status(500).json({
      error: 'Unable to load categories.',
    });
  }
});

// Admin: create category
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { name, description, sort_order } = req.body || {};

    if (!name) {
      return res.status(400).json({
        error: 'Category name is required.',
      });
    }

    const slug = slugify(name);

    const existing = await db.query(
      'SELECT id FROM categories WHERE slug = $1 LIMIT 1',
      [slug]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'A category with this name already exists.',
      });
    }

    const result = await db.query(
      `
        INSERT INTO categories (
          slug,
          name,
          description,
          sort_order
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `,
      [
        slug,
        name,
        description || '',
        sort_order != null ? Number(sort_order) : 0,
      ]
    );

    res.status(201).json({
      id: Number(result.rows[0].id),
      slug,
    });
  } catch (error) {
    console.error('[categories] Create error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A category with this name already exists.',
      });
    }

    res.status(500).json({
      error: 'Unable to create category.',
    });
  }
});

// Admin: update category
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { name, description, sort_order } = req.body || {};

    const existingResult = await db.query(
      'SELECT * FROM categories WHERE id = $1 LIMIT 1',
      [req.params.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({
        error: 'Category not found.',
      });
    }

    const slug = name ? slugify(name) : existing.slug;

    await db.query(
      `
        UPDATE categories
        SET
          name = $1,
          slug = $2,
          description = $3,
          sort_order = $4
        WHERE id = $5
      `,
      [
        name || existing.name,
        slug,
        description ?? existing.description,
        sort_order != null
          ? Number(sort_order)
          : existing.sort_order,
        req.params.id,
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[categories] Update error:', error);

    if (error.code === '23505') {
      return res.status(409).json({
        error: 'A category with this name already exists.',
      });
    }

    res.status(500).json({
      error: 'Unable to update category.',
    });
  }
});

// Admin: delete category
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const inUseResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1',
      [req.params.id]
    );

    const inUse = inUseResult.rows[0].count;

    if (inUse > 0) {
      return res.status(409).json({
        error: `${inUse} product(s) still use this category. Reassign them first.`,
      });
    }

    const result = await db.query(
      'DELETE FROM categories WHERE id = $1',
      [req.params.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        error: 'Category not found.',
      });
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[categories] Delete error:', error);

    res.status(500).json({
      error: 'Unable to delete category.',
    });
  }
});

module.exports = router;