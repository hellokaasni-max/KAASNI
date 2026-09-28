// src/routes/dashboard.routes.js

const express = require('express');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAdmin, async (req, res) => {
  try {
    const [
      productCountResult,
      lowStockResult,
      customerCountResult,
      orderCountResult,
      pendingOrdersResult,
      revenueResult,
      recentOrdersResult,
      topProductsResult,
    ] = await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS count
         FROM products
         WHERE is_active = true`
      ),

      db.query(
        `SELECT COUNT(*)::int AS count
         FROM products
         WHERE is_active = true
           AND stock <= 3`
      ),

      db.query(
        `SELECT COUNT(*)::int AS count
         FROM customers`
      ),

      db.query(
        `SELECT COUNT(*)::int AS count
         FROM orders`
      ),

      db.query(
        `SELECT COUNT(*)::int AS count
         FROM orders
         WHERE status = 'pending'`
      ),

      db.query(
        `SELECT COALESCE(SUM(total), 0) AS revenue
         FROM orders
         WHERE status != 'cancelled'`
      ),

      db.query(
        `SELECT
           id,
           order_number,
           shipping_name,
           status,
           total,
           created_at
         FROM orders
         ORDER BY created_at DESC
         LIMIT 5`
      ),

      db.query(
        `SELECT
           p.name,
           SUM(oi.quantity)::int AS units_sold
         FROM order_items oi
         JOIN products p ON p.id = oi.product_id
         GROUP BY oi.product_id, p.name
         ORDER BY units_sold DESC
         LIMIT 5`
      ),
    ]);

    res.json({
      product_count: productCountResult.rows[0].count,
      low_stock: lowStockResult.rows[0].count,
      customer_count: customerCountResult.rows[0].count,
      order_count: orderCountResult.rows[0].count,
      pending_orders: pendingOrdersResult.rows[0].count,
      revenue: revenueResult.rows[0].revenue,
      recent_orders: recentOrdersResult.rows,
      top_products: topProductsResult.rows,
    });
  } catch (error) {
    console.error('[dashboard] Error:', error);

    res.status(500).json({
      error: 'Unable to load dashboard.',
    });
  }
});

module.exports = router;