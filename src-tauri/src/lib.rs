//! Grimtome desktop host.
//!
//! Everything here works from outside the game: screen pixels (GDI), Windows OCR,
//! system hotkeys, a separate overlay window and a read-only asset importer. It
//! never reads game memory, injects code, touches game files or network traffic,
//! or sends input to the game.

#![allow(clippy::type_complexity)]

mod assets;
mod capture;
mod error;
mod hotkeys;
mod ocr;
mod overlay;
mod paths;
pub mod scan;
mod storage;
pub mod tooltip;

pub use error::{AppError, AppResult};
use tauri::{Emitter, Manager};

/// Quits after the UI has flushed its state (see the close handshake in `run`).
#[tauri::command]
fn app_exit(app: tauri::AppHandle) {
    app.exit(0);
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::new().with_denylist(&["overlay"]).build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(scan::CaptureState::default())
        .setup(|app| {
            overlay::init(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the main window quits the app, overlay included. The UI gets
            // a moment to save pending state first (it calls `app_exit` when done).
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let app = window.app_handle().clone();
                    let _ = app.emit_to("main", "app://close-requested", ());
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(2));
                        app.exit(0);
                    });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            storage::storage_read,
            storage::storage_write,
            storage::storage_clear,
            storage::storage_location,
            assets::assets_status,
            assets::assets_detect,
            assets::assets_inspect,
            assets::assets_import,
            assets::assets_clear,
            assets::assets_reveal,
            scan::capture_configure,
            scan::scan_capture,
            scan::ocr_image,
            scan::ocr_languages,
            overlay::overlay_show,
            overlay::overlay_click_through,
            hotkeys::hotkeys_apply,
            app_exit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Grimtome");
}
