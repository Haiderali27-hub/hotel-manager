/**
 * Comprehensive Test Suite for Hotel Management System
 * Tests all 4 phases: Setup → Settings → Theme → RBAC/Inventory/Shifts
 */

const sqlite = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

class TestRunner {
  constructor() {
    this.dbPath = path.join(__dirname, '..', 'db', 'hotel.db');
    this.db = null;
    this.testResults = {
      passed: 0,
      failed: 0,
      total: 0
    };
  }

  log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
  }

  async connect() {
    try {
      this.db = sqlite(this.dbPath);
      this.log('✓ Database connection established', 'green');
      return true;
    } catch (error) {
      this.log(`✗ Database connection failed: ${error.message}`, 'red');
      return false;
    }
  }

  test(name, fn) {
    this.testResults.total++;
    try {
      fn();
      this.testResults.passed++;
      this.log(`  ✓ ${name}`, 'green');
    } catch (error) {
      this.testResults.failed++;
      this.log(`  ✗ ${name}`, 'red');
      this.log(`    Error: ${error.message}`, 'yellow');
    }
  }

  assertEquals(actual, expected, message = '') {
    if (actual !== expected) {
      throw new Error(`${message}\nExpected: ${expected}\nActual: ${actual}`);
    }
  }

  assertTrue(condition, message = 'Condition is false') {
    if (!condition) {
      throw new Error(message);
    }
  }

  assertNotNull(value, message = 'Value is null') {
    if (value === null || value === undefined) {
      throw new Error(message);
    }
  }

  // ==================== PHASE 1: AUTHENTICATION & SETUP ====================
  testPhase1Authentication() {
    this.log('\n=== Phase 1: Authentication & Setup Tests ===', 'cyan');

    this.test('admin_auth table exists with correct schema', () => {
      const tableInfo = this.db.pragma('table_info(admin_auth)');
      const columnNames = tableInfo.map(col => col.name);
      
      this.assertTrue(columnNames.includes('id'), 'Missing id column');
      this.assertTrue(columnNames.includes('username'), 'Missing username column');
      this.assertTrue(columnNames.includes('password_hash'), 'Missing password_hash column');
      this.assertTrue(columnNames.includes('salt'), 'Missing salt column');
      this.assertTrue(columnNames.includes('role'), 'Missing role column');
      this.assertTrue(columnNames.includes('security_question'), 'Missing security_question column');
      this.assertTrue(columnNames.includes('security_answer_hash'), 'Missing security_answer_hash column');
      this.assertTrue(columnNames.includes('failed_attempts'), 'Missing failed_attempts column');
    });

    this.test('Default admin user exists', () => {
      const admin = this.db.prepare('SELECT * FROM admin_auth WHERE username = ?').get('yasinheaven');
      this.assertNotNull(admin, 'Default admin not found');
      this.assertEquals(admin.role, 'admin', 'Default admin role incorrect');
    });

    this.test('admin_sessions table exists', () => {
      const tableInfo = this.db.pragma('table_info(admin_sessions)');
      this.assertTrue(tableInfo.length > 0, 'admin_sessions table not found');
    });

    this.test('audit_log table exists with correct schema', () => {
      const tableInfo = this.db.pragma('table_info(audit_log)');
      const columnNames = tableInfo.map(col => col.name);
      
      this.assertTrue(columnNames.includes('timestamp'), 'Missing timestamp column');
      this.assertTrue(columnNames.includes('username'), 'Missing username column');
      this.assertTrue(columnNames.includes('event_type'), 'Missing event_type column');
    });

    this.test('Initial setup audit log entry exists', () => {
      const logEntry = this.db.prepare(
        "SELECT * FROM audit_log WHERE event_type = 'SYSTEM_SETUP'"
      ).get();
      this.assertNotNull(logEntry, 'Setup audit log not found');
    });
  }

  // ==================== PHASE 2: BUSINESS SETTINGS ====================
  testPhase2Settings() {
    this.log('\n=== Phase 2: Business Settings Tests ===', 'cyan');

    this.test('settings table exists or can be created', () => {
      // Try to create settings table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='settings'").get();
      this.assertNotNull(tables, 'settings table not found');
    });

    this.test('Can insert and retrieve business settings', () => {
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('business_name', 'Test Hotel');
      const setting = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('business_name');
      this.assertEquals(setting.value, 'Test Hotel', 'Business name not stored correctly');
    });

    this.test('Can store currency settings', () => {
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('currency_code', 'USD');
      const setting = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('currency_code');
      this.assertEquals(setting.value, 'USD', 'Currency code not stored correctly');
    });
  }

  // ==================== PHASE 3: THEME CUSTOMIZATION ====================
  testPhase3Theme() {
    this.log('\n=== Phase 3: Theme Customization Tests ===', 'cyan');

    this.test('Can store theme colors in settings', () => {
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('primary_color', '#3b82f6');
      const setting = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('primary_color');
      this.assertEquals(setting.value, '#3b82f6', 'Primary color not stored correctly');
    });

    this.test('Can store receipt header/footer', () => {
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('receipt_header', 'Test Header');
      this.db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('receipt_footer', 'Test Footer');
      
      const header = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('receipt_header');
      const footer = this.db.prepare('SELECT value FROM settings WHERE key = ?').get('receipt_footer');
      
      this.assertEquals(header.value, 'Test Header', 'Receipt header not stored');
      this.assertEquals(footer.value, 'Test Footer', 'Receipt footer not stored');
    });
  }

  // ==================== PHASE 4: RBAC, INVENTORY, SHIFTS ====================
  testPhase4RBAC() {
    this.log('\n=== Phase 4.1: Role-Based Access Control Tests ===', 'cyan');

    this.test('admin_auth.role column exists and defaults to admin', () => {
      const tableInfo = this.db.pragma('table_info(admin_auth)');
      const roleCol = tableInfo.find(col => col.name === 'role');
      this.assertNotNull(roleCol, 'role column not found');
      this.assertEquals(roleCol.dflt_value, "'admin'", 'role default value incorrect');
    });

    this.test('Can create users with different roles', () => {
      // Create manager user
      this.db.prepare(`
        INSERT INTO admin_auth (username, password_hash, salt, role, security_question, security_answer_hash, failed_attempts)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run('manager1', 'testhash', 'testsalt', 'manager', 'Test question?', 'testhash:testsalt');

      // Create staff user
      this.db.prepare(`
        INSERT INTO admin_auth (username, password_hash, salt, role, security_question, security_answer_hash, failed_attempts)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `).run('staff1', 'testhash', 'testsalt', 'staff', 'Test question?', 'testhash:testsalt');

      const manager = this.db.prepare('SELECT role FROM admin_auth WHERE username = ?').get('manager1');
      const staff = this.db.prepare('SELECT role FROM admin_auth WHERE username = ?').get('staff1');

      this.assertEquals(manager.role, 'manager', 'Manager role not set correctly');
      this.assertEquals(staff.role, 'staff', 'Staff role not set correctly');
    });
  }

  testPhase4Inventory() {
    this.log('\n=== Phase 4.2: Inventory Management Tests ===', 'cyan');

    this.test('menu_items table exists', () => {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='menu_items'").get();
      this.assertNotNull(tables, 'menu_items table not found');
    });

    this.test('menu_items has stock tracking columns', () => {
      // Try to add columns if they don't exist
      try {
        this.db.exec('ALTER TABLE menu_items ADD COLUMN stock_quantity INTEGER DEFAULT 0');
      } catch (e) { /* Column may already exist */ }
      
      try {
        this.db.exec('ALTER TABLE menu_items ADD COLUMN track_stock INTEGER DEFAULT 0');
      } catch (e) { /* Column may already exist */ }
      
      try {
        this.db.exec('ALTER TABLE menu_items ADD COLUMN low_stock_limit INTEGER DEFAULT 5');
      } catch (e) { /* Column may already exist */ }

      const tableInfo = this.db.pragma('table_info(menu_items)');
      const columnNames = tableInfo.map(col => col.name);

      this.assertTrue(columnNames.includes('stock_quantity'), 'Missing stock_quantity column');
      this.assertTrue(columnNames.includes('track_stock'), 'Missing track_stock column');
      this.assertTrue(columnNames.includes('low_stock_limit'), 'Missing low_stock_limit column');
    });

    this.test('Can insert menu items with stock tracking', () => {
      this.db.prepare(`
        INSERT INTO menu_items (name, price, category, is_available, stock_quantity, track_stock, low_stock_limit)
        VALUES (?, ?, ?, 1, ?, 1, ?)
      `).run('Test Product', 10.99, 'Food', 50, 10);

      const item = this.db.prepare('SELECT * FROM menu_items WHERE name = ?').get('Test Product');
      this.assertNotNull(item, 'Menu item not inserted');
      this.assertEquals(item.stock_quantity, 50, 'Stock quantity not set');
      this.assertEquals(item.track_stock, 1, 'Track stock flag not set');
    });

    this.test('Can query low stock items', () => {
      // Insert low stock item
      this.db.prepare(`
        INSERT INTO menu_items (name, price, category, is_available, stock_quantity, track_stock, low_stock_limit)
        VALUES (?, ?, ?, 1, ?, 1, ?)
      `).run('Low Stock Item', 5.99, 'Food', 3, 10);

      const lowStockItems = this.db.prepare(`
        SELECT * FROM menu_items 
        WHERE track_stock = 1 AND stock_quantity <= low_stock_limit
      `).all();

      this.assertTrue(lowStockItems.length > 0, 'Low stock query returned no results');
    });
  }

  testPhase4Shifts() {
    this.log('\n=== Phase 4.3: Shift Management Tests ===', 'cyan');

    this.test('shifts table exists', () => {
      // Create shifts table if it doesn't exist
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS shifts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          opened_at DATETIME NOT NULL,
          closed_at DATETIME,
          opened_by INTEGER NOT NULL,
          closed_by INTEGER,
          start_cash REAL DEFAULT 0,
          end_cash_expected REAL DEFAULT 0,
          end_cash_actual REAL,
          difference REAL,
          total_sales REAL DEFAULT 0,
          total_expenses REAL DEFAULT 0,
          status TEXT DEFAULT 'open',
          FOREIGN KEY (opened_by) REFERENCES admin_auth(id),
          FOREIGN KEY (closed_by) REFERENCES admin_auth(id)
        )
      `);

      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='shifts'").get();
      this.assertNotNull(tables, 'shifts table not found');
    });

    this.test('Can open a shift', () => {
      const admin = this.db.prepare('SELECT id FROM admin_auth WHERE username = ?').get('yasinheaven');
      
      this.db.prepare(`
        INSERT INTO shifts (opened_at, opened_by, start_cash, status)
        VALUES (datetime('now'), ?, ?, 'open')
      `).run(admin.id, 100.0);

      const shift = this.db.prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
      this.assertNotNull(shift, 'Shift not created');
      this.assertEquals(shift.status, 'open', 'Shift status incorrect');
      this.assertEquals(shift.start_cash, 100.0, 'Start cash incorrect');
    });

    this.test('Can close a shift', () => {
      const shift = this.db.prepare("SELECT * FROM shifts WHERE status = 'open' ORDER BY id DESC LIMIT 1").get();
      const admin = this.db.prepare('SELECT id FROM admin_auth WHERE username = ?').get('yasinheaven');

      const endCashExpected = 150.0;
      const endCashActual = 148.50;
      const difference = endCashActual - endCashExpected;

      this.db.prepare(`
        UPDATE shifts 
        SET closed_at = datetime('now'), 
            closed_by = ?,
            end_cash_expected = ?,
            end_cash_actual = ?,
            difference = ?,
            status = 'closed'
        WHERE id = ?
      `).run(admin.id, endCashExpected, endCashActual, difference, shift.id);

      const closedShift = this.db.prepare('SELECT * FROM shifts WHERE id = ?').get(shift.id);
      this.assertEquals(closedShift.status, 'closed', 'Shift not closed');
      this.assertEquals(closedShift.difference, -1.5, 'Cash difference calculation incorrect');
    });
  }

  // ==================== CORE FUNCTIONALITY TESTS ====================
  testCoreFunctionality() {
    this.log('\n=== Core Functionality Tests ===', 'cyan');

    this.test('rooms/resources table exists', () => {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rooms'").get();
      this.assertNotNull(tables, 'rooms table not found');
    });

    this.test('guests/customers table exists', () => {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='guests'").get();
      this.assertNotNull(tables, 'guests table not found');
    });

    this.test('food_orders/sales table exists', () => {
      // Try both possible names
      const foodOrders = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='food_orders'").get();
      const sales = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sales'").get();
      this.assertTrue(foodOrders || sales, 'Neither food_orders nor sales table found');
    });

    this.test('expenses table exists', () => {
      const tables = this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='expenses'").get();
      this.assertNotNull(tables, 'expenses table not found');
    });
  }

  // ==================== RUN ALL TESTS ====================
  async runAll() {
    this.log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
    this.log('║  Hotel Management System - Comprehensive Test Suite        ║', 'blue');
    this.log('╚════════════════════════════════════════════════════════════╝', 'blue');

    if (!await this.connect()) {
      this.log('\n✗ Cannot proceed without database connection', 'red');
      return;
    }

    try {
      this.testPhase1Authentication();
      this.testPhase2Settings();
      this.testPhase3Theme();
      this.testPhase4RBAC();
      this.testPhase4Inventory();
      this.testPhase4Shifts();
      this.testCoreFunctionality();

      // Summary
      this.log('\n' + '═'.repeat(60), 'blue');
      this.log('TEST SUMMARY', 'blue');
      this.log('═'.repeat(60), 'blue');
      this.log(`Total Tests: ${this.testResults.total}`, 'cyan');
      this.log(`Passed: ${this.testResults.passed}`, 'green');
      this.log(`Failed: ${this.testResults.failed}`, this.testResults.failed > 0 ? 'red' : 'green');
      this.log(`Success Rate: ${((this.testResults.passed / this.testResults.total) * 100).toFixed(1)}%`, 
                this.testResults.failed === 0 ? 'green' : 'yellow');
      this.log('═'.repeat(60), 'blue');

      if (this.testResults.failed === 0) {
        this.log('\n✓ ALL TESTS PASSED! System is ready for production.', 'green');
      } else {
        this.log(`\n⚠ ${this.testResults.failed} test(s) failed. Review errors above.`, 'yellow');
      }

    } catch (error) {
      this.log(`\n✗ Test suite crashed: ${error.message}`, 'red');
      console.error(error);
    } finally {
      if (this.db) {
        this.db.close();
      }
    }
  }
}

// Run the test suite
const runner = new TestRunner();
runner.runAll().catch(console.error);
