// src/db.js
// PostgreSQL connection pool for Kaasni.
//
// The production database is Supabase PostgreSQL.
// SQLite is no longer used by the application.

const { Pool, types } = require('pg');

// pg returns NUMERIC (1700) and BIGINT (20) as strings by default. That breaks
// numeric comparisons on the storefront (e.g. "999.00" > "1500.00" is true as
// text), so parse them into real numbers. IDs and money fit safely in a double.
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v)));
types.setTypeParser(20, (v) => (v === null ? null : parseInt(v, 10)));

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not configured in .env');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (error) => {
  console.error('[db] Unexpected PostgreSQL pool error:', error);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function getClient() {
  return pool.connect();
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  getClient,
  close,
};