// Test to manually check database status
use std::path::Path;

fn main() {
    // Check if database exists
    let db_path = "C:\\Users\\DELL\\Desktop\\hotel-app\\src-tauri\\db\\hotel.db";
    
    if Path::new(db_path).exists() {
        println!("Database exists at: {}", db_path);
        
        // Try to open and check schema
        if let Ok(conn) = rusqlite::Connection::open(db_path) {
            // Check rooms table structure
            match conn.prepare("PRAGMA table_info(rooms)") {
                Ok(mut stmt) => {
                    println!("\nRooms table columns:");
                    let rows = stmt.query_map([], |row| {
                        Ok((
                            row.get::<_, String>(1)?, // column name
                            row.get::<_, String>(2)?, // column type
                        ))
                    }).unwrap();
                    
                    for row in rows {
                        if let Ok((name, col_type)) = row {
                            println!("  {} ({})", name, col_type);
                        }
                    }
                }
                Err(e) => println!("Error checking rooms table: {}", e),
            }
            
            // Check menu_items table structure
            match conn.prepare("PRAGMA table_info(menu_items)") {
                Ok(mut stmt) => {
                    println!("\nMenu items table columns:");
                    let rows = stmt.query_map([], |row| {
                        Ok((
                            row.get::<_, String>(1)?, // column name
                            row.get::<_, String>(2)?, // column type
                        ))
                    }).unwrap();
                    
                    for row in rows {
                        if let Ok((name, col_type)) = row {
                            println!("  {} ({})", name, col_type);
                        }
                    }
                }
                Err(e) => println!("Error checking menu_items table: {}", e),
            }
            
            // Try the actual query that's failing
            println!("\nTesting get_rooms query:");
            match conn.prepare("SELECT id, number, room_type, daily_rate, is_occupied, guest_id FROM rooms WHERE is_active = 1 ORDER BY number") {
                Ok(_) => println!("  get_rooms query: SUCCESS"),
                Err(e) => println!("  get_rooms query: FAILED - {}", e),
            }
            
            println!("\nTesting get_menu_items query:");
            match conn.prepare("SELECT id, name, price, category, is_available FROM menu_items WHERE is_active = 1 ORDER BY name") {
                Ok(_) => println!("  get_menu_items query: SUCCESS"),
                Err(e) => println!("  get_menu_items query: FAILED - {}", e),
            }
        } else {
            println!("Could not open database");
        }
    } else {
        println!("Database does not exist at: {}", db_path);
    }
}
