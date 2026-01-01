use rusqlite::{Connection, Result as SqliteResult, Transaction};
use std::path::PathBuf;
use chrono::Utc;
use std::collections::HashSet;

pub fn get_db_connection() -> SqliteResult<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;
    
    // Set pragmas for performance and data integrity
    // PRAGMA journal_mode returns the previous mode, so we need to handle it properly
    let _: String = conn.query_row("PRAGMA journal_mode=WAL", [], |row| row.get(0))?;
    conn.execute("PRAGMA synchronous=NORMAL", [])?;
    conn.execute("PRAGMA foreign_keys=ON", [])?;
    
    Ok(conn)
}

pub fn get_db_path() -> PathBuf {
    // For now, use the current project structure during development
    let mut path = std::env::current_dir().unwrap();
    if path.ends_with("src-tauri") {
        path = path.parent().unwrap().to_path_buf();
    }
    path.push("db");
    
    // Ensure db directory exists
    if !path.exists() {
        std::fs::create_dir_all(&path).unwrap();
    }
    
    path.push("hotel.db");
    path
}

pub fn initialize_database() -> SqliteResult<()> {
    let conn = get_db_connection()?;
    
    // Create initial schema if not exists
    create_initial_schema(&conn)?;
    
    // Verify and fix database schema
    verify_and_fix_schema(&conn)?;
    
    // Seed initial data
    seed_initial_data(&conn)?;
    
    println!("Database initialized successfully - v3");
    Ok(())
}

fn create_initial_schema(conn: &Connection) -> SqliteResult<()> {
    // Authentication tables (required by offline_auth.rs)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_auth (
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
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_sessions (
            session_token TEXT PRIMARY KEY,
            admin_id INTEGER NOT NULL,
            expires_at TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES admin_auth(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Minimal audit log (required by offline_auth.rs)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            username TEXT,
            event_type TEXT NOT NULL,
            ip_address TEXT,
            user_agent TEXT
        )",
        [],
    )?;

    // App settings (currency/locale/business profile)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT ''
        )",
        [],
    )?;

    // If this database is from an older version, rename legacy tables BEFORE we create new ones.
    ensure_business_table_renames(conn)?;

    // Resources table (renamed from rooms)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS resources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT UNIQUE NOT NULL,
            room_type TEXT NOT NULL DEFAULT 'Standard',
            daily_rate REAL NOT NULL DEFAULT 100.0,
            is_occupied INTEGER NOT NULL DEFAULT 0,
            guest_id INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            resource_type TEXT NOT NULL DEFAULT 'Room',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES customers(id)
        )",
        [],
    )?;
    
    // Customers table (renamed from guests)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS customers (
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
        )",
        [],
    )?;
    
    // Menu items table with created_at/updated_at and inventory tracking
    conn.execute(
        "CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            price REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            stock_quantity INTEGER DEFAULT 0,
            track_stock INTEGER DEFAULT 0,
            low_stock_limit INTEGER DEFAULT 5,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Sales table (renamed from food_orders)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER,
            customer_type TEXT NOT NULL,
            customer_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid INTEGER NOT NULL DEFAULT 0,
            paid_at DATETIME,
            total_amount REAL NOT NULL,
            FOREIGN KEY (guest_id) REFERENCES customers(id) ON DELETE SET NULL
        )",
        [],
    )?;
    
    // Sale items table (renamed from order_items)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            menu_item_id INTEGER,
            item_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            line_total REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES sales(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE SET NULL
        )",
        [],
    )?;
    
    // Expenses table with created_at
    conn.execute(
        "CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Shifts table for Z-reports (end-of-day closing)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS shifts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            closed_at DATETIME,
            opened_by TEXT,
            closed_by TEXT,
            start_cash REAL DEFAULT 0.0,
            end_cash_expected REAL,
            end_cash_actual REAL,
            difference REAL,
            total_sales REAL DEFAULT 0.0,
            total_expenses REAL DEFAULT 0.0,
            status TEXT DEFAULT 'open',
            notes TEXT
        )",
        [],
    )?;
    
    // Admin settings table for password storage with timestamps
    // Phase 3 (White-labeling): add optional branding fields
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            security_question TEXT,
            security_answer_hash TEXT,
            business_logo_path TEXT,
            primary_color TEXT,
            receipt_header TEXT,
            receipt_footer TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Create indexes after all tables are created AND migrations are run
    // (moved to after migrate_database)
    
    // Create triggers for automatic updated_at timestamps
    create_update_triggers(conn)?;
    
    // Run migrations for existing databases
    migrate_database(conn)?;
    
    // Create indexes after migrations are complete
    create_indexes(conn)?;
    
    Ok(())
}

fn create_update_triggers(conn: &Connection) -> SqliteResult<()> {
    // Trigger for resources table
    // NOTE: Resources table doesn't have updated_at column, so no trigger needed
    // conn.execute(
    //     "CREATE TRIGGER IF NOT EXISTS trigger_rooms_updated_at 
    //      AFTER UPDATE ON resources
    //      FOR EACH ROW 
    //      BEGIN
    //         UPDATE resources SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    //      END",
    //     [],
    // )?;
    
    // Trigger for customers table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_customers_updated_at 
         AFTER UPDATE ON customers
         FOR EACH ROW 
         BEGIN
            UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;

    // Trigger for admin_auth table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_admin_auth_updated_at 
         AFTER UPDATE ON admin_auth
         FOR EACH ROW 
         BEGIN
            UPDATE admin_auth SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
    // NOTE: menu_items table doesn't have updated_at column, so no trigger needed
    // conn.execute(
    //     "CREATE TRIGGER IF NOT EXISTS trigger_menu_items_updated_at 
    //      AFTER UPDATE ON menu_items
    //      FOR EACH ROW 
    //      BEGIN
    //         UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    //      END",
    //     [],
    // )?;
    
    // Trigger for admin_settings table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_admin_settings_updated_at 
         AFTER UPDATE ON admin_settings
         FOR EACH ROW 
         BEGIN
            UPDATE admin_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
    Ok(())
}

fn create_indexes(conn: &Connection) -> SqliteResult<()> {
    // Primary operational indexes
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_customers_room_id ON customers(room_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_guest_id ON sales(guest_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sale_items_order_id ON sale_items(order_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sale_items_menu_item_id ON sale_items(menu_item_id)", []);
    
    // Timestamp indexes for analytics and filtering (safe with error handling)
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_paid_at ON sales(paid_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at)", []);
    
    // Payment status index for financial reports
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_sales_paid ON sales(paid)", []);
    
    println!("Database indexes created successfully");
    Ok(())
}

fn seed_initial_data(_conn: &Connection) -> SqliteResult<()> {
    // No default resources - users can add their own resources
    
    // No default menu items - users can add their own menu items
    
    println!("Initial data seeded successfully");
    Ok(())
}

#[allow(dead_code)]
pub fn start_transaction(conn: &Connection) -> SqliteResult<Transaction<'_>> {
    conn.unchecked_transaction()
}

pub fn validate_date_format(date: &str) -> Result<(), String> {
    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| format!("Invalid date format: {}. Expected YYYY-MM-DD", date))?;
    Ok(())
}

pub fn validate_positive_amount(amount: f64, field_name: &str) -> Result<(), String> {
    if amount < 0.0 {
        return Err(format!("{} must be >= 0", field_name));
    }
    Ok(())
}

pub fn get_current_timestamp() -> String {
    Utc::now().to_rfc3339()
}

#[allow(dead_code)]
pub fn is_room_available(room_id: i64) -> SqliteResult<bool> {
    let conn = get_db_connection()?;
    
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM customers WHERE room_id = ?1 AND status = 'active'",
        [room_id],
        |row| row.get(0)
    )?;
    
    Ok(count == 0)
}

fn migrate_database(conn: &Connection) -> SqliteResult<()> {
    // 2025-12: Rename core tables to generic business names (one-time migration)
    ensure_business_table_renames(conn)?;

    // Add room_type column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE resources ADD COLUMN room_type TEXT NOT NULL DEFAULT 'Standard'",
        [],
    );
    
    // Add daily_rate column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE resources ADD COLUMN daily_rate REAL NOT NULL DEFAULT 100.0",
        [],
    );
    
    // Add is_occupied column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE resources ADD COLUMN is_occupied INTEGER NOT NULL DEFAULT 0",
        [],
    );
    
    // Add guest_id column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE resources ADD COLUMN guest_id INTEGER",
        [],
    );

    // Add resource_type column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE resources ADD COLUMN resource_type TEXT NOT NULL DEFAULT 'Room'",
        [],
    );
    
    // Add category column to menu_items if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE menu_items ADD COLUMN category TEXT NOT NULL DEFAULT 'Main Course'",
        [],
    );
    
    // Add is_available column to menu_items if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE menu_items ADD COLUMN is_available INTEGER NOT NULL DEFAULT 1",
        [],
    );

    // ===== NEW MIGRATIONS FOR SCHEMA CONSISTENCY =====
    
    // Fix sales table schema inconsistencies
    // Add created_at column if it doesn't exist (in case we have order_date instead)
    let _ = conn.execute(
        "ALTER TABLE sales ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        [],
    );
    
    // Add paid column if it doesn't exist (in case we have is_paid instead) 
    let _ = conn.execute(
        "ALTER TABLE sales ADD COLUMN paid INTEGER DEFAULT 0",
        [],
    );
    
    // Add customer_type and customer_name if they don't exist
    let _ = conn.execute(
        "ALTER TABLE sales ADD COLUMN customer_type TEXT DEFAULT 'GUEST'",
        [],
    );
    
    let _ = conn.execute(
        "ALTER TABLE sales ADD COLUMN customer_name TEXT",
        [],
    );

    // Update the paid column to match is_paid if both exist
    let _ = conn.execute(
        "UPDATE sales SET paid = is_paid WHERE is_paid IS NOT NULL AND paid IS NULL",
        [],
    );

    // Update created_at from order_date if both exist  
    let _ = conn.execute(
        "UPDATE sales SET created_at = order_date WHERE order_date IS NOT NULL AND created_at IS NULL",
        [],
    );

    // Handle sale items table naming inconsistency
    // Check if food_order_items exists and sale_items doesn't, then rename it
    let table_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='food_order_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);
    
    let sale_items_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);

    if table_exists && !sale_items_exists {
        // Rename food_order_items to sale_items
        let _ = conn.execute("ALTER TABLE food_order_items RENAME TO sale_items", []);
        println!("Renamed food_order_items table to sale_items");
    }

    // Add item_name column to sale_items if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE sale_items ADD COLUMN item_name TEXT DEFAULT ''",
        [],
    );

    // Update item_name from menu_items if it's empty
    let _ = conn.execute(
        "UPDATE sale_items SET item_name = (
            SELECT name FROM menu_items WHERE menu_items.id = sale_items.menu_item_id
        ) WHERE item_name = '' OR item_name IS NULL",
        [],
    );

    // Add status column to customers if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE customers ADD COLUMN status TEXT DEFAULT 'active'",
        [],
    );

    // Add loyalty_points column to customers if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE customers ADD COLUMN loyalty_points INTEGER NOT NULL DEFAULT 0",
        [],
    );

    // Update status from is_active if both exist
    let _ = conn.execute(
        "UPDATE customers SET status = CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END 
         WHERE is_active IS NOT NULL AND (status IS NULL OR status = '')",
        [],
    );

    // Ensure audit_log schema is compatible with offline_auth logging
    ensure_audit_log_schema(conn)?;

    // Phase 3: White-labeling fields on admin_settings (safe no-op if already present)
    let _ = conn.execute(
        "ALTER TABLE admin_settings ADD COLUMN business_logo_path TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE admin_settings ADD COLUMN primary_color TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE admin_settings ADD COLUMN receipt_header TEXT",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE admin_settings ADD COLUMN receipt_footer TEXT",
        [],
    );

    // Phase 4: RBAC and Inventory Management (safe no-op if already present)
    let _ = conn.execute(
        "ALTER TABLE admin_auth ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE menu_items ADD COLUMN stock_quantity INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE menu_items ADD COLUMN track_stock INTEGER DEFAULT 0",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE menu_items ADD COLUMN low_stock_limit INTEGER DEFAULT 5",
        [],
    );

    println!("Database migration completed successfully");
    Ok(())
}

fn ensure_audit_log_schema(conn: &Connection) -> SqliteResult<()> {
    let audit_log_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='audit_log'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    if !audit_log_exists {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                username TEXT,
                event_type TEXT NOT NULL,
                ip_address TEXT,
                user_agent TEXT
            )",
            [],
        )?;
        return Ok(());
    }

    let mut existing: HashSet<String> = HashSet::new();
    let mut stmt = conn.prepare("PRAGMA table_info(audit_log)")?;
    let rows = stmt.query_map([], |row| Ok(row.get::<_, String>(1)?))?;
    for row in rows {
        existing.insert(row?);
    }

    if !existing.contains("username") {
        let _ = conn.execute("ALTER TABLE audit_log ADD COLUMN username TEXT", []);
    }
    if !existing.contains("ip_address") {
        let _ = conn.execute("ALTER TABLE audit_log ADD COLUMN ip_address TEXT", []);
    }
    if !existing.contains("user_agent") {
        let _ = conn.execute("ALTER TABLE audit_log ADD COLUMN user_agent TEXT", []);
    }

    Ok(())
}

fn verify_and_fix_schema(conn: &Connection) -> SqliteResult<()> {
    println!("Verifying database schema consistency...");
    
    // Check if sales has the correct columns
    let mut has_created_at = false;
    let mut has_paid = false;
    let mut has_customer_type = false;
    
    let mut stmt = conn.prepare("PRAGMA table_info(sales)")?;
    let rows = stmt.query_map([], |row| {
        Ok(row.get::<_, String>(1)?) // column name
    })?;
    
    for row in rows {
        match row? {
            name if name == "created_at" => has_created_at = true,
            name if name == "paid" => has_paid = true,
            name if name == "customer_type" => has_customer_type = true,
            _ => {}
        }
    }
    
    println!("Sales schema check: created_at={}, paid={}, customer_type={}", 
             has_created_at, has_paid, has_customer_type);
    
    // Check if sale_items table exists
    let sale_items_exists = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='sale_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);
    
    println!("Sale items table exists: {}", sale_items_exists);
    
    // Check if sale_items has item_name column
    let mut has_item_name = false;
    if sale_items_exists {
        let mut stmt = conn.prepare("PRAGMA table_info(sale_items)")?;
        let rows = stmt.query_map([], |row| {
            Ok(row.get::<_, String>(1)?) // column name
        })?;
        
        for row in rows {
            if row? == "item_name" {
                has_item_name = true;
                break;
            }
        }
    }
    
    println!("Sale items has item_name: {}", has_item_name);
    
    // Run migrations to fix any issues
    migrate_database(conn)?;
    
    println!("Schema verification and fixes completed");
    Ok(())
}

fn ensure_business_table_renames(conn: &Connection) -> SqliteResult<()> {
    // Rooms -> resources
    let rooms_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='rooms'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    let resources_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='resources'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    if rooms_exists && !resources_exists {
        let _ = conn.execute("ALTER TABLE rooms RENAME TO resources", []);
    }

    // Guests -> customers
    let guests_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='guests'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    let customers_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='customers'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    if guests_exists && !customers_exists {
        let _ = conn.execute("ALTER TABLE guests RENAME TO customers", []);
    }

    // food_orders -> sales
    let food_orders_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='food_orders'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    let sales_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sales'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    if food_orders_exists && !sales_exists {
        let _ = conn.execute("ALTER TABLE food_orders RENAME TO sales", []);
    }

    // order_items -> sale_items
    let order_items_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='order_items'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    let sale_items_exists: bool = conn
        .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='sale_items'")
        .and_then(|mut stmt| stmt.query_row([], |_| Ok(true)).or_else(|_| Ok(false)))
        .unwrap_or(false);

    if order_items_exists && !sale_items_exists {
        let _ = conn.execute("ALTER TABLE order_items RENAME TO sale_items", []);
    }

    // Ensure resource_type is set for existing resources.
    // Accept older values like 'ROOM' and normalize to title-case values.
    // (Safe even if the column doesn't exist yet; ignored.)
    let _ = conn.execute(
        "UPDATE resources
         SET resource_type = 'Room'
         WHERE resource_type IS NULL
            OR TRIM(resource_type) = ''
            OR UPPER(resource_type) = 'ROOM'",
        [],
    );

    Ok(())
}
