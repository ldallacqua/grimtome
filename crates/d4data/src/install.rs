//! Locating Diablo IV installations (`GameInstallationDetector` in the docs).

use serde::Serialize;
use std::path::{Path, PathBuf};

pub const STEAM_APP_ID: &str = "2344520";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum Source {
    Steam,
    BattleNet,
    Manual,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum StorageLayout {
    /// Steam "static container" storage — supported.
    SteamStatic,
    /// Battle.net CASC storage — detected but not yet supported by the importer.
    Casc,
    Unknown,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Installation {
    pub root: PathBuf,
    pub data_dir: PathBuf,
    pub source: Source,
    pub layout: StorageLayout,
    pub build: Option<String>,
}

impl Installation {
    pub fn is_supported(&self) -> bool {
        self.layout == StorageLayout::SteamStatic
    }
}

/// Validates a folder chosen by the user (game root or its `Data` folder).
pub fn inspect(path: &Path, source: Source) -> Option<Installation> {
    let root = if path.file_name().is_some_and(|n| n.eq_ignore_ascii_case("data")) {
        path.parent()?.to_path_buf()
    } else {
        path.to_path_buf()
    };
    let data_dir = root.join("Data");
    let layout = if data_dir.join(".build.config").is_file() {
        StorageLayout::SteamStatic
    } else if root.join(".build.info").is_file() && data_dir.join("data").is_dir() {
        StorageLayout::Casc
    } else if data_dir.is_dir() {
        StorageLayout::Unknown
    } else {
        return None;
    };
    let build = std::fs::read_to_string(root.join("BuildRevision.txt"))
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());
    Some(Installation { root, data_dir, source, layout, build })
}

/// Finds installations through Steam's library manifests and Battle.net's uninstall entry.
pub fn detect() -> Vec<Installation> {
    let mut found: Vec<Installation> = Vec::new();
    for lib in steam_libraries() {
        let manifest = lib.join("steamapps").join(format!("appmanifest_{STEAM_APP_ID}.acf"));
        let Ok(text) = std::fs::read_to_string(&manifest) else { continue };
        let dir = vdf_values(&text, "installdir").into_iter().next().unwrap_or_else(|| "Diablo IV".into());
        if let Some(inst) = inspect(&lib.join("steamapps").join("common").join(dir), Source::Steam) {
            found.push(inst);
        }
    }
    for path in battle_net_candidates() {
        if found.iter().any(|f| same_path(&f.root, &path)) {
            continue;
        }
        if let Some(inst) = inspect(&path, Source::BattleNet) {
            found.push(inst);
        }
    }
    found
}

fn same_path(a: &Path, b: &Path) -> bool {
    a.to_string_lossy().eq_ignore_ascii_case(&b.to_string_lossy())
}

/// Extracts `"key" "value"` pairs from Valve's KeyValues (VDF) text.
pub fn vdf_values(text: &str, key: &str) -> Vec<String> {
    let needle = format!("\"{key}\"");
    text.lines()
        .filter_map(|line| {
            let line = line.trim();
            let rest = line.strip_prefix(&needle)?.trim();
            let value = rest.strip_prefix('"')?.strip_suffix('"')?;
            Some(value.replace("\\\\", "\\"))
        })
        .collect()
}

fn steam_libraries() -> Vec<PathBuf> {
    let mut roots = steam_roots();
    let mut libs = Vec::new();
    for root in roots.drain(..) {
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        if let Ok(text) = std::fs::read_to_string(vdf) {
            libs.extend(vdf_values(&text, "path").into_iter().map(PathBuf::from));
        }
        libs.push(root);
    }
    libs.sort();
    libs.dedup_by(|a, b| same_path(a, b));
    libs
}

#[cfg(windows)]
fn steam_roots() -> Vec<PathBuf> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;
    let mut out = Vec::new();
    if let Ok(k) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Software\\Valve\\Steam") {
        if let Ok(p) = k.get_value::<String, _>("SteamPath") {
            out.push(PathBuf::from(p.replace('/', "\\")));
        }
    }
    for sub in ["SOFTWARE\\WOW6432Node\\Valve\\Steam", "SOFTWARE\\Valve\\Steam"] {
        if let Ok(k) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(sub) {
            if let Ok(p) = k.get_value::<String, _>("InstallPath") {
                out.push(PathBuf::from(p));
            }
        }
    }
    out.push(PathBuf::from("C:\\Program Files (x86)\\Steam"));
    out.retain(|p| p.is_dir());
    out
}

#[cfg(not(windows))]
fn steam_roots() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(windows)]
fn battle_net_candidates() -> Vec<PathBuf> {
    use winreg::enums::HKEY_LOCAL_MACHINE;
    use winreg::RegKey;
    let mut out = Vec::new();
    for sub in [
        "SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Diablo IV",
        "SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Diablo IV",
    ] {
        if let Ok(k) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(sub) {
            if let Ok(p) = k.get_value::<String, _>("InstallLocation") {
                if !p.trim().is_empty() {
                    out.push(PathBuf::from(p));
                }
            }
        }
    }
    out.push(PathBuf::from("C:\\Program Files (x86)\\Diablo IV"));
    out
}

#[cfg(not(windows))]
fn battle_net_candidates() -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_vdf_values() {
        let text = "\"libraryfolders\"\n{\n\t\"0\"\n\t{\n\t\t\"path\"\t\t\"C:\\\\Steam\"\n\t}\n\t\"1\" { \n\t\t\"path\"\t\"D:\\\\Games\\\\Steam\"\n}";
        assert_eq!(vdf_values(text, "path"), vec!["C:\\Steam", "D:\\Games\\Steam"]);
    }

    #[test]
    fn inspects_static_layout() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join("Data")).unwrap();
        std::fs::write(dir.path().join("Data").join(".build.config"), "# Static Build Configuration\n").unwrap();
        std::fs::write(dir.path().join("BuildRevision.txt"), "123-456\n").unwrap();
        let inst = inspect(&dir.path().join("Data"), Source::Manual).unwrap();
        assert_eq!(inst.layout, StorageLayout::SteamStatic);
        assert_eq!(inst.build.as_deref(), Some("123-456"));
        assert!(inspect(&dir.path().join("nope"), Source::Manual).is_none());
    }
}
