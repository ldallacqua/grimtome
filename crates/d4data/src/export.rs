//! Writes the icon cache: PNG files, `manifest.json` and `catalog.json`.
//!
//! The export goes to a sibling staging folder first and is swapped into place
//! only when complete, so a cancelled or failed import never leaves a half cache.

use crate::catalog::{AssetJob, Catalog, Compose, GameData};
use crate::error::{Error, Result};
use crate::texture::Frame;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

pub const MANIFEST_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetRecord {
    /// Path relative to the cache root, always with `/` separators.
    pub file: String,
    pub category: String,
    pub width: u32,
    pub height: u32,
    pub sha256: String,
    /// Internal texture name the asset came from (for diagnostics and invalidation).
    pub texture: String,
    pub frame: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetManifest {
    pub schema_version: u32,
    pub game_build: Option<String>,
    pub locale: String,
    pub generated_at_unix: u64,
    pub source: String,
    pub assets: BTreeMap<String, AssetRecord>,
    pub failures: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub stage: &'static str,
    pub done: usize,
    pub total: usize,
}

fn write_atomic(path: &Path, bytes: &[u8]) -> Result<()> {
    let tmp = path.with_extension("tmp");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn file_name_for(id: &str) -> String {
    id.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '.' { c } else { '_' }).collect()
}

/// Some inventory atlases are stored without alpha (opaque BC1). Clears the dark
/// background connected to the icon's border and feathers the remaining edge.
pub fn key_out_black_background(img: &mut image::RgbaImage) {
    let (w, h) = img.dimensions();
    if w < 3 || h < 3 {
        return;
    }
    let dark = |p: &image::Rgba<u8>| p[3] > 200 && p[0].max(p[1]).max(p[2]) <= 14;
    let corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)];
    if !corners.iter().all(|&(x, y)| dark(img.get_pixel(x, y))) {
        return;
    }
    let mut cleared = vec![false; (w * h) as usize];
    let mut stack: Vec<(u32, u32)> = Vec::new();
    for x in 0..w {
        stack.push((x, 0));
        stack.push((x, h - 1));
    }
    for y in 0..h {
        stack.push((0, y));
        stack.push((w - 1, y));
    }
    while let Some((x, y)) = stack.pop() {
        let i = (y * w + x) as usize;
        if cleared[i] || !dark(img.get_pixel(x, y)) {
            continue;
        }
        cleared[i] = true;
        img.get_pixel_mut(x, y)[3] = 0;
        if x > 0 {
            stack.push((x - 1, y));
        }
        if y > 0 {
            stack.push((x, y - 1));
        }
        if x + 1 < w {
            stack.push((x + 1, y));
        }
        if y + 1 < h {
            stack.push((x, y + 1));
        }
    }
    // Feather: near-black pixels touching the cleared area become partly transparent.
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            let i = (y * w + x) as usize;
            if cleared[i] {
                continue;
            }
            let touches = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
                .iter()
                .any(|&(nx, ny)| cleared[(ny * w + nx) as usize]);
            if touches {
                let p = img.get_pixel_mut(x, y);
                let lum = p[0].max(p[1]).max(p[2]) as u32;
                if lum < 48 {
                    p[3] = ((lum * 255) / 48) as u8;
                }
            }
        }
    }
}

/// Assembles atlas frames into one grid image (see [`Compose`]). Returns `None`
/// when a requested frame is missing.
pub fn compose_frames(compose: &Compose, frames: &[Frame], atlas: &image::RgbaImage) -> Option<image::RgbaImage> {
    let cols = compose.cols.max(1);
    let rows = compose.frames.len().div_ceil(cols);
    let mut cells: Vec<Option<image::RgbaImage>> = Vec::with_capacity(compose.frames.len());
    for want in &compose.frames {
        cells.push(match want {
            Some(i) => Some(frames.get(*i)?.crop(atlas)),
            None => None,
        });
    }
    let mut col_w = vec![0u32; cols];
    let mut row_h = vec![0u32; rows];
    for (i, img) in cells.iter().enumerate().filter_map(|(i, c)| c.as_ref().map(|c| (i, c))) {
        col_w[i % cols] = col_w[i % cols].max(img.width());
        row_h[i / cols] = row_h[i / cols].max(img.height());
    }
    let (w, h) = (col_w.iter().sum::<u32>(), row_h.iter().sum::<u32>());
    if w == 0 || h == 0 {
        return None;
    }
    let mut out = image::RgbaImage::new(w, h);
    for (i, img) in cells.iter().enumerate().filter_map(|(i, c)| c.as_ref().map(|c| (i, c))) {
        let x: u32 = col_w[..i % cols].iter().sum();
        let y: u32 = row_h[..i / cols].iter().sum();
        image::imageops::replace(&mut out, img, x as i64, y as i64);
    }
    Some(out)
}

/// Exports every job to `out_dir` (replaced atomically) and returns the manifest.
pub fn export(
    game: &GameData,
    catalog: &Catalog,
    jobs: &[AssetJob],
    out_dir: &Path,
    progress: &(dyn Fn(Progress) + Sync),
    cancel: &AtomicBool,
) -> Result<AssetManifest> {
    let staging: PathBuf =
        out_dir.with_file_name(format!("{}.staging", out_dir.file_name().and_then(|n| n.to_str()).unwrap_or("cache")));
    if staging.exists() {
        std::fs::remove_dir_all(&staging)?;
    }
    std::fs::create_dir_all(&staging)?;

    let mut by_texture: HashMap<u32, Vec<&AssetJob>> = HashMap::new();
    for job in jobs {
        by_texture.entry(job.texture).or_default().push(job);
    }
    let total = jobs.len();
    let done = AtomicUsize::new(0);
    progress(Progress { stage: "icons", done: 0, total });

    let results: Vec<std::result::Result<Vec<(String, AssetRecord)>, String>> = by_texture
        .par_iter()
        .map(|(tex, tex_jobs)| {
            if cancel.load(Ordering::Relaxed) {
                return Err("cancelled".into());
            }
            let name = game.texture_name(*tex).unwrap_or("?").to_string();
            let decoded =
                game.texture_def(*tex).ok_or_else(|| format!("{name}: missing texture definition")).and_then(|def| {
                    let payload = game.storage.read_payload(*tex).map_err(|e| format!("{name}: {e}"))?;
                    let img = def.decode(&payload).map_err(|e| format!("{name}: {e}"))?;
                    Ok((def, img))
                });
            let (def, atlas) = match decoded {
                Ok(v) => v,
                Err(e) => {
                    done.fetch_add(tex_jobs.len(), Ordering::Relaxed);
                    return Err(e);
                }
            };
            let mut out = Vec::with_capacity(tex_jobs.len());
            for job in tex_jobs {
                let mut img = match (&job.compose, job.frame) {
                    (Some(c), _) => match compose_frames(c, &def.frames, &atlas) {
                        Some(img) => img,
                        None => continue,
                    },
                    (None, Some(i)) => match def.frames.get(i) {
                        Some(f) => f.crop(&atlas),
                        None => continue,
                    },
                    (None, None) => atlas.clone(),
                };
                if job.category == "items" {
                    key_out_black_background(&mut img);
                }
                if let Some(max) = job.max_px {
                    if img.width().max(img.height()) > max {
                        let scale = max as f32 / img.width().max(img.height()) as f32;
                        let (w, h) =
                            ((img.width() as f32 * scale).round() as u32, (img.height() as f32 * scale).round() as u32);
                        img = image::imageops::resize(&img, w.max(1), h.max(1), image::imageops::FilterType::Lanczos3);
                    }
                }
                let rel = format!("{}/{}.png", job.category, file_name_for(&job.id));
                let abs = staging.join(&rel);
                if let Some(parent) = abs.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                }
                let mut png = Vec::new();
                image::DynamicImage::ImageRgba8(img.clone())
                    .write_to(&mut std::io::Cursor::new(&mut png), image::ImageFormat::Png)
                    .map_err(|e| e.to_string())?;
                std::fs::write(&abs, &png).map_err(|e| e.to_string())?;
                out.push((
                    job.id.clone(),
                    AssetRecord {
                        file: rel,
                        category: job.category.to_string(),
                        width: img.width(),
                        height: img.height(),
                        sha256: hex::encode(Sha256::digest(&png)),
                        texture: name.clone(),
                        frame: job.frame,
                    },
                ));
                let n = done.fetch_add(1, Ordering::Relaxed) + 1;
                if n.is_multiple_of(25) {
                    progress(Progress { stage: "icons", done: n, total });
                }
            }
            Ok(out)
        })
        .collect();

    if cancel.load(Ordering::Relaxed) {
        let _ = std::fs::remove_dir_all(&staging);
        return Err(Error::Cancelled);
    }
    let mut assets = BTreeMap::new();
    let mut failures = Vec::new();
    for r in results {
        match r {
            Ok(records) => assets.extend(records),
            Err(e) => failures.push(e),
        }
    }
    failures.sort();
    let manifest = AssetManifest {
        schema_version: MANIFEST_SCHEMA_VERSION,
        game_build: catalog.game_build.clone(),
        locale: catalog.locale.clone(),
        generated_at_unix: SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0),
        source: "local-game-install".into(),
        assets,
        failures,
    };
    progress(Progress { stage: "writing", done: total, total });
    write_atomic(
        &staging.join("catalog.json"),
        &serde_json::to_vec_pretty(catalog).map_err(|e| Error::Format(e.to_string()))?,
    )?;
    write_atomic(
        &staging.join("manifest.json"),
        &serde_json::to_vec_pretty(&manifest).map_err(|e| Error::Format(e.to_string()))?,
    )?;
    if out_dir.exists() {
        std::fs::remove_dir_all(out_dir)?;
    }
    std::fs::rename(&staging, out_dir)?;
    progress(Progress { stage: "done", done: total, total });
    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keys_out_dark_borders_only_when_opaque() {
        let mut img = image::RgbaImage::from_pixel(8, 8, image::Rgba([0, 0, 0, 255]));
        img.put_pixel(4, 4, image::Rgba([200, 150, 90, 255]));
        key_out_black_background(&mut img);
        assert_eq!(img.get_pixel(0, 0)[3], 0);
        assert_eq!(img.get_pixel(4, 4)[3], 255);
        let mut transparent = image::RgbaImage::from_pixel(4, 4, image::Rgba([0, 0, 0, 0]));
        key_out_black_background(&mut transparent);
        assert_eq!(transparent.get_pixel(1, 1)[3], 0);
    }

    #[test]
    fn composes_frames_into_a_grid() {
        let mut atlas = image::RgbaImage::new(4, 2);
        atlas.put_pixel(0, 0, image::Rgba([255, 0, 0, 255]));
        atlas.put_pixel(2, 0, image::Rgba([0, 255, 0, 255]));
        let frame = |u0: f32, u1: f32| Frame { hash: 1, u0, v0: 0.0, u1, v1: 1.0 };
        let frames = [frame(0.0, 0.5), frame(0.5, 1.0)];
        let grid = Compose { cols: 2, frames: vec![Some(1), None, None, Some(0)] };
        let out = compose_frames(&grid, &frames, &atlas).unwrap();
        assert_eq!(out.dimensions(), (4, 4));
        assert_eq!(out.get_pixel(0, 0)[1], 255);
        assert_eq!(out.get_pixel(2, 2)[0], 255);
        assert_eq!(out.get_pixel(2, 0)[3], 0);
        let missing = Compose { cols: 1, frames: vec![Some(9)] };
        assert!(compose_frames(&missing, &frames, &atlas).is_none());
    }

    #[test]
    fn file_names_are_safe() {
        assert_eq!(file_name_for("skill.barbarian.bash"), "skill.barbarian.bash");
        assert_eq!(file_name_for("ui.a/b c"), "ui.a_b_c");
    }
}
