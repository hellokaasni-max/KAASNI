const express = require('express');
const sharp = require('sharp');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');
const {
  uploadBuffer,
  deleteFile,
} = require('../utils/storage');

const router = express.Router();

// Public: active banners
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM banners
      WHERE is_active = true
      ORDER BY position ASC, sort_order ASC
    `);

    res.json({ banners: result.rows });
  } catch (error) {
    console.error('[banners] List error:', error);
    res.status(500).json({
      error: 'Unable to load banners.',
    });
  }
});

// Admin: all banners
router.get('/all', requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM banners
      ORDER BY position ASC, sort_order ASC
    `);

    res.json({ banners: result.rows });
  } catch (error) {
    console.error('[banners] Admin list error:', error);
    res.status(500).json({
      error: 'Unable to load banners.',
    });
  }
});

// Create banner
router.post('/', requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};

    if (!b.position) {
      return res.status(400).json({
        error: 'Banner position is required.',
      });
    }

    const result = await db.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
      `,
      [
        b.position,
        b.title || '',
        b.subtitle || '',
        b.image_path || null,
        b.cta_text || '',
        b.cta_link || '',
        Number(b.sort_order) || 0,
        b.is_active === false ? false : true,
      ]
    );

    res.status(201).json({
      id: result.rows[0].id,
    });
  } catch (error) {
    console.error('[banners] Create error:', error);
    res.status(500).json({
      error: 'Unable to create banner.',
    });
  }
});

// Update banner
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const existingResult = await db.query(
      'SELECT * FROM banners WHERE id = $1',
      [req.params.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({
        error: 'Banner not found.',
      });
    }

    const b = req.body || {};

    await db.query(
      `
      UPDATE banners
      SET position = $1,
          title = $2,
          subtitle = $3,
          cta_text = $4,
          cta_link = $5,
          sort_order = $6,
          is_active = $7
      WHERE id = $8
      `,
      [
        b.position ?? existing.position,
        b.title ?? existing.title,
        b.subtitle ?? existing.subtitle,
        b.cta_text ?? existing.cta_text,
        b.cta_link ?? existing.cta_link,
        b.sort_order != null
          ? Number(b.sort_order)
          : existing.sort_order,
        b.is_active != null
          ? Boolean(b.is_active)
          : existing.is_active,
        req.params.id,
      ]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[banners] Update error:', error);
    res.status(500).json({
      error: 'Unable to update banner.',
    });
  }
});

// Delete banner
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const existingResult = await db.query(
      'SELECT * FROM banners WHERE id = $1',
      [req.params.id]
    );

    const existing = existingResult.rows[0];

    if (!existing) {
      return res.status(404).json({
        error: 'Banner not found.',
      });
    }

    // Delete the Supabase Storage object if this banner has one.
    if (existing.image_path) {
      try {
        const url = new URL(existing.image_path);
        const marker = '/storage/v1/object/public/';

        const index = url.pathname.indexOf(marker);

        if (index !== -1) {
          const objectPath = url.pathname
            .slice(index + marker.length)
            .split('/')
            .slice(1)
            .join('/');

          if (objectPath) {
            await deleteFile(objectPath);
          }
        }
      } catch (storageError) {
        console.warn(
          '[banners] Could not remove old banner image:',
          storageError.message
        );
      }
    }

    await db.query(
      'DELETE FROM banners WHERE id = $1',
      [req.params.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[banners] Delete error:', error);
    res.status(500).json({
      error: 'Unable to delete banner.',
    });
  }
});

// Upload/replace banner image
router.post(
  '/:id/image',
  requireAdmin,
  require('../middleware/upload').upload.single('image'),
  async (req, res) => {
    try {
      const existingResult = await db.query(
        'SELECT * FROM banners WHERE id = $1',
        [req.params.id]
      );

      const existing = existingResult.rows[0];

      if (!existing) {
        return res.status(404).json({
          error: 'Banner not found.',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          error: 'No image uploaded.',
        });
      }

      // Optimize banner image before Supabase upload.
      const optimizedBuffer = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 2400,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: 82,
          effort: 4,
        })
        .toBuffer();

      const storagePath =
        `banners/${req.params.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.webp`;

      const uploaded = await uploadBuffer(
        optimizedBuffer,
        storagePath,
        'image/webp'
      );

      // Remove the previous Supabase image after the new upload succeeds.
      if (existing.image_path) {
        try {
          const oldUrl = new URL(existing.image_path);
          const marker = '/storage/v1/object/public/';
          const index = oldUrl.pathname.indexOf(marker);

          if (index !== -1) {
            const oldObjectPath = oldUrl.pathname
              .slice(index + marker.length)
              .split('/')
              .slice(1)
              .join('/');

            if (oldObjectPath) {
              await deleteFile(oldObjectPath);
            }
          }
        } catch (storageError) {
          console.warn(
            '[banners] Could not remove previous banner image:',
            storageError.message
          );
        }
      }

      await db.query(
        'UPDATE banners SET image_path = $1 WHERE id = $2',
        [uploaded.publicUrl, req.params.id]
      );

      res.json({
        image_path: uploaded.publicUrl,
      });
    } catch (error) {
      console.error('[banners] Image upload error:', error);
      res.status(500).json({
        error: error.message || 'Unable to upload banner image.',
      });
    }
  }
);

module.exports = router;
