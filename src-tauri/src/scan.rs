//! The scan pipeline: capture → first OCR pass on the screen → find the tooltip →
//! second OCR pass on the (upscaled) tooltip with text and bullet colors.
//!
//! The UI parses and evaluates the lines; this module only turns pixels into text.

use crate::capture::{self, ScreenRect};
use crate::error::{AppError, AppResult};
use crate::ocr;
use crate::tooltip::{self, Rect, Region, TextLine};
use base64::Engine;
use image::{imageops, RgbaImage};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State};

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct RegionPx {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
pub struct SizePx {
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CaptureSettings {
    #[serde(default = "default_mode")]
    pub mode: String,
    #[serde(default)]
    pub region: Option<RegionPx>,
    #[serde(default)]
    pub cursor_box: Option<SizePx>,
    #[serde(default)]
    pub language: Option<String>,
    /// In-app "Scan" button: wait this long (with the window minimized) so the
    /// player can hover the item in game.
    #[serde(default)]
    pub delay_ms: Option<u64>,
}

fn default_mode() -> String {
    "smart".into()
}

impl Default for CaptureSettings {
    fn default() -> Self {
        Self { mode: default_mode(), region: None, cursor_box: None, language: None, delay_ms: None }
    }
}

/// Latest capture settings from the UI, used by the global hotkey.
#[derive(Default)]
pub struct CaptureState(pub Mutex<CaptureSettings>);

static SCANNING: AtomicBool = AtomicBool::new(false);

#[derive(Debug, Clone, Serialize)]
pub struct BBox {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrLineOut {
    text: String,
    bbox: BBox,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    icon_color: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageSize {
    w: u32,
    h: u32,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OcrResultOut {
    lines: Vec<OcrLineOut>,
    engine: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    language: Option<String>,
    elapsed_ms: u128,
    image_size: ImageSize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanPayload {
    ocr: OcrResultOut,
    image: Option<String>,
    equipped: Option<OcrResultOut>,
    captured_at: String,
    capture_ms: u128,
}

/// Seconds since the epoch → RFC 3339 UTC, without pulling in a date crate.
fn iso_now() -> String {
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0);
    let (days, rem) = (secs.div_euclid(86_400), secs.rem_euclid(86_400));
    // Howard Hinnant's civil_from_days.
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}T{:02}:{:02}:{:02}Z", rem / 3600, rem % 3600 / 60, rem % 60)
}

fn median_height(lines: &[TextLine]) -> f32 {
    let mut h: Vec<f32> = lines.iter().map(|l| l.rect.h).collect();
    if h.is_empty() {
        return 0.0;
    }
    h.sort_by(|a, b| a.partial_cmp(b).unwrap());
    h[h.len() / 2]
}

fn crop(img: &RgbaImage, r: &Rect) -> RgbaImage {
    let x = r.x.max(0.0) as u32;
    let y = r.y.max(0.0) as u32;
    let w = (r.w as u32).min(img.width().saturating_sub(x)).max(1);
    let h = (r.h as u32).min(img.height().saturating_sub(y)).max(1);
    imageops::crop_imm(img, x, y, w, h).to_image()
}

/// Upscale factors for the tooltip passes, best first. Windows OCR reads small
/// game text far better when glyphs are 25–45 px tall; three different scales
/// make different mistakes, which the vote then cancels out.
fn pass_scales(glyph_px: f32) -> [f32; 3] {
    if glyph_px > 0.0 && glyph_px < 26.0 {
        [2.0, 3.0, 1.0]
    } else {
        [1.0, 1.5, 2.0]
    }
}

/// OCRs one tooltip area in several passes and votes per line. Colors are
/// sampled on the original pixels: the text color from glyph cores, the bullet
/// color from the misread glyph's box or the area left of the line.
fn read_area(img: &RgbaImage, lang: Option<&str>, glyph_px: f32) -> AppResult<OcrResultOut> {
    let t0 = Instant::now();
    let mut passes = Vec::new();
    for s in pass_scales(glyph_px) {
        let lines = if (s - 1.0).abs() < f32::EPSILON {
            ocr::recognize(img, lang)?
        } else {
            let (w, h) = ((img.width() as f32 * s).round() as u32, (img.height() as f32 * s).round() as u32);
            ocr::recognize(&imageops::resize(img, w, h, imageops::FilterType::CatmullRom), lang)?
        };
        passes.push(lines.into_iter().map(|l| l.scaled(s)).collect::<Vec<_>>());
    }
    let out: Vec<OcrLineOut> = tooltip::vote(&passes)
        .into_iter()
        .map(|v| {
            let r = v.rect;
            let icon_color = match v.bullet {
                Some(b) => tooltip::glyph_color(img, &b),
                None => tooltip::icon_color(img, &r),
            };
            let text_rect = match v.bullet {
                Some(b) => Rect { x: b.right(), y: r.y, w: (r.right() - b.right()).max(1.0), h: r.h },
                None => r,
            };
            OcrLineOut {
                color: tooltip::text_color(img, &text_rect),
                icon_color,
                text: v.text,
                bbox: BBox { x: r.x, y: r.y, w: r.w, h: r.h },
            }
        })
        .collect();
    Ok(OcrResultOut {
        lines: out,
        engine: "windows",
        language: lang.map(str::to_string),
        elapsed_ms: t0.elapsed().as_millis(),
        image_size: ImageSize { w: img.width(), h: img.height() },
    })
}

fn data_url(img: &RgbaImage) -> Option<String> {
    let preview = if img.width() > 560 {
        let h = img.height() * 560 / img.width();
        imageops::resize(img, 560, h.max(1), imageops::FilterType::Triangle)
    } else {
        img.clone()
    };
    let mut png = Vec::new();
    image::DynamicImage::ImageRgba8(preview)
        .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
        .ok()?;
    Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(png)))
}

/// Finds tooltips in a whole image and reads the hovered one (and the equipped one).
fn read_screen(
    img: &RgbaImage,
    cursor: Option<(f32, f32)>,
    lang: Option<&str>,
) -> AppResult<(OcrResultOut, Option<OcrResultOut>, RgbaImage)> {
    let pass1 = ocr::recognize(img, lang)?;
    let glyph = median_height(&pass1);
    let regions = tooltip::find_tooltips(&pass1, cursor, (img.width() as f32, img.height() as f32));
    let main: Option<&Region> = regions.iter().find(|r| !r.equipped);
    let Some(main) = main else {
        return Err(AppError::msg(
            "No item tooltip found near the cursor. Hover an item in Diablo IV so its tooltip is visible, then scan again.",
        ));
    };
    let main_img = crop(img, &main.rect);
    let ocr = read_area(&main_img, lang, glyph)?;
    let equipped = match regions.iter().find(|r| r.equipped) {
        Some(eq) => read_area(&crop(img, &eq.rect), lang, glyph).ok(),
        None => None,
    };
    Ok((ocr, equipped, main_img))
}

fn capture_area(settings: &CaptureSettings, cursor: (i32, i32)) -> AppResult<ScreenRect> {
    let mon = capture::monitor_at(cursor.0, cursor.1)?;
    let clip = |r: ScreenRect| {
        let x = r.x.max(mon.x);
        let y = r.y.max(mon.y);
        let right = (r.x + r.w).min(mon.x + mon.w);
        let bottom = (r.y + r.h).min(mon.y + mon.h);
        ScreenRect { x, y, w: (right - x).max(0), h: (bottom - y).max(0) }
    };
    Ok(match settings.mode.as_str() {
        "region" => {
            let r = settings.region.ok_or_else(|| AppError::msg("Choose a capture region in Settings first."))?;
            ScreenRect { x: r.x, y: r.y, w: r.width, h: r.height }
        }
        "cursor" => {
            let b = settings.cursor_box.unwrap_or(SizePx { width: 1400, height: 1100 });
            clip(ScreenRect { x: cursor.0 - b.width / 2, y: cursor.1 - b.height / 2, w: b.width, h: b.height })
        }
        // Tooltips open beside the cursor, so a band around it is enough even on
        // ultrawide monitors.
        _ => clip(ScreenRect { x: cursor.0 - 1150, y: mon.y, w: 2300, h: mon.h }),
    })
}

/// Captures the screen around the cursor and reads the item tooltip on it.
pub fn perform_scan(settings: &CaptureSettings) -> AppResult<ScanPayload> {
    ocr::ensure_apartment();
    let t0 = Instant::now();
    let cursor = capture::cursor_pos()?;
    let area = capture_area(settings, cursor)?;
    let shot = capture::grab(area)?;
    if capture::looks_blank(&shot) {
        return Err(AppError::msg(
            "The capture came back black. Run Diablo IV in Windowed or Borderless (Windowed Fullscreen) mode and try again.",
        ));
    }
    let lang = settings.language.as_deref();
    let (ocr, equipped, tooltip_img) = if settings.mode == "region" {
        let pass1 = ocr::recognize(&shot, lang)?;
        (read_area(&shot, lang, median_height(&pass1))?, None, shot)
    } else {
        let rel = ((cursor.0 - area.x) as f32, (cursor.1 - area.y) as f32);
        read_screen(&shot, Some(rel), lang)?
    };
    Ok(ScanPayload {
        ocr,
        image: data_url(&tooltip_img),
        equipped,
        captured_at: iso_now(),
        capture_ms: t0.elapsed().as_millis(),
    })
}

/// Reads an uploaded screenshot: the tooltip if one is found, otherwise all text.
pub fn read_image(bytes: &[u8], lang: Option<&str>) -> AppResult<OcrResultOut> {
    ocr::ensure_apartment();
    let img = image::load_from_memory(bytes)?.to_rgba8();
    match read_screen(&img, None, lang) {
        Ok((ocr, _, _)) => Ok(ocr),
        Err(_) => {
            let pass1 = ocr::recognize(&img, lang)?;
            read_area(&img, lang, median_height(&pass1))
        }
    }
}

fn run_exclusive<T>(f: impl FnOnce() -> AppResult<T>) -> AppResult<T> {
    if SCANNING.swap(true, Ordering::SeqCst) {
        return Err(AppError::msg("A scan is already running."));
    }
    let r = f();
    SCANNING.store(false, Ordering::SeqCst);
    r
}

/// Global hotkey entry point: scans in the background and reports to the main window.
pub fn scan_from_hotkey(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        let settings = app.state::<CaptureState>().0.lock().map(|s| s.clone()).unwrap_or_default();
        match run_exclusive(|| perform_scan(&CaptureSettings { delay_ms: None, ..settings })) {
            Ok(payload) => {
                let _ = app.emit_to("main", "scan://result", payload);
            }
            Err(e) => {
                let _ = app.emit_to("main", "scan://error", e.to_string());
            }
        }
    });
}

#[tauri::command]
pub fn capture_configure(state: State<'_, CaptureState>, settings: CaptureSettings) {
    if let Ok(mut s) = state.0.lock() {
        *s = settings;
    }
}

#[tauri::command]
pub async fn scan_capture(app: AppHandle, settings: CaptureSettings) -> AppResult<ScanPayload> {
    if let Ok(mut s) = app.state::<CaptureState>().0.lock() {
        *s = CaptureSettings { delay_ms: None, ..settings.clone() };
    }
    let delay = settings.delay_ms.unwrap_or(0).min(10_000);
    let main = app.get_webview_window("main");
    if delay > 0 {
        if let Some(w) = &main {
            let _ = w.minimize();
        }
    }
    let result = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(Duration::from_millis(delay));
        run_exclusive(|| perform_scan(&settings))
    })
    .await
    .map_err(|e| AppError::msg(e.to_string()))?;
    if delay > 0 {
        if let Some(w) = &main {
            let _ = w.unminimize();
            let _ = w.set_focus();
        }
    }
    result
}

#[tauri::command]
pub async fn ocr_image(app: AppHandle, image_base64: String) -> AppResult<OcrResultOut> {
    let lang = app.state::<CaptureState>().0.lock().ok().and_then(|s| s.language.clone());
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(image_base64.as_bytes())
        .map_err(|_| AppError::msg("The image data is not valid."))?;
    tauri::async_runtime::spawn_blocking(move || read_image(&bytes, lang.as_deref()))
        .await
        .map_err(|e| AppError::msg(e.to_string()))?
}

#[tauri::command]
pub async fn ocr_languages() -> AppResult<Vec<String>> {
    tauri::async_runtime::spawn_blocking(ocr::languages).await.map_err(|e| AppError::msg(e.to_string()))?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_utc_timestamps() {
        let s = iso_now();
        assert_eq!(s.len(), 20);
        assert!(s.ends_with('Z') && s.as_bytes()[10] == b'T');
    }

    #[test]
    fn capture_settings_accept_ui_shape() {
        let s: CaptureSettings = serde_json::from_str(
            r#"{"mode":"cursor","region":null,"cursorBox":{"width":900,"height":800},"language":"en-US"}"#,
        )
        .unwrap();
        assert_eq!(s.mode, "cursor");
        assert_eq!(s.cursor_box, Some(SizePx { width: 900, height: 800 }));
        assert_eq!(s.delay_ms, None);
    }
}
