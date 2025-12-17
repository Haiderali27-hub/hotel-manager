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

    // Rooms table with created_at/updated_at
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT UNIQUE NOT NULL,
            room_type TEXT NOT NULL DEFAULT 'Single Room',
            daily_rate REAL NOT NULL DEFAULT 100.0,
            is_occupied INTEGER NOT NULL DEFAULT 0,
            guest_id INTEGER,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )",
        [],
    )?;
    
    // Guests table with proper foreign key and timestamps
    conn.execute(
        "CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            room_id INTEGER NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT,
            daily_rate REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
        )",
        [],
    )?;
    
    // Menu items table with created_at/updated_at
    conn.execute(
        "CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            price REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;
    
    // Food orders table with proper foreign key and timestamps
    conn.execute(
        "CREATE TABLE IF NOT EXISTS food_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER,
            customer_type TEXT NOT NULL,
            customer_name TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid INTEGER NOT NULL DEFAULT 0,
            paid_at DATETIME,
            total_amount REAL NOT NULL,
            FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
        )",
        [],
    )?;
    
    // Order items table with proper foreign keys
    conn.execute(
        "CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            menu_item_id INTEGER,
            item_name TEXT NOT NULL,
            unit_price REAL NOT NULL,
            quantity INTEGER NOT NULL,
            line_total REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE,
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
    
    // Admin settings table for password storage with timestamps
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            security_question TEXT,
            security_answer_hash TEXT,
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
    // Trigger for rooms table
    // NOTE: Rooms table doesn't have updated_at column, so no trigger needed
    // conn.execute(
    //     "CREATE TRIGGER IF NOT EXISTS trigger_rooms_updated_at 
    //      AFTER UPDATE ON rooms
    //      FOR EACH ROW 
    //      BEGIN
    //         UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    //      END",
    //     [],
    // )?;
    
    // Trigger for guests table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_guests_updated_at 
         AFTER UPDATE ON guests
         FOR EACH ROW 
         BEGIN
            UPDATE guests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
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
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_room_id ON guests(room_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_guest_id ON food_orders(guest_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id)", []);
    
    // Timestamp indexes for analytics and filtering (safe with error handling)
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_created_at ON food_orders(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_paid_at ON food_orders(paid_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)", []);
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_created_at ON guests(created_at)", []);
    
    // Payment status index for financial reports
    let _ = conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_paid ON food_orders(paid)", []);
    
    println!("Database indexes created successfully");
    Ok(())
}

fn seed_initial_data(_conn: &Connection) -> SqliteResult<()> {
    // No default rooms - users can add their own rooms
    
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
        "SELECT COUNT(*) FROM guests WHERE room_id = ?1 AND status = 'active'",
        [room_id],
        |row| row.get(0)
    )?;
    
    Ok(count == 0)
}

fn migrate_database(conn: &Connection) -> SqliteResult<()> {
    // Add room_type column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN room_type TEXT NOT NULL DEFAULT 'Single Room'",
        [],
    );
    
    // Add daily_rate column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN daily_rate REAL NOT NULL DEFAULT 100.0",
        [],
    );
    
    // Add is_occupied column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN is_occupied INTEGER NOT NULL DEFAULT 0",
        [],
    );
    
    // Add guest_id column if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE rooms ADD COLUMN guest_id INTEGER",
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
    
    // Fix food_orders table schema inconsistencies
    // Add created_at column if it doesn't exist (in case we have order_date instead)
    let _ = conn.execute(
        "ALTER TABLE food_orders ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        [],
    );
    
    // Add paid column if it doesn't exist (in case we have is_paid instead) 
    let _ = conn.execute(
        "ALTER TABLE food_orders ADD COLUMN paid INTEGER DEFAULT 0",
        [],
    );
    
    // Add customer_type and customer_name if they don't exist
    let _ = conn.execute(
        "ALTER TABLE food_orders ADD COLUMN customer_type TEXT DEFAULT 'GUEST'",
        [],
    );
    
    let _ = conn.execute(
        "ALTER TABLE food_orders ADD COLUMN customer_name TEXT",
        [],
    );

    // Update the paid column to match is_paid if both exist
    let _ = conn.execute(
        "UPDATE food_orders SET paid = is_paid WHERE is_paid IS NOT NULL AND paid IS NULL",
        [],
    );

    // Update created_at from order_date if both exist  
    let _ = conn.execute(
        "UPDATE food_orders SET created_at = order_date WHERE order_date IS NOT NULL AND created_at IS NULL",
        [],
    );

    // Handle order items table naming inconsistency
    // Check if food_order_items exists and order_items doesn't, then rename it
    let table_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='food_order_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);
    
    let order_items_exists: bool = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);

    if table_exists && !order_items_exists {
        // Rename food_order_items to order_items
        let _ = conn.execute("ALTER TABLE food_order_items RENAME TO order_items", []);
        println!("Renamed food_order_items table to order_items");
    }

    // Add item_name column to order_items if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE order_items ADD COLUMN item_name TEXT DEFAULT ''",
        [],
    );

    // Update item_name from menu_items if it's empty
    let _ = conn.execute(
        "UPDATE order_items SET item_name = (
            SELECT name FROM menu_items WHERE menu_items.id = order_items.menu_item_id
        ) WHERE item_name = '' OR item_name IS NULL",
        [],
    );

    // Add status column to guests if it doesn't exist
    let _ = conn.execute(
        "ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'active'",
        [],
    );

    // Update status from is_active if both exist
    let _ = conn.execute(
        "UPDATE guests SET status = CASE WHEN is_active = 1 THEN 'active' ELSE 'inactive' END 
         WHERE is_active IS NOT NULL AND (status IS NULL OR status = '')",
        [],
    );

    // Ensure audit_log schema is compatible with offline_auth logging
    ensure_audit_log_schema(conn)?;

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
    
    // Check if food_orders has the correct columns
    let mut has_created_at = false;
    let mut has_paid = false;
    let mut has_customer_type = false;
    
    let mut stmt = conn.prepare("PRAGMA table_info(food_orders)")?;
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
    
    println!("Food orders schema check: created_at={}, paid={}, customer_type={}", 
             has_created_at, has_paid, has_customer_type);
    
    // Check if order_items table exists
    let order_items_exists = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='order_items'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
                .or_else(|_| Ok(false))
        })
        .unwrap_or(false);
    
    println!("Order items table exists: {}", order_items_exists);
    
    // Check if order_items has item_name column
    let mut has_item_name = false;
    if order_items_exists {
        let mut stmt = conn.prepare("PRAGMA table_info(order_items)")?;
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
    
    println!("Order items has item_name: {}", has_item_name);
    
    // Run migrations to fix any issues
    migrate_database(conn)?;
    
    println!("Schema verification and fixes completed");
    Ok(())
}
