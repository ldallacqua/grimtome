//! The in-game overlay: a small always-on-top, transparent window that never
//! takes focus from the game and can let mouse clicks pass through it.

use crate::error::AppResult;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};

static CLICK_THROUGH: AtomicBool = AtomicBool::new(false);

fn window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("overlay")
}

#[cfg(windows)]
fn hwnd(win: &WebviewWindow) -> Option<windows::Win32::Foundation::HWND> {
    // Go through the raw pointer so we do not depend on Tauri's own `windows` version.
    win.hwnd().ok().map(|h| windows::Win32::Foundation::HWND(h.0 as _))
}

/// One-time setup: tool window (no taskbar/Alt-Tab entry), never activated by
/// clicks, topmost, parked near the top-right corner of the primary monitor.
pub fn init(app: &AppHandle) -> AppResult<()> {
    let Some(win) = window(app) else { return Ok(()) };
    #[cfg(windows)]
    if let Some(h) = hwnd(&win) {
        use windows::Win32::UI::WindowsAndMessaging::{
            GetWindowLongPtrW, SetWindowLongPtrW, GWL_EXSTYLE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TOPMOST,
        };
        unsafe {
            let ex = GetWindowLongPtrW(h, GWL_EXSTYLE);
            SetWindowLongPtrW(
                h,
                GWL_EXSTYLE,
                ex | (WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0 | WS_EX_TOPMOST.0) as isize,
            );
        }
    }
    if let Ok(Some(m)) = win.primary_monitor() {
        let scale = m.scale_factor();
        let (pos, size) = (m.position(), m.size());
        let x = pos.x + size.width as i32 - ((340.0 + 32.0) * scale) as i32;
        let y = pos.y + (120.0 * scale) as i32;
        let _ = win.set_position(PhysicalPosition::new(x, y));
    }
    Ok(())
}

/// Shows the overlay without activating it, so the game keeps keyboard focus.
pub fn show(app: &AppHandle, visible: bool) -> AppResult<()> {
    let Some(win) = window(app) else { return Ok(()) };
    if !visible {
        win.hide()?;
        return Ok(());
    }
    #[cfg(windows)]
    if let Some(h) = hwnd(&win) {
        use windows::Win32::UI::WindowsAndMessaging::{
            SetWindowPos, ShowWindow, HWND_TOPMOST, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SW_SHOWNOACTIVATE,
        };
        unsafe {
            let _ = ShowWindow(h, SW_SHOWNOACTIVATE);
            let _ = SetWindowPos(h, Some(HWND_TOPMOST), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE);
        }
        return Ok(());
    }
    #[allow(unreachable_code)]
    {
        win.show()?;
        Ok(())
    }
}

pub fn toggle(app: &AppHandle) {
    if let Some(win) = window(app) {
        let visible = win.is_visible().unwrap_or(false);
        let _ = show(app, !visible);
    }
}

pub fn set_click_through(app: &AppHandle, enabled: bool) -> AppResult<()> {
    if let Some(win) = window(app) {
        win.set_ignore_cursor_events(enabled)?;
    }
    CLICK_THROUGH.store(enabled, Ordering::SeqCst);
    let _ = app.emit("overlay://click-through", enabled);
    Ok(())
}

pub fn toggle_click_through(app: &AppHandle) {
    let next = !CLICK_THROUGH.load(Ordering::SeqCst);
    let _ = set_click_through(app, next);
}

#[tauri::command]
pub fn overlay_show(app: AppHandle, visible: bool) -> AppResult<()> {
    show(&app, visible)
}

#[tauri::command]
pub fn overlay_click_through(app: AppHandle, enabled: bool) -> AppResult<()> {
    set_click_through(&app, enabled)
}
