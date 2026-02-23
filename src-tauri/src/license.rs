/// INERTIA License Engine
/// 
/// License key format: INERTIA-V{MAJOR}-{ENCODED}
///   where ENCODED = base64( business_name | machine_id | major | checksum )
///   checksum = sha256( secret_salt + business_name + machine_id + major )[0..8]
///
/// Trial: 14 days from first launch (stored in DB and a hidden marker file).
/// After trial expiry the app is locked until a valid key is activated.
/// Minor updates (same major version) are always free.
/// Major version bump requires a new key (paid upgrade).

use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rusqlite::{Connection, OptionalExtension};
use sha2::{Digest, Sha256};
use std::path::PathBuf;

// ── constants ──────────────────────────────────────────────────────────────
/// Change this when you release a breaking / major version.
pub const APP_MAJOR_VERSION: u32 = 1;
/// Keep this secret — bake a real random string here before shipping.
const LICENSE_SECRET: &str = "xK9$mP2#vL8@nQ5&wR3!jT7^hY4*cZ6";
/// Trial length in days.
const TRIAL_DAYS: i64 = 14;

// ── public types ────────────────────────────────────────────────────────────
#[derive(Debug, serde::Serialize, serde::Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    /// Still within free trial.
    Trial,
    /// Trial ended, no valid key.
    Expired,
    /// Valid key activated for current major version.
    Licensed,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct LicenseInfo {
    pub status: LicenseStatus,
    /// Days remaining in trial (0 if not in trial).
    pub trial_days_left: i64,
    /// Business name from the activated key (empty if not licensed).
    pub licensed_to: String,
    /// Which major version this key is for.
    pub key_major_version: u32,
    /// Current app major version.
    pub app_major_version: u32,
    /// True when a valid key exists but it's for an older major version
    /// (user needs to upgrade their key for the new major version).
    pub needs_upgrade: bool,
}

// ── machine fingerprint ─────────────────────────────────────────────────────
/// Returns a stable machine ID stored in the database.
fn get_or_create_machine_id(conn: &Connection) -> Result<String, String> {
    ensure_license_table(conn)?;
    let existing: Option<String> = conn
        .query_row(
            "SELECT value FROM license_store WHERE key = 'machine_id'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(id) = existing {
        return Ok(id);
    }

    // Generate a new machine id from hostname + a uuid
    let host = hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "unknown".to_string());
    let uid = uuid::Uuid::new_v4().to_string();
    let raw = format!("{}-{}", host, uid);
    let mut hasher = Sha256::new();
    hasher.update(raw.as_bytes());
    let machine_id = format!("{:x}", hasher.finalize())[..24].to_string();

    conn.execute(
        "INSERT OR REPLACE INTO license_store (key, value) VALUES ('machine_id', ?1)",
        rusqlite::params![machine_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(machine_id)
}

// ── trial management ─────────────────────────────────────────────────────────
fn get_or_init_trial_start(conn: &Connection) -> Result<i64, String> {
    ensure_license_table(conn)?;
    let existing: Option<i64> = conn
        .query_row(
            "SELECT CAST(value AS INTEGER) FROM license_store WHERE key = 'trial_start_unix'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some(ts) = existing {
        return Ok(ts);
    }

    let now = chrono::Utc::now().timestamp();
    conn.execute(
        "INSERT OR REPLACE INTO license_store (key, value) VALUES ('trial_start_unix', ?1)",
        rusqlite::params![now.to_string()],
    )
    .map_err(|e| e.to_string())?;

    // Also write a hidden marker file as secondary tamper evidence
    if let Some(path) = marker_file_path() {
        let _ = std::fs::write(&path, now.to_string());
    }

    Ok(now)
}

fn trial_start_from_file() -> Option<i64> {
    let path = marker_file_path()?;
    let contents = std::fs::read_to_string(path).ok()?;
    contents.trim().parse::<i64>().ok()
}

fn marker_file_path() -> Option<PathBuf> {
    // Store as a hidden dot-file inside the app data directory
    let mut base = dirs::data_local_dir()?;
    base.push(".inertia_lic");
    Some(base)
}

fn trial_days_left(trial_start: i64) -> i64 {
    let now = chrono::Utc::now().timestamp();
    let elapsed_days = (now - trial_start) / 86_400;
    (TRIAL_DAYS - elapsed_days).max(0)
}

fn is_trial_active(trial_start: i64) -> bool {
    trial_days_left(trial_start) > 0
}

// ── key generation (server-side helper, same algorithm) ─────────────────────
/// Generate a license key for a customer. Call this from your admin tool / backend.
/// In practice you'd run this on your server after payment confirmation.
pub fn generate_license_key(business_name: &str, major_version: u32) -> String {
    // We don't need machine_id at generation time — key is name+version based.
    // Activation binds it to a machine by storing activation locally.
    let checksum = compute_checksum(business_name, major_version);
    let payload = format!("{}|{}|{}", business_name, major_version, checksum);
    let encoded = URL_SAFE_NO_PAD.encode(payload.as_bytes());
    format!("INERTIA-V{}-{}", major_version, encoded)
}

fn compute_checksum(business_name: &str, major_version: u32) -> String {
    let mut hasher = Sha256::new();
    hasher.update(LICENSE_SECRET.as_bytes());
    hasher.update(b"|");
    hasher.update(business_name.as_bytes());
    hasher.update(b"|");
    hasher.update(major_version.to_string().as_bytes());
    let result = hasher.finalize();
    format!("{:x}", result)[..12].to_string()
}

// ── key validation ───────────────────────────────────────────────────────────
#[derive(Debug)]
struct ParsedKey {
    business_name: String,
    major_version: u32,
}

fn parse_license_key(key: &str) -> Result<ParsedKey, String> {
    let key = key.trim();

    // Format: INERTIA-V{N}-{ENCODED}
    // Split into exactly 3 parts — the encoded section may contain padding chars
    let parts: Vec<&str> = key.splitn(3, '-').collect();
    if parts.len() != 3
        || parts[0].to_uppercase() != "INERTIA"
        || !parts[1].to_uppercase().starts_with('V')
    {
        return Err("Invalid license key format".to_string());
    }

    let major_version: u32 = parts[1][1..]
        .parse()
        .map_err(|_| "Invalid version in key".to_string())?;

    // Decode the original-case base64 section (do NOT uppercase — base64 is case-sensitive)
    let decoded = URL_SAFE_NO_PAD
        .decode(parts[2].as_bytes())
        .map_err(|_| "Could not decode license key".to_string())?;

    let payload = String::from_utf8(decoded)
        .map_err(|_| "Malformed license key payload".to_string())?;

    let segments: Vec<&str> = payload.splitn(3, '|').collect();
    if segments.len() != 3 {
        return Err("Corrupt license key".to_string());
    }

    let business_name = segments[0].to_string();
    let key_major: u32 = segments[1]
        .parse()
        .map_err(|_| "Invalid version in payload".to_string())?;
    let stored_checksum = segments[2];

    if key_major != major_version {
        return Err("Tampered key (version mismatch)".to_string());
    }

    let expected = compute_checksum(&business_name, major_version);
    if expected != stored_checksum {
        return Err("Invalid license key (checksum failed)".to_string());
    }

    Ok(ParsedKey { business_name, major_version })
}

// ── DB helpers ───────────────────────────────────────────────────────────────
fn ensure_license_table(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS license_store (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );",
    )
    .map_err(|e| e.to_string())
}

fn get_stored_license(conn: &Connection) -> Result<Option<ParsedKey>, String> {
    ensure_license_table(conn)?;
    let key_str: Option<String> = conn
        .query_row(
            "SELECT value FROM license_store WHERE key = 'license_key'",
            [],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    match key_str {
        Some(k) => parse_license_key(&k).map(Some),
        None => Ok(None),
    }
}

// ── public Tauri commands ────────────────────────────────────────────────────

#[tauri::command]
pub fn get_license_info() -> Result<LicenseInfo, String> {
    let conn = crate::db::get_db_connection().map_err(|e| e.to_string())?;
    ensure_license_table(&conn)?;

    // Check for existing valid key first
    if let Some(parsed) = get_stored_license(&conn)? {
        if parsed.major_version == APP_MAJOR_VERSION {
            return Ok(LicenseInfo {
                status: LicenseStatus::Licensed,
                trial_days_left: 0,
                licensed_to: parsed.business_name,
                key_major_version: parsed.major_version,
                app_major_version: APP_MAJOR_VERSION,
                needs_upgrade: false,
            });
        } else {
            // Key exists but for wrong major version
            let trial_start = get_or_init_trial_start(&conn)?;
            let days_left = trial_days_left(trial_start);
            return Ok(LicenseInfo {
                status: if days_left > 0 { LicenseStatus::Trial } else { LicenseStatus::Expired },
                trial_days_left: days_left,
                licensed_to: parsed.business_name,
                key_major_version: parsed.major_version,
                app_major_version: APP_MAJOR_VERSION,
                needs_upgrade: true,
            });
        }
    }

    // No key — check trial
    let trial_start = get_or_init_trial_start(&conn)?;

    // Cross-check with file to detect clock manipulation
    let file_start = trial_start_from_file().unwrap_or(trial_start);
    // Use the EARLIER timestamp (most restrictive)
    let effective_start = trial_start.min(file_start);
    let days_left = trial_days_left(effective_start);

    Ok(LicenseInfo {
        status: if days_left > 0 { LicenseStatus::Trial } else { LicenseStatus::Expired },
        trial_days_left: days_left,
        licensed_to: String::new(),
        key_major_version: 0,
        app_major_version: APP_MAJOR_VERSION,
        needs_upgrade: false,
    })
}

#[tauri::command]
pub fn activate_license(key: String) -> Result<LicenseInfo, String> {
    let conn = crate::db::get_db_connection().map_err(|e| e.to_string())?;
    ensure_license_table(&conn)?;

    let parsed = parse_license_key(&key)?;

    // Store the key
    conn.execute(
        "INSERT OR REPLACE INTO license_store (key, value) VALUES ('license_key', ?1)",
        rusqlite::params![key.trim()],
    )
    .map_err(|e| e.to_string())?;

    let needs_upgrade = parsed.major_version != APP_MAJOR_VERSION;
    let status = if needs_upgrade {
        // Still in trial or expired for the new version
        let trial_start = get_or_init_trial_start(&conn)?;
        let days_left = trial_days_left(trial_start);
        if days_left > 0 { LicenseStatus::Trial } else { LicenseStatus::Expired }
    } else {
        LicenseStatus::Licensed
    };

    let trial_days_left = if status == LicenseStatus::Trial {
        let trial_start = get_or_init_trial_start(&conn)?;
        trial_days_left(trial_start)
    } else {
        0
    };

    Ok(LicenseInfo {
        status,
        trial_days_left,
        licensed_to: parsed.business_name,
        key_major_version: parsed.major_version,
        app_major_version: APP_MAJOR_VERSION,
        needs_upgrade,
    })
}

#[tauri::command]
pub fn deactivate_license() -> Result<String, String> {
    let conn = crate::db::get_db_connection().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM license_store WHERE key = 'license_key'",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok("License removed".to_string())
}

/// Admin-only: generate a key locally (for testing or offline issuance).
/// Use the private Node.js script (scripts/generate-key.cjs) instead — never ship this as a Tauri command.
pub fn generate_key_local(business_name: String, major_version: u32) -> Result<String, String> {
    if business_name.trim().is_empty() {
        return Err("Business name required".to_string());
    }
    Ok(generate_license_key(business_name.trim(), major_version))
}
