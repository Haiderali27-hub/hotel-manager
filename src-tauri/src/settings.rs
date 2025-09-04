use tauri::command;
use std::path::Path;
use std::fs;
use serde_json::{json, Value};
use rusqlite::Connection;
use std::collections::HashMap;
use base64::Engine;

#[derive(serde::Serialize, serde::Deserialize)]
pub struct SecurityQuestion {
    pub id: String,
    pub question: String,
    pub answer: String,
}

// Backup database to external location
#[command]
pub async fn backup_database(backup_path: String) -> Result<String, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let backup_dir = Path::new(&backup_path);
    
    if !backup_dir.exists() {
        return Err("Backup directory does not exist".to_string());
    }
    
    // Create timestamp for backup file
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_file_name = format!("hotel_backup_{}.db", timestamp);
    let backup_file_path = backup_dir.join(&backup_file_name);
    
    // Copy database file
    if let Err(e) = fs::copy(&db_path, &backup_file_path) {
        return Err(format!("Failed to copy database: {}", e));
    }
    
    // Also create a JSON export for data portability
    match export_data_to_json(&backup_dir, &timestamp) {
        Ok(_) => println!("JSON export created successfully"),
        Err(e) => println!("Warning: JSON export failed: {}", e),
    }
    
    Ok(format!("Backup created successfully at: {}", backup_file_path.display()))
}

// Export JSON backup specifically
#[command]
pub async fn export_json_backup(backup_path: String) -> Result<String, String> {
    let backup_dir = Path::new(&backup_path);
    
    if !backup_dir.exists() {
        return Err("Backup directory does not exist".to_string());
    }
    
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    
    match export_data_to_json(&backup_dir, &timestamp) {
        Ok(_) => Ok(format!("JSON backup created successfully at: {}", backup_dir.display())),
        Err(e) => Err(format!("Failed to create JSON backup: {}", e)),
    }
}

// Export data to JSON format
fn export_data_to_json(backup_dir: &Path, timestamp: &str) -> Result<(), String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    let mut export_data = HashMap::new();
    
    // Export all tables
    let tables = vec![
        "guests", "rooms", "menu_items", "food_orders", 
        "order_items", "expenses", "users"
    ];
    
    for table in tables {
        match export_table(&conn, table) {
            Ok(data) => {
                export_data.insert(table.to_string(), data);
            },
            Err(e) => {
                println!("Warning: Failed to export table {}: {}", table, e);
            }
        }
    }
    
    // Add metadata
    export_data.insert("metadata".to_string(), json!({
        "export_date": chrono::Local::now().to_rfc3339(),
        "version": "1.0",
        "hotel_name": "Yasin Heaven Star Hotel"
    }));
    
    // Write JSON file
    let json_file_name = format!("hotel_data_{}.json", timestamp);
    let json_file_path = backup_dir.join(&json_file_name);
    
    let json_string = serde_json::to_string_pretty(&export_data)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;
    
    fs::write(&json_file_path, json_string)
        .map_err(|e| format!("Failed to write JSON file: {}", e))?;
    
    Ok(())
}

// Helper function to export a single table
fn export_table(conn: &Connection, table_name: &str) -> Result<Value, String> {
    let query = format!("SELECT * FROM {}", table_name);
    let mut stmt = conn.prepare(&query)
        .map_err(|e| format!("Failed to prepare query for {}: {}", table_name, e))?;
    
    let column_names: Vec<String> = stmt.column_names().into_iter().map(|s| s.to_string()).collect();
    
    let rows = stmt.query_map([], |row| {
        let mut row_data = HashMap::new();
        for (i, col_name) in column_names.iter().enumerate() {
            let value: Value = match row.get::<_, rusqlite::types::Value>(i) {
                Ok(val) => match val {
                    rusqlite::types::Value::Null => Value::Null,
                    rusqlite::types::Value::Integer(i) => Value::Number(i.into()),
                    rusqlite::types::Value::Real(f) => {
                        if let Some(num) = serde_json::Number::from_f64(f) {
                            Value::Number(num)
                        } else {
                            Value::Null
                        }
                    },
                    rusqlite::types::Value::Text(s) => Value::String(s),
                    rusqlite::types::Value::Blob(b) => Value::String(base64::prelude::BASE64_STANDARD.encode(b)),
                },
                Err(_) => Value::Null,
            };
            row_data.insert(col_name.clone(), value);
        }
        Ok(row_data)
    }).map_err(|e| format!("Failed to query {}: {}", table_name, e))?;
    
    let mut table_data = Vec::new();
    for row in rows {
        match row {
            Ok(data) => table_data.push(data),
            Err(e) => println!("Warning: Failed to process row in {}: {}", table_name, e),
        }
    }
    
    Ok(json!(table_data))
}

// Get security question for reset validation
#[command]
pub async fn get_reset_security_question() -> Result<SecurityQuestion, String> {
    // For now, return a hardcoded security question
    // In a real app, this might be stored in the database or config
    Ok(SecurityQuestion {
        id: "location".to_string(),
        question: "What country is your hotel located in?".to_string(),
        answer: "pakistan".to_string(), // This would normally be hashed
    })
}

// Validate admin password
#[command]
pub async fn validate_admin_password(password: String) -> Result<bool, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Check against stored admin password
    let mut stmt = conn.prepare("SELECT password FROM users WHERE username = 'admin' AND role = 'admin'")
        .map_err(|e| format!("Failed to prepare password query: {}", e))?;
    
    let stored_password: String = stmt.query_row([], |row| {
        row.get(0)
    }).map_err(|_| "Admin user not found".to_string())?;
    
    // In a real app, you'd hash the input password and compare
    // For simplicity, we're doing direct comparison
    Ok(password == stored_password)
}

// Validate security question answer
#[command]
pub async fn validate_security_answer(question_id: String, answer: String) -> Result<bool, String> {
    // Get the security question
    let security_question = get_reset_security_question().await?;
    
    if security_question.id != question_id {
        return Ok(false);
    }
    
    // Compare answers (case-insensitive)
    Ok(answer.trim().to_lowercase() == security_question.answer.to_lowercase())
}

// Reset all application data
#[command]
pub async fn reset_application_data() -> Result<String, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // List of tables to clear (preserve structure, clear data)
    let tables_to_clear = vec![
        "guests",
        "food_orders", 
        "order_items",
        "expenses"
    ];
    
    // Tables to reset completely
    let tables_to_reset = vec![
        "rooms",
        "menu_items"
    ];
    
    // Start transaction
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Clear data tables
    for table in tables_to_clear {
        tx.execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| format!("Failed to clear table {}: {}", table, e))?;
        
        // Reset auto-increment
        tx.execute(&format!("DELETE FROM sqlite_sequence WHERE name = '{}'", table), [])
            .map_err(|e| format!("Failed to reset sequence for {}: {}", table, e))?;
    }
    
    // Reset specific tables with default data
    for table in tables_to_reset {
        tx.execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| format!("Failed to clear table {}: {}", table, e))?;
        
        // Reset auto-increment
        tx.execute(&format!("DELETE FROM sqlite_sequence WHERE name = '{}'", table), [])
            .map_err(|e| format!("Failed to reset sequence for {}: {}", table, e))?;
    }
    
    // Re-seed with default data
    seed_default_data(&tx)?;
    
    // Commit transaction
    tx.commit()
        .map_err(|e| format!("Failed to commit reset transaction: {}", e))?;
    
    Ok("Application data has been reset successfully".to_string())
}

// Seed default data after reset
fn seed_default_data(conn: &rusqlite::Transaction) -> Result<(), String> {
    // Add default rooms
    let rooms = vec![
        (1, "Standard Room", 8000.0, true),
        (2, "Standard Room", 8000.0, true),
        (3, "Standard Room", 8000.0, true),
        (4, "Deluxe Room", 10000.0, true),
        (5, "Deluxe Room", 10000.0, true),
        (6, "Suite", 15000.0, true),
        (7, "Standard Room", 8000.0, true),
        (8, "Standard Room", 8000.0, true),
        (9, "Deluxe Room", 10000.0, true),
        (10, "Suite", 15000.0, true),
        (11, "Standard Room", 8000.0, true),
        (12, "Standard Room", 8000.0, true),
        (13, "Deluxe Room", 10000.0, true),
        (14, "Deluxe Room", 10000.0, true),
        (15, "Suite", 15000.0, true),
    ];
    
    for (number, room_type, rate, available) in rooms {
        conn.execute(
            "INSERT INTO rooms (number, type, rate, available) VALUES (?, ?, ?, ?)",
            [&number.to_string(), room_type, &rate.to_string(), &(available as i32).to_string()],
        ).map_err(|e| format!("Failed to insert room {}: {}", number, e))?;
    }
    
    // Add default menu items
    let menu_items = vec![
        ("Dal Chawal", 300.0, true, "Main Course"),
        ("Chicken Karahi", 800.0, true, "Main Course"),
        ("Mutton Karahi", 1200.0, true, "Main Course"),
        ("Chicken Biryani", 600.0, true, "Rice"),
        ("Mutton Biryani", 800.0, true, "Rice"),
        ("Naan", 25.0, true, "Bread"),
        ("Roti", 15.0, true, "Bread"),
        ("Tea", 50.0, true, "Beverages"),
        ("Coffee", 80.0, true, "Beverages"),
        ("Cold Drink", 60.0, true, "Beverages"),
        ("Water Bottle", 30.0, true, "Beverages"),
        ("Kheer", 200.0, true, "Dessert"),
    ];
    
    for (name, price, available, category) in menu_items {
        conn.execute(
            "INSERT INTO menu_items (name, price, available, category) VALUES (?, ?, ?, ?)",
            [name, &price.to_string(), &(available as i32).to_string(), category],
        ).map_err(|e| format!("Failed to insert menu item {}: {}", name, e))?;
    }
    
    Ok(())
}
