// src/routes/auth.routes.js
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required.',
      });
    }

    const result = await db.query(
      'SELECT * FROM admin_users WHERE username = $1 LIMIT 1',
      [username]
    );

    const admin = result.rows[0];

    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({
        error: 'Incorrect username or password.',
      });
    }

    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '12h',
      }
    );

    return res.json({
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error('[auth] Login error:', error);

    return res.status(500).json({
      error: 'Unable to log in right now.',
    });
  }
});

// Current admin
router.get('/me', requireAdmin, (req, res) => {
  res.json({
    admin: req.admin,
  });
});

// Change admin password
router.post('/change-password', requireAdmin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body || {};

    if (!current_password || !new_password) {
      return res.status(400).json({
        error: 'Current and new password are required.',
      });
    }

    if (new_password.length < 8) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters.',
      });
    }

    const result = await db.query(
      'SELECT * FROM admin_users WHERE id = $1 LIMIT 1',
      [req.admin.id]
    );

    const admin = result.rows[0];

    if (
      !admin ||
      !bcrypt.compareSync(current_password, admin.password_hash)
    ) {
      return res.status(401).json({
        error: 'Current password is incorrect.',
      });
    }

    const hash = bcrypt.hashSync(new_password, 10);

    await db.query(
      'UPDATE admin_users SET password_hash = $1 WHERE id = $2',
      [hash, admin.id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('[auth] Change password error:', error);

    res.status(500).json({
      error: 'Unable to change password right now.',
    });
  }
});

module.exports = router;