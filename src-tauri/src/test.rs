use tauri::command;

#[command]
pub fn test_command() -> String {
    "Hello from Rust!".to_string()
}
