//! Encoded-key → physical file location, for the Steam "static container" layout.
//!
//! In this layout the last 7 bytes of every 16-byte encoding key are a bit-packed
//! location instead of hash material:
//!
//! ```text
//! bits 55..54  layout index (`key-layout-index-bits = 2` in .build.config)
//! bits 53..46  storage folder number (Data/000, Data/020, …)
//! bits 45..0   layout-specific fields
//! ```
//!
//! `.build.config` declares each layout as `folder_bits a_bits b_bits unit`. Three
//! shapes are known and are matched by their field widths, not their index:
//!
//! | widths      | file name                         | offset         |
//! |-------------|-----------------------------------|----------------|
//! | 8 14 32 u   | `0x{container:04x}-{kind}.dat`    | `b * max(u,1)` |
//! | 8 46 0 0    | `{id}-{kind}.dat` / `{id}-{n:04}.dat` | 0          |
//! | 8 24 22 u   | `{id}-child.dat`                  | `b * u`        |

use crate::error::{Error, Result};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct KeyLayout {
    pub folder_bits: u32,
    pub a_bits: u32,
    pub b_bits: u32,
    pub unit: u64,
}

/// What a TVFS path refers to; decides the `-{kind}.dat` suffix.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Kind {
    Meta,
    Payload,
    Child,
}

impl Kind {
    fn suffix(self) -> &'static str {
        match self {
            Kind::Meta => "meta",
            Kind::Payload => "payload",
            Kind::Child => "child",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Location {
    pub file: PathBuf,
    pub offset: u64,
}

#[derive(Debug, Clone)]
pub struct KeyLayouts {
    pub index_bits: u32,
    pub layouts: Vec<KeyLayout>,
}

impl KeyLayouts {
    /// Parses `key-layout-*` entries from `.build.config` key/value pairs.
    pub fn from_config(cfg: &std::collections::HashMap<String, String>) -> Result<Self> {
        let index_bits: u32 = cfg
            .get("key-layout-index-bits")
            .and_then(|v| v.trim().parse().ok())
            .ok_or_else(|| Error::Layout("missing key-layout-index-bits".into()))?;
        let mut layouts = Vec::new();
        for i in 0..(1u32 << index_bits) {
            let raw = cfg
                .get(&format!("key-layout-{i}"))
                .ok_or_else(|| Error::Layout(format!("missing key-layout-{i}")))?;
            let nums: Vec<u64> = raw.split_whitespace().filter_map(|n| n.parse().ok()).collect();
            if nums.len() != 4 {
                return Err(Error::Layout(format!("key-layout-{i} has {} fields", nums.len())));
            }
            let layout = KeyLayout {
                folder_bits: nums[0] as u32,
                a_bits: nums[1] as u32,
                b_bits: nums[2] as u32,
                unit: nums[3],
            };
            if layout.folder_bits + layout.a_bits + layout.b_bits + index_bits != 56 {
                return Err(Error::Layout(format!("key-layout-{i} does not span 56 bits")));
            }
            layouts.push(layout);
        }
        Ok(Self { index_bits, layouts })
    }

    pub fn locate(&self, data_dir: &Path, ekey: &[u8; 16], kind: Kind) -> Result<Location> {
        let mut v: u64 = 0;
        for b in &ekey[9..16] {
            v = (v << 8) | *b as u64;
        }
        let layout_idx = (v >> (56 - self.index_bits)) as usize;
        let layout = self.layouts[layout_idx];
        let rest_bits = 56 - self.index_bits;
        let folder = (v >> (rest_bits - layout.folder_bits)) & ((1 << layout.folder_bits) - 1);
        let field_bits = layout.a_bits + layout.b_bits;
        let fields = v & ((1u64 << field_bits) - 1);
        let a = fields >> layout.b_bits;
        let b = if layout.b_bits == 0 { 0 } else { fields & ((1u64 << layout.b_bits) - 1) };
        let dir = data_dir.join(format!("{folder:03}"));
        let (name, offset) = match (layout.a_bits, layout.b_bits) {
            (14, 32) => (
                format!("0x{a:04x}-{}.dat", kind.suffix()),
                b * layout.unit.max(1),
            ),
            (46, 0) => {
                let id = a >> 16;
                let sub = a & 0xFFFF;
                if sub == 0 {
                    (format!("{id}-{}.dat", kind.suffix()), 0)
                } else {
                    (format!("{id}-{:04}.dat", sub - 1), 0)
                }
            }
            (24, 22) => (format!("{a}-child.dat"), b * layout.unit.max(1)),
            (aa, bb) => {
                return Err(Error::Layout(format!("unknown key layout shape {aa}/{bb}")));
            }
        };
        Ok(Location { file: dir.join(name), offset })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn layouts() -> KeyLayouts {
        let mut cfg = HashMap::new();
        cfg.insert("key-layout-index-bits".into(), "2".into());
        cfg.insert("key-layout-0".into(), "8 14 32 0".into());
        cfg.insert("key-layout-1".into(), "8 46 0 0".into());
        cfg.insert("key-layout-2".into(), "8 24 22 4096".into());
        cfg.insert("key-layout-3".into(), "8 14 32 4096".into());
        KeyLayouts::from_config(&cfg).unwrap()
    }

    fn key(hex_str: &str) -> [u8; 16] {
        hex::decode(hex_str).unwrap().try_into().unwrap()
    }

    #[test]
    fn container_layout_uses_byte_offsets() {
        let loc = layouts()
            .locate(Path::new("D"), &key("0b9ab6a0b63b451da800000102b4ca5b"), Kind::Meta)
            .unwrap();
        assert_eq!(loc.file, Path::new("D").join("000").join("0x0001-meta.dat"));
        assert_eq!(loc.offset, 0x02b4ca5b);
    }

    #[test]
    fn standalone_layout_names_files_by_id() {
        let l = layouts();
        let p = l.locate(Path::new("D"), &key("00000000000000000040402469e80000"), Kind::Payload).unwrap();
        assert_eq!(p.file, Path::new("D").join("001").join("2386408-payload.dat"));
        let c = l.locate(Path::new("D"), &key("00000000000000000042001028e8011c"), Kind::Child).unwrap();
        assert_eq!(c.file, Path::new("D").join("008").join("1059048-0283.dat"));
    }

    #[test]
    fn child_pack_layout_uses_4k_units() {
        let loc = layouts()
            .locate(Path::new("D"), &key("cafb097b9d74c00e9b8207c6e7800047"), Kind::Child)
            .unwrap();
        assert_eq!(loc.file, Path::new("D").join("008").join("2038686-child.dat"));
        assert_eq!(loc.offset, 0x47 * 4096);
    }

    #[test]
    fn payload_container_offsets_are_scaled() {
        let loc = layouts()
            .locate(Path::new("D"), &key("c03a2ef5e5b367c96cc0030000427cb9"), Kind::Payload)
            .unwrap();
        assert_eq!(loc.file, Path::new("D").join("000").join("0x0300-payload.dat"));
        assert_eq!(loc.offset, 0x00427cb9 * 4096);
    }
}
