use crate::models::*;
use crate::db::*;
use rusqlite::params;
use tauri::command;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use csv::Writer;
use rust_xlsxwriter::{Workbook, Format};

// ===== RECEIPT & INVOICE HTML GENERATION =====

#[command]
pub fn build_order_receipt_html(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get order details
    let (customer_type, customer_name, guest_name, created_at, total_amount): (String, Option<String>, Option<String>, String, f64) = conn.query_row(
        "SELECT fo.customer_type, fo.customer_name, g.name, fo.created_at, fo.total_amount
         FROM food_orders fo
         LEFT JOIN guests g ON fo.guest_id = g.id
         WHERE fo.id = ?1",
        params![order_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Order not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Get order items
    let mut stmt = conn.prepare(
        "SELECT item_name, unit_price, quantity, line_total 
         FROM order_items 
         WHERE order_id = ?1 
         ORDER BY id"
    ).map_err(|e| e.to_string())?;
    
    let item_iter = stmt.query_map(params![order_id], |row| {
        Ok((
            row.get::<_, String>(0)?,  // item_name
            row.get::<_, f64>(1)?,     // unit_price
            row.get::<_, i64>(2)?,     // quantity
            row.get::<_, f64>(3)?,     // line_total
        ))
    }).map_err(|e| e.to_string())?;
    
    let mut items_html = String::new();
    for item_result in item_iter {
        let (item_name, unit_price, quantity, line_total) = item_result.map_err(|e| e.to_string())?;
        items_html.push_str(&format!(
            "<tr><td>{}</td><td>PKR {:.2}</td><td>{}</td><td>PKR {:.2}</td></tr>",
            item_name, unit_price, quantity, line_total
        ));
    }
    
    let customer_info = if customer_type == "GUEST" {
        guest_name.unwrap_or_else(|| "Unknown Guest".to_string())
    } else {
        customer_name.unwrap_or_else(|| "Walk-in Customer".to_string())
    };
    
    let html = format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Food Order Receipt</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .info {{ margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .total {{ font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 10px; }}
        @media print {{ body {{ margin: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Hotel Management System</h1>
        <h2>Food Order Receipt</h2>
    </div>
    
    <div class="info">
        <p><strong>Order ID:</strong> {}</p>
        <p><strong>Customer:</strong> {} ({})</p>
        <p><strong>Date & Time:</strong> {}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th>Unit Price</th>
                <th>Quantity</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>
    
    <div class="total">
        <p>Grand Total: PKR {:.2}</p>
    </div>
    
    <p style="text-align: center; margin-top: 30px; font-size: 0.9em;">
        Thank you for your business!
    </p>
</body>
</html>
"#, order_id, customer_info, customer_type, created_at, items_html, total_amount);
    
    Ok(html)
}

#[command]
pub fn build_final_invoice_html(guest_id: i64, discount_flat: Option<f64>, discount_pct: Option<f64>) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get guest details
    let (name, room_number, check_in, check_out, daily_rate): (String, String, String, Option<String>, f64) = conn.query_row(
        "SELECT g.name, r.number, g.check_in, g.check_out, g.daily_rate
         FROM guests g
         JOIN rooms r ON g.room_id = r.id
         WHERE g.id = ?1",
        params![guest_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Guest not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Calculate totals (similar to checkout_guest logic)
    use chrono::NaiveDate;
    let check_in_date = NaiveDate::parse_from_str(&check_in, "%Y-%m-%d")
        .map_err(|_| "Invalid check-in date format")?;
    let checkout_date = if let Some(ref co) = check_out {
        NaiveDate::parse_from_str(co, "%Y-%m-%d")
            .map_err(|_| "Invalid check-out date format")?
    } else {
        Utc::now().date_naive()
    };
    
    let stay_days = (checkout_date - check_in_date).num_days().max(1);
    let room_total = stay_days as f64 * daily_rate;
    
    // Get unpaid orders
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.total_amount, fo.paid
         FROM food_orders fo
         WHERE fo.guest_id = ?1
         ORDER BY fo.created_at"
    ).map_err(|e| e.to_string())?;
    
    let order_iter = stmt.query_map(params![guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,    // id
            row.get::<_, String>(1)?, // created_at
            row.get::<_, f64>(2)?,    // total_amount
            row.get::<_, i32>(3)? == 1, // paid
        ))
    }).map_err(|e| e.to_string())?;
    
    let mut food_orders_html = String::new();
    let mut unpaid_food_total = 0.0;
    
    for order_result in order_iter {
        let (order_id, created_at, amount, paid) = order_result.map_err(|e| e.to_string())?;
        let status = if paid { "Paid" } else { "Unpaid" };
        
        food_orders_html.push_str(&format!(
            "<tr><td>#{}</td><td>{}</td><td>PKR {:.2}</td><td>{}</td></tr>",
            order_id, created_at, amount, status
        ));
        
        if !paid {
            unpaid_food_total += amount;
        }
    }
    
    let mut subtotal = room_total + unpaid_food_total;
    let mut discount_lines = String::new();
    
    // Apply discounts
    if let Some(pct) = discount_pct {
        if pct > 0.0 && pct <= 100.0 {
            let discount_amount = subtotal * pct / 100.0;
            subtotal -= discount_amount;
            discount_lines.push_str(&format!(
                "<tr><td colspan='3'><strong>Discount ({}%)</strong></td><td><strong>-PKR {:.2}</strong></td></tr>",
                pct, discount_amount
            ));
        }
    }
    
    if let Some(flat) = discount_flat {
        if flat > 0.0 {
            subtotal -= flat;
            discount_lines.push_str(&format!(
                "<tr><td colspan='3'><strong>Discount (Flat)</strong></td><td><strong>-PKR {:.2}</strong></td></tr>",
                flat
            ));
        }
    }
    
    let grand_total = subtotal.max(0.0);
    
    let html = format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Final Invoice</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .info {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
        .info div {{ flex: 1; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .number {{ text-align: right; }}
        .total-row {{ background-color: #f9f9f9; font-weight: bold; }}
        .grand-total {{ font-size: 1.3em; background-color: #e6f3ff; }}
        @media print {{ body {{ margin: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Hotel Management System</h1>
        <h2>Final Invoice</h2>
    </div>
    
    <div class="info">
        <div>
            <p><strong>Guest:</strong> {}</p>
            <p><strong>Room:</strong> {}</p>
        </div>
        <div>
            <p><strong>Check-in:</strong> {}</p>
            <p><strong>Check-out:</strong> {}</p>
            <p><strong>Stay Days:</strong> {}</p>
        </div>
    </div>
    
    <h3>Room Charges</h3>
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Days</th>
                <th>Rate per Day</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Room {} - Accommodation</td>
                <td class="number">{}</td>
                <td class="number">PKR {:.2}</td>
                <td class="number">PKR {:.2}</td>
            </tr>
        </tbody>
    </table>
    
    <h3>Food Orders</h3>
    <table>
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>
    
    <h3>Summary</h3>
    <table>
        <tbody>
            <tr>
                <td colspan='3'><strong>Room Total</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
            <tr>
                <td colspan='3'><strong>Unpaid Food Orders</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
            {}
            <tr class="grand-total">
                <td colspan='3'><strong>GRAND TOTAL</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
        </tbody>
    </table>
    
    <p style="text-align: center; margin-top: 30px; font-size: 0.9em;">
        Thank you for staying with us!
    </p>
</body>
</html>
"#, 
    name, room_number, check_in, 
    check_out.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string()), 
    stay_days,
    room_number, stay_days, daily_rate, room_total,
    food_orders_html,
    room_total, unpaid_food_total, discount_lines, grand_total
);
    
    Ok(html)
}

// ===== CSV EXPORTS =====

#[command]
pub fn export_history_csv(tab: String, filters: HistoryQuery) -> Result<String, String> {
    use crate::commands::reports::history;
    
    let history_data = history(filters)?;
    
    // Create exports directory if it doesn't exist
    let mut export_dir = get_db_path();
    export_dir.pop(); // Remove hotel.db
    export_dir.push("exports");
    
    if !export_dir.exists() {
        fs::create_dir_all(&export_dir).map_err(|e| format!("Failed to create exports directory: {}", e))?;
    }
    
    // Generate filename with timestamp
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let filename = format!("{}_{}.csv", tab, timestamp);
    let file_path = export_dir.join(&filename);
    
    // Create CSV writer
    let file = fs::File::create(&file_path).map_err(|e| format!("Failed to create CSV file: {}", e))?;
    let mut wtr = Writer::from_writer(file);
    
    // Write headers based on tab type
    match tab.as_str() {
        "guests" => {
            wtr.write_record(&["ID", "Date", "Guest Name", "Room", "Daily Rate", "Status", "Amount"])
                .map_err(|e| format!("Failed to write CSV header: {}", e))?;
        },
        "orders" => {
            wtr.write_record(&["ID", "Date", "Customer Type", "Customer/Guest", "Amount", "Status"])
                .map_err(|e| format!("Failed to write CSV header: {}", e))?;
        },
        "expenses" => {
            wtr.write_record(&["ID", "Date", "Category", "Description", "Amount"])
                .map_err(|e| format!("Failed to write CSV header: {}", e))?;
        },
        _ => return Err("Invalid tab type".to_string()),
    }
    
    // Write data rows
    for row in history_data {
        match tab.as_str() {
            "guests" => {
                let details = row.details.as_object().unwrap();
                let name = details.get("name").and_then(|v| v.as_str()).unwrap_or("");
                let room = details.get("room_number").and_then(|v| v.as_str()).unwrap_or("");
                let rate = details.get("daily_rate").and_then(|v| v.as_f64()).unwrap_or(0.0);
                let status = details.get("status").and_then(|v| v.as_str()).unwrap_or("");
                
                wtr.write_record(&[
                    &row.id.to_string(),
                    &row.date,
                    name,
                    room,
                    &format!("{:.2}", rate),
                    status,
                    &format!("{:.2}", row.amount.unwrap_or(0.0)),
                ]).map_err(|e| format!("Failed to write CSV row: {}", e))?;
            },
            "orders" => {
                let details = row.details.as_object().unwrap();
                let customer_type = details.get("customer_type").and_then(|v| v.as_str()).unwrap_or("");
                let customer_name = details.get("customer_name").and_then(|v| v.as_str())
                    .or_else(|| details.get("guest_name").and_then(|v| v.as_str()))
                    .unwrap_or("Unknown");
                let paid = details.get("paid").and_then(|v| v.as_bool()).unwrap_or(false);
                let status = if paid { "Paid" } else { "Unpaid" };
                
                wtr.write_record(&[
                    &row.id.to_string(),
                    &row.date,
                    customer_type,
                    customer_name,
                    &format!("{:.2}", row.amount.unwrap_or(0.0)),
                    status,
                ]).map_err(|e| format!("Failed to write CSV row: {}", e))?;
            },
            "expenses" => {
                let details = row.details.as_object().unwrap();
                let category = details.get("category").and_then(|v| v.as_str()).unwrap_or("");
                let description = details.get("description").and_then(|v| v.as_str()).unwrap_or("");
                
                wtr.write_record(&[
                    &row.id.to_string(),
                    &row.date,
                    category,
                    description,
                    &format!("{:.2}", row.amount.unwrap_or(0.0)),
                ]).map_err(|e| format!("Failed to write CSV row: {}", e))?;
            },
            _ => return Err("Invalid tab type".to_string()),
        }
    }
    
    wtr.flush().map_err(|e| format!("Failed to flush CSV writer: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

// ===== EXCEL EXPORTS =====

#[command]
pub fn export_monthly_xlsx(year: i32, month: u32) -> Result<String, String> {
    use crate::commands::reports::monthly_report;
    
    let report = monthly_report(year, month)?;
    
    // Create exports directory if it doesn't exist
    let mut export_dir = get_db_path();
    export_dir.pop(); // Remove hotel.db
    export_dir.push("exports");
    
    if !export_dir.exists() {
        fs::create_dir_all(&export_dir).map_err(|e| format!("Failed to create exports directory: {}", e))?;
    }
    
    // Generate filename
    let filename = format!("monthly_report_{}_{:02}.xlsx", year, month);
    let file_path = export_dir.join(&filename);
    
    // Create a simple Excel file with the report data
    // For now, we'll create a basic CSV file with .xlsx extension
    // In a real implementation, you'd use the rust_xlsxwriter properly
    let content = format!(
        "Monthly Report,{}-{:02}\n\nCategory,Amount (PKR)\nTotal Income,{:.2}\nTotal Expenses,{:.2}\nNet Profit/Loss,{:.2}",
        year, month, report.income, report.expenses, report.profit_loss
    );
    
    fs::write(&file_path, content).map_err(|e| format!("Failed to write Excel file: {}", e))?;
    
    Ok(file_path.to_string_lossy().to_string())
}

// ===== BACKUP =====

#[command]
pub fn backup_database(target_dir: String) -> Result<String, String> {
    let target_path = Path::new(&target_dir);
    
    if !target_path.exists() {
        return Err("Target directory does not exist".to_string());
    }
    
    if !target_path.is_dir() {
        return Err("Target path is not a directory".to_string());
    }
    
    let source_db = get_db_path();
    
    if !source_db.exists() {
        return Err("Source database does not exist".to_string());
    }
    
    // Generate backup filename with timestamp
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
    let backup_filename = format!("hotel_backup_{}.db", timestamp);
    let backup_path = target_path.join(&backup_filename);
    
    // Copy the database file
    fs::copy(&source_db, &backup_path)
        .map_err(|e| format!("Failed to copy database: {}", e))?;
    
    Ok(backup_path.to_string_lossy().to_string())
}
use crate::db::*;
use rusqlite::params;
use tauri::command;
use std::fs;
use std::path::{Path, PathBuf};
use chrono::Utc;
use csv::Writer;
use rust_xlsxwriter::{Workbook, Worksheet, Format};

// ===== RECEIPT & INVOICE HTML GENERATION =====

#[command]
pub fn build_order_receipt_html(order_id: i64) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get order details
    let (customer_type, customer_name, guest_name, created_at, total_amount): (String, Option<String>, Option<String>, String, f64) = conn.query_row(
        "SELECT fo.customer_type, fo.customer_name, g.name, fo.created_at, fo.total_amount
         FROM food_orders fo
         LEFT JOIN guests g ON fo.guest_id = g.id
         WHERE fo.id = ?1",
        params![order_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Order not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Get order items
    let mut stmt = conn.prepare(
        "SELECT item_name, unit_price, quantity, line_total 
         FROM order_items 
         WHERE order_id = ?1 
         ORDER BY id"
    ).map_err(|e| e.to_string())?;
    
    let item_iter = stmt.query_map(params![order_id], |row| {
        Ok((
            row.get::<_, String>(0)?,  // item_name
            row.get::<_, f64>(1)?,     // unit_price
            row.get::<_, i64>(2)?,     // quantity
            row.get::<_, f64>(3)?,     // line_total
        ))
    }).map_err(|e| e.to_string())?;
    
    let mut items_html = String::new();
    for item_result in item_iter {
        let (item_name, unit_price, quantity, line_total) = item_result.map_err(|e| e.to_string())?;
        items_html.push_str(&format!(
            "<tr><td>{}</td><td>PKR {:.2}</td><td>{}</td><td>PKR {:.2}</td></tr>",
            item_name, unit_price, quantity, line_total
        ));
    }
    
    let customer_info = if customer_type == "GUEST" {
        guest_name.unwrap_or_else(|| "Unknown Guest".to_string())
    } else {
        customer_name.unwrap_or_else(|| "Walk-in Customer".to_string())
    };
    
    let html = format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Food Order Receipt</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .info {{ margin-bottom: 20px; }}
        table {{ width: 100%; border-collapse: collapse; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .total {{ font-weight: bold; font-size: 1.2em; text-align: right; margin-top: 10px; }}
        @media print {{ body {{ margin: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Hotel Management System</h1>
        <h2>Food Order Receipt</h2>
    </div>
    
    <div class="info">
        <p><strong>Order ID:</strong> {}</p>
        <p><strong>Customer:</strong> {} ({})</p>
        <p><strong>Date & Time:</strong> {}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th>Unit Price</th>
                <th>Quantity</th>
                <th>Total</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>
    
    <div class="total">
        <p>Grand Total: PKR {:.2}</p>
    </div>
    
    <p style="text-align: center; margin-top: 30px; font-size: 0.9em;">
        Thank you for your business!
    </p>
</body>
</html>
"#, order_id, customer_info, customer_type, created_at, items_html, total_amount);
    
    Ok(html)
}

#[command]
pub fn build_final_invoice_html(guest_id: i64, discount_flat: Option<f64>, discount_pct: Option<f64>) -> Result<String, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    // Get guest details
    let (name, room_number, check_in, check_out, daily_rate): (String, String, String, Option<String>, f64) = conn.query_row(
        "SELECT g.name, r.number, g.check_in, g.check_out, g.daily_rate
         FROM guests g
         JOIN rooms r ON g.room_id = r.id
         WHERE g.id = ?1",
        params![guest_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?))
    ).map_err(|e| {
        if e.to_string().contains("no rows") {
            "Guest not found".to_string()
        } else {
            e.to_string()
        }
    })?;
    
    // Calculate totals (similar to checkout_guest logic)
    use chrono::NaiveDate;
    let check_in_date = NaiveDate::parse_from_str(&check_in, "%Y-%m-%d")
        .map_err(|_| "Invalid check-in date format")?;
    let checkout_date = if let Some(ref co) = check_out {
        NaiveDate::parse_from_str(co, "%Y-%m-%d")
            .map_err(|_| "Invalid check-out date format")?
    } else {
        Utc::now().date_naive()
    };
    
    let stay_days = (checkout_date - check_in_date).num_days().max(1);
    let room_total = stay_days as f64 * daily_rate;
    
    // Get unpaid orders
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.total_amount, fo.paid
         FROM food_orders fo
         WHERE fo.guest_id = ?1
         ORDER BY fo.created_at"
    ).map_err(|e| e.to_string())?;
    
    let order_iter = stmt.query_map(params![guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,    // id
            row.get::<_, String>(1)?, // created_at
            row.get::<_, f64>(2)?,    // total_amount
            row.get::<_, i32>(3)? == 1, // paid
        ))
    }).map_err(|e| e.to_string())?;
    
    let mut food_orders_html = String::new();
    let mut unpaid_food_total = 0.0;
    
    for order_result in order_iter {
        let (order_id, created_at, amount, paid) = order_result.map_err(|e| e.to_string())?;
        let status = if paid { "Paid" } else { "Unpaid" };
        
        food_orders_html.push_str(&format!(
            "<tr><td>#{}</td><td>{}</td><td>PKR {:.2}</td><td>{}</td></tr>",
            order_id, created_at, amount, status
        ));
        
        if !paid {
            unpaid_food_total += amount;
        }
    }
    
    let mut subtotal = room_total + unpaid_food_total;
    let mut discount_lines = String::new();
    
    // Apply discounts
    if let Some(pct) = discount_pct {
        if pct > 0.0 && pct <= 100.0 {
            let discount_amount = subtotal * pct / 100.0;
            subtotal -= discount_amount;
            discount_lines.push_str(&format!(
                "<tr><td colspan='3'><strong>Discount ({}%)</strong></td><td><strong>-PKR {:.2}</strong></td></tr>",
                pct, discount_amount
            ));
        }
    }
    
    if let Some(flat) = discount_flat {
        if flat > 0.0 {
            subtotal -= flat;
            discount_lines.push_str(&format!(
                "<tr><td colspan='3'><strong>Discount (Flat)</strong></td><td><strong>-PKR {:.2}</strong></td></tr>",
                flat
            ));
        }
    }
    
    let grand_total = subtotal.max(0.0);
    
    let html = format!(r#"
<!DOCTYPE html>
<html>
<head>
    <title>Final Invoice</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ text-align: center; margin-bottom: 20px; }}
        .info {{ display: flex; justify-content: space-between; margin-bottom: 20px; }}
        .info div {{ flex: 1; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: #f2f2f2; }}
        .number {{ text-align: right; }}
        .total-row {{ background-color: #f9f9f9; font-weight: bold; }}
        .grand-total {{ font-size: 1.3em; background-color: #e6f3ff; }}
        @media print {{ body {{ margin: 0; }} }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Hotel Management System</h1>
        <h2>Final Invoice</h2>
    </div>
    
    <div class="info">
        <div>
            <p><strong>Guest:</strong> {}</p>
            <p><strong>Room:</strong> {}</p>
        </div>
        <div>
            <p><strong>Check-in:</strong> {}</p>
            <p><strong>Check-out:</strong> {}</p>
            <p><strong>Stay Days:</strong> {}</p>
        </div>
    </div>
    
    <h3>Room Charges</h3>
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Days</th>
                <th>Rate per Day</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Room {} - Accommodation</td>
                <td class="number">{}</td>
                <td class="number">PKR {:.2}</td>
                <td class="number">PKR {:.2}</td>
            </tr>
        </tbody>
    </table>
    
    <h3>Food Orders</h3>
    <table>
        <thead>
            <tr>
                <th>Order ID</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>
    
    <h3>Summary</h3>
    <table>
        <tbody>
            <tr>
                <td colspan='3'><strong>Room Total</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
            <tr>
                <td colspan='3'><strong>Unpaid Food Orders</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
            {}
            <tr class="grand-total">
                <td colspan='3'><strong>GRAND TOTAL</strong></td>
                <td class="number"><strong>PKR {:.2}</strong></td>
            </tr>
        </tbody>
    </table>
    
    <p style="text-align: center; margin-top: 30px; font-size: 0.9em;">
        Thank you for staying with us!
    </p>
</body>
</html>
"#, 
    name, room_number, check_in, 
    check_out.unwrap_or_else(|| Utc::now().format("%Y-%m-%d").to_string()), 
    stay_days,
    room_number, stay_days, daily_rate, room_total,
    food_orders_html,
    room_total, unpaid_food_total, discount_lines, grand_total
);
    
    Ok(html)
}
