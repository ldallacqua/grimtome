import { affixKey } from '../items/affixes';
import { slugify, type Slot } from '../shared/ids';
import type { AffixPriority, AffixWeight, Build, GearPlan, ParagonStep, SkillStep } from './schema';

/**
 * Sample builds bundled for onboarding, demos and tests.
 *
 * They are ILLUSTRATIVE ONLY — written for Grimtome, not copied from any guide —
 * and every skill, aspect, unique, board and glyph name was checked against the
 * Season 15 / patch 3.2 game data. They are labelled as samples in the UI.
 */

const SAMPLE_ATTRIBUTION = 'Grimtome sample build — illustrative, not an official or community guide.';
const IMPORTED_AT = '2026-10-18T00:00:00.000Z';

const affix = (label: string, weight: AffixWeight, greater?: boolean): AffixPriority => ({
  key: affixKey(label),
  label,
  weight,
  ...(greater ? { greater } : {}),
});

const skillRef = (name: string) => ({ id: `skill.barbarian.${slugify(name)}`, name });
const rank = (name: string, r: number, maxRank = 5): SkillStep => ({
  skill: skillRef(name),
  kind: 'rank',
  rank: r,
  maxRank,
});
const upgrade = (name: string, upgradeName: string): SkillStep => ({
  skill: skillRef(name),
  kind: 'upgrade',
  upgrade: upgradeName,
});
const ranks = (name: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => rank(name, from + i));

const gear = (slot: Slot, opts: Partial<Omit<GearPlan, 'slot'>> = {}): GearPlan => ({
  slot,
  affixes: [],
  tempers: [],
  masterwork: [],
  ...opts,
});
const aspect = (name: string) => ({ id: `aspect.${slugify(name)}`, name });
const unique = (name: string, required: boolean) => ({ id: `item.${slugify(name)}`, name, required });
const board = (
  id: string,
  name: string,
  glyph?: string,
  focus?: string,
  targetParagon?: number,
): ParagonStep => ({
  id,
  board: { id: `paragon.board.barbarian.${slugify(name)}`, name },
  ...(glyph ? { glyph: { id: `paragon.glyph.${slugify(glyph)}`, name: glyph } } : {}),
  ...(focus ? { focus } : {}),
  ...(targetParagon !== undefined ? { targetParagon } : {}),
});

export const SAMPLE_LEVELING: Build = {
  schemaVersion: 1,
  id: 'sample-barbarian-whirlwind-leveling',
  name: 'Whirlwind Leveling',
  classId: 'barbarian',
  role: 'leveling',
  source: { kind: 'sample', attribution: SAMPLE_ATTRIBUTION, importedAt: IMPORTED_AT },
  season: 'Season 15',
  patch: '3.2',
  summary:
    'Spin through campaign content with Whirlwind, sustaining Fury with shouts and pulling enemies in.',
  skills: [
    rank('Lunging Strike', 1),
    rank('Whirlwind', 1),
    upgrade('Whirlwind', 'Enhanced Whirlwind'),
    rank('Whirlwind', 2),
    rank('Rallying Cry', 1),
    upgrade('Rallying Cry', 'Enhanced Rallying Cry'),
    rank('Whirlwind', 3),
    rank('War Cry', 1),
    upgrade('War Cry', 'Enhanced War Cry'),
    rank('Challenging Shout', 1),
    upgrade('Challenging Shout', 'Enhanced Challenging Shout'),
    ...ranks('Whirlwind', 4, 5),
    upgrade('Whirlwind', 'Winding'),
    rank('Iron Skin', 1),
    upgrade('Iron Skin', 'Enhanced Iron Skin'),
    ...ranks('Rallying Cry', 2, 3),
    rank('Wrath of the Berserker', 1),
    upgrade('Wrath of the Berserker', 'Maximum Carnage'),
    ...ranks('War Cry', 2, 3),
  ],
  globalAffixes: [affix('Strength', 2)],
  gear: [
    gear('weapon', {
      aspect: aspect('Aspect of the Dire Whirlwind'),
      affixes: [affix('Vulnerable Damage', 3), affix('Critical Strike Damage', 2), affix('Strength', 2)],
    }),
    gear('helm', {
      aspect: aspect('Aspect of Grasping Whirlwind'),
      affixes: [affix('Maximum Life', 3), affix('Cooldown Reduction', 2)],
    }),
    gear('chest', {
      aspect: aspect('Aspect of the Iron Warrior'),
      affixes: [affix('Maximum Life', 3), affix('Damage Reduction from Close Enemies', 2), affix('Armor', 1)],
    }),
    gear('gloves', {
      aspect: aspect('Aspect of Berserk Fury'),
      affixes: [affix('Attack Speed', 3), affix('Critical Strike Chance', 3), affix('Lucky Hit Chance', 1)],
    }),
    gear('pants', {
      aspect: aspect('Aspect of the Fortress'),
      affixes: [affix('Maximum Life', 3), affix('Damage Reduction', 2), affix('Armor', 1)],
    }),
    gear('boots', {
      aspect: aspect("Dust Devil's Aspect"),
      affixes: [affix('Movement Speed', 3), affix('Maximum Life', 2), affix('Resource Cost Reduction', 1)],
    }),
    gear('amulet', {
      aspect: aspect('Aspect of Limitless Rage'),
      affixes: [
        affix('Movement Speed', 2),
        affix('Cooldown Reduction', 2),
        affix('Resource Cost Reduction', 2),
      ],
    }),
    gear('ring', {
      aspect: aspect('Aspect of Encroaching Wrath'),
      affixes: [affix('Critical Strike Chance', 3), affix('Maximum Life', 2), affix('Vulnerable Damage', 2)],
    }),
  ],
  paragon: [
    board('lvl-start', 'Start', 'Ire', 'Strength nodes toward the glyph socket.', 10),
    board(
      'lvl-warbringer',
      'Warbringer',
      'Marshal',
      'Rare nodes near the socket, then the legendary node.',
      25,
    ),
  ],
  updatedAt: IMPORTED_AT,
};

export const SAMPLE_ENDGAME: Build = {
  schemaVersion: 1,
  id: 'sample-barbarian-hota-earthquake',
  name: 'Earthquake Hammer',
  classId: 'barbarian',
  role: 'endgame',
  source: { kind: 'sample', attribution: SAMPLE_ATTRIBUTION, importedAt: IMPORTED_AT },
  season: 'Season 15',
  patch: '3.2',
  summary:
    'Hammer of the Ancients leaves Earthquakes behind; Leap groups enemies and shouts keep uptime high.',
  skills: [
    rank('Bash', 1),
    upgrade('Bash', 'Enhanced Bash'),
    ...ranks('Hammer of the Ancients', 1, 3),
    upgrade('Hammer of the Ancients', 'Enhanced Hammer of the Ancients'),
    upgrade('Hammer of the Ancients', 'Fissure'),
    rank('Leap', 1),
    upgrade('Leap', 'Death From Above'),
    rank('Rallying Cry', 1),
    upgrade('Rallying Cry', 'Enhanced Rallying Cry'),
    rank('War Cry', 1),
    upgrade('War Cry', 'Enhanced War Cry'),
    rank('Challenging Shout', 1),
    upgrade('Challenging Shout', 'Enhanced Challenging Shout'),
    ...ranks('Hammer of the Ancients', 4, 5),
    rank('Wrath of the Berserker', 1),
    upgrade('Wrath of the Berserker', 'Maximum Carnage'),
    ...ranks('Leap', 2, 3),
  ],
  globalAffixes: [affix('Strength', 2), affix('Maximum Life', 1)],
  gear: [
    gear('weapon', {
      unique: unique("Ramaladni's Magnum Opus", true),
      affixes: [
        affix('Critical Strike Damage', 3, true),
        affix('Vulnerable Damage', 3),
        affix('Strength', 2),
      ],
      tempers: [affix('Overpower Damage', 2)],
    }),
    gear('helm', {
      unique: unique('Harlequin Crest', false),
      affixes: [affix('Maximum Life', 3), affix('Cooldown Reduction', 3)],
    }),
    gear('chest', {
      aspect: aspect('Aspect of Limitless Rage'),
      affixes: [affix('Maximum Life', 3), affix('Damage Reduction', 2), affix('Armor', 1)],
    }),
    gear('gloves', {
      aspect: aspect('Aspect of Earthquakes'),
      affixes: [affix('Critical Strike Chance', 3, true), affix('Attack Speed', 2), affix('Strength', 2)],
      tempers: [affix('Critical Strike Damage', 2)],
    }),
    gear('pants', {
      aspect: aspect('Aspect of Sundered Ground'),
      affixes: [affix('Maximum Life', 3), affix('Damage Reduction from Close Enemies', 2)],
    }),
    gear('boots', {
      aspect: aspect('Aspect of Bul-Kathos'),
      affixes: [affix('Movement Speed', 3), affix('Maximum Life', 2), affix('Resistance to All Elements', 1)],
    }),
    gear('amulet', {
      aspect: aspect('Aspect of Ancestral Force'),
      affixes: [affix('Cooldown Reduction', 3), affix('Damage Reduction', 2), affix('Movement Speed', 2)],
    }),
    gear('ring', {
      unique: unique('Ring of Red Furor', false),
      affixes: [
        affix('Critical Strike Chance', 3),
        affix('Critical Strike Damage', 3, true),
        affix('Vulnerable Damage', 2),
      ],
    }),
    gear('ring', {
      aspect: aspect("Earthstriker's Aspect"),
      affixes: [affix('Critical Strike Chance', 3), affix('Maximum Life', 2), affix('Overpower Damage', 2)],
    }),
  ],
  paragon: [
    board('end-start', 'Start', 'Ire', 'Strength nodes toward the glyph socket.', 10),
    board(
      'end-warbringer',
      'Warbringer',
      'Marshal',
      'Socket the glyph, then path to the legendary node.',
      40,
    ),
    board('end-decimator', 'Decimator', 'Might', 'Rare nodes inside the glyph radius first.', 80),
    board('end-bone-breaker', 'Bone Breaker', 'Wrath', undefined, 140),
    board('end-blood-rage', 'Blood Rage', 'Territorial', undefined, 200),
  ],
  transition: {
    minLevel: 60,
    minParagon: 20,
    requiredUniques: [{ id: 'item.ramaladnis-magnum-opus', name: "Ramaladni's Magnum Opus" }],
    requiredAspects: [aspect('Aspect of Earthquakes'), aspect('Aspect of Ancestral Force')],
    minSkillSteps: 12,
    custom: [],
  },
  updatedAt: IMPORTED_AT,
};

export const SAMPLE_BUILDS = { leveling: SAMPLE_LEVELING, endgame: SAMPLE_ENDGAME } as const;
