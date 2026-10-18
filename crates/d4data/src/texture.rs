//! Texture definitions (from `Texture-Base-Global.dat`) and payload decoding.

use crate::error::{fmt_err, Error, Result};
use image::RgbaImage;

/// One named sub-rectangle of an atlas; `hash` is what other SNOs reference.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub hash: u32,
    pub u0: f32,
    pub v0: f32,
    pub u1: f32,
    pub v1: f32,
}

#[derive(Debug, Clone)]
pub struct TextureDef {
    pub sno: u32,
    pub format: u32,
    pub width: u32,
    pub height: u32,
    /// `(offset, size)` of each mip chunk inside the payload; chunk 0 is the full-size mip.
    pub chunks: Vec<(u32, u32)>,
    pub frames: Vec<Frame>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PixelFormat {
    Bc1,
    Bc3,
    Bc4,
    Bc5,
    Bc7,
    Bgra8,
}

impl PixelFormat {
    /// Maps Diablo IV's texture format ids. Ids were verified by decoding known UI
    /// atlases (46 → BC1 skill icons, 49 → BC3 inventory icons and tooltip frames)
    /// and by matching payload sizes against block sizes for the rest.
    pub fn from_id(id: u32) -> Option<Self> {
        Some(match id {
            9 | 10 | 46 | 47 => Self::Bc1,
            48 | 49 => Self::Bc3,
            41 => Self::Bc4,
            42 => Self::Bc5,
            44 | 50 => Self::Bc7,
            0 | 45 => Self::Bgra8,
            _ => return None,
        })
    }

    fn block_bytes(self) -> usize {
        match self {
            Self::Bc1 | Self::Bc4 => 8,
            Self::Bc3 | Self::Bc5 | Self::Bc7 => 16,
            Self::Bgra8 => 4,
        }
    }
}

fn le32(d: &[u8], at: usize) -> Result<u32> {
    d.get(at..at + 4)
        .map(|s| u32::from_le_bytes([s[0], s[1], s[2], s[3]]))
        .ok_or_else(|| fmt_err("texture definition truncated"))
}

fn le16(d: &[u8], at: usize) -> Result<u16> {
    d.get(at..at + 2).map(|s| u16::from_le_bytes([s[0], s[1]])).ok_or_else(|| fmt_err("texture definition truncated"))
}

fn lef(d: &[u8], at: usize) -> Result<f32> {
    le32(d, at).map(f32::from_bits)
}

const FRAME_SIZE: usize = 36;
const ROW_PITCH_ALIGN: usize = 256;

impl TextureDef {
    pub fn parse(d: &[u8]) -> Result<Self> {
        let chunk_off = le32(d, 0x48)? as usize;
        let chunk_size = le32(d, 0x4C)? as usize;
        let frame_off = le32(d, 0x58)? as usize;
        let frame_size = le32(d, 0x5C)? as usize;
        let chunks = (0..chunk_size / 8)
            .map(|i| Ok((le32(d, chunk_off + 8 * i)?, le32(d, chunk_off + 8 * i + 4)?)))
            .collect::<Result<Vec<_>>>()?;
        let frames = (0..frame_size / FRAME_SIZE)
            .map(|i| {
                let f = frame_off + FRAME_SIZE * i;
                Ok(Frame {
                    hash: le32(d, f)?,
                    u0: lef(d, f + 4)?,
                    v0: lef(d, f + 8)?,
                    u1: lef(d, f + 12)?,
                    v1: lef(d, f + 16)?,
                })
            })
            .collect::<Result<Vec<_>>>()?;
        Ok(Self {
            sno: le32(d, 0)?,
            format: le32(d, 0x0C)?,
            width: le16(d, 0x14)? as u32,
            height: le16(d, 0x16)? as u32,
            chunks,
            frames,
        })
    }

    pub fn pixel_format(&self) -> Option<PixelFormat> {
        PixelFormat::from_id(self.format)
    }

    /// Byte size of the top mip, including Diablo IV's 256-byte row pitch padding.
    pub fn expected_top_mip_size(&self) -> Option<usize> {
        let fmt = self.pixel_format()?;
        let (row, rows) = if fmt == PixelFormat::Bgra8 {
            (self.width as usize * 4, self.height as usize)
        } else {
            ((self.width as usize).div_ceil(4) * fmt.block_bytes(), (self.height as usize).div_ceil(4))
        };
        Some(row.next_multiple_of(ROW_PITCH_ALIGN) * rows)
    }

    /// Decodes the full-size mip from a payload blob into an RGBA image.
    pub fn decode(&self, payload: &[u8]) -> Result<RgbaImage> {
        let fmt = self.pixel_format().ok_or_else(|| fmt_err(format!("unsupported texture format {}", self.format)))?;
        let expected = self.expected_top_mip_size().unwrap_or(0);
        let (start, _) = self.chunks.first().copied().unwrap_or((0, expected as u32));
        let top = payload
            .get(start as usize..start as usize + expected)
            .ok_or_else(|| fmt_err("payload smaller than the top mip"))?;
        let (w, h) = (self.width as usize, self.height as usize);
        if fmt == PixelFormat::Bgra8 {
            let pitch = (w * 4).next_multiple_of(ROW_PITCH_ALIGN);
            let mut img = RgbaImage::new(w as u32, h as u32);
            for y in 0..h {
                for x in 0..w {
                    let p = y * pitch + x * 4;
                    img.put_pixel(x as u32, y as u32, image::Rgba([top[p + 2], top[p + 1], top[p], top[p + 3]]));
                }
            }
            return Ok(img);
        }
        let (bw, bh) = (w.div_ceil(4), h.div_ceil(4));
        let row = bw * fmt.block_bytes();
        let pitch = row.next_multiple_of(ROW_PITCH_ALIGN);
        let mut packed = Vec::with_capacity(row * bh);
        for y in 0..bh {
            packed.extend_from_slice(&top[y * pitch..y * pitch + row]);
        }
        let (pw, ph) = (bw * 4, bh * 4);
        let mut pixels = vec![0u32; pw * ph];
        let res = match fmt {
            PixelFormat::Bc1 => texture2ddecoder::decode_bc1(&packed, pw, ph, &mut pixels),
            PixelFormat::Bc3 => texture2ddecoder::decode_bc3(&packed, pw, ph, &mut pixels),
            PixelFormat::Bc4 => texture2ddecoder::decode_bc4(&packed, pw, ph, &mut pixels),
            PixelFormat::Bc5 => texture2ddecoder::decode_bc5(&packed, pw, ph, &mut pixels),
            PixelFormat::Bc7 => texture2ddecoder::decode_bc7(&packed, pw, ph, &mut pixels),
            PixelFormat::Bgra8 => unreachable!(),
        };
        res.map_err(|e| Error::Image(e.to_string()))?;
        let mut img = RgbaImage::new(w as u32, h as u32);
        for y in 0..h {
            for x in 0..w {
                let c = pixels[y * pw + x];
                img.put_pixel(
                    x as u32,
                    y as u32,
                    image::Rgba([(c >> 16) as u8, (c >> 8) as u8, c as u8, (c >> 24) as u8]),
                );
            }
        }
        Ok(img)
    }
}

impl Frame {
    /// Pixel rectangle `(x, y, w, h)` of this frame within an atlas of the given size.
    pub fn rect(&self, width: u32, height: u32) -> (u32, u32, u32, u32) {
        let px = |u: f32, size: u32| ((u.clamp(0.0, 1.0) * size as f32).round() as u32).min(size);
        let (x0, x1) = (px(self.u0, width), px(self.u1, width));
        let (y0, y1) = (px(self.v0, height), px(self.v1, height));
        (x0.min(x1), y0.min(y1), x1.abs_diff(x0).max(1), y1.abs_diff(y0).max(1))
    }

    pub fn crop(&self, atlas: &RgbaImage) -> RgbaImage {
        let (x, y, w, h) = self.rect(atlas.width(), atlas.height());
        let w = w.min(atlas.width().saturating_sub(x)).max(1);
        let h = h.min(atlas.height().saturating_sub(y)).max(1);
        image::imageops::crop_imm(atlas, x, y, w, h).to_image()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn def_bytes(format: u32, w: u16, h: u16, chunk: (u32, u32), frames: &[(u32, [f32; 4])]) -> Vec<u8> {
        let mut d = vec![0u8; 0x78];
        d[0..4].copy_from_slice(&7u32.to_le_bytes());
        d[0x0C..0x10].copy_from_slice(&format.to_le_bytes());
        d[0x14..0x16].copy_from_slice(&w.to_le_bytes());
        d[0x16..0x18].copy_from_slice(&h.to_le_bytes());
        d[0x48..0x4C].copy_from_slice(&0x78u32.to_le_bytes());
        d[0x4C..0x50].copy_from_slice(&8u32.to_le_bytes());
        d[0x58..0x5C].copy_from_slice(&0x80u32.to_le_bytes());
        d[0x5C..0x60].copy_from_slice(&((frames.len() * FRAME_SIZE) as u32).to_le_bytes());
        d.extend(chunk.0.to_le_bytes());
        d.extend(chunk.1.to_le_bytes());
        for (hash, uv) in frames {
            d.extend(hash.to_le_bytes());
            for v in uv.iter().chain(uv.iter()) {
                d.extend(v.to_le_bytes());
            }
        }
        d
    }

    #[test]
    fn parses_definition_and_pitch() {
        let def = TextureDef::parse(&def_bytes(49, 392, 392, (0, 175_616), &[(0xAB, [0.0, 0.0, 0.5, 0.25])])).unwrap();
        assert_eq!((def.width, def.height, def.format), (392, 392, 49));
        // 98 blocks × 16 B = 1568 B rows, padded to 1792 B; 98 block rows.
        assert_eq!(def.expected_top_mip_size(), Some(175_616));
        assert_eq!(def.frames[0].rect(392, 392), (0, 0, 196, 98));
    }

    #[test]
    fn decodes_bgra8_with_row_padding() {
        let def = TextureDef::parse(&def_bytes(45, 2, 1, (0, 256), &[])).unwrap();
        let mut payload = vec![0u8; 256];
        payload[..8].copy_from_slice(&[1, 2, 3, 255, 10, 20, 30, 128]);
        let img = def.decode(&payload).unwrap();
        assert_eq!(img.get_pixel(0, 0).0, [3, 2, 1, 255]);
        assert_eq!(img.get_pixel(1, 0).0, [30, 20, 10, 128]);
    }

    #[test]
    fn decodes_solid_bc1_block() {
        // One BC1 block: color0 = color1 = pure red (RGB565 0xF800), all indices 0.
        let def = TextureDef::parse(&def_bytes(46, 4, 4, (0, 256), &[])).unwrap();
        let mut payload = vec![0u8; 256];
        payload[..8].copy_from_slice(&[0x00, 0xF8, 0x00, 0xF8, 0, 0, 0, 0]);
        let img = def.decode(&payload).unwrap();
        let p = img.get_pixel(2, 2).0;
        assert!(p[0] > 240 && p[1] < 10 && p[2] < 10 && p[3] == 255, "{p:?}");
    }
}
