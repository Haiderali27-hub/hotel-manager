use crate::db::{get_db_path, initialize_database};
use rusqlite::{Connection, Result};
use std::fs;

/// Reset database with comprehensive seed data for testing and development
#[tauri::command]
pub fn reset_database() -> Result<String, String> {
    let db_path = get_db_path();

    // Remove the database file so initialize_database() recreates schema/migrations cleanly.
    if db_path.exists() {
        fs::remove_file(&db_path)
            .map_err(|e| format!("Failed to remove database: {}", e))?;
    }

    initialize_database().map_err(|e| format!("Failed to initialize database: {}", e))?;
    Ok("Database reset successfully".to_string())
}

/// Get the database file path
#[tauri::command] 
pub fn get_database_path() -> Result<String, String> {
    Ok(get_db_path().to_string_lossy().to_string())
}

// NOTE: The previous implementation maintained a separate schema/seed here.
// That drifted from the app's real schema in db.rs and caused confusing behavior.
// reset_database() now simply deletes the active DB and calls initialize_database().

/// Get current database statistics for verification
#[tauri::command]
pub fn get_database_stats() -> Result<DatabaseStats, String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    
    let total_rooms: i32 = conn.query_row("SELECT COUNT(*) FROM resources", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count resources: {}", e))?;
    
    let occupied_rooms: i32 = conn.query_row("SELECT COUNT(*) FROM resources WHERE is_occupied = 1", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count occupied resources: {}", e))?;
    
    let active_guests: i32 = conn.query_row("SELECT COUNT(*) FROM customers WHERE status = 'active'", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count active customers: {}", e))?;
    
    let total_guests: i32 = conn.query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count total customers: {}", e))?;
    
    let menu_items: i32 = conn.query_row("SELECT COUNT(*) FROM menu_items", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count menu items: {}", e))?;
    
    let food_orders: i32 = conn.query_row("SELECT COUNT(*) FROM sales", [], |row| row.get(0))
        .map_err(|e| format!("Failed to count sales: {}", e))?;
    
    // Current schema uses paid=0/1 (migrations may also keep is_paid in older DBs)
    let unpaid_orders: i32 = conn
        .query_row(
            "SELECT COUNT(*) FROM sales WHERE COALESCE(paid, is_paid, 0) = 0",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to count unpaid sales: {}", e))?;
    
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
