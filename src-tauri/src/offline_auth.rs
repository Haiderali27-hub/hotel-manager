use rusqlite::{Connection, Result as SqliteResult};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use uuid::Uuid;
use chrono::{Utc, Duration};

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    pub session_token: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityQuestionResponse {
    pub success: bool,
    pub question: Option<String>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordResetRequest {
    pub username: String,
    pub security_answer: String,
    pub new_password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PasswordResetResponse {
    pub success: bool,
    pub message: String,
}

pub struct AuthManager {
    db_path: String,
}

impl AuthManager {
    pub fn new(db_path: &str) -> Self {
        Self {
            db_path: db_path.to_string(),
        }
    }

    fn get_connection(&self) -> SqliteResult<Connection> {
        Connection::open(&self.db_path)
    }

    fn hash_password_pbkdf2(&self, password: &str, salt: &str) -> String {
        let mut hasher = Sha256::new();
        
        // Simple PBKDF2-like implementation using multiple iterations
        let mut result = format!("{}{}", password, salt);
        for _ in 0..10000 {
            hasher.update(result.as_bytes());
            result = format!("{:x}", hasher.finalize_reset());
        }
        
        result
    }

    fn verify_password(&self, password: &str, stored_hash: &str, salt: &str) -> bool {
        let computed_hash = self.hash_password_pbkdf2(password, salt);
        computed_hash == stored_hash
    }

    fn verify_combined_hash(&self, input: &str, stored_combined: &str) -> bool {
        // Handle the format "hash:salt" that comes from JavaScript hashPassword function
        if let Some((stored_hash, stored_salt)) = stored_combined.split_once(':') {
            let computed_hash = self.hash_password_pbkdf2(input, stored_salt);
            computed_hash == stored_hash
        } else {
            false
        }
    }

    pub fn login(&self, request: LoginRequest) -> SqliteResult<LoginResponse> {
        let conn = self.get_connection()?;

        // Check if account is locked
        let locked_until: Option<String> = conn.query_row(
            "SELECT locked_until FROM admin_auth WHERE username = ?1",
            [&request.username],
            |row| row.get(0),
        ).unwrap_or(None);

        if let Some(locked_until_str) = locked_until {
            if let Ok(locked_until) = chrono::DateTime::parse_from_rfc3339(&locked_until_str) {
                if locked_until > Utc::now() {
                    self.log_security_event(&conn, &request.username, "login_attempt_while_locked")?;
                    return Ok(LoginResponse {
                        success: false,
                        message: "Account is temporarily locked due to multiple failed attempts".to_string(),
                        session_token: None,
                    });
                }
            }
        }

        // Get user credentials
        let user_result: Result<(String, String, i32), rusqlite::Error> = conn.query_row(
            "SELECT password_hash, salt, failed_attempts FROM admin_auth WHERE username = ?1",
            [&request.username],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        );

        match user_result {
            Ok((stored_hash, salt, failed_attempts)) => {
                if self.verify_password(&request.password, &stored_hash, &salt) {
                    // Successful login - reset failed attempts and clear lock
                    conn.execute(
                        "UPDATE admin_auth SET failed_attempts = 0, locked_until = NULL WHERE username = ?1",
                        [&request.username],
                    )?;

                    // Create session
                    let session_token = Uuid::new_v4().to_string();
                    let expires_at = Utc::now() + Duration::hours(8);

                    conn.execute(
                        "INSERT INTO admin_sessions (session_token, admin_id, expires_at) VALUES (?1, 1, ?2)",
                        [&session_token, &expires_at.to_rfc3339()],
                    )?;

                    self.log_security_event(&conn, &request.username, "successful_login")?;

                    Ok(LoginResponse {
                        success: true,
                        message: "Login successful".to_string(),
                        session_token: Some(session_token),
                    })
                } else {
                    // Failed login - increment failed attempts
                    let new_failed_attempts = failed_attempts + 1;
                    
                    if new_failed_attempts >= 5 {
                        // Lock account for 15 minutes
                        let lock_until = Utc::now() + Duration::minutes(15);
                        conn.execute(
                            "UPDATE admin_auth SET failed_attempts = ?1, locked_until = ?2 WHERE username = ?3",
                            [&new_failed_attempts.to_string(), &lock_until.to_rfc3339(), &request.username],
                        )?;
                        
                        self.log_security_event(&conn, &request.username, "account_locked_failed_attempts")?;
                        
                        Ok(LoginResponse {
                            success: false,
                            message: "Account locked due to multiple failed attempts. Try again in 15 minutes.".to_string(),
                            session_token: None,
                        })
                    } else {
                        conn.execute(
                            "UPDATE admin_auth SET failed_attempts = ?1 WHERE username = ?2",
                            [&new_failed_attempts.to_string(), &request.username],
                        )?;
                        
                        self.log_security_event(&conn, &request.username, "failed_login_attempt")?;
                        
                        Ok(LoginResponse {
                            success: false,
                            message: format!("Invalid credentials. {} attempts remaining.", 5 - new_failed_attempts),
                            session_token: None,
                        })
                    }
                }
            }
            Err(_) => {
                self.log_security_event(&conn, &request.username, "login_attempt_invalid_user")?;
                Ok(LoginResponse {
                    success: false,
                    message: "Invalid username or password".to_string(),
                    session_token: None,
                })
            }
        }
    }

    pub fn get_security_question(&self, username: &str) -> SqliteResult<SecurityQuestionResponse> {
        let conn = self.get_connection()?;

        let question_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT security_question FROM admin_auth WHERE username = ?1",
            [username],
            |row| row.get(0),
        );

        match question_result {
            Ok(question) => Ok(SecurityQuestionResponse {
                success: true,
                question: Some(question),
                message: "Security question retrieved successfully".to_string(),
            }),
            Err(_) => Ok(SecurityQuestionResponse {
                success: false,
                question: None,
                message: "Username not found".to_string(),
            }),
        }
    }

    pub fn reset_password(&self, request: PasswordResetRequest) -> SqliteResult<PasswordResetResponse> {
        let conn = self.get_connection()?;

        // Get security answer hash (stored in format "hash:salt")
        let stored_answer_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT security_answer_hash FROM admin_auth WHERE username = ?1",
            [&request.username],
            |row| row.get(0),
        );

        match stored_answer_result {
            Ok(stored_answer_hash) => {
                // Verify the security answer using the combined hash:salt format
                if self.verify_combined_hash(&request.security_answer, &stored_answer_hash) {
                    // Generate new salt and hash for the new password
                    let new_salt = Uuid::new_v4().to_string();
                    let password_hash = self.hash_password_pbkdf2(&request.new_password, &new_salt);

                    // Update password and reset failed attempts
                    conn.execute(
                        "UPDATE admin_auth SET password_hash = ?1, salt = ?2, failed_attempts = 0, locked_until = NULL WHERE username = ?3",
                        [&password_hash, &new_salt, &request.username],
                    )?;

                    self.log_security_event(&conn, &request.username, "password_reset_successful")?;

                    Ok(PasswordResetResponse {
                        success: true,
                        message: "Password reset successfully".to_string(),
                    })
                } else {
                    self.log_security_event(&conn, &request.username, "password_reset_failed_security_answer")?;
                    
                    Ok(PasswordResetResponse {
                        success: false,
                        message: "Incorrect security answer".to_string(),
                    })
                }
            }
            Err(_) => Ok(PasswordResetResponse {
                success: false,
                message: "Username not found".to_string(),
            }),
        }
    }

    pub fn validate_session(&self, session_token: &str) -> SqliteResult<bool> {
        let conn = self.get_connection()?;

        let expires_at_result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT expires_at FROM admin_sessions WHERE session_token = ?1",
            [session_token],
            |row| row.get(0),
        );

        match expires_at_result {
            Ok(expires_at_str) => {
                if let Ok(expires_at) = chrono::DateTime::parse_from_rfc3339(&expires_at_str) {
                    if expires_at > Utc::now() {
                        Ok(true)
                    } else {
                        // Session expired, remove it
                        conn.execute(
                            "DELETE FROM admin_sessions WHERE session_token = ?1",
                            [session_token],
                        )?;
                        Ok(false)
                    }
                } else {
                    Ok(false)
                }
            }
            Err(_) => Ok(false),
        }
    }

    pub fn logout(&self, session_token: &str) -> SqliteResult<()> {
        let conn = self.get_connection()?;
        conn.execute(
            "DELETE FROM admin_sessions WHERE session_token = ?1",
            [session_token],
        )?;
        Ok(())
    }

    pub fn cleanup_expired_sessions(&self) -> SqliteResult<()> {
        let conn = self.get_connection()?;
        let now = Utc::now().to_rfc3339();
        
        conn.execute(
            "DELETE FROM admin_sessions WHERE expires_at < ?1",
            [&now],
        )?;
        
        Ok(())
    }

    fn log_security_event(&self, conn: &Connection, username: &str, event_type: &str) -> SqliteResult<()> {
        let timestamp = Utc::now().to_rfc3339();
        
        conn.execute(
            "INSERT INTO audit_log (timestamp, username, event_type, ip_address, user_agent) VALUES (?1, ?2, ?3, 'localhost', 'Tauri App')",
            [&timestamp, username, event_type],
        )?;
        
        Ok(())
    }
}

// Tauri commands for the frontend
#[tauri::command]
pub async fn login_admin(request: LoginRequest) -> Result<LoginResponse, String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.login(request) {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn get_security_question(username: String) -> Result<SecurityQuestionResponse, String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.get_security_question(&username) {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn reset_admin_password(request: PasswordResetRequest) -> Result<PasswordResetResponse, String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.reset_password(request) {
        Ok(response) => Ok(response),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn validate_admin_session(session_token: String) -> Result<bool, String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.validate_session(&session_token) {
        Ok(is_valid) => Ok(is_valid),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn logout_admin(session_token: String) -> Result<(), String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.logout(&session_token) {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn cleanup_sessions() -> Result<(), String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    match auth_manager.cleanup_expired_sessions() {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

#[tauri::command]
pub async fn logout_all_sessions() -> Result<(), String> {
    let auth_manager = AuthManager::new("db/hotel.db");
    
    // Clear all active sessions for security when app closes
    match auth_manager.get_connection() {
        Ok(conn) => {
            match conn.execute("DELETE FROM admin_sessions", []) {
                Ok(_) => {
                    // Log the security event
                    let timestamp = Utc::now().to_rfc3339();
                    let _ = conn.execute(
                        "INSERT INTO audit_log (timestamp, username, event_type, ip_address, user_agent) VALUES (?1, 'admin', 'app_close_logout_all', 'localhost', 'Tauri App')",
                        [&timestamp],
                    );
                    Ok(())
                },
                Err(e) => Err(format!("Failed to clear sessions: {}", e)),
            }
        },
        Err(e) => Err(format!("Database connection error: {}", e)),
    }
}
