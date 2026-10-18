/** Text helpers for OCR'd tooltip lines: normalization, numbers and similarity. */

/** Bullets and icon glyphs OCR engines commonly emit for tooltip affix icons. */
const BULLET_RE = /^[\s•·◆◇♦⬥⬦▪▫■□●○◉◎★☆✦✧✪✱✲✳❖*>»~-]+/u;

/** Collapses whitespace and normalizes typographic punctuation. */
export function cleanLine(raw: string): string {
  return repairOcr(
    raw
      .normalize('NFKC')
      .replace(/[‘’ʼ]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—−]/g, '-')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

const decimals = (s: string) => s.split(/[.,]/)[1]?.length ?? 0;
const toNumber = (s: string) => Number(s.replace(/,(?=\d{3}\b)/g, '').replace(',', '.'));

/**
 * The closing bracket of a roll range is often read as a trailing "1":
 * `[12.0 - 18.01%` or `[70 - 1101`. Drops it when the reading is implausible
 * (more decimals than the lower bound, or far too large).
 */
function repairRangeEnd(lo: string, hi: string): string {
  if (hi.length < 2 || !hi.endsWith('1')) return hi;
  const cand = hi.slice(0, -1).replace(/[.,]$/, '');
  if (decimals(hi) > decimals(lo) && decimals(cand) === decimals(lo)) return cand;
  if (toNumber(hi) / Math.max(toNumber(lo), 1e-9) > 3 && toNumber(cand) >= toNumber(lo)) return cand;
  return hi;
}

/**
 * Fixes systematic Windows OCR misreadings of Diablo IV tooltips (recorded in
 * tests/fixtures/ocr): "%" read as "96" after a one-decimal value, a space
 * inside thousands separators ("1 ,190"), and an unterminated roll range.
 */
export function repairOcr(line: string): string {
  let s = line
    .replace(/(\d)\s*([.,])\s+(?=\d{3}\b)/g, '$1$2')
    .replace(/(\d)\s+([.,])(?=\d{3}\b)/g, '$1$2')
    .replace(/(\d[.,]\d)96(?=\s|$|\[)/g, '$1%')
    .replace(/(\d)\s?[oO0]\/[oO0]/g, '$1%');
  const open = /\[\s*(\d+(?:[.,]\d+)?)\s*-?\s*(\d+(?:[.,]\d+)?)\s*([\]lI|]?)\s*(%?)\s*$/.exec(s);
  if (open && open[3] !== ']') {
    const [, lo = '', hi = '', , pct = ''] = open;
    s = `${s.slice(0, open.index).trimEnd()} [${lo} - ${repairRangeEnd(lo, hi)}]${pct}`;
  }
  return s;
}

export function stripBullet(line: string): { text: string; hadBullet: boolean; bullet: string } {
  const m = BULLET_RE.exec(line);
  if (!m) return { text: line, hadBullet: false, bullet: '' };
  // A leading '-' or '+' followed by a digit is a sign, not a bullet.
  if (/^[\s-]*[+-]?\d/.test(line) && !/[•◆◇♦⬥★☆✦✧*]/u.test(m[0])) {
    return { text: line, hadBullet: false, bullet: '' };
  }
  return { text: line.slice(m[0].length).trim(), hadBullet: true, bullet: m[0].trim() };
}

/**
 * Reduces an affix line to its label: lowercase words with numbers, ranges,
 * signs, percent marks and bracketed roll ranges removed.
 * `+12.5% Critical Strike Chance [10.0 - 15.0]%` → `critical strike chance`.
 */
export function normalizeLabel(text: string): string {
  return cleanLine(text)
    .toLowerCase()
    .replace(/\[[^\]]*\]%?/g, ' ')
    .replace(/\[[^\]]*$/, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bx\s*(?=\d)/g, ' ')
    .replace(/[+-]?\d+(?:[.,]\d+)*/g, ' ')
    .replace(/[%+:;!?#|]/g, ' ')
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parses the first number in a line, handling `1,250`, `12.5` and `12,5`.
 * Returns the value and whether it is a percentage.
 */
export function firstNumber(text: string): { value: number; percent: boolean } | null {
  const m = /([+-]?)(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(%)?/.exec(text.replace(/\[[^\]]*\]%?/g, ''));
  if (!m) return null;
  const sign = m[1] === '-' ? -1 : 1;
  const raw = m[2] ?? '';
  let n: number;
  if (/^\d{1,3}([.,]\d{3})+$/.test(raw) && !/^\d+[.,]\d{1,2}$/.test(raw)) {
    n = Number(raw.replace(/[.,]/g, ''));
  } else {
    n = Number(raw.replace(',', '.'));
  }
  if (!Number.isFinite(n)) return null;
  return { value: sign * n, percent: m[3] === '%' };
}

/** Extracts `[min - max]` roll ranges shown with advanced tooltips. */
export function rollRange(text: string): { min: number; max: number } | null {
  const m = /\[\s*([\d.,]+)\s*-\s*([\d.,]+)\s*\]/.exec(text);
  if (!m) return null;
  const a = Number((m[1] ?? '').replace(',', '.'));
  const b = Number((m[2] ?? '').replace(',', '.'));
  return Number.isFinite(a) && Number.isFinite(b) ? { min: Math.min(a, b), max: Math.max(a, b) } : null;
}

function bigrams(s: string): Map<string, number> {
  const out = new Map<string, number>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) {
    const g = t.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
}

/** Sørensen–Dice coefficient over character bigrams, in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a.length || !b.length) return 0;
  const A = bigrams(a);
  const B = bigrams(b);
  let inter = 0;
  let total = 0;
  for (const [g, n] of A) {
    inter += Math.min(n, B.get(g) ?? 0);
    total += n;
  }
  for (const n of B.values()) total += n;
  return (2 * inter) / total;
}

/** Edit distance, used to tolerate single-character OCR slips in short words. */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0] ?? 0;
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j] ?? 0;
      prev[j] = Math.min((prev[j] ?? 0) + 1, (prev[j - 1] ?? 0) + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length] ?? 0;
}
