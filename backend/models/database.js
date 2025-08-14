const Database = require('better-sqlite3');
const path = require('path');

class DatabaseManager {
  constructor() {
    const dbPath = path.join(__dirname, process.env.DB_PATH || '../db/hotel.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initializeTables();
  }

  initializeTables() {
    try {
      // Create admin_auth table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS admin_auth (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT UNIQUE,
          full_name TEXT,
          role TEXT DEFAULT 'admin',
          is_active BOOLEAN DEFAULT 1,
          last_login DATETIME,
          failed_login_attempts INTEGER DEFAULT 0,
          locked_until DATETIME,
          otp_secret TEXT,
          is_otp_enabled BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create guests table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS guests (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          phone TEXT,
          address TEXT,
          id_number TEXT,
          room_number INTEGER,
          checkin_date DATETIME NOT NULL,
          checkout_date DATETIME,
          status TEXT DEFAULT 'active',
          total_amount DECIMAL(10,2) DEFAULT 0,
          paid_amount DECIMAL(10,2) DEFAULT 0,
          balance_amount DECIMAL(10,2) DEFAULT 0,
          payment_status TEXT DEFAULT 'pending',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create rooms table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_number INTEGER UNIQUE NOT NULL,
          room_type TEXT NOT NULL,
          capacity INTEGER DEFAULT 2,
          price_per_night DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'available',
          amenities TEXT,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create food_orders table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS food_orders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          guest_id INTEGER,
          room_number INTEGER,
          order_items TEXT NOT NULL,
          total_amount DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'pending',
          order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          delivery_time DATETIME,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
      `);

      // Create expenses table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          expense_date DATE NOT NULL,
          payment_method TEXT,
          receipt_number TEXT,
          notes TEXT,
          created_by TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create revenue table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS revenue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source TEXT NOT NULL,
          description TEXT,
          amount DECIMAL(10,2) NOT NULL,
          revenue_date DATE NOT NULL,
          guest_id INTEGER,
          room_number INTEGER,
          reference_number TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (guest_id) REFERENCES guests(id)
        )
      `);

      console.log('✅ Database tables initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing database tables:', error);
      throw error;
    }
  }

  // Helper method to run prepared statements
  prepare(sql) {
    return this.db.prepare(sql);
  }

  // Helper method to run transactions
  transaction(fn) {
    return this.db.transaction(fn);
  }

  // Close database connection
  close() {
    this.db.close();
  }

  // Get database instance
  getInstance() {
    return this.db;
  }
}

module.exports = new DatabaseManager();
