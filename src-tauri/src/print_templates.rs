use base64::{Engine, prelude::BASE64_STANDARD};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// Include the JPG logo as a compile-time embedded resource for final invoices
const LOGO_DATA: &[u8] = include_bytes!("../logoforcheckout.png");

fn get_logo_base64() -> String {
    // Use the embedded PNG logo
    if !LOGO_DATA.is_empty() {
        let embedded_logo = BASE64_STANDARD.encode(LOGO_DATA);
        println!("✅ Using embedded logo data, size: {} bytes, base64 length: {}", LOGO_DATA.len(), embedded_logo.len());
        
        // Check if the logo starts with PNG or JPEG header
        if LOGO_DATA.len() >= 3 {
            if &LOGO_DATA[0..3] == b"\xFF\xD8\xFF" {
                println!("✅ Valid JPEG header detected");
            } else if LOGO_DATA.len() >= 8 && &LOGO_DATA[0..8] == b"\x89PNG\r\n\x1a\n" {
                println!("✅ Valid PNG header detected");
            } else {
                println!("⚠️  WARNING: Unknown image format");
                println!("First 16 bytes: {:?}", &LOGO_DATA[..16.min(LOGO_DATA.len())]);
            }
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
pub fn print_order_receipt(order_id: i64, _app_handle: tauri::AppHandle) -> Result<String, String> {
    // Generate the HTML receipt
    let mut html = build_order_receipt_html(order_id)?;
    
    // Add auto-print JavaScript - waits for images to load before printing
    let auto_print_script = String::from(r#"
    <script>
        window.addEventListener('load', function() {
            // Wait for all images to load
            let images = document.querySelectorAll('img');
            let loaded = 0;
            let total = images.length;
            
            if (total === 0) {
                setTimeout(() => window.print(), 500);
                return;
            }
            
            function checkAndPrint() {
                loaded++;
                if (loaded === total) {
                    setTimeout(() => window.print(), 500);
                }
            }
            
            images.forEach(img => {
                if (img.complete) {
                    checkAndPrint();
                } else {
                    img.onload = checkAndPrint;
                    img.onerror = checkAndPrint;
                }
            });
            
            // Fallback: print after 5 seconds regardless
            setTimeout(() => window.print(), 5000);
        });
    </script>
"#);
    
    html = html.replace("</head>", &(auto_print_script + "</head>"));
    
    // Write HTML to a temporary file and open it
    // (Images are embedded as base64 data URLs, so they work with file:// protocol)
    use std::fs::File;
    use std::io::Write;
    
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("receipt_{}.html", order_id));
    
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    file.write_all(html.as_bytes())
        .map_err(|e| format!("Failed to write HTML: {}", e))?;
    
    // Open with default browser
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", file_path.to_str().unwrap()])
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

/// Print thermal receipt (58mm/80mm paper - optimized for POS thermal printers)
#[tauri::command]
pub fn print_thermal_receipt(order_id: i64, _app_handle: tauri::AppHandle) -> Result<String, String> {
    // Generate the thermal receipt HTML
    let mut html = build_thermal_receipt(order_id)?;
    
    // Add auto-print JavaScript - waits for images to load
    let auto_print_script = String::from(r#"
    <script>
        window.addEventListener('load', function() {
            let images = document.querySelectorAll('img');
            let loaded = 0;
            let total = images.length;
            
            if (total === 0) {
                setTimeout(() => window.print(), 500);
                return;
            }
            
            function checkAndPrint() {
                loaded++;
                if (loaded === total) {
                    setTimeout(() => window.print(), 500);
                }
            }
            
            images.forEach(img => {
                if (img.complete) {
                    checkAndPrint();
                } else {
                    img.onload = checkAndPrint;
                    img.onerror = checkAndPrint;
                }
            });
            
            setTimeout(() => window.print(), 5000);
        });
    </script>
"#);
    
    html = html.replace("</head>", &(auto_print_script + "</head>"));
    
    // Write HTML to a temporary file and open it
    use std::fs::File;
    use std::io::Write;
    
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("thermal_receipt_{}.html", order_id));
    
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    file.write_all(html.as_bytes())
        .map_err(|e| format!("Failed to write HTML: {}", e))?;
    
    // Open with default browser
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", file_path.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Failed to open thermal receipt: {}", e))?;
    }
    
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open thermal receipt: {}", e))?;
    }
    
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open thermal receipt: {}", e))?;
    }
    
    Ok("Thermal receipt opened - ready for POS printer".to_string())
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
    let _is_paid = paid_status != 0;
    
    // Logo: use saved business logo if available, otherwise fall back to embedded logo.
    let logo_src = match get_business_logo_data_url(&conn)? {
        Some(src) => {
            println!("✅ Using business logo from database, length: {}", src.len());
            // Check if logo is too large for HTML embedding (browser limit ~2MB for data URLs)
            if src.len() > 1_500_000 {
                println!("⚠️  WARNING: Business logo is too large ({} bytes)! Browsers may not render it. Please upload a smaller logo (< 500KB recommended).", src.len());
                println!("⚠️  Falling back to embedded INERTIA logo");
                let embedded = get_logo_base64();
                if !embedded.is_empty() {
                    format!("data:image/png;base64,{}", embedded)
                } else {
                    "".to_string()
                }
            } else {
                src
            }
        },
        None => {
            println!("⚠️  No business logo found, using embedded logo");
            let embedded = get_logo_base64();
            if embedded.is_empty() {
                println!("❌ Embedded logo is also empty!");
                "".to_string()
            } else {
                println!("✅ Using embedded PNG logo");
                format!("data:image/png;base64,{}", embedded)
            }
        }
    };

    // Build logo HTML - business logo at top, INERTIA in footer
    let inertia_logo = get_logo_base64();
    
    // Business logo section (top of receipt)
    let logo_section = if !logo_src.is_empty() && logo_src.len() < 1_500_000 {
        // Business logo available - show it centered
        format!(r#"
        <div class="logos">
            <img src="{}" class="logo-main" alt="{}">
        </div>"#, logo_src, html_escape(&business_name))
    } else if !inertia_logo.is_empty() {
        // No business logo, show INERTIA logo as main
        format!(r#"
        <div class="logos">
            <img src="data:image/png;base64,{}" class="logo-main" alt="INERTIA">
        </div>"#, inertia_logo)
    } else {
        String::new()
    };
    
    // INERTIA footer logo (small, inline with "Powered by INERTIA")
    let inertia_footer_logo = if !inertia_logo.is_empty() {
        format!(r#"<img src="data:image/png;base64,{}" class="inertia-badge" alt="INERTIA">"#, inertia_logo)
    } else {
        String::new()
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
            "<tr><td>{}</td><td class=\"text-right\">{}</td><td class=\"text-right\">{}</td><td class=\"text-right\">{}</td></tr>",
            html_escape(&item_name), quantity, unit_price_fmt, line_total_fmt
        ));
    }
    
    // Get payment summary for the sale
    let mut stmt_payments = conn.prepare(
        "SELECT COALESCE(SUM(amount), 0) as amount_paid 
         FROM sale_payments 
         WHERE sale_id = ?"
    ).map_err(|e| format!("Failed to prepare payment query: {}", e))?;
    
    let amount_paid: f64 = stmt_payments.query_row([order_id], |row| {
        row.get(0)
    }).unwrap_or(0.0);
    
    let balance_due = total_amount - amount_paid;
    let is_fully_paid = balance_due <= 0.01; // Account for floating point precision
    
    let payment_status = if is_fully_paid { 
        "✓ PAID IN FULL" 
    } else if amount_paid > 0.0 {
        "⚠ PARTIALLY PAID"
    } else { 
        "⚠ UNPAID" 
    };
    
    // Determine customer display information
    let customer_display = match customer_type.as_str() {
        "walk_in" => {
            customer_name.unwrap_or_else(|| "Walk-in Customer".to_string())
        },
        _ => {
            guest_name.unwrap_or_else(|| "Guest".to_string())
        }
    };
    
    let _room_display = if customer_type == "walk_in" {
        "Walk-in".to_string()
    } else {
        room_number.unwrap_or_else(|| "N/A".to_string())
    };

    let total_amount_fmt = format_money(total_amount, &currency_code, 2);
    let amount_paid_fmt = format_money(amount_paid, &currency_code, 2);
    let balance_due_fmt = format_money(balance_due, &currency_code, 2);

    // Build complete HTML receipt from scratch - clean and simple
    let html = format!(r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Receipt #{}</title>
    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        
        body {{
            font-family: Arial, sans-serif;
            max-width: 700px;
            margin: 0 auto;
            padding: 30px;
            background: #fff;
            color: #333;
        }}
        
        .logos {{
            text-align: center;
            margin-bottom: 20px;
        }}
        
        .logo-small {{
            height: 40px;
            width: auto;
            margin-bottom: 10px;
            display: block;
            margin-left: auto;
            margin-right: auto;
        }}
        
        .logo-main {{
            height: 70px;
            width: auto;
            max-width: 200px;
            display: block;
            margin: 0 auto 15px;
            border: 2px solid #ddd;
            padding: 8px;
            background: #fff;
            border-radius: 6px;
        }}
        
        .header {{
            text-align: center;
            padding-bottom: 20px;
            border-bottom: 3px solid #000;
            margin-bottom: 25px;
        }}
        
        h1 {{
            font-size: 26px;
            margin: 10px 0;
            color: #000;
        }}
        
        .subtitle {{
            font-size: 14px;
            color: #666;
            margin: 8px 0;
        }}
        
        .header-note {{
            background: #f0f8ff;
            padding: 12px;
            margin: 15px 0;
            font-size: 13px;
            border-radius: 4px;
        }}
        
        h2 {{
            font-size: 22px;
            margin-top: 15px;
            color: #333;
        }}
        
        .info-box {{
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
        }}
        
        .info-row {{
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #dee2e6;
        }}
        
        .info-row:last-child {{
            border-bottom: none;
        }}
        
        .label {{
            font-weight: bold;
            color: #555;
        }}
        
        .payment-status {{
            font-weight: bold;
            font-size: 15px;
        }}
        
        .status-paid {{ color: #28a745; }}
        .status-partial {{ color: #ffc107; }}
        .status-unpaid {{ color: #dc3545; }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        
        th {{
            background: #343a40;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: bold;
        }}
        
        td {{
            padding: 10px 12px;
            border-bottom: 1px solid #dee2e6;
        }}
        
        tbody tr:hover {{
            background: #f8f9fa;
        }}
        
        .text-right {{
            text-align: right;
        }}
        
        tfoot tr {{
            font-weight: bold;
            font-size: 18px;
        }}
        
        .total-row {{
            background: #e9ecef;
        }}
        
        .payment-row {{
            background: #fff3cd;
            border-top: 2px solid #856404;
        }}
        
        .balance-row {{
            background: #f8d7da;
            border-top: 2px solid #721c24;
        }}
        
        .balance-row td {{
            color: #721c24;
        }}
        
        .footer {{
            text-align: center;
            margin-top: 50px;
            padding-top: 25px;
            border-top: 2px solid #dee2e6;
            color: #666;
        }}
        
        .footer p {{
            margin: 8px 0;
        }}
        
        .branding {{
            font-size: 11px;
            color: #999;
            margin-top: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        }}
        
        .inertia-badge {{
            height: 20px;
            width: auto;
            vertical-align: middle;
            opacity: 0.7;
        }}
        
        @media print {{
            body {{
                padding: 15px;
            }}
            .logos img, .logo-small, .logo-main {{
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
        }}
    </style>
</head>
<body>
    <div class="header">
        {}
        <h1>{}</h1>
        <p class="subtitle">{}</p>
        {}
        <h2>Sales Receipt</h2>
    </div>
    
    <div class="info-box">
        <div class="info-row">
            <span class="label">Receipt #:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="label">Date:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="label">Customer:</span>
            <span>{}</span>
        </div>
        <div class="info-row">
            <span class="label">Payment Status:</span>
            <span class="payment-status {}">{}</span>
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
                <td colspan="3">Grand Total</td>
                <td class="text-right">{}</td>
            </tr>
            {}
        </tfoot>
    </table>
    
    <div class="footer">
        <p><strong>Thank you for your purchase!</strong></p>
        {}
        <div class="branding">
            <span>Powered by</span>
            {}
            <strong>INERTIA</strong>
        </div>
        <p style="font-size: 12px;">Receipt generated on {}</p>
    </div>
</body>
</html>"#,
        order_id,
        logo_section,
        html_escape(&business_name),
        html_escape(&business_address),
        if !receipt_header.trim().is_empty() {
            format!(r#"<div class="header-note">{}</div>"#, html_escape(&receipt_header))
        } else {
            String::new()
        },
        order_id,
        formatted_date,
        html_escape(&customer_display),
        if is_fully_paid { "status-paid" } else if amount_paid > 0.0 { "status-partial" } else { "status-unpaid" },
        payment_status,
        items_html,
        total_amount_fmt,
        if !is_fully_paid {
            format!(
                r#"<tr class="payment-row">
                <td colspan="3">Amount Paid</td>
                <td class="text-right">{}</td>
            </tr>
            <tr class="balance-row">
                <td colspan="3">Balance Due</td>
                <td class="text-right">{}</td>
            </tr>"#,
                amount_paid_fmt, balance_due_fmt
            )
        } else {
            String::new()
        },
        if !receipt_footer.trim().is_empty() {
            format!(r#"<p style="margin: 15px 0; font-size: 13px;">{}</p>"#, html_escape(&receipt_footer))
        } else {
            String::new()
        },
        inertia_footer_logo,
        chrono::Local::now().format("%B %d, %Y at %I:%M %p")
    );

    Ok(html)
}

// ===== RETURNS / REFUNDS RECEIPTS =====

/// Generate HTML receipt for a sale return
#[tauri::command]
pub fn build_sale_return_receipt_html(return_id: i64) -> Result<String, String> {
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
                format!("data:image/png;base64,{}", embedded)
            }
        }
    };

    // Build logo HTML - business logo at top, INERTIA in footer
    let inertia_logo = get_logo_base64();
    
    // Business logo (main logo at top)
    let logo_html = if logo_src.is_empty() {
        // No business logo, show INERTIA as main
        if inertia_logo.is_empty() {
            "".to_string()
        } else {
            format!(r#"<img src="data:image/png;base64,{}" alt="INERTIA" style="height: 45px; width: auto; max-width: 100px; object-fit: contain; display: block; margin: 0 auto 6px; border: 1px solid #ddd; padding: 3px; background: white; border-radius: 4px;">"#, inertia_logo)
        }
    } else {
        format!(r#"<img src="{}" alt="Business Logo" style="height: 45px; width: auto; max-width: 100px; object-fit: contain; display: block; margin: 0 auto 6px; border: 1px solid #ddd; padding: 3px; background: white; border-radius: 4px;">"#, logo_src)
    };
    
    // INERTIA footer logo (small, inline with "Powered by INERTIA")
    let inertia_footer_html = if inertia_logo.is_empty() {
        r#"<div class="sub" style="margin-top:8px; color: #999; font-size: 11px;">Powered by <strong>INERTIA</strong></div>"#.to_string()
    } else {
        format!(r#"<div class="sub" style="margin-top:8px; color: #999; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;"><span>Powered by</span><img src="data:image/png;base64,{}" alt="INERTIA" style="height: 16px; width: auto; opacity: 0.7; vertical-align: middle;"><strong>INERTIA</strong></div>"#, inertia_logo)
    };

    // Return header
    let (sale_id, return_date, refund_method, refund_amount, note, created_at): (
        i64,
        String,
        Option<String>,
        f64,
        Option<String>,
        String,
    ) = conn
        .query_row(
            "SELECT sale_id, return_date, refund_method, refund_amount, note, created_at
             FROM sale_returns
             WHERE id = ?1",
            [return_id],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )
        .map_err(|e| format!("Return not found: {}", e))?;

    // Return items
    let mut stmt = conn
        .prepare(
            "SELECT item_name, unit_price, quantity, line_total
             FROM sale_return_items
             WHERE return_id = ?1
             ORDER BY id",
        )
        .map_err(|e| format!("Failed to prepare return items query: {}", e))?;

    let mut rows = stmt
        .query([return_id])
        .map_err(|e| format!("Failed to query return items: {}", e))?;

    let mut items_html = String::new();
    let mut computed_total = 0.0;
    while let Some(r) = rows
        .next()
        .map_err(|e| format!("Failed to read return items: {}", e))?
    {
        let item_name: String = r.get(0).map_err(|e| e.to_string())?;
        let unit_price: f64 = r.get(1).map_err(|e| e.to_string())?;
        let qty: i32 = r.get(2).map_err(|e| e.to_string())?;
        let line_total: f64 = r.get(3).map_err(|e| e.to_string())?;
        computed_total += line_total;

        items_html.push_str(&format!(
            r#"<tr>
                <td class=\"name\">{}</td>
                <td class=\"qty\">{}</td>
                <td class=\"money\">{}</td>
                <td class=\"money\">{}</td>
            </tr>"#,
            html_escape(&item_name),
            qty,
            html_escape(&format_money(unit_price, &currency_code, 2)),
            html_escape(&format_money(line_total, &currency_code, 2)),
        ));
    }

    let header_html = if receipt_header.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div class=\"header-note\">{}</div>"#, escape_multiline(&receipt_header))
    };

    let footer_html = if receipt_footer.trim().is_empty() {
        "".to_string()
    } else {
        format!(r#"<div class=\"footer-note\">{}</div>"#, escape_multiline(&receipt_footer))
    };

    let note_html = match note {
        Some(n) if !n.trim().is_empty() => {
            format!(r#"<div class=\"note\"><strong>Note:</strong> {}</div>"#, escape_multiline(&n))
        }
        _ => "".to_string(),
    };

    let refund_method_display = refund_method.unwrap_or_else(|| "".to_string());

    let html = format!(
        r#"<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>Return Receipt #{return_id}</title>
  <style>
    body {{ font-family: Arial, sans-serif; color: #111; margin: 0; padding: 16px; }}
    .wrap {{ max-width: 380px; margin: 0 auto; }}
    .logo {{ max-width: 140px; max-height: 60px; display: block; margin: 0 auto 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    h1 {{ font-size: 18px; margin: 6px 0 2px; text-align: center; }}
    .sub {{ text-align: center; font-size: 12px; color: #444; }}
    .hr {{ border-top: 1px dashed #999; margin: 12px 0; }}
    .meta {{ font-size: 12px; line-height: 1.4; }}
    table {{ width: 100%; border-collapse: collapse; font-size: 12px; }}
    th {{ text-align: left; padding: 6px 0; border-bottom: 1px dashed #999; }}
    td {{ padding: 6px 0; vertical-align: top; }}
    .qty {{ text-align: right; width: 44px; padding-left: 8px; }}
    .money {{ text-align: right; width: 90px; padding-left: 8px; }}
    .totals {{ font-size: 12px; margin-top: 10px; }}
    .totals .row {{ display: flex; justify-content: space-between; margin: 4px 0; }}
    .strong {{ font-weight: 700; }}
    .header-note, .footer-note, .note {{ font-size: 12px; margin-top: 10px; color: #333; }}
  </style>
</head>
<body>
  <div class=\"wrap\">
    {logo_html}
    <h1>{business_name}</h1>
    <div class=\"sub\">{business_address}</div>
    {header_html}
    <div class=\"hr\"></div>
    <div class=\"meta\">
      <div><strong>Return:</strong> #{return_id}</div>
      <div><strong>Sale:</strong> #{sale_id}</div>
      <div><strong>Return date:</strong> {return_date}</div>
      <div><strong>Created:</strong> {created_at}</div>
      <div><strong>Refund method:</strong> {refund_method}</div>
    </div>
    <div class=\"hr\"></div>
    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th class=\"qty\">Qty</th>
          <th class=\"money\">Unit</th>
          <th class=\"money\">Total</th>
        </tr>
      </thead>
      <tbody>
        {items_html}
      </tbody>
    </table>
    <div class=\"hr\"></div>
    <div class=\"totals\">
      <div class=\"row\"><span>Return total</span><span class=\"strong\">{computed_total}</span></div>
      <div class=\"row\"><span>Refunded</span><span class=\"strong\">{refund_amount}</span></div>
    </div>
    {note_html}
    <div class=\"hr\"></div>
    {footer_html}
    <div class=\"sub\" style=\"margin-top:10px\">Thank you</div>
    {inertia_footer_html}
  </div>
</body>
</html>"#,
        return_id = return_id,
        business_name = html_escape(&business_name),
        business_address = escape_multiline(&business_address),
        header_html = header_html,
        footer_html = footer_html,
        logo_html = logo_html,
        inertia_footer_html = inertia_footer_html,
        sale_id = sale_id,
        return_date = html_escape(&return_date),
        created_at = html_escape(&created_at),
        refund_method = html_escape(&refund_method_display),
        items_html = items_html,
        computed_total = html_escape(&format_money(computed_total, &currency_code, 2)),
        refund_amount = html_escape(&format_money(refund_amount, &currency_code, 2)),
        note_html = note_html,
    );

    Ok(html)
}

/// Print a sale return receipt (opens in browser with auto-print)
#[tauri::command]
pub fn print_sale_return_receipt(return_id: i64, _app_handle: tauri::AppHandle) -> Result<String, String> {
    let mut html = build_sale_return_receipt_html(return_id)?;

    let auto_print_script = String::from(
        r#"
    <script>
        window.addEventListener('load', function() {
            let images = document.querySelectorAll('img');
            let loaded = 0;
            let total = images.length;
            
            if (total === 0) {
                setTimeout(() => window.print(), 500);
                return;
            }
            
            function checkAndPrint() {
                loaded++;
                if (loaded === total) {
                    setTimeout(() => window.print(), 500);
                }
            }
            
            images.forEach(img => {
                if (img.complete) {
                    checkAndPrint();
                } else {
                    img.onload = checkAndPrint;
                    img.onerror = checkAndPrint;
                }
            });
            
            setTimeout(() => window.print(), 5000);
        });
    </script>
"#,
    );

    html = html.replace("</head>", &(auto_print_script + "</head>"));

    // Write HTML to a temporary file and open it
    use std::fs::File;
    use std::io::Write;
    
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join(format!("return_receipt_{}.html", return_id));
    
    let mut file = File::create(&file_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;
    
    file.write_all(html.as_bytes())
        .map_err(|e| format!("Failed to write HTML: {}", e))?;
    
    // Open with default browser
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", file_path.to_str().unwrap()])
            .spawn()
            .map_err(|e| format!("Failed to open return receipt: {}", e))?;
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open return receipt: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Failed to open return receipt: {}", e))?;
    }

    Ok("Return receipt opened in browser - print dialog will appear automatically".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitchenTicketItem {
        pub name: String,
        pub quantity: i64,
        pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KitchenTicket {
        pub created_at: String,
        pub items: Vec<KitchenTicketItem>,
}

/// Generate HTML for a kitchen ticket (KOT) to print from the POS before checkout.
#[tauri::command]
pub fn build_kitchen_ticket_html(ticket: KitchenTicket) -> Result<String, String> {
        let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;

        let business_name = get_setting_or(&conn, "business_name", "Business Manager")?;
        let business_address = get_setting_or(&conn, "business_address", "")?;

        if ticket.items.is_empty() {
                return Err("No items to print".to_string());
        }

        let item_count = ticket.items.len();
        let mut lines = String::new();
        for item in ticket.items {
                let name = html_escape(&item.name);
                let qty = item.quantity.max(0);
                let notes_html = match item.notes {
                        Some(n) if !n.trim().is_empty() => {
                                format!("<div class=\"notes\">{}</div>", escape_multiline(&n.trim()))
                        }
                        _ => "".to_string(),
                };

                lines.push_str(&format!(
                r#"<div class=\"row\"><div class=\"qty\">{}</div><div class=\"name\">{}{}{}</div></div>"#,
                        qty,
                        name,
                        if notes_html.is_empty() { "" } else { "" },
                        notes_html
                ));
        }

        Ok(format!(
                r#"<!doctype html>
<html>
    <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
        <title>Kitchen Ticket</title>
        <style>
            :root {{ --paper: 280px; }}
            body {{
                font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
                margin: 0;
                padding: 12px;
                color: #111;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }}
            .paper {{ width: var(--paper); max-width: 100%; margin: 0 auto; }}
            .top {{ text-align: center; }}
            .title {{ font-size: 18px; font-weight: 900; letter-spacing: 1px; }}
            .biz {{ margin-top: 6px; font-size: 12px; font-weight: 800; }}
            .addr {{ margin-top: 2px; font-size: 10px; color: #333; white-space: pre-wrap; }}
            .meta {{ margin-top: 8px; font-size: 11px; color: #111; display: grid; gap: 4px; }}
            .sep {{ border-top: 1px dashed #444; margin: 10px 0; }}
            .row {{ display: grid; grid-template-columns: 52px 1fr; gap: 10px; padding: 8px 0; border-bottom: 1px dashed #ddd; }}
            .qty {{ font-weight: 900; font-size: 18px; text-align: right; }}
            .name {{ font-weight: 900; font-size: 13px; }}
            .notes {{ margin-top: 4px; font-weight: 700; font-size: 11px; color: #333; }}
            .foot {{ margin-top: 10px; font-size: 10px; color: #333; text-align: center; }}
            @media print {{
                body {{ padding: 0; }}
                .paper {{ width: var(--paper); }}
            }}
        </style>
        <script>
            window.addEventListener('load', function() {{
                setTimeout(function() {{ window.print(); }}, 250);
            }});
        </script>
    </head>
    <body>
        <div class=\"paper\">
            <div class=\"top\">
                <div class=\"title\">KOT</div>
                <div class=\"biz\">{}</div>
                <div class=\"addr\">{}</div>
            </div>
            <div class=\"meta\">
                <div>TIME: {}</div>
                <div>ITEMS: {}</div>
            </div>
            <div class=\"sep\"></div>
            <div>{}</div>
            <div class=\"foot\">--- END ---</div>
        </div>
    </body>
</html>"#,
                html_escape(&business_name),
                html_escape(&business_address),
                html_escape(&ticket.created_at),
                item_count,
                lines
        ))
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
                format!("data:image/png;base64,{}", embedded)
            }
        }
    };

    // INERTIA branding logo (small, at top)
    let inertia_logo = get_logo_base64();
    let inertia_logo_html = if inertia_logo.is_empty() {
        "".to_string()
    } else {
        format!(r#"<img src="data:image/png;base64,{}" alt="INERTIA" style="height: 35px; width: auto; max-width: 90px; object-fit: contain; display: block; margin: 0 auto 8px;">"#, inertia_logo)
    };

    // Business logo (main logo)
    let logo_html = if logo_src.is_empty() {
        "".to_string()
    } else {
        format!(r#"<img src="{}" alt="Business Logo" style="height: 55px; width: auto; max-width: 110px; object-fit: contain; display: block; margin: 0 auto 8px; border: 1px solid #ddd; padding: 4px; background: white; border-radius: 4px;">"#, logo_src)
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
    
    // If no items, show a simple message
    if food_table_rows.is_empty() {
        let zero_fmt = format_money(0.0, &currency_code, 0);
        food_table_rows = r#"<div class="table-row">
            <div class="table-cell">No items</div>
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
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
        
        <div class="section-header">ITEMS</div>
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
                <span>Items:</span>
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
            <strong>NOTE:</strong> Only unpaid items are included in the total amount.<br>
            Paid orders are shown with [PAID] status and crossed out for reference only.
        </div>
        
        <div class="footer">
            Thank you for your purchase!<br>
            {}<br>
            <span style="font-size: 8px; color: #999; margin-top: 8px; display: block;">Powered by <strong>INERTIA</strong></span><br>
            Invoice generated on {} at {}
        </div>
        
        <div class="contact-info">
            Receipt generated on {} at {}
        </div>
    </div>
</body>
</html>"#,
    inertia_logo_html,            // INERTIA branding logo
    logo_html,                    // Business logo
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

/// Build a simplified thermal printer receipt (58mm/80mm paper - text only, no graphics)
/// This is designed for POS thermal printers that work best with plain text
pub fn build_thermal_receipt(order_id: i64) -> Result<String, String> {
    let conn = crate::db::get_db_connection().map_err(|e| format!("Failed to open database: {}", e))?;

    // Get settings
    let business_name = get_setting_or(&conn, "business_name", "Business Manager")?;
    let _business_address = get_setting_or(&conn, "business_address", "")?;
    let receipt_header = get_setting_or(&conn, "receipt_header", "WELCOME TO THE SHOP")?;
    let receipt_footer = get_setting_or(&conn, "receipt_footer", "Thank you for your purchase!")?;

    // Get logos
    let logo_src = match get_business_logo_data_url(&conn)? {
        Some(src) => {
            if src.len() < 1_500_000 {
                src
            } else {
                let embedded = get_logo_base64();
                if embedded.is_empty() {
                    "".to_string()
                } else {
                    format!("data:image/png;base64,{}", embedded)
                }
            }
        },
        None => {
            let embedded = get_logo_base64();
            if embedded.is_empty() {
                "".to_string()
            } else {
                format!("data:image/png;base64,{}", embedded)
            }
        }
    };

    let inertia_logo = get_logo_base64();
    
    // Build logo HTML for thermal receipt (small, centered)
    let logo_html = if !logo_src.is_empty() {
        format!(r#"<div style="text-align: center; margin-bottom: 8px;"><img src="{}" alt="Logo" style="height: 40px; width: auto; max-width: 60mm; display: inline-block;"></div>"#, logo_src)
    } else {
        String::new()
    };
    
    // INERTIA footer logo for thermal
    let inertia_footer_html = if !inertia_logo.is_empty() {
        format!(r#"<div style="text-align: center; margin-top: 4px; font-size: 10px; color: #666;"><img src="data:image/png;base64,{}" alt="INERTIA" style="height: 14px; width: auto; opacity: 0.7; vertical-align: middle; margin-right: 4px;"><span>Powered by INERTIA</span></div>"#, inertia_logo)
    } else {
        r#"<div style="text-align: center; margin-top: 4px; font-size: 10px; color: #666;">Powered by INERTIA</div>"#.to_string()
    };

    // Get order details
    let mut stmt = conn.prepare(
        "SELECT id, created_at, total_amount, paid, customer_type, customer_name 
         FROM sales WHERE id = ?1"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;

    let order_row = stmt.query_row([order_id], |row: &rusqlite::Row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, i64>(3)?,
            row.get::<_, String>(4)?,
            row.get::<_, Option<String>>(5)?,
        ))
    }).map_err(|e| format!("Order not found: {}", e))?;

    let (_id, created_at, total_amount, paid_status, customer_type, customer_name) = order_row;
    let _is_paid = paid_status != 0;

    // Format date
    let formatted_date = if let Ok(parsed_date) = chrono::DateTime::parse_from_rfc3339(&created_at) {
        parsed_date.format("%b %d, %Y %I:%M %p").to_string()
    } else {
        created_at.clone()
    };

    let customer = customer_name.as_deref().unwrap_or(&customer_type);

    // Get order items
    let mut items_stmt = conn.prepare(
        "SELECT item_name, quantity, unit_price, line_total 
         FROM sale_items WHERE order_id = ?1"
    ).map_err(|e| format!("Failed to prepare items statement: {}", e))?;

    let items = items_stmt.query_map([order_id], |row: &rusqlite::Row| {
        Ok((
            row.get::<_, String>(0)?,
            row.get::<_, i32>(1)?,
            row.get::<_, f64>(2)?,
            row.get::<_, f64>(3)?,
        ))
    }).map_err(|e| format!("Failed to query items: {}", e))?;

    let mut items_text = String::new();
    for item_result in items {
        let (name, qty, _unit_price, total_price) = item_result.map_err(|e| format!("Failed to read item: {}", e))?;
        items_text.push_str(&format!(
            "{:<20} {:>3} x {:>8.2}\n",
            truncate_str(&name, 20),
            qty,
            total_price
        ));
    }

    // Get currency symbol
    let currency = get_setting_or(&conn, "currency", "PKR")?;

    // Build thermal receipt (optimized for 58mm/80mm thermal printers)
    // Using plain text formatting for maximum compatibility
    let thermal_text = format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Thermal Receipt #{}</title>
    <style>
        @page {{
            size: 80mm auto;
            margin: 0;
        }}
        body {{
            font-family: 'Courier New', monospace;
            font-size: 12px;
            line-height: 1.3;
            margin: 0;
            padding: 8px;
            width: 80mm;
        }}
        pre {{
            margin: 0;
            white-space: pre-wrap;
            word-wrap: break-word;
        }}
        img {{
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }}
    </style>
</head>
<body>
{}
<pre>
================================
      {}
      {}
================================
Receipt #: {}
Date: {}
Customer: {}
--------------------------------
ITEM                QTY   TOTAL
--------------------------------
{}--------------------------------
GRAND TOTAL:     {} {:.2}
Payment: {}
================================
{}
================================
</pre>
{}
</body>
</html>"#,
        order_id,
        logo_html,
        center_text(&business_name, 32),
        center_text(&receipt_header, 32),
        order_id,
        formatted_date,
        customer,
        items_text,
        currency,
        total_amount,
        if _is_paid { "PAID" } else { "PENDING" },
        receipt_footer,
        inertia_footer_html
    );

    Ok(thermal_text)
}

/// Helper function to center text within a given width
fn center_text(text: &str, width: usize) -> String {
    let text_len = text.len();
    if text_len >= width {
        return text.to_string();
    }
    let padding = (width - text_len) / 2;
    format!("{}{}", " ".repeat(padding), text)
}

/// Helper function to truncate string to max length
fn truncate_str(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
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
