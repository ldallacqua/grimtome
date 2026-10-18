//! `CoreTOC.dat`: the table mapping (SNO group, SNO id) → internal asset name.

use crate::error::{fmt_err, Result};
use std::collections::HashMap;

const MAGIC: u32 = 0xBCDE_6611;

#[derive(Debug, Default)]
pub struct CoreToc {
    groups: HashMap<u32, HashMap<u32, String>>,
}

fn le32(d: &[u8], at: usize) -> Result<u32> {
    d.get(at..at + 4)
        .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| fmt_err("CoreTOC truncated"))
}

impl CoreToc {
    /// Parses CoreTOC, keeping only the groups listed in `keep` (all when empty).
    pub fn parse(d: &[u8], keep: &[u32]) -> Result<Self> {
        if le32(d, 0)? != MAGIC {
            return Err(fmt_err("CoreTOC magic mismatch"));
        }
        let n = le32(d, 4)? as usize;
        // Header: counts[n], offsets[n], unknown counts[n], format hashes[n], one u32.
        let counts_at = 8;
        let offsets_at = counts_at + 4 * n;
        let base = 8 + 16 * n + 4;
        let mut groups = HashMap::new();
        for g in 0..n {
            if !keep.is_empty() && !keep.contains(&(g as u32)) {
                continue;
            }
            let count = le32(d, counts_at + 4 * g)? as usize;
            if count == 0 {
                continue;
            }
            let entries_at = base + le32(d, offsets_at + 4 * g)? as usize;
            let names_at = entries_at + 12 * count;
            let mut names = HashMap::with_capacity(count);
            for i in 0..count {
                let e = entries_at + 12 * i;
                let id = le32(d, e + 4)?;
                let name_off = names_at + le32(d, e + 8)? as usize;
                let rest = d.get(name_off..).ok_or_else(|| fmt_err("CoreTOC name out of range"))?;
                let len = rest.iter().position(|b| *b == 0).ok_or_else(|| fmt_err("unterminated name"))?;
                names.insert(id, String::from_utf8_lossy(&rest[..len]).into_owned());
            }
            groups.insert(g as u32, names);
        }
        Ok(Self { groups })
    }

    pub fn name(&self, group: u32, id: u32) -> Option<&str> {
        self.groups.get(&group)?.get(&id).map(String::as_str)
    }

    pub fn group(&self, group: u32) -> impl Iterator<Item = (u32, &str)> {
        self.groups
            .get(&group)
            .into_iter()
            .flat_map(|m| m.iter().map(|(id, n)| (*id, n.as_str())))
    }

    pub fn contains(&self, group: u32, id: u32) -> bool {
        self.groups.get(&group).is_some_and(|m| m.contains_key(&id))
    }

    /// Builds a reverse (name → id) index for one group.
    pub fn by_name(&self, group: u32) -> HashMap<&str, u32> {
        self.group(group).map(|(id, n)| (n, id)).collect()
    }
}

#[cfg(test)]
pub(crate) fn build_sample(groups: &[(u32, &[(u32, &str)])], group_count: usize) -> Vec<u8> {
    let mut counts = vec![0u32; group_count];
    let mut offsets = vec![0u32; group_count];
    let mut body = Vec::new();
    for (g, entries) in groups {
        counts[*g as usize] = entries.len() as u32;
        offsets[*g as usize] = body.len() as u32;
        let mut names = Vec::new();
        let mut table = Vec::new();
        for (id, name) in entries.iter() {
            table.extend(g.to_le_bytes());
            table.extend(id.to_le_bytes());
            table.extend((names.len() as u32).to_le_bytes());
            names.extend(name.as_bytes());
            names.push(0);
        }
        body.extend(table);
        body.extend(names);
    }
    let mut d = MAGIC.to_le_bytes().to_vec();
    d.extend((group_count as u32).to_le_bytes());
    for v in counts.iter().chain(offsets.iter()).chain(counts.iter()) {
        d.extend(v.to_le_bytes());
    }
    d.extend(vec![0u8; 4 * group_count + 4]);
    d.extend(body);
    d
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_groups_and_names() {
        let data = build_sample(&[(44, &[(10, "2DUI_A"), (11, "2DUI_B")]), (29, &[(5, "Barbarian_Bash")])], 182);
        let toc = CoreToc::parse(&data, &[]).unwrap();
        assert_eq!(toc.name(44, 11), Some("2DUI_B"));
        assert_eq!(toc.name(29, 5), Some("Barbarian_Bash"));
        assert_eq!(toc.by_name(44).get("2DUI_A"), Some(&10));
        let filtered = CoreToc::parse(&data, &[29]).unwrap();
        assert!(filtered.name(44, 10).is_none());
    }
}
