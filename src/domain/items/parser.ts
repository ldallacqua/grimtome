import type { Rarity, Slot } from '../shared/ids';
import { type AffixDictionary, defaultAffixDictionary } from './affixes';
import { cleanLine, firstNumber, normalizeLabel, rollRange, stripBullet } from './text';
import type { ConfidenceLevel, OcrLine, ParsedAffix, ParsedItem } from './types';

/**
 * Turns the OCR'd lines of a single item tooltip into a structured item.
 *
 * The parser classifies each line (header, base stat, affix, power text,
 * footer) with tolerant patterns, never assumes an unknown stat is a known one,
 * and reports how confident it is so the UI can ask for a review.
 */

const RARITY_WORDS: Record<string, Rarity> = {
  common: 'common',
  comum: 'common',
  magic: 'magic',
  magico: 'magic',
  rare: 'rare',
  raro: 'rare',
  legendary: 'legendary',
  lendario: 'legendary',
  unique: 'unique',
  unico: 'unique',
  mythic: 'mythic',
  mitico: 'mythic',
};

const SLOT_WORDS: [RegExp, Slot][] = [
  [/\b(helm|helmet|elmo)\b/, 'helm'],
  [/\b(chest( armor)?|armadura( de torso| de peito)?|peitoral)\b/, 'chest'],
  [/\b(gloves|luvas)\b/, 'gloves'],
  [/\b(pants|legs|calcas)\b/, 'pants'],
  [/\b(boots|botas)\b/, 'boots'],
  [/\b(amulet|amuleto)\b/, 'amulet'],
  [/\b(ring|anel)\b/, 'ring'],
  [/\b(shield|focus|totem|escudo|foco)\b/, 'offhand'],
  [
    /\b(axe|sword|mace|dagger|wand|bow|crossbow|staff|polearm|scythe|glaive|quarterstaff|flail|machado|espada|maca|adaga|varinha|arco|besta|cajado|arma de haste|foice|bordao|mangual)\b/,
    'weapon',
  ],
];

const FOOTER_RE =
  /(requires? level|requer n[ií]vel|n[ií]vel necess|sell value|valor de venda|durability|durabilidade|account bound|vinculad[oa]|unique equip|equipamento [uú]nico|tradable|negoci[aá]vel|right.?click|left.?click|bot[aã]o (direito|esquerdo)|\bshift\b|to compare|para comparar|cannot be|n[aã]o pode)/i;
const SOCKET_RE = /(empty socket|engaste vazio|soquete vazio)/i;
const ITEM_POWER_RE = /(\d[\d.,]*)\s*(?:\+\s*\d+\s*)?(item power|poder do item)/i;
const LEVEL_RE = /(?:requires? level|requer n[ií]vel|n[ií]vel necess[aá]rio)\D{0,4}(\d{1,3})/i;
const MASTERWORK_RE = /(masterwork(?:ed|ing)?|quality|qualidade|obra-?prima)\D{0,14}(\d{1,2})\s*\/\s*(\d{1,2})/i;
const BASE_STAT_RE =
  /^\[?\d[\d.,\s-]*\]?\s*(armor|armadura|damage per (second|hit)|dano por (segundo|golpe)|attacks? per second|ataques por segundo|block chance|chance de bloqueio)\b/i;
const EQUIPPED_RE = /^(equipped|equipado|currently equipped)$/i;
const GREATER_BULLETS = /[★☆✦✧✱✲✳*]/u;

function deaccent(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

function hexToHsv(hex: string | undefined): { h: number; s: number; v: number } | null {
  if (!hex || !/^#?[0-9a-f]{6}$/i.test(hex)) return null;
  const n = parseInt(hex.replace('#', ''), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

/** Orange / gold icon → Greater Affix marker. */
function isGreaterIcon(color: string | undefined): boolean {
  const c = hexToHsv(color);
  return !!c && c.s > 0.45 && c.v > 0.45 && c.h >= 18 && c.h <= 52;
}

/** Cyan / steel-blue icon → tempered affix marker. */
function isTemperedIcon(color: string | undefined): boolean {
  const c = hexToHsv(color);
  return !!c && c.s > 0.3 && c.v > 0.4 && c.h >= 180 && c.h <= 225;
}

/** Infers rarity from an item-name text color (Diablo IV's rarity palette). */
export function rarityFromColor(color: string | undefined): Rarity | null {
  const c = hexToHsv(color);
  if (!c) return null;
  if (c.s < 0.18) return c.v > 0.75 ? 'common' : null;
  if (c.h >= 255 && c.h <= 300 && c.s > 0.25) return 'mythic';
  if (c.h >= 210 && c.h < 255) return 'magic';
  if (c.h >= 50 && c.h <= 66 && c.s > 0.5) return 'rare';
  if (c.h >= 15 && c.h < 38 && c.s > 0.55) return 'legendary';
  if (c.h >= 30 && c.h < 55 && c.s <= 0.55) return 'unique';
  return null;
}

function parseTypeLine(line: string): { rarity: Rarity; ancestral: boolean; type: string } | null {
  const words = deaccent(line).toLowerCase().split(/\s+/);
  let rarity: Rarity | null = null;
  let ancestral = false;
  const rest: string[] = [];
  for (const w of words) {
    const clean = w.replace(/[^a-z-]/g, '');
    if (clean === 'ancestral') ancestral = true;
    else if (RARITY_WORDS[clean]) {
      // "Mythic Unique Helm" → mythic wins over unique.
      const r = RARITY_WORDS[clean];
      if (!(rarity === 'mythic' && r === 'unique')) rarity = r;
    } else if (clean) rest.push(clean);
  }
  if (!rarity || rest.length === 0 || rest.length > 5) return null;
  const original = line.split(/\s+/).filter((w) => {
    const c = deaccent(w).toLowerCase().replace(/[^a-z-]/g, '');
    return c && c !== 'ancestral' && !RARITY_WORDS[c];
  });
  return { rarity, ancestral, type: original.join(' ') };
}

export function slotFromType(type: string | null): Slot | null {
  if (!type) return null;
  const t = deaccent(type).toLowerCase();
  for (const [re, slot] of SLOT_WORDS) if (re.test(t)) return slot;
  return null;
}

function isSentenceLike(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 6) return true;
  return /[.]$/.test(text) && words.length >= 3;
}

function looksLikeAffix(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  return /^[+\-x]?\s*\d/.test(text) && words.length <= 10;
}

export interface ParseOptions {
  dictionary?: AffixDictionary;
}

export function parseTooltip(input: readonly (OcrLine | string)[], options: ParseOptions = {}): ParsedItem {
  const dict = options.dictionary ?? defaultAffixDictionary;
  const lines = input
    .map((l) => (typeof l === 'string' ? { text: l } : l))
    .map((l) => ({ ...l, text: cleanLine(l.text) }))
    .filter((l) => l.text.length > 1 && /[\p{L}\d]/u.test(l.text));

  const issues: string[] = [];
  let equipped = false;

  // Header: optional "Equipped", name line(s), then the "<Ancestral> <Rarity> <Type>" line.
  let typeIdx = -1;
  let typeInfo: ReturnType<typeof parseTypeLine> = null;
  for (let i = 0; i < Math.min(lines.length, 7); i++) {
    const t = parseTypeLine(lines[i]!.text);
    if (t) {
      typeIdx = i;
      typeInfo = t;
      break;
    }
  }
  const headerLines = (typeIdx >= 0 ? lines.slice(0, typeIdx) : lines.slice(0, 1)).filter((l) => {
    if (EQUIPPED_RE.test(l.text)) {
      equipped = true;
      return false;
    }
    return true;
  });
  const name = headerLines.map((l) => l.text).join(' ').trim() || null;
  let rarity = typeInfo?.rarity ?? null;
  const colorRarity = rarityFromColor(headerLines[0]?.color);
  if (!rarity && colorRarity) {
    rarity = colorRarity;
    issues.push('Rarity inferred from the name color.');
  }
  const itemType = typeInfo?.type ?? null;
  const slot = slotFromType(itemType);
  if (!typeInfo) issues.push('Could not read the item type line.');
  if (!name) issues.push('Could not read the item name.');
  if (itemType && !slot) issues.push(`Unknown item type “${itemType}”.`);

  let itemPower: number | null = null;
  let requiredLevel: number | null = null;
  let sockets = 0;
  let masterwork: ParsedItem['masterwork'] = null;
  const baseStats: string[] = [];
  const affixes: ParsedAffix[] = [];
  const power: string[] = [];
  const unparsed: string[] = [];
  let unknownAffixLines = 0;

  const body = lines.slice(typeIdx >= 0 ? typeIdx + 1 : headerLines.length);
  for (let i = 0; i < body.length; i++) {
    const line = body[i]!;
    const text = line.text;
    const ip = ITEM_POWER_RE.exec(text);
    if (ip) {
      itemPower = firstNumber(ip[1] ?? '')?.value ?? null;
      continue;
    }
    const mw = MASTERWORK_RE.exec(text);
    if (mw) {
      masterwork = { rank: Number(mw[2]), max: Number(mw[3]) };
      continue;
    }
    if (SOCKET_RE.test(text)) {
      sockets++;
      continue;
    }
    if (FOOTER_RE.test(text)) {
      const lv = LEVEL_RE.exec(text);
      if (lv) requiredLevel = Number(lv[1]);
      continue;
    }
    if (EQUIPPED_RE.test(text)) {
      equipped = true;
      continue;
    }
    if (BASE_STAT_RE.test(text)) {
      baseStats.push(text);
      continue;
    }

    const { text: stripped, bullet, hadBullet } = stripBullet(text);
    const affixLike = hadBullet || looksLikeAffix(stripped);
    if (affixLike || !isSentenceLike(stripped)) {
      let match = dict.match(stripped);
      let consumed = 0;
      // Long affixes can wrap onto a second line.
      const next = body[i + 1];
      if (!match && next && !looksLikeAffix(next.text) && !stripBullet(next.text).hadBullet) {
        const merged = dict.match(`${stripped} ${next.text}`);
        if (merged) {
          match = merged;
          consumed = 1;
        }
      }
      if (match) {
        const num = firstNumber(stripped);
        affixes.push({
          raw: consumed ? `${text} ${next!.text}` : text,
          key: match.key,
          label: match.label,
          category: match.category,
          value: num?.value ?? null,
          percent: num?.percent ?? false,
          range: rollRange(text),
          greater: GREATER_BULLETS.test(bullet) || isGreaterIcon(line.iconColor),
          tempered: isTemperedIcon(line.iconColor),
          confidence: match.confidence,
          method: match.method,
        });
        i += consumed;
        continue;
      }
      if (affixLike) {
        unknownAffixLines++;
        const num = firstNumber(stripped);
        affixes.push({
          raw: text,
          key: null,
          label: normalizeLabel(stripped) || stripped,
          category: null,
          value: num?.value ?? null,
          percent: num?.percent ?? false,
          range: rollRange(text),
          greater: GREATER_BULLETS.test(bullet) || isGreaterIcon(line.iconColor),
          tempered: isTemperedIcon(line.iconColor),
          confidence: 0,
          method: 'none',
        });
        continue;
      }
    }
    if (isSentenceLike(stripped) || (power.length > 0 && /^[a-z(]/.test(stripped))) {
      power.push(stripped);
      continue;
    }
    unparsed.push(text);
  }

  // Confidence scoring — each deduction is explained in `issues`.
  let score = 1;
  if (!typeInfo) score -= 0.35;
  if (!name) score -= 0.2;
  if (itemPower === null && rarity !== 'common') {
    score -= 0.08;
    issues.push('Item Power not found.');
  }
  const known = affixes.filter((a) => a.key);
  if (rarity !== 'common' && known.length === 0) {
    score -= 0.3;
    issues.push('No affixes were recognized.');
  }
  if (unknownAffixLines) {
    score -= Math.min(0.3, unknownAffixLines * 0.08);
    issues.push(`${unknownAffixLines} affix line${unknownAffixLines > 1 ? 's were' : ' was'} not recognized.`);
  }
  const fuzzy = affixes.filter((a) => a.method === 'fuzzy').length;
  if (fuzzy) score -= fuzzy * 0.03;
  const ocrConf = lines.map((l) => l.confidence).filter((c): c is number => typeof c === 'number');
  if (ocrConf.length && ocrConf.reduce((a, b) => a + b, 0) / ocrConf.length < 0.7) {
    score -= 0.15;
    issues.push('The OCR engine reported low text confidence.');
  }
  if ((rarity === 'legendary' || rarity === 'unique' || rarity === 'mythic') && power.length === 0) {
    issues.push('No legendary/unique power text was found.');
    score -= 0.05;
  }
  score = Math.max(0, Math.min(1, score));
  const level: ConfidenceLevel = score >= 0.8 ? 'high' : score >= 0.55 ? 'medium' : 'low';

  return {
    name,
    rarity,
    ancestral: typeInfo?.ancestral ?? false,
    itemType,
    slot,
    itemPower,
    baseStats,
    affixes,
    powerText: power.length ? power.join(' ') : null,
    sockets,
    masterwork,
    requiredLevel,
    equipped,
    confidence: { level, score: Math.round(score * 100) / 100, issues },
    verified: false,
    unparsed,
  };
}

/** Re-scores a manually corrected item: reviewed items are trusted. */
export function markVerified(item: ParsedItem): ParsedItem {
  return { ...item, verified: true, confidence: { level: 'high', score: 1, issues: [] } };
}
