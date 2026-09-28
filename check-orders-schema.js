require('dotenv').config();

const { query, close } = require('./src/db');

query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'orders'
  ORDER BY ordinal_position
`)
  .then((r) => {
    console.table(r.rows);
    return close();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
