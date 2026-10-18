//! Local game asset importer commands.
//!
//! The import is opt-in (Settings → Game assets, after a consent dialog), reads the
//! user's own Diablo IV installation read-only and writes PNGs plus a manifest to
//! `%LOCALAPPDATA%\app.grimtome.desktop\assets\current`. Nothing is uploaded or bundled.

use crate::error::{AppError, AppResult};
use crate::paths;
use d4data::catalog::GameData;
use d4data::install::{self, Installation, Source};
use d4data::storage::StaticStorage;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::time::Instant;
use tauri::{AppHandle, Emitter};
use tauri_plugin_opener::OpenerExt;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RawAssetStatus {
    root: Option<String>,
    manifest: Option<String>,
    catalog: Option<String>,
    user_manifest: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportSummary {
    assets: usize,
    failures: Vec<String>,
    game_build: Option<String>,
    elapsed_ms: u128,
}

fn read_opt(path: PathBuf) -> Option<String> {
    std::fs::read_to_string(path).ok()
}

/// Raw JSON documents of the cache; the UI parses and validates them.
#[tauri::command]
pub fn assets_status(app: AppHandle) -> RawAssetStatus {
    let (cache, user) = match (paths::asset_cache(&app), paths::user_assets(&app)) {
        (Ok(c), Ok(u)) => (c, u),
        (Err(e), _) | (_, Err(e)) => {
            return RawAssetStatus {
                root: None,
                manifest: None,
                catalog: None,
                user_manifest: None,
                error: Some(e.to_string()),
            }
        }
    };
    let manifest = read_opt(cache.join("manifest.json"));
    RawAssetStatus {
        root: manifest.as_ref().map(|_| cache.display().to_string()),
        catalog: read_opt(cache.join("catalog.json")),
        manifest,
        user_manifest: read_opt(user.join("manifest.json")),
        error: None,
    }
}

#[tauri::command]
pub fn assets_detect() -> Vec<Installation> {
    install::detect()
}

#[tauri::command]
pub fn assets_inspect(path: String) -> Option<Installation> {
    install::inspect(&PathBuf::from(path), Source::Manual)
}

#[tauri::command]
pub async fn assets_import(app: AppHandle, path: Option<String>, locale: String) -> AppResult<ImportSummary> {
    let out = paths::asset_cache(&app)?;
    tauri::async_runtime::spawn_blocking(move || -> AppResult<ImportSummary> {
        let t0 = Instant::now();
        let inst = match path {
            Some(p) => install::inspect(&PathBuf::from(p), Source::Manual),
            None => install::detect().into_iter().find(|i| i.is_supported()),
        }
        .ok_or_else(|| AppError::msg("No Diablo IV installation found at that location."))?;
        if !inst.is_supported() {
            return Err(AppError::msg(
                "This installation uses a storage layout Grimtome cannot read yet (Steam installs are supported).",
            ));
        }
        let locale =
            if locale.chars().all(|c| c.is_ascii_alphanumeric()) && locale.len() == 4 { locale } else { "enUS".into() };
        let emit = |stage: &'static str, done: usize, total: usize| {
            let _ = app.emit("assets://progress", serde_json::json!({ "stage": stage, "done": done, "total": total }));
        };
        emit("reading", 0, 1);
        let storage = StaticStorage::open(&inst.data_dir)?;
        let game = GameData::open(storage, &locale)?;
        emit("catalog", 0, 1);
        let (catalog, jobs) = game.build_catalog(inst.build.clone())?;
        let cancel = AtomicBool::new(false);
        let manifest =
            d4data::export::export(&game, &catalog, &jobs, &out, &|p| emit(p.stage, p.done, p.total), &cancel)?;
        Ok(ImportSummary {
            assets: manifest.assets.len(),
            failures: manifest.failures,
            game_build: manifest.game_build,
            elapsed_ms: t0.elapsed().as_millis(),
        })
    })
    .await
    .map_err(|e| AppError::msg(e.to_string()))?
}

#[tauri::command]
pub fn assets_clear(app: AppHandle) -> AppResult<()> {
    let dir = paths::asset_cache(&app)?;
    if dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

#[tauri::command]
pub fn assets_reveal(app: AppHandle) -> AppResult<()> {
    let dir = paths::asset_cache(&app)?;
    let target = if dir.exists() { dir } else { paths::local_root(&app)? };
    std::fs::create_dir_all(&target)?;
    app.opener().open_path(target.display().to_string(), None::<&str>).map_err(|e| AppError::msg(e.to_string()))
}
