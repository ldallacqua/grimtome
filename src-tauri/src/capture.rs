//! Screen capture with GDI: a plain copy of what is on the user's screen, the same
//! pixels a screenshot key would produce. No game process is touched.

use crate::error::{AppError, AppResult};
use image::RgbaImage;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ScreenRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::Win32::Foundation::POINT;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC, GetDIBits, GetMonitorInfoW,
        MonitorFromPoint, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, CAPTUREBLT, DIB_RGB_COLORS,
        MONITORINFO, MONITOR_DEFAULTTONEAREST, SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::GetCursorPos;

    /// Cursor position in physical screen pixels (the process is per-monitor DPI aware).
    pub fn cursor_pos() -> AppResult<(i32, i32)> {
        let mut p = POINT::default();
        unsafe { GetCursorPos(&mut p)? };
        Ok((p.x, p.y))
    }

    /// Bounds of the monitor containing a point.
    pub fn monitor_at(x: i32, y: i32) -> AppResult<ScreenRect> {
        let mut info = MONITORINFO { cbSize: std::mem::size_of::<MONITORINFO>() as u32, ..Default::default() };
        unsafe {
            let mon = MonitorFromPoint(POINT { x, y }, MONITOR_DEFAULTTONEAREST);
            if !GetMonitorInfoW(mon, &mut info).as_bool() {
                return Err(AppError::msg("Could not read monitor bounds."));
            }
        }
        let r = info.rcMonitor;
        Ok(ScreenRect { x: r.left, y: r.top, w: r.right - r.left, h: r.bottom - r.top })
    }

    pub fn grab(r: ScreenRect) -> AppResult<RgbaImage> {
        if r.w <= 0 || r.h <= 0 {
            return Err(AppError::msg("Empty capture area."));
        }
        let mut buf = vec![0u8; (r.w * r.h * 4) as usize];
        unsafe {
            let screen = GetDC(None);
            let mem = CreateCompatibleDC(Some(screen));
            let bmp = CreateCompatibleBitmap(screen, r.w, r.h);
            let old = SelectObject(mem, bmp.into());
            let blit = BitBlt(mem, 0, 0, r.w, r.h, Some(screen), r.x, r.y, SRCCOPY | CAPTUREBLT);
            let mut bmi = BITMAPINFO {
                bmiHeader: BITMAPINFOHEADER {
                    biSize: std::mem::size_of::<BITMAPINFOHEADER>() as u32,
                    biWidth: r.w,
                    biHeight: -r.h,
                    biPlanes: 1,
                    biBitCount: 32,
                    biCompression: BI_RGB.0,
                    ..Default::default()
                },
                ..Default::default()
            };
            let rows = GetDIBits(mem, bmp, 0, r.h as u32, Some(buf.as_mut_ptr().cast()), &mut bmi, DIB_RGB_COLORS);
            SelectObject(mem, old);
            let _ = DeleteObject(bmp.into());
            let _ = DeleteDC(mem);
            ReleaseDC(None, screen);
            blit?;
            if rows == 0 {
                return Err(AppError::msg("Screen capture failed."));
            }
        }
        // BGRA → RGBA, opaque.
        for px in buf.as_chunks_mut::<4>().0 {
            px.swap(0, 2);
            px[3] = 255;
        }
        RgbaImage::from_raw(r.w as u32, r.h as u32, buf).ok_or_else(|| AppError::msg("Bad capture buffer."))
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    pub fn cursor_pos() -> AppResult<(i32, i32)> {
        Err(AppError::msg("Screen capture is only available on Windows."))
    }
    pub fn monitor_at(_x: i32, _y: i32) -> AppResult<ScreenRect> {
        Err(AppError::msg("Screen capture is only available on Windows."))
    }
    pub fn grab(_r: ScreenRect) -> AppResult<RgbaImage> {
        Err(AppError::msg("Screen capture is only available on Windows."))
    }
}

pub use imp::{cursor_pos, grab, monitor_at};

/// True when a capture is (almost) uniformly black, which is what GDI returns for
/// content it cannot see (exclusive full screen, protected surfaces).
pub fn looks_blank(img: &RgbaImage) -> bool {
    let step = ((img.width() * img.height()) / 4000).max(1) as usize;
    !img.pixels().step_by(step).any(|p| p[0].max(p[1]).max(p[2]) > 24)
}
