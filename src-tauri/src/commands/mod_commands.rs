use crate::models::*;
use crate::db::*;
use rusqlite::{params, Connection};
use tauri::command;
use chrono::{NaiveDate, Utc};
use std::fs;
use std::path::Path;

// ===== ROOM COMMANDS =====

#[command]
pub fn add_room(number: String) -> Result<Room, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate input
    if number.trim().is_empty() {
        return Err("Room number cannot be empty".to_string());
    }
    
    let result = conn.execute(
        "INSERT INTO rooms (number, is_active) VALUES (?1, 1)",
        params![number.trim()],
    );
    
    match result {
        Ok(_) => {
            let room_id = conn.last_insert_rowid();
            Ok(Room {
                id: room_id,
                number: number.trim().to_string(),
                is_active: true,
            })
        }
        Err(e) => {
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
        "SELECT id, number, is_active FROM rooms ORDER BY number"
    ).map_err(|e| e.to_string())?;
    
    let room_iter = stmt.query_map([], |row| {
        Ok(Room {
            id: row.get(0)?,
            number: row.get(1)?,
            is_active: row.get::<_, i32>(2)? == 1,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rooms = Vec::new();
    for room in room_iter {
        rooms.push(room.map_err(|e| e.to_string())?);
    }
    
    Ok(rooms)
}

#[command]
pub fn delete_room(id: i64) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Check if room is in use by active guests
    let guest_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM guests WHERE room_id = ?1 AND status = 'active'",
        params![id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if guest_count > 0 {
        return Err("Cannot delete room with active guests".to_string());
    }
    
    // Soft delete by setting is_active = 0
    let affected = conn.execute(
        "UPDATE rooms SET is_active = 0 WHERE id = ?1",
        params![id],
    ).map_err(|e| e.to_string())?;
    
    if affected == 0 {
        return Err("Room not found".to_string());
    }
    
    Ok(())
}

// ===== GUEST COMMANDS =====

#[command]
pub fn add_guest(g: NewGuest) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate inputs
    validate_date_format(&g.check_in)?;
    if let Some(ref checkout) = g.check_out {
        validate_date_format(checkout)?;
    }
    validate_positive_amount(g.daily_rate, "daily_rate")?;
    
    if g.name.trim().is_empty() {
        return Err("Guest name cannot be empty".to_string());
    }
    
    // Validate room exists and is active
    let room_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM rooms WHERE id = ?1 AND is_active = 1",
        params![g.room_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if room_exists == 0 {
        return Err("Room not found or inactive".to_string());
    }
    
    let now = get_current_timestamp();
    let result = conn.execute(
        "INSERT INTO guests (name, phone, room_id, check_in, check_out, daily_rate, status, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)",
        params![g.name.trim(), g.phone, g.room_id, g.check_in, g.check_out, g.daily_rate, now, now],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_active_guests() -> Result<Vec<ActiveGuestRow>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, r.number, g.check_in, g.daily_rate 
         FROM guests g 
         JOIN rooms r ON g.room_id = r.id 
         WHERE g.status = 'active'
         ORDER BY r.number"
    ).map_err(|e| e.to_string())?;
    
    let guest_iter = stmt.query_map([], |row| {
        Ok(ActiveGuestRow {
            guest_id: row.get(0)?,
            name: row.get(1)?,
            room_number: row.get(2)?,
            check_in: row.get(3)?,
            daily_rate: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut guests = Vec::new();
    for guest in guest_iter {
        guests.push(guest.map_err(|e| e.to_string())?);
    }
    
    Ok(guests)
}

#[command]
pub fn edit_guest(guest_id: i64, new_room_id: Option<i64>, new_checkout: Option<String>, new_rate: Option<f64>) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate guest exists and is active
    let guest_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM guests WHERE id = ?1 AND status = 'active'",
        params![guest_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if guest_exists == 0 {
        return Err("Active guest not found".to_string());
    }
    
    // Validate inputs
    if let Some(room_id) = new_room_id {
        let room_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM rooms WHERE id = ?1 AND is_active = 1",
            params![room_id],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if room_exists == 0 {
            return Err("Room not found or inactive".to_string());
        }
    }
    
    if let Some(ref checkout) = new_checkout {
        validate_date_format(checkout)?;
    }
    
    if let Some(rate) = new_rate {
        validate_positive_amount(rate, "daily_rate")?;
    }
    
    let now = get_current_timestamp();
    
    // Build dynamic query based on provided parameters
    let mut query_parts = vec!["UPDATE guests SET updated_at = ?1".to_string()];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now)];
    let mut param_index = 2;
    
    if let Some(room_id) = new_room_id {
        query_parts.push(format!("room_id = ?{}", param_index));
        params_vec.push(Box::new(room_id));
        param_index += 1;
    }
    
    if let Some(checkout) = new_checkout {
        query_parts.push(format!("check_out = ?{}", param_index));
        params_vec.push(Box::new(checkout));
        param_index += 1;
    }
    
    if let Some(rate) = new_rate {
        query_parts.push(format!("daily_rate = ?{}", param_index));
        params_vec.push(Box::new(rate));
        param_index += 1;
    }
    
    query_parts.push(format!("WHERE id = ?{}", param_index));
    params_vec.push(Box::new(guest_id));
    
    let query = query_parts.join(", ");
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    conn.execute(&query, &params_refs[..]).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
pub fn checkout_guest(guest_id: i64, discount_flat: Option<f64>, discount_pct: Option<f64>) -> Result<CheckoutTotals, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get guest details
    let (check_in, daily_rate): (String, f64) = conn.query_row(
        "SELECT check_in, daily_rate FROM guests WHERE id = ?1 AND status = 'active'",
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
        "SELECT COALESCE(SUM(total_amount), 0) FROM food_orders WHERE guest_id = ?1 AND paid = 0",
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
    
    // Update guest status
    let now = get_current_timestamp();
    let today_str = today.format("%Y-%m-%d").to_string();
    
    conn.execute(
        "UPDATE guests SET status = 'checked_out', check_out = ?1, updated_at = ?2 WHERE id = ?3",
        params![today_str, now, guest_id],
    ).map_err(|e| e.to_string())?;
    
    Ok(CheckoutTotals {
        room_total,
        unpaid_food,
        grand_total,
        stay_days,
    })
}

// ===== MENU COMMANDS =====

#[command]
pub fn add_menu_item(name: String, price: f64) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    validate_positive_amount(price, "price")?;
    
    if name.trim().is_empty() {
        return Err("Menu item name cannot be empty".to_string());
    }
    
    let result = conn.execute(
        "INSERT INTO menu_items (name, price, is_active) VALUES (?1, ?2, 1)",
        params![name.trim(), price],
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

#[command]
pub fn get_menu_items() -> Result<Vec<MenuItem>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, price, is_active FROM menu_items ORDER BY name"
    ).map_err(|e| e.to_string())?;
    
    let item_iter = stmt.query_map([], |row| {
        Ok(MenuItem {
            id: row.get(0)?,
            name: row.get(1)?,
            price: row.get(2)?,
            is_active: row.get::<_, i32>(3)? == 1,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    for item in item_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }
    
    Ok(items)
}

#[command]
pub fn update_menu_item(id: i64, name: Option<String>, price: Option<f64>, is_active: Option<bool>) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate inputs
    if let Some(ref item_name) = name {
        if item_name.trim().is_empty() {
            return Err("Menu item name cannot be empty".to_string());
        }
    }
    
    if let Some(item_price) = price {
        validate_positive_amount(item_price, "price")?;
    }
    
    // Build dynamic query
    let mut query_parts = vec!["UPDATE menu_items SET".to_string()];
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    let mut updates = vec![];
    
    if let Some(item_name) = name {
        updates.push(format!("name = ?{}", updates.len() + 1));
        params_vec.push(Box::new(item_name.trim().to_string()));
    }
    
    if let Some(item_price) = price {
        updates.push(format!("price = ?{}", updates.len() + 1));
        params_vec.push(Box::new(item_price));
    }
    
    if let Some(active) = is_active {
        updates.push(format!("is_active = ?{}", updates.len() + 1));
        params_vec.push(Box::new(if active { 1 } else { 0 }));
    }
    
    if updates.is_empty() {
        return Err("No fields to update".to_string());
    }
    
    query_parts.push(updates.join(", "));
    query_parts.push(format!("WHERE id = ?{}", updates.len() + 1));
    params_vec.push(Box::new(id));
    
    let query = query_parts.join(" ");
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let affected = conn.execute(&query, &params_refs[..]).map_err(|e| e.to_string())?;
    
    if affected == 0 {
        return Err("Menu item not found".to_string());
    }
    
    Ok(())
}

// ===== ORDER COMMANDS =====

#[command]
pub fn add_food_order(order: NewFoodOrder) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Validate customer type
    if order.customer_type != "GUEST" && order.customer_type != "WALK_IN" {
        return Err("Invalid customer_type. Must be 'GUEST' or 'WALK_IN'".to_string());
    }
    
    // Validate guest if customer_type is GUEST
    if order.customer_type == "GUEST" {
        if order.guest_id.is_none() {
            return Err("guest_id is required for GUEST orders".to_string());
        }
        
        let guest_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM guests WHERE id = ?1 AND status = 'active'",
            params![order.guest_id.unwrap()],
            |row| row.get(0)
        ).map_err(|e| e.to_string())?;
        
        if guest_exists == 0 {
            return Err("Active guest not found".to_string());
        }
    }
    
    if order.items.is_empty() {
        return Err("Order must have at least one item".to_string());
    }
    
    // Validate all items
    for item in &order.items {
        validate_positive_amount(item.unit_price, "unit_price")?;
        if item.quantity <= 0 {
            return Err("Quantity must be > 0".to_string());
        }
        if item.item_name.trim().is_empty() {
            return Err("Item name cannot be empty".to_string());
        }
    }
    
    let mut tx = start_transaction(&conn).map_err(|e| e.to_string())?;
    
    let now = get_current_timestamp();
    
    // Insert order header
    let order_id = {
        tx.execute(
            "INSERT INTO food_orders (guest_id, customer_type, customer_name, created_at, paid, total_amount) 
             VALUES (?1, ?2, ?3, ?4, 0, 0)",
            params![order.guest_id, order.customer_type, order.customer_name, now],
        ).map_err(|e| e.to_string())?;
        
        tx.last_insert_rowid()
    };
    
    // Insert order items and calculate total
    let mut total_amount = 0.0;
    
    for item in &order.items {
        let line_total = item.unit_price * item.quantity as f64;
        total_amount += line_total;
        
        tx.execute(
            "INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![order_id, item.menu_item_id, item.item_name.trim(), item.unit_price, item.quantity, line_total],
        ).map_err(|e| e.to_string())?;
    }
    
    // Update order total
    tx.execute(
        "UPDATE food_orders SET total_amount = ?1 WHERE id = ?2",
        params![total_amount, order_id],
    ).map_err(|e| e.to_string())?;
    
    tx.commit().map_err(|e| e.to_string())?;
    
    Ok(order_id)
}

#[command]
pub fn get_food_orders_by_guest(guest_id: i64) -> Result<Vec<OrderSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get orders
    let mut stmt = conn.prepare(
        "SELECT id, customer_type, customer_name, created_at, paid, paid_at, total_amount 
         FROM food_orders 
         WHERE guest_id = ?1 
         ORDER BY created_at DESC"
    ).map_err(|e| e.to_string())?;
    
    let order_iter = stmt.query_map(params![guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,      // id
            row.get::<_, String>(1)?,   // customer_type
            row.get::<_, Option<String>>(2)?, // customer_name
            row.get::<_, String>(3)?,   // created_at
            row.get::<_, i32>(4)? == 1, // paid
            row.get::<_, Option<String>>(5)?, // paid_at
            row.get::<_, f64>(6)?,      // total_amount
        ))
    }).map_err(|e| e.to_string())?;
    
    let mut orders = Vec::new();
    
    for order_result in order_iter {
        let (order_id, customer_type, customer_name, created_at, paid, paid_at, total_amount) = 
            order_result.map_err(|e| e.to_string())?;
        
        // Get order items
        let mut item_stmt = conn.prepare(
            "SELECT id, item_name, unit_price, quantity, line_total 
             FROM order_items 
             WHERE order_id = ?1 
             ORDER BY id"
        ).map_err(|e| e.to_string())?;
        
        let item_iter = item_stmt.query_map(params![order_id], |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                item_name: row.get(1)?,
                unit_price: row.get(2)?,
                quantity: row.get(3)?,
                line_total: row.get(4)?,
            })
        }).map_err(|e| e.to_string())?;
        
        let mut items = Vec::new();
        for item in item_iter {
            items.push(item.map_err(|e| e.to_string())?);
        }
        
        orders.push(OrderSummary {
            id: order_id,
            customer_type,
            customer_name,
            created_at,
            paid,
            paid_at,
            total_amount,
            items,
        });
    }
    
    Ok(orders)
}

#[command]
pub fn mark_order_paid(order_id: i64, paid: bool) -> Result<(), String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let now = if paid { Some(get_current_timestamp()) } else { None };
    
    let affected = conn.execute(
        "UPDATE food_orders SET paid = ?1, paid_at = ?2 WHERE id = ?3",
        params![if paid { 1 } else { 0 }, now, order_id],
    ).map_err(|e| e.to_string())?;
    
    if affected == 0 {
        return Err("Order not found".to_string());
    }
    
    Ok(())
}

// ===== EXPENSE COMMANDS =====

#[command]
pub fn add_expense(e: ExpenseInput) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    validate_date_format(&e.date)?;
    validate_positive_amount(e.amount, "amount")?;
    
    if e.category.trim().is_empty() {
        return Err("Category cannot be empty".to_string());
    }
    
    conn.execute(
        "INSERT INTO expenses (date, category, description, amount) VALUES (?1, ?2, ?3, ?4)",
        params![e.date, e.category.trim(), e.description, e.amount],
    ).map_err(|e| e.to_string())?;
    
    Ok(conn.last_insert_rowid())
}

#[command]
pub fn get_expenses(date_from: String, date_to: String, category: Option<String>) -> Result<Vec<ExpenseRow>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    validate_date_format(&date_from)?;
    validate_date_format(&date_to)?;
    
    let mut query = "SELECT id, date, category, description, amount FROM expenses WHERE date >= ?1 AND date <= ?2".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![
        Box::new(date_from),
        Box::new(date_to),
    ];
    
    if let Some(cat) = category {
        if !cat.trim().is_empty() {
            query.push_str(" AND category = ?3");
            params_vec.push(Box::new(cat.trim().to_string()));
        }
    }
    
    query.push_str(" ORDER BY date DESC, id DESC");
    
    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let expense_iter = stmt.query_map(&params_refs[..], |row| {
        Ok(ExpenseRow {
            id: row.get(0)?,
            date: row.get(1)?,
            category: row.get(2)?,
            description: row.get(3)?,
            amount: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut expenses = Vec::new();
    for expense in expense_iter {
        expenses.push(expense.map_err(|e| e.to_string())?);
    }
    
    Ok(expenses)
}
