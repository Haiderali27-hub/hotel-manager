use crate::models::*;
use crate::db::*;
use rusqlite::params;
use tauri::command;
use chrono::{Utc, NaiveDate};
use std::collections::HashMap;

// ===== DASHBOARD & REPORTS =====

#[command]
pub fn dashboard_stats() -> Result<DashboardStats, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    let now = Utc::now();
    let current_month_start = format!("{}-{:02}-01", now.year(), now.month());
    let current_month_end = format!("{}-{:02}-{:02}", now.year(), now.month(), 
        NaiveDate::from_ymd_opt(now.year(), now.month() + 1, 1)
            .unwrap_or(NaiveDate::from_ymd_opt(now.year() + 1, 1, 1).unwrap())
            .pred_opt()
            .unwrap()
            .day()
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
    
    // Total income this month (room charges for guests who checked out + paid food orders)
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

#[command]
pub fn monthly_report(year: i32, month: u32) -> Result<MonthlyReport, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    if month < 1 || month > 12 {
        return Err("Month must be between 1 and 12".to_string());
    }
    
    let month_start = format!("{}-{:02}-01", year, month);
    let month_end = format!("{}-{:02}-{:02}", year, month, 
        NaiveDate::from_ymd_opt(year, month + 1, 1)
            .unwrap_or(NaiveDate::from_ymd_opt(year + 1, 1, 1).unwrap())
            .pred_opt()
            .unwrap()
            .day()
    );
    
    // Room income for the month
    let room_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM((julianday(COALESCE(check_out, date('now'))) - julianday(check_in) + 1) * daily_rate), 0)
         FROM guests 
         WHERE status = 'checked_out' 
         AND check_out >= ?1 AND check_out <= ?2",
        params![month_start, month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    // Food income for the month
    let food_income: f64 = conn.query_row(
        "SELECT COALESCE(SUM(total_amount), 0) 
         FROM food_orders 
         WHERE paid = 1 
         AND date(paid_at) >= ?1 AND date(paid_at) <= ?2",
        params![month_start, month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    let total_income = room_income + food_income;
    
    // Expenses for the month
    let expenses: f64 = conn.query_row(
        "SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE date >= ?1 AND date <= ?2",
        params![month_start, month_end],
        |row| row.get(0)
    ).map_err(|e| e.to_string())?;
    
    Ok(MonthlyReport {
        income: total_income,
        expenses,
        profit_loss: total_income - expenses,
    })
}

#[command]
pub fn history(query: HistoryQuery) -> Result<Vec<HistoryRow>, String> {
    let conn = get_db_connection().map_err(|e| e.to_string())?;
    
    match query.tab.as_str() {
        "guests" => get_guest_history(&conn, &query),
        "orders" => get_order_history(&conn, &query),
        "expenses" => get_expense_history(&conn, &query),
        _ => Err("Invalid tab. Must be 'guests', 'orders', or 'expenses'".to_string()),
    }
}

fn get_guest_history(conn: &rusqlite::Connection, query: &HistoryQuery) -> Result<Vec<HistoryRow>, String> {
    let mut sql = "SELECT g.id, g.check_in, g.name, g.daily_rate, g.status, r.number as room_number,
                         g.check_out, 
                         CASE WHEN g.status = 'checked_out' 
                              THEN (julianday(COALESCE(g.check_out, date('now'))) - julianday(g.check_in) + 1) * g.daily_rate
                              ELSE 0 END as total_amount
                  FROM guests g 
                  JOIN rooms r ON g.room_id = r.id 
                  WHERE 1=1".to_string();
    
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    
    if let Some(ref date_from) = query.date_from {
        validate_date_format(date_from)?;
        sql.push_str(" AND g.check_in >= ?");
        params_vec.push(Box::new(date_from.clone()));
    }
    
    if let Some(ref date_to) = query.date_to {
        validate_date_format(date_to)?;
        sql.push_str(" AND g.check_in <= ?");
        params_vec.push(Box::new(date_to.clone()));
    }
    
    if let Some(room_id) = query.room_id {
        sql.push_str(" AND g.room_id = ?");
        params_vec.push(Box::new(room_id));
    }
    
    sql.push_str(" ORDER BY g.check_in DESC");
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let row_iter = stmt.query_map(&params_refs[..], |row| {
        let mut details = HashMap::new();
        details.insert("guest_id".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<_, i64>(0)?)));
        details.insert("name".to_string(), serde_json::Value::String(row.get::<_, String>(2)?));
        details.insert("daily_rate".to_string(), serde_json::Value::Number(serde_json::Number::from_f64(row.get::<_, f64>(3)?).unwrap()));
        details.insert("status".to_string(), serde_json::Value::String(row.get::<_, String>(4)?));
        details.insert("room_number".to_string(), serde_json::Value::String(row.get::<_, String>(5)?));
        if let Ok(checkout) = row.get::<_, Option<String>>(6) {
            if let Some(co) = checkout {
                details.insert("check_out".to_string(), serde_json::Value::String(co));
            }
        }
        
        Ok(HistoryRow {
            id: row.get(0)?,
            date: row.get(1)?,
            description: format!("Guest: {} - Room {}", row.get::<_, String>(2)?, row.get::<_, String>(5)?),
            amount: Some(row.get(7)?),
            details: serde_json::Value::Object(details.into_iter().collect()),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rows = Vec::new();
    for row in row_iter {
        rows.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(rows)
}

fn get_order_history(conn: &rusqlite::Connection, query: &HistoryQuery) -> Result<Vec<HistoryRow>, String> {
    let mut sql = "SELECT fo.id, date(fo.created_at), fo.customer_type, fo.customer_name, fo.total_amount, fo.paid,
                         g.name as guest_name
                  FROM food_orders fo 
                  LEFT JOIN guests g ON fo.guest_id = g.id
                  WHERE 1=1".to_string();
    
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    
    if let Some(ref date_from) = query.date_from {
        validate_date_format(date_from)?;
        sql.push_str(" AND date(fo.created_at) >= ?");
        params_vec.push(Box::new(date_from.clone()));
    }
    
    if let Some(ref date_to) = query.date_to {
        validate_date_format(date_to)?;
        sql.push_str(" AND date(fo.created_at) <= ?");
        params_vec.push(Box::new(date_to.clone()));
    }
    
    if let Some(guest_id) = query.guest_id {
        sql.push_str(" AND fo.guest_id = ?");
        params_vec.push(Box::new(guest_id));
    }
    
    sql.push_str(" ORDER BY fo.created_at DESC");
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let row_iter = stmt.query_map(&params_refs[..], |row| {
        let mut details = HashMap::new();
        details.insert("order_id".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<_, i64>(0)?)));
        details.insert("customer_type".to_string(), serde_json::Value::String(row.get::<_, String>(2)?));
        if let Ok(customer_name) = row.get::<_, Option<String>>(3) {
            if let Some(name) = customer_name {
                details.insert("customer_name".to_string(), serde_json::Value::String(name));
            }
        }
        details.insert("paid".to_string(), serde_json::Value::Bool(row.get::<_, i32>(5)? == 1));
        if let Ok(guest_name) = row.get::<_, Option<String>>(6) {
            if let Some(name) = guest_name {
                details.insert("guest_name".to_string(), serde_json::Value::String(name));
            }
        }
        
        let description = if let Ok(Some(guest_name)) = row.get::<_, Option<String>>(6) {
            format!("Food Order - Guest: {}", guest_name)
        } else if let Ok(Some(customer_name)) = row.get::<_, Option<String>>(3) {
            format!("Food Order - Walk-in: {}", customer_name)
        } else {
            "Food Order - Walk-in".to_string()
        };
        
        Ok(HistoryRow {
            id: row.get(0)?,
            date: row.get(1)?,
            description,
            amount: Some(row.get(4)?),
            details: serde_json::Value::Object(details.into_iter().collect()),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rows = Vec::new();
    for row in row_iter {
        rows.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(rows)
}

fn get_expense_history(conn: &rusqlite::Connection, query: &HistoryQuery) -> Result<Vec<HistoryRow>, String> {
    let mut sql = "SELECT id, date, category, description, amount FROM expenses WHERE 1=1".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::ToSql>> = vec![];
    
    if let Some(ref date_from) = query.date_from {
        validate_date_format(date_from)?;
        sql.push_str(" AND date >= ?");
        params_vec.push(Box::new(date_from.clone()));
    }
    
    if let Some(ref date_to) = query.date_to {
        validate_date_format(date_to)?;
        sql.push_str(" AND date <= ?");
        params_vec.push(Box::new(date_to.clone()));
    }
    
    if let Some(ref category) = query.category {
        if !category.trim().is_empty() {
            sql.push_str(" AND category = ?");
            params_vec.push(Box::new(category.trim().to_string()));
        }
    }
    
    sql.push_str(" ORDER BY date DESC, id DESC");
    
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_refs: Vec<&dyn rusqlite::ToSql> = params_vec.iter().map(|p| p.as_ref()).collect();
    
    let row_iter = stmt.query_map(&params_refs[..], |row| {
        let mut details = HashMap::new();
        details.insert("expense_id".to_string(), serde_json::Value::Number(serde_json::Number::from(row.get::<_, i64>(0)?)));
        details.insert("category".to_string(), serde_json::Value::String(row.get::<_, String>(2)?));
        if let Ok(description) = row.get::<_, Option<String>>(3) {
            if let Some(desc) = description {
                details.insert("description".to_string(), serde_json::Value::String(desc));
            }
        }
        
        let description = format!("Expense: {} - {}", 
            row.get::<_, String>(2)?,
            row.get::<_, Option<String>>(3)?.unwrap_or_else(|| "No description".to_string())
        );
        
        Ok(HistoryRow {
            id: row.get(0)?,
            date: row.get(1)?,
            description,
            amount: Some(row.get(4)?),
            details: serde_json::Value::Object(details.into_iter().collect()),
        })
    }).map_err(|e| e.to_string())?;
    
    let mut rows = Vec::new();
    for row in row_iter {
        rows.push(row.map_err(|e| e.to_string())?);
    }
    
    Ok(rows)
}
