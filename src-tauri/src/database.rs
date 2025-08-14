use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Guest {
    pub id: Option<i32>,
    pub name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub room: i32,
    pub checkin_date: String,
    pub checkout_date: Option<String>,
    pub total_amount: Option<f64>,
    pub paid_amount: Option<f64>,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FoodOrder {
    pub id: Option<i32>,
    pub guest_id: Option<i32>,
    pub room_number: i32,
    pub items: String,
    pub total_amount: f64,
    pub status: String,
    pub order_date: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Revenue {
    pub id: Option<i32>,
    pub source: String,
    pub description: String,
    pub amount: f64,
    pub revenue_date: String,
    pub guest_id: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Expense {
    pub id: Option<i32>,
    pub category: String,
    pub description: String,
    pub amount: f64,
    pub expense_date: String,
    pub payment_method: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    #[serde(rename = "totalGuests")]
    pub total_guests: i32,
    #[serde(rename = "activeGuests")]
    pub active_guests: i32,
    #[serde(rename = "totalIncome")]
    pub total_income: f64,
    #[serde(rename = "totalExpenses")]
    pub total_expenses: f64,
    #[serde(rename = "profitLoss")]
    pub profit_loss: f64,
    #[serde(rename = "totalFoodOrders")]
    pub total_food_orders: i32,
    pub currency: String,
}

fn get_db_connection() -> Result<Connection> {
    // Get the current working directory and construct the database path
    let current_dir = std::env::current_dir().expect("Failed to get current directory");
    let db_path = current_dir.join("db").join("hotel.db");
    
    println!("Attempting to connect to database at: {:?}", db_path);
    
    // Ensure the database directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).expect("Failed to create database directory");
    }
    
    Connection::open(db_path)
}

fn ensure_tables_exist() -> Result<()> {
    let conn = get_db_connection()?;
    
    // Create additional tables needed for the hotel management
    conn.execute(
        "CREATE TABLE IF NOT EXISTS revenue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source TEXT NOT NULL,
            description TEXT,
            amount REAL NOT NULL,
            revenue_date TEXT NOT NULL,
            guest_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS expenses (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category TEXT NOT NULL,
            description TEXT NOT NULL,
            amount REAL NOT NULL,
            expense_date TEXT NOT NULL,
            payment_method TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS food_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guest_id INTEGER,
            room_number INTEGER NOT NULL,
            items TEXT NOT NULL,
            total_amount REAL NOT NULL,
            status TEXT DEFAULT 'pending',
            order_date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )",
        [],
    )?;

    // Update guests table with additional fields
    conn.execute(
        "ALTER TABLE guests ADD COLUMN email TEXT",
        [],
    ).ok(); // Ignore error if column already exists

    conn.execute(
        "ALTER TABLE guests ADD COLUMN phone TEXT",
        [],
    ).ok();

    conn.execute(
        "ALTER TABLE guests ADD COLUMN total_amount REAL DEFAULT 0",
        [],
    ).ok();

    conn.execute(
        "ALTER TABLE guests ADD COLUMN paid_amount REAL DEFAULT 0",
        [],
    ).ok();

    conn.execute(
        "ALTER TABLE guests ADD COLUMN status TEXT DEFAULT 'active'",
        [],
    ).ok();

    Ok(())
}

#[tauri::command]
pub fn get_dashboard_stats() -> Result<DashboardStats, String> {
    println!("🔍 Starting get_dashboard_stats...");
    
    println!("📋 Setting up database tables...");
    ensure_tables_exist().map_err(|e| {
        let error_msg = format!("Database setup error: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    println!("🔗 Connecting to database...");
    let conn = get_db_connection().map_err(|e| {
        let error_msg = format!("Database connection error: {}", e);
        println!("❌ {}", error_msg);
        error_msg
    })?;
    
    println!("✅ Database connected successfully!");
    
    let current_month = "2025-08"; // Current month for filtering
    println!("📅 Filtering data for month: {}", current_month);
    
    // Total guests this month
    let total_guests: i32 = conn.query_row(
        "SELECT COUNT(*) FROM guests WHERE substr(checkin_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0);

    // Active guests
    let active_guests: i32 = conn.query_row(
        "SELECT COUNT(*) FROM guests WHERE status = 'active'",
        [],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0);

    // Total income this month
    let total_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM revenue WHERE substr(revenue_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0.0);

    // Total expenses this month
    let total_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE substr(expense_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0.0);

    // Total food orders this month
    let total_food_orders: i32 = conn.query_row(
        "SELECT COUNT(*) FROM food_orders WHERE substr(order_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0);

    let profit_loss = total_income - total_expenses;

    let stats = DashboardStats {
        total_guests,
        active_guests,
        total_income,
        total_expenses,
        profit_loss,
        total_food_orders,
        currency: "Rs.".to_string(),
    };
    
    println!("📊 Dashboard stats calculated:");
    println!("   - Total Guests: {}", total_guests);
    println!("   - Active Guests: {}", active_guests);
    println!("   - Total Income: {}", total_income);
    println!("   - Total Expenses: {}", total_expenses);
    println!("   - Profit/Loss: {}", profit_loss);
    println!("   - Food Orders: {}", total_food_orders);
    
    Ok(stats)
}

#[tauri::command]
pub fn get_all_guests() -> Result<Vec<Guest>, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, email, phone, room, checkin_date, checkout_date, 
         total_amount, paid_amount, status FROM guests ORDER BY checkin_date DESC"
    ).map_err(|e| format!("Query preparation error: {}", e))?;
    
    let guest_iter = stmt.query_map([], |row| {
        Ok(Guest {
            id: Some(row.get(0)?),
            name: row.get(1)?,
            email: row.get(2)?,
            phone: row.get(3)?,
            room: row.get(4)?,
            checkin_date: row.get(5)?,
            checkout_date: row.get(6)?,
            total_amount: row.get(7)?,
            paid_amount: row.get(8)?,
            status: row.get::<_, Option<String>>(9)?.unwrap_or_else(|| "active".to_string()),
        })
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut guests = Vec::new();
    for guest in guest_iter {
        guests.push(guest.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(guests)
}

#[tauri::command]
pub fn add_guest(guest_data: Guest) -> Result<String, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute(
        "INSERT INTO guests (name, email, phone, room, checkin_date, checkout_date, total_amount, paid_amount, status) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            guest_data.name,
            guest_data.email,
            guest_data.phone,
            guest_data.room,
            guest_data.checkin_date,
            guest_data.checkout_date,
            guest_data.total_amount.unwrap_or(0.0),
            guest_data.paid_amount.unwrap_or(0.0),
            guest_data.status
        ],
    ).map_err(|e| format!("Insert error: {}", e))?;
    
    Ok("Guest added successfully".to_string())
}

#[tauri::command]
pub fn update_guest(id: i32, guest_data: Guest) -> Result<String, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute(
        "UPDATE guests SET name = ?1, email = ?2, phone = ?3, room = ?4, 
         checkin_date = ?5, checkout_date = ?6, total_amount = ?7, paid_amount = ?8, status = ?9 
         WHERE id = ?10",
        params![
            guest_data.name,
            guest_data.email,
            guest_data.phone,
            guest_data.room,
            guest_data.checkin_date,
            guest_data.checkout_date,
            guest_data.total_amount.unwrap_or(0.0),
            guest_data.paid_amount.unwrap_or(0.0),
            guest_data.status,
            id
        ],
    ).map_err(|e| format!("Update error: {}", e))?;
    
    Ok("Guest updated successfully".to_string())
}

#[tauri::command]
pub fn delete_guest(id: i32) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute("DELETE FROM guests WHERE id = ?1", params![id])
        .map_err(|e| format!("Delete error: {}", e))?;
    
    Ok("Guest deleted successfully".to_string())
}

#[tauri::command]
pub fn get_all_orders() -> Result<Vec<FoodOrder>, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    let mut stmt = conn.prepare(
        "SELECT id, guest_id, room_number, items, total_amount, status, order_date 
         FROM food_orders ORDER BY order_date DESC"
    ).map_err(|e| format!("Query preparation error: {}", e))?;
    
    let order_iter = stmt.query_map([], |row| {
        Ok(FoodOrder {
            id: Some(row.get(0)?),
            guest_id: row.get(1)?,
            room_number: row.get(2)?,
            items: row.get(3)?,
            total_amount: row.get(4)?,
            status: row.get(5)?,
            order_date: row.get(6)?,
        })
    }).map_err(|e| format!("Query execution error: {}", e))?;
    
    let mut orders = Vec::new();
    for order in order_iter {
        orders.push(order.map_err(|e| format!("Row processing error: {}", e))?);
    }
    
    Ok(orders)
}

#[tauri::command]
pub fn add_order(order_data: FoodOrder) -> Result<String, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute(
        "INSERT INTO food_orders (guest_id, room_number, items, total_amount, status, order_date) 
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            order_data.guest_id,
            order_data.room_number,
            order_data.items,
            order_data.total_amount,
            order_data.status,
            order_data.order_date
        ],
    ).map_err(|e| format!("Insert error: {}", e))?;

    // Add to revenue
    conn.execute(
        "INSERT INTO revenue (source, description, amount, revenue_date) 
         VALUES ('food_order', ?1, ?2, ?3)",
        params![
            format!("Food order for room {}", order_data.room_number),
            order_data.total_amount,
            order_data.order_date
        ],
    ).map_err(|e| format!("Revenue insert error: {}", e))?;
    
    Ok("Order added successfully".to_string())
}

#[tauri::command]
pub fn add_revenue(revenue_data: Revenue) -> Result<String, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute(
        "INSERT INTO revenue (source, description, amount, revenue_date, guest_id) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            revenue_data.source,
            revenue_data.description,
            revenue_data.amount,
            revenue_data.revenue_date,
            revenue_data.guest_id
        ],
    ).map_err(|e| format!("Insert error: {}", e))?;
    
    Ok("Revenue added successfully".to_string())
}

#[tauri::command]
pub fn add_expense(expense_data: Expense) -> Result<String, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    conn.execute(
        "INSERT INTO expenses (category, description, amount, expense_date, payment_method) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            expense_data.category,
            expense_data.description,
            expense_data.amount,
            expense_data.expense_date,
            expense_data.payment_method
        ],
    ).map_err(|e| format!("Insert error: {}", e))?;
    
    Ok("Expense added successfully".to_string())
}

#[tauri::command]
pub fn get_financial_summary() -> Result<serde_json::Value, String> {
    ensure_tables_exist().map_err(|e| format!("Database setup error: {}", e))?;
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    let current_month = "2025-08"; // Current month for filtering
    
    let total_revenue: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM revenue WHERE substr(revenue_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0.0);

    let total_expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE substr(expense_date, 1, 7) = ?",
        params![current_month],
        |row| Ok(row.get(0)?)
    ).unwrap_or(0.0);

    let net_profit = total_revenue - total_expenses;
    
    Ok(serde_json::json!({
        "totalRevenue": total_revenue,
        "totalExpenses": total_expenses,
        "netProfit": net_profit,
        "currency": "Rs.",
        "period": current_month
    }))
}

#[tauri::command]
pub fn authenticate_admin(username: String, _password: String) -> Result<serde_json::Value, String> {
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    // This is a simplified version - you should implement proper password hashing
    let result: Result<(String, String), rusqlite::Error> = conn.query_row(
        "SELECT username, current_otp FROM admin_auth WHERE username = ?",
        params![username],
        |row| Ok((row.get(0)?, row.get(1)?))
    );
    
    match result {
        Ok((db_username, otp)) => {
            if db_username == username {
                Ok(serde_json::json!({
                    "success": true,
                    "requiresOTP": true,
                    "currentOTP": otp
                }))
            } else {
                Err("Invalid credentials".to_string())
            }
        }
        Err(_) => Err("Invalid credentials".to_string())
    }
}

#[tauri::command]
pub fn verify_otp(username: String, otp: String) -> Result<serde_json::Value, String> {
    let conn = get_db_connection().map_err(|e| format!("Database connection error: {}", e))?;
    
    let result: Result<String, rusqlite::Error> = conn.query_row(
        "SELECT current_otp FROM admin_auth WHERE username = ?",
        params![username],
        |row| Ok(row.get(0)?)
    );
    
    match result {
        Ok(stored_otp) => {
            if stored_otp == otp {
                Ok(serde_json::json!({
                    "success": true,
                    "message": "Authentication successful"
                }))
            } else {
                Err("Invalid OTP".to_string())
            }
        }
        Err(_) => Err("User not found".to_string())
    }
}
