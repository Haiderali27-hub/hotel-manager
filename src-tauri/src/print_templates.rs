use rusqlite::Connection;

/// Generate HTML receipt for a food order
#[tauri::command]
pub fn build_order_receipt_html(order_id: i64) -> Result<String, String> {
    let db_path = crate::database_reset::get_database_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Get order details
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.order_date, fo.total_amount, fo.is_paid,
                g.name as guest_name, r.number as room_number
         FROM food_orders fo
         JOIN guests g ON fo.guest_id = g.id
         JOIN rooms r ON g.room_id = r.id
         WHERE fo.id = ?"
    ).map_err(|e| format!("Failed to prepare order query: {}", e))?;
    
    let order_row = stmt.query_row([order_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,       // id
            row.get::<_, String>(1)?,    // order_date
            row.get::<_, f64>(2)?,       // total_amount
            row.get::<_, bool>(3)?,      // is_paid
            row.get::<_, String>(4)?,    // guest_name
            row.get::<_, String>(5)?,    // room_number
        ))
    }).map_err(|e| format!("Order not found: {}", e))?;
    
    let (_id, order_date, total_amount, is_paid, guest_name, room_number) = order_row;
    
    // Get order items
    let mut stmt = conn.prepare(
        "SELECT mi.name, foi.quantity, foi.unit_price, (foi.quantity * foi.unit_price) as line_total
         FROM food_order_items foi
         JOIN menu_items mi ON foi.menu_item_id = mi.id
         WHERE foi.order_id = ?
         ORDER BY mi.name"
    ).map_err(|e| format!("Failed to prepare items query: {}", e))?;
    
    let item_rows = stmt.query_map([order_id], |row| {
        Ok((
            row.get::<_, String>(0)?,    // name
            row.get::<_, i32>(1)?,       // quantity
            row.get::<_, f64>(2)?,       // unit_price
            row.get::<_, f64>(3)?,       // line_total
        ))
    }).map_err(|e| format!("Failed to execute items query: {}", e))?;
    
    let mut items_html = String::new();
    for item in item_rows {
        let (name, quantity, unit_price, line_total) = item.map_err(|e| format!("Failed to read item: {}", e))?;
        items_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>${:.2}</td><td>${:.2}</td></tr>",
            html_escape(&name), quantity, unit_price, line_total
        ));
    }
    
    let payment_status = if is_paid { "✓ PAID" } else { "⚠ UNPAID" };
    let payment_color = if is_paid { "#28a745" } else { "#dc3545" };
    
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
        .hotel-name {{
            font-size: 28px;
            font-weight: bold;
            color: #2c3e50;
            margin: 0;
        }}
        .hotel-subtitle {{
            font-size: 16px;
            color: #7f8c8d;
            margin: 5px 0 0 0;
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
        <h1 class="hotel-name">Grand Vista Hotel</h1>
        <p class="hotel-subtitle">123 Main Street, Downtown | Phone: +1-555-HOTEL-1</p>
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
            <span class="info-label">Guest:</span>
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
                <td class="text-right"><strong>${:.2}</strong></td>
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
        order_id,
        order_date,
        html_escape(&guest_name),
        html_escape(&room_number),
        payment_status,
        items_html,
        total_amount,
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    );
    
    Ok(html)
}

/// Generate HTML invoice for a guest's final bill
#[tauri::command]
pub fn build_final_invoice_html(guest_id: i64) -> Result<String, String> {
    let db_path = crate::database_reset::get_database_path()?;
    let conn = Connection::open(&db_path).map_err(|e| format!("Failed to open database: {}", e))?;
    
    // Get guest details
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.phone, g.check_in, g.check_out, g.daily_rate, g.is_active,
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
            row.get::<_, bool>(6)?,           // is_active
            row.get::<_, String>(7)?,         // room_number
        ))
    }).map_err(|e| format!("Guest not found: {}", e))?;
    
    let (_id, name, phone, check_in, check_out, daily_rate, is_active, room_number) = guest_row;
    
    // Calculate room charges
    let checkout_date = check_out.clone().unwrap_or_else(|| {
        chrono::Local::now().format("%Y-%m-%d").to_string()
    });
    
    let days = calculate_stay_days(&check_in, &checkout_date)?;
    let room_total = days as f64 * daily_rate;
    
    // Get food orders
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.order_date, fo.total_amount, fo.is_paid
         FROM food_orders fo
         WHERE fo.guest_id = ?
         ORDER BY fo.order_date"
    ).map_err(|e| format!("Failed to prepare orders query: {}", e))?;
    
    let order_rows = stmt.query_map([guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,   // id
            row.get::<_, String>(1)?, // order_date
            row.get::<_, f64>(2)?,   // total_amount
            row.get::<_, bool>(3)?,  // is_paid
        ))
    }).map_err(|e| format!("Failed to execute orders query: {}", e))?;
    
    let mut food_items_html = String::new();
    let mut food_total = 0.0;
    let mut unpaid_food = 0.0;
    
    for order in order_rows {
        let (order_id, order_date, amount, is_paid) = order.map_err(|e| format!("Failed to read order: {}", e))?;
        let status = if is_paid { "✓ Paid" } else { "⚠ Unpaid" };
        let status_color = if is_paid { "#28a745" } else { "#dc3545" };
        
        food_items_html.push_str(&format!(
            "<tr><td>Food Order #{}</td><td>{}</td><td class=\"text-right\">${:.2}</td><td class=\"text-right\" style=\"color: {}\">{}</td></tr>",
            order_id, order_date, amount, status_color, status
        ));
        
        food_total += amount;
        if !is_paid {
            unpaid_food += amount;
        }
    }
    
    let grand_total = room_total + food_total;
    let balance_due = room_total + unpaid_food;
    
    let status_text = if is_active {
        "CURRENT STAY - Balance Due"
    } else {
        "FINAL INVOICE - Checked Out"
    };
    
    let html = format!(r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guest Invoice - {}</title>
    <style>
        body {{
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }}
        .header {{
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #2c3e50;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .hotel-info {{
            flex: 1;
        }}
        .hotel-name {{
            font-size: 32px;
            font-weight: bold;
            color: #2c3e50;
            margin: 0;
        }}
        .hotel-subtitle {{
            font-size: 16px;
            color: #7f8c8d;
            margin: 5px 0;
        }}
        .invoice-info {{
            text-align: right;
            flex: 1;
        }}
        .invoice-title {{
            font-size: 28px;
            color: #e74c3c;
            margin: 0;
            font-weight: bold;
        }}
        .invoice-status {{
            font-size: 14px;
            color: #34495e;
            margin: 5px 0;
        }}
        .guest-info {{
            background-color: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-bottom: 30px;
        }}
        .info-grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }}
        .info-item {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        .info-label {{
            font-weight: bold;
            color: #495057;
        }}
        .section-title {{
            font-size: 20px;
            color: #2c3e50;
            margin: 30px 0 15px 0;
            padding-bottom: 8px;
            border-bottom: 2px solid #ecf0f1;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
            background-color: white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        th, td {{
            padding: 15px;
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
        .total-section {{
            background-color: #f8f9fa;
            padding: 25px;
            border-radius: 8px;
            margin-top: 30px;
        }}
        .total-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        .grand-total {{
            font-size: 24px;
            font-weight: bold;
            color: #2c3e50;
            padding: 15px 0;
            border-top: 2px solid #2c3e50;
            margin-top: 15px;
        }}
        .balance-due {{
            font-size: 20px;
            font-weight: bold;
            color: #e74c3c;
            background-color: #fff5f5;
            padding: 15px;
            border-radius: 5px;
            margin-top: 15px;
            text-align: center;
        }}
        .footer {{
            text-align: center;
            margin-top: 50px;
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
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="hotel-info">
            <h1 class="hotel-name">Grand Vista Hotel</h1>
            <p class="hotel-subtitle">123 Main Street, Downtown</p>
            <p class="hotel-subtitle">Phone: +1-555-HOTEL-1</p>
        </div>
        <div class="invoice-info">
            <h1 class="invoice-title">INVOICE</h1>
            <p class="invoice-status">{}</p>
            <p class="invoice-status">Generated: {}</p>
        </div>
    </div>

    <div class="guest-info">
        <h2 style="margin-top: 0; color: #2c3e50;">Guest Information</h2>
        <div class="info-grid">
            <div class="info-item">
                <span class="info-label">Guest Name:</span>
                <span>{}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Room Number:</span>
                <span>{}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Phone:</span>
                <span>{}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Daily Rate:</span>
                <span>${:.2}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Check-in Date:</span>
                <span>{}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Check-out Date:</span>
                <span>{}</span>
            </div>
        </div>
    </div>

    <h2 class="section-title">Room Charges</h2>
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th class="text-right">Days</th>
                <th class="text-right">Rate/Day</th>
                <th class="text-right">Total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>Room {} - Accommodation</td>
                <td class="text-right">{}</td>
                <td class="text-right">${:.2}</td>
                <td class="text-right">${:.2}</td>
            </tr>
        </tbody>
    </table>

    <h2 class="section-title">Food & Beverage Charges</h2>
    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th>Date</th>
                <th class="text-right">Amount</th>
                <th class="text-right">Status</th>
            </tr>
        </thead>
        <tbody>
            {}
        </tbody>
    </table>

    <div class="total-section">
        <div class="total-row">
            <span><strong>Room Charges Subtotal:</strong></span>
            <span><strong>${:.2}</strong></span>
        </div>
        <div class="total-row">
            <span><strong>Food & Beverage Subtotal:</strong></span>
            <span><strong>${:.2}</strong></span>
        </div>
        <div class="total-row grand-total">
            <span>TOTAL CHARGES:</span>
            <span>${:.2}</span>
        </div>
        <div class="balance-due">
            <strong>BALANCE DUE: ${:.2}</strong>
        </div>
    </div>

    <div class="footer">
        <p>Thank you for staying with Grand Vista Hotel!</p>
        <p>We hope you enjoyed your stay and look forward to serving you again.</p>
    </div>
</body>
</html>"#,
        html_escape(&name),
        status_text,
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
        html_escape(&name),
        html_escape(&room_number),
        phone.unwrap_or("N/A".to_string()),
        daily_rate,
        check_in,
        checkout_date,
        html_escape(&room_number),
        days,
        daily_rate,
        room_total,
        food_items_html,
        room_total,
        food_total,
        grand_total,
        balance_due
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
