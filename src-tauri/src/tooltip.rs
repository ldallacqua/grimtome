//! Finds item tooltips in a screen capture from a first OCR pass, and samples text
//! and bullet colors for the second pass. Pure functions, unit-tested without
//! Windows: the OCR engine only supplies text lines with bounding boxes.
//!
//! Diablo IV draws tooltips as a dark, left-aligned column of text next to the
//! cursor. When the player compares gear, a second tooltip headed "Equipped" sits
//! beside it. We cluster vertically stacked, horizontally aligned lines, keep the
//! clusters that contain tooltip anchors (item power, rarity/type line, level
//! requirement) and pick the one closest to the cursor.

use image::RgbaImage;
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct Rect {
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

impl Rect {
    pub fn right(&self) -> f32 {
        self.x + self.w
    }
    pub fn bottom(&self) -> f32 {
        self.y + self.h
    }
    pub fn union(&self, o: &Rect) -> Rect {
        let (x, y) = (self.x.min(o.x), self.y.min(o.y));
        Rect { x, y, w: self.right().max(o.right()) - x, h: self.bottom().max(o.bottom()) - y }
    }
    pub fn scaled(&self, s: f32) -> Rect {
        Rect { x: self.x / s, y: self.y / s, w: self.w / s, h: self.h / s }
    }
    fn center_y(&self) -> f32 {
        self.y + self.h / 2.0
    }
    fn h_overlap(&self, o: &Rect) -> f32 {
        (self.right().min(o.right()) - self.x.max(o.x)).max(0.0)
    }
}

#[derive(Debug, Clone)]
pub struct Word {
    pub text: String,
    pub rect: Rect,
}

#[derive(Debug, Clone)]
pub struct TextLine {
    pub text: String,
    pub rect: Rect,
    pub words: Vec<Word>,
}

impl TextLine {
    pub fn scaled(self, s: f32) -> TextLine {
        TextLine {
            text: self.text,
            rect: self.rect.scaled(s),
            words: self.words.into_iter().map(|w| Word { text: w.text, rect: w.rect.scaled(s) }).collect(),
        }
    }

    /// Splits off an affix bullet the OCR read as a character ("+ +14.0%",
    /// "• +16.0%"). Returns the remaining text and the glyph's box, whose color
    /// tells a Greater Affix (orange) from a regular (grey) or tempered (blue) one.
    pub fn split_bullet(&self) -> (String, Option<Rect>) {
        if let [first, second, ..] = self.words.as_slice() {
            let w0 = first.text.trim();
            let glyph = !w0.is_empty() && w0.chars().count() <= 2 && !w0.chars().any(char::is_alphanumeric);
            let starts_value = second.text.starts_with(|c: char| c == '+' || c == '-' || c.is_ascii_digit());
            if glyph && (w0 != "+" && w0 != "-" || starts_value) {
                let rest: Vec<&str> = self.words[1..].iter().map(|w| w.text.as_str()).collect();
                return (rest.join(" "), Some(first.rect));
            }
        }
        (self.text.clone(), None)
    }
}

/// One line agreed on by several OCR passes.
#[derive(Debug, Clone, PartialEq)]
pub struct VotedLine {
    pub text: String,
    pub rect: Rect,
    pub bullet: Option<Rect>,
    pub votes: usize,
}

/// Merges OCR passes over the same image (run at different scales, coordinates
/// already mapped back) by majority vote per line. Each pass makes different
/// mistakes ("%" read as "96", a dropped number, a stray glyph), so the most
/// common reading wins; ties go to the earliest pass.
pub fn vote(passes: &[Vec<TextLine>]) -> Vec<VotedLine> {
    struct Candidate {
        pass: usize,
        text: String,
        rect: Rect,
        bullet: Option<Rect>,
    }
    let mut clusters: Vec<Vec<Candidate>> = Vec::new();
    for (pass, lines) in passes.iter().enumerate() {
        for line in lines {
            let (text, bullet) = line.split_bullet();
            let c = Candidate { pass, text, rect: line.rect, bullet };
            let home = clusters.iter_mut().find(|cl| {
                let r = &cl[0].rect;
                (r.center_y() - c.rect.center_y()).abs() < r.h.min(c.rect.h) * 0.5 && r.h_overlap(&c.rect) > 0.0
            });
            match home {
                Some(cl) if !cl.iter().any(|o| o.pass == pass) => cl.push(c),
                _ => clusters.push(vec![c]),
            }
        }
    }
    let key = |t: &str| t.to_lowercase().chars().filter(|c| !c.is_whitespace()).collect::<String>();
    let mut out: Vec<VotedLine> = clusters
        .into_iter()
        .map(|cl| {
            let mut best: Option<(usize, usize, &Candidate)> = None; // (votes, -pass, candidate)
            for c in &cl {
                let k = key(&c.text);
                let votes = cl.iter().filter(|o| key(&o.text) == k).count();
                let better = match best {
                    None => true,
                    Some((v, p, _)) => votes > v || (votes == v && c.pass < p),
                };
                if better {
                    best = Some((votes, c.pass, c));
                }
            }
            let (votes, _, c) = best.expect("non-empty cluster");
            let bullet = c.bullet.or_else(|| cl.iter().find_map(|o| o.bullet));
            VotedLine { text: c.text.clone(), rect: c.rect, bullet, votes }
        })
        .collect();
    out.sort_by(|a, b| a.rect.y.partial_cmp(&b.rect.y).unwrap());
    out
}

#[derive(Debug, Clone, PartialEq)]
pub struct Region {
    pub rect: Rect,
    pub equipped: bool,
    pub anchors: usize,
    pub lines: usize,
}

const RARITY_WORDS: &[&str] = &[
    "common",
    "magic",
    "rare",
    "legendary",
    "unique",
    "mythic",
    "ancestral",
    "sacred", // en
    "comum",
    "comuns",
    "raro",
    "rara",
    "raros",
    "raras",
    "sagrado",
    "sagrada", // pt-BR (exact)
];

/// pt-BR adjectives agree in gender and number (lendário/lendárias, ancestral/ancestrais).
const RARITY_STEMS: &[&str] = &["lendári", "lendari", "únic", "unic", "mític", "mitic", "mágic", "magic", "ancestra"];

fn is_rarity_word(w: &str) -> bool {
    RARITY_WORDS.contains(&w) || RARITY_STEMS.iter().any(|s| w.starts_with(s))
}

const EQUIPPED_WORDS: &[&str] = &["equipped", "equipado", "equipada"];

/// How strongly a line indicates an item tooltip (0 = not an anchor).
pub fn anchor_weight(text: &str) -> usize {
    let t = text.to_lowercase();
    if t.contains("item power") || t.contains("poder do item") || t.contains("poder de item") {
        return 3;
    }
    if t.contains("requires level") || t.contains("requer nível") || t.contains("requer nivel") {
        return 2;
    }
    let words: Vec<&str> = t.split(|c: char| !c.is_alphanumeric()).filter(|w| !w.is_empty()).collect();
    if words.len() <= 5 && words.iter().any(|w| is_rarity_word(w)) {
        return 2;
    }
    if t.contains("sell value")
        || t.contains("valor de venda")
        || t.contains("durability")
        || t.contains("durabilidade")
    {
        return 1;
    }
    0
}

pub fn is_equipped_marker(text: &str) -> bool {
    let t = text.trim().to_lowercase();
    EQUIPPED_WORDS.iter().any(|w| t == *w || t.starts_with(w))
}

fn median(mut v: Vec<f32>) -> f32 {
    if v.is_empty() {
        return 0.0;
    }
    v.sort_by(|a, b| a.partial_cmp(b).unwrap());
    v[v.len() / 2]
}

/// Groups lines into vertically stacked, horizontally aligned clusters.
fn clusters(lines: &[TextLine]) -> Vec<Vec<usize>> {
    let lh = median(lines.iter().map(|l| l.rect.h).collect()).max(6.0);
    let n = lines.len();
    let mut parent: Vec<usize> = (0..n).collect();
    fn find(p: &mut [usize], i: usize) -> usize {
        let mut r = i;
        while p[r] != r {
            r = p[r];
        }
        let mut c = i;
        while p[c] != r {
            let next = p[c];
            p[c] = r;
            c = next;
        }
        r
    }
    for i in 0..n {
        for j in (i + 1)..n {
            let (a, b) = (&lines[i].rect, &lines[j].rect);
            let gap = if a.y < b.y { b.y - a.bottom() } else { a.y - b.bottom() };
            let aligned = (a.x - b.x).abs() < lh * 3.0 || a.h_overlap(b) > a.w.min(b.w) * 0.5;
            if gap < lh * 2.4 && aligned {
                let (ri, rj) = (find(&mut parent, i), find(&mut parent, j));
                parent[ri] = rj;
            }
        }
    }
    let mut groups: std::collections::BTreeMap<usize, Vec<usize>> = Default::default();
    for i in 0..n {
        groups.entry(find(&mut parent, i)).or_default().push(i);
    }
    groups.into_values().collect()
}

/// Tooltip candidates, best first (non-equipped tooltip nearest the cursor).
pub fn find_tooltips(lines: &[TextLine], cursor: Option<(f32, f32)>, bounds: (f32, f32)) -> Vec<Region> {
    let lh = median(lines.iter().map(|l| l.rect.h).collect()).max(6.0);
    let mut out: Vec<Region> = clusters(lines)
        .into_iter()
        .filter_map(|idx| {
            let anchors: usize = idx.iter().map(|&i| anchor_weight(&lines[i].text)).sum();
            if anchors < 2 || idx.len() < 3 {
                return None;
            }
            let mut rect = lines[idx[0]].rect;
            for &i in &idx[1..] {
                rect = rect.union(&lines[i].rect);
            }
            let mut sorted = idx.clone();
            sorted.sort_by(|a, b| lines[*a].rect.y.partial_cmp(&lines[*b].rect.y).unwrap());
            let equipped = sorted.iter().take(3).any(|&i| is_equipped_marker(&lines[i].text));
            // Lines rarely span the full tooltip: pad generously to the right and
            // keep room above for the item name's glow and below for footers.
            let pad_l = lh * 1.6;
            let pad_r = (rect.w * 0.12).max(lh * 2.5);
            let x = (rect.x - pad_l).max(0.0);
            let y = (rect.y - lh * 1.2).max(0.0);
            let right = (rect.right() + pad_r).min(bounds.0);
            let bottom = (rect.bottom() + lh * 1.2).min(bounds.1);
            Some(Region { rect: Rect { x, y, w: right - x, h: bottom - y }, equipped, anchors, lines: idx.len() })
        })
        .collect();
    let distance = |r: &Region| match cursor {
        Some((cx, cy)) => {
            let dx = if cx < r.rect.x {
                r.rect.x - cx
            } else if cx > r.rect.right() {
                cx - r.rect.right()
            } else {
                0.0
            };
            let dy = if cy < r.rect.y {
                r.rect.y - cy
            } else if cy > r.rect.bottom() {
                cy - r.rect.bottom()
            } else {
                0.0
            };
            dx + dy * 0.5
        }
        None => -(r.anchors as f32 * 100.0 + r.lines as f32),
    };
    out.sort_by(|a, b| (a.equipped, distance(a)).partial_cmp(&(b.equipped, distance(b))).unwrap());
    out
}

fn hex(c: [f32; 3]) -> String {
    format!("#{:02x}{:02x}{:02x}", c[0].round() as u8, c[1].round() as u8, c[2].round() as u8)
}

fn average_top(pixels: &mut [[f32; 3]], key: impl Fn(&[f32; 3]) -> f32, frac: f32) -> Option<[f32; 3]> {
    if pixels.is_empty() {
        return None;
    }
    pixels.sort_by(|a, b| key(b).partial_cmp(&key(a)).unwrap());
    let n = ((pixels.len() as f32 * frac).ceil() as usize).clamp(1, pixels.len());
    let mut sum = [0.0f32; 3];
    for p in &pixels[..n] {
        for k in 0..3 {
            sum[k] += p[k];
        }
    }
    Some([sum[0] / n as f32, sum[1] / n as f32, sum[2] / n as f32])
}

fn collect(img: &RgbaImage, r: &Rect) -> Vec<[f32; 3]> {
    let (w, h) = img.dimensions();
    let x0 = r.x.max(0.0) as u32;
    let y0 = r.y.max(0.0) as u32;
    let x1 = (r.right().max(0.0) as u32).min(w);
    let y1 = (r.bottom().max(0.0) as u32).min(h);
    let mut out = Vec::new();
    for y in y0..y1 {
        for x in x0..x1 {
            let p = img.get_pixel(x, y);
            out.push([p[0] as f32, p[1] as f32, p[2] as f32]);
        }
    }
    out
}

fn luma(p: &[f32; 3]) -> f32 {
    0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]
}

fn saturation(p: &[f32; 3]) -> f32 {
    let max = p[0].max(p[1]).max(p[2]);
    let min = p[0].min(p[1]).min(p[2]);
    if max <= 0.0 {
        0.0
    } else {
        (max - min) / max
    }
}

/// Text color: the average of the brightest pixels inside the line box (glyph
/// cores, not anti-aliased edges or the dark background).
pub fn text_color(img: &RgbaImage, line: &Rect) -> Option<String> {
    let mut px = collect(img, line);
    let c = average_top(&mut px, luma, 0.08)?;
    (luma(&c) > 60.0).then(|| hex(c))
}

/// Color of a glyph box the OCR read as a character (a misread affix bullet).
pub fn glyph_color(img: &RgbaImage, glyph: &Rect) -> Option<String> {
    let mut px = collect(img, glyph);
    let c = average_top(&mut px, |p| luma(p) * (0.4 + saturation(p)), 0.15)?;
    (luma(&c) > 55.0).then(|| hex(c))
}

/// Bullet/icon color just left of the line (grey diamond, orange Greater Affix
/// star, blue tempered marker). None when nothing visible is there.
pub fn icon_color(img: &RgbaImage, line: &Rect) -> Option<String> {
    let side = line.h * 1.6;
    let probe = Rect { x: line.x - side - line.h * 0.15, y: line.y, w: side, h: line.h };
    let mut px = collect(img, &probe);
    let c = average_top(&mut px, |p| luma(p) * (0.4 + saturation(p)), 0.06)?;
    (luma(&c) > 55.0).then(|| hex(c))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(text: &str, x: f32, y: f32, w: f32) -> TextLine {
        // Words laid out left to right, 9 px per character.
        let mut cx = x;
        let words = text
            .split(' ')
            .map(|t| {
                let r = Rect { x: cx, y, w: t.chars().count() as f32 * 9.0, h: 18.0 };
                cx += r.w + 9.0;
                Word { text: t.into(), rect: r }
            })
            .collect();
        TextLine { text: text.into(), rect: Rect { x, y, w, h: 18.0 }, words }
    }

    fn tooltip(x: f32, y: f32, equipped: bool) -> Vec<TextLine> {
        let mut v = Vec::new();
        let mut yy = y;
        if equipped {
            v.push(line("EQUIPPED", x, yy, 90.0));
            yy += 26.0;
        }
        for (t, w) in [
            ("Gauntlets of Earthquakes", 260.0),
            ("Ancestral Legendary Gloves", 240.0),
            ("800 Item Power", 140.0),
            ("1,190 Armor", 110.0),
            ("+14.0% Critical Strike Chance", 280.0),
            ("+5.5% Movement Speed", 200.0),
            ("Requires Level 60", 160.0),
        ] {
            v.push(line(t, x, yy, w));
            yy += 26.0;
        }
        v
    }

    #[test]
    fn scores_anchor_lines() {
        assert_eq!(anchor_weight("800 Item Power"), 3);
        assert_eq!(anchor_weight("Ancestral Legendary Gloves"), 2);
        assert_eq!(anchor_weight("Luvas Lendárias Ancestrais"), 2);
        assert_eq!(anchor_weight("Requires Level 60"), 2);
        assert_eq!(anchor_weight("+14.0% Critical Strike Chance"), 0);
        assert!(is_equipped_marker("Equipped"));
        assert!(!is_equipped_marker("Unequipped bonus"));
    }

    #[test]
    fn finds_the_hovered_tooltip_and_the_equipped_one() {
        let mut lines = tooltip(1200.0, 300.0, false);
        lines.extend(tooltip(820.0, 280.0, true));
        // HUD noise elsewhere on screen
        lines.push(line("Kyovashad", 2200.0, 40.0, 120.0));
        lines.push(line("Whisper of the Dead", 2200.0, 66.0, 180.0));
        let found = find_tooltips(&lines, Some((1150.0, 420.0)), (2560.0, 1440.0));
        assert_eq!(found.len(), 2);
        assert!(!found[0].equipped);
        assert!(found[0].rect.x < 1200.0 && found[0].rect.right() > 1480.0);
        assert!(found[1].equipped);
        assert!(found[1].rect.right() < 1200.0);
    }

    #[test]
    fn ignores_text_without_anchors() {
        let lines = vec![
            line("Quest Log", 10.0, 10.0, 100.0),
            line("Talk to Lorath", 10.0, 36.0, 140.0),
            line("Explore", 10.0, 62.0, 80.0),
        ];
        assert!(find_tooltips(&lines, None, (800.0, 600.0)).is_empty());
    }

    #[test]
    fn splits_misread_bullets_but_keeps_signs() {
        let (t, b) = line("+ +14.0% Critical Strike Chance", 20.0, 0.0, 280.0).split_bullet();
        assert_eq!(t, "+14.0% Critical Strike Chance");
        assert!(b.is_some());
        let (t, b) = line("• +16.0% Attack Speed", 20.0, 0.0, 200.0).split_bullet();
        assert_eq!(t, "+16.0% Attack Speed");
        assert!(b.is_some());
        let (t, b) = line("+5.5% Movement Speed", 20.0, 0.0, 200.0).split_bullet();
        assert_eq!(t, "+5.5% Movement Speed");
        assert!(b.is_none());
        let (t, _) = line("- Ground Stomp", 20.0, 0.0, 200.0).split_bullet();
        assert_eq!(t, "- Ground Stomp");
    }

    #[test]
    fn votes_across_ocr_passes() {
        // Real Windows OCR readings of the same tooltip at 2x, 3x and 1x.
        let pass = |rows: &[&str]| -> Vec<TextLine> {
            rows.iter()
                .enumerate()
                .filter(|(_, t)| !t.is_empty())
                .map(|(i, t)| line(t, 20.0, i as f32 * 26.0, 240.0))
                .collect()
        };
        let passes = [
            pass(&["Item Power", "1 ,190 Armor", "+ +14.0% Critical Strike Chance", "+5.5% Movement Speed"]),
            pass(&["800 Item Power", "1,190 Armor", "+ +14.096 Critical Strike Chance", "• +5.596 Movement Speed"]),
            pass(&["800 Item Power", "1 ,190 Armor", "+14.0% Critical Strike Chance", "+5.5% Movement Speed"]),
        ];
        let voted = vote(&passes);
        let texts: Vec<&str> = voted.iter().map(|v| v.text.as_str()).collect();
        assert_eq!(texts, ["800 Item Power", "1 ,190 Armor", "+14.0% Critical Strike Chance", "+5.5% Movement Speed"]);
        assert!(voted[2].bullet.is_some(), "the misread star still marks the icon position");
        assert_eq!(voted[0].votes, 2);
    }

    #[test]
    fn samples_text_and_icon_colors() {
        let mut img = RgbaImage::from_pixel(200, 40, image::Rgba([10, 9, 8, 255]));
        // orange "star" left of the line, light text inside it
        for y in 12..24 {
            for x in 6..16 {
                img.put_pixel(x, y, image::Rgba([255, 140, 40, 255]));
            }
            for x in (40..180).step_by(3) {
                img.put_pixel(x, y, image::Rgba([230, 225, 215, 255]));
            }
        }
        let r = Rect { x: 36.0, y: 10.0, w: 150.0, h: 18.0 };
        assert_eq!(text_color(&img, &r).as_deref(), Some("#e6e1d7"));
        let icon = icon_color(&img, &r).unwrap();
        assert!(icon.starts_with("#ff8c"), "{icon}");
        let blank = Rect { x: 36.0, y: 30.0, w: 150.0, h: 8.0 };
        assert_eq!(text_color(&img, &blank), None);
    }
}
