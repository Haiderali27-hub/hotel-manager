use rusqlite::{Connection, Result};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::command;

#[derive(Debug, Serialize, Deserialize)]
pub struct Guest {
    pub id: Option<i32>,
    pub name: String,
    pub email: String,
    pub phone: String,
    pub room_id: Option<i32>,
    pub check_in_date: Option<String>,
    pub check_out_date: Option<String>,
    pub total_amount: Option<f64>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Room {
    pub id: Option<i32>,
    pub room_number: String,
    pub room_type: String,
    pub price: f64,
    pub is_available: bool,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MenuItem {
    pub id: Option<i32>,
    pub name: String,
    pub category: String,
    pub price: f64,
    pub description: Option<String>,
    pub is_available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Order {
    pub id: Option<i32>,
    pub guest_id: Option<i32>,
    pub menu_item_id: i32,
    pub quantity: i32,
    pub total_price: f64,
    pub status: String,
    pub order_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Revenue {
    pub id: Option<i32>,
    pub source: String,
    pub amount: f64,
    pub date: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Expense {
    pub id: Option<i32>,
    pub category: String,
    pub amount: f64,
    pub date: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FinancialSummary {
    pub total_revenue: f64,
    pub total_expenses: f64,
    pub net_profit: f64,
    pub recent_revenues: Vec<Revenue>,
    pub recent_expenses: Vec<Expense>,
}

fn get_db_connection() -> Result<Connection> {
    let mut db_path = PathBuf::new();
    
    // Get the current working directory and navigate to the project root
    let current_dir = std::env::current_dir().unwrap();
    
    // If we're in src-tauri, go up one level to reach the project root
    if current_dir.ends_with("src-tauri") {
        db_path.push(current_dir.parent().unwrap());
    } else {
        db_path.push(current_dir);
    }
    
    db_path.push("db");
    db_path.push("hotel.db");
    
    Connection::open(db_path)
}

// Guest Management
#[command]
pub fn get_all_guests() -> Result<Vec<Guest>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, email, phone, room_id, check_in_date, check_out_date, total_amount, status FROM guests"
    ).map_err(|e| e.to_string())?;
    
    let guest_iter = stmt.query_map([], |row| {
        Ok(Guest {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            email: row.get(2)?,
            phone: row.get(3)?,
            room_id: row.get(4)?,
            check_in_date: row.get(5)?,
            check_out_date: row.get(6)?,
            total_amount: row.get(7)?,
            status: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut guests = Vec::new();
    for guest in guest_iter {
        guests.push(guest.map_err(|e| e.to_string())?);
    }
    
    Ok(guests)
}

#[command]
pub fn add_guest(guest: Guest) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO guests (name, email, phone, room_id, check_in_date, check_out_date, total_amount, status) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        (&guest.name, &guest.email, &guest.phone, &guest.room_id, &guest.check_in_date, &guest.check_out_date, &guest.total_amount, &guest.status),
    ).map_err(|e| e.to_string())?;
    
    // Update room availability if room is assigned
    if let Some(room_id) = guest.room_id {
        conn.execute(
            "UPDATE rooms SET is_available = 0 WHERE id = ?1",
            [room_id],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok("Guest added successfully".to_string())
}

#[command]
pub fn edit_guest(id: i32, guest: Guest) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get old room_id for availability update
    let old_room_id: Option<i32> = conn.query_row(
        "SELECT room_id FROM guests WHERE id = ?1",
        [id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE guests SET name = ?1, email = ?2, phone = ?3, room_id = ?4, check_in_date = ?5, 
         check_out_date = ?6, total_amount = ?7, status = ?8 WHERE id = ?9",
        (&guest.name, &guest.email, &guest.phone, &guest.room_id, &guest.check_in_date, 
         &guest.check_out_date, &guest.total_amount, &guest.status, id),
    ).map_err(|e| e.to_string())?;
    
    // Update room availability
    if let Some(old_room) = old_room_id {
        conn.execute(
            "UPDATE rooms SET is_available = 1 WHERE id = ?1",
            [old_room],
        ).map_err(|e| e.to_string())?;
    }
    
    if let Some(new_room) = guest.room_id {
        conn.execute(
            "UPDATE rooms SET is_available = 0 WHERE id = ?1",
            [new_room],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok("Guest updated successfully".to_string())
}

#[command]
pub fn checkout_guest(id: i32) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get room_id for availability update
    let room_id: Option<i32> = conn.query_row(
        "SELECT room_id FROM guests WHERE id = ?1",
        [id],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE guests SET status = 'checked_out', check_out_date = date('now') WHERE id = ?1",
        [id],
    ).map_err(|e| e.to_string())?;
    
    // Make room available
    if let Some(room) = room_id {
        conn.execute(
            "UPDATE rooms SET is_available = 1 WHERE id = ?1",
            [room],
        ).map_err(|e| e.to_string())?;
    }
    
    Ok("Guest checked out successfully".to_string())
}

// Room Management
#[command]
pub fn get_all_rooms() -> Result<Vec<Room>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, room_number, room_type, price, is_available, description FROM rooms"
    ).map_err(|e| e.to_string())?;
    
    let room_iter = stmt.query_map([], |row| {
        Ok(Room {
            id: Some(row.get(0)?),
            room_number: row.get(1)?,
            room_type: row.get(2)?,
            price: row.get(3)?,
            is_available: row.get(4)?,
            description: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rooms = Vec::new();
    for room in room_iter {
        rooms.push(room.map_err(|e| e.to_string())?);
    }
    
    Ok(rooms)
}

#[command]
pub fn add_room(room: Room) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO rooms (room_number, room_type, price, is_available, description) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (&room.room_number, &room.room_type, &room.price, &room.is_available, &room.description),
    ).map_err(|e| e.to_string())?;
    
    Ok("Room added successfully".to_string())
}

#[command]
pub fn edit_room(id: i32, room: Room) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE rooms SET room_number = ?1, room_type = ?2, price = ?3, is_available = ?4, description = ?5 WHERE id = ?6",
        (&room.room_number, &room.room_type, &room.price, &room.is_available, &room.description, id),
    ).map_err(|e| e.to_string())?;
    
    Ok("Room updated successfully".to_string())
}

#[command]
pub fn delete_room(id: i32) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM rooms WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    
    Ok("Room deleted successfully".to_string())
}

// Menu Management
#[command]
pub fn get_all_menu_items() -> Result<Vec<MenuItem>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, name, category, price, description, is_available FROM menu_items"
    ).map_err(|e| e.to_string())?;
    
    let menu_iter = stmt.query_map([], |row| {
        Ok(MenuItem {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            category: row.get(2)?,
            price: row.get(3)?,
            description: row.get(4)?,
            is_available: row.get(5)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut items = Vec::new();
    for item in menu_iter {
        items.push(item.map_err(|e| e.to_string())?);
    }
    
    Ok(items)
}

#[command]
pub fn add_menu_item(item: MenuItem) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO menu_items (name, category, price, description, is_available) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (&item.name, &item.category, &item.price, &item.description, &item.is_available),
    ).map_err(|e| e.to_string())?;
    
    Ok("Menu item added successfully".to_string())
}

#[command]
pub fn edit_menu_item(id: i32, item: MenuItem) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE menu_items SET name = ?1, category = ?2, price = ?3, description = ?4, is_available = ?5 WHERE id = ?6",
        (&item.name, &item.category, &item.price, &item.description, &item.is_available, id),
    ).map_err(|e| e.to_string())?;
    
    Ok("Menu item updated successfully".to_string())
}

#[command]
pub fn delete_menu_item(id: i32) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM menu_items WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    
    Ok("Menu item deleted successfully".to_string())
}

// Order Management
#[command]
pub fn get_all_orders() -> Result<Vec<Order>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn.prepare(
        "SELECT id, guest_id, menu_item_id, quantity, total_price, status, order_date FROM food_orders"
    ).map_err(|e| e.to_string())?;
    
    let order_iter = stmt.query_map([], |row| {
        Ok(Order {
            id: Some(row.get(0)?),
            guest_id: row.get(1)?,
            menu_item_id: row.get(2)?,
            quantity: row.get(3)?,
            total_price: row.get(4)?,
            status: row.get(5)?,
            order_date: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut orders = Vec::new();
    for order in order_iter {
        orders.push(order.map_err(|e| e.to_string())?);
    }
    
    Ok(orders)
}

#[command]
pub fn add_order(order: Order) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO food_orders (guest_id, menu_item_id, quantity, total_price, status, order_date) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        (&order.guest_id, &order.menu_item_id, &order.quantity, &order.total_price, &order.status, &order.order_date),
    ).map_err(|e| e.to_string())?;
    
    Ok("Order added successfully".to_string())
}

#[command]
pub fn update_order_status(id: i32, status: String) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "UPDATE food_orders SET status = ?1 WHERE id = ?2",
        [&status, &id.to_string()],
    ).map_err(|e| e.to_string())?;
    
    Ok("Order status updated successfully".to_string())
}

// Financial Management
#[command]
pub fn add_revenue(revenue: Revenue) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO revenue (source, amount, date, description) 
         VALUES (?1, ?2, ?3, ?4)",
        (&revenue.source, &revenue.amount, &revenue.date, &revenue.description),
    ).map_err(|e| e.to_string())?;
    
    Ok("Revenue added successfully".to_string())
}

#[command]
pub fn add_expense(expense: Expense) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    conn.execute(
        "INSERT INTO expenses (category, amount, date, description) 
         VALUES (?1, ?2, ?3, ?4)",
        (&expense.category, &expense.amount, &expense.date, &expense.description),
    ).map_err(|e| e.to_string())?;
    
    Ok("Expense added successfully".to_string())
}

#[command]
pub fn get_financial_summary() -> Result<FinancialSummary, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let total_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM revenue",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let total_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses",
        [],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let net_profit = total_revenue - total_expenses;
    
    // Get recent revenues
    let mut stmt = conn.prepare(
        "SELECT id, source, amount, date, description FROM revenue ORDER BY date DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;
    
    let revenue_iter = stmt.query_map([], |row| {
        Ok(Revenue {
            id: Some(row.get(0)?),
            source: row.get(1)?,
            amount: row.get(2)?,
            date: row.get(3)?,
            description: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut recent_revenues = Vec::new();
    for revenue in revenue_iter {
        recent_revenues.push(revenue.map_err(|e| e.to_string())?);
    }
    
    // Get recent expenses
    let mut stmt = conn.prepare(
        "SELECT id, category, amount, date, description FROM expenses ORDER BY date DESC LIMIT 10"
    ).map_err(|e| e.to_string())?;
    
    let expense_iter = stmt.query_map([], |row| {
        Ok(Expense {
            id: Some(row.get(0)?),
            category: row.get(1)?,
            amount: row.get(2)?,
            date: row.get(3)?,
            description: row.get(4)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut recent_expenses = Vec::new();
    for expense in expense_iter {
        recent_expenses.push(expense.map_err(|e| e.to_string())?);
    }
    
    Ok(FinancialSummary {
        total_revenue,
        total_expenses,
        net_profit,
        recent_revenues,
        recent_expenses,
    })
}
