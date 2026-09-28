require('dotenv').config();

const { query, close } = require('./src/db');

query(`
  SELECT
    o.order_number,
    oi.product_name,
    oi.size,
    oi.quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  ORDER BY oi.id DESC
  LIMIT 5
`)
  .then((r) => {
    console.table(r.rows);
    return close();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
