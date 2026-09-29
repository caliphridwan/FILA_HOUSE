-- Fila House database schema (PostgreSQL)

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS caps (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  description TEXT DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS delivery_zones (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0)
);

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_ref TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  address TEXT NOT NULL,
  zone_id INTEGER REFERENCES delivery_zones(id),
  zone_name TEXT NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  delivery_fee NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'card',
  status TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  paystack_reference TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  cap_id INTEGER REFERENCES caps(id),
  cap_name TEXT NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  qty INTEGER NOT NULL,
  line_total NUMERIC(12,2) NOT NULL
);

-- Seed starter data (safe to run more than once)
INSERT INTO categories (name) VALUES
  ('Atiku'), ('Tangaran'), ('Maroofiya'), ('Bindo')
ON CONFLICT (name) DO NOTHING;

INSERT INTO delivery_zones (name, price) VALUES
  ('Lagos', 1500), ('Abuja', 2500), ('Other states', 3500)
ON CONFLICT (name) DO NOTHING;

INSERT INTO caps (name, category_id, price, stock, description)
SELECT 'Royal Atiku Cap', id, 15000, 8, 'Classic folded-crown Atiku, hand-stitched brim.' FROM categories WHERE name='Atiku'
ON CONFLICT DO NOTHING;

INSERT INTO caps (name, category_id, price, stock, description)
SELECT 'Heritage Tangaran', id, 12000, 10, 'Lightweight, breathable, everyday Tangaran.' FROM categories WHERE name='Tangaran'
ON CONFLICT DO NOTHING;

INSERT INTO caps (name, category_id, price, stock, description)
SELECT 'Classic Maroofiya', id, 13500, 6, 'Traditional weave, true to form and fit.' FROM categories WHERE name='Maroofiya'
ON CONFLICT DO NOTHING;

INSERT INTO caps (name, category_id, price, stock, description)
SELECT 'Everyday Bindo', id, 9000, 14, 'Soft, casual Bindo for daily wear.' FROM categories WHERE name='Bindo'
ON CONFLICT DO NOTHING;
