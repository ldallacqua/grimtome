//! Read-only, offline access to a locally installed copy of Diablo IV.
//!
//! This crate powers Grimtome's *optional* asset importer. It reads the game's
//! own data files from disk (never the running process), decodes UI textures and
//! localized text, and writes a private cache on the user's machine. Nothing it
//! produces is meant to be redistributed — see `docs/COMPLIANCE.md`.
//!
//! Layers, bottom-up:
//! - [`blte`], [`tvfs`], [`keys`], [`storage`]: the Steam "static container" storage.
//! - [`toc`], [`packed`], [`strings`], [`texture`]: Diablo IV's SNO file formats.
//! - [`catalog`]: turns raw SNOs into a typed catalog (skills, uniques, aspects…).
//! - [`export`]: writes icons + `manifest.json` + `catalog.json` to a cache folder.
//!
//! Encrypted content is never decrypted; it is reported as [`Error::Encrypted`] and skipped.

#![allow(clippy::type_complexity)]

pub mod blte;
pub mod catalog;
pub mod error;
pub mod export;
pub mod install;
pub mod keys;
pub mod packed;
pub mod storage;
pub mod strings;
pub mod texture;
pub mod toc;
pub mod tvfs;

pub use error::{Error, Result};

/// Well-known SNO group ids (stable since launch; verified against CoreTOC names).
pub mod groups {
    pub const ACTOR: u32 = 1;
    pub const POWER: u32 = 29;
    pub const STRING_LIST: u32 = 42;
    pub const TEXTURE: u32 = 44;
    pub const ITEM: u32 = 73;
    pub const PLAYER_CLASS: u32 = 74;
    pub const AFFIX: u32 = 104;
    pub const PARAGON_NODE: u32 = 106;
    pub const PARAGON_BOARD: u32 = 108;
    pub const PARAGON_GLYPH: u32 = 111;
    pub const ASPECT: u32 = 128;
}
