require("dotenv").config();
const { query, close } = require("./src/db");

query("ALTER TABLE products ADD COLUMN IF NOT EXISTS sizes TEXT[] DEFAULT ARRAY[]::TEXT[]")
  .then(() => {
    console.log("sizes column added successfully");
    return close();
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
