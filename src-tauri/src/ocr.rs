//! Text recognition with the OCR engine built into Windows (Windows.Media.Ocr).
//! Runs fully offline; the language packs are the ones installed in Windows.

use crate::error::{AppError, AppResult};
use crate::tooltip::{Rect, TextLine, Word};
use image::RgbaImage;

#[cfg(windows)]
mod imp {
    use super::*;
    use windows::core::HSTRING;
    use windows::Globalization::Language;
    use windows::Graphics::Imaging::{BitmapPixelFormat, SoftwareBitmap};
    use windows::Media::Ocr::OcrEngine;
    use windows::Storage::Streams::DataWriter;
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    /// WinRT needs an initialized apartment on worker threads. Already-initialized
    /// threads report an error we can ignore.
    pub fn ensure_apartment() {
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
    }

    fn engine(lang: Option<&str>) -> AppResult<OcrEngine> {
        ensure_apartment();
        if let Some(tag) = lang.filter(|t| !t.is_empty()) {
            if let Ok(l) = Language::CreateLanguage(&HSTRING::from(tag)) {
                if OcrEngine::IsLanguageSupported(&l).unwrap_or(false) {
                    return Ok(OcrEngine::TryCreateFromLanguage(&l)?);
                }
            }
        }
        OcrEngine::TryCreateFromUserProfileLanguages().map_err(|_| {
            AppError::msg(
                "Windows OCR is not available. Install an OCR language pack in Windows Settings → Time & language.",
            )
        })
    }

    pub fn languages() -> AppResult<Vec<String>> {
        ensure_apartment();
        let langs = OcrEngine::AvailableRecognizerLanguages()?;
        let mut out = Vec::new();
        for l in langs {
            out.push(l.LanguageTag()?.to_string());
        }
        Ok(out)
    }

    pub fn recognize(img: &RgbaImage, lang: Option<&str>) -> AppResult<Vec<TextLine>> {
        let engine = engine(lang)?;
        let max = OcrEngine::MaxImageDimension()?;
        let (w, h) = img.dimensions();
        if w > max || h > max {
            return Err(AppError::msg(format!("Image too large for OCR ({w}×{h}, max {max}).")));
        }
        let mut bgra = img.as_raw().clone();
        for px in bgra.as_chunks_mut::<4>().0 {
            px.swap(0, 2);
        }
        let writer = DataWriter::new()?;
        writer.WriteBytes(&bgra)?;
        let buffer = writer.DetachBuffer()?;
        let bitmap = SoftwareBitmap::CreateCopyFromBuffer(&buffer, BitmapPixelFormat::Bgra8, w as i32, h as i32)?;
        let result = engine.RecognizeAsync(&bitmap)?.get()?;
        let mut out = Vec::new();
        for line in result.Lines()? {
            let text = line.Text()?.to_string();
            let mut rect: Option<Rect> = None;
            let mut words = Vec::new();
            for word in line.Words()? {
                let b = word.BoundingRect()?;
                let r = Rect { x: b.X, y: b.Y, w: b.Width, h: b.Height };
                rect = Some(rect.map_or(r, |acc| acc.union(&r)));
                words.push(Word { text: word.Text()?.to_string(), rect: r });
            }
            if let Some(rect) = rect {
                if !text.trim().is_empty() {
                    out.push(TextLine { text, rect, words });
                }
            }
        }
        Ok(out)
    }
}

#[cfg(not(windows))]
mod imp {
    use super::*;
    pub fn ensure_apartment() {}
    pub fn languages() -> AppResult<Vec<String>> {
        Ok(Vec::new())
    }
    pub fn recognize(_img: &RgbaImage, _lang: Option<&str>) -> AppResult<Vec<TextLine>> {
        Err(AppError::msg("Windows OCR is only available on Windows."))
    }
}

pub use imp::{ensure_apartment, languages, recognize};
