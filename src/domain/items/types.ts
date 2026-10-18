import type { Rarity, Slot } from '../shared/ids';
import type { AffixCategory } from './affixes';

/** One recognized text line, in screen order, as produced by an OCR engine. */
export interface OcrLine {
  text: string;
  bbox?: { x: number; y: number; w: number; h: number };
  /** Dominant text color as `#rrggbb`, when the engine can sample it. */
  color?: string;
  /** Dominant color of the icon/bullet just left of the line, when sampled. */
  iconColor?: string;
  /** Engine confidence 0–1, when reported. */
  confidence?: number;
}

export interface OcrResult {
  lines: OcrLine[];
  engine: 'windows' | 'fixture' | 'manual';
  language?: string;
  elapsedMs?: number;
  imageSize?: { w: number; h: number };
}

export interface ParsedAffix {
  /** Line as read (cleaned). */
  raw: string;
  /** Normalized affix key, or null when the stat was not recognized. */
  key: string | null;
  label: string;
  category: AffixCategory | null;
  value: number | null;
  percent: boolean;
  range: { min: number; max: number } | null;
  greater: boolean;
  tempered: boolean;
  /** Recognition confidence 0–1 for this line. */
  confidence: number;
  method: 'exact' | 'template' | 'fuzzy' | 'skill-rank' | 'none' | 'user';
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParseConfidence {
  level: ConfidenceLevel;
  score: number;
  issues: string[];
}

export interface ParsedItem {
  name: string | null;
  rarity: Rarity | null;
  ancestral: boolean;
  itemType: string | null;
  slot: Slot | null;
  itemPower: number | null;
  baseStats: string[];
  affixes: ParsedAffix[];
  /** Legendary aspect / unique power paragraph, when present. */
  powerText: string | null;
  sockets: number;
  masterwork: { rank: number; max: number } | null;
  requiredLevel: number | null;
  /** The tooltip was flagged as the currently equipped item. */
  equipped: boolean;
  confidence: ParseConfidence;
  /** True once a person has reviewed and corrected the result. */
  verified: boolean;
  /** Lines that were not understood (kept for transparency and corrections). */
  unparsed: string[];
}
