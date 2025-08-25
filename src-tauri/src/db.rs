use rusqlite::{Connection, Result as SqliteResult, Transaction};
use std::path::PathBuf;
use chrono::Utc;

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
    
    // Try to create schema_meta table first
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_meta (
            id INTEGER PRIMARY KEY,
            version INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    // Check if database is already initialized
    let mut schema_version = 0;
    if let Ok(version) = conn.query_row(
        "SELECT version FROM schema_meta WHERE id = 1",
        [],
        |row| row.get::<_, i32>(0)
    ) {
        schema_version = version;
    }
    
    if schema_version < 1 {
        create_initial_schema(&conn)?;
        seed_initial_data(&conn)?;
        
        // Set schema version
        conn.execute(
            "INSERT OR REPLACE INTO schema_meta (id, version, updated_at) VALUES (1, 1, ?1)",
            rusqlite::params![&Utc::now().to_rfc3339()],
        )?;
    }
    
    println!("Database initialized successfully - v3");
    Ok(())
}

fn create_initial_schema(conn: &Connection) -> SqliteResult<()> {
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
    
    // Create indexes after all tables are created
    create_indexes(conn)?;
    
    // Create triggers for automatic updated_at timestamps
    create_update_triggers(conn)?;
    
    // Run migrations for existing databases
    migrate_database(conn)?;
    
    Ok(())
}

fn create_update_triggers(conn: &Connection) -> SqliteResult<()> {
    // Trigger for rooms table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_rooms_updated_at 
         AFTER UPDATE ON rooms
         FOR EACH ROW 
         BEGIN
            UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
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
    
    // Trigger for menu_items table
    conn.execute(
        "CREATE TRIGGER IF NOT EXISTS trigger_menu_items_updated_at 
         AFTER UPDATE ON menu_items
         FOR EACH ROW 
         BEGIN
            UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END",
        [],
    )?;
    
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
    conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_room_id ON guests(room_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_guest_id ON food_orders(guest_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id)", [])?;
    
    // Timestamp indexes for analytics and filtering
    conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_created_at ON food_orders(created_at)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_paid_at ON food_orders(paid_at)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_created_at ON guests(created_at)", [])?;
    
    // Payment status index for financial reports
    conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_paid ON food_orders(paid)", [])?;
    
    Ok(())
}

fn seed_initial_data(conn: &Connection) -> SqliteResult<()> {
    // Insert sample rooms
    let rooms = vec![
        "101", "102", "103", "104", "105",
        "201", "202", "203", "204", "205",
        "301", "302", "303", "304", "305"
    ];
    
    for room_num in rooms {
        conn.execute(
            "INSERT OR IGNORE INTO rooms (number, is_active) VALUES (?1, 1)",
            rusqlite::params![room_num],
        )?;
    }
    
    // Insert sample menu items
    let menu_items = vec![
        ("Tea", 50.0),
        ("Coffee", 80.0),
        ("Breakfast Combo", 350.0),
        ("Lunch Special", 450.0),
        ("Dinner Combo", 550.0),
        ("Sandwich", 200.0),
        ("Burger", 300.0),
        ("Pizza Slice", 250.0),
        ("Cold Drink", 60.0),
        ("Fresh Juice", 120.0),
    ];
    
    for (name, price) in menu_items {
        conn.execute(
            "INSERT OR IGNORE INTO menu_items (name, price, is_active) VALUES (?1, ?2, 1)",
            rusqlite::params![name, price],
        )?;
    }
    
    println!("Initial data seeded successfully");
    Ok(())
}

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
    
    Ok(())
}
