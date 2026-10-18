//! Decoding of encoded file blobs: BLTE frames or bare zlib streams.

use crate::error::{fmt_err, Error, Result};
use flate2::read::ZlibDecoder;
use std::io::Read;

fn inflate(data: &[u8], size_hint: usize) -> Result<Vec<u8>> {
    let mut out = Vec::with_capacity(size_hint);
    ZlibDecoder::new(data).read_to_end(&mut out).map_err(|e| Error::Decompress(e.to_string()))?;
    Ok(out)
}

fn be32(b: &[u8], at: usize) -> Result<u32> {
    b.get(at..at + 4)
        .map(|s| u32::from_be_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| fmt_err("truncated BLTE header"))
}

/// Decodes a blob that is either BLTE-framed or a raw zlib stream (espec `z`).
pub fn decode(data: &[u8], size_hint: usize) -> Result<Vec<u8>> {
    if data.starts_with(b"BLTE") {
        decode_blte(data, size_hint)
    } else if data.first() == Some(&0x78) {
        inflate(data, size_hint)
    } else {
        Err(fmt_err("blob is neither BLTE nor zlib"))
    }
}

fn decode_blte(data: &[u8], size_hint: usize) -> Result<Vec<u8>> {
    let header_size = be32(data, 4)? as usize;
    let mut chunks: Vec<(usize, usize)> = Vec::new();
    let mut pos;
    if header_size == 0 {
        chunks.push((data.len() - 8, 0));
        pos = 8;
    } else {
        let count = data
            .get(9..12)
            .map(|b| ((b[0] as usize) << 16) | ((b[1] as usize) << 8) | b[2] as usize)
            .ok_or_else(|| fmt_err("truncated BLTE chunk table"))?;
        let mut p = 12;
        for _ in 0..count {
            let csize = be32(data, p)? as usize;
            let dsize = be32(data, p + 4)? as usize;
            chunks.push((csize, dsize));
            p += 24;
        }
        pos = header_size;
    }
    let mut out = Vec::with_capacity(size_hint);
    for (csize, dsize) in chunks {
        let chunk = data.get(pos..pos + csize).ok_or_else(|| fmt_err("BLTE chunk exceeds blob"))?;
        pos += csize;
        match chunk.first() {
            Some(b'N') => out.extend_from_slice(&chunk[1..]),
            Some(b'Z') => out.extend_from_slice(&inflate(&chunk[1..], dsize)?),
            Some(b'F') => out.extend_from_slice(&decode(&chunk[1..], dsize)?),
            Some(b'E') => return Err(Error::Encrypted),
            other => return Err(fmt_err(format!("unsupported BLTE chunk mode {other:?}"))),
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use flate2::{write::ZlibEncoder, Compression};
    use std::io::Write;

    fn zlib(bytes: &[u8]) -> Vec<u8> {
        let mut enc = ZlibEncoder::new(Vec::new(), Compression::default());
        enc.write_all(bytes).unwrap();
        enc.finish().unwrap()
    }

    #[test]
    fn decodes_raw_zlib() {
        let payload = b"grimtome".repeat(20);
        assert_eq!(decode(&zlib(&payload), 0).unwrap(), payload);
    }

    #[test]
    fn decodes_multi_chunk_blte() {
        let a = b"hello ".to_vec();
        let mut b = vec![b'Z'];
        b.extend(zlib(b"world"));
        let mut chunk_a = vec![b'N'];
        chunk_a.extend(&a);
        let mut blob = b"BLTE".to_vec();
        let header_size = 12 + 24 * 2;
        blob.extend((header_size as u32).to_be_bytes());
        blob.extend([0x0F, 0, 0, 2]);
        for (c, d) in [(chunk_a.len(), a.len()), (b.len(), 5)] {
            blob.extend((c as u32).to_be_bytes());
            blob.extend((d as u32).to_be_bytes());
            blob.extend([0u8; 16]);
        }
        blob.extend(&chunk_a);
        blob.extend(&b);
        assert_eq!(decode(&blob, 0).unwrap(), b"hello world");
    }

    #[test]
    fn refuses_encrypted_chunks() {
        let mut blob = b"BLTE".to_vec();
        blob.extend(0u32.to_be_bytes());
        blob.extend(b"E\x00\x01\x02");
        assert!(matches!(decode(&blob, 0), Err(Error::Encrypted)));
    }
}
