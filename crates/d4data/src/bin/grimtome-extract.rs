//! Developer CLI for the local asset importer.
//!
//! ```text
//! grimtome-extract detect
//! grimtome-extract export [--game <dir>] [--out <dir>] [--locale enUS]
//! grimtome-extract textures [substring...]          # list UI textures (name, size, frames)
//! grimtome-extract dump <out-dir> <texture-name...> # write whole textures + frames for inspection
//! ```
//!
//! The desktop app runs the same pipeline from Settings → Game Assets.

use d4data::catalog::GameData;
use d4data::install::{self, Source};
use d4data::storage::StaticStorage;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::time::Instant;

fn arg(args: &[String], name: &str) -> Option<String> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
}

fn default_out() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."));
    base.join("app.grimtome.desktop").join("assets").join("current")
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("detect") => {
            let found = install::detect();
            println!("{}", serde_json::to_string_pretty(&found).unwrap());
        }
        Some("export") => {
            let inst = match arg(&args, "--game") {
                Some(p) => install::inspect(&PathBuf::from(p), Source::Manual),
                None => install::detect().into_iter().find(|i| i.is_supported()),
            };
            let Some(inst) = inst.filter(|i| i.is_supported()) else {
                eprintln!("No supported Diablo IV installation found (Steam layout required).");
                std::process::exit(2);
            };
            let locale = arg(&args, "--locale").unwrap_or_else(|| "enUS".into());
            let out = arg(&args, "--out").map(PathBuf::from).unwrap_or_else(default_out);
            let t0 = Instant::now();
            eprintln!("Reading {} (build {:?})", inst.root.display(), inst.build);
            let storage = StaticStorage::open(&inst.data_dir).unwrap_or_else(|e| fail(e));
            eprintln!("  indexed {} metas in {:.1?}", storage.meta_count(), t0.elapsed());
            let game = GameData::open(storage, &locale).unwrap_or_else(|e| fail(e));
            eprintln!("  loaded TOC, textures and strings in {:.1?}", t0.elapsed());
            let (catalog, jobs) = game.build_catalog(inst.build.clone()).unwrap_or_else(|e| fail(e));
            eprintln!(
                "  catalog: {} classes, {} skills, {} uniques, {} aspects, {} glyphs, {} boards, {} affix templates ({:.1?})",
                catalog.classes.len(),
                catalog.skills.len(),
                catalog.uniques.len(),
                catalog.aspects.len(),
                catalog.glyphs.len(),
                catalog.paragon_boards.len(),
                catalog.affix_templates.len(),
                t0.elapsed()
            );
            let cancel = AtomicBool::new(false);
            let manifest = d4data::export::export(
                &game,
                &catalog,
                &jobs,
                &out,
                &|p| eprint!("\r  {} {}/{}   ", p.stage, p.done, p.total),
                &cancel,
            )
            .unwrap_or_else(|e| fail(e));
            eprintln!(
                "\n  wrote {} assets to {} ({} failures) in {:.1?}",
                manifest.assets.len(),
                out.display(),
                manifest.failures.len(),
                t0.elapsed()
            );
            for f in manifest.failures.iter().take(10) {
                eprintln!("    ! {f}");
            }
        }
        Some("textures") => {
            let game = open_game(&args);
            let filters: Vec<String> = args[2..].iter().map(|f| f.to_ascii_lowercase()).collect();
            let mut rows: Vec<(String, u32)> = game
                .toc
                .group(d4data::groups::TEXTURE)
                .filter(|(_, n)| {
                    let l = n.to_ascii_lowercase();
                    filters.is_empty() || filters.iter().any(|f| l.contains(f.as_str()))
                })
                .map(|(id, n)| (n.to_string(), id))
                .collect();
            rows.sort();
            for (name, id) in rows {
                if let Some(def) = game.texture_def(id) {
                    println!("{name}	{}x{}	{} frames	fmt {}", def.width, def.height, def.frames.len(), def.format);
                }
            }
        }
        Some("dump") => {
            let game = open_game(&args);
            let out = PathBuf::from(args.get(2).expect("out dir"));
            std::fs::create_dir_all(&out).unwrap();
            for name in &args[3..] {
                let Some(id) = game.texture_id(name) else {
                    eprintln!("  ? {name} not found");
                    continue;
                };
                let def = game.texture_def(id).expect("definition");
                let payload = game.storage.read_payload(id).unwrap_or_else(|e| fail(e));
                let img = def.decode(&payload).unwrap_or_else(|e| fail(e));
                img.save(out.join(format!("{name}.png"))).unwrap();
                for (i, f) in def.frames.iter().enumerate() {
                    let (x, y, w, h) = f.rect(def.width, def.height);
                    println!("{name}.{i}	{x},{y}	{w}x{h}");
                    if w > 0 && h > 0 {
                        f.crop(&img).save(out.join(format!("{name}.{i}.png"))).unwrap();
                    }
                }
            }
        }
        _ => {
            eprintln!("usage: grimtome-extract detect | export [--game <dir>] [--out <dir>] [--locale enUS]");
            std::process::exit(1);
        }
    }
}

fn open_game(_args: &[String]) -> GameData {
    let inst = install::detect().into_iter().find(|i| i.is_supported()).unwrap_or_else(|| {
        eprintln!("No supported Diablo IV installation found.");
        std::process::exit(2);
    });
    let storage = StaticStorage::open(&inst.data_dir).unwrap_or_else(|e| fail(e));
    GameData::open(storage, "enUS").unwrap_or_else(|e| fail(e))
}

fn fail(e: d4data::Error) -> ! {
    eprintln!("error: {e}");
    std::process::exit(1);
}
