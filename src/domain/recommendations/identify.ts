import type { NamedRef } from '../builds/schema';
import type { ParsedItem } from '../items/types';
import { normalizeLabel, similarity } from '../items/text';

/**
 * Identifies which legendary aspect or unique an item carries.
 *
 * Diablo IV names legendary items after their aspect (“Edgemaster's Gloves”,
 * “Gloves of Earthquakes”), so distinctive aspect words in the item name are a
 * strong signal; the power text is compared against catalog descriptions as a
 * second signal when the optional catalog is available.
 */

const STOP = new Set(['aspect', 'of', 'the', 'a', 'an', 'and', 'de', 'do', 'da', 'aspecto']);

export function distinctiveWords(aspectName: string): string[] {
  return normalizeLabel(aspectName)
    .replace(/'s\b/g, '')
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w));
}

function nameScore(itemName: string, aspectName: string): number {
  const words = distinctiveWords(aspectName);
  if (!words.length) return 0;
  const hay = ` ${normalizeLabel(itemName).replace(/'s\b/g, '')} `;
  const hits = words.filter((w) => hay.includes(` ${w} `)).length;
  return hits / words.length;
}

function textScore(powerText: string, description: string): number {
  const strip = (s: string) =>
    normalizeLabel(s.replace(/\[[^\]]*\]/g, ' '))
      .split(' ')
      .filter((w) => w.length > 2)
      .join(' ');
  return similarity(strip(powerText), strip(description));
}

export interface AspectCandidate {
  id?: string;
  name: string;
  description?: string | null;
}

export function identifyAspect(
  item: Pick<ParsedItem, 'name' | 'powerText'>,
  candidates: readonly AspectCandidate[],
): (NamedRef & { confidence: number }) | null {
  let best: { c: AspectCandidate; score: number } | null = null;
  for (const c of candidates) {
    const byName = item.name ? nameScore(item.name, c.name) : 0;
    const byText = item.powerText && c.description ? textScore(item.powerText, c.description) : 0;
    // Full name match is decisive; text similarity needs to be clearly high.
    const score = Math.max(byName >= 1 ? 0.95 : byName * 0.6, byText >= 0.62 ? Math.min(0.92, byText + 0.2) : 0);
    if (!best || score > best.score) best = { c, score };
  }
  if (!best || best.score < 0.6) return null;
  return { ...(best.c.id ? { id: best.c.id } : {}), name: best.c.name, confidence: Math.round(best.score * 100) / 100 };
}

export function identifyUnique<T extends NamedRef>(itemName: string | null, candidates: readonly T[]): T | null {
  if (!itemName) return null;
  const n = normalizeLabel(itemName);
  let best: { c: T; score: number } | null = null;
  for (const c of candidates) {
    const cn = normalizeLabel(c.name);
    const contains = Math.min(n.length, cn.length) >= 8 && (n.includes(cn) || cn.includes(n));
    const score = n === cn ? 1 : contains ? 0.9 : similarity(n, cn);
    if (!best || score > best.score) best = { c, score };
  }
  return best && best.score >= 0.86 ? best.c : null;
}
