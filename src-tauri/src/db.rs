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
    // Rooms table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT UNIQUE NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )",
        [],
    )?;
    
    // Guests table
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
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (room_id) REFERENCES rooms(id)
        )",
        [],
    )?;
    
    // Menu items table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            price REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1
        )",
        [],
    )?;
    
    // Food orders table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS food_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER,
            customer_type TEXT NOT NULL,
            customer_name TEXT,
            created_at TEXT NOT NULL,
            paid INTEGER NOT NULL DEFAULT 0,
            paid_at TEXT,
            total_amount REAL NOT NULL,
            FOREIGN KEY (guest_id) REFERENCES guests(id)
        )",
        [],
    )?;
    
    // Order items table
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
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
        )",
        [],
    )?;
    
    // Expenses table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL
        )",
        [],
    )?;
    
    // Admin settings table for password storage
    conn.execute(
        "CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY,
            password_hash TEXT NOT NULL,
            security_question TEXT,
            security_answer_hash TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )?;
    
    // Create indexes after all tables are created
    create_indexes(conn)?;
    
    Ok(())
}

fn create_indexes(conn: &Connection) -> SqliteResult<()> {
    conn.execute("CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_food_orders_created_at ON food_orders(created_at)", [])?;
    conn.execute("CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)", [])?;
    
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
