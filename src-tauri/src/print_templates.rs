use std::fs;
use std::path::Path;
use base64::{Engine as _, engine::general_purpose};

fn get_logo_base64() -> String {
    // Try to read the logo file
    let logo_paths = [
        "src/assets/Logo/logo.jpg",
        "assets/Logo/logo.jpg", 
        "../src/assets/Logo/logo.jpg",
        "../../src/assets/Logo/logo.jpg"
    ];
    
    for path in &logo_paths {
        if Path::new(path).exists() {
            if let Ok(logo_data) = fs::read(path) {
                return general_purpose::STANDARD.encode(logo_data);
            }
        }
    }
    
    // Return empty string if logo not found
    String::new()
}

/// Print a food order receipt
#[tauri::command]
pub fn print_order_receipt(orderId: i64) -> Result<String, String> {
    // Generate the HTML receipt
    let mut html = build_order_receipt_html(orderId)?;
    
    // Add auto-print JavaScript before the closing </head> tag
    let auto_print_script = String::from(r#"
    <script>
        window.addEventListener('load', function() {
            setTimeout(function() {
                window.print();
            }, 500);
        });
    </script>
"#);
    
    html = html.replace("</head>", &(auto_print_script + "</head>"));
    
    // Create a temporary HTML file
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("receipt_{}.html", orderId));
    
    // Write HTML to file
    std::fs::write(&file_path, html)
        .map_err(|e| format!("Failed to write receipt file: {}", e))?;
    
    // Open the file with the default application (browser)
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &file_path.to_string_lossy()])
            .spawn()
            .map_err(|e| format!("Failed to open receipt: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open receipt: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open receipt: {}", e))?;
    }
    
    Ok("Receipt opened in browser - print dialog will appear automatically".to_string())
}

/// Generate HTML receipt for a food order
#[tauri::command]
pub fn build_order_receipt_html(orderId: i64) -> Result<String, String> {
    let order_id = orderId;
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Get order details with optional guest information
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.total_amount, fo.paid, fo.customer_type, fo.customer_name,
                g.name as guest_name, r.number as room_number
         FROM food_orders fo
         LEFT JOIN guests g ON fo.guest_id = g.id
         LEFT JOIN rooms r ON g.room_id = r.id
         WHERE fo.id = ?"
    ).map_err(|e| format!("Failed to prepare order query: {}", e))?;
    
    let order_row = stmt.query_row([order_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,                          // id
            row.get::<_, String>(1)?,                       // created_at
            row.get::<_, f64>(2)?,                          // total_amount
            row.get::<_, i64>(3)?,                          // paid (INTEGER, not bool)
            row.get::<_, String>(4)?,                       // customer_type
            row.get::<_, Option<String>>(5)?,               // customer_name
            row.get::<_, Option<String>>(6)?,               // guest_name (from guests table)
            row.get::<_, Option<String>>(7)?,               // room_number
        ))
    }).map_err(|e| format!("Order not found: {}", e))?;
    
    let (_id, created_at, total_amount, paid_status, customer_type, customer_name, guest_name, room_number) = order_row;
    let is_paid = paid_status != 0;
    
    // Get logo as base64
    let logo_base64 = get_logo_base64();
    
    // Format the date properly
    let formatted_date = if let Ok(parsed_date) = chrono::DateTime::parse_from_rfc3339(&created_at) {
        parsed_date.format("%B %d, %Y at %I:%M %p").to_string()
    } else {
        // Fallback to original format if parsing fails
        created_at.clone()
    };
    
    // Get order items
    let mut stmt = conn.prepare(
        "SELECT item_name, quantity, unit_price, line_total
         FROM order_items 
         WHERE order_id = ?
         ORDER BY item_name"
    ).map_err(|e| format!("Failed to prepare items query: {}", e))?;
    
    let item_rows = stmt.query_map([order_id], |row| {
        Ok((
            row.get::<_, String>(0)?,    // item_name
            row.get::<_, i32>(1)?,       // quantity
            row.get::<_, f64>(2)?,       // unit_price
            row.get::<_, f64>(3)?,       // line_total
        ))
    }).map_err(|e| format!("Failed to execute items query: {}", e))?;
    
    let mut items_html = String::new();
    for item in item_rows {
        let (item_name, quantity, unit_price, line_total) = item.map_err(|e| format!("Failed to read item: {}", e))?;
        items_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>Rs {:.2}</td><td>Rs {:.2}</td></tr>",
            html_escape(&item_name), quantity, unit_price, line_total
        ));
    }
    
    let payment_status = if is_paid { "✓ PAID" } else { "⚠ UNPAID" };
    let payment_color = if is_paid { "#28a745" } else { "#dc3545" };
    
    // Determine customer display information
    let customer_display = match customer_type.as_str() {
        "walk_in" => {
            customer_name.unwrap_or_else(|| "Walk-in Customer".to_string())
        },
        _ => {
            guest_name.unwrap_or_else(|| "Guest".to_string())
        }
    };
    
    let room_display = if customer_type == "walk_in" {
        "Walk-in".to_string()
    } else {
        room_number.unwrap_or_else(|| "N/A".to_string())
    };

    let html = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Food Order Receipt #{}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .logo {{
            max-width: 100px;
            height: auto;
            margin-bottom: 15px;
        }}
        .hotel-name {{
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin: 0;
        }}
        .hotel-subtitle {{
            font-size: 14px;
            color: #7f8c8d;
            margin: 5px 0 0 0;
            line-height: 1.4;
        }}
        .receipt-title {{
            font-size: 24px;
            margin: 20px 0 10px 0;
            color: #34495e;
        }}
        .order-info {{
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        .info-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
        }}
        .info-label {{
            font-weight: bold;
            color: #495057;
        }}
        .payment-status {{
            font-weight: bold;
            color: {};
            font-size: 18px;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        th, td {{
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }}
        th {{
            background-color: #495057;
            color: white;
            font-weight: bold;
        }}
        .text-right {{
            text-align: right;
        }}
        .total-row {{
            background-color: #f8f9fa;
            font-weight: bold;
            font-size: 18px;
        }}
        .footer {{
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 14px;
        }}
        @media print {{
            body {{
                margin: 0;
                padding: 15px;
            }}
            .no-print {{
                display: none;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        <img src="data:image/jpeg;base64,{}" alt="Hotel Logo" class="logo">
        <h1 class="hotel-name">Yasin Heaven Star Hotel</h1>
        <p class="hotel-subtitle">
            Main Yasin Ghizer Gilgit Baltistan, Pakistan<br>
            Phone: +92 355 4650686<br>
            Email: yasinheavenstarhotel@gmail.com
        </p>
        <h2 class="receipt-title">Food Order Receipt</h2>
    </div>

    <div class="order-info">
        <div class="info-row">
            <span class="info-label">Order #:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Date:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Customer:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Room:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="info-label">Payment Status:</span>
            <span class="payment-status">{}</span>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Item</th>
                <th class="text-right">Qty</th>
                <th class="text-right">Unit Price</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
        <tfoot>
            <tr class="total-row">
                <td colspan="3"><strong>Grand Total</strong></td>
                <td class="text-right"><strong>Rs {:.2}</strong></td>
            </tr>
        </tfoot>
    </table>

    <div class="footer">
        <p>Thank you for dining with us!</p>
        <p>Receipt generated on {}</p>
    </div>
</body>
</html>"#, 
        order_id,
        payment_color,
        logo_base64,
        order_id,
        formatted_date,
        html_escape(&customer_display),
        html_escape(&room_display),
        payment_status,
        items_html,
        total_amount,
        chrono::Local::now().format("%B %d, %Y at %I:%M %p")
    );
    
    Ok(html)
}

/// Generate HTML invoice for a guest's final bill
#[tauri::command]
pub fn build_final_invoice_html(guest_id: i64) -> Result<String, String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Get guest details
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.phone, g.check_in, g.check_out, g.daily_rate, g.status,
                r.number as room_number
         FROM guests g
         JOIN rooms r ON g.room_id = r.id
         WHERE g.id = ?"
    ).map_err(|e| format!("Failed to prepare guest query: {}", e))?;
    
    let guest_row = stmt.query_row([guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,            // id
            row.get::<_, String>(1)?,         // name
            row.get::<_, Option<String>>(2)?, // phone
            row.get::<_, String>(3)?,         // check_in
            row.get::<_, Option<String>>(4)?, // check_out
            row.get::<_, f64>(5)?,            // daily_rate
            row.get::<_, String>(6)?,         // status
            row.get::<_, String>(7)?,         // room_number
        ))
    }).map_err(|e| format!("Guest not found: {}", e))?;
    
        let (_id, name, _phone, check_in, check_out, daily_rate, _status, room_number) = guest_row;
    
    // Calculate room charges
    let checkout_date = check_out.clone().unwrap_or_else(|| {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    });
    
    let days = calculate_stay_days(&check_in, &checkout_date)?;
    let room_total = days as f64 * daily_rate;
    
    // Get food order details with items
    let mut food_items_text = String::new();
    let mut total_food_cost = 0.0;
    
    // First get all food orders for this guest
    let mut order_stmt = conn.prepare(
        "SELECT fo.id, fo.total_amount, fo.paid
         FROM food_orders fo
         WHERE fo.guest_id = ? AND fo.paid = 1
         ORDER BY fo.created_at"
    ).map_err(|e| format!("Failed to prepare food orders query: {}", e))?;
    
    let food_orders = order_stmt.query_map([guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,   // order_id
            row.get::<_, f64>(1)?,   // total_amount
            row.get::<_, bool>(2)?,  // paid
        ))
    }).map_err(|e| format!("Failed to execute food orders query: {}", e))?;
    
    // For each order, get the items
    for order_result in food_orders {
        let (order_id, _amount, _paid) = order_result.map_err(|e| format!("Failed to read order: {}", e))?;
        
        let mut item_stmt = conn.prepare(
            "SELECT oi.quantity, oi.item_name, oi.unit_price
             FROM order_items oi
             WHERE oi.order_id = ?"
        ).map_err(|e| format!("Failed to prepare order items query: {}", e))?;
        
        let items = item_stmt.query_map([order_id], |row| {
            Ok((
                row.get::<_, i32>(0)?,    // quantity
                row.get::<_, String>(1)?, // item_name
                row.get::<_, f64>(2)?,    // unit_price
            ))
        }).map_err(|e| format!("Failed to execute order items query: {}", e))?;
        
        for item_result in items {
            let (quantity, name, unit_price) = item_result.map_err(|e| format!("Failed to read item: {}", e))?;
            let line_total = quantity as f64 * unit_price;
            total_food_cost += line_total;
            
            food_items_text.push_str(&format!("{} x{} {}\n", html_escape(&name), quantity, (unit_price as i32)));
        }
    }
    
    // If no paid food items, show a simple message
    if food_items_text.is_empty() {
        food_items_text = "No food orders".to_string();
    }
    
    // Calculate totals
    let subtotal = room_total + total_food_cost;
    let tax_rate = 0.05; // 5% tax
    let tax_amount = subtotal * tax_rate;
    let final_total = subtotal + tax_amount;
    
    // Create receipt in the format requested
    let current_date = chrono::Local::now();
    let formatted_date = current_date.format("%d-%m-%Y");
    let formatted_time = current_date.format("%I:%M %p");
    
    let html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt - {}</title>
    <style>
        body {{
            font-family: 'Courier New', monospace;
            max-width: 300px;
            margin: 0 auto;
            padding: 20px;
            background: white;
            color: black;
            font-size: 12px;
            line-height: 1.4;
        }}
        .receipt {{
            border: 1px solid black;
            padding: 15px;
            background: white;
        }}
        .logo {{
            text-align: center;
            margin-bottom: 10px;
        }}
        .logo-symbol {{
            font-size: 24px;
            margin-bottom: 5px;
        }}
        .hotel-name {{
            font-weight: bold;
            font-size: 14px;
            margin-bottom: 5px;
        }}
        .divider {{
            border-top: 1px dashed black;
            margin: 8px 0;
        }}
        .customer-info {{
            margin-bottom: 8px;
        }}
        .info-line {{
            margin-bottom: 2px;
        }}
        .items-section {{
            margin: 8px 0;
        }}
        .item-line {{
            margin-bottom: 2px;
        }}
        .totals {{
            margin-top: 8px;
        }}
        .total-line {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 2px;
        }}
        .final-total {{
            font-weight: bold;
            border-top: 1px solid black;
            padding-top: 3px;
            margin-top: 3px;
        }}
        .payment-method {{
            text-align: center;
            margin: 8px 0;
            font-weight: bold;
        }}
        .footer {{
            text-align: center;
            margin-top: 10px;
            font-size: 11px;
        }}
        .contact-info {{
            text-align: center;
            margin-top: 8px;
            font-size: 10px;
        }}
        @media print {{
            body {{
                margin: 0;
                padding: 10px;
            }}
            .receipt {{
                border: 1px solid black;
            }}
        }}
    </style>
</head>
<body>
    <div class="receipt">
        <div class="logo">
            <div class="logo-symbol">🏨</div>
            <div class="hotel-name">Yasin heaven star Hotel</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="customer-info">
            <div class="info-line"><strong>Customer:</strong> {}</div>
            <div class="info-line"><strong>Room No:</strong> {}</div>
            <div class="info-line"><strong>Date:</strong> {} <strong>Time:</strong> {}</div>
        </div>
        
        <div class="divider"></div>
        
        <div class="items-section">
            <div><strong>Items:</strong></div>
            {}
        </div>
        
        <div class="divider"></div>
        
        <div class="totals">
            <div class="total-line">
                <span>Subtotal:</span>
                <span>{}</span>
            </div>
            <div class="total-line">
                <span>Tax (5%):</span>
                <span>{}</span>
            </div>
            <div class="total-line final-total">
                <span>Total:</span>
                <span>{}</span>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="payment-method">
            Paid by: Cash
        </div>
        
        <div class="footer">
            Thank you for your stay!
        </div>
        
        <div class="divider"></div>
        
        <div class="contact-info">
            📧 Yasinheavenstarhotel@gmail.com<br>
            🌐 yasinheavenstarhotel.com<br>
            📞 03171279230
        </div>
    </div>
</body>
</html>"#,
        html_escape(&name),
        html_escape(&name),
        html_escape(&room_number),
        formatted_date,
        formatted_time,
        food_items_text,
        subtotal as i32,
        tax_amount as i32,
        final_total as i32
    );
    
    Ok(html)
}

fn calculate_stay_days(check_in: &str, check_out: &str) -> Result<i32, String> {
    let check_in_date = chrono::NaiveDate::parse_from_str(check_in, "%Y-%m-%d")
        .map_err(|e| format!("Invalid check-in date: {}", e))?;
    let check_out_date = chrono::NaiveDate::parse_from_str(check_out, "%Y-%m-%d")
        .map_err(|e| format!("Invalid check-out date: {}", e))?;
    
    let duration = check_out_date.signed_duration_since(check_in_date);
    let days = duration.num_days() as i32;
    
    // Minimum 1 day charge
    Ok(days.max(1))
}

fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
