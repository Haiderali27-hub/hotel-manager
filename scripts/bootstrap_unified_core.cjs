const Database = require('better-sqlite3');

const db = new Database('./db/hotel.db');
db.pragma('foreign_keys = ON');

const sql = `
CREATE TABLE IF NOT EXISTS admin_auth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  security_question TEXT,
  security_answer_hash TEXT,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS resources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT UNIQUE NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'Standard',
  daily_rate REAL NOT NULL DEFAULT 100.0,
  is_occupied INTEGER NOT NULL DEFAULT 0,
  guest_id INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  resource_type TEXT NOT NULL DEFAULT 'Room',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  room_id INTEGER,
  check_in TEXT NOT NULL,
  check_out TEXT,
  daily_rate REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES resources(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS menu_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sku TEXT,
  barcode TEXT,
  price REAL NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  description TEXT,
  is_available INTEGER NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  stock_quantity INTEGER DEFAULT 0,
  track_stock INTEGER DEFAULT 0,
  low_stock_limit INTEGER DEFAULT 5,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER,
  customer_type TEXT NOT NULL,
  customer_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid INTEGER NOT NULL DEFAULT 0,
  paid_at DATETIME,
  total_amount REAL NOT NULL,
  FOREIGN KEY (guest_id) REFERENCES customers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  menu_item_id INTEGER,
  item_name TEXT NOT NULL,
  unit_price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  line_total REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES sales(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

try {
  db.exec(sql);
  console.log('Unified core bootstrap tables ensured.');
} catch (error) {
  console.error('Failed to bootstrap unified core tables:', error.message);
  process.exit(1);
} finally {
  db.close();
}
