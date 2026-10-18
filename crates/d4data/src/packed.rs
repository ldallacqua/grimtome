//! Packed SNO bundles such as `Texture-Base-Global.dat` and `StringList-Text-enUS.dat`.
//!
//! Layout: `magic, count, (sno, size) × count`, then records aligned to 8 bytes.
//! Some bundles prefix each record with 8 bytes of padding; the record start is
//! found by checking where the expected SNO id appears.

use crate::error::{fmt_err, Result};
use std::collections::HashMap;
use std::ops::Range;

const MAGIC: u32 = 0x44CF_00F5;

pub struct PackedSnoFile {
    data: Vec<u8>,
    records: HashMap<u32, Range<usize>>,
}

fn le32(d: &[u8], at: usize) -> Result<u32> {
    d.get(at..at + 4)
        .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| fmt_err("packed SNO file truncated"))
}

impl PackedSnoFile {
    pub fn parse(data: Vec<u8>) -> Result<Self> {
        if le32(&data, 0)? != MAGIC {
            return Err(fmt_err("packed SNO magic mismatch"));
        }
        let n = le32(&data, 4)? as usize;
        let mut pos = 8 + 8 * n;
        let mut records = HashMap::with_capacity(n);
        for i in 0..n {
            let sno = le32(&data, 8 + 8 * i)?;
            let size = le32(&data, 12 + 8 * i)? as usize;
            pos = (pos + 7) & !7;
            if le32(&data, pos)? != sno && le32(&data, pos + 8).ok() == Some(sno) {
                pos += 8;
            }
            if le32(&data, pos)? != sno {
                return Err(fmt_err(format!("packed record {i} (sno {sno}) not found at {pos}")));
            }
            if pos + size > data.len() {
                return Err(fmt_err("packed record exceeds file"));
            }
            records.insert(sno, pos..pos + size);
            pos += size;
        }
        Ok(Self { data, records })
    }

    pub fn get(&self, sno: u32) -> Option<&[u8]> {
        self.records.get(&sno).map(|r| &self.data[r.clone()])
    }

    pub fn len(&self) -> usize {
        self.records.len()
    }

    pub fn is_empty(&self) -> bool {
        self.records.is_empty()
    }

    pub fn ids(&self) -> impl Iterator<Item = u32> + '_ {
        self.records.keys().copied()
    }
}

#[cfg(test)]
pub(crate) fn build_sample(records: &[(u32, Vec<u8>)], pad8: bool) -> Vec<u8> {
    let mut d = MAGIC.to_le_bytes().to_vec();
    d.extend((records.len() as u32).to_le_bytes());
    for (sno, body) in records {
        d.extend(sno.to_le_bytes());
        d.extend((body.len() as u32).to_le_bytes());
    }
    for (_, body) in records {
        while !d.len().is_multiple_of(8) {
            d.push(0);
        }
        if pad8 {
            d.extend([0u8; 8]);
        }
        d.extend(body);
    }
    d
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rec(sno: u32, extra: &[u8]) -> Vec<u8> {
        let mut v = sno.to_le_bytes().to_vec();
        v.extend(extra);
        v
    }

    #[test]
    fn reads_records_with_and_without_prefix_padding() {
        for pad in [false, true] {
            let recs = vec![(7, rec(7, b"abc")), (9, rec(9, b"defghij"))];
            let p = PackedSnoFile::parse(build_sample(&recs, pad)).unwrap();
            assert_eq!(p.len(), 2);
            assert_eq!(&p.get(9).unwrap()[4..], b"defghij");
        }
    }
}
