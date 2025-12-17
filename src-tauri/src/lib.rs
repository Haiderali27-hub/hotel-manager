mod models;
mod db;
mod offline_auth;
mod simple_commands;
mod database_reset;
mod export;
mod print_templates;
mod validation;
mod settings;

use tauri::Manager;
use db::initialize_database;
use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions, logout_all_sessions,
    check_is_setup, register_initial_admin
};
use simple_commands::{
    add_room, get_rooms, get_available_rooms_for_guest, update_room, delete_room, cleanup_soft_deleted_rooms,
        add_guest, get_active_guests, get_all_guests, get_guest, checkout_guest, checkout_guest_with_discount, update_guest,
    add_menu_item, get_menu_items, update_menu_item, delete_menu_item,
        dashboard_stats, add_food_order, get_food_orders, get_food_orders_by_guest, mark_order_paid,
    add_expense, get_expenses, get_expenses_by_date_range, update_expense, delete_expense,
    toggle_food_order_payment, delete_food_order, get_order_details,
    set_tax_rate, get_tax_rate, set_tax_enabled, get_tax_enabled,
    set_currency_code, get_currency_code, set_locale, get_locale,
    set_business_name, get_business_name,
    // Generic alias commands
    add_resource, get_resources, get_available_resources_for_customer, update_resource, delete_resource,
    add_customer, get_active_customers, get_all_customers, get_customer, checkout_customer, checkout_customer_with_discount, update_customer,
    add_sale, get_sales, get_sales_by_customer, mark_sale_paid, toggle_sale_payment, delete_sale, get_sale_details,
    set_business_mode, get_business_mode
};
use database_reset::{reset_database, get_database_path, get_database_stats};
use export::{export_history_csv, export_history_csv_with_dialog, create_database_backup};
use print_templates::{build_order_receipt_html, build_final_invoice_html, build_final_invoice_html_with_discount, print_order_receipt};
use settings::{
    backup_database, export_json_backup, restore_database_from_backup, get_reset_security_question, 
    validate_security_answer, reset_application_data, select_backup_file, browse_backup_file
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize database on startup
    if let Err(e) = initialize_database() {
        eprintln!("Failed to initialize database: {}", e);
        std::process::exit(1);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Authentication
            login_admin,
            get_security_question, 
            reset_admin_password,
            validate_admin_session,
            logout_admin,
            cleanup_sessions,
            logout_all_sessions,
            check_is_setup,
            register_initial_admin,
            // Room management
            add_room,
            get_rooms,
            get_available_rooms_for_guest,
            update_room,
            delete_room,
            cleanup_soft_deleted_rooms,
            // Resource management (generic aliases)
            add_resource,
            get_resources,
            get_available_resources_for_customer,
            update_resource,
            delete_resource,
            // Guest management
            add_guest,
            get_active_guests,
            get_all_guests,
            get_guest,
            checkout_guest,
            checkout_guest_with_discount,
            update_guest,
            // Customer management (generic aliases)
            add_customer,
            get_active_customers,
            get_all_customers,
            get_customer,
            checkout_customer,
            checkout_customer_with_discount,
            update_customer,
            // Menu management
            add_menu_item,
            get_menu_items,
            update_menu_item,
            delete_menu_item,
            // Food orders
            add_food_order,
            get_food_orders,
            get_food_orders_by_guest,
            mark_order_paid,
            toggle_food_order_payment,
            delete_food_order,
            get_order_details,
            // Sales (generic aliases)
            add_sale,
            get_sales,
            get_sales_by_customer,
            mark_sale_paid,
            toggle_sale_payment,
            delete_sale,
            get_sale_details,
            // Expenses
            add_expense,
            get_expenses,
            get_expenses_by_date_range,
            update_expense,
            delete_expense,
            // Dashboard
            dashboard_stats,
            // Database management
            reset_database,
            get_database_path,
            get_database_stats,
            // Export & Print
            export_history_csv,
            export_history_csv_with_dialog,
            create_database_backup,
            build_order_receipt_html,
            build_final_invoice_html,
            build_final_invoice_html_with_discount,
            print_order_receipt,
            // Settings
            set_tax_rate,
            get_tax_rate,
            set_tax_enabled,
            get_tax_enabled,
            set_currency_code,
            get_currency_code,
            set_locale,
            get_locale,
            set_business_name,
            get_business_name,
            set_business_mode,
            get_business_mode,
            // Backup & Reset
            backup_database,
            export_json_backup,
            restore_database_from_backup,
            select_backup_file,
            browse_backup_file,
            get_reset_security_question,
            validate_security_answer,
            reset_application_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
