import { slugify } from '../shared/ids';
import { normalizeLabel, similarity } from './text';

/**
 * Affix recognition.
 *
 * A small, original dictionary of common gear stats ships with the app so the
 * parser works with no game data at all. When the optional local catalog is
 * imported, its affix templates extend the dictionary (`withTemplates`).
 *
 * Matching is deliberately conservative: an exact label match wins; a fuzzy
 * match must be both close and clearly better than the runner-up, otherwise the
 * affix stays *unrecognized* rather than being guessed.
 */

export type AffixCategory = 'stat' | 'offense' | 'defense' | 'utility' | 'resource' | 'skill';

export interface AffixDefinition {
  key: string;
  label: string;
  category: AffixCategory;
  aliases?: readonly string[];
}

export interface AffixMatch {
  key: string;
  label: string;
  category: AffixCategory;
  /** 0–1; 1 = exact. */
  confidence: number;
  method: 'exact' | 'template' | 'fuzzy' | 'skill-rank';
}

/** Canonical key for an affix label: `Critical Strike Chance` → `critical-strike-chance`. */
export function affixKey(label: string): string {
  return slugify(normalizeLabel(label));
}

const def = (label: string, category: AffixCategory, aliases?: string[]): AffixDefinition => ({
  key: affixKey(label),
  label,
  category,
  ...(aliases ? { aliases } : {}),
});

export const BUILTIN_AFFIXES: readonly AffixDefinition[] = [
  // Core stats
  def('Strength', 'stat'),
  def('Intelligence', 'stat'),
  def('Willpower', 'stat'),
  def('Dexterity', 'stat'),
  def('All Stats', 'stat'),
  // Offense
  def('Critical Strike Chance', 'offense'),
  def('Critical Strike Damage', 'offense'),
  def('Attack Speed', 'offense'),
  def('Vulnerable Damage', 'offense'),
  def('Overpower Damage', 'offense'),
  def('Overpower Chance', 'offense'),
  def('Damage', 'offense', ['All Damage']),
  def('Damage to Close Enemies', 'offense'),
  def('Damage to Distant Enemies', 'offense'),
  def('Damage to Elites', 'offense'),
  def('Damage to Crowd Controlled Enemies', 'offense'),
  def('Damage to Injured Enemies', 'offense'),
  def('Damage to Healthy Enemies', 'offense'),
  def('Damage to Slowed Enemies', 'offense'),
  def('Damage to Stunned Enemies', 'offense'),
  def('Damage to Weakened Enemies', 'offense'),
  def('Damage while Healthy', 'offense'),
  def('Damage while Fortified', 'offense'),
  def('Damage while Berserking', 'offense'),
  def('Damage Over Time', 'offense'),
  def('Bleeding Damage', 'offense'),
  def('Burning Damage', 'offense'),
  def('Poisoning Damage', 'offense'),
  def('Corrupting Damage', 'offense'),
  def('Physical Damage', 'offense'),
  def('Non-Physical Damage', 'offense'),
  def('Fire Damage', 'offense'),
  def('Cold Damage', 'offense'),
  def('Lightning Damage', 'offense'),
  def('Poison Damage', 'offense'),
  def('Shadow Damage', 'offense'),
  def('Holy Damage', 'offense'),
  def('Basic Skill Damage', 'offense', ['Basic Damage']),
  def('Core Skill Damage', 'offense', ['Core Damage']),
  def('Ultimate Damage', 'offense', ['Ultimate Skill Damage']),
  def('Summon Damage', 'offense', ['Minion Damage']),
  def('Main Hand Weapon Damage', 'offense'),
  def('Lucky Hit Chance', 'offense'),
  def('Critical Strike Chance Against Close Enemies', 'offense'),
  def('Critical Strike Chance Against Vulnerable Enemies', 'offense'),
  def('Critical Strike Chance Against Injured Enemies', 'offense'),
  def('Critical Strike Damage to Vulnerable Enemies', 'offense'),
  def('Critical Strike Damage to Crowd Controlled Enemies', 'offense'),
  def('Overpower Critical Damage', 'offense'),
  def('Thorns', 'offense'),
  // Defense
  def('Maximum Life', 'defense'),
  def('Life', 'defense'),
  def('Armor', 'defense'),
  def('Total Armor', 'defense'),
  def('Resistance to All Elements', 'defense', ['All Resistance']),
  def('Fire Resistance', 'defense'),
  def('Cold Resistance', 'defense'),
  def('Lightning Resistance', 'defense'),
  def('Poison Resistance', 'defense'),
  def('Shadow Resistance', 'defense'),
  def('Maximum Resistance to All Elements', 'defense'),
  def('Damage Reduction', 'defense'),
  def('Damage Reduction from Close Enemies', 'defense'),
  def('Damage Reduction from Distant Enemies', 'defense'),
  def('Damage Reduction from Elites', 'defense'),
  def('Damage Reduction while Fortified', 'defense'),
  def('Damage Reduction while Injured', 'defense'),
  def('Damage Reduction from Vulnerable Enemies', 'defense'),
  def('Dodge Chance', 'defense'),
  def('Block Chance', 'defense'),
  def('Barrier Generation', 'defense'),
  def('Fortify Generation', 'defense'),
  def('Healing Received', 'defense'),
  def('Life On Hit', 'defense'),
  def('Life On Kill', 'defense'),
  def('Life per 5 Seconds', 'defense', ['Life Regeneration']),
  def('Potion Healing', 'defense'),
  def('Impairment Reduction', 'defense', ['Crowd Control Duration Reduction']),
  // Utility & resource
  def('Movement Speed', 'utility'),
  def('Cooldown Reduction', 'utility'),
  def('Resource Cost Reduction', 'resource', [
    'Fury Cost Reduction',
    'Mana Cost Reduction',
    'Spirit Cost Reduction',
    'Essence Cost Reduction',
    'Energy Cost Reduction',
    'Vigor Cost Reduction',
  ]),
  def('Resource Generation', 'resource', [
    'Fury Generation',
    'Mana Generation',
    'Spirit Generation',
    'Essence Generation',
    'Energy Generation',
    'Vigor Generation',
  ]),
  def('Maximum Resource', 'resource', [
    'Maximum Fury',
    'Maximum Mana',
    'Maximum Spirit',
    'Maximum Essence',
    'Maximum Energy',
    'Maximum Vigor',
  ]),
  def('Crowd Control Duration', 'utility'),
  def('Faster Cast Rate', 'utility'),
  def('Gold Drop Rate', 'utility'),
];

export interface AffixTemplateInput {
  key: string;
  text: string;
}

export class AffixDictionary {
  private readonly exact = new Map<string, AffixDefinition>();
  private readonly entries: { norm: string; def: AffixDefinition }[] = [];

  constructor(defs: readonly AffixDefinition[] = BUILTIN_AFFIXES) {
    for (const d of defs) this.add(d, d.label);
  }

  private add(d: AffixDefinition, text: string) {
    const norm = normalizeLabel(text);
    if (!norm || this.exact.has(norm)) return;
    this.exact.set(norm, d);
    this.entries.push({ norm, def: d });
    for (const a of d.aliases ?? []) {
      const an = normalizeLabel(a);
      if (an && !this.exact.has(an)) {
        this.exact.set(an, d);
        this.entries.push({ norm: an, def: d });
      }
    }
  }

  get size(): number {
    return this.entries.length;
  }

  /**
   * Returns a dictionary extended with catalog templates (e.g. `+[{VALUE}*100|1%|] Critical Strike Chance`).
   * Built-in labels keep priority so keys stay stable with or without game data.
   */
  withTemplates(templates: readonly AffixTemplateInput[]): AffixDictionary {
    const next = new AffixDictionary([]);
    for (const e of this.entries) next.add(e.def, e.norm);
    for (const t of templates) {
      const label = t.text
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\{[^}]*\}/g, ' ')
        .replace(/\|[^|]*\|/g, ' ');
      const norm = normalizeLabel(label);
      if (norm.length < 4 || norm.split(' ').length > 9 || next.exact.has(norm)) continue;
      next.add({ key: slugify(norm), label: titleCase(norm), category: guessCategory(norm) }, norm);
    }
    return next;
  }

  match(text: string): AffixMatch | null {
    const norm = normalizeLabel(text);
    if (!norm) return null;
    const skill = /^to (.+)$/.exec(norm);
    if (skill?.[1] && /^\+?\s*\d/.test(text.trim())) {
      return {
        key: `skill-ranks.${slugify(skill[1])}`,
        label: `Ranks to ${titleCase(skill[1])}`,
        category: 'skill',
        confidence: 0.9,
        method: 'skill-rank',
      };
    }
    const hit = this.exact.get(norm);
    if (hit)
      return { key: hit.key, label: hit.label, category: hit.category, confidence: 1, method: 'exact' };

    let best: { score: number; def: AffixDefinition } | null = null;
    let second = 0;
    for (const e of this.entries) {
      const s = similarity(norm, e.norm);
      if (!best || s > best.score) {
        if (best && best.def.key !== e.def.key) second = Math.max(second, best.score);
        best = { score: s, def: e.def };
      } else if (e.def.key !== best.def.key) {
        second = Math.max(second, s);
      }
    }
    const lengthRatio = best
      ? Math.min(norm.length, best.def.label.length) / Math.max(norm.length, best.def.label.length)
      : 0;
    if (best && best.score >= 0.86 && best.score - second >= 0.06 && lengthRatio >= 0.7) {
      return {
        key: best.def.key,
        label: best.def.label,
        category: best.def.category,
        confidence: Math.round(best.score * 0.95 * 100) / 100,
        method: 'fuzzy',
      };
    }
    return null;
  }

  lookup(key: string): AffixDefinition | undefined {
    return this.entries.find((e) => e.def.key === key)?.def;
  }

  all(): AffixDefinition[] {
    const seen = new Set<string>();
    return this.entries.map((e) => e.def).filter((d) => (seen.has(d.key) ? false : (seen.add(d.key), true)));
  }
}

function titleCase(s: string): string {
  return s
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(To|Of|And|For|While|From|With|The|A|An|In|On)\b/g, (w) => w.toLowerCase());
}

function guessCategory(norm: string): AffixCategory {
  if (/resist|armor|reduction|life|barrier|fortify|dodge|block|healing/.test(norm)) return 'defense';
  if (/cost|generation|maximum (fury|mana|spirit|essence|energy|vigor|resource)/.test(norm))
    return 'resource';
  if (/movement|cooldown|cast rate|duration/.test(norm)) return 'utility';
  return 'offense';
}

export const defaultAffixDictionary = new AffixDictionary();
