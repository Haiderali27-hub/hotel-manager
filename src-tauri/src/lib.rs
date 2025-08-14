mod offline_auth;
mod database;

use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions, logout_all_sessions
};

use database::{
    get_dashboard_stats, get_all_guests, add_guest, edit_guest, checkout_guest,
    get_all_rooms, add_room, edit_room, delete_room,
    get_all_menu_items, add_menu_item, edit_menu_item, delete_menu_item,
    get_all_orders, add_order, update_order_status,
    add_revenue, add_expense, get_financial_summary
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            login_admin,
            get_security_question, 
            reset_admin_password,
            validate_admin_session,
            logout_admin,
            cleanup_sessions,
            logout_all_sessions,
            get_dashboard_stats,
            get_all_guests,
            add_guest,
            edit_guest,
            checkout_guest,
            get_all_rooms,
            add_room,
            edit_room,
            delete_room,
            get_all_menu_items,
            add_menu_item,
            edit_menu_item,
            delete_menu_item,
            get_all_orders,
            add_order,
            update_order_status,
            add_revenue,
            add_expense,
            get_financial_summary
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
