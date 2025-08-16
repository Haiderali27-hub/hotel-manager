use crate::models::*;
use crate::db::*;
use rusqlite::params;
use tauri::command;
use chrono::{NaiveDate, Utc, Datelike};

// ===== ROOM COMMANDS =====

#[command]
pub fn add_room(number: String) -> Result<String, String> {
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
        Ok(_) => Ok(format!("Room {} added successfully", number)),
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
pub fn delete_room(id: i64) -> Result<String, String> {
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
    
    Ok("Room deleted successfully".to_string())
}

// ===== GUEST COMMANDS =====

#[command]
pub fn add_guest(name: String, phone: Option<String>, room_id: i64, check_in: String, check_out: Option<String>, daily_rate: f64) -> Result<i64, String> {
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
    
    // Validate room exists and is active
    let room_exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM rooms WHERE id = ?1 AND is_active = 1",
        params![room_id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    if room_exists == 0 {
        return Err("Room not found or inactive".to_string());
    }
    
    let now = get_current_timestamp();
    conn.execute(
        "INSERT INTO guests (name, phone, room_id, check_in, check_out, daily_rate, status, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'active', ?7, ?8)",
        params![name.trim(), phone, room_id, check_in, check_out, daily_rate, now, now],
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
        "SELECT COUNT(*) FROM guests WHERE check_in >= ?1 AND check_in <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Active guests
    let active_guests: i64 = conn.query_row(
        "SELECT COUNT(*) FROM guests WHERE status = 'active'",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Total income this month
    let room_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM((julianday(COALESCE(check_out, date('now'))) - julianday(check_in) + 1) * daily_rate), 0)
         FROM guests 
         WHERE status = 'checked_out' 
         AND check_out >= ?1 AND check_out <= ?2",
        params![current_month_start, current_month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let food_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) 
         FROM food_orders 
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
        "SELECT COUNT(*) FROM food_orders WHERE date(created_at) >= ?1 AND date(created_at) <= ?2",
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

// ===== FOOD ORDER COMMANDS =====

#[command]
pub fn add_food_order(guest_id: Option<i64>, customer_type: String, customer_name: Option<String>, items: Vec<OrderItemInput>) -> Result<i64, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    if items.is_empty() {
        return Err("Order must have at least one item".to_string());
    }
    
    // Calculate total
    let total_amount: f64 = items.iter().map(|item| item.unit_price * item.quantity as f64).sum();
    
    // Insert order
    let _rows_affected = conn.execute(
        "INSERT INTO food_orders (guest_id, customer_type, customer_name, created_at, paid, total_amount) 
         VALUES (?1, ?2, ?3, ?4, 0, ?5)",
        params![guest_id, customer_type, customer_name, get_current_timestamp(), total_amount],
    ).map_err(|e| e.to_string())?;
    
    let order_id = conn.last_insert_rowid();
    
    // Insert order items
    for item in items {
        conn.execute(
            "INSERT INTO order_items (order_id, menu_item_id, item_name, unit_price, quantity, line_total)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![order_id, item.menu_item_id, item.item_name, item.unit_price, item.quantity, 
                   item.unit_price * item.quantity as f64],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok(order_id)
}

#[command]
pub fn get_food_orders_by_guest(guest_id: i64) -> Result<Vec<FoodOrderSummary>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.paid, fo.paid_at, fo.total_amount,
                GROUP_CONCAT(oi.item_name || ' x' || oi.quantity) as items
         FROM food_orders fo
         LEFT JOIN order_items oi ON fo.id = oi.order_id
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
        })
    }).map_err(|e| e.to_string())?;
    
    orders.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[command]
pub fn mark_order_paid(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let rows_affected = conn.execute(
        "UPDATE food_orders SET paid = 1, paid_at = ?1 WHERE id = ?2",
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
