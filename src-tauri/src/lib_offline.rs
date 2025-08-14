mod offline_auth;

use offline_auth::{
    login_admin, get_security_question, reset_admin_password,
    validate_admin_session, logout_admin, cleanup_sessions
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            login_admin,
            get_security_question, 
            reset_admin_password,
            validate_admin_session,
            logout_admin,
            cleanup_sessions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
