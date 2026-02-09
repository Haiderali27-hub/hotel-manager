use crate::models::*;
use crate::db::*;
use rusqlite::{params, OptionalExtension};
use tauri::command;
use chrono::{NaiveDate, Utc, Datelike};

fn validate_non_empty(value: &str, field: &str) -> Result<(), String> {
    if value.trim().is_empty() {
        return Err(format!("{} cannot be empty", field));
    }
    Ok(())
}

fn validate_positive_i32(value: i32, field: &str) -> Result<(), String> {
    if value <= 0 {
        return Err(format!("{} must be > 0", field));
    }
    Ok(())
}

fn validate_positive_f64(value: f64, field: &str) -> Result<(), String> {
    if value <= 0.0 {
        return Err(format!("{} must be > 0", field));
    }
    Ok(())
}

fn compute_supplier_balance_summary(conn: &rusqlite::Connection, supplier_id: i64) -> Result<SupplierBalanceSummary, String> {
    let supplier_name: String = conn
        .query_row(
            "SELECT name FROM suppliers WHERE id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Supplier not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let total_purchases: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(total_amount), 0) FROM purchases WHERE supplier_id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let amount_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM supplier_payments WHERE supplier_id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let balance_due = (total_purchases - amount_paid).max(0.0);

    Ok(SupplierBalanceSummary {
        supplier_id,
        supplier_name,
        total_purchases,
        amount_paid,
        balance_due,
    })
}

fn recompute_purchase_total(conn: &rusqlite::Connection, purchase_id: i64) -> Result<f64, String> {
    let total: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(line_total), 0) FROM purchase_items WHERE purchase_id = ?1",
            params![purchase_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE purchases SET total_amount = ?1 WHERE id = ?2",
        params![total, purchase_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(total)
}

// ===== ROOM COMMANDS =====

#[command]
pub fn add_room(number: String, room_type: String, daily_rate: f64) -> Result<String, String> {
    println!("🐛 DEBUG add_room - Received parameters:");
    println!("  number: {:?}", number);
    println!("  room_type: {:?}", room_type);
    println!("  daily_rate: {:?}", daily_rate);
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate input
    if number.trim().is_empty() {
        return Err("Room number cannot be empty".to_string());
    }
    if room_type.trim().is_empty() {
        return Err("Room type cannot be empty".to_string());
    }
    if daily_rate <= 0.0 {
        return Err("Daily rate must be greater than 0".to_string());
    }
    
    println!("🐛 DEBUG add_room - Executing INSERT query...");
    let result = conn.execute(
        "INSERT INTO resources (number, room_type, daily_rate, is_occupied, is_active, resource_type) VALUES (?1, ?2, ?3, 0, 1, 'ROOM')",
        params![number.trim(), room_type.trim(), daily_rate],
    );
    
    match result {
        Ok(rows_affected) => {
            println!("✅ DEBUG add_room - Success! Rows affected: {}", rows_affected);
            Ok(format!("Room {} added successfully", number))
        },
        Err(e) => {
            println!("❌ DEBUG add_room - SQL Error: {}", e);
            if e.to_string().contains("UNIQUE constraint failed") {
                Err(format!("Room {} already exists", number))
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[command]
pub fn get_rooms() -> Result<Vec<Room>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
           "SELECT r.id, r.number, r.room_type, r.daily_rate, r.is_occupied, r.guest_id, c.name as guest_name 
            FROM resources r 
            LEFT JOIN customers c ON r.guest_id = c.id AND c.status = 'active'
         WHERE r.is_active = 1 
         ORDER BY r.number"
    ).map_err(|e| e.to_string())?;
    
    let room_iter = stmt.query_map([], |row| {
        Ok(Room {
            id: row.get(0)?,
            number: row.get(1)?,
            room_type: row.get(2)?,
            daily_rate: row.get(3)?,
            is_occupied: row.get::<_, i32>(4)? == 1,
            guest_id: row.get(5)?,
            guest_name: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rooms = Vec::new();
    for room in room_iter {
        rooms.push(room.map_err(|e| e.to_string())?);
    }
    
    Ok(rooms)
}

#[command]
pub fn get_available_rooms_for_guest(guest_id: Option<i64>) -> Result<Vec<Room>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut query = String::from(
           "SELECT r.id, r.number, r.room_type, r.daily_rate, r.is_occupied, r.guest_id, c.name as guest_name 
            FROM resources r 
            LEFT JOIN customers c ON r.guest_id = c.id AND c.status = 'active'
         WHERE r.is_active = 1 AND (r.is_occupied = 0"
    );
    
    // If editing an existing guest, also include their current room
    if let Some(gid) = guest_id {
        query.push_str(&format!(" OR r.guest_id = {}", gid));
    }
    
    query.push_str(") ORDER BY r.number");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let room_iter = stmt.query_map([], |row| {
        Ok(Room {
            id: row.get(0)?,
            number: row.get(1)?,
            room_type: row.get(2)?,
            daily_rate: row.get(3)?,
            is_occupied: row.get::<_, i32>(4)? == 1,
            guest_id: row.get(5)?,
            guest_name: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rooms = Vec::new();
    for room in room_iter {
        rooms.push(room.map_err(|e| e.to_string())?);
    }
    
    Ok(rooms)
}

#[command]
pub fn update_room(room_id: i64, number: Option<String>, daily_rate: Option<f64>) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Build dynamic update query
    let mut update_parts = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(ref num) = number {
        if num.trim().is_empty() {
            return Err("Room number cannot be empty".to_string());
        }
        update_parts.push("number = ?");
        params.push(Box::new(num.trim().to_string()));
    }
    
    if let Some(rate) = daily_rate {
        if rate < 0.0 {
            return Err("Daily rate must be positive".to_string());
        }
        update_parts.push("daily_rate = ?");
        params.push(Box::new(rate));
    }
    
    if update_parts.is_empty() {
        return Err("No fields to update".to_string());
    }
    
    let query = format!("UPDATE resources SET {} WHERE id = ?", update_parts.join(", "));
    params.push(Box::new(room_id));
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    let affected = conn.execute(&query, &*param_refs).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Room number already exists".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    if affected == 0 {
        return Err("Room not found".to_string());
    }
    
    Ok("Room updated successfully".to_string())
}

#[command]
pub fn delete_room(id: i64) -> Result<String, String> {
    println!("🐛 DEBUG delete_room - Received id: {:?}", id);
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if room is in use by active guests
    println!("🐛 DEBUG delete_room - Checking for active guests...");
    let guest_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM customers WHERE room_id = ?1 AND status = 'active'",
        params![id],
        |row| row.get(0)
    ).map_err(|e| {
        println!("❌ DEBUG delete_room - Error checking guests: {}", e);
        e.to_string()
    })?;
    
    println!("🐛 DEBUG delete_room - Active guests count: {}", guest_count);
    
    if guest_count > 0 {
        return Err("Cannot delete room with active guests".to_string());
    }
    
    // Hard delete the room so the room number can be reused
    println!("🐛 DEBUG delete_room - Executing DELETE query...");
    let affected = conn.execute(
        "DELETE FROM resources WHERE id = ?1",
        params![id],
    ).map_err(|e| {
        println!("❌ DEBUG delete_room - SQL Error: {}", e);
        e.to_string()
    })?;
    
    println!("🐛 DEBUG delete_room - Rows affected: {}", affected);
    
    if affected == 0 {
        return Err("Room not found".to_string());
    }
    
    println!("✅ DEBUG delete_room - Success!");
    Ok("Room deleted successfully".to_string())
}

#[command]
pub fn cleanup_soft_deleted_rooms() -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Remove any soft-deleted rooms that might be blocking UNIQUE constraints
    let affected = conn.execute(
        "DELETE FROM resources WHERE is_active = 0",
        [],
    ).map_err(|e| e.to_string())?;
    
    println!("🧹 Cleaned up {} soft-deleted rooms", affected);
    Ok(format!("Cleaned up {} soft-deleted rooms", affected))
}

// ===== RESOURCE (ALIAS) COMMANDS =====
// These provide business-generic command names while keeping legacy "room" commands.

#[command]
pub fn add_resource(number: String, resource_type: String, daily_rate: f64) -> Result<String, String> {
    add_room(number, resource_type, daily_rate)
}

#[command]
pub fn get_resources() -> Result<Vec<Room>, String> {
    get_rooms()
}

#[command]
pub fn get_available_resources_for_customer(customer_id: Option<i64>) -> Result<Vec<Room>, String> {
    get_available_rooms_for_guest(customer_id)
}

#[command]
pub fn update_resource(resource_id: i64, number: Option<String>, daily_rate: Option<f64>) -> Result<String, String> {
    update_room(resource_id, number, daily_rate)
}

#[command]
pub fn delete_resource(id: i64) -> Result<String, String> {
    delete_room(id)
}

// ===== GUEST COMMANDS =====

#[command]
pub fn add_guest(name: String, phone: Option<String>, room_id: Option<i64>, check_in: String, check_out: Option<String>, daily_rate: f64) -> Result<i64, String> {
    println!("🐛 DEBUG add_guest - Received parameters:");
    println!("  name: {:?}", name);
    println!("  phone: {:?}", phone);
    println!("  room_id: {:?}", room_id);
    println!("  check_in: {:?}", check_in);
    println!("  check_out: {:?}", check_out);
    println!("  daily_rate: {:?}", daily_rate);
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate inputs
    validate_date_format(&check_in)?;
    if let Some(ref checkout) = check_out {
        validate_date_format(checkout)?;
    }
    validate_positive_amount(daily_rate, "daily_rate")?;
    
    if name.trim().is_empty() {
        return Err("Guest name cannot be empty".to_string());
    }
    
    // For walk-in customers (no room), room_id will be None
    if let Some(room_id_val) = room_id {
        // Validate room exists and is active
        let room_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM resources WHERE id = ?1 AND is_active = 1",
            params![room_id_val],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if room_exists == 0 {
            return Err("Room not found or inactive".to_string());
        }
        
        // Check if room is already occupied
        let room_occupied: i64 = conn.query_row(
            "SELECT COUNT(*) FROM resources WHERE id = ?1 AND is_occupied = 1",
            params![room_id_val],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if room_occupied > 0 {
            return Err("Room is already occupied".to_string());
        }
    }
    
    let now = get_current_timestamp();
    
    // Start a transaction to ensure both operations succeed or fail together
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Insert the guest
    tx.execute(
        "INSERT INTO customers (name, phone, room_id, check_in, check_out, daily_rate, status, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)",
        params![name.trim(), phone, room_id, check_in, check_out, daily_rate, now, now],
    ).map_err(|e| e.to_string())?;
    
    let guest_id = tx.last_insert_rowid();
    
    // Update room status to occupied only if room_id is provided
    if let Some(room_id_val) = room_id {
        tx.execute(
            "UPDATE resources SET is_occupied = 1, guest_id = ?1 WHERE id = ?2",
            params![guest_id, room_id_val],
        ).map_err(|e| e.to_string())?;
    }
    
    // Commit the transaction
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(guest_id)
}

// ===== CUSTOMER (ALIAS) COMMANDS =====
// Generic naming wrappers for legacy "guest" commands.

#[command]
pub fn add_customer(name: String, phone: Option<String>, room_id: Option<i64>, check_in: String, check_out: Option<String>, daily_rate: f64) -> Result<i64, String> {
    add_guest(name, phone, room_id, check_in, check_out, daily_rate)
}

#[command]
pub fn get_active_customers() -> Result<Vec<ActiveGuestRow>, String> {
    get_active_guests()
}

#[command]
pub fn get_all_customers() -> Result<Vec<Guest>, String> {
    get_all_guests()
}

#[command]
pub fn get_customer(customer_id: i64) -> Result<ActiveGuestRow, String> {
    get_guest(customer_id)
}

#[command]
pub fn checkout_customer(customer_id: i64, check_out_date: String) -> Result<f64, String> {
    checkout_guest_with_discount(
        customer_id,
        check_out_date,
        "flat".to_string(),
        0.0,
        "".to_string(),
    )
}

#[command]
pub fn checkout_customer_with_discount(
    customer_id: i64,
    check_out_date: String,
    discount_amount: f64,
) -> Result<f64, String> {
    checkout_guest_with_discount(
        customer_id,
        check_out_date,
        "flat".to_string(),
        discount_amount,
        "".to_string(),
    )
}

#[command]
pub fn update_customer(
    guest_id: i64,
    name: Option<String>,
    phone: Option<String>,
    room_id: Option<i64>,
    check_in: Option<String>,
    check_out: Option<String>,
    daily_rate: Option<f64>,
 ) -> Result<bool, String> {
    update_guest(guest_id, name, phone, room_id, check_in, check_out, daily_rate)
}

#[command]
pub fn get_active_guests() -> Result<Vec<ActiveGuestRow>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, r.number, g.check_in, g.check_out, g.daily_rate, 
                CASE WHEN g.room_id IS NULL THEN 1 ELSE 0 END as is_walkin
         FROM customers g 
         LEFT JOIN resources r ON g.room_id = r.id 
         WHERE g.status = 'active'
         ORDER BY 
            CASE WHEN g.room_id IS NULL THEN 1 ELSE 0 END,  -- Walk-ins first
            r.number"
    ).map_err(|e| e.to_string())?;
    
    let guest_iter = stmt.query_map([], |row| {
        Ok(ActiveGuestRow {
            guest_id: row.get(0)?,
            name: row.get(1)?,
            room_number: row.get(2)?,
            check_in: row.get(3)?,
            check_out: row.get(4)?,
            daily_rate: row.get(5)?,
            is_walkin: row.get::<_, i32>(6)? == 1,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut guests = Vec::new();
    for guest in guest_iter {
        guests.push(guest.map_err(|e| e.to_string())?);
    }
    
    Ok(guests)
}

#[command]
pub fn get_all_guests() -> Result<Vec<Guest>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, phone, room_id, check_in, check_out, daily_rate, status, created_at, updated_at
            FROM customers 
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let guest_iter = stmt.query_map([], |row| {
        Ok(Guest {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            room_id: row.get(3)?,
            check_in: row.get(4)?,
            check_out: row.get(5)?,
            daily_rate: row.get(6)?,
            status: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut guests = Vec::new();
    for guest in guest_iter {
        guests.push(guest.map_err(|e| e.to_string())?);
    }
    
    Ok(guests)
}

#[command]
pub fn get_guest(guest_id: i64) -> Result<ActiveGuestRow, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let result = conn.query_row(
        "SELECT g.id, g.name, r.number, g.check_in, g.check_out, g.daily_rate,
                CASE WHEN g.room_id IS NULL THEN 1 ELSE 0 END as is_walkin
         FROM customers g 
         LEFT JOIN resources r ON g.room_id = r.id 
         WHERE g.id = ?1",
        params![guest_id],
        |row| {
            Ok(ActiveGuestRow {
                guest_id: row.get(0)?,
                name: row.get(1)?,
                room_number: row.get(2)?,
                check_in: row.get(3)?,
                check_out: row.get(4)?,
                daily_rate: row.get(5)?,
                is_walkin: row.get::<_, i32>(6)? == 1,
            })
        }
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Guest not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    Ok(result)
}

#[command]
pub fn checkout_guest(guest_id: i64, discount_flat: Option<f64>, discount_pct: Option<f64>) -> Result<CheckoutTotals, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get guest details
    let (check_in, daily_rate): (String, f64) = conn.query_row(
        "SELECT check_in, daily_rate FROM customers WHERE id = ?1 AND status = 'active'",
        params![guest_id],
        |row| Ok((row.get(0)?, row.get(1)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Active guest not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Calculate stay days
    let check_in_date = NaiveDate::parse_from_str(&check_in, "%Y-%m-%d")
        .map_err(|_| "Invalid check-in date format")?;
    let today = Utc::now().date_naive();
    let stay_days = (today - check_in_date).num_days().max(1);
    
    // Calculate room total
    let room_total = stay_days as f64 * daily_rate;
    
    // Calculate unpaid food total
    let unpaid_food: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE guest_id = ?1 AND paid = 0",
        params![guest_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Calculate subtotal
    let mut subtotal = room_total + unpaid_food;
    
    // Apply discounts
    if let Some(pct) = discount_pct {
        if pct > 0.0 && pct <= 100.0 {
            subtotal *= (100.0 - pct) / 100.0;
        }
    }
    
    if let Some(flat) = discount_flat {
        if flat > 0.0 {
            subtotal -= flat;
        }
    }
    
    // Clamp to >= 0
    let grand_total = subtotal.max(0.0);
    
    // Update guest status and free up the room
    let now = get_current_timestamp();
    let today_str = today.format("%Y-%m-%d").to_string();
    
    // Start a transaction to ensure both operations succeed or fail together
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Get the room_id before updating guest status
    let room_id: Option<i64> = tx.query_row(
        "SELECT room_id FROM customers WHERE id = ?1",
        params![guest_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Update guest status
    tx.execute(
        "UPDATE customers SET status = 'checked_out', check_out = ?1, updated_at = ?2 WHERE id = ?3",
        params![today_str, now, guest_id],
    ).map_err(|e| e.to_string())?;
    
    // Update room status to not occupied
    if let Some(room_id) = room_id {
        tx.execute(
            "UPDATE resources SET is_occupied = 0, guest_id = NULL WHERE id = ?1",
            params![room_id],
        )
        .map_err(|e| e.to_string())?;
    }
    
    // Commit the transaction
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(CheckoutTotals {
        room_total,
        unpaid_food,
        grand_total,
        stay_days,
    })
}

#[command]
pub fn update_guest(guest_id: i64, name: Option<String>, phone: Option<String>, room_id: Option<i64>, check_in: Option<String>, check_out: Option<String>, daily_rate: Option<f64>) -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if guest exists
    let guest_exists: bool = conn.query_row(
        "SELECT 1 FROM customers WHERE id = ?1 AND status = 'active'",
        params![guest_id],
        |_| Ok(true)
    ).unwrap_or(false);
    
    if !guest_exists {
        return Err("Guest not found or not active".to_string());
    }
    
    // If room_id is being updated, check room availability
    if let Some(new_room_id) = room_id {
        // Check if the new room is available (not occupied by another guest)
        let room_occupied: bool = conn.query_row(
            "SELECT 1 FROM customers WHERE room_id = ?1 AND status = 'active' AND id != ?2",
            params![new_room_id, guest_id],
            |_| Ok(true)
        ).unwrap_or(false);
        
        if room_occupied {
            return Err("Room is already occupied by another guest".to_string());
        }
        
        // Check if room exists
        let room_exists: bool = conn.query_row(
            "SELECT 1 FROM resources WHERE id = ?1",
            params![new_room_id],
            |_| Ok(true)
        ).unwrap_or(false);
        
        if !room_exists {
            return Err("Room not found".to_string());
        }
    }
    
    // Validate daily_rate if provided
    if let Some(rate) = daily_rate {
        if rate <= 0.0 {
            return Err("Daily rate must be positive".to_string());
        }
    }
    
    // Validate name if provided
    if let Some(ref guest_name) = name {
        if guest_name.trim().is_empty() {
            return Err("Guest name cannot be empty".to_string());
        }
    }
    
    // Build dynamic update query
    let mut update_fields = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(guest_name) = name {
        update_fields.push("name = ?");
        params_vec.push(Box::new(guest_name));
    }
    
    if let Some(guest_phone) = phone {
        update_fields.push("phone = ?");
        params_vec.push(Box::new(guest_phone));
    }
    
    if let Some(new_room_id) = room_id {
        update_fields.push("room_id = ?");
        params_vec.push(Box::new(new_room_id));
    }
    
    if let Some(checkin) = check_in {
        update_fields.push("check_in = ?");
        params_vec.push(Box::new(checkin));
    }
    
    if let Some(checkout) = check_out {
        update_fields.push("check_out = ?");
        params_vec.push(Box::new(checkout));
    }
    
    if let Some(rate) = daily_rate {
        update_fields.push("daily_rate = ?");
        params_vec.push(Box::new(rate));
    }
    
    if update_fields.is_empty() {
        return Ok(true); // No changes to make
    }
    
    // Add updated_at field
    update_fields.push("updated_at = ?");
    params_vec.push(Box::new(chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string()));
    
    // Add guest_id for WHERE clause
    params_vec.push(Box::new(guest_id));
    
    let query = format!(
        "UPDATE customers SET {} WHERE id = ?",
        update_fields.join(", ")
    );
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    conn.execute(&query, params_refs.as_slice())
        .map_err(|e| e.to_string())?;
    
    Ok(true)
}

// ===== MENU COMMANDS =====

#[command]
pub fn add_menu_item(
    name: String,
    sku: Option<String>,
    barcode: Option<String>,
    price: f64,
    category: String,
    description: Option<String>,
    is_available: Option<bool>,
    track_stock: Option<i32>,
    stock_quantity: Option<i32>,
    low_stock_limit: Option<i32>,
) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    validate_positive_amount(price, "price")?;
    
    if name.trim().is_empty() {
        return Err("Menu item name cannot be empty".to_string());
    }
    
    if category.trim().is_empty() {
        return Err("Menu item category cannot be empty".to_string());
    }
    
    let description = description.unwrap_or_default();
    let available = is_available.unwrap_or(true);
    let track_stock = track_stock.unwrap_or(0);
    let stock_quantity = stock_quantity.unwrap_or(0);
    let low_stock_limit = low_stock_limit.unwrap_or(5);

    let sku = sku.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    });
    let barcode = barcode.and_then(|s| {
        let t = s.trim();
        if t.is_empty() {
            None
        } else {
            Some(t.to_string())
        }
    });

    if track_stock != 0 && track_stock != 1 {
        return Err("track_stock must be 0 or 1".to_string());
    }
    if stock_quantity < 0 {
        return Err("stock_quantity must be non-negative".to_string());
    }
    if low_stock_limit < 0 {
        return Err("low_stock_limit must be non-negative".to_string());
    }
    
    let result = conn.execute(
        "INSERT INTO menu_items (name, sku, barcode, price, category, description, is_available, is_active, stock_quantity, track_stock, low_stock_limit)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1, ?8, ?9, ?10)",
        params![
            name.trim(),
            sku,
            barcode,
            price,
            category.trim(),
            description.trim(),
            if available { 1 } else { 0 },
            stock_quantity,
            track_stock,
            low_stock_limit
        ],
    );
    
    match result {
        Ok(_) => Ok(conn.last_insert_rowid()),
        Err(e) => {
            if e.to_string().contains("UNIQUE constraint failed") {
                Err(format!("Menu item '{}' already exists", name))
            } else {
                Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
pub fn get_menu_items() -> Result<Vec<MenuItem>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, sku, barcode, price, category, COALESCE(description, '') as description, is_available, stock_quantity, track_stock, low_stock_limit
         FROM menu_items
         WHERE is_active = 1
         ORDER BY name"
    ).map_err(|e| e.to_string())?;
    
    let item_iter = stmt.query_map([], |row| {
        Ok(MenuItem {
            id: row.get(0)?,
            name: row.get(1)?,
            sku: row.get(2)?,
            barcode: row.get(3)?,
            price: row.get(4)?,
            category: row.get(5)?,
            description: row.get(6)?,
            is_available: row.get::<_, i32>(7)? == 1,
            stock_quantity: row.get(8)?,
            track_stock: row.get(9)?,
            low_stock_limit: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    for item in item_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }
    
    Ok(items)
}

#[command]
pub fn update_menu_item(
    item_id: i64,
    name: Option<String>,
    sku: Option<String>,
    barcode: Option<String>,
    price: Option<f64>,
    category: Option<String>,
    description: Option<String>,
    is_available: Option<bool>,
    track_stock: Option<i32>,
    stock_quantity: Option<i32>,
    low_stock_limit: Option<i32>,
) -> Result<String, String> {
    println!("🐛 DEBUG update_menu_item - Received parameters:");
    println!("  item_id: {:?}", item_id);
    println!("  name: {:?}", name);
    println!("  sku: {:?}", sku);
    println!("  barcode: {:?}", barcode);
    println!("  price: {:?}", price);
    println!("  category: {:?}", category);
    println!("  description: {:?}", description);
    println!("  is_available: {:?}", is_available);
    println!("  track_stock: {:?}", track_stock);
    println!("  stock_quantity: {:?}", stock_quantity);
    println!("  low_stock_limit: {:?}", low_stock_limit);
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Build dynamic update query
    let mut update_parts = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(ref item_name) = name {
        if item_name.trim().is_empty() {
            return Err("Menu item name cannot be empty".to_string());
        }
        update_parts.push("name = ?");
        params.push(Box::new(item_name.trim().to_string()));
    }

    if let Some(raw) = sku {
        let v = raw.trim();
        update_parts.push("sku = ?");
        if v.is_empty() {
            params.push(Box::new(rusqlite::types::Null));
        } else {
            params.push(Box::new(v.to_string()));
        }
    }

    if let Some(raw) = barcode {
        let v = raw.trim();
        update_parts.push("barcode = ?");
        if v.is_empty() {
            params.push(Box::new(rusqlite::types::Null));
        } else {
            params.push(Box::new(v.to_string()));
        }
    }
    
    if let Some(item_price) = price {
        if item_price < 0.0 {
            return Err("Price must be positive".to_string());
        }
        update_parts.push("price = ?");
        params.push(Box::new(item_price));
    }
    
    if let Some(ref cat) = category {
        update_parts.push("category = ?");
        params.push(Box::new(cat.to_string()));
    }

    if let Some(desc) = description {
        update_parts.push("description = ?");
        params.push(Box::new(desc));
    }
    
    if let Some(available) = is_available {
        update_parts.push("is_available = ?");
        params.push(Box::new(if available { 1 } else { 0 }));
    }

    if let Some(track) = track_stock {
        if track != 0 && track != 1 {
            return Err("track_stock must be 0 or 1".to_string());
        }
        update_parts.push("track_stock = ?");
        params.push(Box::new(track));
    }

    if let Some(stock) = stock_quantity {
        if stock < 0 {
            return Err("stock_quantity must be non-negative".to_string());
        }
        update_parts.push("stock_quantity = ?");
        params.push(Box::new(stock));
    }

    if let Some(limit) = low_stock_limit {
        if limit < 0 {
            return Err("low_stock_limit must be non-negative".to_string());
        }
        update_parts.push("low_stock_limit = ?");
        params.push(Box::new(limit));
    }
    
    if update_parts.is_empty() {
        return Err("No fields to update".to_string());
    }
    
    let query = format!("UPDATE menu_items SET {} WHERE id = ?", update_parts.join(", "));
    params.push(Box::new(item_id));
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    let affected = conn.execute(&query, &*param_refs).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Menu item name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    if affected == 0 {
        return Err("Menu item not found".to_string());
    }
    
    Ok("Menu item updated successfully".to_string())
}

// ===== STOCK ADJUSTMENTS (Retail inventory audit) =====

#[command]
pub fn add_stock_adjustment(
    adjustment_date: String,
    reason: Option<String>,
    notes: Option<String>,
    items: Vec<StockAdjustmentItemInput>,
) -> Result<i64, String> {
    validate_date_format(&adjustment_date)?;
    if items.is_empty() {
        return Err("Stock adjustment must have at least one item".to_string());
    }

    let conn = get_db_connection().map_err(|e| e.to_string())?;
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result: Result<i64, String> = (|| {
        conn.execute(
            "INSERT INTO stock_adjustments (adjustment_date, reason, notes, created_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![adjustment_date, reason, notes, get_current_timestamp()],
        )
        .map_err(|e| e.to_string())?;

        let adjustment_id = conn.last_insert_rowid();

        for it in &items {
            validate_positive_i32(it.quantity, "Quantity")?;
            validate_non_empty(&it.mode, "Mode")?;
            let mode = it.mode.trim().to_lowercase();

            let (item_name, current_stock, track_stock): (String, i32, i32) = conn
                .query_row(
                    "SELECT name, COALESCE(stock_quantity, 0), COALESCE(track_stock, 0)
                     FROM menu_items WHERE id = ?1",
                    params![it.menu_item_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                )
                .map_err(|e| {
                    if e.to_string().contains("no rows") {
                        "Product not found".to_string()
                    } else {
                        e.to_string()
                    }
                })?;

            if track_stock != 1 {
                return Err(format!("'{}' is not a tracked stock product", item_name));
            }

            let (qty_change, new_stock) = match mode.as_str() {
                "set" => {
                    let new_stock = it.quantity;
                    (new_stock - current_stock, new_stock)
                }
                "add" => {
                    let new_stock = current_stock + it.quantity;
                    (it.quantity, new_stock)
                }
                "remove" => {
                    let new_stock = current_stock - it.quantity;
                    if new_stock < 0 {
                        return Err(format!(
                            "Cannot remove {} from '{}' (only {} in stock)",
                            it.quantity, item_name, current_stock
                        ));
                    }
                    (-it.quantity, new_stock)
                }
                _ => return Err("Invalid mode (use set/add/remove)".to_string()),
            };

            conn.execute(
                "UPDATE menu_items SET stock_quantity = ?1 WHERE id = ?2 AND COALESCE(track_stock, 0) = 1",
                params![new_stock, it.menu_item_id],
            )
            .map_err(|e| e.to_string())?;

            conn.execute(
                "INSERT INTO stock_adjustment_items
                    (adjustment_id, menu_item_id, item_name, previous_stock, quantity_change, new_stock, note)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    adjustment_id,
                    it.menu_item_id,
                    item_name,
                    current_stock,
                    qty_change,
                    new_stock,
                    it.note
                ],
            )
            .map_err(|e| e.to_string())?;
        }

        Ok(adjustment_id)
    })();

    match result {
        Ok(id) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(id)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[command]
pub fn get_stock_adjustments() -> Result<Vec<StockAdjustmentSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT a.id, a.adjustment_date, a.reason, a.notes,
                    (SELECT COUNT(*) FROM stock_adjustment_items i WHERE i.adjustment_id = a.id) as item_count,
                    a.created_at
             FROM stock_adjustments a
             ORDER BY a.adjustment_date DESC, a.id DESC
             LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(StockAdjustmentSummary {
                id: row.get(0)?,
                adjustment_date: row.get(1)?,
                reason: row.get(2)?,
                notes: row.get(3)?,
                item_count: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_stock_adjustment_details(adjustment_id: i64) -> Result<StockAdjustmentDetails, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let adjustment: StockAdjustmentSummary = conn
        .query_row(
            "SELECT a.id, a.adjustment_date, a.reason, a.notes,
                    (SELECT COUNT(*) FROM stock_adjustment_items i WHERE i.adjustment_id = a.id) as item_count,
                    a.created_at
             FROM stock_adjustments a
             WHERE a.id = ?1",
            params![adjustment_id],
            |row| {
                Ok(StockAdjustmentSummary {
                    id: row.get(0)?,
                    adjustment_date: row.get(1)?,
                    reason: row.get(2)?,
                    notes: row.get(3)?,
                    item_count: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Stock adjustment not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, adjustment_id, menu_item_id, item_name, previous_stock, quantity_change, new_stock, note
             FROM stock_adjustment_items
             WHERE adjustment_id = ?1
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![adjustment_id], |row| {
            Ok(StockAdjustmentItemRow {
                id: row.get(0)?,
                adjustment_id: row.get(1)?,
                menu_item_id: row.get(2)?,
                item_name: row.get(3)?,
                previous_stock: row.get(4)?,
                quantity_change: row.get(5)?,
                new_stock: row.get(6)?,
                note: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let items = iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    Ok(StockAdjustmentDetails { adjustment, items })
}

#[command]
pub fn delete_menu_item(item_id: i64) -> Result<String, String> {
    println!("🐛 DEBUG delete_menu_item - Received item_id: {:?}", item_id);
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if menu item is used in any orders
    println!("🐛 DEBUG delete_menu_item - Checking for existing orders...");
    let order_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sale_items WHERE menu_item_id = ?1",
        params![item_id],
        |row| row.get(0)
    ).map_err(|e| {
        println!("❌ DEBUG delete_menu_item - Error checking orders: {}", e);
        e.to_string()
    })?;
    
    println!("🐛 DEBUG delete_menu_item - Order count: {}", order_count);
    
    if order_count > 0 {
        // Soft delete by setting is_available = 0
        println!("🐛 DEBUG delete_menu_item - Item used in orders, doing soft delete...");
        let affected = conn.execute(
            "UPDATE menu_items SET is_available = 0 WHERE id = ?1",
            params![item_id],
        ).map_err(|e| {
            println!("❌ DEBUG delete_menu_item - Error in soft delete: {}", e);
            e.to_string()
        })?;
        
        println!("🐛 DEBUG delete_menu_item - Soft delete affected rows: {}", affected);
        
        if affected == 0 {
            return Err("Menu item not found".to_string());
        }
        
        println!("✅ DEBUG delete_menu_item - Soft delete success!");
        Ok("Menu item deactivated (used in existing orders)".to_string())
    } else {
        // Hard delete if not used in any orders
        println!("🐛 DEBUG delete_menu_item - Item not used, doing hard delete...");
        let affected = conn.execute(
            "DELETE FROM menu_items WHERE id = ?1",
            params![item_id],
        ).map_err(|e| {
            println!("❌ DEBUG delete_menu_item - Error in hard delete: {}", e);
            e.to_string()
        })?;
        
        println!("🐛 DEBUG delete_menu_item - Hard delete affected rows: {}", affected);
        
        if affected == 0 {
            return Err("Menu item not found".to_string());
        }
        
        println!("✅ DEBUG delete_menu_item - Hard delete success!");
        Ok("Menu item deleted successfully".to_string())
    }
}

// ===== PRODUCT CATEGORIES (RETAIL INVENTORY) =====

#[command]
pub fn get_product_categories() -> Result<Vec<ProductCategory>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, name, color, emoji, created_at FROM product_categories ORDER BY LOWER(name)")
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(ProductCategory {
                id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                emoji: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut categories = Vec::new();
    for c in iter {
        categories.push(c.map_err(|e| e.to_string())?);
    }
    Ok(categories)
}

#[command]
pub fn add_product_category(name: String, color: Option<String>, emoji: Option<String>) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Category name is required".to_string());
    }
    if trimmed.len() > 50 {
        return Err("Category name is too long".to_string());
    }

    let color = color.and_then(|c| {
        let t = c.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });
    let emoji = emoji.and_then(|e| {
        let t = e.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    });

    // Create category if missing
    let _ = conn.execute(
        "INSERT OR IGNORE INTO product_categories(name) VALUES (?1)",
        params![trimmed],
    );

    // If created/exists, apply style if provided
    if color.is_some() || emoji.is_some() {
        let _ = conn.execute(
            "UPDATE product_categories SET color = COALESCE(?1, color), emoji = COALESCE(?2, emoji) WHERE name = ?3",
            params![color, emoji, trimmed],
        );
    }

    let id: i64 = conn
        .query_row(
            "SELECT id FROM product_categories WHERE name = ?1",
            params![trimmed],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    Ok(id)
}

#[command]
pub fn rename_product_category(category_id: i64, name: String) -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Category name is required".to_string());
    }
    if trimmed.len() > 50 {
        return Err("Category name is too long".to_string());
    }

    let affected = conn
        .execute(
            "UPDATE product_categories SET name = ?1 WHERE id = ?2",
            params![trimmed, category_id],
        )
        .map_err(|e| {
            if e.to_string().contains("UNIQUE constraint failed") {
                "Category already exists".to_string()
            } else {
                e.to_string()
            }
        })?;
    Ok(affected > 0)
}

#[command]
pub fn update_product_category(
    category_id: i64,
    name: Option<String>,
    color: Option<String>,
    emoji: Option<String>,
) -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut update_parts: Vec<&str> = Vec::new();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(n) = name {
        let trimmed = n.trim().to_string();
        if trimmed.is_empty() {
            return Err("Category name is required".to_string());
        }
        if trimmed.len() > 50 {
            return Err("Category name is too long".to_string());
        }
        update_parts.push("name = ?");
        params_vec.push(Box::new(trimmed));
    }

    if let Some(c) = color {
        let trimmed = c.trim().to_string();
        let val: Option<String> = if trimmed.is_empty() { None } else { Some(trimmed) };
        update_parts.push("color = ?");
        params_vec.push(Box::new(val));
    }

    if let Some(e) = emoji {
        let trimmed = e.trim().to_string();
        let val: Option<String> = if trimmed.is_empty() { None } else { Some(trimmed) };
        update_parts.push("emoji = ?");
        params_vec.push(Box::new(val));
    }

    if update_parts.is_empty() {
        return Err("No fields to update".to_string());
    }

    let query = format!("UPDATE product_categories SET {} WHERE id = ?", update_parts.join(", "));
    params_vec.push(Box::new(category_id));
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();

    let affected = conn.execute(&query, params_refs.as_slice()).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Category already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(affected > 0)
}

#[command]
pub fn delete_product_category(category_id: i64) -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let affected = conn
        .execute(
            "DELETE FROM product_categories WHERE id = ?1",
            params![category_id],
        )
        .map_err(|e| e.to_string())?;
    Ok(affected > 0)
}

// ===== DASHBOARD COMMANDS =====

#[command]
pub fn dashboard_stats() -> Result<DashboardStats, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let now = Utc::now();
    let current_month_start = format!("{}-{:02}-01", now.year(), now.month());
    let current_month_end = format!("{}-{:02}-{:02}", now.year(), now.month(), 
        NaiveDate::from_ymd_opt(
            if now.month() == 12 { now.year() + 1 } else { now.year() }, 
            if now.month() == 12 { 1 } else { now.month() + 1 }, 
            1
        ).unwrap().pred_opt().unwrap().day()
    );
    
    // Total guests this month (checked in this month)
    let total_guests_this_month: i64 = conn.query_row(
        "SELECT COUNT(*) FROM customers WHERE check_in >= ?1 AND check_in <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Active guests
    let active_guests: i64 = conn.query_row(
        "SELECT COUNT(*) FROM customers WHERE status = 'active'",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Total income this month
    let room_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM((julianday(COALESCE(check_out, date('now'))) - julianday(check_in) + 1) * daily_rate), 0)
         FROM customers 
         WHERE status = 'checked_out' 
         AND check_out >= ?1 AND check_out <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let food_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) 
         FROM sales 
         WHERE paid = 1 
         AND date(paid_at) >= ?1 AND date(paid_at) <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let total_income = room_income + food_income;
    
    // Total expenses this month
    let total_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date >= ?1 AND date <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Total food orders this month
    let total_food_orders: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sales WHERE date(created_at) >= ?1 AND date(created_at) <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    Ok(DashboardStats {
        total_guests_this_month,
        total_income,
        total_expenses,
        profit_loss: total_income - total_expenses,
        total_food_orders,
        active_guests,
    })
}

// Get low stock items for dashboard alerts
#[tauri::command]
pub fn get_low_stock_items() -> Result<Vec<LowStockItem>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, stock_quantity, low_stock_limit 
         FROM menu_items 
         WHERE track_stock = 1 
         AND stock_quantity <= low_stock_limit
         ORDER BY stock_quantity ASC"
    ).map_err(|e| e.to_string())?;
    
    let items = stmt.query_map([], |row| {
        Ok(LowStockItem {
            id: row.get(0)?,
            name: row.get(1)?,
            stock_quantity: row.get(2)?,
            low_stock_limit: row.get(3)?,
        })
    }).map_err(|e| e.to_string())?;
    
    items.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ===== FOOD ORDER COMMANDS =====

#[command]
pub fn add_food_order(guest_id: Option<i64>, customer_type: String, customer_name: Option<String>, items: Vec<OrderItemInput>) -> Result<i64, String> {
    println!("🐛 DEBUG add_food_order - Received parameters:");
    println!("  guest_id: {:?}", guest_id);
    println!("  customer_type: {:?}", customer_type);
    println!("  customer_name: {:?}", customer_name);
    println!("  items count: {:?}", items.len());
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    if items.is_empty() {
        return Err("Order must have at least one item".to_string());
    }
    
    // Check stock availability for tracked items BEFORE starting transaction
    for item in &items {
        if let Some(menu_item_id) = item.menu_item_id {
            let stock_info: Result<(i32, i32), _> = conn.query_row(
                "SELECT stock_quantity, track_stock FROM menu_items WHERE id = ?1",
                params![menu_item_id],
                |row| Ok((row.get(0)?, row.get(1)?))
            );
            
            if let Ok((current_stock, track_stock)) = stock_info {
                if track_stock == 1 && current_stock < item.quantity {
                    return Err(format!(
                        "Insufficient stock for '{}'. Available: {}, Requested: {}",
                        item.item_name, current_stock, item.quantity
                    ));
                }
            }
        }
    }
    
    // Calculate total
    let total_amount: f64 = items.iter().map(|item| item.unit_price * item.quantity as f64).sum();
    println!("🐛 DEBUG add_food_order - Total amount: {:?}", total_amount);
    
    // Insert order
    println!("🐛 DEBUG add_food_order - Inserting food order...");
    let _rows_affected = conn.execute(
        "INSERT INTO sales (guest_id, customer_type, customer_name, created_at, paid, total_amount) 
         VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![guest_id, customer_type, customer_name, get_current_timestamp(), total_amount],
    ).map_err(|e| e.to_string())?;
    
    let order_id = conn.last_insert_rowid();
    
    // Insert order items and decrement stock
    for item in items {
        conn.execute(
            "INSERT INTO sale_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![order_id, item.menu_item_id, item.item_name, item.unit_price, item.quantity, 
                   item.unit_price * item.quantity as f64],
        ).map_err(|e| e.to_string())?;
        
        // Decrement stock for tracked items
        if let Some(menu_item_id) = item.menu_item_id {
            conn.execute(
                "UPDATE menu_items 
                 SET stock_quantity = stock_quantity - ?1 
                 WHERE id = ?2 AND track_stock = 1",
                params![item.quantity, menu_item_id],
            ).map_err(|e| format!("Failed to decrement stock: {}", e))?;
        }
    }
    
    Ok(order_id)
}

#[tauri::command]
pub fn get_food_orders_by_guest(guest_id: i64) -> Result<Vec<FoodOrderSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.paid, fo.paid_at, fo.total_amount,
                GROUP_CONCAT(oi.item_name || ' x' || oi.quantity) as items
            FROM sales fo
            LEFT JOIN sale_items oi ON fo.id = oi.order_id
         WHERE fo.guest_id = ?1
         GROUP BY fo.id, fo.created_at, fo.paid, fo.paid_at, fo.total_amount
         ORDER BY fo.created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let orders = stmt.query_map([guest_id], |row| {
        Ok(FoodOrderSummary {
            id: row.get(0)?,
            created_at: row.get(1)?,
            paid: row.get::<_, i32>(2)? == 1,
            paid_at: row.get(3)?,
            total_amount: row.get(4)?,
            items: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            guest_id: Some(guest_id),
            guest_name: None, // This function doesn't need guest name since it's for a specific guest
        })
    }).map_err(|e| e.to_string())?;
    
    orders.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_food_orders() -> Result<Vec<FoodOrderSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.paid, fo.paid_at, fo.total_amount,
                GROUP_CONCAT(oi.item_name || ' x' || oi.quantity) as items,
                fo.guest_id,
                COALESCE(g.name, 'Walk-in') as guest_name
            FROM sales fo
            LEFT JOIN sale_items oi ON fo.id = oi.order_id
            LEFT JOIN customers g ON fo.guest_id = g.id
         GROUP BY fo.id, fo.created_at, fo.paid, fo.paid_at, fo.total_amount, fo.guest_id, g.name
         ORDER BY fo.created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let orders = stmt.query_map([], |row| {
        Ok(FoodOrderSummary {
            id: row.get(0)?,
            created_at: row.get(1)?,
            paid: row.get::<_, i32>(2)? == 1,
            paid_at: row.get(3)?,
            total_amount: row.get(4)?,
            items: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            guest_id: row.get(6)?,
            guest_name: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;
    
    orders.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_order_paid(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let rows_affected = conn.execute(
        "UPDATE sales SET paid = 1, paid_at = ?1 WHERE id = ?2",
        params![get_current_timestamp(), order_id],
    ).map_err(|e| e.to_string())?;
    
    if rows_affected == 0 {
        Err("Order not found".to_string())
    } else {
        Ok("Order marked as paid".to_string())
    }
}

// ===== EXPENSE COMMANDS =====

#[command]
pub fn add_expense(date: String, category: String, description: Option<String>, amount: f64) -> Result<i64, String> {
    if amount <= 0.0 {
        return Err("Amount must be positive".to_string());
    }
    
    validate_date_format(&date)?;
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO expenses (date, category, description, amount) VALUES (?1, ?2, ?3, ?4)",
        params![date, category, description, amount],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_expenses(start_date: Option<String>, end_date: Option<String>) -> Result<Vec<ExpenseRecord>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let (query, params): (String, Vec<String>) = match (start_date, end_date) {
        (Some(start), Some(end)) => {
            validate_date_format(&start)?;
            validate_date_format(&end)?;
            ("SELECT id, date, category, description, amount FROM expenses WHERE date BETWEEN ?1 AND ?2 ORDER BY date DESC".to_string(),
             vec![start, end])
        }
        (Some(start), None) => {
            validate_date_format(&start)?;
            ("SELECT id, date, category, description, amount FROM expenses WHERE date >= ?1 ORDER BY date DESC".to_string(),
             vec![start])
        }
        (None, Some(end)) => {
            validate_date_format(&end)?;
            ("SELECT id, date, category, description, amount FROM expenses WHERE date <= ?1 ORDER BY date DESC".to_string(),
             vec![end])
        }
        (None, None) => {
            ("SELECT id, date, category, description, amount FROM expenses ORDER BY date DESC LIMIT 100".to_string(),
             vec![])
        }
    };
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let expense_iter = stmt.query_map(rusqlite::params_from_iter(params), |row| {
        Ok(ExpenseRecord {
            id: row.get(0)?,
            date: row.get(1)?,
            category: row.get(2)?,
            description: row.get(3)?,
            amount: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    expense_iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_expenses_by_date_range(start_date: String, end_date: String) -> Result<Vec<ExpenseRecord>, String> {
    validate_date_format(&start_date)?;
    validate_date_format(&end_date)?;
    
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, date, category, description, amount 
         FROM expenses 
         WHERE date >= ?1 AND date <= ?2 
         ORDER BY date DESC"
    ).map_err(|e| e.to_string())?;
    
    let expense_iter = stmt.query_map([&start_date, &end_date], |row| {
        Ok(ExpenseRecord {
            id: row.get(0)?,
            date: row.get(1)?,
            category: row.get(2)?,
            description: row.get(3)?,
            amount: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    expense_iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn update_expense(expense_id: i64, date: Option<String>, category: Option<String>, description: Option<String>, amount: Option<f64>) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Build dynamic update query
    let mut update_parts = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    
    if let Some(ref exp_date) = date {
        validate_date_format(exp_date)?;
        update_parts.push("date = ?");
        params.push(Box::new(exp_date.clone()));
    }
    
    if let Some(ref cat) = category {
        if cat.trim().is_empty() {
            return Err("Category cannot be empty".to_string());
        }
        update_parts.push("category = ?");
        params.push(Box::new(cat.trim().to_string()));
    }
    
    if let Some(ref desc) = description {
        update_parts.push("description = ?");
        params.push(Box::new(desc.clone()));
    }
    
    if let Some(exp_amount) = amount {
        if exp_amount <= 0.0 {
            return Err("Amount must be positive".to_string());
        }
        update_parts.push("amount = ?");
        params.push(Box::new(exp_amount));
    }
    
    if update_parts.is_empty() {
        return Err("No fields to update".to_string());
    }
    
    let query = format!("UPDATE expenses SET {} WHERE id = ?", update_parts.join(", "));
    params.push(Box::new(expense_id));
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    
    let affected = conn.execute(&query, &*param_refs).map_err(|e| e.to_string())?;
    
    if affected == 0 {
        return Err("Expense not found".to_string());
    }
    
    Ok("Expense updated successfully".to_string())
}

#[command]
pub fn delete_expense(expense_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let affected = conn.execute(
        "DELETE FROM expenses WHERE id = ?1",
        params![expense_id],
    ).map_err(|e| e.to_string())?;
    
    if affected == 0 {
        return Err("Expense not found".to_string());
    }
    
    Ok("Expense deleted successfully".to_string())
}

// ===== SUPPLIERS & PURCHASES (Stock-In) COMMANDS =====

#[command]
pub fn add_supplier(
    name: String,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    notes: Option<String>,
) -> Result<i64, String> {
    validate_non_empty(&name, "Supplier name")?;
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO suppliers (name, phone, email, address, notes, is_active) VALUES (?1, ?2, ?3, ?4, ?5, 1)",
        params![name.trim(), phone, email, address, notes],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Supplier name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_suppliers(include_inactive: Option<bool>) -> Result<Vec<Supplier>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let include_inactive = include_inactive.unwrap_or(false);

    let mut stmt = conn
        .prepare(
            "SELECT id, name, phone, email, address, notes, is_active, created_at
             FROM suppliers
             WHERE (?1 = 1) OR (is_active = 1)
             ORDER BY name ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![if include_inactive { 1 } else { 0 }], |row| {
            Ok(Supplier {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                email: row.get(3)?,
                address: row.get(4)?,
                notes: row.get(5)?,
                is_active: row.get::<_, i64>(6)? == 1,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn update_supplier(
    supplier_id: i64,
    name: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    address: Option<String>,
    notes: Option<String>,
    is_active: Option<bool>,
) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut update_parts: Vec<String> = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

    if let Some(ref n) = name {
        validate_non_empty(n, "Supplier name")?;
        update_parts.push("name = ?".to_string());
        params.push(Box::new(n.trim().to_string()));
    }
    if let Some(p) = phone {
        update_parts.push("phone = ?".to_string());
        params.push(Box::new(p));
    }
    if let Some(e) = email {
        update_parts.push("email = ?".to_string());
        params.push(Box::new(e));
    }
    if let Some(a) = address {
        update_parts.push("address = ?".to_string());
        params.push(Box::new(a));
    }
    if let Some(n) = notes {
        update_parts.push("notes = ?".to_string());
        params.push(Box::new(n));
    }
    if let Some(act) = is_active {
        update_parts.push("is_active = ?".to_string());
        params.push(Box::new(if act { 1 } else { 0 }));
    }

    if update_parts.is_empty() {
        return Err("No fields to update".to_string());
    }

    let query = format!("UPDATE suppliers SET {} WHERE id = ?", update_parts.join(", "));
    params.push(Box::new(supplier_id));
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();

    let affected = conn.execute(&query, &*param_refs).map_err(|e| {
        if e.to_string().contains("UNIQUE constraint failed") {
            "Supplier name already exists".to_string()
        } else {
            e.to_string()
        }
    })?;

    if affected == 0 {
        return Err("Supplier not found".to_string());
    }

    Ok("Supplier updated".to_string())
}

#[command]
pub fn delete_supplier(supplier_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let purchase_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM purchases WHERE supplier_id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;
    let payment_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM supplier_payments WHERE supplier_id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if purchase_count > 0 || payment_count > 0 {
        let affected = conn
            .execute(
                "UPDATE suppliers SET is_active = 0 WHERE id = ?1",
                params![supplier_id],
            )
            .map_err(|e| e.to_string())?;
        if affected == 0 {
            return Err("Supplier not found".to_string());
        }
        return Ok("Supplier deactivated (has history)".to_string());
    }

    let affected = conn
        .execute("DELETE FROM suppliers WHERE id = ?1", params![supplier_id])
        .map_err(|e| e.to_string())?;
    if affected == 0 {
        return Err("Supplier not found".to_string());
    }
    Ok("Supplier deleted".to_string())
}

#[command]
pub fn add_purchase(
    supplier_id: Option<i64>,
    purchase_date: String,
    reference: Option<String>,
    notes: Option<String>,
    items: Vec<PurchaseItemInput>,
    payment_mode: Option<String>,
    payment_amount: Option<f64>,
    payment_method: Option<String>,
    payment_note: Option<String>,
    update_stock: Option<bool>,
) -> Result<i64, String> {
    validate_date_format(&purchase_date)?;
    if items.is_empty() {
        return Err("Purchase must have at least one item".to_string());
    }

    let update_stock = update_stock.unwrap_or(true);
    let payment_mode = payment_mode.unwrap_or_else(|| "pay_later".to_string());

    // Validate & compute totals
    let mut total_amount: f64 = 0.0;
    for it in &items {
        validate_non_empty(&it.item_name, "Item name")?;
        validate_positive_i32(it.quantity, "Quantity")?;
        validate_positive_f64(it.unit_cost, "Unit cost")?;
        total_amount += (it.quantity as f64) * it.unit_cost;
    }

    let initial_payment: f64 = match payment_mode.as_str() {
        "pay_now" => total_amount,
        "pay_later" => 0.0,
        "pay_partial" => {
            let a = payment_amount.unwrap_or(0.0);
            if a < 0.0 {
                return Err("Payment amount must be >= 0".to_string());
            }
            if a > total_amount + 1e-9 {
                return Err("Payment amount cannot exceed total".to_string());
            }
            a
        }
        _ => return Err("Invalid payment mode".to_string()),
    };

    if initial_payment > 0.0 {
        let method = payment_method.clone().unwrap_or_else(|| "cash".to_string());
        validate_non_empty(&method, "Payment method")?;
    }

    let conn = get_db_connection().map_err(|e| e.to_string())?;
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result: Result<i64, String> = (|| {
        conn.execute(
            "INSERT INTO purchases (supplier_id, purchase_date, reference, notes, total_amount, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![supplier_id, purchase_date, reference, notes, total_amount, get_current_timestamp()],
        )
        .map_err(|e| e.to_string())?;

        let purchase_id = conn.last_insert_rowid();

        for it in &items {
            let line_total = (it.quantity as f64) * it.unit_cost;
            conn.execute(
                "INSERT INTO purchase_items (purchase_id, menu_item_id, item_name, quantity, unit_cost, line_total)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![purchase_id, it.menu_item_id, it.item_name.trim(), it.quantity, it.unit_cost, line_total],
            )
            .map_err(|e| e.to_string())?;

            if update_stock {
                if let Some(menu_item_id) = it.menu_item_id {
                    // Only increment stock for tracked products
                    conn.execute(
                        "UPDATE menu_items
                         SET stock_quantity = COALESCE(stock_quantity, 0) + ?1
                         WHERE id = ?2 AND COALESCE(track_stock, 0) = 1",
                        params![it.quantity, menu_item_id],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }

        // Record supplier payment (only if supplier is set)
        if supplier_id.is_some() && initial_payment > 0.0 {
            let method = payment_method.unwrap_or_else(|| "cash".to_string());
            conn.execute(
                "INSERT INTO supplier_payments (supplier_id, purchase_id, amount, method, note, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![supplier_id, purchase_id, initial_payment, method.trim(), payment_note, get_current_timestamp()],
            )
            .map_err(|e| e.to_string())?;
        }

        // Ensure DB total matches inserted rows
        let _ = recompute_purchase_total(&conn, purchase_id)?;

        Ok(purchase_id)
    })();

    match result {
        Ok(id) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(id)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[command]
pub fn get_purchases() -> Result<Vec<PurchaseSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT p.id, p.purchase_date, p.supplier_id, s.name, p.reference, p.notes, p.total_amount, p.created_at
             FROM purchases p
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             ORDER BY p.purchase_date DESC, p.id DESC
             LIMIT 200",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            Ok(PurchaseSummary {
                id: row.get(0)?,
                purchase_date: row.get(1)?,
                supplier_id: row.get(2)?,
                supplier_name: row.get(3)?,
                reference: row.get(4)?,
                notes: row.get(5)?,
                total_amount: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_purchase_details(purchase_id: i64) -> Result<PurchaseDetails, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let purchase: PurchaseSummary = conn
        .query_row(
            "SELECT p.id, p.purchase_date, p.supplier_id, s.name, p.reference, p.notes, p.total_amount, p.created_at
             FROM purchases p
             LEFT JOIN suppliers s ON s.id = p.supplier_id
             WHERE p.id = ?1",
            params![purchase_id],
            |row| {
                Ok(PurchaseSummary {
                    id: row.get(0)?,
                    purchase_date: row.get(1)?,
                    supplier_id: row.get(2)?,
                    supplier_name: row.get(3)?,
                    reference: row.get(4)?,
                    notes: row.get(5)?,
                    total_amount: row.get(6)?,
                    created_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Purchase not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, purchase_id, menu_item_id, item_name, quantity, unit_cost, line_total
             FROM purchase_items
             WHERE purchase_id = ?1
             ORDER BY id ASC",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![purchase_id], |row| {
            Ok(PurchaseItemRow {
                id: row.get(0)?,
                purchase_id: row.get(1)?,
                menu_item_id: row.get(2)?,
                item_name: row.get(3)?,
                quantity: row.get(4)?,
                unit_cost: row.get(5)?,
                line_total: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PurchaseDetails { purchase, items })
}

#[command]
pub fn delete_purchase(purchase_id: i64, rollback_stock: Option<bool>) -> Result<String, String> {
    let rollback_stock = rollback_stock.unwrap_or(true);
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;
    let result: Result<(), String> = (|| {
        if rollback_stock {
            let mut stmt = conn
                .prepare(
                    "SELECT menu_item_id, quantity
                     FROM purchase_items
                     WHERE purchase_id = ?1",
                )
                .map_err(|e| e.to_string())?;
            let rows = stmt
                .query_map(params![purchase_id], |row| {
                    Ok((row.get::<_, Option<i64>>(0)?, row.get::<_, i32>(1)?))
                })
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
                .map_err(|e| e.to_string())?;

            for (menu_item_id, qty) in rows {
                if let Some(mid) = menu_item_id {
                    conn.execute(
                        "UPDATE menu_items
                         SET stock_quantity = COALESCE(stock_quantity, 0) - ?1
                         WHERE id = ?2 AND COALESCE(track_stock, 0) = 1",
                        params![qty, mid],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }

        // Delete dependent payments first
        let _ = conn.execute(
            "DELETE FROM supplier_payments WHERE purchase_id = ?1",
            params![purchase_id],
        );

        // Items will be deleted via cascade, but delete explicitly for safety
        let _ = conn.execute(
            "DELETE FROM purchase_items WHERE purchase_id = ?1",
            params![purchase_id],
        );

        let affected = conn
            .execute("DELETE FROM purchases WHERE id = ?1", params![purchase_id])
            .map_err(|e| e.to_string())?;
        if affected == 0 {
            return Err("Purchase not found".to_string());
        }

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok("Purchase deleted".to_string())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[command]
pub fn add_supplier_payment(
    supplier_id: i64,
    purchase_id: Option<i64>,
    amount: f64,
    method: String,
    note: Option<String>,
) -> Result<SupplierBalanceSummary, String> {
    validate_positive_f64(amount, "Payment amount")?;
    validate_non_empty(&method, "Payment method")?;

    let conn = get_db_connection().map_err(|e| e.to_string())?;
    // Ensure supplier exists
    let _: String = conn
        .query_row(
            "SELECT name FROM suppliers WHERE id = ?1",
            params![supplier_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Supplier not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    conn.execute(
        "INSERT INTO supplier_payments (supplier_id, purchase_id, amount, method, note, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![supplier_id, purchase_id, amount, method.trim(), note, get_current_timestamp()],
    )
    .map_err(|e| e.to_string())?;

    compute_supplier_balance_summary(&conn, supplier_id)
}

#[command]
pub fn get_supplier_payments(supplier_id: i64) -> Result<Vec<SupplierPayment>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, supplier_id, purchase_id, amount, method, note, created_at
             FROM supplier_payments
             WHERE supplier_id = ?1
             ORDER BY created_at ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;

    let payments = stmt
        .query_map(params![supplier_id], |row| {
            Ok(SupplierPayment {
                id: row.get(0)?,
                supplier_id: row.get(1)?,
                purchase_id: row.get(2)?,
                amount: row.get(3)?,
                method: row.get(4)?,
                note: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(payments)
}

#[command]
pub fn get_supplier_balance_summaries(include_inactive: Option<bool>) -> Result<Vec<SupplierBalanceSummary>, String> {
    let include_inactive = include_inactive.unwrap_or(false);
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.name,
                    COALESCE((SELECT SUM(total_amount) FROM purchases p WHERE p.supplier_id = s.id), 0) AS total_purchases,
                    COALESCE((SELECT SUM(amount) FROM supplier_payments sp WHERE sp.supplier_id = s.id), 0) AS amount_paid
             FROM suppliers s
             WHERE (?1 = 1) OR (s.is_active = 1)
             ORDER BY s.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![if include_inactive { 1 } else { 0 }], |row| {
            let total_purchases: f64 = row.get(2)?;
            let amount_paid: f64 = row.get(3)?;
            Ok(SupplierBalanceSummary {
                supplier_id: row.get(0)?,
                supplier_name: row.get(1)?,
                total_purchases,
                amount_paid,
                balance_due: (total_purchases - amount_paid).max(0.0),
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_customer_balance_summaries() -> Result<Vec<CustomerBalanceSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.name,
                    COALESCE((SELECT SUM(total_amount) FROM sales s WHERE s.guest_id = c.id), 0) AS total_sales,
                    COALESCE((SELECT SUM(sp.amount)
                              FROM sale_payments sp
                              JOIN sales s2 ON s2.id = sp.sale_id
                              WHERE s2.guest_id = c.id), 0) AS amount_paid
             FROM customers c
             ORDER BY c.name ASC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map([], |row| {
            let total_sales: f64 = row.get(2)?;
            let amount_paid: f64 = row.get(3)?;
            Ok(CustomerBalanceSummary {
                customer_id: row.get(0)?,
                customer_name: row.get(1)?,
                total_sales,
                amount_paid,
                balance_due: (total_sales - amount_paid).max(0.0),
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_customer_sale_balances(customer_id: i64) -> Result<Vec<CustomerSaleBalanceRow>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    // Ensure customer exists
    let _: String = conn
        .query_row(
            "SELECT name FROM customers WHERE id = ?1",
            params![customer_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Customer not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let mut stmt = conn
        .prepare(
            "SELECT s.id, s.created_at, s.total_amount, s.paid,
                    COALESCE((SELECT SUM(amount) FROM sale_payments sp WHERE sp.sale_id = s.id), 0) AS amount_paid
             FROM sales s
             WHERE s.guest_id = ?1
             ORDER BY s.created_at DESC, s.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![customer_id], |row| {
            let total_amount: f64 = row.get(2)?;
            let amount_paid: f64 = row.get(4)?;
            Ok(CustomerSaleBalanceRow {
                sale_id: row.get(0)?,
                created_at: row.get(1)?,
                total_amount,
                amount_paid,
                balance_due: (total_amount - amount_paid).max(0.0),
                paid: row.get::<_, i64>(3)? == 1,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_food_order_payment(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get current payment status
    let current_paid: i64 = conn.query_row(
        "SELECT paid FROM sales WHERE id = ?1",
        params![order_id],
        |row| row.get(0)
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Food order not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Toggle the payment status
    let new_paid = if current_paid == 0 { 1 } else { 0 };
    let paid_at = if new_paid == 1 { 
        Some(get_current_timestamp()) 
    } else { 
        None 
    };
    
    conn.execute(
        "UPDATE sales SET paid = ?1, paid_at = ?2 WHERE id = ?3",
        params![new_paid, paid_at, order_id],
    ).map_err(|e| e.to_string())?;
    
    let status = if new_paid == 1 { "paid" } else { "unpaid" };
    Ok(format!("Food order marked as {}", status))
}

#[tauri::command]
pub fn delete_food_order(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Start a transaction
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;
    
    // Delete order items first (foreign key constraint)
    conn.execute(
        "DELETE FROM sale_items WHERE order_id = ?1",
        params![order_id],
    ).map_err(|e| {
        let _ = conn.execute("ROLLBACK", []);
        e.to_string()
    })?;
    
    // Delete the food order
    let rows_affected = conn.execute(
        "DELETE FROM sales WHERE id = ?1",
        params![order_id],
    ).map_err(|e| {
        let _ = conn.execute("ROLLBACK", []);
        e.to_string()
    })?;
    
    if rows_affected == 0 {
        let _ = conn.execute("ROLLBACK", []);
        return Err("Food order not found".to_string());
    }
    
    // Commit the transaction
    conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
    
    Ok("Food order deleted successfully".to_string())
}

#[tauri::command]
pub fn get_order_details(order_id: i64) -> Result<FoodOrderDetails, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get order details
    let order = conn.query_row(
        "SELECT id, guest_id, customer_type, customer_name, created_at, paid, paid_at, total_amount
         FROM sales WHERE id = ?1",
        params![order_id],
        |row| Ok(FoodOrderInfo {
            id: row.get(0)?,
            guest_id: row.get(1)?,
            customer_type: row.get(2)?,
            customer_name: row.get(3)?,
            created_at: row.get(4)?,
            paid: row.get::<_, i32>(5)? == 1,
            paid_at: row.get(6)?,
            total_amount: row.get(7)?,
        })
    ).map_err(|e| e.to_string())?;
    
    // Get order items
    let mut stmt = conn.prepare(
        "SELECT id, menu_item_id, item_name, quantity, unit_price, line_total
            FROM sale_items WHERE order_id = ?1"
    ).map_err(|e| e.to_string())?;
    
    let items = stmt.query_map([order_id], |row| {
        Ok(OrderItemDetail {
            id: row.get(0)?,
            menu_item_id: row.get(1)?,
            item_name: row.get(2)?,
            quantity: row.get(3)?,
            unit_price: row.get(4)?,
            line_total: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?
    .collect::<Result<Vec<_>, _>>()
    .map_err(|e| e.to_string())?;
    
    Ok(FoodOrderDetails {
        order: order,
        items: items,
    })
}

// ===== SALE PAYMENTS (Partial / Pay-Later) =====

fn compute_sale_payment_summary(conn: &rusqlite::Connection, sale_id: i64) -> Result<SalePaymentSummary, String> {
    // Get sale totals
    let (total_amount, paid, paid_at): (f64, i64, Option<String>) = conn
        .query_row(
            "SELECT total_amount, paid, paid_at FROM sales WHERE id = ?1",
            params![sale_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Sale not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    // Sum payments
    let amount_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?1",
            params![sale_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT id, sale_id, amount, method, note, created_at\n             FROM sale_payments\n             WHERE sale_id = ?1\n             ORDER BY created_at ASC, id ASC",
        )
        .map_err(|e| e.to_string())?;

    let payments = stmt
        .query_map(params![sale_id], |row| {
            Ok(SalePayment {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                amount: row.get(2)?,
                method: row.get(3)?,
                note: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let balance_due = (total_amount - amount_paid).max(0.0);

    Ok(SalePaymentSummary {
        sale_id,
        total_amount,
        amount_paid,
        balance_due,
        paid: paid == 1,
        paid_at,
        payments,
    })
}

#[command]
pub fn get_sale_payment_summary(sale_id: i64) -> Result<SalePaymentSummary, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    compute_sale_payment_summary(&conn, sale_id)
}

#[command]
pub fn add_sale_payment(sale_id: i64, amount: f64, method: String, note: Option<String>) -> Result<SalePaymentSummary, String> {
    if amount <= 0.0 {
        return Err("Payment amount must be > 0".to_string());
    }
    if method.trim().is_empty() {
        return Err("Payment method cannot be empty".to_string());
    }

    let conn = get_db_connection().map_err(|e| e.to_string())?;

    // Ensure the sale exists and get its total
    let total_amount: f64 = conn
        .query_row(
            "SELECT total_amount FROM sales WHERE id = ?1",
            params![sale_id],
            |row| row.get(0),
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Sale not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    conn.execute(
        "INSERT INTO sale_payments (sale_id, amount, method, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        params![sale_id, amount, method.trim(), note, get_current_timestamp()],
    )
    .map_err(|e| e.to_string())?;

    // Recompute paid sum and update sales.paid when fully paid
    let amount_paid: f64 = conn
        .query_row(
            "SELECT COALESCE(SUM(amount), 0) FROM sale_payments WHERE sale_id = ?1",
            params![sale_id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let fully_paid = amount_paid + 1e-9 >= total_amount;
    conn.execute(
        "UPDATE sales\n         SET paid = ?1,\n             paid_at = CASE WHEN ?1 = 1 THEN COALESCE(paid_at, ?2) ELSE NULL END\n         WHERE id = ?3",
        params![if fully_paid { 1 } else { 0 }, get_current_timestamp(), sale_id],
    )
    .map_err(|e| e.to_string())?;

    compute_sale_payment_summary(&conn, sale_id)
}

// ===== SALES (ALIAS) COMMANDS =====
// Generic naming wrappers for legacy "food order" commands.

#[command]
pub fn add_sale(
    guest_id: Option<i64>,
    customer_type: String,
    customer_name: Option<String>,
    items: Vec<OrderItemInput>,
) -> Result<i64, String> {
    add_food_order(guest_id, customer_type, customer_name, items)
}

#[command]
pub fn get_sales() -> Result<Vec<FoodOrderSummary>, String> {
    get_food_orders()
}

#[command]
pub fn get_sales_by_customer(customer_id: i64) -> Result<Vec<FoodOrderSummary>, String> {
    get_food_orders_by_guest(customer_id)
}

#[command]
pub fn mark_sale_paid(order_id: i64) -> Result<String, String> {
    mark_order_paid(order_id)
}

#[command]
pub fn toggle_sale_payment(order_id: i64) -> Result<String, String> {
    toggle_food_order_payment(order_id)
}

#[command]
pub fn delete_sale(order_id: i64) -> Result<String, String> {
    delete_food_order(order_id)
}

#[command]
pub fn get_sale_details(order_id: i64) -> Result<FoodOrderDetails, String> {
    get_order_details(order_id)
}

// ===== SALES RETURNS / REFUNDS =====

#[command]
pub fn get_sale_returnable_items(order_id: i64) -> Result<Vec<ReturnableSaleItem>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    // Ensure sale exists
    let _: i64 = conn
        .query_row("SELECT id FROM sales WHERE id = ?1", params![order_id], |row| row.get(0))
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Sale not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let mut stmt = conn
        .prepare(
            "SELECT si.id,
                    si.menu_item_id,
                    si.item_name,
                    si.unit_price,
                    si.quantity as sold_qty,
                    COALESCE((SELECT SUM(ri.quantity)
                              FROM sale_return_items ri
                              WHERE ri.sale_item_id = si.id), 0) AS returned_qty
             FROM sale_items si
             WHERE si.order_id = ?1
             ORDER BY si.id",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![order_id], |row| {
            let sold: i32 = row.get(4)?;
            let returned: i32 = row.get(5)?;
            let remaining = (sold - returned).max(0);
            Ok(ReturnableSaleItem {
                sale_item_id: row.get(0)?,
                menu_item_id: row.get(1)?,
                item_name: row.get(2)?,
                unit_price: row.get(3)?,
                sold_qty: sold,
                returned_qty: returned,
                remaining_qty: remaining,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn add_sale_return(
    sale_id: i64,
    return_date: String,
    refund_method: Option<String>,
    refund_amount: Option<f64>,
    note: Option<String>,
    items: Vec<SaleReturnItemInput>,
) -> Result<i64, String> {
    validate_date_format(&return_date)?;
    if items.is_empty() {
        return Err("Return must have at least one item".to_string());
    }

    let conn = get_db_connection().map_err(|e| e.to_string())?;
    conn.execute("BEGIN TRANSACTION", []).map_err(|e| e.to_string())?;

    let result: Result<i64, String> = (|| {
        // Ensure sale exists
        let _: i64 = conn
            .query_row("SELECT id FROM sales WHERE id = ?1", params![sale_id], |row| row.get(0))
            .map_err(|e| {
                if e.to_string().contains("no rows") {
                    "Sale not found".to_string()
                } else {
                    e.to_string()
                }
            })?;

        // Build validated item rows and compute expected total
        let mut computed_total: f64 = 0.0;
        let mut expanded: Vec<(i64, Option<i64>, String, f64, i32, Option<String>)> = Vec::new();

        for it in &items {
            validate_positive_i32(it.quantity, "Quantity")?;

            // Fetch sale item and remaining returnable quantity
            let (menu_item_id, item_name, unit_price, sold_qty): (Option<i64>, String, f64, i32) = conn
                .query_row(
                    "SELECT menu_item_id, item_name, unit_price, quantity
                     FROM sale_items
                     WHERE id = ?1 AND order_id = ?2",
                    params![it.sale_item_id, sale_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .map_err(|e| {
                    if e.to_string().contains("no rows") {
                        "Sale item not found".to_string()
                    } else {
                        e.to_string()
                    }
                })?;

            let returned_qty: i32 = conn
                .query_row(
                    "SELECT COALESCE(SUM(quantity), 0) FROM sale_return_items WHERE sale_item_id = ?1",
                    params![it.sale_item_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            let remaining = (sold_qty - returned_qty).max(0);
            if it.quantity > remaining {
                return Err(format!(
                    "Cannot return {} of '{}' (only {} remaining)",
                    it.quantity, item_name, remaining
                ));
            }

            let line_total = unit_price * (it.quantity as f64);
            computed_total += line_total;
            expanded.push((it.sale_item_id, menu_item_id, item_name, unit_price, it.quantity, it.note.clone()));
        }

        let final_refund_amount = refund_amount.unwrap_or(computed_total);
        if final_refund_amount < 0.0 {
            return Err("Refund amount cannot be negative".to_string());
        }
        if final_refund_amount > computed_total + 1e-9 {
            return Err(format!(
                "Refund amount cannot exceed return total ({:.2})",
                computed_total
            ));
        }

        conn.execute(
            "INSERT INTO sale_returns (sale_id, return_date, refund_method, refund_amount, note, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                sale_id,
                return_date,
                refund_method.as_ref().map(|s| s.trim().to_string()),
                final_refund_amount,
                note,
                get_current_timestamp()
            ],
        )
        .map_err(|e| e.to_string())?;

        let return_id = conn.last_insert_rowid();

        for (sale_item_id, menu_item_id, item_name, unit_price, qty, item_note) in expanded {
            let line_total = unit_price * (qty as f64);

            conn.execute(
                "INSERT INTO sale_return_items
                    (return_id, sale_item_id, menu_item_id, item_name, unit_price, quantity, line_total, note)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                params![
                    return_id,
                    sale_item_id,
                    menu_item_id,
                    item_name,
                    unit_price,
                    qty,
                    line_total,
                    item_note
                ],
            )
            .map_err(|e| e.to_string())?;

            // Restock tracked products when possible
            if let Some(mid) = menu_item_id {
                let _ = conn.execute(
                    "UPDATE menu_items
                     SET stock_quantity = COALESCE(stock_quantity, 0) + ?1
                     WHERE id = ?2 AND COALESCE(track_stock, 0) = 1",
                    params![qty, mid],
                );
            }
        }

        Ok(return_id)
    })();

    match result {
        Ok(id) => {
            conn.execute("COMMIT", []).map_err(|e| e.to_string())?;
            Ok(id)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", []);
            Err(e)
        }
    }
}

#[command]
pub fn get_sale_returns(limit: Option<i64>) -> Result<Vec<SaleReturnSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let lim = limit.unwrap_or(100).clamp(1, 500);

    let mut stmt = conn
        .prepare(
            "SELECT r.id, r.sale_id, r.return_date, r.refund_method, r.refund_amount,
                    (SELECT COUNT(*) FROM sale_return_items i WHERE i.return_id = r.id) as item_count,
                    r.created_at
             FROM sale_returns r
             ORDER BY r.return_date DESC, r.id DESC
             LIMIT ?1",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![lim], |row| {
            Ok(SaleReturnSummary {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                return_date: row.get(2)?,
                refund_method: row.get(3)?,
                refund_amount: row.get(4)?,
                item_count: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn get_sale_return_details(return_id: i64) -> Result<SaleReturnDetails, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    let ret: SaleReturnSummary = conn
        .query_row(
            "SELECT r.id, r.sale_id, r.return_date, r.refund_method, r.refund_amount,
                    (SELECT COUNT(*) FROM sale_return_items i WHERE i.return_id = r.id) as item_count,
                    r.created_at
             FROM sale_returns r
             WHERE r.id = ?1",
            params![return_id],
            |row| {
                Ok(SaleReturnSummary {
                    id: row.get(0)?,
                    sale_id: row.get(1)?,
                    return_date: row.get(2)?,
                    refund_method: row.get(3)?,
                    refund_amount: row.get(4)?,
                    item_count: row.get(5)?,
                    created_at: row.get(6)?,
                })
            },
        )
        .map_err(|e| {
            if e.to_string().contains("no rows") {
                "Return not found".to_string()
            } else {
                e.to_string()
            }
        })?;

    let mut stmt = conn
        .prepare(
            "SELECT id, return_id, sale_item_id, menu_item_id, item_name, unit_price, quantity, line_total, note
             FROM sale_return_items
             WHERE return_id = ?1
             ORDER BY id",
        )
        .map_err(|e| e.to_string())?;

    let iter = stmt
        .query_map(params![return_id], |row| {
            Ok(SaleReturnItemRow {
                id: row.get(0)?,
                return_id: row.get(1)?,
                sale_item_id: row.get(2)?,
                menu_item_id: row.get(3)?,
                item_name: row.get(4)?,
                unit_price: row.get(5)?,
                quantity: row.get(6)?,
                line_total: row.get(7)?,
                note: row.get(8)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let items = iter.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    Ok(SaleReturnDetails { ret, items })
}

// Enhanced checkout function with discount support
#[command]
pub fn checkout_guest_with_discount(
    guest_id: i64, 
    check_out_date: String,
    discount_type: String,
    discount_amount: f64,
    _discount_description: String
) -> Result<f64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get guest details
    let (check_in, daily_rate, room_id): (String, f64, Option<i64>) = conn.query_row(
        "SELECT check_in, daily_rate, room_id FROM customers WHERE id = ?1 AND status = 'active'",
        params![guest_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Active guest not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Calculate stay days
    let check_in_date = NaiveDate::parse_from_str(&check_in, "%Y-%m-%d")
        .map_err(|_| "Invalid check-in date format")?;
    let check_out_date_parsed = NaiveDate::parse_from_str(&check_out_date, "%Y-%m-%d")
        .map_err(|_| "Invalid check-out date format")?;
    let stay_days = (check_out_date_parsed - check_in_date).num_days().max(1);
    
    // Calculate room total
    let room_total = stay_days as f64 * daily_rate;
    
    // Calculate unpaid food total
    let unpaid_food: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE guest_id = ?1 AND paid = 0",
        params![guest_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Calculate subtotal before discount
    let subtotal = room_total + unpaid_food;
    
    // Apply discount
    let discount_value = if discount_amount > 0.0 {
        match discount_type.as_str() {
            "percentage" => {
                if discount_amount > 100.0 {
                    return Err("Percentage discount cannot exceed 100%".to_string());
                }
                subtotal * (discount_amount / 100.0)
            },
            "flat" => discount_amount,
            _ => return Err("Invalid discount type. Use 'flat' or 'percentage'".to_string())
        }
    } else {
        0.0
    };
    
    // Calculate final total
    let grand_total = (subtotal - discount_value).max(0.0);
    
    // Update guest status and free up the room
    let now = get_current_timestamp();
    
    // Start a transaction to ensure all operations succeed or fail together
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Update guest checkout status
    tx.execute(
        "UPDATE customers SET status = 'checked_out', check_out = ?1, updated_at = ?2 WHERE id = ?3",
        params![check_out_date, now, guest_id],
    ).map_err(|e| e.to_string())?;
    
    // Free up the room if guest had one
    if let Some(room_id) = room_id {
        tx.execute(
            "UPDATE resources SET is_occupied = 0, guest_id = NULL WHERE id = ?1",
            params![room_id],
        ).map_err(|e| e.to_string())?;
    }
    
    // If there was a discount, log it (you could add a discounts table later)
    if discount_value > 0.0 {
        // For now, we'll just log it in a comment or you could create a discounts table
        // tx.execute(
        //     "INSERT INTO discounts (guest_id, discount_type, discount_amount, description, created_at) 
        //      VALUES (?1, ?2, ?3, ?4, ?5)",
        //     params![guest_id, discount_type, discount_value, discount_description, now],
        // ).map_err(|e| e.to_string())?;
    }
    
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(grand_total)
}

// ===== TAX RATE COMMANDS =====

#[command]
pub fn set_tax_rate(rate: f64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate tax rate
    if rate < 0.0 || rate > 100.0 {
        return Err("Tax rate must be between 0 and 100".to_string());
    }
    
    // Create/migrate settings table
    ensure_settings_table(&conn)?;
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    // Insert or update tax rate
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('tax_rate', ?1, ?2)",
        params![rate.to_string(), now],
    ).map_err(|e| e.to_string())?;
    
    Ok(format!("Tax rate set to {}%", rate))
}

#[command]
pub fn get_tax_rate() -> Result<f64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Try to get tax rate from settings
    let mut stmt = conn.prepare(
        "SELECT value FROM settings WHERE key = 'tax_rate'"
    ).map_err(|e| e.to_string())?;
    
    let result = stmt.query_row([], |row| {
        let value_str: String = row.get(0)?;
        Ok(value_str.parse::<f64>().unwrap_or(5.0))
    });
    
    match result {
        Ok(rate) => Ok(rate),
        Err(_) => {
            // If no tax rate is set, return default 5%
            Ok(5.0)
        }
    }
}

#[command]
pub fn set_tax_enabled(enabled: bool) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;

    // Create/migrate settings table
    ensure_settings_table(&conn)?;
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    // Insert or update tax enabled setting
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('tax_enabled', ?1, ?2)",
        params![enabled.to_string(), now],
    ).map_err(|e| e.to_string())?;
    
    Ok(format!("Tax {} successfully", if enabled { "enabled" } else { "disabled" }))
}

#[command]
pub fn get_tax_enabled() -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Try to get tax enabled setting
    let mut stmt = conn.prepare(
        "SELECT value FROM settings WHERE key = 'tax_enabled'"
    ).map_err(|e| e.to_string())?;
    
    let result = stmt.query_row([], |row| {
        let value_str: String = row.get(0)?;
        Ok(value_str.parse::<bool>().unwrap_or(true))
    });
    
    match result {
        Ok(enabled) => Ok(enabled),
        Err(_) => {
            // If no setting is found, return default true (enabled)
            Ok(true)
        }
    }
}

// ===== OPTIONAL BARCODE / SKU FEATURES =====

#[command]
pub fn set_barcode_enabled(enabled: bool) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('barcode_enabled', ?1, ?2)",
        params![enabled.to_string(), now],
    )
    .map_err(|e| e.to_string())?;

    Ok(if enabled {
        "Barcode features enabled".to_string()
    } else {
        "Barcode features disabled".to_string()
    })
}

#[command]
pub fn get_barcode_enabled() -> Result<bool, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'barcode_enabled'")
        .map_err(|e| e.to_string())?;

    let result = stmt.query_row([], |row| {
        let value_str: String = row.get(0)?;
        Ok(value_str.parse::<bool>().unwrap_or(false))
    });

    match result {
        Ok(v) => Ok(v),
        Err(_) => Ok(false),
    }
}

// ===== CURRENCY / LOCALE SETTINGS =====

fn ensure_settings_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    // If the table was created by an older app version without `updated_at`, migrate it.
    let has_updated_at: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('settings') WHERE name = 'updated_at'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if has_updated_at == 0 {
        conn.execute(
            "ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
            [],
        )
        .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
pub fn set_currency_code(code: String) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let normalized = code.trim().to_uppercase();
    if normalized.len() != 3 || !normalized.chars().all(|c| c.is_ascii_alphabetic()) {
        return Err("Currency code must be a 3-letter ISO code (e.g., USD, EUR)".to_string());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('currency_code', ?1, ?2)",
        rusqlite::params![normalized, now],
    )
    .map_err(|e| e.to_string())?;

    Ok("Currency updated".to_string())
}

#[command]
pub fn get_currency_code() -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'currency_code'")
        .map_err(|e| e.to_string())?;

    let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
    Ok(result.unwrap_or_else(|_| "USD".to_string()))
}

#[command]
pub fn set_locale(locale: String) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let normalized = locale.trim();
    if normalized.is_empty() {
        return Err("Locale cannot be empty (e.g., en-US, fr-FR)".to_string());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('locale', ?1, ?2)",
        rusqlite::params![normalized, now],
    )
    .map_err(|e| e.to_string())?;

    Ok("Locale updated".to_string())
}

#[command]
pub fn get_locale() -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'locale'")
        .map_err(|e| e.to_string())?;

    let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
    Ok(result.unwrap_or_else(|_| "en-US".to_string()))
}

// ===== BUSINESS PROFILE SETTINGS =====

#[command]
pub fn set_business_name(name: String) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let normalized = name.trim();
    if normalized.is_empty() {
        return Err("Business name is required".to_string());
    }
    if normalized.chars().count() > 80 {
        return Err("Business name must be 80 characters or fewer".to_string());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('business_name', ?1, ?2)",
        rusqlite::params![normalized, now],
    )
    .map_err(|e| e.to_string())?;

    Ok("Business name updated".to_string())
}

#[command]
pub fn get_business_name() -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'business_name'")
        .map_err(|e| e.to_string())?;

    let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
    Ok(result.unwrap_or_else(|_| "Business Manager".to_string()))
}

// ===== BUSINESS MODE SETTINGS =====

#[command]
pub fn set_business_mode(mode: String) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let normalized = mode.trim().to_lowercase();
    let normalized = match normalized.as_str() {
        "barbershop" => "salon".to_string(),
        "hotel" | "restaurant" | "retail" | "salon" | "cafe" => normalized,
        _ => {
            return Err("Business mode must be one of: hotel, restaurant, retail, salon, cafe".to_string());
        }
    };

    // If a business mode was already set previously, do not allow switching.
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'business_mode'",
            [],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .map(|v| v.trim().to_lowercase());

    if let Some(existing_mode) = existing {
        // Legacy / merged mode
        let existing_mode = if existing_mode == "barbershop" {
            "salon".to_string()
        } else {
            existing_mode
        };

        if existing_mode != normalized {
            return Err(
                "Business type is locked after first-time setup. To change it, use Settings → Reset Application Data and set up again.".to_string(),
            );
        }
        return Ok("Business mode already set".to_string());
    }

    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('business_mode', ?1, ?2)",
        rusqlite::params![normalized, now],
    )
    .map_err(|e| e.to_string())?;

    Ok("Business mode set".to_string())
}

#[command]
pub fn get_business_mode_status() -> Result<BusinessModeStatus, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let raw: Option<String> = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'business_mode'",
            [],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let locked = raw.as_ref().map(|v| !v.trim().is_empty()).unwrap_or(false);

    let mode = match raw {
        Some(v) => {
            let normalized = v.trim().to_lowercase();
            if normalized == "barbershop" {
                "salon".to_string()
            } else if matches!(normalized.as_str(), "hotel" | "restaurant" | "retail" | "salon" | "cafe") {
                normalized
            } else {
                "hotel".to_string()
            }
        }
        None => "hotel".to_string(),
    };

    Ok(BusinessModeStatus { mode, locked })
}

#[command]
pub fn get_business_mode() -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    ensure_settings_table(&conn)?;

    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = 'business_mode'")
        .map_err(|e| e.to_string())?;

    let result: Result<String, _> = stmt.query_row([], |row| row.get(0));
    let raw = result.unwrap_or_else(|_| "hotel".to_string());
    let normalized = raw.trim().to_lowercase();

    // Legacy / merged mode
    if normalized == "barbershop" {
        return Ok("salon".to_string());
    }

    match normalized.as_str() {
        "hotel" | "restaurant" | "retail" | "salon" | "cafe" => Ok(normalized),
        _ => Ok("hotel".to_string()),
    }
}

// ===== SHIFT MANAGEMENT (Z-REPORT) =====

#[tauri::command]
pub fn open_shift(admin_id: i64, start_cash: f64) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if there's already an open shift
    let existing_shift: Result<i64, _> = conn.query_row(
        "SELECT id FROM shifts WHERE status = 'open'",
        [],
        |row| row.get(0)
    );
    
    if existing_shift.is_ok() {
        return Err("There is already an open shift. Please close it first.".to_string());
    }
    
    let now = get_current_timestamp();
    
    conn.execute(
        "INSERT INTO shifts (opened_at, opened_by, start_cash, status) 
         VALUES (?1, ?2, ?3, 'open')",
        params![now, admin_id, start_cash],
    ).map_err(|e| e.to_string())?;
    
    let shift_id = conn.last_insert_rowid();
    Ok(shift_id)
}

#[tauri::command]
pub fn close_shift(
    shift_id: i64,
    admin_id: i64,
    end_cash_actual: f64,
    notes: Option<String>
) -> Result<ShiftSummary, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get shift info
    let shift_info: Result<(String, i64, f64), _> = conn.query_row(
        "SELECT opened_at, opened_by, start_cash FROM shifts WHERE id = ?1 AND status = 'open'",
        params![shift_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    );
    
    let (opened_at, opened_by, start_cash) = shift_info.map_err(|_| "Shift not found or already closed".to_string())?;
    
    let now = get_current_timestamp();
    
    // Calculate total sales during this shift (paid sales only)
    let total_sales: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) FROM sales 
         WHERE paid = 1 AND paid_at >= ?1 AND paid_at <= ?2",
        params![opened_at, now],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Calculate total expenses during this shift
    let total_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses 
         WHERE date >= ?1 AND date <= ?2",
        params![opened_at.split(' ').next().unwrap_or(&opened_at), now.split(' ').next().unwrap_or(&now)],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Expected end cash = start cash + sales - expenses
    let end_cash_expected = start_cash + total_sales - total_expenses;
    let difference = end_cash_actual - end_cash_expected;
    
    // Update shift
    conn.execute(
        "UPDATE shifts 
         SET closed_at = ?1, closed_by = ?2, end_cash_expected = ?3, end_cash_actual = ?4, 
             difference = ?5, total_sales = ?6, total_expenses = ?7, status = 'closed', notes = ?8
         WHERE id = ?9",
        params![now, admin_id, end_cash_expected, end_cash_actual, difference, 
                total_sales, total_expenses, notes, shift_id],
    ).map_err(|e| e.to_string())?;
    
    Ok(ShiftSummary {
        id: shift_id,
        opened_at,
        closed_at: Some(now.clone()),
        opened_by,
        closed_by: Some(admin_id),
        start_cash,
        end_cash_expected,
        end_cash_actual,
        difference,
        total_sales,
        total_expenses,
        status: "closed".to_string(),
        notes,
    })
}

#[tauri::command]
pub fn get_current_shift() -> Result<Option<ShiftSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, opened_at, closed_at, opened_by, closed_by, start_cash, 
                end_cash_expected, end_cash_actual, difference, total_sales, 
                total_expenses, status, notes
         FROM shifts 
         WHERE status = 'open'
         LIMIT 1"
    ).map_err(|e| e.to_string())?;
    
    let shift = stmt.query_row([], |row| {
        Ok(ShiftSummary {
            id: row.get(0)?,
            opened_at: row.get(1)?,
            closed_at: row.get(2)?,
            opened_by: row.get(3)?,
            closed_by: row.get(4)?,
            start_cash: row.get(5)?,
            end_cash_expected: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
            end_cash_actual: row.get::<_, Option<f64>>(7)?.unwrap_or(0.0),
            difference: row.get::<_, Option<f64>>(8)?.unwrap_or(0.0),
            total_sales: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
            total_expenses: row.get::<_, Option<f64>>(10)?.unwrap_or(0.0),
            status: row.get(11)?,
            notes: row.get(12)?,
        })
    });
    
    match shift {
        Ok(s) => Ok(Some(s)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn get_shift_history(limit: Option<i64>) -> Result<Vec<ShiftSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let query = format!(
        "SELECT id, opened_at, closed_at, opened_by, closed_by, start_cash, 
                end_cash_expected, end_cash_actual, difference, total_sales, 
                total_expenses, status, notes
         FROM shifts 
         ORDER BY opened_at DESC
         LIMIT {}",
        limit.unwrap_or(50)
    );
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    
    let shifts = stmt.query_map([], |row| {
        Ok(ShiftSummary {
            id: row.get(0)?,
            opened_at: row.get(1)?,
            closed_at: row.get(2)?,
            opened_by: row.get(3)?,
            closed_by: row.get(4)?,
            start_cash: row.get(5)?,
            end_cash_expected: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
            end_cash_actual: row.get::<_, Option<f64>>(7)?.unwrap_or(0.0),
            difference: row.get::<_, Option<f64>>(8)?.unwrap_or(0.0),
            total_sales: row.get::<_, Option<f64>>(9)?.unwrap_or(0.0),
            total_expenses: row.get::<_, Option<f64>>(10)?.unwrap_or(0.0),
            status: row.get(11)?,
            notes: row.get(12)?,
        })
    }).map_err(|e| e.to_string())?;
    
    shifts.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ===== LOYALTY SYSTEM COMMANDS (Phase 5) =====

// Get loyalty points configuration
#[command]
pub fn get_loyalty_config() -> Result<(f64, f64), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Default: $10 spent = 1 point, 1 point = $0.10 discount
    let points_per_dollar: f64 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'loyalty_points_per_dollar'",
            [],
            |row| row.get::<_, String>(0)
        )
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.1);
    
    let dollars_per_point: f64 = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'loyalty_dollars_per_point'",
            [],
            |row| row.get::<_, String>(0)
        )
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.1);
    
    Ok((points_per_dollar, dollars_per_point))
}

// Set loyalty points configuration
#[command]
pub fn set_loyalty_config(points_per_dollar: f64, dollars_per_point: f64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('loyalty_points_per_dollar', ?1, ?2)",
        params![points_per_dollar.to_string(), now.clone()],
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('loyalty_dollars_per_point', ?1, ?2)",
        params![dollars_per_point.to_string(), now],
    ).map_err(|e| e.to_string())?;
    
    Ok("Loyalty configuration updated".to_string())
}

// Award loyalty points for a sale (called after order is finalized)
#[command]
pub fn award_loyalty_points(customer_id: i64, order_id: i64, order_total: f64) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get loyalty config
    let (points_per_dollar, _) = get_loyalty_config()?;
    
    // Calculate points to award (e.g., $10 = 1 point)
    let points_to_award = (order_total * points_per_dollar).floor() as i64;
    
    if points_to_award <= 0 {
        return Ok(0);
    }
    
    // Start transaction
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Update customer's loyalty points
    tx.execute(
        "UPDATE customers SET loyalty_points = loyalty_points + ?1 WHERE id = ?2",
        params![points_to_award, customer_id],
    ).map_err(|e| e.to_string())?;
    
    // Record transaction
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    tx.execute(
        "INSERT INTO point_transactions (customer_id, order_id, points_change, reason, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            customer_id,
            order_id,
            points_to_award,
            format!("Earned from Order #{}", order_id),
            now
        ],
    ).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(points_to_award)
}

// Get customer's current loyalty points
#[command]
pub fn get_customer_loyalty_points(customer_id: i64) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let points: i64 = conn
        .query_row(
            "SELECT loyalty_points FROM customers WHERE id = ?1",
            params![customer_id],
            |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;
    
    Ok(points)
}

// Redeem loyalty points for discount
#[command]
pub fn redeem_loyalty_points(customer_id: i64, points_to_redeem: i64) -> Result<f64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    if points_to_redeem <= 0 {
        return Err("Points to redeem must be greater than 0".to_string());
    }
    
    // Get current points
    let current_points: i64 = conn
        .query_row(
            "SELECT loyalty_points FROM customers WHERE id = ?1",
            params![customer_id],
            |row| row.get(0)
        )
        .map_err(|e| e.to_string())?;
    
    if current_points < points_to_redeem {
        return Err(format!("Insufficient points. Customer has {} points", current_points));
    }
    
    // Get loyalty config
    let (_, dollars_per_point) = get_loyalty_config()?;
    
    // Calculate discount amount
    let discount_amount = points_to_redeem as f64 * dollars_per_point;
    
    // Start transaction
    let tx = conn.unchecked_transaction().map_err(|e| e.to_string())?;
    
    // Deduct points from customer
    tx.execute(
        "UPDATE customers SET loyalty_points = loyalty_points - ?1 WHERE id = ?2",
        params![points_to_redeem, customer_id],
    ).map_err(|e| e.to_string())?;
    
    // Record transaction (negative points_change for redemption)
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    tx.execute(
        "INSERT INTO point_transactions (customer_id, order_id, points_change, reason, created_at)
         VALUES (?1, NULL, ?2, ?3, ?4)",
        params![
            customer_id,
            -points_to_redeem,
            format!("Redeemed {} points for ${:.2} discount", points_to_redeem, discount_amount),
            now
        ],
    ).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(discount_amount)
}

// Get loyalty point transaction history for a customer
#[command]
pub fn get_point_transactions(customer_id: i64, limit: Option<i64>) -> Result<Vec<crate::models::PointTransaction>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, customer_id, order_id, points_change, reason, created_at
         FROM point_transactions
         WHERE customer_id = ?1
         ORDER BY created_at DESC
         LIMIT ?2"
    ).map_err(|e| e.to_string())?;
    
    let transactions = stmt.query_map(
        params![customer_id, limit.unwrap_or(50)],
        |row| {
            Ok(crate::models::PointTransaction {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                order_id: row.get(2)?,
                points_change: row.get(3)?,
                reason: row.get(4)?,
                created_at: row.get(5)?,
            })
        }
    ).map_err(|e| e.to_string())?;
    
    transactions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}
