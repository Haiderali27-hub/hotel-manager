use base64::{Engine, prelude::BASE64_STANDARD};
use rusqlite::OptionalExtension;
use std::path::PathBuf;

// Include the JPG logo as a compile-time embedded resource for final invoices
const LOGO_DATA: &[u8] = include_bytes!("../logoforcheckout.png");

fn get_logo_base64() -> String {
    // Use the embedded JPG logo for final invoices (ICO is too large at 410KB)
    if !LOGO_DATA.is_empty() {
        let embedded_logo = BASE64_STANDARD.encode(LOGO_DATA);
        println!("✅ Using embedded JPG logo data, size: {} bytes, base64 length: {}", LOGO_DATA.len(), embedded_logo.len());
        
        // Check if the logo starts with JPEG header
        if LOGO_DATA.len() >= 3 && &LOGO_DATA[0..3] == b"\xFF\xD8\xFF" {
            println!("✅ Valid JPEG header detected");
        } else {
            println!("❌ WARNING: Invalid JPEG header!");
            println!("First 16 bytes: {:?}", &LOGO_DATA[..16.min(LOGO_DATA.len())]);
        }
        
        return embedded_logo;
    }
    
    println!("⚠️  Warning: Embedded logo data is empty");
    return "".to_string();
}

fn ensure_settings_table(conn: &rusqlite::Connection) -> Result<(), String> {
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (\
            key TEXT PRIMARY KEY,\
            value TEXT NOT NULL,\
            updated_at TEXT NOT NULL\
        )",
        [],
    )
    .map_err(|e| format!("Failed to ensure settings table: {}", e))?;

    // If the table exists from an older version without `updated_at`, migrate it.
    let has_updated_at: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('settings') WHERE name = 'updated_at'",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Failed to inspect settings table: {}", e))?;

    if has_updated_at == 0 {
        conn.execute(
            "ALTER TABLE settings ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''",
            [],
        )
        .map_err(|e| format!("Failed to migrate settings table: {}", e))?;
    }
    Ok(())
}

fn get_setting_or(conn: &rusqlite::Connection, key: &str, default_value: &str) -> Result<String, String> {
    ensure_settings_table(conn)?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| format!("Failed to prepare setting query: {}", e))?;

    let value: Option<String> = stmt
        .query_row([key], |row| row.get(0))
        .optional()
        .map_err(|e| format!("Failed to read setting {}: {}", key, e))?;

    Ok(value.unwrap_or_else(|| default_value.to_string()))
}

fn get_setting_optional(conn: &rusqlite::Connection, key: &str) -> Result<Option<String>, String> {
    ensure_settings_table(conn)?;
    let mut stmt = conn
        .prepare("SELECT value FROM settings WHERE key = ?1")
        .map_err(|e| format!("Failed to prepare setting query: {}", e))?;

    let value: Option<String> = stmt
        .query_row([key], |row| row.get(0))
        .optional()
        .map_err(|e| format!("Failed to read setting {}: {}", key, e))?;

    Ok(value.and_then(|v| {
        let t = v.trim().to_string();
        if t.is_empty() { None } else { Some(t) }
    }))
}

fn escape_multiline(text: &str) -> String {
    html_escape(text)
        .replace("\r\n", "\n")
        .replace("\n", "<br>")
}

fn guess_image_mime(path: &PathBuf) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "svg" => "image/svg+xml",
        "webp" => "image/webp",
        _ => "application/octet-stream",
    }
}

fn get_business_logo_data_url(conn: &rusqlite::Connection) -> Result<Option<String>, String> {
    let path = match get_setting_optional(conn, "business_logo_path")? {
        Some(p) => p,
        None => return Ok(None),
    };

    let path_buf = PathBuf::from(path);
    if !path_buf.exists() || !path_buf.is_file() {
        return Ok(None);
    }

    let bytes = std::fs::read(&path_buf)
        .map_err(|e| format!("Failed to read stored logo: {}", e))?;
    if bytes.is_empty() {
        return Ok(None);
    }

    let mime = guess_image_mime(&path_buf);
    let b64 = BASE64_STANDARD.encode(bytes);
    Ok(Some(format!("data:{};base64,{}", mime, b64)))
}

fn format_money(amount: f64, currency_code: &str, decimals: usize) -> String {
    let safe_amount = if amount.is_finite() { amount } else { 0.0 };
    match decimals {
        0 => format!("{} {:.0}", currency_code, safe_amount),
        2 => format!("{} {:.2}", currency_code, safe_amount),
        _ => format!("{} {}", currency_code, safe_amount),
    }
}

/// Print a food order receipt
#[tauri::command]
pub fn print_order_receipt(order_id: i64) -> Result<String, String> {
    // Generate the HTML receipt
    let mut html = build_order_receipt_html(order_id)?;
    
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
    let file_path = temp_dir.join(format!("receipt_{}.html", order_id));
    
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
pub fn build_order_receipt_html(order_id: i64) -> Result<String, String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;

    let currency_code = get_setting_or(&conn, "currency_code", "USD")?
        .trim()
        .to_uppercase();

    let business_name = get_setting_or(&conn, "business_name", "Business Manager")?;
    let business_address = get_setting_or(&conn, "business_address", "")?;

    let receipt_header = get_setting_or(&conn, "receipt_header", "")?;
    let receipt_footer = get_setting_or(&conn, "receipt_footer", "")?;
    
    // Get order details with optional guest information
    let mut stmt = conn.prepare(
        "SELECT fo.id, fo.created_at, fo.total_amount, fo.paid, fo.customer_type, fo.customer_name,
                g.name as guest_name, r.number as room_number
            FROM sales fo
            LEFT JOIN customers g ON fo.guest_id = g.id
            LEFT JOIN resources r ON g.room_id = r.id
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
            row.get::<_, Option<String>>(6)?,               // customer_name (from customers table)
            row.get::<_, Option<String>>(7)?,               // room_number
        ))
    }).map_err(|e| format!("Order not found: {}", e))?;
    
    let (_id, created_at, total_amount, paid_status, customer_type, customer_name, guest_name, room_number) = order_row;
    let is_paid = paid_status != 0;
    
    // Logo: use saved business logo if available, otherwise fall back to embedded logo.
    let logo_src = match get_business_logo_data_url(&conn)? {
        Some(src) => src,
        None => {
            let embedded = get_logo_base64();
            if embedded.is_empty() {
                "".to_string()
            } else {
                format!("data:image/jpeg;base64,{}", embedded)
            }
        }
    };

    let logo_html = if logo_src.is_empty() {
        "".to_string()
    } else {
        format!(r#"<img src=\"{}\" alt=\"Logo\" class=\"logo\">"#, logo_src)
    };

    let receipt_header_html = if receipt_header.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div class=\"brand-message\">{}</div>"#, escape_multiline(receipt_header.trim()))
    };

    let receipt_footer_html = if receipt_footer.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div class=\"brand-message\">{}</div>"#, escape_multiline(receipt_footer.trim()))
    };
    
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
            FROM sale_items 
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
        let unit_price_fmt = format_money(unit_price, &currency_code, 2);
        let line_total_fmt = format_money(line_total, &currency_code, 2);
        items_html.push_str(&format!(
            "<tr><td>{}</td><td>{}</td><td>{}</td><td>{}</td></tr>",
            html_escape(&item_name), quantity, unit_price_fmt, line_total_fmt
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

    let total_amount_fmt = format_money(total_amount, &currency_code, 2);

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
            max-width: 120px;
            height: auto;
            margin-bottom: 15px;
            display: block;
            border: 2px solid #333;
            background: #fff;
            padding: 8px;
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
        .brand-message {{
            margin-top: 10px;
            font-size: 13px;
            color: #444;
            line-height: 1.4;
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
        {}
        <h1 class="hotel-name">{}</h1>
        <p class="hotel-subtitle">{}</p>
        {}
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
                <td class="text-right"><strong>{}</strong></td>
            </tr>
        </tfoot>
    </table>

    <div class="footer">
        <p>Thank you for dining with us!</p>
        {}
        <p>Receipt generated on {}</p>
    </div>
</body>
</html>"#, 
        order_id,
        payment_color,
        logo_html,
    html_escape(&business_name),
    html_escape(&business_address),
        receipt_header_html,
        order_id,
        formatted_date,
        html_escape(&customer_display),
        html_escape(&room_display),
        payment_status,
        items_html,
        total_amount_fmt,
        receipt_footer_html,
        chrono::Local::now().format("%B %d, %Y at %I:%M %p")
    );
    
    // Debug: Print first 500 characters to see if logo is embedded
    if html.len() > 500 {
        println!("🔍 HTML PREVIEW (first 500 chars): {}", &html[..500]);
    }
    if html.contains("data:image/jpeg;base64,") {
        println!("✅ Logo image tag found in HTML!");
    } else {
        println!("❌ Logo image tag NOT found in HTML!");
    }
    
    Ok(html)
}

/// Generate HTML invoice for a guest's final bill
#[tauri::command]
pub fn build_final_invoice_html(guest_id: i64) -> Result<String, String> {
    build_final_invoice_html_with_discount(guest_id, "flat".to_string(), 0.0, "".to_string())
}

/// Generate HTML invoice for a guest's final bill with discount information
#[tauri::command]
pub fn build_final_invoice_html_with_discount(
    guest_id: i64, 
    discount_type: String, 
    discount_amount: f64, 
    _discount_description: String
) -> Result<String, String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;

    let currency_code = get_setting_or(&conn, "currency_code", "USD")?
        .trim()
        .to_uppercase();

    let business_name = get_setting_or(&conn, "business_name", "Business Manager")?;
    let business_address = get_setting_or(&conn, "business_address", "")?;

    let receipt_header = get_setting_or(&conn, "receipt_header", "")?;
    let receipt_footer = get_setting_or(&conn, "receipt_footer", "")?;
    
    // Logo: use saved business logo if available, otherwise fall back to embedded logo.
    let logo_src = match get_business_logo_data_url(&conn)? {
        Some(src) => src,
        None => {
            let embedded = get_logo_base64();
            if embedded.is_empty() {
                "".to_string()
            } else {
                format!("data:image/jpeg;base64,{}", embedded)
            }
        }
    };

    let logo_html = if logo_src.is_empty() {
        "".to_string()
    } else {
        format!(r#"<img src=\"{}\" alt=\"Logo\" style=\"width: auto; height: 60px; max-width: 120px; object-fit: contain; display: block; margin: 0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact;\">"#, logo_src)
    };

    let receipt_header_html = if receipt_header.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div style=\"margin-top: 10px; font-size: 11px; color: #333; line-height: 1.35; text-align: center;\">{}</div>"#, escape_multiline(receipt_header.trim()))
    };

    let receipt_footer_html = if receipt_footer.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div style=\"margin-top: 8px; font-size: 10px; color: #333; line-height: 1.35; text-align: center;\">{}</div>"#, escape_multiline(receipt_footer.trim()))
    };
    
    if logo_src.is_empty() {
        println!("❌ WARNING: Logo base64 data is EMPTY for final invoice!");
    } else {
        println!("✅ Logo data loaded for final invoice");
    }
    
    // Get guest details
    let mut stmt = conn.prepare(
        "SELECT g.id, g.name, g.phone, g.check_in, g.check_out, g.daily_rate, g.status,
                r.number as room_number
            FROM customers g
            JOIN resources r ON g.room_id = r.id
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
    
    // Get food order details with items (ALL orders, both paid and unpaid)
    let mut total_food_cost = 0.0;
    
    // Get all food orders for this guest (both paid and unpaid)
    let mut order_stmt = conn.prepare(
        "SELECT fo.id, fo.total_amount, fo.paid
            FROM sales fo
         WHERE fo.guest_id = ?
         ORDER BY fo.created_at"
    ).map_err(|e| format!("Failed to prepare food orders query: {}", e))?;
    
    let sales = order_stmt.query_map([guest_id], |row| {
        Ok((
            row.get::<_, i64>(0)?,   // order_id
            row.get::<_, f64>(1)?,   // total_amount
            row.get::<_, bool>(2)?,  // paid
        ))
    }).map_err(|e| format!("Failed to execute food orders query: {}", e))?;
    
    // For each order, get the items
    let mut food_table_rows = String::new();
    for order_result in sales {
        let (order_id, _amount, paid) = order_result.map_err(|e| format!("Failed to read order: {}", e))?;
        
        let mut item_stmt = conn.prepare(
            "SELECT oi.quantity, oi.item_name, oi.unit_price
               FROM sale_items oi
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
            
            // Only include UNPAID food orders in the total calculation
            if !paid {
                total_food_cost += line_total;
            }
            
            // Add table row for this item with clear paid/unpaid indication
            let status_indicator = if paid { " [PAID]" } else { " [UNPAID]" };
            let strike_through = if paid { "text-decoration: line-through; opacity: 0.6;" } else { "" };
            let unit_price_fmt = format_money(unit_price, &currency_code, 0);
            let line_total_fmt = format_money(line_total, &currency_code, 0);
            food_table_rows.push_str(&format!(
                r#"<div class="table-row" style="{}">
                    <div class="table-cell"><strong>{}{}</strong></div>
                    <div class="table-cell center">{}</div>
                    <div class="table-cell center">{}</div>
                    <div class="table-cell right">{}</div>
                </div>"#,
                strike_through,
                html_escape(&name),
                status_indicator,
                quantity,
                unit_price_fmt,
                line_total_fmt
            ));
        }
    }
    
    // If no food items, show a simple message
    if food_table_rows.is_empty() {
        let zero_fmt = format_money(0.0, &currency_code, 0);
        food_table_rows = r#"<div class="table-row">
            <div class="table-cell">No food orders</div>
            <div class="table-cell center">-</div>
            <div class="table-cell center">-</div>
            <div class="table-cell right">__ZERO__</div>
        </div>"#.to_string().replace("__ZERO__", &zero_fmt);
    }
    
    // Calculate totals (only unpaid food items are included in final total)
    let subtotal_before_discount = room_total + total_food_cost;
    
    // Apply discount
    let discount_value = if discount_amount > 0.0 {
        match discount_type.as_str() {
            "percentage" => {
                if discount_amount > 100.0 {
                    0.0 // Cap at 100%
                } else {
                    subtotal_before_discount * (discount_amount / 100.0)
                }
            },
            "flat" => discount_amount,
            _ => 0.0
        }
    } else {
        0.0
    };
    
    let subtotal = (subtotal_before_discount - discount_value).max(0.0);
    
    // Get tax settings
    let tax_enabled = crate::simple_commands::get_tax_enabled().unwrap_or(true);
    let tax_rate = if tax_enabled {
        crate::simple_commands::get_tax_rate().unwrap_or(5.0) / 100.0
    } else {
        0.0
    };
    let tax_amount = subtotal * tax_rate;
    let final_total = subtotal + tax_amount;
    
    // Create receipt in the format requested
    let current_date = chrono::Local::now();
    let formatted_date = current_date.format("%d-%m-%Y");
    let formatted_time = current_date.format("%I:%M %p");

    let daily_rate_fmt = format_money(daily_rate, &currency_code, 0);
    let room_total_fmt = format_money(room_total, &currency_code, 0);
    let total_food_cost_fmt = format_money(total_food_cost, &currency_code, 0);
    let subtotal_before_discount_fmt = format_money(subtotal_before_discount, &currency_code, 0);
    let final_total_fmt = format_money(final_total, &currency_code, 0);
    
    let html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Final Invoice</title>
    <style>
        @page {{
            size: A4;
            margin: 15mm;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: Arial, sans-serif;
            font-size: 11px;
            line-height: 1.4;
            color: #000;
            background: #fff;
            max-width: 600px;
            margin: 0 auto;
            padding: 15px;
        }}
        
        .invoice {{
            border: 1px solid #333;
            padding: 20px;
            background: #fff;
            page-break-inside: avoid;
        }}
        
        .header {{
            text-align: center;
            margin-bottom: 15px;
            border-bottom: 1px solid #333;
            padding-bottom: 10px;
        }}
        
        .logo {{
            width: 120px;
            height: 60px;
            margin: 0 auto 15px;
            display: block;
            border: 2px solid #333;
            background: #fff;
            padding: 5px;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            object-fit: contain;
        }}
        
        .logo::after {{
            content: "LOGO";
            display: block;
            text-align: center;
            color: #666;
            font-size: 12px;
            margin-top: 20px;
        }}
        
        .hotel-name {{
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 3px;
        }}
        
        .hotel-address {{
            font-size: 9px;
            color: #666;
            margin-bottom: 2px;
        }}
        
        .receipt-title {{
            font-size: 14px;
            font-weight: bold;
            margin-top: 10px;
            color: #2c5282;
        }}
        
        .info-section {{
            margin-bottom: 15px;
        }}
        
        .info-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 10px;
        }}
        
        .info-label {{
            font-weight: bold;
            color: #666;
        }}
        
        .divider {{
            border-top: 1px solid #333;
            margin: 12px 0;
        }}
        
        .section-header {{
            font-weight: bold;
            margin: 12px 0 8px 0;
            text-align: center;
            text-decoration: underline;
            font-size: 11px;
        }}
        
        .table-header {{
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 8px;
            padding: 6px 0;
            border-bottom: 1px solid #333;
            font-weight: bold;
            font-size: 10px;
            background: #f5f5f5;
        }}
        
        .table-row {{
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            gap: 8px;
            padding: 4px 0;
            border-bottom: 1px dotted #ccc;
            font-size: 10px;
        }}
        
        .table-cell {{
            text-align: left;
        }}
        
        .table-cell.center {{
            text-align: center;
        }}
        
        .table-cell.right {{
            text-align: right;
        }}
        
        .total-section {{
            margin-top: 12px;
            border-top: 1px solid #333;
            padding-top: 8px;
        }}
        
        .total-row {{
            display: flex;
            justify-content: space-between;
            margin-bottom: 3px;
            font-size: 10px;
        }}
        
        .grand-total {{
            font-weight: bold;
            font-size: 12px;
            border-top: 2px solid #333;
            padding-top: 6px;
            margin-top: 6px;
        }}
        
        .payment-status {{
            text-align: center;
            margin: 12px 0;
            padding: 6px;
            border: 1px solid #333;
            font-weight: bold;
            background: #f0f0f0;
            font-size: 11px;
        }}
        
        .footer {{
            text-align: center;
            margin-top: 12px;
            font-size: 10px;
            font-style: italic;
        }}
        
        .contact-info {{
            text-align: center;
            margin-top: 8px;
            font-size: 9px;
            color: #666;
        }}
        
        @media print {{
            body {{
                margin: 0;
                padding: 8px;
                max-width: none;
            }}
            
            .invoice {{
                border: 1px solid #000;
                margin: 0;
                padding: 15px;
            }}
            
            .payment-status {{
                background: #fff !important;
            }}
            
            .table-header {{
                background: #fff !important;
            }}
            
            .logo {{
                max-width: 100px !important;
                height: auto !important;
                border: 1px solid #000 !important;
                background: #fff !important;
                padding: 3px !important;
                display: block !important;
                margin: 0 auto 10px !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }}
        }}
    </style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="logo-container" style="text-align: center; margin-bottom: 20px; padding: 10px;">
                {}
            </div>
            <div class="hotel-name">{}</div>
            <div class="hotel-address">{}</div>
            {}
            <div class="receipt-title">Final Invoice</div>
        </div>
        
        <div class="info-section">
            <div class="info-row">
                <span class="info-label">Customer:</span>
                <span>{}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Date:</span>
                <span>{}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Room:</span>
                <span>{}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Check-in:</span>
                <span>{}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Check-out:</span>
                <span>{}</span>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <div class="section-header">ROOM CHARGES</div>
        <div class="table-header">
            <div class="table-cell">Description</div>
            <div class="table-cell center">Days</div>
            <div class="table-cell center">Rate</div>
            <div class="table-cell right">Total</div>
        </div>
        <div class="table-row">
            <div class="table-cell">Room {} - Accommodation</div>
            <div class="table-cell center">{}</div>
            <div class="table-cell center">{}</div>
            <div class="table-cell right">{}</div>
        </div>
        
        <div class="section-header">FOOD ORDERS</div>
        <div class="table-header">
            <div class="table-cell">Item</div>
            <div class="table-cell center">Qty</div>
            <div class="table-cell center">Unit Price</div>
            <div class="table-cell right">Total</div>
        </div>
        {}
        
        <div class="total-section">
            <div class="total-row">
                <span>Room Charges:</span>
                <span>{}</span>
            </div>
            <div class="total-row">
                <span>Food Orders:</span>
                <span>{}</span>
            </div>
            <div class="total-row">
                <span>Subtotal:</span>
                <span>{}</span>
            </div>
            {}
            {}
            <div class="total-row grand-total">
                <span>Grand Total:</span>
                <span>{}</span>
            </div>
        </div>
        
        <div class="payment-status">
            PAID BY: CASH
        </div>
        
        <div style="margin: 8px 0; padding: 6px; border: 1px solid #333; font-size: 9px; text-align: center; background: #f9f9f9;">
            <strong>NOTE:</strong> Only unpaid food orders are included in the total amount.<br>
            Paid orders are shown with [PAID] status and crossed out for reference only.
        </div>
        
        <div class="footer">
            Thank you for your stay!<br>
            {}<br>
            Invoice generated on {} at {}
        </div>
        
        <div class="contact-info">
            Receipt generated on {} at {}
        </div>
    </div>
</body>
</html>"#,
    logo_html,                    // Logo image HTML
    html_escape(&business_name),  // Business name
    html_escape(&business_address), // Business address
    receipt_header_html,
        html_escape(&name),           // Customer name
        formatted_date,               // Current date
        html_escape(&room_number),    // Room number
        html_escape(&check_in),       // Check-in date
        html_escape(&checkout_date),  // Check-out date
        html_escape(&room_number),    // Room number for charges table
        days,                         // Number of days
        daily_rate_fmt,              // Daily rate
        room_total_fmt,              // Total room charges
        food_table_rows,             // Food items table rows
        room_total_fmt,              // Room charges in totals
        total_food_cost_fmt,         // Food cost
        subtotal_before_discount_fmt, // Subtotal before discount
        // Discount row - conditionally included
        if discount_value > 0.0 {
            let discount_label = if discount_type == "percentage" {
                format!("Discount ({:.1}%):", discount_amount)
            } else {
                "Discount:".to_string()
            };
            let discount_fmt = format!("-{}", format_money(discount_value, &currency_code, 0));
            format!(r#"<div class="total-row">
                <span>{}</span>
                <span>{}</span>
            </div>"#, discount_label, discount_fmt)
        } else {
            "".to_string()
        },
        // Tax row - conditionally included
        if tax_enabled {
            let tax_fmt = format_money(tax_amount, &currency_code, 0);
            format!(r#"<div class="total-row">
                <span>Tax ({:.1}%):</span>
                <span>{}</span>
            </div>"#, tax_rate * 100.0, tax_fmt)
        } else {
            "".to_string()
        },
        final_total_fmt,             // Final total
        receipt_footer_html,          // Receipt footer
        formatted_date,              // Date for footer
        formatted_time,              // Time for footer
        formatted_date,              // Date for contact info
        formatted_time               // Time for contact info
    );
    
    // Debug: Print first 500 characters to see if logo is embedded
    if html.len() > 500 {
        println!("🔍 FINAL INVOICE HTML PREVIEW (first 500 chars): {}", &html[..500]);
    }
    
    // Debug: Write the complete HTML to a file for inspection
    let debug_path = std::env::temp_dir().join("debug_invoice.html");
    if let Ok(mut file) = std::fs::File::create(&debug_path) {
        use std::io::Write;
        let _ = file.write_all(html.as_bytes());
        println!("📄 Complete HTML written to {:?} for inspection", debug_path);
    }
    
    if html.contains("data:image/jpeg;base64,") {
        println!("✅ Logo image tag found in FINAL INVOICE HTML!");
        // Find the logo src and print the first 100 characters of base64
        if let Some(start) = html.find("data:image/jpeg;base64,") {
            let base64_start = start + "data:image/jpeg;base64,".len();
            if let Some(end) = html[base64_start..].find("\"") {
                let base64_sample = &html[base64_start..base64_start + end.min(100)];
                println!("🔍 Base64 in HTML (first 100 chars): {}", base64_sample);
                println!("📏 Total base64 length in HTML: {}", end);
            }
        }
    } else {
        println!("❌ Logo image tag NOT found in FINAL INVOICE HTML!");
    }
    
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
