mod models;
mod db;
mod offline_auth;
mod simple_commands;
mod database_reset;
mod export;
mod print_templates;
mod validation;
mod settings;
mod store_profiles;

use tauri::Manager;
use db::initialize_database;
use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions, logout_all_sessions,
    check_is_setup, register_initial_admin, register_user, list_users, delete_user
};
use simple_commands::{
    add_room, get_rooms, get_available_rooms_for_guest, update_room, delete_room, cleanup_soft_deleted_rooms,
        add_guest, get_active_guests, get_all_guests, get_guest, checkout_guest, checkout_guest_with_discount, update_guest,
    add_menu_item, get_menu_items, update_menu_item, delete_menu_item,
    get_product_categories, add_product_category, rename_product_category, update_product_category, delete_product_category,
        dashboard_stats, get_low_stock_items, add_food_order, get_food_orders, get_food_orders_by_guest, mark_order_paid,
    add_expense, get_expenses, get_expenses_by_date_range, update_expense, delete_expense,
    toggle_food_order_payment, delete_food_order, get_order_details,
    set_tax_rate, get_tax_rate, set_tax_enabled, get_tax_enabled,
    set_barcode_enabled, get_barcode_enabled,
    set_currency_code, get_currency_code, set_locale, get_locale,
    set_business_name, get_business_name,
    open_shift, close_shift, get_current_shift, get_shift_history,
    // Generic alias commands
    add_resource, get_resources, get_available_resources_for_customer, update_resource, delete_resource,
    add_customer, get_active_customers, get_all_customers, get_customer, checkout_customer, checkout_customer_with_discount, update_customer,
    add_sale, get_sales, get_sales_by_customer, mark_sale_paid, toggle_sale_payment, delete_sale, get_sale_details,
    add_sale_payment, get_sale_payment_summary,
    // Returns / refunds
    get_sale_returnable_items, add_sale_return, get_sale_returns, get_sale_return_details,
    set_business_mode, get_business_mode,
    get_business_mode_status,
    // Suppliers & Purchases (Stock-In)
    add_supplier, get_suppliers, update_supplier, delete_supplier,
    add_purchase, get_purchases, get_purchase_details, delete_purchase,
    add_supplier_payment, get_supplier_payments, get_supplier_balance_summaries,
    // Accounts
    get_customer_balance_summaries, get_customer_sale_balances,
    // Stock adjustments
    add_stock_adjustment, get_stock_adjustments, get_stock_adjustment_details,
    // Loyalty system commands (Phase 5)
    get_loyalty_config, set_loyalty_config, award_loyalty_points, 
    get_customer_loyalty_points, redeem_loyalty_points, get_point_transactions
};
use database_reset::{reset_database, get_database_path, get_database_stats};
use export::{export_history_csv, export_history_csv_with_dialog, create_database_backup};
use print_templates::{
    build_kitchen_ticket_html,
    build_order_receipt_html,
    build_final_invoice_html,
    build_final_invoice_html_with_discount,
    print_order_receipt,
    build_sale_return_receipt_html,
    print_sale_return_receipt,
};
use settings::{
    backup_database, export_json_backup, restore_database_from_backup, get_reset_security_question, 
    validate_security_answer, reset_application_data, select_backup_file, browse_backup_file
};

use settings::{
    store_business_logo, get_business_logo_path,
    get_business_logo_data_url,
    set_primary_color, get_primary_color,
    set_receipt_header, get_receipt_header,
    set_receipt_footer, get_receipt_footer
};

use store_profiles::{
    list_store_profiles,
    get_active_store_profile,
    create_store_profile,
    set_active_store_profile,
    delete_store_profile,
    update_active_store_name,
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
            // Store profiles
            list_store_profiles,
            get_active_store_profile,
            create_store_profile,
            set_active_store_profile,
            delete_store_profile,
            update_active_store_name,
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
            register_user,
            list_users,
            delete_user,
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
            get_product_categories,
            add_product_category,
            rename_product_category,
            update_product_category,
            delete_product_category,
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
            add_sale_payment,
            get_sale_payment_summary,
                // Returns / refunds
                get_sale_returnable_items,
                add_sale_return,
                get_sale_returns,
                get_sale_return_details,
            // Suppliers & Purchases (Stock-In)
            add_supplier,
            get_suppliers,
            update_supplier,
            delete_supplier,
            add_purchase,
            get_purchases,
            get_purchase_details,
            delete_purchase,
            add_supplier_payment,
            get_supplier_payments,
            get_supplier_balance_summaries,
            // Accounts
            get_customer_balance_summaries,
            get_customer_sale_balances,
            // Stock adjustments
            add_stock_adjustment,
            get_stock_adjustments,
            get_stock_adjustment_details,
            // Expenses
            add_expense,
            get_expenses,
            get_expenses_by_date_range,
            update_expense,
            delete_expense,
            // Dashboard
            dashboard_stats,
            get_low_stock_items,
            // Database management
            reset_database,
            get_database_path,
            get_database_stats,
            // Export & Print
            export_history_csv,
            export_history_csv_with_dialog,
            create_database_backup,
            build_order_receipt_html,
            build_kitchen_ticket_html,
            build_final_invoice_html,
            build_final_invoice_html_with_discount,
            print_order_receipt,
            build_sale_return_receipt_html,
            print_sale_return_receipt,
            // Settings
            set_tax_rate,
            get_tax_rate,
            set_tax_enabled,
            get_tax_enabled,
            set_barcode_enabled,
            get_barcode_enabled,
            set_currency_code,
            get_currency_code,
            set_locale,
            get_locale,
            set_business_name,
            get_business_name,
            set_business_mode,
            get_business_mode,
            // Backup & Reset
            get_business_mode_status,
            backup_database,
            export_json_backup,
            restore_database_from_backup,
            select_backup_file,
            browse_backup_file,
            get_reset_security_question,
            validate_security_answer,
            reset_application_data
            ,
            // White-labeling (Phase 3)
            store_business_logo,
            get_business_logo_path,
            get_business_logo_data_url,
            set_primary_color,
            get_primary_color,
            set_receipt_header,
            get_receipt_header,
            set_receipt_footer,
            get_receipt_footer,
            // Shift management (Phase 4)
            open_shift,
            close_shift,
            get_current_shift,
            get_shift_history,
            // Loyalty system (Phase 5)
            get_loyalty_config,
            set_loyalty_config,
            award_loyalty_points,
            get_customer_loyalty_points,
            redeem_loyalty_points,
            get_point_transactions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
