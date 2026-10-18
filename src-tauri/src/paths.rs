use crate::error::{AppError, AppResult};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// `%LOCALAPPDATA%\Grimtome` — machine-local data that is never synced or uploaded.
pub fn local_root(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().local_data_dir()?.join("Grimtome"))
}

/// The imported game asset cache. Must match `assetProtocol.scope` in tauri.conf.json
/// and the default output of `grimtome-extract`.
pub fn asset_cache(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(local_root(app)?.join("assets").join("current"))
}

/// Optional user-provided asset pack (same manifest format, never shipped).
pub fn user_assets(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(local_root(app)?.join("assets").join("user"))
}

/// Persisted app state (builds, progress, settings, scan history).
pub fn storage_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(app.path().app_data_dir()?.join("storage"))
}

/// Writes through a temporary sibling and renames, so a crash never leaves a torn file.
pub fn write_atomic(path: &std::path::Path, bytes: &[u8]) -> AppResult<()> {
    let parent = path.parent().ok_or_else(|| AppError::msg("invalid path"))?;
    std::fs::create_dir_all(parent)?;
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}
