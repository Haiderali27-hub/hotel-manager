const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Open database (correct path from createDb.cjs)
const dbPath = path.join(__dirname, '..', 'db', 'hotel.db');
const db = new Database(dbPath);

console.log('🧪 Loading comprehensive test data for all phases...\n');

try {
  // ========================================
  // PHASE 1: Offline Auth + Setup Wizard
  // ========================================
  console.log('PHASE 1: Setting up admin users with roles...');
  
  // Check if role column exists (admin_auth uses password_hash not password)
  const tableInfo = db.prepare("PRAGMA table_info(admin_auth)").all();
  const hasRoleColumn = tableInfo.some(col => col.name === 'role');
  
  if (!hasRoleColumn) {
    console.log('  Adding role column to admin_auth...');
    db.exec("ALTER TABLE admin_auth ADD COLUMN role TEXT DEFAULT 'staff'");
  }
  
  // Update existing admin to have admin role
  db.prepare("UPDATE admin_auth SET role = 'admin' WHERE id = 1").run();
  
  // Insert additional test users with different roles (using simple password storage for testing)
  const insertAdmin = db.prepare(`
    INSERT OR IGNORE INTO admin_auth (username, password_hash, role, security_question, security_answer_hash, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `);
  
  insertAdmin.run('manager1', 'manager123', 'manager', 'What is your pet name?', 'fluffy');
  insertAdmin.run('staff1', 'staff123', 'staff', 'What city were you born?', 'paris');
  
  console.log('  ✓ Created 3 users: admin (admin), manager1 (manager), staff1 (staff)');

  // ========================================
  // Create missing tables
  // ========================================
  console.log('\n📋 Creating missing tables...');
  
  // Create business_settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ Created business_settings table');
  
  // Create menu_catalog table if doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS menu_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      track_stock INTEGER DEFAULT 0,
      stock_quantity INTEGER DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ Created menu_catalog table');
  
  // Create food_order table if doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS food_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      date_time DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log('  ✓ Created food_order table');
  
  // Create shifts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS shifts (
      shift_id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER NOT NULL,
      start_time DATETIME NOT NULL,
      start_cash REAL NOT NULL,
      end_time DATETIME,
      expected_cash REAL,
      actual_cash REAL,
      difference REAL,
      notes TEXT,
      FOREIGN KEY (admin_id) REFERENCES admin_auth(id)
    )
  `);
  console.log('  ✓ Created shifts table');

  // ========================================
  // PHASE 2: Generic Business Naming
  // ========================================
  console.log('\nPHASE 2: Configuring business settings...');
  
  const insertSetting = db.prepare(`
    INSERT OR REPLACE INTO business_settings (key, value) VALUES (?, ?)
  `);
  
  insertSetting.run('business_name', 'Sunset Restaurant & Bar');
  insertSetting.run('business_address', '123 Ocean Drive, Miami Beach, FL 33139');
  insertSetting.run('business_phone', '+1-305-555-0123');
  insertSetting.run('business_email', 'info@sunsetrestaurant.com');
  insertSetting.run('currency_code', 'USD');
  insertSetting.run('currency_symbol', '$');
  insertSetting.run('currency_position', 'before');
  insertSetting.run('tax_rate', '8.5');
  insertSetting.run('receipt_footer', 'Thank you for dining with us!');
  
  console.log('  ✓ Business: Sunset Restaurant & Bar');
  console.log('  ✓ Currency: USD ($)');
  console.log('  ✓ Tax rate: 8.5%');

  // ========================================
  // PHASE 3: White-Labeling (Theme)
  // ========================================
  console.log('\nPHASE 3: Setting up theme...');
  
  insertSetting.run('theme_mode', 'dark');
  insertSetting.run('theme_primary_color', '#3b82f6');
  insertSetting.run('theme_accent_color', '#10b981');
  insertSetting.run('logo_url', 'custom-logo.png');
  
  console.log('  ✓ Theme: Dark mode');
  console.log('  ✓ Primary: #3b82f6 (blue)');
  console.log('  ✓ Accent: #10b981 (green)');

  // ========================================
  // PHASE 4: RBAC + Inventory + Shifts
  // ========================================
  console.log('\nPHASE 4: Setting up inventory and shifts...');
  
  // Inventory columns already added during table creation
  
  // Insert products with stock tracking
  const insertProduct = db.prepare(`
    INSERT INTO menu_catalog (name, category, price, track_stock, stock_quantity, low_stock_threshold)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  insertProduct.run('Coca Cola 330ml', 'Beverages', 2.50, 1, 100, 20);
  insertProduct.run('Heineken Beer', 'Beverages', 5.00, 1, 50, 10);
  insertProduct.run('Caesar Salad', 'Food', 12.00, 1, 30, 5);
  insertProduct.run('French Fries', 'Food', 6.00, 1, 45, 10);
  insertProduct.run('Ice Cream', 'Desserts', 7.50, 1, 25, 8);
  insertProduct.run('Room Service', 'Services', 15.00, 0, 0, 0);
  insertProduct.run('Laundry', 'Services', 20.00, 0, 0, 0);
  
  console.log('  ✓ Created 7 catalog items (5 with stock tracking)');
  
  // Create test sales
  const insertSale = db.prepare(`
    INSERT INTO food_order (item, price, quantity, date_time)
    VALUES (?, ?, ?, datetime('now', ?))
  `);
  
  insertSale.run('Coca Cola 330ml', 2.50, 15, '-2 hours');
  insertSale.run('Heineken Beer', 5.00, 8, '-1 hour');
  insertSale.run('Caesar Salad', 12.00, 5, '-30 minutes');
  
  // Update stock after sales
  db.prepare("UPDATE menu_catalog SET stock_quantity = stock_quantity - 15 WHERE name = 'Coca Cola 330ml'").run();
  db.prepare("UPDATE menu_catalog SET stock_quantity = stock_quantity - 8 WHERE name = 'Heineken Beer'").run();
  db.prepare("UPDATE menu_catalog SET stock_quantity = stock_quantity - 5 WHERE name = 'Caesar Salad'").run();
  
  console.log('  ✓ Created 3 test sales with stock decrements');
  
  // Create shift records using existing schema
  const insertShift = db.prepare(`
    INSERT INTO shifts (opened_by, opened_at, closed_by, closed_at, start_cash, end_cash_expected, end_cash_actual, difference, notes, status)
    VALUES (?, datetime('now', ?), ?, datetime('now', ?), ?, ?, ?, ?, ?, 'closed')
  `);
  
  insertShift.run(1, '-8 hours', 1, '-1 hour', 200.00, 587.50, 590.00, 2.50, 'Shift 1 - Small overage');
  insertShift.run(2, '-16 hours', 2, '-9 hours', 150.00, 456.75, 450.00, -6.75, 'Shift 2 - Minor shortage');
  
  console.log('  ✓ Created 2 completed shifts with reconciliation');

  // ========================================
  // VERIFICATION
  // ========================================
  console.log('\n' + '='.repeat(50));
  console.log('📊 TEST DATA SUMMARY');
  console.log('='.repeat(50));
  
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM admin_auth").get();
  console.log(`\n👥 Admin Users: ${adminCount.count}`);
  const admins = db.prepare("SELECT username, role FROM admin_auth").all();
  admins.forEach(a => console.log(`   - ${a.username} (${a.role})`));
  
  const businessName = db.prepare("SELECT value FROM business_settings WHERE key = 'business_name'").get();
  console.log(`\n🏢 Business: ${businessName.value}`);
  
  const theme = db.prepare("SELECT value FROM business_settings WHERE key = 'theme_mode'").get();
  console.log(`🎨 Theme: ${theme.value} mode`);
  
  const products = db.prepare("SELECT COUNT(*) as count FROM menu_catalog WHERE track_stock = 1").get();
  console.log(`\n📦 Tracked Products: ${products.count}`);
  
  const lowStock = db.prepare(`
    SELECT name, stock_quantity, low_stock_threshold
    FROM menu_catalog
    WHERE track_stock = 1 AND stock_quantity <= low_stock_threshold
    ORDER BY stock_quantity ASC
  `).all();
  
  if (lowStock.length > 0) {
    console.log(`\n⚠️  Low Stock Alerts: ${lowStock.length}`);
    lowStock.forEach(item => {
      const status = item.stock_quantity === 0 ? '🔴 OUT' : 
                     item.stock_quantity <= item.low_stock_threshold * 0.5 ? '🟠 CRITICAL' : '🟡 LOW';
      console.log(`   ${status} ${item.name}: ${item.stock_quantity}/${item.low_stock_threshold}`);
    });
  }
  
  const shifts = db.prepare("SELECT COUNT(*) as count FROM shifts WHERE status = 'closed'").get();
  console.log(`\n📊 Shift Records: ${shifts.count}`);
  
  const shiftSummary = db.prepare(`
    SELECT 
      SUM(CASE WHEN difference > 0 THEN 1 ELSE 0 END) as overages,
      SUM(CASE WHEN difference < 0 THEN 1 ELSE 0 END) as shortages,
      SUM(CASE WHEN difference = 0 THEN 1 ELSE 0 END) as balanced,
      ROUND(SUM(ABS(difference)), 2) as total_variance
    FROM shifts WHERE status = 'closed'
  `).get();
  
  console.log(`   - Balanced: ${shiftSummary.balanced}`);
  console.log(`   - Overages: ${shiftSummary.overages}`);
  console.log(`   - Shortages: ${shiftSummary.shortages}`);
  console.log(`   - Total variance: $${shiftSummary.total_variance}`);
  
  console.log('\n' + '='.repeat(50));
  console.log('✅ ALL TEST DATA LOADED SUCCESSFULLY!');
  console.log('='.repeat(50));
  console.log('\n📖 Next steps:');
  console.log('   1. Run: npm run tauri dev');
  console.log('   2. Login with: admin / admin123');
  console.log('   3. Follow TEST_PLAN.md for complete testing');
  console.log('\n');

} catch (error) {
  console.error('❌ Error loading test data:', error.message);
  process.exit(1);
} finally {
  db.close();
}
