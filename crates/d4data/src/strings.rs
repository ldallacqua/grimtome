//! StringList SNOs: localized `label → text` tables.

use crate::error::{fmt_err, Result};
use std::collections::HashMap;

const ENTRY_SIZE: usize = 40;

fn le32(d: &[u8], at: usize) -> Result<usize> {
    d.get(at..at + 4)
        .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]) as usize)
        .ok_or_else(|| fmt_err("StringList truncated"))
}

fn slice_str(d: &[u8], off: usize, len: usize) -> Result<String> {
    let bytes = d.get(off..off + len).ok_or_else(|| fmt_err("StringList string out of range"))?;
    let end = bytes.iter().position(|b| *b == 0).unwrap_or(bytes.len());
    Ok(String::from_utf8_lossy(&bytes[..end]).into_owned())
}

/// Parses one StringList definition (as stored in a packed `StringList-Text-*.dat`).
pub fn parse(d: &[u8]) -> Result<HashMap<String, String>> {
    let arr_off = le32(d, 0x10)?;
    let arr_size = le32(d, 0x14)?;
    let mut out = HashMap::with_capacity(arr_size / ENTRY_SIZE);
    for i in 0..arr_size / ENTRY_SIZE {
        let e = arr_off + ENTRY_SIZE * i;
        let label = slice_str(d, le32(d, e + 8)?, le32(d, e + 12)?)?;
        let text = slice_str(d, le32(d, e + 24)?, le32(d, e + 28)?)?;
        out.insert(label, text);
    }
    Ok(out)
}

/// Removes Diablo IV's inline markup (`{c_number}`, `{/c}`, `{icon:…}`, `{u}`…),
/// leaving value placeholders such as `[Affix_Value_1|%|]` intact.
pub fn strip_markup(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut depth = 0usize;
    for ch in s.chars() {
        match ch {
            '{' => depth += 1,
            '}' if depth > 0 => depth -= 1,
            _ if depth == 0 => out.push(ch),
            _ => {}
        }
    }
    out.replace("\r\n", "\n").trim().to_string()
}

#[cfg(test)]
pub(crate) fn build_sample(sno: u32, entries: &[(&str, &str)]) -> Vec<u8> {
    let header = 0x20usize;
    let table_len = ENTRY_SIZE * entries.len();
    let mut strings = Vec::new();
    let mut table = Vec::new();
    for (label, text) in entries {
        let lo = header + table_len + strings.len();
        strings.extend(label.as_bytes());
        strings.push(0);
        let to = header + table_len + strings.len();
        strings.extend(text.as_bytes());
        strings.push(0);
        table.extend([0u8; 8]);
        table.extend((lo as u32).to_le_bytes());
        table.extend((label.len() as u32 + 1).to_le_bytes());
        table.extend([0u8; 8]);
        table.extend((to as u32).to_le_bytes());
        table.extend((text.len() as u32 + 1).to_le_bytes());
        table.extend([0u8; 8]);
    }
    let mut d = sno.to_le_bytes().to_vec();
    d.extend([0u8; 12]);
    d.extend((header as u32).to_le_bytes());
    d.extend((table_len as u32).to_le_bytes());
    d.extend([0u8; 8]);
    d.extend(table);
    d.extend(strings);
    d
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_entries() {
        let d = build_sample(1, &[("name", "Bash"), ("Mod0_Name", "Battle Bash")]);
        let m = parse(&d).unwrap();
        assert_eq!(m["name"], "Bash");
        assert_eq!(m["Mod0_Name"], "Battle Bash");
    }

    #[test]
    fn strips_markup_but_keeps_values() {
        let s = "Bash the enemy, dealing {c_number}{payload:MELEE}{/c} damage.\r\n{c_label}Lucky Hit:{/c} [Affix_Value_1|%|]";
        assert_eq!(strip_markup(s), "Bash the enemy, dealing  damage.\nLucky Hit: [Affix_Value_1|%|]");
    }
}
