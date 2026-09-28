// src/routes/customers.routes.js

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const adminRouter = express.Router();

// List customers
adminRouter.get('/', requireAdmin, async (req, res) => {
  try {
    const { search, page = 1, limit = 50 } = req.query;

    let sql = 'SELECT * FROM customers WHERE 1=1';
    const params = [];

    if (search) {
      sql += `
        AND (
          name ILIKE $1
          OR phone ILIKE $1
          OR email ILIKE $1
        )
      `;

      params.push(`%${search}%`);
    }

    const lim = Math.min(
      parseInt(limit, 10) || 50,
      200
    );

    const pageNumber = Math.max(
      parseInt(page, 10) || 1,
      1
    );

    const off = (pageNumber - 1) * lim;

    sql += `
      ORDER BY created_at DESC
      LIMIT $${params.length + 1}
      OFFSET $${params.length + 2}
    `;

    params.push(lim, off);

    const customersResult = await db.query(sql, params);

    const totalResult = await db.query(
      'SELECT COUNT(*)::int AS count FROM customers'
    );

    const total = totalResult.rows[0].count;

    // Attach order count + lifetime spend per customer
    const withStats = await Promise.all(
      customersResult.rows.map(async (customer) => {
        const statsResult = await db.query(
          `SELECT
             COUNT(*)::int AS order_count,
             COALESCE(SUM(total), 0) AS lifetime_spend
           FROM orders
           WHERE customer_id = $1`,
          [customer.id]
        );

        const stats = statsResult.rows[0];

        return {
          ...customer,
          ...stats,
        };
      })
    );

    res.json({
      customers: withStats,
      total,
    });
  } catch (error) {
    console.error('[customers] List error:', error);

    res.status(500).json({
      error: 'Unable to load customers.',
    });
  }
});

// Get single customer
adminRouter.get('/:id', requireAdmin, async (req, res) => {
  try {
    const customerResult = await db.query(
      'SELECT * FROM customers WHERE id = $1',
      [req.params.id]
    );

    const customer = customerResult.rows[0];

    if (!customer) {
      return res.status(404).json({
        error: 'Customer not found.',
      });
    }

    const ordersResult = await db.query(
      `SELECT *
       FROM orders
       WHERE customer_id = $1
       ORDER BY created_at DESC`,
      [req.params.id]
    );

    res.json({
      customer,
      orders: ordersResult.rows,
    });
  } catch (error) {
    console.error('[customers] Detail error:', error);

    res.status(500).json({
      error: 'Unable to load customer.',
    });
  }
});

module.exports = {
  adminRouter,
};