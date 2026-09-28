// server.js
require('dotenv').config();

const path = require('node:path');
const express = require('express');
const cors = require('cors');

const { runBootstrap } = require('./src/utils/bootstrap');

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is not configured.');
}

const authRoutes = require('./src/routes/auth.routes');
const categoriesRoutes = require('./src/routes/categories.routes');
const products = require('./src/routes/products.routes');
const orders = require('./src/routes/orders.routes');
const customers = require('./src/routes/customers.routes');
const bannersRoutes = require('./src/routes/banners.routes');
const settingsRoutes = require('./src/routes/settings.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Uploaded product/banner images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ---------- API ----------
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', products.publicRouter);
app.use('/api/admin/products', products.adminRouter);
app.use('/api/orders', orders.publicRouter);
app.use('/api/admin/orders', orders.adminRouter);
app.use('/api/admin/customers', customers.adminRouter);
app.use('/api/banners', bannersRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/admin/dashboard', dashboardRoutes);

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  if (err && err.message) {
    return res.status(400).json({ error: err.message });
  }

  next(err);
});

// ---------- Static front-ends ----------
app.use('/admin', express.static(path.join(__dirname, 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await runBootstrap();

    app.listen(PORT, () => {
      console.log('\nKaasni server running:');
      console.log(`  Storefront:  http://localhost:${PORT}`);
      console.log(`  Admin panel: http://localhost:${PORT}/admin\n`);
    });
  } catch (error) {
    console.error('\n[bootstrap] Failed to start Kaasni:', error);
    process.exit(1);
  }
}

startServer();