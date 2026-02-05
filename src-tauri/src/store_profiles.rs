use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProfile {
    pub id: String,
    pub name: String,
    /// RFC3339 string
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoreProfilesStatus {
    pub active_profile_id: String,
    pub profiles: Vec<StoreProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct StoreProfilesState {
    active_profile_id: String,
    profiles: Vec<StoreProfile>,
}

fn app_root_dir() -> Result<PathBuf, String> {
    dirs::data_local_dir()
        .ok_or_else(|| "Failed to get app data directory".to_string())
        .map(|d| d.join("hotel-app"))
}

fn profiles_file_path() -> Result<PathBuf, String> {
    Ok(app_root_dir()?.join("profiles.json"))
}

fn stores_root_dir() -> Result<PathBuf, String> {
    Ok(app_root_dir()?.join("stores"))
}

fn store_dir(profile_id: &str) -> Result<PathBuf, String> {
    Ok(stores_root_dir()?.join(profile_id))
}

fn store_db_path(profile_id: &str) -> Result<PathBuf, String> {
    Ok(store_dir(profile_id)?.join("store.db"))
}

fn write_json_atomic(path: &Path, json: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory {}: {}", parent.display(), e))?;
    }

    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("Failed to write {}: {}", tmp.display(), e))?;
    fs::rename(&tmp, path).map_err(|e| format!("Failed to write {}: {}", path.display(), e))?;
    Ok(())
}

fn legacy_project_db_path() -> Option<PathBuf> {
    let mut path = std::env::current_dir().ok()?;
    if path.ends_with("src-tauri") {
        path = path.parent()?.to_path_buf();
    }
    path.push("db");
    path.push("hotel.db");
    Some(path)
}

fn maybe_migrate_legacy_db(target_db_path: &Path) {
    if target_db_path.exists() {
        return;
    }

    let Some(legacy) = legacy_project_db_path() else {
        return;
    };

    if !legacy.exists() {
        return;
    }

    if let Some(parent) = target_db_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    if let Err(e) = fs::copy(&legacy, target_db_path) {
        eprintln!(
            "[store_profiles] Failed to migrate legacy db {} -> {}: {}",
            legacy.display(),
            target_db_path.display(),
            e
        );
    } else {
        println!(
            "[store_profiles] Migrated legacy db {} -> {}",
            legacy.display(),
            target_db_path.display()
        );
    }
}

fn load_state() -> Result<StoreProfilesState, String> {
    let file_path = profiles_file_path()?;
    if !file_path.exists() {
        return Err("Profiles not initialized".to_string());
    }

    let raw = fs::read_to_string(&file_path)
        .map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;

    serde_json::from_str::<StoreProfilesState>(&raw)
        .map_err(|e| format!("Failed to parse profiles.json: {}", e))
}

fn ensure_state() -> Result<StoreProfilesState, String> {
    match load_state() {
        Ok(state) => Ok(state),
        Err(_) => {
            // Create a minimal default profile silently on first launch
            let id = Uuid::new_v4().to_string();
            let profile = StoreProfile {
                id: id.clone(),
                name: "My Business".to_string(),
                created_at: chrono::Utc::now().to_rfc3339(),
            };

            let mut state = StoreProfilesState {
                active_profile_id: id.clone(),
                profiles: vec![profile],
            };

            // Ensure store db folder exists (and migrate legacy db if present)
            let db_path = store_db_path(&id)?;
            maybe_migrate_legacy_db(&db_path);

            persist_state(&state)?;
            // Reload once to ensure we read from disk format
            state = load_state()?;
            Ok(state)
        }
    }
}

/// Update the active store profile name (called after setup wizard completes)
#[tauri::command]
pub fn update_active_store_name(name: String) -> Result<StoreProfile, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Store name is required".to_string());
    }

    let mut state = ensure_state()?;
    let active_id = state.active_profile_id.clone();
    
    if let Some(profile) = state.profiles.iter_mut().find(|p| p.id == active_id) {
        profile.name = trimmed.to_string();
        let updated_profile = profile.clone();
        persist_state(&state)?;
        Ok(updated_profile)
    } else {
        Err("Active store profile not found".to_string())
    }
}

fn persist_state(state: &StoreProfilesState) -> Result<(), String> {
    let file_path = profiles_file_path()?;
    let json = serde_json::to_string_pretty(state)
        .map_err(|e| format!("Failed to serialize profiles: {}", e))?;
    write_json_atomic(&file_path, &json)
}

pub fn get_active_store_db_path() -> Result<PathBuf, String> {
    let state = ensure_state()?;
    let db_path = store_db_path(&state.active_profile_id)?;

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory {}: {}", parent.display(), e))?;
    }

    Ok(db_path)
}

fn to_status(state: &StoreProfilesState) -> StoreProfilesStatus {
    StoreProfilesStatus {
        active_profile_id: state.active_profile_id.clone(),
        profiles: state.profiles.clone(),
    }
}

#[tauri::command]
pub fn list_store_profiles() -> Result<StoreProfilesStatus, String> {
    let state = ensure_state()?;
    Ok(to_status(&state))
}

#[tauri::command]
pub fn get_active_store_profile() -> Result<StoreProfile, String> {
    let state = ensure_state()?;
    state
        .profiles
        .iter()
        .find(|p| p.id == state.active_profile_id)
        .cloned()
        .ok_or_else(|| "Active store profile not found".to_string())
}

#[tauri::command]
pub fn create_store_profile(name: String) -> Result<StoreProfilesStatus, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Store name is required".to_string());
    }

    let mut state = ensure_state()?;
    let id = Uuid::new_v4().to_string();

    let profile = StoreProfile {
        id: id.clone(),
        name: trimmed.to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    state.profiles.push(profile);
    state.active_profile_id = id.clone();

    // Create store directory eagerly
    let db_path = store_db_path(&id)?;
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory {}: {}", parent.display(), e))?;
    }

    persist_state(&state)?;
    Ok(to_status(&state))
}

#[tauri::command]
pub fn set_active_store_profile(profile_id: String) -> Result<StoreProfilesStatus, String> {
    let mut state = ensure_state()?;

    let exists = state.profiles.iter().any(|p| p.id == profile_id);
    if !exists {
        return Err("Store profile not found".to_string());
    }

    state.active_profile_id = profile_id.clone();

    let db_path = store_db_path(&profile_id)?;
    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create store directory {}: {}", parent.display(), e))?;
    }

    persist_state(&state)?;
    Ok(to_status(&state))
}

#[tauri::command]
pub fn delete_store_profile(profile_id: String) -> Result<StoreProfilesStatus, String> {
    let mut state = ensure_state()?;

    if state.profiles.len() <= 1 {
        return Err("Cannot delete the last store profile".to_string());
    }

    let before_len = state.profiles.len();
    state.profiles.retain(|p| p.id != profile_id);
    if state.profiles.len() == before_len {
        return Err("Store profile not found".to_string());
    }

    if state.active_profile_id == profile_id {
        state.active_profile_id = state
            .profiles
            .first()
            .map(|p| p.id.clone())
            .ok_or_else(|| "No remaining store profiles".to_string())?;
    }

    // Best-effort delete store directory
    if let Ok(dir) = store_dir(&profile_id) {
        let _ = fs::remove_dir_all(dir);
    }

    persist_state(&state)?;
    Ok(to_status(&state))
}
