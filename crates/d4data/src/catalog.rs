//! Builds Grimtome's typed game catalog (and the icon export plan) from raw SNOs.
//!
//! Icons are resolved by *reference scanning*: an SNO that shows an icon stores the
//! 32-bit hash of an atlas frame. Instead of hard-coding struct offsets (which move
//! between patches) we scan each definition for values that match a known frame
//! hash in the relevant atlas family (`2DUI_Skills_*`, `2DInventory_*`, …).

use crate::error::Result;
use crate::groups;
use crate::packed::PackedSnoFile;
use crate::storage::StaticStorage;
use crate::strings;
use crate::texture::TextureDef;
use crate::toc::CoreToc;
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};

pub const CATALOG_SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassEntry {
    pub id: String,
    pub key: String,
    pub name: String,
    pub icon: Option<String>,
    pub emblem: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillEntry {
    pub id: String,
    pub class: String,
    pub sno: u32,
    pub name: String,
    pub summary: Option<String>,
    pub upgrades: Vec<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UniqueEntry {
    pub id: String,
    pub sno: u32,
    pub name: String,
    pub slot: String,
    pub class: Option<String>,
    pub power: Option<String>,
    pub flavor: Option<String>,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AspectEntry {
    pub id: String,
    pub sno: u32,
    pub name: String,
    pub class: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GlyphEntry {
    pub id: String,
    pub sno: u32,
    pub name: String,
    pub icon: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoardEntry {
    pub id: String,
    pub sno: u32,
    pub name: String,
    pub class: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AffixTemplate {
    pub key: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub schema_version: u32,
    pub game_build: Option<String>,
    pub locale: String,
    pub classes: Vec<ClassEntry>,
    pub skills: Vec<SkillEntry>,
    pub uniques: Vec<UniqueEntry>,
    pub aspects: Vec<AspectEntry>,
    pub glyphs: Vec<GlyphEntry>,
    pub paragon_boards: Vec<BoardEntry>,
    pub affix_templates: Vec<AffixTemplate>,
}

/// One icon/texture to write to the cache. `frame: None` exports the whole texture;
/// `compose` assembles several frames of the texture into one image instead.
#[derive(Debug, Clone)]
pub struct AssetJob {
    pub id: String,
    pub category: &'static str,
    pub texture: u32,
    pub frame: Option<usize>,
    pub max_px: Option<u32>,
    pub compose: Option<Compose>,
}

/// Frames laid out row-major in a grid of `cols` columns (`None` leaves the cell
/// transparent). Column widths and row heights are the largest frame in each.
/// Used to turn the game's split panel pieces into one CSS `border-image` source.
#[derive(Debug, Clone)]
pub struct Compose {
    pub cols: usize,
    pub frames: Vec<Option<usize>>,
}

/// Class key, display name, frame in `2DUI_ClassIcons`, frame in `2DUI_ClassIcons_Rendered`.
const CLASSES: &[(&str, &str, usize, Option<usize>)] = &[
    ("barbarian", "Barbarian", 0, Some(6)),
    ("druid", "Druid", 1, Some(0)),
    ("necromancer", "Necromancer", 2, Some(1)),
    ("rogue", "Rogue", 3, Some(2)),
    ("sorcerer", "Sorcerer", 4, Some(3)),
    ("paladin", "Paladin", 5, Some(5)),
    ("spiritborn", "Spiritborn", 13, Some(4)),
    ("warlock", "Warlock", 22, None),
];

/// UI atlases exported for the native theme: every frame, plus the whole texture
/// when it is a single image.
pub const UI_TEXTURES: &[&str] = &[
    "2DUIControls",
    "2DUIFontIcon",
    "2DUI_Breaklines",
    "2DUI_GameOptions",
    "2DUI_HorizontalSpikedDivider",
    "2DUI_InventoryGrid",
    "2DUI_ListBanner",
    "2DUI_MenuNav",
    "2DUI_MiniToasts",
    "2DUI_Paragon_transparentElements",
    "2DUI_PaperDoll_EmptySlotIcons",
    "2DUI_ProgressBar",
    "2DUI_ProgressBars",
    "2DUI_RadioButtons_Fancy",
    "2DUI_SelectionHighlight",
    "2DUI_SkillTree_ABCDFrames",
    "2DUI_Skills",
    "2DUI_SmallTabs",
    "2DUI_Social_Frame",
    "2DUI_Social_Header",
    "2DUI_TitleLaurels",
    "2DUI_TooltipBaseBackground",
    "2DUI_Tooltip_Icons",
    "2DUI_Vendor",
    "2DUI_cursor_small",
    "2DUITiled_HorizontalFrameDivider",
    "2DUI_TooltipBackgroundRarity_Common",
    "2DUI_TooltipBackgroundRarity_Magic",
    "2DUI_TooltipBackgroundRarity_Rare",
    "2DUI_TooltipBackgroundRarity_Legendary",
    "2DUI_TooltipBackgroundRarity_Unique",
    "2DUI_TooltipBackgroundRarity_Mythic",
    "2DInventory_ItemRarities",
    "2DUIItemComponents",
    "2DUITooltip",
    "2DUITooltipItemGeneral",
    "2DUITiled_HellGothicBase",
    "2DUITiled_HellGothicInsetBorder",
    "2DUITiled_StoneBaseTile",
    "2DUITiled_TooltipFrame",
    "2DUITiled_HorizontalDivider",
    "2DUITiled_HorizontalDivider_CenterGem",
    "2DUITiled_FrameEdgeVertical",
    "2DUITiled_InnerShadow",
    "2DUITiled_SelectionHighlight",
    "2DUI_Frames",
    "2DUI_Frames_Panel",
    "2DUI_Frames_Modal",
    "2DUI_Frames_sharedElements",
    "2DUI_MetalFrameBorder",
    "2DUI_HorizontalDividerSpiked",
    "2DUI_Center_Divider",
    "2DUI_Button_Large_Fancy",
    "2DUI_Buttons",
    "2DUI_Buttons_sharedElements",
    "2DUI_PanelInnerShadow",
    "2DUI_ClassIcons",
    "2DUI_ParagonGlyphs",
    "2DUI_TalentSkill_Nodes",
    "2DUI_Aspect_Tab_Icons",
    "2DUI_InventoryTabIcons",
];

const NINE_SLICE: &[Option<usize>] = &[Some(7), Some(6), Some(8), Some(3), Some(4), Some(5), Some(1), Some(0), Some(2)];

/// Split panel pieces assembled into single 9-slice images:
/// (asset id, texture, expected frame count, columns, frames).
/// The expected count guards against atlas layout changes in a future patch.
pub const COMPOSITES: &[(&str, &str, usize, usize, &[Option<usize>])] = &[
    ("ui.nine.panel", "2DUI_TooltipBaseBackground", 9, 3, NINE_SLICE),
    (
        "ui.nine.frame-iron",
        "2DUI_Social_Frame",
        15,
        3,
        &[Some(10), Some(11), Some(12), Some(7), None, Some(6), Some(1), Some(2), Some(3)],
    ),
    (
        "ui.nine.selection",
        "2DUI_SelectionHighlight",
        12,
        3,
        &[Some(5), Some(6), Some(7), Some(3), None, Some(4), Some(0), Some(1), Some(2)],
    ),
    ("ui.nine.tooltip-common", "2DUI_TooltipBackgroundRarity_Common", 9, 3, NINE_SLICE),
    ("ui.nine.tooltip-magic", "2DUI_TooltipBackgroundRarity_Magic", 9, 3, NINE_SLICE),
    ("ui.nine.tooltip-rare", "2DUI_TooltipBackgroundRarity_Rare", 9, 3, NINE_SLICE),
    ("ui.nine.tooltip-legendary", "2DUI_TooltipBackgroundRarity_Legendary", 9, 3, NINE_SLICE),
    ("ui.nine.tooltip-unique", "2DUI_TooltipBackgroundRarity_Unique", 9, 3, NINE_SLICE),
    ("ui.nine.tooltip-mythic", "2DUI_TooltipBackgroundRarity_Mythic", 9, 3, NINE_SLICE),
];

/// Large illustrations exported (downscaled) for hero banners.
pub const ART_TEXTURES: &[&str] = &[
    "2DUI_LoadingScreen_Season15_01",
    "2DUI_LoadingScreen_Season15_02",
    "2DUI_LoadingScreen_Season15_03",
    "2DUI_LoadingScreen_Season15_04",
    "2DUI_LoadingScreen_Season15_05",
    "2DUI_LoadingScreen_Season15_06",
    "2DUI_LoadingScreen_Season15_07",
    "2DUI_LoadingScreen_Season15_08",
    "2DUI_ClassIcons_Rendered",
];

pub struct GameData {
    pub storage: StaticStorage,
    pub toc: CoreToc,
    pub textures: PackedSnoFile,
    pub strings: PackedSnoFile,
    pub locale: String,
    string_ids: HashMap<String, u32>,
    string_ids_lower: HashMap<String, u32>,
    texture_ids: HashMap<String, u32>,
    /// frame hash → (texture sno, frame index); only for 2D UI/inventory atlases.
    frame_index: HashMap<u32, Vec<(u32, usize)>>,
}

/// Turns arbitrary display text into a stable, lowercase identifier segment.
pub fn slug(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut dash = false;
    for ch in s.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            dash = false;
        } else if (ch == '\'' || ch == '’') && !out.is_empty() {
            continue;
        } else if !dash && !out.is_empty() {
            out.push('-');
            dash = true;
        }
    }
    out.trim_end_matches('-').to_string()
}

fn class_from_token(s: &str) -> Option<&'static str> {
    let l = s.to_ascii_lowercase();
    [
        ("barb", "barbarian"),
        ("druid", "druid"),
        ("necro", "necromancer"),
        ("rogue", "rogue"),
        ("sorc", "sorcerer"),
        ("spirit", "spiritborn"),
        ("paladin", "paladin"),
        ("warlock", "warlock"),
    ]
    .iter()
    .find(|(tok, _)| l.contains(tok))
    .map(|(_, c)| *c)
}

fn slot_from_tokens(name: &str) -> Option<&'static str> {
    for tok in name.split('_') {
        let slot = match tok.to_ascii_lowercase().as_str() {
            "helm" => "helm",
            "chest" => "chest",
            "gloves" | "glove" => "gloves",
            "pants" | "legs" => "pants",
            "boots" => "boots",
            "amulet" => "amulet",
            "ring" => "ring",
            "1hshield" | "1hfocus" | "1htotem" | "offhandtotem" => "offhand",
            t if t.starts_with("1h") || t.starts_with("2h") || t == "quarterstaff" || t == "glaive" => "weapon",
            _ => continue,
        };
        return Some(slot);
    }
    None
}

/// Strips markup from a display name and rejects placeholders / work-in-progress entries.
fn clean_name(raw: &str) -> Option<String> {
    let name = strings::strip_markup(raw).replace('\u{a0}', " ");
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    let lower = name.to_ascii_lowercase();
    const REJECT: &[&str] = &["wip", "(ph)", "[ph]", "(nyi)", "placeholder", "(crucible)", "upgrade a", "upgrade b"];
    if name.is_empty() || REJECT.iter().any(|r| lower.contains(r)) {
        return None;
    }
    Some(name)
}

fn le32_at(d: &[u8], off: usize) -> u32 {
    u32::from_le_bytes([d[off], d[off + 1], d[off + 2], d[off + 3]])
}

impl GameData {
    pub fn open(storage: StaticStorage, locale: &str) -> Result<Self> {
        let keep = [
            groups::ACTOR,
            groups::POWER,
            groups::STRING_LIST,
            groups::TEXTURE,
            groups::ITEM,
            groups::AFFIX,
            groups::PARAGON_BOARD,
            groups::PARAGON_GLYPH,
            groups::ASPECT,
        ];
        let toc = CoreToc::parse(&storage.read_file("CoreTOC.dat")?, &keep)?;
        let textures = PackedSnoFile::parse(storage.read_file("Texture-Base-Global.dat")?)?;
        let strings = PackedSnoFile::parse(storage.read_file(&format!("StringList-Text-{locale}.dat"))?)?;
        let string_ids: HashMap<String, u32> =
            toc.group(groups::STRING_LIST).map(|(id, n)| (n.to_string(), id)).collect();
        let string_ids_lower = string_ids.iter().map(|(k, v)| (k.to_ascii_lowercase(), *v)).collect();
        let texture_ids: HashMap<String, u32> = toc.group(groups::TEXTURE).map(|(id, n)| (n.to_string(), id)).collect();
        let mut frame_index: HashMap<u32, Vec<(u32, usize)>> = HashMap::new();
        for (name, id) in &texture_ids {
            if !(name.starts_with("2DUI") || name.starts_with("2DInventory")) {
                continue;
            }
            let Some(def) = textures.get(*id).and_then(|d| TextureDef::parse(d).ok()) else { continue };
            for (i, f) in def.frames.iter().enumerate() {
                if f.hash > 0xFFFF {
                    frame_index.entry(f.hash).or_default().push((*id, i));
                }
            }
        }
        Ok(Self {
            storage,
            toc,
            textures,
            strings,
            locale: locale.to_string(),
            string_ids,
            string_ids_lower,
            texture_ids,
            frame_index,
        })
    }

    pub fn texture_id(&self, name: &str) -> Option<u32> {
        self.texture_ids.get(name).copied()
    }

    pub fn texture_def(&self, sno: u32) -> Option<TextureDef> {
        self.textures.get(sno).and_then(|d| TextureDef::parse(d).ok())
    }

    pub fn texture_name(&self, sno: u32) -> Option<&str> {
        self.toc.name(groups::TEXTURE, sno)
    }

    /// Loads a StringList by SNO name, trying the exact name then a lowercase match.
    pub fn string_list(&self, name: &str) -> Option<HashMap<String, String>> {
        let id =
            self.string_ids.get(name).or_else(|| self.string_ids_lower.get(&name.to_ascii_lowercase())).copied()?;
        strings::parse(self.strings.get(id)?).ok()
    }

    /// First frame referenced by `def` that lives in a texture whose name starts with `prefix`.
    pub fn find_frame_ref(&self, def: &[u8], prefix: &str) -> Option<(u32, usize)> {
        (0..def.len().saturating_sub(3)).step_by(4).find_map(|off| {
            let v = le32_at(def, off);
            if v <= 0xFFFF {
                return None;
            }
            self.frame_index
                .get(&v)?
                .iter()
                .copied()
                .find(|(tex, _)| self.texture_name(*tex).is_some_and(|n| n.starts_with(prefix)))
        })
    }

    fn first_ref_in_group(&self, def: &[u8], group: u32) -> Option<u32> {
        (0..def.len().saturating_sub(3))
            .step_by(4)
            .map(|off| le32_at(def, off))
            .find(|v| *v > 0 && self.toc.contains(group, *v))
    }

    pub fn build_catalog(&self, game_build: Option<String>) -> Result<(Catalog, Vec<AssetJob>)> {
        let mut jobs = Vec::new();
        let classes = self.classes(&mut jobs);
        let skills = self.skills(&mut jobs);
        let uniques = self.uniques(&mut jobs);
        let aspects = self.aspects();
        let glyphs = self.glyphs(&mut jobs);
        let paragon_boards = self.boards();
        let affix_templates = self.affix_templates();
        self.ui_jobs(&mut jobs);
        Ok((
            Catalog {
                schema_version: CATALOG_SCHEMA_VERSION,
                game_build,
                locale: self.locale.clone(),
                classes,
                skills,
                uniques,
                aspects,
                glyphs,
                paragon_boards,
                affix_templates,
            },
            jobs,
        ))
    }

    fn classes(&self, jobs: &mut Vec<AssetJob>) -> Vec<ClassEntry> {
        let icons = self.texture_id("2DUI_ClassIcons");
        let icon_frames = icons.and_then(|t| self.texture_def(t)).map(|d| d.frames.len()).unwrap_or(0);
        let rendered = self.texture_id("2DUI_ClassIcons_Rendered");
        let rendered_frames = rendered.and_then(|t| self.texture_def(t)).map(|d| d.frames.len()).unwrap_or(0);
        CLASSES
            .iter()
            .map(|(key, name, frame, emblem_frame)| {
                // Frame positions are only trusted for the atlas shapes they were verified on.
                let icon = (icon_frames == 24).then(|| {
                    let id = format!("class.{key}");
                    jobs.push(AssetJob {
                        id: id.clone(),
                        category: "classes",
                        texture: icons.unwrap(),
                        frame: Some(*frame),
                        max_px: None,
                        compose: None,
                    });
                    id
                });
                let emblem = emblem_frame.filter(|_| rendered_frames == 7).map(|f| {
                    let id = format!("class.{key}.emblem");
                    jobs.push(AssetJob {
                        id: id.clone(),
                        category: "classes",
                        texture: rendered.unwrap(),
                        frame: Some(f),
                        max_px: Some(768),
                        compose: None,
                    });
                    id
                });
                ClassEntry { id: format!("class.{key}"), key: key.to_string(), name: name.to_string(), icon, emblem }
            })
            .collect()
    }

    fn skills(&self, jobs: &mut Vec<AssetJob>) -> Vec<SkillEntry> {
        let powers: Vec<(u32, String)> = self.toc.group(groups::POWER).map(|(id, n)| (id, n.to_string())).collect();
        let found: Vec<(String, String, u32, String, (u32, usize), HashMap<String, String>)> = powers
            .par_iter()
            .filter_map(|(sno, sno_name)| {
                let strings = self.string_list(&format!("Power_{sno_name}"))?;
                let name = clean_name(strings.get("name")?)?;
                let meta = self.storage.read_meta(*sno).ok()?;
                let frame = self.find_frame_ref(&meta, "2DUI_Skills_")?;
                let atlas = self.texture_name(frame.0)?;
                let class = class_from_token(atlas.trim_start_matches("2DUI_Skills_"))?;
                Some((class.to_string(), name, *sno, sno_name.clone(), frame, strings))
            })
            .collect();
        // Several powers can share a display name (seasonal variants). Prefer the
        // canonical one, i.e. the shortest SNO name that starts with a class prefix.
        let mut best: BTreeMap<(String, String), (u32, String, (u32, usize), HashMap<String, String>)> =
            BTreeMap::new();
        for (class, name, sno, sno_name, frame, strings) in found {
            let key = (class, slug(&name));
            let better = match best.get(&key) {
                None => true,
                Some((_, cur, _, _)) => {
                    let score = |s: &str| {
                        (
                            s.contains("_S0")
                                || s.starts_with('S') && s.as_bytes().get(1).is_some_and(u8::is_ascii_digit),
                            s.len(),
                        )
                    };
                    score(&sno_name) < score(cur)
                }
            };
            if better {
                best.insert(key, (sno, sno_name, frame, strings));
            }
        }
        best.into_iter()
            .map(|((class, name_slug), (sno, _, frame, strings))| {
                let id = format!("skill.{class}.{name_slug}");
                jobs.push(AssetJob {
                    id: id.clone(),
                    category: "skills",
                    texture: frame.0,
                    frame: Some(frame.1),
                    max_px: None,
                    compose: None,
                });
                let mut upgrades: Vec<(usize, String)> = strings
                    .iter()
                    .filter_map(|(k, v)| {
                        let idx = k.strip_prefix("Mod")?.strip_suffix("_Name")?.parse::<usize>().ok()?;
                        Some((idx, clean_name(v)?))
                    })
                    .collect();
                upgrades.sort();
                SkillEntry {
                    id: id.clone(),
                    class,
                    sno,
                    name: clean_name(&strings["name"]).unwrap_or_default(),
                    summary: strings.get("simple_desc").map(|s| strings::strip_markup(s)).filter(|s| !s.is_empty()),
                    upgrades: upgrades.into_iter().map(|(_, v)| v).collect(),
                    icon: Some(id),
                }
            })
            .collect()
    }

    fn item_icon(&self, meta: &[u8]) -> Option<(u32, usize)> {
        self.find_frame_ref(meta, "2DInventory").or_else(|| {
            let actor = self.first_ref_in_group(meta, groups::ACTOR)?;
            let actor_meta = self.storage.read_meta(actor).ok()?;
            self.find_frame_ref(&actor_meta, "2DInventory")
        })
    }

    fn uniques(&self, jobs: &mut Vec<AssetJob>) -> Vec<UniqueEntry> {
        const SKIP: &[&str] =
            &["test", "template", "qst", "noPowers", "boost", "gambling", "cosmetic", "talisman", "_ph"];
        let items: Vec<(u32, String)> = self
            .toc
            .group(groups::ITEM)
            .filter(|(_, n)| n.contains("_Unique_"))
            .filter(|(_, n)| {
                let l = n.to_ascii_lowercase();
                !SKIP.iter().any(|s| l.contains(&s.to_ascii_lowercase()))
            })
            .map(|(id, n)| (id, n.to_string()))
            .collect();
        let found: Vec<(UniqueEntry, Option<(u32, usize)>, String)> = items
            .par_iter()
            .filter_map(|(sno, sno_name)| {
                let strings = self.string_list(&format!("Item_{sno_name}"))?;
                let name = clean_name(strings.get("Name")?)?;
                let slot = slot_from_tokens(sno_name)?;
                let class = sno_name
                    .split("_Unique_")
                    .nth(1)
                    .and_then(|rest| rest.split('_').next())
                    .and_then(class_from_token)
                    .map(str::to_string);
                let power = self
                    .string_list(&format!("Affix_{sno_name}"))
                    .and_then(|s| s.get("Desc").map(|d| strings::strip_markup(d)))
                    .filter(|s| !s.is_empty());
                let meta = self.storage.read_meta(*sno).ok()?;
                let icon = self.item_icon(&meta);
                Some((
                    UniqueEntry {
                        id: format!("item.{}", slug(&name)),
                        sno: *sno,
                        name,
                        slot: slot.to_string(),
                        class,
                        power,
                        flavor: strings.get("Flavor").map(|f| strings::strip_markup(f)).filter(|s| !s.is_empty()),
                        icon: None,
                    },
                    icon,
                    sno_name.clone(),
                ))
            })
            .collect();
        let mut best: BTreeMap<String, (UniqueEntry, Option<(u32, usize)>, String)> = BTreeMap::new();
        for (entry, icon, sno_name) in found {
            let seasonal = |s: &str| {
                s.starts_with('S') && s.as_bytes().get(1).is_some_and(u8::is_ascii_digit) || s.starts_with("X2_")
            };
            let better = match best.get(&entry.id) {
                None => true,
                Some((cur, cur_icon, cur_name)) => {
                    (icon.is_some(), !seasonal(&sno_name), entry.power.is_some(), std::cmp::Reverse(sno_name.len()))
                        > (
                            cur_icon.is_some(),
                            !seasonal(cur_name),
                            cur.power.is_some(),
                            std::cmp::Reverse(cur_name.len()),
                        )
                }
            };
            if better {
                best.insert(entry.id.clone(), (entry, icon, sno_name));
            }
        }
        best.into_values()
            .map(|(mut entry, icon, _)| {
                if let Some((tex, frame)) = icon {
                    jobs.push(AssetJob {
                        id: entry.id.clone(),
                        category: "items",
                        texture: tex,
                        frame: Some(frame),
                        max_px: None,
                        compose: None,
                    });
                    entry.icon = Some(entry.id.clone());
                }
                entry
            })
            .collect()
    }

    fn aspects(&self) -> Vec<AspectEntry> {
        let list: Vec<(u32, String)> = self.toc.group(groups::ASPECT).map(|(id, n)| (id, n.to_string())).collect();
        let mut out: Vec<AspectEntry> = list
            .par_iter()
            .filter_map(|(sno, sno_name)| {
                let meta = self.storage.read_meta(*sno).ok()?;
                let affix = self.first_ref_in_group(&meta, groups::AFFIX)?;
                let affix_name = self.toc.name(groups::AFFIX, affix)?;
                let strings = self.string_list(&format!("Affix_{affix_name}"))?;
                let raw = strings.get("Name")?.trim();
                if raw.is_empty() {
                    return None;
                }
                let name = if raw.to_ascii_lowercase().starts_with("of ") {
                    format!("Aspect {raw}")
                } else if raw.to_ascii_lowercase().contains("aspect") {
                    raw.to_string()
                } else {
                    format!("{raw} Aspect")
                };
                Some(AspectEntry {
                    id: format!("aspect.{}", slug(&name)),
                    sno: *sno,
                    class: class_from_token(sno_name.trim_start_matches("Asp_Legendary_")).map(str::to_string),
                    description: strings
                        .get("CodexDesc")
                        .or_else(|| strings.get("Desc"))
                        .map(|d| strings::strip_markup(d))
                        .filter(|s| !s.is_empty()),
                    name,
                })
            })
            .collect();
        out.sort_by(|a, b| a.id.cmp(&b.id));
        out.dedup_by(|a, b| a.id == b.id);
        out
    }

    fn glyphs(&self, jobs: &mut Vec<AssetJob>) -> Vec<GlyphEntry> {
        let mut out: Vec<GlyphEntry> = self
            .toc
            .group(groups::PARAGON_GLYPH)
            .filter_map(|(sno, sno_name)| {
                let strings = self.string_list(&format!("Item_ParagonGlyph_{sno_name}"))?;
                let raw = clean_name(strings.get("Name")?)?;
                let name = match raw.split_once(": ") {
                    Some((prefix, rest)) if prefix.chars().count() <= 12 && !rest.is_empty() => rest.to_string(),
                    _ => raw,
                };
                let meta = self.storage.read_meta(sno).ok()?;
                let icon = self.find_frame_ref(&meta, "2DUI_ParagonGlyphs");
                Some((GlyphEntry { id: format!("paragon.glyph.{}", slug(&name)), sno, name, icon: None }, icon))
            })
            .map(|(mut g, icon)| {
                if let Some((tex, frame)) = icon {
                    if !jobs.iter().any(|j| j.id == g.id) {
                        jobs.push(AssetJob {
                            id: g.id.clone(),
                            category: "paragon",
                            texture: tex,
                            frame: Some(frame),
                            max_px: None,
                            compose: None,
                        });
                    }
                    g.icon = Some(g.id.clone());
                }
                g
            })
            .collect();
        out.sort_by(|a, b| a.id.cmp(&b.id));
        out.dedup_by(|a, b| a.id == b.id);
        out
    }

    fn boards(&self) -> Vec<BoardEntry> {
        let mut out: Vec<BoardEntry> = self
            .toc
            .group(groups::PARAGON_BOARD)
            .filter_map(|(sno, sno_name)| {
                let strings = self.string_list(&format!("ParagonBoard_{sno_name}"))?;
                let name = strings
                    .get("Name")
                    .or_else(|| strings.get("name"))
                    .filter(|n| !n.trim().is_empty())?
                    .trim()
                    .to_string();
                let class = class_from_token(sno_name.trim_start_matches("Paragon_")).map(str::to_string);
                let id = format!("paragon.board.{}.{}", class.as_deref().unwrap_or("any"), slug(&name));
                Some(BoardEntry { id, sno, name, class })
            })
            .collect();
        out.sort_by(|a, b| a.id.cmp(&b.id));
        out.dedup_by(|a, b| a.id == b.id);
        out
    }

    fn affix_templates(&self) -> Vec<AffixTemplate> {
        let mut out: Vec<AffixTemplate> = self
            .string_list("AttributeDescriptions")
            .unwrap_or_default()
            .into_iter()
            .map(|(key, text)| AffixTemplate { key, text: strings::strip_markup(&text) })
            .filter(|t| !t.text.is_empty())
            .collect();
        out.sort_by(|a, b| a.key.cmp(&b.key));
        out
    }

    fn ui_jobs(&self, jobs: &mut Vec<AssetJob>) {
        for name in UI_TEXTURES {
            let Some(tex) = self.texture_id(name) else { continue };
            let Some(def) = self.texture_def(tex) else { continue };
            let base = format!("ui.{}", slug(name.trim_start_matches("2DUI").trim_start_matches('_')));
            if def.frames.len() <= 1 {
                jobs.push(AssetJob {
                    id: base.clone(),
                    category: "ui",
                    texture: tex,
                    frame: None,
                    max_px: None,
                    compose: None,
                });
            } else {
                for i in 0..def.frames.len() {
                    jobs.push(AssetJob {
                        id: format!("{base}.{i}"),
                        category: "ui",
                        texture: tex,
                        frame: Some(i),
                        max_px: None,
                        compose: None,
                    });
                }
            }
        }
        for (id, name, expected, cols, frames) in COMPOSITES {
            let Some(tex) = self.texture_id(name) else { continue };
            if self.texture_def(tex).map(|d| d.frames.len()) != Some(*expected) {
                continue;
            }
            jobs.push(AssetJob {
                id: id.to_string(),
                category: "ui",
                texture: tex,
                frame: None,
                max_px: None,
                compose: Some(Compose { cols: *cols, frames: frames.to_vec() }),
            });
        }
        for name in ART_TEXTURES {
            if let Some(tex) = self.texture_id(name) {
                let id = format!("art.{}", slug(name.trim_start_matches("2DUI_")));
                jobs.push(AssetJob {
                    id,
                    category: "art",
                    texture: tex,
                    frame: None,
                    max_px: Some(2048),
                    compose: None,
                });
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slugs_are_stable() {
        assert_eq!(slug("Bash"), "bash");
        assert_eq!(slug("Fists of Fate"), "fists-of-fate");
        assert_eq!(slug("Tal Rasha's Iridescent Loop"), "tal-rashas-iridescent-loop");
        assert_eq!(slug("  Ice Spikes  "), "ice-spikes");
    }

    #[test]
    fn derives_slots_and_classes() {
        assert_eq!(slot_from_tokens("S10_Helm_Unique_Barb_001"), Some("helm"));
        assert_eq!(slot_from_tokens("2HBow_Unique_Rogue_006"), Some("weapon"));
        assert_eq!(slot_from_tokens("1HShield_Unique_Paladin_001"), Some("offhand"));
        assert_eq!(slot_from_tokens("Ring_Unique_Sorc_100"), Some("ring"));
        assert_eq!(class_from_token("Sorceress"), Some("sorcerer"));
        assert_eq!(class_from_token("Spiritborn"), Some("spiritborn"));
        assert_eq!(class_from_token("Generic"), None);
    }

    #[test]
    fn cleans_display_names() {
        assert_eq!(clean_name("{c_red}WIP Shield Charge{/c}"), None);
        assert_eq!(clean_name(" Bash "), Some("Bash".into()));
        assert_eq!(clean_name("{c_important}Blood Lance{/c}"), Some("Blood Lance".into()));
        assert_eq!(clean_name("(PH) Clobber"), None);
        assert_eq!(clean_name("Bane of\u{a0}Ahjad-Den"), Some("Bane of Ahjad-Den".into()));
    }
}
