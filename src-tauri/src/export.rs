use serde_json::Value;
use std::fs;
use std::io::Write;
use tauri::{AppHandle, Wry};

/// Export data to CSV file with user-selected location
#[tauri::command]
pub async fn export_history_csv_with_dialog(app: AppHandle<Wry>, tab: String, filters: Value) -> Result<String, String> {
    use rfd::AsyncFileDialog;
    
    // Generate timestamped filename
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let filename = format!("{}_{}.csv", tab, timestamp);
    
    // Show save dialog using rfd directly
    let file_path = AsyncFileDialog::new()
        .set_title("Save Export File")
        .set_file_name(&filename)
        .add_filter("CSV files", &["csv"])
        .save_file()
        .await;
    
    match file_path {
        Some(handle) => {
            let path = handle.path();
            
            // Create CSV file at selected location
            let mut file = fs::File::create(path).map_err(|e| format!("Failed to create CSV file: {}", e))?;
            
            // Export based on tab type
            match tab.as_str() {
                "guests" => export_guests_csv(&mut file, &filters)?,
                "orders" => export_orders_csv(&mut file, &filters)?,
                "expenses" => export_expenses_csv(&mut file, &filters)?,
                "rooms" => export_rooms_csv(&mut file, &filters)?,
                _ => return Err(format!("Unknown export type: {}", tab)),
            }
            
            Ok(path.to_string_lossy().to_string())
        },
        None => Err("Export cancelled by user".to_string())
    }
}

/// Export data to CSV file with filters
#[tauri::command]
pub fn export_history_csv(tab: String, filters: Value) -> Result<String, String> {
    // Get app data directory for exports
    let app_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get app data directory".to_string())?
        .join("hotel-app")
        .join("exports");
    
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create exports directory: {}", e))?;
    
    // Generate timestamped filename
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let filename = format!("{}_{}.csv", tab, timestamp);
    let file_path = app_data_dir.join(&filename);
    
    // Create CSV file
    let mut file = fs::File::create(&file_path).map_err(|e| format!("Failed to create CSV file: {}", e))?;
    
    // Export based on tab type
    match tab.as_str() {
        "guests" => export_guests_csv(&mut file, &filters)?,
        "orders" => export_orders_csv(&mut file, &filters)?,
        "expenses" => export_expenses_csv(&mut file, &filters)?,
        "rooms" => export_rooms_csv(&mut file, &filters)?,
        _ => return Err(format!("Unknown export type: {}", tab)),
    }
    
    Ok(file_path.to_string_lossy().to_string())
}

fn export_guests_csv(file: &mut fs::File, filters: &Value) -> Result<(), String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Write CSV header
    writeln!(file, "Guest ID,Name,Phone,Room Number,Check In,Check Out,Daily Rate,Total Bill,Status")
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    // Build query with filters
    let mut query = "SELECT g.id, g.name, g.phone, r.number as room_number, g.check_in, g.check_out, g.daily_rate, 
                            COALESCE((julianday(COALESCE(g.check_out, date('now'))) - julianday(g.check_in)) * g.daily_rate, 0) + 
                            COALESCE((SELECT SUM(total_amount) FROM food_orders WHERE guest_id = g.id), 0) as total_bill,
                            g.status
                     FROM guests g 
                     JOIN rooms r ON g.room_id = r.id 
                     WHERE 1=1".to_string();
    
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];
    
    // Apply filters - collect owned values first
    let start_date_str = filters.get("start_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let end_date_str = filters.get("end_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let room_id_val = filters.get("room_id").and_then(|v| v.as_i64());
    
    if let Some(ref start_date) = start_date_str {
        if !start_date.is_empty() {
            query.push_str(" AND g.check_in >= ?");
            params.push(start_date);
        }
    }
    
    if let Some(ref end_date) = end_date_str {
        if !end_date.is_empty() {
            query.push_str(" AND g.check_in <= ?");
            params.push(end_date);
        }
    }
    
    if let Some(ref room_id) = room_id_val {
        query.push_str(" AND g.room_id = ?");
        params.push(room_id);
    }
    
    query.push_str(" ORDER BY g.check_in DESC");
    
    // Execute query and write rows
    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    let rows = stmt.query_map(&*params, |row| {
        Ok((
            row.get::<_, i64>(0)?,      // id
            row.get::<_, String>(1)?,   // name
            row.get::<_, Option<String>>(2)?,  // phone
            row.get::<_, String>(3)?,   // room_number
            row.get::<_, String>(4)?,   // check_in
            row.get::<_, Option<String>>(5)?,  // check_out
            row.get::<_, f64>(6)?,      // daily_rate
            row.get::<_, f64>(7)?,      // total_bill
            row.get::<_, String>(8)?,   // status
        ))
    }).map_err(|e| format!("Failed to execute query: {}", e))?;
    
    for row in rows {
        let (id, name, phone, room_number, check_in, check_out, daily_rate, total_bill, status) = 
            row.map_err(|e| format!("Failed to read row: {}", e))?;
        
        writeln!(file, "{},{},{},{},{},{},{:.2},{:.2},{}",
            id,
            escape_csv(&name),
            escape_csv(&phone.unwrap_or_default()),
            escape_csv(&room_number),
            check_in,
            check_out.unwrap_or_default(),
            daily_rate,
            total_bill,
            status
        ).map_err(|e| format!("Failed to write row: {}", e))?;
    }
    
    Ok(())
}

fn export_orders_csv(file: &mut fs::File, filters: &Value) -> Result<(), String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Write CSV header
    writeln!(file, "Order ID,Guest Name,Room,Order Date,Total Amount,Payment Status,Items")
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    let mut query = "SELECT fo.id, COALESCE(g.name, 'Walk-in'), COALESCE(r.number, 'N/A'), fo.created_at, fo.total_amount, 
                            CASE WHEN fo.paid = 1 THEN 'Paid' ELSE 'Unpaid' END as payment_status,
                            GROUP_CONCAT(oi.item_name || ' x' || oi.quantity, ', ') as items
                     FROM food_orders fo
                     LEFT JOIN guests g ON fo.guest_id = g.id
                     LEFT JOIN rooms r ON g.room_id = r.id
                     LEFT JOIN order_items oi ON fo.id = oi.order_id
                     WHERE 1=1".to_string();
    
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];
    
    // Apply filters - collect owned values first
    let start_date_str = filters.get("start_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let end_date_str = filters.get("end_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let guest_id_val = filters.get("guest_id").and_then(|v| v.as_i64());
    
    if let Some(ref start_date) = start_date_str {
        if !start_date.is_empty() {
            query.push_str(" AND fo.created_at >= ?");
            params.push(start_date);
        }
    }
    
    if let Some(ref end_date) = end_date_str {
        if !end_date.is_empty() {
            query.push_str(" AND fo.created_at <= ?");
            params.push(end_date);
        }
    }
    
    if let Some(ref guest_id) = guest_id_val {
        query.push_str(" AND fo.guest_id = ?");
        params.push(guest_id);
    }
    
    query.push_str(" GROUP BY fo.id ORDER BY fo.created_at DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    let rows = stmt.query_map(&*params, |row| {
        Ok((
            row.get::<_, i64>(0)?,      // id
            row.get::<_, String>(1)?,   // guest_name
            row.get::<_, String>(2)?,   // room_number
            row.get::<_, String>(3)?,   // order_date
            row.get::<_, f64>(4)?,      // total_amount
            row.get::<_, String>(5)?,   // payment_status
            row.get::<_, Option<String>>(6)?,  // items
        ))
    }).map_err(|e| format!("Failed to execute query: {}", e))?;
    
    for row in rows {
        let (id, guest_name, room_number, order_date, total_amount, payment_status, items) = 
            row.map_err(|e| format!("Failed to read row: {}", e))?;
        
        writeln!(file, "{},{},{},{},{:.2},{},\"{}\"",
            id,
            escape_csv(&guest_name),
            escape_csv(&room_number),
            order_date,
            total_amount,
            payment_status,
            items.unwrap_or_default()
        ).map_err(|e| format!("Failed to write row: {}", e))?;
    }
    
    Ok(())
}

fn export_expenses_csv(file: &mut fs::File, filters: &Value) -> Result<(), String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Write CSV header
    writeln!(file, "Date,Category,Description,Amount")
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    let mut query = "SELECT date, category, description, amount FROM expenses WHERE 1=1".to_string();
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];
    
    // Apply filters - collect owned values first  
    let start_date_str = filters.get("start_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let end_date_str = filters.get("end_date").and_then(|v| v.as_str()).map(|s| s.to_string());
    let category_str = filters.get("category").and_then(|v| v.as_str()).map(|s| s.to_string());
    
    if let Some(ref start_date) = start_date_str {
        if !start_date.is_empty() {
            query.push_str(" AND date >= ?");
            params.push(start_date);
        }
    }
    
    if let Some(ref end_date) = end_date_str {
        if !end_date.is_empty() {
            query.push_str(" AND date <= ?");
            params.push(end_date);
        }
    }
    
    if let Some(ref category) = category_str {
        if !category.is_empty() {
            query.push_str(" AND category = ?");
            params.push(category);
        }
    }
    
    query.push_str(" ORDER BY date DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    let rows = stmt.query_map(&*params, |row| {
        Ok((
            row.get::<_, String>(0)?,   // date
            row.get::<_, String>(1)?,   // category
            row.get::<_, String>(2)?,   // description
            row.get::<_, f64>(3)?,      // amount
        ))
    }).map_err(|e| format!("Failed to execute query: {}", e))?;
    
    for row in rows {
        let (date, category, description, amount) = 
            row.map_err(|e| format!("Failed to read row: {}", e))?;
        
        writeln!(file, "{},{},{},{:.2}",
            date,
            escape_csv(&category),
            escape_csv(&description),
            amount
        ).map_err(|e| format!("Failed to write row: {}", e))?;
    }
    
    Ok(())
}

fn export_rooms_csv(file: &mut fs::File, _filters: &Value) -> Result<(), String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Write CSV header
    writeln!(file, "Room Number,Daily Rate,Status,Current Guest")
        .map_err(|e| format!("Failed to write CSV header: {}", e))?;
    
    let query = "SELECT r.number, r.daily_rate, 
                        CASE WHEN r.is_occupied = 1 THEN 'Occupied' ELSE 'Available' END as status,
                        COALESCE(g.name, '') as guest_name
                 FROM rooms r
                 LEFT JOIN guests g ON r.guest_id = g.id AND g.status = 'active'
                 ORDER BY r.number";
    
    let mut stmt = conn.prepare(query).map_err(|e| format!("Failed to prepare query: {}", e))?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>(0)?,   // number
            row.get::<_, f64>(1)?,      // daily_rate
            row.get::<_, String>(2)?,   // status
            row.get::<_, String>(3)?,   // guest_name
        ))
    }).map_err(|e| format!("Failed to execute query: {}", e))?;
    
    for row in rows {
        let (number, daily_rate, status, guest_name) = 
            row.map_err(|e| format!("Failed to read row: {}", e))?;
        
        writeln!(file, "{},{:.2},{},{}",
            escape_csv(&number),
            daily_rate,
            status,
            escape_csv(&guest_name)
        ).map_err(|e| format!("Failed to write row: {}", e))?;
    }
    
    Ok(())
}

/// Escape CSV values that contain commas, quotes, or newlines
fn escape_csv(value: &str) -> String {
    if value.contains(',') || value.contains('"') || value.contains('\n') {
        format!("\"{}\"", value.replace('"', "\"\""))
    } else {
        value.to_string()
    }
}

/// Create a backup of the current database
#[tauri::command]
pub fn create_database_backup() -> Result<String, String> {
    let db_path = crate::db::get_db_path();
    
    let app_data_dir = dirs::data_local_dir()
        .ok_or("Failed to get app data directory".to_string())?
        .join("hotel-app")
        .join("backups");
    
    fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create backups directory: {}", e))?;
    
    let timestamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let backup_filename = format!("hotel_backup_{}.db", timestamp);
    let backup_path = app_data_dir.join(&backup_filename);
    
    fs::copy(&db_path, &backup_path).map_err(|e| format!("Failed to create backup: {}", e))?;
    
    Ok(backup_path.to_string_lossy().to_string())
}
