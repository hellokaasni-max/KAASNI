CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS banners (
    id BIGSERIAL PRIMARY KEY,
    position TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    image_path TEXT,
    cta_text TEXT,
    cta_link TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    price NUMERIC(12,2) NOT NULL DEFAULT 0,
    compare_at_price NUMERIC(12,2),
    fabric TEXT,
    colour TEXT,
    dimensions TEXT,
    description TEXT,
    care_instructions TEXT,
    stock INTEGER NOT NULL DEFAULT 0,
    sizes TEXT[] NOT NULL DEFAULT '{}',
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_images (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT,
    storage_key TEXT,
    alt_text TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
    shipping_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
    total NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_method TEXT,
    payment_status TEXT NOT NULL DEFAULT 'pending',
    razorpay_payment_id TEXT,
    shipping_name TEXT,
    shipping_phone TEXT,
    shipping_email TEXT,
    shipping_address TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_pincode TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
    size TEXT,
    quantity INTEGER NOT NULL DEFAULT 1,
    line_total NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_category_id
    ON products(category_id);

CREATE INDEX IF NOT EXISTS idx_products_active
    ON products(is_active);

CREATE INDEX IF NOT EXISTS idx_products_featured
    ON products(is_featured);

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
    ON product_images(product_id);

CREATE INDEX IF NOT EXISTS idx_orders_customer_id
    ON orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_orders_status
    ON orders(status);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
    ON orders(created_at);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_product_id
    ON order_items(product_id);