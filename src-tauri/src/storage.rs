//! Key/value persistence for the web UI: one JSON document per key in the app data
//! folder. The UI owns the schema (versioned and validated in `persistence.ts`).

use crate::error::{AppError, AppResult};
use crate::paths;
use std::path::PathBuf;
use tauri::AppHandle;

fn key_path(app: &AppHandle, key: &str) -> AppResult<PathBuf> {
    let valid = !key.is_empty()
        && key.len() <= 64
        && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
        && !key.starts_with('.');
    if !valid {
        return Err(AppError::msg(format!("invalid storage key: {key:?}")));
    }
    Ok(paths::storage_dir(app)?.join(format!("{key}.json")))
}

#[tauri::command]
pub fn storage_read(app: AppHandle, key: String) -> AppResult<Option<String>> {
    let path = key_path(&app, &key)?;
    match std::fs::read_to_string(path) {
        Ok(s) => Ok(Some(s)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.into()),
    }
}

#[tauri::command]
pub fn storage_write(app: AppHandle, key: String, value: String) -> AppResult<()> {
    paths::write_atomic(&key_path(&app, &key)?, value.as_bytes())
}

#[tauri::command]
pub fn storage_clear(app: AppHandle) -> AppResult<()> {
    let dir = paths::storage_dir(&app)?;
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

#[tauri::command]
pub fn storage_location(app: AppHandle) -> AppResult<String> {
    Ok(paths::storage_dir(&app)?.display().to_string())
}
