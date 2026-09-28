// src/routes/orders.routes.js

const express = require('express');
const crypto = require('node:crypto');
const Razorpay = require('razorpay');
const db = require('../db');
const { requireAdmin } = require('../middleware/auth');

const publicRouter = express.Router();
const adminRouter = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function generateOrderNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();

  return `KSH-${stamp}-${rand}`;
}

async function attachItems(order) {
  const result = await db.query(
    'SELECT * FROM order_items WHERE order_id = $1',
    [order.id]
  );

  return {
    ...order,
    items: result.rows,
  };
}

const VALID_STATUSES = [
  'pending',
  'confirmed',
  'shipped',
  'delivered',
  'cancelled',
];

const ALLOWED_SIZES = [
  'S',
  'M',
  'L',
  'XL',
  'XXL',
];

function normalizeSize(value) {
  if (!value) {
    return null;
  }

  const size = String(value).trim().toUpperCase();

  if (!ALLOWED_SIZES.includes(size)) {
    return null;
  }

  return size;
}

// ============================================================
// RAZORPAY
// ============================================================

// POST /api/orders/payment/create
//
// Creates a Razorpay order.
//
// IMPORTANT:
// Product prices are loaded from PostgreSQL.
// The browser is NOT trusted for the payment amount.
publicRouter.post('/payment/create', async (req, res) => {
  try {
    const { items } = req.body || {};

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Your cart is empty.',
      });
    }

    const lineItems = [];

    for (const item of items) {
      const productResult = await db.query(
        `
          SELECT
            id,
            name,
            price,
            stock,
            sizes
          FROM products
          WHERE id = $1
            AND is_active = TRUE
        `,
        [item.product_id]
      );

      const product = productResult.rows[0];

      if (!product) {
        return res.status(400).json({
          error:
            'One of the items in your cart is no longer available.',
        });
      }

      const quantity = Math.max(
        1,
        parseInt(item.quantity, 10) || 1
      );

      if (product.stock < quantity) {
        return res.status(409).json({
          error: `Only ${product.stock} unit(s) of "${product.name}" left in stock.`,
        });
      }

      const size = normalizeSize(item.size);

      if (
        Array.isArray(product.sizes) &&
        product.sizes.length > 0 &&
        !size
      ) {
        return res.status(400).json({
          error: `Please select a size for "${product.name}".`,
        });
      }

      if (
        Array.isArray(product.sizes) &&
        product.sizes.length > 0 &&
        !product.sizes.includes(size)
      ) {
        return res.status(400).json({
          error: `Size ${size || ''} is not available for "${product.name}".`,
        });
      }

      const unitPrice = Number(product.price);

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        return res.status(500).json({
          error: `Invalid price for "${product.name}".`,
        });
      }

      const lineTotal = unitPrice * quantity;

      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal,
        size,
      });
    }

    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.line_total,
      0
    );

    const shippingFee = Number(
      process.env.SHIPPING_FEE || 0
    );

    if (!Number.isFinite(shippingFee) || shippingFee < 0) {
      return res.status(500).json({
        error: 'Invalid shipping fee configuration.',
      });
    }

    const total = subtotal + shippingFee;

    if (!Number.isFinite(total) || total <= 0) {
      return res.status(400).json({
        error: 'Invalid order total.',
      });
    }

    const amountInPaise = Math.round(total * 100);

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: 'INR',
      receipt: `kaasni_${Date.now()}`,
    });

    return res.json({
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      subtotal,
      shipping_fee: shippingFee,
      total,
    });
  } catch (error) {
    console.error(
      '[razorpay] Create order error:',
      error
    );

    return res.status(500).json({
      error: 'Unable to start payment.',
    });
  }
});

// ============================================================
// RAZORPAY SIGNATURE VERIFICATION
// ============================================================

function verifyRazorpayPayment(
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
) {
  if (
    !razorpayOrderId ||
    !razorpayPaymentId ||
    !razorpaySignature
  ) {
    return false;
  }

  if (!process.env.RAZORPAY_KEY_SECRET) {
    return false;
  }

  const generatedSignature = crypto
    .createHmac(
      'sha256',
      process.env.RAZORPAY_KEY_SECRET
    )
    .update(
      `${razorpayOrderId}|${razorpayPaymentId}`
    )
    .digest('hex');

  const expected = Buffer.from(generatedSignature);
  const received = Buffer.from(razorpaySignature);

  if (expected.length !== received.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    expected,
    received
  );
}

// ============================================================
// CREATE ORDER
// ============================================================

// POST /api/orders
//
// COD:
//   Creates order immediately with payment_status = unpaid.
//
// Razorpay:
//   Requires successful signature verification first.
publicRouter.post('/', async (req, res) => {
  const client = await db.getClient();

  try {
    const b = req.body || {};

    const {
      customer,
      items,
      payment_method,
      notes,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = b;

    // --------------------------------------------------------
    // Validate customer
    // --------------------------------------------------------

    if (
      !customer ||
      !customer.name ||
      !customer.phone ||
      !customer.address
    ) {
      return res.status(400).json({
        error:
          'Name, phone and address are required for delivery.',
      });
    }

    // --------------------------------------------------------
    // Validate cart
    // --------------------------------------------------------

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Your cart is empty.',
      });
    }

    // --------------------------------------------------------
    // Validate payment method
    // --------------------------------------------------------

    const allowedPaymentMethods = [
      'cod',
      'upi_manual',
      'razorpay',
    ];

    if (
      payment_method &&
      !allowedPaymentMethods.includes(payment_method)
    ) {
      return res.status(400).json({
        error: 'Invalid payment method.',
      });
    }

    const finalPaymentMethod =
      payment_method || 'cod';

    // --------------------------------------------------------
    // Razorpay verification
    // --------------------------------------------------------

    if (finalPaymentMethod === 'razorpay') {
      const verified = verifyRazorpayPayment(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!verified) {
        return res.status(400).json({
          error: 'Payment verification failed.',
        });
      }
    }

    // --------------------------------------------------------
    // Start transaction
    // --------------------------------------------------------

    await client.query('BEGIN');

    // --------------------------------------------------------
    // Validate products and calculate totals
    // --------------------------------------------------------

    const lineItems = [];

    for (const item of items) {
      const productResult = await client.query(
        `
          SELECT *
          FROM products
          WHERE id = $1
            AND is_active = TRUE
          FOR UPDATE
        `,
        [item.product_id]
      );

      const product = productResult.rows[0];

      if (!product) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'One of the items in your cart is no longer available.',
        });
      }

      const quantity = Math.max(
        1,
        parseInt(item.quantity, 10) || 1
      );

      if (product.stock < quantity) {
        await client.query('ROLLBACK');

        return res.status(409).json({
          error: `Only ${product.stock} unit(s) of "${product.name}" left in stock.`,
        });
      }

      // ------------------------------------------------------
      // Validate selected size against the product sizes
      // stored in PostgreSQL.
      // ------------------------------------------------------

      const size = normalizeSize(item.size);

      if (
        Array.isArray(product.sizes) &&
        product.sizes.length > 0 &&
        !size
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: `Please select a size for "${product.name}".`,
        });
      }

      if (
        Array.isArray(product.sizes) &&
        product.sizes.length > 0 &&
        !product.sizes.includes(size)
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error: `Size ${size || ''} is not available for "${product.name}".`,
        });
      }

      const unitPrice = Number(product.price);

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        await client.query('ROLLBACK');

        return res.status(500).json({
          error: `Invalid price for "${product.name}".`,
        });
      }

      const lineTotal =
        unitPrice * quantity;

      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal,
        size,
      });
    }

    const subtotal = lineItems.reduce(
      (sum, item) => sum + item.line_total,
      0
    );

    const shippingFee = Number(
      process.env.SHIPPING_FEE || 0
    );

    if (
      !Number.isFinite(shippingFee) ||
      shippingFee < 0
    ) {
      await client.query('ROLLBACK');

      return res.status(500).json({
        error:
          'Invalid shipping fee configuration.',
      });
    }

    const total =
      subtotal + shippingFee;

    // --------------------------------------------------------
    // For Razorpay, verify the Razorpay order amount.
    //
    // This prevents a valid signature for a different amount
    // from being accepted for this cart.
    // --------------------------------------------------------

    if (
      finalPaymentMethod === 'razorpay'
    ) {
      let razorpayOrder;

      try {
        razorpayOrder =
          await razorpay.orders.fetch(
            razorpay_order_id
          );
      } catch (razorpayError) {
        await client.query('ROLLBACK');

        console.error(
          '[razorpay] Failed to fetch payment order:',
          razorpayError.message
        );

        return res.status(400).json({
          error:
            'Unable to verify the Razorpay order.',
        });
      }

      const expectedAmount =
        Math.round(total * 100);

      if (
        Number(razorpayOrder.amount) !==
        expectedAmount
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'Payment amount does not match the order total.',
        });
      }

      if (
        razorpayOrder.currency !== 'INR'
      ) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          error:
            'Invalid payment currency.',
        });
      }
    }

    // --------------------------------------------------------
    // Upsert customer by phone
    // --------------------------------------------------------

    const customerResult =
      await client.query(
        'SELECT * FROM customers WHERE phone = $1',
        [customer.phone]
      );

    let customerRow =
      customerResult.rows[0];

    if (customerRow) {
      const updatedCustomer =
        await client.query(
          `
            UPDATE customers
            SET
              name = $1,
              email = $2,
              address = $3,
              city = $4,
              state = $5,
              pincode = $6
            WHERE id = $7
            RETURNING *
          `,
          [
            customer.name,
            customer.email ||
              customerRow.email,
            customer.address,
            customer.city ||
              customerRow.city,
            customer.state ||
              customerRow.state,
            customer.pincode ||
              customerRow.pincode,
            customerRow.id,
          ]
        );

      customerRow =
        updatedCustomer.rows[0];
    } else {
      const newCustomer =
        await client.query(
          `
            INSERT INTO customers
              (
                name,
                email,
                phone,
                address,
                city,
                state,
                pincode
              )
            VALUES
              ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
          `,
          [
            customer.name,
            customer.email || '',
            customer.phone,
            customer.address,
            customer.city || '',
            customer.state || '',
            customer.pincode || '',
          ]
        );

      customerRow =
        newCustomer.rows[0];
    }

    // --------------------------------------------------------
    // Create order
    // --------------------------------------------------------

    const orderNumber =
      generateOrderNumber();

    const paymentStatus =
      finalPaymentMethod === 'razorpay'
        ? 'paid'
        : 'unpaid';

    const orderResult =
      await client.query(
        `
          INSERT INTO orders
          (
            order_number,
            customer_id,
            status,
            subtotal,
            shipping_fee,
            total,
            payment_method,
            payment_status,
            shipping_name,
            shipping_phone,
            shipping_email,
            shipping_address,
            shipping_city,
            shipping_state,
            shipping_pincode,
            notes
          )
          VALUES
          (
            $1,
            $2,
            'pending',
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            $12,
            $13,
            $14,
            $15
          )
          RETURNING *
        `,
        [
          orderNumber,
          customerRow.id,
          subtotal,
          shippingFee,
          total,
          finalPaymentMethod,
          paymentStatus,
          customer.name,
          customer.phone,
          customer.email || '',
          customer.address,
          customer.city || '',
          customer.state || '',
          customer.pincode || '',
          notes || '',
        ]
      );

    const order =
      orderResult.rows[0];

    const orderId = order.id;

    if (finalPaymentMethod === 'razorpay') {
      // Unique index: a replayed payment id raises 23505 (handled below).
      await client.query(
        'UPDATE orders SET razorpay_payment_id = $1 WHERE id = $2',
        [razorpay_payment_id, orderId]
      );
    }

    // --------------------------------------------------------
    // Insert order items and reduce stock
    // --------------------------------------------------------

    for (const item of lineItems) {
      await client.query(
        `
          INSERT INTO order_items
          (
            order_id,
            product_id,
            product_name,
            unit_price,
            quantity,
            line_total,
            size
          )
          VALUES
          ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          orderId,
          item.product_id,
          item.product_name,
          item.unit_price,
          item.quantity,
          item.line_total,
          item.size || null,
        ]
      );

      await client.query(
        `
          UPDATE products
          SET stock = stock - $1
          WHERE id = $2
        `,
        [
          item.quantity,
          item.product_id,
        ]
      );
    }

    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    await client.query('COMMIT');

    return res.status(201).json({
      order_number: orderNumber,
      total,
      subtotal,
      shipping_fee: shippingFee,
      payment_method: finalPaymentMethod,
      payment_status: paymentStatus,
    });
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (_) {
      // Ignore rollback errors.
    }

    // Same Razorpay payment submitted twice: return the order that already exists.
    if (error.code === '23505' && req.body && req.body.razorpay_payment_id) {
      try {
        const dup = await db.query(
          'SELECT order_number, total, subtotal, shipping_fee, payment_method, payment_status FROM orders WHERE razorpay_payment_id = $1',
          [req.body.razorpay_payment_id]
        );
        if (dup.rows[0]) {
          return res.status(200).json(dup.rows[0]);
        }
      } catch (_) { /* fall through */ }
    }

    console.error(
      '[orders] Create order error:',
      error
    );

    return res.status(500).json({
      error: 'Unable to place order.',
    });
  } finally {
    client.release();
  }
});

// ============================================================
// TRACK ORDER
// ============================================================

// GET /api/orders/track?order_number=KSH-...&phone=...
publicRouter.get('/track', async (req, res) => {
  try {
    const {
      order_number,
      phone,
    } = req.query;

    if (!order_number || !phone) {
      return res.status(400).json({
        error:
          'Order number and phone are required.',
      });
    }

    const result = await db.query(
      `
        SELECT *
        FROM orders
        WHERE UPPER(order_number) = UPPER($1)
          AND RIGHT(REGEXP_REPLACE(shipping_phone, '\\D', '', 'g'), 10) = $2
        LIMIT 1
      `,
      [
        String(order_number).trim(),
        String(phone).replace(/\D/g, '').slice(-10),
      ]
    );

    const order =
      result.rows[0];

    if (!order) {
      return res.status(404).json({
        error:
          'No matching order found.',
      });
    }

    return res.json({
      order: await attachItems(order),
    });
  } catch (error) {
    console.error(
      '[orders] Track error:',
      error
    );

    return res.status(500).json({
      error: 'Unable to track order.',
    });
  }
});

// ============================================================
// ADMIN - LIST ORDERS
// ============================================================

adminRouter.get(
  '/',
  requireAdmin,
  async (req, res) => {
    try {
      const {
        status,
        payment_status,
        search,
        limit = 100,
        offset = 0,
      } = req.query;

      let sql =
        'SELECT * FROM orders WHERE 1=1';

      const params = [];
      let index = 1;

      if (status) {
        sql += ` AND status = $${index}`;
        params.push(status);
        index += 1;
      }

      if (payment_status) {
        sql += ` AND payment_status = $${index}`;
        params.push(payment_status);
        index += 1;
      }

      if (search) {
        sql += `
          AND (
            order_number ILIKE $${index}
            OR shipping_name ILIKE $${index}
            OR shipping_phone ILIKE $${index}
          )
        `;

        params.push(`%${search}%`);
        index += 1;
      }

      sql += `
        ORDER BY created_at DESC
        LIMIT $${index}
        OFFSET $${index + 1}
      `;

      params.push(
        Math.min(
          Math.max(
            parseInt(limit, 10) || 100,
            1
          ),
          500
        )
      );

      params.push(
        Math.max(
          parseInt(offset, 10) || 0,
          0
        )
      );

      const ordersResult =
        await db.query(sql, params);

      const countResult =
        await db.query(
          'SELECT COUNT(*)::int AS c FROM orders'
        );

      return res.json({
        orders: ordersResult.rows,
        total: countResult.rows[0].c,
      });
    } catch (error) {
      console.error(
        '[orders] Admin list error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to load orders.',
      });
    }
  }
);

// ============================================================
// ADMIN - GET ORDER
// ============================================================

adminRouter.get(
  '/:id',
  requireAdmin,
  async (req, res) => {
    try {
      const client = await db.getClient();

      try {
        await client.query('BEGIN');

        const result = await client.query(
          'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
          [req.params.id]
        );

        const order = result.rows[0];

        if (!order) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            error: 'Order not found.',
          });
        }

        const nextStatus = status || order.status;

        // Keep stock accurate: cancelling returns units to stock,
        // and re-opening a cancelled order takes them out again.
        if (order.status !== 'cancelled' && nextStatus === 'cancelled') {
          await client.query(
            `
              UPDATE products p
              SET stock = p.stock + oi.qty
              FROM (
                SELECT product_id, SUM(quantity)::int AS qty
                FROM order_items
                WHERE order_id = $1 AND product_id IS NOT NULL
                GROUP BY product_id
              ) oi
              WHERE p.id = oi.product_id
            `,
            [order.id]
          );
        } else if (order.status === 'cancelled' && nextStatus !== 'cancelled') {
          await client.query(
            `
              UPDATE products p
              SET stock = GREATEST(p.stock - oi.qty, 0)
              FROM (
                SELECT product_id, SUM(quantity)::int AS qty
                FROM order_items
                WHERE order_id = $1 AND product_id IS NOT NULL
                GROUP BY product_id
              ) oi
              WHERE p.id = oi.product_id
            `,
            [order.id]
          );
        }

        const updated = await client.query(
          `
            UPDATE orders
            SET
              status = $1,
              payment_status = $2
            WHERE id = $3
            RETURNING *
          `,
          [
            nextStatus,
            payment_status || order.payment_status,
            req.params.id,
          ]
        );

        await client.query('COMMIT');

        return res.json({
          order: updated.rows[0],
        });
      } catch (txError) {
        try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
        throw txError;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        '[orders] Update status error:',
        error
      );

      return res.status(500).json({
        error:
          'Unable to update order.',
      });
    }
  }
);

module.exports = {
  publicRouter,
  adminRouter,
};