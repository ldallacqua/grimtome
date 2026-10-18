//! The Steam "static container" storage: `Data/.build.config` + numbered folders.
//!
//! Opening a storage parses the root TVFS manifest, finds the `base` manifest and
//! indexes every `meta/<sno>`, `payload/<sno>`, `paylow/<sno>` and root file.

use crate::blte;
use crate::error::{Error, Result};
use crate::keys::{Kind, KeyLayouts};
use crate::tvfs::{Manifest, Span};
use std::collections::HashMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};

pub struct StaticStorage {
    data_dir: PathBuf,
    layouts: KeyLayouts,
    meta: HashMap<u32, Span>,
    payload: HashMap<u32, Span>,
    paylow: HashMap<u32, Span>,
    files: HashMap<String, Span>,
}

pub(crate) fn parse_config(text: &str) -> HashMap<String, String> {
    text.lines()
        .filter(|l| !l.trim_start().starts_with('#'))
        .filter_map(|l| l.split_once('='))
        .map(|(k, v)| (k.trim().to_string(), v.trim().to_string()))
        .collect()
}

fn parse_key(hex_key: &str) -> Result<[u8; 16]> {
    hex::decode(hex_key)
        .ok()
        .and_then(|v| v.try_into().ok())
        .ok_or_else(|| Error::Layout(format!("bad key {hex_key}")))
}

impl StaticStorage {
    /// `data_dir` is the game's `Data` folder (the one containing `.build.config`).
    pub fn open(data_dir: &Path) -> Result<Self> {
        let cfg_path = data_dir.join(".build.config");
        let text = std::fs::read_to_string(&cfg_path).map_err(|source| Error::IoAt {
            path: cfg_path.clone(),
            source,
        })?;
        let cfg = parse_config(&text);
        let layouts = KeyLayouts::from_config(&cfg)?;
        let (root_key, root_esize) = {
            let keys = cfg.get("vfs-root").ok_or_else(|| Error::Layout("missing vfs-root".into()))?;
            let ekey = keys.split_whitespace().nth(1).ok_or_else(|| Error::Layout("vfs-root".into()))?;
            let size = cfg
                .get("vfs-root-size")
                .and_then(|s| s.split_whitespace().nth(1))
                .and_then(|s| s.parse::<u32>().ok())
                .ok_or_else(|| Error::Layout("missing vfs-root-size".into()))?;
            (parse_key(ekey)?, size)
        };
        let mut storage = Self {
            data_dir: data_dir.to_path_buf(),
            layouts,
            meta: HashMap::new(),
            payload: HashMap::new(),
            paylow: HashMap::new(),
            files: HashMap::new(),
        };
        let root_bytes = storage.read_span(
            &Span { ekey: root_key, encoded_size: root_esize, content_size: 0 },
            Kind::Meta,
        )?;
        let root = Manifest::parse(&root_bytes)?;
        let mut base_span = None;
        root.for_each_file(|path, spans| {
            if path == "base" {
                base_span = Some(spans[0]);
            }
        })?;
        let base_span = base_span.ok_or_else(|| Error::Layout("no `base` manifest in vfs-root".into()))?;
        let base_bytes = storage.read_span(&base_span, Kind::Meta)?;
        let base = Manifest::parse(&base_bytes)?;
        let (mut meta, mut payload, mut paylow, mut files) =
            (HashMap::new(), HashMap::new(), HashMap::new(), HashMap::new());
        base.for_each_file(|path, spans| {
            let span = spans[0];
            match path.split_once('/') {
                Some(("meta", id)) => insert_id(&mut meta, id, span),
                Some(("payload", id)) => insert_id(&mut payload, id, span),
                Some(("paylow", id)) => insert_id(&mut paylow, id, span),
                Some(("child", _)) => {}
                _ => {
                    files.insert(path.to_string(), span);
                }
            }
        })?;
        storage.meta = meta;
        storage.payload = payload;
        storage.paylow = paylow;
        storage.files = files;
        Ok(storage)
    }

    pub fn meta_count(&self) -> usize {
        self.meta.len()
    }

    pub fn has_payload(&self, sno: u32) -> bool {
        self.payload.contains_key(&sno)
    }

    pub fn read_meta(&self, sno: u32) -> Result<Vec<u8>> {
        let span = self.meta.get(&sno).ok_or_else(|| Error::NotFound(format!("meta/{sno}")))?;
        self.read_span(span, Kind::Meta)
    }

    pub fn read_payload(&self, sno: u32) -> Result<Vec<u8>> {
        let span = self
            .payload
            .get(&sno)
            .or_else(|| self.paylow.get(&sno))
            .ok_or_else(|| Error::NotFound(format!("payload/{sno}")))?;
        self.read_span(span, Kind::Payload)
    }

    pub fn read_file(&self, name: &str) -> Result<Vec<u8>> {
        let span = self.files.get(name).ok_or_else(|| Error::NotFound(name.to_string()))?;
        self.read_span(span, Kind::Meta)
    }

    fn read_span(&self, span: &Span, kind: Kind) -> Result<Vec<u8>> {
        let loc = self.layouts.locate(&self.data_dir, &span.ekey, kind)?;
        let mut f = File::open(&loc.file).map_err(|source| Error::IoAt { path: loc.file.clone(), source })?;
        f.seek(SeekFrom::Start(loc.offset))?;
        let mut raw = vec![0u8; span.encoded_size as usize];
        f.read_exact(&mut raw).map_err(|source| Error::IoAt { path: loc.file.clone(), source })?;
        blte::decode(&raw, span.content_size as usize)
    }
}

fn insert_id(map: &mut HashMap<u32, Span>, id: &str, span: Span) {
    if let Ok(n) = id.parse::<u32>() {
        map.insert(n, span);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_build_config() {
        let cfg = parse_config("# Static Build Configuration\n\nvfs-root = aa bb\nkey-layout-0 = 8 14 32 0\n");
        assert_eq!(cfg.get("vfs-root").unwrap(), "aa bb");
        assert_eq!(cfg.get("key-layout-0").unwrap(), "8 14 32 0");
        assert!(!cfg.contains_key("# Static Build Configuration"));
    }
}
