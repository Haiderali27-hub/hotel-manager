mod offline_auth;
mod database;

use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions, logout_all_sessions
};

use database::{
    get_dashboard_stats, get_all_guests, add_guest, update_guest, delete_guest,
    get_all_orders, add_order, add_revenue, add_expense, get_financial_summary,
    authenticate_admin, verify_otp
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
            update_guest,
            delete_guest,
            get_all_orders,
            add_order,
            add_revenue,
            add_expense,
            get_financial_summary,
            authenticate_admin,
            verify_otp
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
