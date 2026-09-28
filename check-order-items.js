require('dotenv').config();

const { query, close } = require('./src/db');

query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'order_items' ORDER BY ordinal_position")
  .then((result) => {
    console.table(result.rows);
    return close();
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
