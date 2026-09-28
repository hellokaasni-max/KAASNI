require('dotenv').config();

const { getClient, close } = require('./src/db');

async function main() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Find the first real active Kurti.
    const productResult = await client.query(`
      SELECT p.id, p.name, p.price, p.stock
      FROM products p
      JOIN categories c ON c.id = p.category_id
      WHERE c.slug = 'kurtis'
        AND p.is_active = true
      ORDER BY p.id
      LIMIT 1
    `);

    if (!productResult.rows.length) {
      throw new Error('No active Kurti found in the database.');
    }

    const product = productResult.rows[0];

    // Create temporary test customer.
    const customerResult = await client.query(`
      INSERT INTO customers (name, email, phone)
      VALUES ($1, $2, $3)
      RETURNING id
    `, [
      'Kaasni Test Customer',
      'test-order@kaasni.local',
      '9999999999'
    ]);

    const customerId = customerResult.rows[0].id;

    const orderNumber = 'KSH-TEST-SIZE-' + Date.now();

    // Create temporary test order.
    const orderResult = await client.query(`
      INSERT INTO orders (
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
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING id, order_number
    `, [
      orderNumber,
      customerId,
      'confirmed',
      product.price,
      0,
      product.price,
      'test',
      'paid',
      'Kaasni Test Customer',
      '9999999999',
      'test-order@kaasni.local',
      'Kaasni Test Address',
      'Patna',
      'Bihar',
      '800001',
      'Temporary size test order'
    ]);

    const order = orderResult.rows[0];

    // Add one real Kurti with Size M.
    await client.query(`
      INSERT INTO order_items (
        order_id,
        product_id,
        product_name,
        unit_price,
        quantity,
        line_total,
        size
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      order.id,
      product.id,
      product.name,
      product.price,
      1,
      product.price,
      'M'
    ]);

    await client.query('COMMIT');

    console.log('');
    console.log('======================================');
    console.log(' TEST ORDER CREATED SUCCESSFULLY');
    console.log('======================================');
    console.log('Order Number :', order.order_number);
    console.log('Product      :', product.name);
    console.log('Size         : M');
    console.log('Quantity     : 1');
    console.log('Total        : ?' + product.price);
    console.log('');
    console.log('Now check Admin ? Orders ? View Order.');
    console.log('The item should show Size = M.');
    console.log('');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('TEST ORDER FAILED');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await close();
  }
}

main();
