use rusqlite::{Connection, Result};
use std::fs;
use std::path::Path;

/// Reset database with comprehensive seed data for testing and development
#[tauri::command]
pub fn reset_database() -> Result<String, String> {
    let db_path = get_database_path()?;
    
    // Close any existing connections and remove the database file
    if Path::new(&db_path).exists() {
        fs::remove_file(&db_path).map_err(|e| format!("Failed to remove database: {}", e))?;
    }
    
    // Create new database with schema and seed data
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to create database: {}", e))?;
    
    // Create all tables with proper schema
    create_database_schema(&conn)?;
    
    // Insert comprehensive seed data
    insert_seed_data(&conn)?;
    
    Ok("Database reset successfully with comprehensive seed data".to_string())
}

/// Get the database file path
#[tauri::command] 
pub fn get_database_path() -> Result<String, String> {
    // Use the same path logic as your main database connection
    let app_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get app data directory".to_string())?
        .join("hotel-app");
    
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create app directory: {}", e))?;
    
    let db_path = app_data_dir.join("hotel.db");
    Ok(db_path.to_string_lossy().to_string())
}

fn create_database_schema(conn: &Connection) -> Result<(), String> {
    let schema_sql = r#"
        -- Enable foreign key constraints
        PRAGMA foreign_keys = ON;
        PRAGMA journal_mode = WAL;
        
        -- Rooms table with updated_at
        CREATE TABLE IF NOT EXISTS rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT NOT NULL UNIQUE,
            daily_rate REAL NOT NULL DEFAULT 0.0,
            is_occupied INTEGER NOT NULL DEFAULT 0,
            guest_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
        );
        
        -- Guests table with proper foreign key constraint
        CREATE TABLE IF NOT EXISTS guests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            room_id INTEGER NOT NULL,
            check_in TEXT NOT NULL,
            check_out TEXT,
            daily_rate REAL NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE RESTRICT
        );
        
        -- Menu items table with updated_at
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price REAL NOT NULL,
            category TEXT NOT NULL DEFAULT 'General',
            is_available INTEGER NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Food orders table with paid_at timestamp
        CREATE TABLE IF NOT EXISTS food_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER NOT NULL,
            order_date TEXT NOT NULL,
            total_amount REAL NOT NULL DEFAULT 0.0,
            is_paid INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            paid_at DATETIME,
            FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL
        );
        
        -- Food order items table with proper foreign keys
        CREATE TABLE IF NOT EXISTS food_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            menu_item_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            unit_price REAL NOT NULL,
            line_total REAL GENERATED ALWAYS AS (quantity * unit_price) STORED,
            FOREIGN KEY (order_id) REFERENCES food_orders(id) ON DELETE CASCADE,
            FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
        );
        
        -- Expenses table with created_at
        CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            amount REAL NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Admin settings table with updated_at
        CREATE TABLE IF NOT EXISTS admin_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_guests_active ON guests(is_active);
        CREATE INDEX IF NOT EXISTS idx_guests_room ON guests(room_id);
        CREATE INDEX IF NOT EXISTS idx_food_orders_guest ON food_orders(guest_id);
        CREATE INDEX IF NOT EXISTS idx_food_orders_date ON food_orders(order_date);
        CREATE INDEX IF NOT EXISTS idx_food_orders_paid_at ON food_orders(paid_at);
        CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
        CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
        CREATE INDEX IF NOT EXISTS idx_rooms_occupied ON rooms(is_occupied);
        
        -- Create triggers for automatic updated_at timestamps
        CREATE TRIGGER IF NOT EXISTS trigger_rooms_updated_at 
         AFTER UPDATE ON rooms
         FOR EACH ROW 
         BEGIN
            UPDATE rooms SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END;
        
        CREATE TRIGGER IF NOT EXISTS trigger_guests_updated_at 
         AFTER UPDATE ON guests
         FOR EACH ROW 
         BEGIN
            UPDATE guests SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END;
        
        CREATE TRIGGER IF NOT EXISTS trigger_menu_items_updated_at 
         AFTER UPDATE ON menu_items
         FOR EACH ROW 
         BEGIN
            UPDATE menu_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END;
        
        CREATE TRIGGER IF NOT EXISTS trigger_admin_settings_updated_at 
         AFTER UPDATE ON admin_settings
         FOR EACH ROW 
         BEGIN
            UPDATE admin_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
         END;
    "#;
    
    conn.execute_batch(schema_sql).map_err(|e| format!("Failed to create schema: {}", e))?;
    Ok(())
}

fn insert_seed_data(conn: &Connection) -> Result<(), String> {
    // Insert comprehensive seed data
    let seed_sql = r#"
        -- Clear any existing data
        DELETE FROM food_order_items;
        DELETE FROM food_orders;
        DELETE FROM expenses;
        DELETE FROM guests;
        DELETE FROM rooms;
        DELETE FROM menu_items;
        DELETE FROM admin_settings;
        
        -- Rooms (20 rooms across different tiers)
        INSERT INTO rooms (number, daily_rate) VALUES
          ('101', 120.00), ('102', 120.00), ('103', 120.00), ('104', 120.00), ('105', 120.00),
          ('106', 120.00), ('107', 120.00), ('108', 120.00),
          ('201', 180.00), ('202', 180.00), ('203', 180.00), ('204', 180.00), ('205', 180.00),
          ('206', 180.00), ('207', 180.00), ('208', 180.00),
          ('301', 250.00), ('302', 250.00), ('303', 280.00), ('304', 320.00);
        
        -- Menu items (30+ diverse items)
        INSERT INTO menu_items (name, price, category, is_available) VALUES
          -- Breakfast
          ('Continental Breakfast', 18.50, 'Breakfast', 1),
          ('Full English Breakfast', 24.00, 'Breakfast', 1),
          ('Pancakes with Maple Syrup', 16.00, 'Breakfast', 1),
          ('Fresh Fruit Bowl', 12.00, 'Breakfast', 1),
          ('Avocado Toast', 14.50, 'Breakfast', 1),
          -- Main Courses
          ('Grilled Chicken Breast', 28.00, 'Main Course', 1),
          ('Beef Tenderloin Steak', 42.00, 'Main Course', 1),
          ('Pan-Seared Salmon', 32.00, 'Main Course', 1),
          ('Vegetarian Pasta Primavera', 22.00, 'Main Course', 1),
          ('Lamb Curry with Rice', 26.00, 'Main Course', 1),
          ('Fish and Chips', 24.00, 'Main Course', 1),
          ('Chicken Caesar Salad', 20.00, 'Main Course', 1),
          -- Appetizers
          ('Garlic Bread', 8.50, 'Appetizer', 1),
          ('Buffalo Wings (6pc)', 16.00, 'Appetizer', 1),
          ('Cheese Platter', 22.00, 'Appetizer', 1),
          ('Soup of the Day', 11.00, 'Appetizer', 1),
          ('Nachos Supreme', 18.00, 'Appetizer', 1),
          -- Desserts
          ('Chocolate Brownie', 12.00, 'Dessert', 1),
          ('Tiramisu', 14.00, 'Dessert', 1),
          ('Ice Cream (3 scoops)', 9.00, 'Dessert', 1),
          ('Cheesecake', 13.50, 'Dessert', 1),
          -- Beverages
          ('Coffee', 4.50, 'Beverage', 1),
          ('Tea Selection', 4.00, 'Beverage', 1),
          ('Fresh Orange Juice', 7.00, 'Beverage', 1),
          ('Coca Cola', 3.50, 'Beverage', 1),
          ('Mineral Water', 3.00, 'Beverage', 1),
          ('Red Wine (Glass)', 12.00, 'Beverage', 1),
          ('White Wine (Glass)', 11.00, 'Beverage', 1),
          ('Local Beer', 6.50, 'Beverage', 1),
          -- Room Service
          ('Club Sandwich', 19.00, 'Room Service', 1),
          ('Burger and Fries', 21.00, 'Room Service', 1),
          ('Pizza Margherita', 18.00, 'Room Service', 1);
        
        -- Active guests (6 currently checked in)
        INSERT INTO guests (name, phone, room_id, check_in, check_out, daily_rate, is_active) VALUES
          ('John Smith', '+1-555-0101', 1, '2025-08-14', NULL, 120.00, 1),
          ('Sarah Johnson', '+1-555-0102', 5, '2025-08-15', NULL, 120.00, 1),
          ('Michael Chen', '+1-555-0103', 9, '2025-08-16', NULL, 180.00, 1),
          ('Emily Davis', '+1-555-0104', 12, '2025-08-13', NULL, 180.00, 1),
          ('Robert Wilson', '+1-555-0105', 17, '2025-08-15', NULL, 250.00, 1),
          ('Lisa Anderson', '+1-555-0106', 19, '2025-08-16', NULL, 250.00, 1),
          -- Recent checkouts
          ('David Brown', '+1-555-0201', 2, '2025-08-10', '2025-08-13', 120.00, 0),
          ('Jessica Garcia', '+1-555-0202', 6, '2025-08-08', '2025-08-11', 120.00, 0),
          ('Thomas Martinez', '+1-555-0203', 10, '2025-08-05', '2025-08-09', 180.00, 0),
          ('Amanda Rodriguez', '+1-555-0204', 13, '2025-08-01', '2025-08-05', 180.00, 0);
        
        -- Food orders (mix of paid and unpaid with paid_at timestamps)
        INSERT INTO food_orders (guest_id, order_date, total_amount, is_paid, paid_at) VALUES
          (1, '2025-08-14', 42.50, 1, '2025-08-14 19:30:00'),  -- John Smith - paid
          (1, '2025-08-15', 58.00, 0, NULL),  -- John Smith - unpaid
          (1, '2025-08-16', 22.50, 0, NULL),  -- John Smith - unpaid
          (2, '2025-08-15', 31.00, 1, '2025-08-15 20:15:00'),  -- Sarah Johnson - paid
          (2, '2025-08-16', 27.00, 0, NULL),  -- Sarah Johnson - unpaid
          (3, '2025-08-16', 89.50, 0, NULL),  -- Michael Chen - unpaid
          (4, '2025-08-13', 38.00, 1, '2025-08-13 18:45:00'),  -- Emily Davis - paid
          (4, '2025-08-14', 52.00, 1, '2025-08-14 12:30:00'),  -- Emily Davis - paid
          (4, '2025-08-16', 29.00, 0, NULL),  -- Emily Davis - unpaid
          (5, '2025-08-15', 95.00, 1, '2025-08-15 21:45:00'),  -- Robert Wilson - paid
          (5, '2025-08-16', 67.50, 0, NULL),  -- Robert Wilson - unpaid
          (6, '2025-08-16', 34.50, 0, NULL),  -- Lisa Anderson - unpaid
          -- Historical orders (all paid with timestamps)
          (7, '2025-08-10', 45.00, 1, '2025-08-10 19:15:00'),
          (7, '2025-08-12', 52.00, 1, '2025-08-12 20:30:00'),
          (8, '2025-08-08', 33.00, 1, '2025-08-08 18:45:00'),
          (8, '2025-08-10', 29.00, 1, '2025-08-10 21:00:00');
        
        -- Food order items (sample detailed items)
        INSERT INTO food_order_items (order_id, menu_item_id, quantity, unit_price) VALUES
          -- John Smith's orders
          (1, 2, 1, 24.00),  -- Full English Breakfast
          (1, 22, 1, 4.50),  -- Coffee
          (1, 24, 2, 7.00),  -- Orange juice x2
          (2, 7, 1, 42.00),  -- Beef Tenderloin
          (2, 13, 1, 8.50),  -- Garlic bread
          (2, 26, 1, 12.00), -- Wine
          (3, 3, 1, 16.00),  -- Pancakes
          (3, 22, 1, 4.50),  -- Coffee
          -- Sarah Johnson's orders
          (4, 1, 1, 18.50),  -- Continental breakfast
          (4, 24, 1, 7.00),  -- Orange juice
          (4, 22, 1, 4.50),  -- Coffee
          (5, 5, 1, 14.50),  -- Avocado toast
          (5, 22, 1, 4.00),  -- Tea
          (5, 20, 1, 9.00),  -- Ice cream
          -- Michael Chen's order (premium)
          (6, 2, 1, 24.00),  -- Full breakfast
          (6, 7, 1, 42.00),  -- Beef steak
          (6, 15, 1, 22.00), -- Cheese platter
          (6, 22, 1, 4.50);  -- Coffee
        
        -- Business expenses (2 months of data)
        INSERT INTO expenses (date, category, description, amount) VALUES
          -- August 2025
          ('2025-08-01', 'Utilities', 'Electricity bill - July', 425.00),
          ('2025-08-03', 'Food & Beverage', 'Weekly grocery shopping', 380.50),
          ('2025-08-05', 'Maintenance', 'HVAC system repair - Room 205', 295.00),
          ('2025-08-07', 'Supplies', 'Cleaning supplies and linens', 180.75),
          ('2025-08-10', 'Food & Beverage', 'Weekly grocery shopping', 420.25),
          ('2025-08-12', 'Marketing', 'Google Ads campaign', 150.00),
          ('2025-08-14', 'Utilities', 'Water and sewer bill', 185.50),
          ('2025-08-16', 'Food & Beverage', 'Premium wine restock', 540.00),
          -- July 2025
          ('2025-07-28', 'Utilities', 'Electricity bill - June', 398.75),
          ('2025-07-25', 'Food & Beverage', 'Weekly grocery shopping', 365.00),
          ('2025-07-22', 'Maintenance', 'Plumbing repair - Room 108', 175.00),
          ('2025-07-20', 'Supplies', 'Bathroom amenities restock', 245.50),
          ('2025-07-15', 'Insurance', 'Property insurance premium', 890.00),
          ('2025-07-10', 'Utilities', 'Internet and phone bill', 95.50),
          ('2025-07-05', 'Maintenance', 'Carpet cleaning - Floor 2', 280.00),
          ('2025-07-01', 'Supplies', 'Office supplies and reception', 165.25);
        
        -- Admin settings (hotel configuration)
        INSERT INTO admin_settings (key, value) VALUES
          ('admin_username', 'admin'),
          ('admin_password_hash', '$argon2id$v=19$m=19456,t=2,p=1$placeholder$placeholder'),
          ('hotel_name', 'Grand Vista Hotel'),
          ('hotel_address', '123 Main Street, Downtown'),
          ('hotel_phone', '+1-555-HOTEL-1'),
          ('currency_symbol', '$'),
          ('timezone', 'America/New_York'),
          ('check_in_time', '15:00'),
          ('check_out_time', '11:00');
        
        -- Update room occupancy
        UPDATE rooms SET is_occupied = 1, guest_id = (
          SELECT id FROM guests WHERE room_id = rooms.id AND is_active = 1 LIMIT 1
        ) WHERE id IN (
          SELECT DISTINCT room_id FROM guests WHERE is_active = 1
        );
    "#;
    
    conn.execute_batch(seed_sql).map_err(|e| format!("Failed to insert seed data: {}", e))?;
    Ok(())
}

/// Get current database statistics for verification
#[tauri::command]
pub fn get_database_stats() -> Result<DatabaseStats, String> {
    let db_path = get_database_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    
    let total_rooms: i32 = conn.query_row("SELECT COUNT(*) FROM rooms", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count rooms: {}", e))?;
    
    let occupied_rooms: i32 = conn.query_row("SELECT COUNT(*) FROM rooms WHERE is_occupied = 1", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count occupied rooms: {}", e))?;
    
    let active_guests: i32 = conn.query_row("SELECT COUNT(*) FROM guests WHERE is_active = 1", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count active guests: {}", e))?;
    
    let total_guests: i32 = conn.query_row("SELECT COUNT(*) FROM guests", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count total guests: {}", e))?;
    
    let menu_items: i32 = conn.query_row("SELECT COUNT(*) FROM menu_items", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count menu items: {}", e))?;
    
    let food_orders: i32 = conn.query_row("SELECT COUNT(*) FROM food_orders", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count food orders: {}", e))?;
    
    let unpaid_orders: i32 = conn.query_row("SELECT COUNT(*) FROM food_orders WHERE is_paid = 0", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count unpaid orders: {}", e))?;
    
    let expenses: i32 = conn.query_row("SELECT COUNT(*) FROM expenses", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count expenses: {}", e))?;
    
    Ok(DatabaseStats {
        total_rooms,
        occupied_rooms,
        available_rooms: total_rooms - occupied_rooms,
        active_guests,
        total_guests,
        menu_items,
        food_orders,
        unpaid_orders,
        expenses,
    })
}

#[derive(serde::Serialize)]
pub struct DatabaseStats {
    pub total_rooms: i32,
    pub occupied_rooms: i32,
    pub available_rooms: i32,
    pub active_guests: i32,
    pub total_guests: i32,
    pub menu_items: i32,
    pub food_orders: i32,
    pub unpaid_orders: i32,
    pub expenses: i32,
}
