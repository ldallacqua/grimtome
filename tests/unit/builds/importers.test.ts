import { describe, expect, it } from 'vitest';
import { SAMPLE_ENDGAME, SAMPLE_LEVELING } from '@/domain/builds/samples';
import { defaultAffixDictionary } from '@/domain/items/affixes';
import type { GameCatalog } from '@/services/assets/types';
import { exportJson, importJson } from '@/services/importers/json';
import { parseMaxrollUrl } from '@/services/importers/maxroll';
import { importFromText } from '@/services/importers/paste';

/** A tiny hand-written catalog (no game data) for importer tests. */
const catalog: GameCatalog = {
  schemaVersion: 1,
  gameBuild: 'test',
  locale: 'enUS',
  classes: [],
  skills: [
    { id: 'skill.barbarian.hammer-of-the-ancients', class: 'barbarian', sno: 1, name: 'Hammer of the Ancients', summary: null, upgrades: ['Enhanced Hammer of the Ancients', 'Fissure'], icon: null },
    { id: 'skill.barbarian.leap', class: 'barbarian', sno: 2, name: 'Leap', summary: null, upgrades: ['Death From Above'], icon: null },
    { id: 'skill.sorcerer.fireball', class: 'sorcerer', sno: 3, name: 'Fireball', summary: null, upgrades: [], icon: null },
  ],
  uniques: [{ id: 'item.ramaladnis-magnum-opus', sno: 4, name: "Ramaladni's Magnum Opus", slot: 'weapon', class: 'barbarian', power: null, flavor: null, icon: null }],
  aspects: [{ id: 'aspect.aspect-of-earthquakes', sno: 5, name: 'Aspect of Earthquakes', class: 'barbarian', description: null }],
  glyphs: [{ id: 'paragon.glyph.might', sno: 6, name: 'Might', icon: null }],
  paragonBoards: [
    { id: 'paragon.board.barbarian.warbringer', sno: 7, name: 'Warbringer', class: 'barbarian' },
    { id: 'paragon.board.barbarian.decimator', sno: 8, name: 'Decimator', class: 'barbarian' },
  ],
  affixTemplates: [],
};

const GUIDE = `
Skills
1. Hammer of the Ancients
2. Enhanced Hammer of the Ancients
3. Leap - take Death From Above
4. Hammer of the Ancients

Gear
Weapon: Ramaladni's Magnum Opus (required)
Critical Strike Damage > Vulnerable Damage > Strength
Gloves
- Aspect of Earthquakes
- Critical Strike Chance
- Attack Speed
Tempering: Critical Strike Damage

Paragon
Warbringer — Glyph: Might
Decimator
`;

describe('paste importer', () => {
  it('builds a draft from pasted guide text using catalog names only', () => {
    const r = importFromText(GUIDE, { classId: 'barbarian', role: 'endgame', catalog, dictionary: defaultAffixDictionary, now: '2026-10-18T00:00:00Z' });
    expect(r.build.skills.map((s) => (s.kind === 'upgrade' ? `+${s.upgrade}` : `${s.skill.name} ${s.rank}`))).toEqual([
      'Hammer of the Ancients 1',
      '+Enhanced Hammer of the Ancients',
      'Leap 1',
      '+Death From Above',
      'Hammer of the Ancients 2',
    ]);
    const weapon = r.build.gear.find((g) => g.slot === 'weapon')!;
    expect(weapon.unique).toMatchObject({ name: "Ramaladni's Magnum Opus", required: true });
    expect(weapon.affixes.map((a) => [a.key, a.weight])).toEqual([
      ['critical-strike-damage', 3],
      ['vulnerable-damage', 3],
      ['strength', 2],
    ]);
    const gloves = r.build.gear.find((g) => g.slot === 'gloves')!;
    expect(gloves.aspect?.name).toBe('Aspect of Earthquakes');
    expect(gloves.tempers.map((t) => t.key)).toEqual(['critical-strike-damage']);
    expect(r.build.paragon.map((p) => [p.board.name, p.glyph?.name])).toEqual([
      ['Warbringer', 'Might'],
      ['Decimator', undefined],
    ]);
    expect(r.build.source.kind).toBe('paste');
  });

  it('ignores other classes and works without game data', () => {
    const r = importFromText('Fireball\nGloves: Critical Strike Chance', { classId: 'barbarian', role: 'leveling', catalog: null, dictionary: defaultAffixDictionary });
    expect(r.build.skills).toEqual([]);
    expect(r.build.gear[0]?.affixes[0]?.key).toBe('critical-strike-chance');
    expect(r.warnings[0]).toMatch(/Game data is not imported/);
  });
});

describe('json importer', () => {
  it('round-trips a build file', () => {
    const r = importJson(exportJson({ leveling: SAMPLE_LEVELING, endgame: SAMPLE_ENDGAME }));
    expect(r.ok && r.builds.endgame?.name).toBe('Earthquake Hammer');
  });

  it('accepts a single build and rejects invalid input with readable errors', () => {
    const single = importJson(JSON.stringify(SAMPLE_LEVELING));
    expect(single.ok && Object.keys(single.builds)).toEqual(['leveling']);
    const bad = importJson('{"format":"grimtome.builds","version":1,"leveling":{"name":"x"}}');
    expect(bad.ok).toBe(false);
    expect(importJson('nope').ok).toBe(false);
  });
});

describe('maxroll links', () => {
  it('validates links without fetching anything', () => {
    expect(parseMaxrollUrl('https://maxroll.gg/d4/build-guides/hota-barbarian-guide')).toMatchObject({ kind: 'guide', slug: 'hota-barbarian-guide' });
    expect(parseMaxrollUrl('https://maxroll.gg/d4/planner/abc123#2')).toMatchObject({ kind: 'planner', slug: 'abc123' });
    expect(parseMaxrollUrl('https://evil.example/d4/planner/x')).toBeNull();
    expect(parseMaxrollUrl('http://maxroll.gg/d4/planner/x')).toBeNull();
    expect(parseMaxrollUrl('not a url')).toBeNull();
  });
});
