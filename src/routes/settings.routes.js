// src/routes/settings.routes.js
const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT key, value FROM site_settings'
    );

    const settings = {};
    result.rows.forEach((row) => {
      settings[row.key] = row.value;
    });

    // Public: the storefront shows the same flat fee the order route charges.
    const fee = Number(process.env.SHIPPING_FEE || 0);
    settings.shipping_fee = Number.isFinite(fee) && fee >= 0 ? fee : 0;

    res.json({ settings });
  } catch (error) {
    console.error('[settings] List error:', error);
    res.status(500).json({
      error: 'Unable to load settings.',
    });
  }
});

router.put('/', requireAdmin, async (req, res) => {
  try {
    const updates = req.body || {};

    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        `
        INSERT INTO site_settings (key, value)
        VALUES ($1, $2)
        ON CONFLICT (key)
        DO UPDATE SET value = EXCLUDED.value
        `,
        [key, String(value ?? '')]
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('[settings] Update error:', error);
    res.status(500).json({
      error: 'Unable to update settings.',
    });
  }
});

module.exports = router;