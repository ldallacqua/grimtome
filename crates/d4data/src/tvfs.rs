//! TVFS ("Tiny Virtual File System") manifest parsing.
//!
//! A TVFS manifest is a prefix tree of path fragments whose leaves point into a
//! VFS span table, which in turn points into a content-file table holding the
//! encoding key and sizes of every file.

use crate::error::{fmt_err, Result};

const FLAG_WRITE_SUPPORT: u32 = 0x2;
const FOLDER_NODE: u32 = 0x8000_0000;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub ekey: [u8; 16],
    pub encoded_size: u32,
    pub content_size: u32,
}

pub struct Manifest<'a> {
    d: &'a [u8],
    ekey_size: usize,
    path_table: (usize, usize),
    vfs_off: usize,
    cft_off: usize,
    cft_ofs_size: usize,
    est_ofs_size: usize,
}

fn be32(d: &[u8], at: usize) -> Result<u32> {
    d.get(at..at + 4)
        .map(|s| u32::from_be_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| fmt_err("TVFS truncated"))
}

fn be_n(d: &[u8], at: usize, n: usize) -> Result<usize> {
    let s = d.get(at..at + n).ok_or_else(|| fmt_err("TVFS truncated"))?;
    Ok(s.iter().fold(0usize, |acc, b| (acc << 8) | *b as usize))
}

fn offset_field_size(table_size: u32) -> usize {
    match table_size {
        s if s > 0xFF_FFFF => 4,
        s if s > 0xFFFF => 3,
        s if s > 0xFF => 2,
        _ => 1,
    }
}

impl<'a> Manifest<'a> {
    pub fn parse(d: &'a [u8]) -> Result<Self> {
        if !d.starts_with(b"TVFS") {
            return Err(fmt_err("not a TVFS manifest"));
        }
        let ekey_size = d[6] as usize;
        if ekey_size > 16 {
            return Err(fmt_err("TVFS encoding key larger than 16 bytes"));
        }
        let flags = be32(d, 8)?;
        let pt_off = be32(d, 12)? as usize;
        let pt_size = be32(d, 16)? as usize;
        let vfs_off = be32(d, 20)? as usize;
        let cft_off = be32(d, 28)? as usize;
        let cft_size = be32(d, 32)?;
        let est_size = if flags & FLAG_WRITE_SUPPORT != 0 { be32(d, 42)? } else { 0 };
        Ok(Self {
            d,
            ekey_size,
            path_table: (pt_off, pt_off + pt_size),
            vfs_off,
            cft_off,
            cft_ofs_size: offset_field_size(cft_size),
            est_ofs_size: if est_size > 0 { offset_field_size(est_size) } else { 0 },
        })
    }

    fn cft_entry(&self, off: usize) -> Result<Span> {
        let mut p = self.cft_off + off;
        let mut ekey = [0u8; 16];
        ekey[..self.ekey_size].copy_from_slice(
            self.d.get(p..p + self.ekey_size).ok_or_else(|| fmt_err("CFT truncated"))?,
        );
        p += self.ekey_size;
        let encoded_size = be32(self.d, p)?;
        p += 4 + self.est_ofs_size;
        let content_size = be32(self.d, p)?;
        Ok(Span { ekey, encoded_size, content_size })
    }

    fn vfs_entry(&self, off: usize, out: &mut Vec<Span>) -> Result<()> {
        out.clear();
        let mut p = self.vfs_off + off;
        let count = *self.d.get(p).ok_or_else(|| fmt_err("VFS truncated"))? as usize;
        p += 1;
        if count == 0 || count > 224 {
            return Ok(()); // deleted / unsupported span marker
        }
        for _ in 0..count {
            p += 8; // content offset + span size
            let cft = be_n(self.d, p, self.cft_ofs_size)?;
            p += self.cft_ofs_size;
            out.push(self.cft_entry(cft)?);
        }
        Ok(())
    }

    /// Calls `visit(path, spans)` for every file in the manifest. Paths use `/`.
    pub fn for_each_file(&self, mut visit: impl FnMut(&str, &[Span])) -> Result<()> {
        let mut path = String::with_capacity(256);
        let mut spans = Vec::with_capacity(1);
        self.walk(self.path_table.0, self.path_table.1, &mut path, &mut spans, &mut visit)
    }

    fn walk(
        &self,
        mut p: usize,
        end: usize,
        path: &mut String,
        spans: &mut Vec<Span>,
        visit: &mut impl FnMut(&str, &[Span]),
    ) -> Result<()> {
        let d = self.d;
        let base_len = path.len();
        while p < end {
            let sep_pre = d[p] == 0;
            if sep_pre {
                p += 1;
            }
            let mut name: &[u8] = &[];
            if p < end && d[p] != 0xFF {
                let len = d[p] as usize;
                name = d.get(p + 1..p + 1 + len).ok_or_else(|| fmt_err("path fragment truncated"))?;
                p += 1 + len;
            }
            let mut sep_post = false;
            if p < end && d[p] == 0 {
                sep_post = true;
                p += 1;
            }
            let mut node = None;
            if p < end && d[p] == 0xFF {
                node = Some(be32(d, p + 1)?);
                p += 5;
            } else if p < end {
                // A fragment without a node value continues into the next fragment.
                sep_post = true;
            }
            if sep_pre {
                path.push('/');
            }
            path.push_str(&String::from_utf8_lossy(name));
            if sep_post {
                path.push('/');
            }
            if let Some(node) = node {
                if node & FOLDER_NODE != 0 {
                    let sub_end = (p + (node & !FOLDER_NODE) as usize).saturating_sub(4);
                    self.walk(p, sub_end.min(end), path, spans, visit)?;
                    p = sub_end;
                } else {
                    self.vfs_entry(node as usize, spans)?;
                    if !spans.is_empty() {
                        visit(path, spans);
                    }
                }
                path.truncate(base_len);
            }
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a minimal manifest with two files: `a/x` and `a/y`.
    fn sample() -> Vec<u8> {
        // Sub-tree of folder "a": two files with VFS offsets 0 and 10.
        let mut sub = Vec::new();
        sub.extend([0u8, 1, b'x', 0xFF]);
        sub.extend(0u32.to_be_bytes());
        sub.extend([0u8, 1, b'y', 0xFF]);
        sub.extend(10u32.to_be_bytes());
        let mut path_table = vec![1u8, b'a', 0xFF];
        path_table.extend((FOLDER_NODE | (sub.len() as u32 + 4)).to_be_bytes());
        path_table.extend(&sub);

        // VFS entries: span count, content offset, span size, CFT offset (1 byte).
        let mut vfs = Vec::new();
        for cft in [0u8, 25u8] {
            vfs.push(1);
            vfs.extend(0u32.to_be_bytes());
            vfs.extend(10u32.to_be_bytes());
            vfs.push(cft);
        }
        // CFT entries: ekey(16) + encoded size(4) + EST index(1) + content size(4) = 25 bytes.
        let mut cft = Vec::new();
        for (i, (es, cs)) in [(11u32, 22u32), (33, 44)].iter().enumerate() {
            cft.extend([i as u8 + 1; 16]);
            cft.extend(es.to_be_bytes());
            cft.push(0);
            cft.extend(cs.to_be_bytes());
        }
        let header_len = 46usize;
        let pt_off = header_len;
        let vfs_off = pt_off + path_table.len();
        let cft_off = vfs_off + vfs.len();
        let mut d = b"TVFS".to_vec();
        d.extend([1, header_len as u8, 16, 16]);
        d.extend(FLAG_WRITE_SUPPORT.to_be_bytes());
        for v in [pt_off, path_table.len(), vfs_off, vfs.len(), cft_off, cft.len()] {
            d.extend((v as u32).to_be_bytes());
        }
        d.extend(2u16.to_be_bytes());
        d.extend(0u32.to_be_bytes()); // EST offset
        d.extend(2u32.to_be_bytes()); // EST size
        d.extend(&path_table);
        d.extend(&vfs);
        d.extend(&cft);
        d
    }

    #[test]
    fn walks_nested_paths() {
        let data = sample();
        let m = Manifest::parse(&data).unwrap();
        let mut seen = Vec::new();
        m.for_each_file(|p, s| seen.push((p.to_string(), s[0].encoded_size, s[0].content_size, s[0].ekey[0])))
            .unwrap();
        assert_eq!(seen, vec![("a/x".to_string(), 11, 22, 1), ("a/y".to_string(), 33, 44, 2)]);
    }
}
