//! System-wide hotkeys (RegisterHotKey under the hood). They work while the game
//! has focus and only trigger Grimtome's own actions — nothing is sent to the game.

use crate::error::AppResult;
use crate::{overlay, scan};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HotkeyMap {
    scan: String,
    toggle_overlay: String,
    click_through: String,
}

#[derive(Debug, Serialize)]
pub struct ApplyResult {
    failed: Vec<String>,
}

#[tauri::command]
pub fn hotkeys_apply(app: AppHandle, map: HotkeyMap) -> AppResult<ApplyResult> {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let actions: [(&str, fn(&AppHandle)); 3] = [
        (map.scan.as_str(), scan::scan_from_hotkey),
        (map.toggle_overlay.as_str(), overlay::toggle),
        (map.click_through.as_str(), overlay::toggle_click_through),
    ];
    let mut failed = Vec::new();
    for (accel, action) in actions {
        if accel.trim().is_empty() {
            continue;
        }
        let registered = accel.parse::<Shortcut>().map_err(|e| e.to_string()).and_then(|sc| {
            gs.on_shortcut(sc, move |app, _sc, event| {
                if event.state == ShortcutState::Pressed {
                    action(app);
                }
            })
            .map_err(|e| e.to_string())
        });
        if registered.is_err() {
            failed.push(accel.to_string());
        }
    }
    Ok(ApplyResult { failed })
}
