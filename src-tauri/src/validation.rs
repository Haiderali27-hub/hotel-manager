#![allow(dead_code)]

use chrono::NaiveDate;

/// Standard error codes for consistent frontend handling
pub const ROOM_NOT_FOUND: &str = "ROOM_NOT_FOUND";
pub const ROOM_OCCUPIED: &str = "ROOM_OCCUPIED";
pub const ROOM_NUMBER_EXISTS: &str = "ROOM_NUMBER_EXISTS";
pub const GUEST_NOT_FOUND: &str = "GUEST_NOT_FOUND";
pub const GUEST_NOT_ACTIVE: &str = "GUEST_NOT_ACTIVE";
pub const GUEST_ALREADY_CHECKED_OUT: &str = "GUEST_ALREADY_CHECKED_OUT";
pub const MENU_ITEM_NOT_FOUND: &str = "MENU_ITEM_NOT_FOUND";
pub const MENU_ITEM_UNAVAILABLE: &str = "MENU_ITEM_UNAVAILABLE";
pub const ORDER_NOT_FOUND: &str = "ORDER_NOT_FOUND";
pub const ORDER_ALREADY_PAID: &str = "ORDER_ALREADY_PAID";
pub const INVALID_DATE_FORMAT: &str = "INVALID_DATE_FORMAT";
pub const NEGATIVE_AMOUNT: &str = "NEGATIVE_AMOUNT";
pub const EMPTY_FIELD: &str = "EMPTY_FIELD";
pub const INVALID_CREDENTIALS: &str = "INVALID_CREDENTIALS";
pub const SESSION_EXPIRED: &str = "SESSION_EXPIRED";
pub const UNAUTHORIZED: &str = "UNAUTHORIZED";
pub const DATABASE_ERROR: &str = "DATABASE_ERROR";
pub const CONSTRAINT_VIOLATION: &str = "CONSTRAINT_VIOLATION";

/// Validation result type
pub type ValidationResult<T> = Result<T, String>;

/// Validate date format (YYYY-MM-DD)
pub fn validate_date_format(date: &str) -> ValidationResult<()> {
    if date.is_empty() {
        return Err(EMPTY_FIELD.to_string());
    }
    
    NaiveDate::parse_from_str(date, "%Y-%m-%d")
        .map_err(|_| INVALID_DATE_FORMAT.to_string())?;
    
    Ok(())
}

/// Validate that check-out is after check-in
pub fn validate_date_range(check_in: &str, check_out: &str) -> ValidationResult<()> {
    validate_date_format(check_in)?;
    validate_date_format(check_out)?;
    
    let check_in_date = NaiveDate::parse_from_str(check_in, "%Y-%m-%d")
        .map_err(|_| INVALID_DATE_FORMAT.to_string())?;
    let check_out_date = NaiveDate::parse_from_str(check_out, "%Y-%m-%d")
        .map_err(|_| INVALID_DATE_FORMAT.to_string())?;
    
    if check_out_date <= check_in_date {
        return Err("CHECK_OUT_BEFORE_CHECK_IN".to_string());
    }
    
    Ok(())
}

/// Validate positive amount
pub fn validate_positive_amount(amount: f64) -> ValidationResult<()> {
    if amount < 0.0 {
        return Err(NEGATIVE_AMOUNT.to_string());
    }
    if amount.is_nan() || amount.is_infinite() {
        return Err("INVALID_AMOUNT".to_string());
    }
    Ok(())
}

/// Validate non-empty string
pub fn validate_non_empty(value: &str, field_name: &str) -> ValidationResult<()> {
    if value.trim().is_empty() {
        return Err(format!("{}_EMPTY", field_name.to_uppercase()));
    }
    Ok(())
}

/// Validate room number format
pub fn validate_room_number(number: &str) -> ValidationResult<()> {
    validate_non_empty(number, "room_number")?;
    
    // Allow alphanumeric room numbers (e.g., "101", "A12", "SUITE-1")
    if !number.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '_') {
        return Err("INVALID_ROOM_NUMBER_FORMAT".to_string());
    }
    
    if number.len() > 10 {
        return Err("ROOM_NUMBER_TOO_LONG".to_string());
    }
    
    Ok(())
}

/// Validate phone number format
pub fn validate_phone_number(phone: &str) -> ValidationResult<()> {
    if phone.is_empty() {
        return Ok(()); // Phone is optional
    }
    
    // Basic phone validation - allow common formats
    let cleaned = phone.replace(&[' ', '-', '(', ')', '+'][..], "");
    if !cleaned.chars().all(|c| c.is_ascii_digit()) {
        return Err("INVALID_PHONE_FORMAT".to_string());
    }
    
    if cleaned.len() < 7 || cleaned.len() > 15 {
        return Err("INVALID_PHONE_LENGTH".to_string());
    }
    
    Ok(())
}

/// Validate guest name
pub fn validate_guest_name(name: &str) -> ValidationResult<()> {
    validate_non_empty(name, "guest_name")?;
    
    if name.len() > 100 {
        return Err("GUEST_NAME_TOO_LONG".to_string());
    }
    
    // Allow letters, spaces, apostrophes, hyphens
    if !name.chars().all(|c| c.is_alphabetic() || c == ' ' || c == '\'' || c == '-' || c == '.') {
        return Err("INVALID_GUEST_NAME_FORMAT".to_string());
    }
    
    Ok(())
}

/// Validate menu item name
pub fn validate_menu_item_name(name: &str) -> ValidationResult<()> {
    validate_non_empty(name, "menu_item_name")?;
    
    if name.len() > 100 {
        return Err("MENU_ITEM_NAME_TOO_LONG".to_string());
    }
    
    Ok(())
}

/// Validate expense category
pub fn validate_expense_category(category: &str) -> ValidationResult<()> {
    validate_non_empty(category, "expense_category")?;
    
    if category.len() > 50 {
        return Err("EXPENSE_CATEGORY_TOO_LONG".to_string());
    }
    
    Ok(())
}

/// Validate expense description
pub fn validate_expense_description(description: &str) -> ValidationResult<()> {
    if description.len() > 500 {
        return Err("EXPENSE_DESCRIPTION_TOO_LONG".to_string());
    }
    
    Ok(())
}

/// Validate quantity (positive integer)
pub fn validate_quantity(quantity: i32) -> ValidationResult<()> {
    if quantity <= 0 {
        return Err("INVALID_QUANTITY".to_string());
    }
    
    if quantity > 1000 {
        return Err("QUANTITY_TOO_LARGE".to_string());
    }
    
    Ok(())
}

/// Validate ID (positive integer)
pub fn validate_id(id: i64, entity_type: &str) -> ValidationResult<()> {
    if id <= 0 {
        return Err(format!("INVALID_{}_ID", entity_type.to_uppercase()));
    }
    
    Ok(())
}

/// Check if room exists and is available for assignment
pub fn validate_room_availability(conn: &rusqlite::Connection, room_id: i64, exclude_guest_id: Option<i64>) -> ValidationResult<()> {
    let query = "SELECT is_occupied, guest_id FROM rooms WHERE id = ?".to_string();
    let params: Vec<&dyn rusqlite::ToSql> = vec![&room_id];
    
    let result = conn.query_row(&query, &*params, |row| {
        Ok((
            row.get::<_, bool>(0)?,           // is_occupied
            row.get::<_, Option<i64>>(1)?,    // guest_id
        ))
    });
    
    match result {
        Ok((is_occupied, current_guest_id)) => {
            if is_occupied {
                // If room is occupied, check if it's by the same guest (for updates)
                if let Some(exclude_id) = exclude_guest_id {
                    if current_guest_id == Some(exclude_id) {
                        return Ok(()); // Same guest, allow update
                    }
                }
                return Err(ROOM_OCCUPIED.to_string());
            }
            Ok(())
        }
        Err(_) => Err(ROOM_NOT_FOUND.to_string()),
    }
}

/// Check if guest exists and is active
pub fn validate_guest_active(conn: &rusqlite::Connection, guest_id: i64) -> ValidationResult<()> {
    let result = conn.query_row(
        "SELECT is_active FROM guests WHERE id = ?",
        [guest_id],
        |row| row.get::<_, bool>(0)
    );
    
    match result {
        Ok(is_active) => {
            if !is_active {
                return Err(GUEST_NOT_ACTIVE.to_string());
            }
            Ok(())
        }
        Err(_) => Err(GUEST_NOT_FOUND.to_string()),
    }
}

/// Check if menu item exists and is available
pub fn validate_menu_item_available(conn: &rusqlite::Connection, menu_item_id: i64) -> ValidationResult<()> {
    let result = conn.query_row(
        "SELECT is_available FROM menu_items WHERE id = ?",
        [menu_item_id],
        |row| row.get::<_, bool>(0)
    );
    
    match result {
        Ok(is_available) => {
            if !is_available {
                return Err(MENU_ITEM_UNAVAILABLE.to_string());
            }
            Ok(())
        }
        Err(_) => Err(MENU_ITEM_NOT_FOUND.to_string()),
    }
}

/// Check if room number is unique (excluding a specific room ID for updates)
pub fn validate_room_number_unique(conn: &rusqlite::Connection, number: &str, exclude_room_id: Option<i64>) -> ValidationResult<()> {
    let mut query = "SELECT COUNT(*) FROM rooms WHERE number = ?".to_string();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(number.to_string())];
    
    if let Some(exclude_id) = exclude_room_id {
        query.push_str(" AND id != ?");
        params.push(Box::new(exclude_id));
    }
    
    let param_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let count: i64 = conn.query_row(&query, &*param_refs, |row| row.get(0))
        .map_err(|_| DATABASE_ERROR.to_string())?;
    
    if count > 0 {
        return Err(ROOM_NUMBER_EXISTS.to_string());
    }
    
    Ok(())
}

/// Comprehensive validation for new guest
pub fn validate_new_guest(
    conn: &rusqlite::Connection,
    name: &str,
    phone: &Option<String>,
    room_id: i64,
    check_in: &str,
    check_out: &Option<String>,
    daily_rate: f64,
) -> ValidationResult<()> {
    // Validate basic fields
    validate_guest_name(name)?;
    validate_id(room_id, "room")?;
    validate_date_format(check_in)?;
    validate_positive_amount(daily_rate)?;
    
    // Validate phone if provided
    if let Some(phone_num) = phone {
        validate_phone_number(phone_num)?;
    }
    
    // Validate date range if check_out is provided
    if let Some(checkout) = check_out {
        validate_date_range(check_in, checkout)?;
    }
    
    // Validate room availability
    validate_room_availability(conn, room_id, None)?;
    
    Ok(())
}

/// Comprehensive validation for new menu item
pub fn validate_new_menu_item(
    name: &str,
    price: f64,
    category: &str,
) -> ValidationResult<()> {
    validate_menu_item_name(name)?;
    validate_positive_amount(price)?;
    validate_non_empty(category, "category")?;
    
    if category.len() > 50 {
        return Err("CATEGORY_TOO_LONG".to_string());
    }
    
    Ok(())
}

/// Comprehensive validation for new expense
pub fn validate_new_expense(
    date: &str,
    category: &str,
    description: &str,
    amount: f64,
) -> ValidationResult<()> {
    validate_date_format(date)?;
    validate_expense_category(category)?;
    validate_expense_description(description)?;
    validate_positive_amount(amount)?;
    
    Ok(())
}

/// Comprehensive validation for food order
pub fn validate_food_order(
    conn: &rusqlite::Connection,
    guest_id: i64,
    items: &[(i64, i32, f64)], // (menu_item_id, quantity, unit_price)
) -> ValidationResult<()> {
    validate_id(guest_id, "guest")?;
    validate_guest_active(conn, guest_id)?;
    
    if items.is_empty() {
        return Err("ORDER_ITEMS_EMPTY".to_string());
    }
    
    for (menu_item_id, quantity, unit_price) in items {
        validate_id(*menu_item_id, "menu_item")?;
        validate_quantity(*quantity)?;
        validate_positive_amount(*unit_price)?;
        validate_menu_item_available(conn, *menu_item_id)?;
    }
    
    Ok(())
}

/// Transaction wrapper for error handling
pub fn with_transaction<F, R>(conn: &mut rusqlite::Connection, f: F) -> ValidationResult<R>
where
    F: FnOnce(&rusqlite::Transaction) -> ValidationResult<R>,
{
    let tx = conn.transaction().map_err(|_| DATABASE_ERROR.to_string())?;
    
    match f(&tx) {
        Ok(result) => {
            tx.commit().map_err(|_| DATABASE_ERROR.to_string())?;
            Ok(result)
        }
        Err(e) => {
            let _ = tx.rollback(); // Ignore rollback errors
            Err(e)
        }
    }
}
