mod models;
mod db;
mod commands;
mod offline_auth;
mod test;
mod simple_commands;

use db::initialize_database;
use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions, logout_all_sessions
};
use test::test_command;
use simple_commands::{
    add_room, get_rooms, delete_room,
    add_guest, get_active_guests, checkout_guest,
    add_menu_item, get_menu_items,
    dashboard_stats, add_food_order, get_food_orders_by_guest, mark_order_paid,
    add_expense, get_expenses
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database on startup
    if let Err(e) = initialize_database() {
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Authentication
            login_admin,
            get_security_question, 
            reset_admin_password,
            validate_admin_session,
            logout_admin,
            cleanup_sessions,
            logout_all_sessions,
            // Test
            test_command,
            // Room management
            add_room,
            get_rooms,
            delete_room,
            // Guest management
            add_guest,
            get_active_guests,
            checkout_guest,
            // Menu management
            add_menu_item,
            get_menu_items,
            // Food orders
            add_food_order,
            get_food_orders_by_guest,
            mark_order_paid,
            // Expenses
            add_expense,
            get_expenses,
            // Dashboard
            dashboard_stats
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
