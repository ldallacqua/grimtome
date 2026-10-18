import type { AffixPriority, AffixWeight, Build, GearPlan, ParagonStep, SkillStep } from '@/domain/builds/schema';
import { type AffixDictionary } from '@/domain/items/affixes';
import { slotFromType } from '@/domain/items/parser';
import { cleanLine, stripBullet } from '@/domain/items/text';
import { CLASS_NAMES, type BuildRole, type ClassId, type Slot } from '@/domain/shared/ids';
import type { GameCatalog } from '../assets/types';

/**
 * "Paste a guide" importer.
 *
 * The player copies text from a guide they are reading (Maxroll or any other
 * site) and pastes it here. Grimtome recognizes known entity names using the
 * local game catalog and builds a *draft* for review. Nothing is fetched from
 * any website, and nothing is inferred beyond what the pasted text names.
 */

export interface PasteImportOptions {
  classId: ClassId;
  role: BuildRole;
  name?: string;
  sourceUrl?: string;
  catalog: GameCatalog | null;
  dictionary: AffixDictionary;
  now?: string;
}

export interface PasteImportResult {
  build: Build;
  counts: { skills: number; upgrades: number; aspects: number; uniques: number; affixes: number; boards: number; glyphs: number };
  warnings: string[];
}

const SLOT_HEADER: [RegExp, Slot][] = [
  [/\b(helm|helmet)\b/i, 'helm'],
  [/\bchest( armor)?\b/i, 'chest'],
  [/\bgloves\b/i, 'gloves'],
  [/\b(pants|legs)\b/i, 'pants'],
  [/\bboots\b/i, 'boots'],
  [/\bamulet\b/i, 'amulet'],
  [/\brings?\b/i, 'ring'],
  [/\b(off-?hand|shield|focus|totem)\b/i, 'offhand'],
  [/\b(weapon|two-handed|one-handed|main hand|2h|1h)\b/i, 'weapon'],
];

function slotIn(line: string): Slot | null {
  for (const [re, slot] of SLOT_HEADER) if (re.test(line)) return slot;
  return null;
}

function containsName(haystack: string, name: string): boolean {
  if (name.length < 3) return false;
  const esc = name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z])${esc}([^a-z]|$)`).test(haystack);
}

const weightFor = (i: number): AffixWeight => (i < 2 ? 3 : i < 4 ? 2 : 1);

export function importFromText(text: string, opts: PasteImportOptions): PasteImportResult {
  const now = opts.now ?? new Date().toISOString();
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => cleanLine(l))
    .filter((l) => l.length > 1);
  const cat = opts.catalog;
  if (!cat) warnings.push('Game data is not imported, so only affixes and slots could be recognized. Import game assets in Settings for full recognition.');

  const classSkills = cat?.skills.filter((s) => s.class === opts.classId) ?? [];
  const aspects = cat?.aspects.filter((a) => !a.class || a.class === opts.classId) ?? [];
  const uniques = cat?.uniques.filter((u) => !u.class || u.class === opts.classId) ?? [];
  const boards = cat?.paragonBoards.filter((b) => !b.class || b.class === opts.classId) ?? [];
  const glyphs = cat?.glyphs ?? [];

  const skills: SkillStep[] = [];
  const rankOf = new Map<string, number>();
  const gear = new Map<string, GearPlan & { _affixCount: number }>();
  const paragon: ParagonStep[] = [];
  const counts = { skills: 0, upgrades: 0, aspects: 0, uniques: 0, affixes: 0, boards: 0, glyphs: 0 };
  let currentSlot: Slot | null = null;
  let ringIndex = 0;

  const planFor = (slot: Slot): GearPlan & { _affixCount: number } => {
    const key = slot === 'ring' ? `ring-${ringIndex}` : slot;
    let p = gear.get(key);
    if (!p) {
      p = { slot, affixes: [], tempers: [], masterwork: [], _affixCount: 0 };
      gear.set(key, p);
    }
    return p;
  };
  const addAffix = (slot: Slot, a: { key: string; label: string }, tempered: boolean) => {
    const plan = planFor(slot);
    const list = tempered ? plan.tempers : plan.affixes;
    if (list.some((x) => x.key === a.key)) return;
    const pr: AffixPriority = { key: a.key, label: a.label, weight: weightFor(plan._affixCount++) };
    list.push(pr);
    counts.affixes++;
  };

  for (const raw of lines) {
    const line = raw.toLowerCase();
    const header = slotIn(raw);
    if (header && raw.split(/\s+/).length <= 6) {
      if (header === 'ring' && currentSlot === 'ring' && gear.has(`ring-${ringIndex}`)) ringIndex++;
      currentSlot = header;
    }

    // Skills and their upgrades, in reading order.
    for (const s of classSkills) {
      if (!containsName(line, s.name)) continue;
      const up = s.upgrades.find((u) => containsName(line, u) && u.toLowerCase() !== s.name.toLowerCase());
      const last = skills.at(-1);
      if (up) {
        if (!rankOf.has(s.id)) {
          // An upgrade implies the skill itself was learned first.
          rankOf.set(s.id, 1);
          skills.push({ skill: { id: s.id, name: s.name }, kind: 'rank', rank: 1, maxRank: 5 });
          counts.skills++;
        }
        if (!skills.some((x) => x.kind === 'upgrade' && x.upgrade === up && x.skill.id === s.id)) {
          skills.push({ skill: { id: s.id, name: s.name }, kind: 'upgrade', upgrade: up });
          counts.upgrades++;
        }
      } else if (!(last && last.skill.id === s.id && last.kind === 'rank')) {
        const r = Math.min(5, (rankOf.get(s.id) ?? 0) + 1);
        rankOf.set(s.id, r);
        skills.push({ skill: { id: s.id, name: s.name }, kind: 'rank', rank: r, maxRank: 5 });
        counts.skills++;
      }
    }

    // Uniques carry their own slot; aspects attach to the current slot.
    for (const u of uniques) {
      if (!containsName(line, u.name)) continue;
      const slot = (u.slot as Slot) ?? currentSlot;
      if (!slot) continue;
      const plan = planFor(slot);
      if (!plan.unique) {
        plan.unique = { id: u.id, name: u.name, required: /\b(required|mandatory|core|must)\b/.test(line) };
        counts.uniques++;
      }
    }
    for (const a of aspects) {
      if (!containsName(line, a.name)) continue;
      const slot = slotIn(raw) ?? currentSlot;
      if (!slot) {
        warnings.push(`Found ${a.name} but no slot near it; add it manually if needed.`);
        continue;
      }
      const plan = planFor(slot);
      if (!plan.aspect) {
        plan.aspect = { id: a.id, name: a.name };
        counts.aspects++;
      }
    }

    // Paragon boards in order, glyphs attached to the latest board.
    for (const b of boards) {
      if (containsName(line, b.name) && !paragon.some((p) => p.board.id === b.id)) {
        paragon.push({ id: `p-${paragon.length + 1}`, board: { id: b.id, name: b.name } });
        counts.boards++;
      }
    }
    for (const g of glyphs) {
      if (!containsName(line, g.name) || !/glyph/.test(line)) continue;
      const target = [...paragon].reverse().find((p) => !p.glyph);
      if (target) {
        target.glyph = { id: g.id, name: g.name };
        counts.glyphs++;
      }
    }

    // Affix priorities: bullets, "A > B > C" chains, or slot-prefixed lines.
    if (currentSlot) {
      const tempered = /\btemper/i.test(raw);
      const body = raw.replace(/^[^:]{1,24}:\s*/, '');
      const parts = body.split(/\s*(?:>|›|»|\||,|;|\/)\s*/).filter(Boolean);
      for (const part of parts) {
        const m = opts.dictionary.match(stripBullet(part).text);
        if (m && m.method !== 'skill-rank' && m.confidence >= 0.9) addAffix(currentSlot, m, tempered);
      }
    }
  }

  if (!skills.length && cat) warnings.push(`No ${CLASS_NAMES[opts.classId]} skills were recognized.`);
  const build: Build = {
    schemaVersion: 1,
    id: `paste-${Date.parse(now).toString(36)}`,
    name: opts.name?.trim() || `${CLASS_NAMES[opts.classId]} ${opts.role === 'leveling' ? 'Leveling' : 'Endgame'} (pasted)`,
    classId: opts.classId,
    role: opts.role,
    source: {
      kind: opts.sourceUrl ? 'maxroll-link' : 'paste',
      ...(opts.sourceUrl ? { url: opts.sourceUrl } : {}),
      attribution: opts.sourceUrl ? `Text copied by you from ${opts.sourceUrl}` : 'Text pasted by you',
      importedAt: now,
    },
    skills,
    gear: [...gear.values()].map(({ _affixCount: _c, ...g }) => g),
    globalAffixes: [],
    paragon,
    updatedAt: now,
  };
  return { build, counts, warnings: [...new Set(warnings)].slice(0, 8) };
}

export { slotFromType };
