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
        "order_items", "expenses"
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

// Restore database from backup file with comprehensive safety checks
#[command]
pub async fn restore_database_from_backup(backup_file_path: String) -> Result<String, String> {
    use crate::db::get_db_path;
    
    // Step 1: Validate input file path
    let backup_path = Path::new(&backup_file_path);
    if !backup_path.exists() {
        return Err("Backup file does not exist. Please check the file path.".to_string());
    }
    
    // Check if it's actually a database file
    if let Some(extension) = backup_path.extension() {
        if extension != "db" {
            return Err("File must have .db extension to be a valid database backup.".to_string());
        }
    } else {
        return Err("Backup file must have .db extension.".to_string());
    }
    
    let db_path = get_db_path();
    
    // Step 2: Create backup directory and backup current database
    let current_backup_dir = db_path.parent().ok_or("Failed to get app directory")?.join("backups");
    if !current_backup_dir.exists() {
        fs::create_dir_all(&current_backup_dir)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }
    
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let current_backup_name = format!("hotel_backup_before_restore_{}.db", timestamp);
    let current_backup_path = current_backup_dir.join(&current_backup_name);
    
    // Backup current database first (safety net)
    fs::copy(&db_path, &current_backup_path)
        .map_err(|e| format!("Failed to backup current database: {}", e))?;
    
    // Step 3: Comprehensive validation of backup file
    let backup_validation_result = validate_backup_database(&backup_path);
    if let Err(validation_error) = backup_validation_result {
        return Err(format!("Backup file validation failed: {}", validation_error));
    }
    
    // Step 4: Test restore in a temporary location first
    let temp_restore_path = current_backup_dir.join(format!("temp_restore_test_{}.db", timestamp));
    fs::copy(&backup_path, &temp_restore_path)
        .map_err(|e| format!("Failed to create temporary restore test: {}", e))?;
    
    // Test if the restored database can be opened and basic operations work
    let test_result = test_database_functionality(&temp_restore_path);
    
    // Clean up temp file
    let _ = fs::remove_file(&temp_restore_path);
    
    if let Err(test_error) = test_result {
        return Err(format!("Backup file functionality test failed: {}. Your current database is safe.", test_error));
    }
    
    // Step 5: Perform the actual restore (we know it's safe now)
    fs::copy(&backup_path, &db_path)
        .map_err(|e| {
            // If this fails, try to restore the original
            let _ = fs::copy(&current_backup_path, &db_path);
            format!("Failed to restore database: {}. Original database restored.", e)
        })?;
    
    // Step 6: Final verification of restored database
    let final_verification = test_database_functionality(&db_path);
    if let Err(verification_error) = final_verification {
        // Critical error - restore the original database immediately
        fs::copy(&current_backup_path, &db_path)
            .map_err(|e| format!("CRITICAL ERROR: Failed to restore original database: {}", e))?;
        return Err(format!("Restored database verification failed: {}. Original database has been restored.", verification_error));
    }
    
    Ok(format!(
        "✅ Database restored successfully!\n\
         📁 Restored from: {}\n\
         💾 Previous database backed up to: {}\n\
         🔍 All safety checks passed.",
        backup_path.display(),
        current_backup_path.display()
    ))
}

// Comprehensive validation function for backup databases
fn validate_backup_database(backup_path: &Path) -> Result<(), String> {
    // Open the backup database
    let backup_conn = Connection::open(&backup_path)
        .map_err(|e| format!("Cannot open backup file as SQLite database: {}", e))?;
    
    // Check basic integrity
    let integrity_check: Result<String, _> = backup_conn.query_row(
        "PRAGMA integrity_check",
        [],
        |row| row.get(0)
    );
    
    match integrity_check {
        Ok(result) if result != "ok" => {
            backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
            return Err(format!("Database integrity check failed: {}", result));
        },
        Err(e) => {
            backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
            return Err(format!("Failed to check database integrity: {}", e));
        },
        _ => {} // OK
    }
    
    // Verify required tables exist
    let required_tables = vec![
        "rooms", "guests", "menu_items", "food_orders", 
        "order_items", "expenses"
    ];
    
    for table in required_tables {
        let table_check: Result<i64, _> = backup_conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?",
            [table],
            |row| row.get(0)
        );
        
        match table_check {
            Ok(count) if count == 0 => {
                backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
                return Err(format!("Required table '{}' not found in backup", table));
            },
            Err(e) => {
                backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
                return Err(format!("Failed to check table '{}': {}", table, e));
            },
            _ => {} // Table exists
        }
    }
    
    // Check if essential columns exist in key tables
    let column_checks = vec![
        ("rooms", "id, number, room_type, daily_rate, is_active"),
        ("guests", "id, name, phone, room_id, check_in"),
        ("menu_items", "id, name, price, is_active"),
        ("food_orders", "id, guest_id, created_at, total_amount"),
    ];
    
    for (table, expected_columns) in column_checks {
        let column_info: Result<Vec<String>, _> = backup_conn.prepare(&format!("PRAGMA table_info({})", table))
            .and_then(|mut stmt| {
                let column_iter = stmt.query_map([], |row| {
                    Ok(row.get::<_, String>(1)?) // Column name is at index 1
                })?;
                
                let mut columns = Vec::new();
                for column in column_iter {
                    columns.push(column?);
                }
                Ok(columns)
            });
        
        match column_info {
            Ok(columns) => {
                let expected: Vec<&str> = expected_columns.split(", ").collect();
                for expected_col in expected {
                    if !columns.iter().any(|col| col == expected_col) {
                        backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
                        return Err(format!("Required column '{}' not found in table '{}'", expected_col, table));
                    }
                }
            },
            Err(e) => {
                backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
                return Err(format!("Failed to check columns in table '{}': {}", table, e));
            }
        }
    }
    
    backup_conn.close().map_err(|e| format!("Failed to close backup connection: {:?}", e))?;
    Ok(())
}

// Test basic database functionality
fn test_database_functionality(db_path: &Path) -> Result<(), String> {
    let test_conn = Connection::open(&db_path)
        .map_err(|e| format!("Cannot open database for testing: {}", e))?;
    
    // Test basic queries on essential tables
    let test_queries = vec![
        ("SELECT COUNT(*) FROM rooms", "rooms table"),
        ("SELECT COUNT(*) FROM menu_items", "menu_items table"),
        ("SELECT COUNT(*) FROM guests", "guests table"),
        ("SELECT COUNT(*) FROM food_orders", "food_orders table"),
    ];
    
    for (query, description) in test_queries {
        let test_result: Result<i64, _> = test_conn.query_row(query, [], |row| row.get(0));
        if let Err(e) = test_result {
            test_conn.close().map_err(|e| format!("Failed to close test connection: {:?}", e))?;
            return Err(format!("Failed to query {}: {}", description, e));
        }
    }
    
    // Test a simple INSERT to ensure database is writable (then rollback)
    let tx = test_conn.unchecked_transaction()
        .map_err(|e| format!("Failed to start test transaction: {}", e))?;
    
    let insert_test = tx.execute(
        "INSERT INTO rooms (number, room_type, daily_rate, is_occupied, is_active) VALUES ('TEST', 'Test', 0.0, 0, 1)",
        []
    );
    
    // Always rollback the test
    let rollback_result = tx.rollback();
    
    if let Err(e) = insert_test {
        test_conn.close().map_err(|e| format!("Failed to close test connection: {:?}", e))?;
        return Err(format!("Database write test failed: {}", e));
    }
    
    if let Err(e) = rollback_result {
        test_conn.close().map_err(|e| format!("Failed to close test connection: {:?}", e))?;
        return Err(format!("Failed to rollback test transaction: {}", e));
    }
    
    test_conn.close().map_err(|e| format!("Failed to close test connection: {:?}", e))?;
    Ok(())
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

// Reset all application data with automatic backup
#[command]
pub async fn reset_application_data() -> Result<String, String> {
    use crate::db::get_db_path;
    
    // Create automatic backup before reset
    let backup_result = create_automatic_backup_before_reset().await;
    match backup_result {
        Ok(backup_path) => println!("Automatic backup created at: {}", backup_path),
        Err(e) => return Err(format!("Failed to create backup before reset: {}", e)),
    }
    
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Verify database integrity before reset
    let integrity_check: Result<String, _> = conn.query_row(
        "PRAGMA integrity_check",
        [],
        |row| row.get(0)
    );
    
    match integrity_check {
        Ok(result) if result != "ok" => {
            return Err(format!("Database integrity check failed: {}", result));
        },
        Err(e) => {
            return Err(format!("Failed to check database integrity: {}", e));
        },
        _ => {} // OK, continue
    }
    
    // List of tables to clear (preserve structure, clear data)
    // This comment is for reference - tables are handled in the correct order below
    
    // Start transaction
    let tx = conn.unchecked_transaction()
        .map_err(|e| format!("Failed to start transaction: {}", e))?;
    
    // Disable foreign key constraints temporarily for reset
    tx.execute("PRAGMA foreign_keys = OFF", [])
        .map_err(|e| format!("Failed to disable foreign keys: {}", e))?;
    
    // Clear data tables in correct order (child tables first)
    let tables_to_clear = vec![
        "order_items",    // Clear child table first
        "food_orders",    // Then parent food orders
        "expenses",       // Independent table
        "guests"          // Finally guests table
    ];
    
    for table in tables_to_clear {
        tx.execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| format!("Failed to clear table {}: {}", table, e))?;
        
        // Reset auto-increment
        tx.execute(&format!("DELETE FROM sqlite_sequence WHERE name = '{}'", table), [])
            .map_err(|e| format!("Failed to reset sequence for {}: {}", table, e))?;
    }
    
    // Reset specific tables with default data
    let tables_to_reset = vec![
        "rooms",
        "menu_items"
    ];
    
    for table in tables_to_reset {
        tx.execute(&format!("DELETE FROM {}", table), [])
            .map_err(|e| format!("Failed to clear table {}: {}", table, e))?;
        
        // Reset auto-increment
        tx.execute(&format!("DELETE FROM sqlite_sequence WHERE name = '{}'", table), [])
            .map_err(|e| format!("Failed to reset sequence for {}: {}", table, e))?;
    }
    
    // Re-seed with default data
    match seed_default_data(&tx) {
        Ok(_) => {},
        Err(e) => {
            return Err(format!("Failed to seed default data: {}", e));
        }
    }
    
    // Re-enable foreign key constraints
    tx.execute("PRAGMA foreign_keys = ON", [])
        .map_err(|e| format!("Failed to re-enable foreign keys: {}", e))?;
    
    // Commit transaction
    tx.commit()
        .map_err(|e| format!("Failed to commit reset transaction: {}", e))?;
    
    // Verify database integrity after reset
    let final_integrity_check: Result<String, _> = conn.query_row(
        "PRAGMA integrity_check",
        [],
        |row| row.get(0)
    );
    
    match final_integrity_check {
        Ok(result) if result != "ok" => {
            return Err(format!("Database integrity check failed after reset: {}", result));
        },
        Err(e) => {
            return Err(format!("Failed to check database integrity after reset: {}", e));
        },
        _ => {} // OK
    }
    
    Ok("Application data has been reset successfully. Backup created automatically.".to_string())
}

// Create automatic backup before reset
async fn create_automatic_backup_before_reset() -> Result<String, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    
    // Create backup directory in app directory
    let app_dir = db_path.parent().ok_or("Failed to get app directory")?;
    let backup_dir = app_dir.join("backups");
    
    if !backup_dir.exists() {
        fs::create_dir_all(&backup_dir)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }
    
    // Create timestamp for backup file
    let timestamp = chrono::Local::now().format("%Y%m%d_%H%M%S").to_string();
    let backup_file_name = format!("hotel_backup_before_reset_{}.db", timestamp);
    let backup_file_path = backup_dir.join(&backup_file_name);
    
    // Copy database file
    fs::copy(&db_path, &backup_file_path)
        .map_err(|e| format!("Failed to copy database: {}", e))?;
    
    // Also create a JSON export for data portability
    if let Err(e) = export_data_to_json(&backup_dir, &format!("before_reset_{}", timestamp)) {
        println!("Warning: JSON export failed: {}", e);
    }
    
    Ok(backup_file_path.to_string_lossy().to_string())
}

// Seed default data after reset
fn seed_default_data(_conn: &rusqlite::Transaction) -> Result<(), String> {
    // No default rooms - users can add their own rooms
    
    // No default menu items - users can add their own menu items
    
    Ok(())
}

// Find latest backup file automatically
#[command]
pub async fn select_backup_file() -> Result<String, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let app_dir = db_path.parent().ok_or("Failed to get app directory")?;
    
    // Check multiple backup directories
    let backup_dirs = vec![
        app_dir.join("backups"),
        app_dir.join("..").join("backups").canonicalize().unwrap_or(app_dir.join("backups")),
    ];
    
    let mut all_backup_files = Vec::new();
    
    for backup_dir in backup_dirs {
        if backup_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&backup_dir) {
                for entry in entries.flatten() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.ends_with(".db") && file_name.contains("hotel_backup") {
                            all_backup_files.push(entry.path());
                        }
                    }
                }
            }
        }
    }
    
    // Sort by modification time and return the most recent
    all_backup_files.sort_by_key(|path| {
        std::fs::metadata(path)
            .and_then(|m| m.modified())
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH)
    });
    
    if let Some(latest_backup) = all_backup_files.last() {
        return Ok(latest_backup.to_string_lossy().to_string());
    }
    
    // If no backups found, provide helpful error message
    let user_dir = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    Err(format!("No backup files found. Please check these locations:\n1. App backup directory: {}\\backups\n2. Desktop: {}\\Desktop\n3. Downloads folder", app_dir.display(), user_dir))
}

// Open file browser to manually select backup file
#[command] 
pub async fn browse_backup_file() -> Result<String, String> {
    use crate::db::get_db_path;
    
    let db_path = get_db_path();
    let app_dir = db_path.parent().ok_or("Failed to get app directory")?;
    
    // Check multiple backup directories and list available files
    let backup_dirs = vec![
        app_dir.join("backups"),
        app_dir.join("..").join("backups").canonicalize().unwrap_or(app_dir.join("backups")),
    ];
    
    let mut available_backups = Vec::new();
    
    for backup_dir in backup_dirs {
        if backup_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&backup_dir) {
                for entry in entries.flatten() {
                    if let Some(file_name) = entry.file_name().to_str() {
                        if file_name.ends_with(".db") && file_name.contains("hotel_backup") {
                            available_backups.push(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }
    
    if available_backups.is_empty() {
        Err("No backup files found. Please use the 'Find Latest' button to automatically find your latest backup, or manually enter the full path to your backup file.\n\nBackup files should be named like 'hotel_backup_YYYYMMDD_HHMMSS.db'".to_string())
    } else {
        // Sort by modification time and show available files
        let mut backup_info = String::from("✅ Found backup files! Please copy and paste one of these paths:\n\n");
        
        // Sort by file name (which includes timestamp)
        available_backups.sort();
        available_backups.reverse(); // Show newest first
        
        for (i, backup) in available_backups.iter().enumerate() {
            backup_info.push_str(&format!("📁 {}\n\n", backup));
            if i >= 4 { // Show max 5 files to avoid cluttering
                backup_info.push_str(&format!("... and {} more files\n\n", available_backups.len() - 5));
                break;
            }
        }
        
        backup_info.push_str("💡 Instructions:\n1. Copy one of the paths above\n2. Paste it in the text field\n3. Or use 'Find Latest' for automatic selection");
        
        Err(backup_info)
    }
}
