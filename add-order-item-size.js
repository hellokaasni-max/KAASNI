require('dotenv').config();

const { query, close } = require('./src/db');

query("ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size TEXT")
  .then(() => {
    console.log('order_items size column added successfully');
    return close();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
