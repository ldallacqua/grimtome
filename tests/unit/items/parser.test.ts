import { describe, expect, it } from 'vitest';
import { AffixDictionary, affixKey } from '@/domain/items/affixes';
import { markVerified, parseTooltip, rarityFromColor, slotFromType } from '@/domain/items/parser';
import { firstNumber, normalizeLabel, rollRange, stripBullet } from '@/domain/items/text';
import type { OcrLine } from '@/domain/items/types';
import {
  GARBLED,
  LEGENDARY_GLOVES_EARTHQUAKES,
  MYTHIC_HARLEQUIN,
  RARE_GLOVES_CRIT,
  RARE_RING_UNKNOWN,
  UNIQUE_MAGNUM_OPUS,
  type TooltipFixture,
} from '../../fixtures/tooltips';

const toLines = (f: TooltipFixture): OcrLine[] => f.lines.map((text, i) => ({ text, ...(f.colors?.[i] ?? {}) }));

describe('text normalization', () => {
  it('reduces affix lines to labels', () => {
    expect(normalizeLabel('+12.5% Critical Strike Chance [10.0 - 15.0]%')).toBe('critical strike chance');
    expect(normalizeLabel('1,250 Maximum Life')).toBe('maximum life');
    expect(normalizeLabel('x15% Vulnerable Damage')).toBe('vulnerable damage');
  });

  it('parses numbers in several formats', () => {
    expect(firstNumber('+12.5% Critical Strike Chance')).toEqual({ value: 12.5, percent: true });
    expect(firstNumber('1,250 Maximum Life')).toEqual({ value: 1250, percent: false });
    expect(firstNumber('+12,5% Chance')).toEqual({ value: 12.5, percent: true });
    expect(firstNumber('no digits')).toBeNull();
  });

  it('reads roll ranges and bullets', () => {
    expect(rollRange('+12.5% Crit [10.0 - 15.0]%')).toEqual({ min: 10, max: 15 });
    expect(stripBullet('◆ +12% Attack Speed')).toMatchObject({ text: '+12% Attack Speed', hadBullet: true });
    expect(stripBullet('+12% Attack Speed').hadBullet).toBe(false);
    expect(stripBullet('★ +12% Attack Speed').bullet).toBe('★');
  });
});

describe('affix dictionary', () => {
  const dict = new AffixDictionary();

  it('matches exact labels and aliases', () => {
    expect(dict.match('+12.5% Critical Strike Chance')?.key).toBe('critical-strike-chance');
    expect(dict.match('+9% Fury Cost Reduction')?.key).toBe(affixKey('Resource Cost Reduction'));
  });

  it('tolerates small OCR slips but not different stats', () => {
    const slip = dict.match('+12.5% Critlcal Strike Chance');
    expect(slip?.key).toBe('critical-strike-chance');
    expect(slip?.method).toBe('fuzzy');
    // "Damage" alone must not swallow a longer, unknown stat.
    expect(dict.match('+30% Damage to Bewitched Enemies')).toBeNull();
    expect(dict.match('+12% Critical Strike Damage')?.key).toBe('critical-strike-damage');
  });

  it('recognizes skill rank affixes', () => {
    expect(dict.match('+2 to Whirlwind')).toMatchObject({ key: 'skill-ranks.whirlwind', method: 'skill-rank' });
  });

  it('extends with catalog templates without changing built-in keys', () => {
    const ext = dict.withTemplates([
      { key: 'Crit_Percent_Bonus', text: '+[{VALUE}*100|1%|] Critical Strike Chance' },
      { key: 'Barb_Berserking_AttackSpeed', text: '+[{VALUE}*100|1%|] Attack Speed while Berserking' },
    ]);
    expect(ext.size).toBeGreaterThan(dict.size);
    expect(ext.match('+10% Critical Strike Chance')?.key).toBe('critical-strike-chance');
    expect(ext.match('+10% Attack Speed while Berserking')?.key).toBe('attack-speed-while-berserking');
  });
});

describe('parseTooltip', () => {
  it('parses a rare item completely', () => {
    const item = parseTooltip(toLines(RARE_GLOVES_CRIT));
    expect(item).toMatchObject({
      name: 'Grim Grasp',
      rarity: 'rare',
      ancestral: true,
      itemType: 'Gloves',
      slot: 'gloves',
      itemPower: 800,
      requiredLevel: 60,
    });
    expect(item.affixes.map((a) => a.key)).toEqual([
      'critical-strike-chance',
      'attack-speed',
      'strength',
      'lucky-hit-chance',
    ]);
    expect(item.affixes[0]).toMatchObject({ value: 12.5, percent: true, range: { min: 10, max: 15 } });
    expect(item.baseStats).toEqual(['1,126 Armor']);
    expect(item.confidence.level).toBe('high');
  });

  it('detects greater affixes and joins wrapped power text', () => {
    const item = parseTooltip(toLines(LEGENDARY_GLOVES_EARTHQUAKES));
    expect(item.rarity).toBe('legendary');
    expect(item.sockets).toBe(1);
    const crit = item.affixes.find((a) => a.key === 'critical-strike-chance');
    expect(crit?.greater).toBe(true);
    expect(item.affixes.find((a) => a.key === 'movement-speed')?.greater).toBe(false);
    expect(item.powerText).toContain('tremors');
    expect(item.powerText).toContain('4 seconds.');
  });

  it('parses uniques and mythics', () => {
    const opus = parseTooltip(toLines(UNIQUE_MAGNUM_OPUS));
    expect(opus).toMatchObject({ rarity: 'unique', slot: 'weapon', itemType: 'Two-Handed Mace' });
    expect(opus.powerText).toMatch(/Fury/);
    const crest = parseTooltip(toLines(MYTHIC_HARLEQUIN));
    expect(crest.rarity).toBe('mythic');
    expect(crest.affixes[0]?.key).toBe('skill-ranks.all-skills');
  });

  it('keeps unknown lines as unrecognized affixes instead of guessing', () => {
    const lines = [...RARE_RING_UNKNOWN.lines.slice(0, 3), '◆ +14% Bewitchment Potency', ...RARE_RING_UNKNOWN.lines.slice(3)];
    const item = parseTooltip(lines);
    const unknown = item.affixes.find((a) => a.raw.includes('Bewitchment'));
    expect(unknown).toMatchObject({ key: null, method: 'none' });
    expect(item.confidence.issues.join(' ')).toMatch(/not recognized/);
  });

  it('marks garbage as low confidence', () => {
    const item = parseTooltip(GARBLED.lines);
    expect(item.confidence.level).toBe('low');
    expect(item.slot).toBeNull();
  });

  it('flags equipped comparison tooltips', () => {
    expect(parseTooltip(['EQUIPPED', ...RARE_GLOVES_CRIT.lines]).equipped).toBe(true);
  });

  it('infers rarity from color only when the type line is missing', () => {
    const item = parseTooltip([{ text: 'Gauntlets of Earthquakes', color: '#f08a2c' }, { text: '800 Item Power' }]);
    expect(item.rarity).toBe('legendary');
    expect(item.confidence.issues).toContain('Rarity inferred from the name color.');
  });

  it('verifies corrected items', () => {
    const item = markVerified(parseTooltip(GARBLED.lines));
    expect(item.verified).toBe(true);
    expect(item.confidence.level).toBe('high');
  });
});

describe('helpers', () => {
  it('maps item types to slots', () => {
    expect(slotFromType('Two-Handed Sword')).toBe('weapon');
    expect(slotFromType('Chest Armor')).toBe('chest');
    expect(slotFromType('Shield')).toBe('offhand');
    expect(slotFromType('Luvas')).toBe('gloves');
    expect(slotFromType('Banner')).toBeNull();
  });

  it('maps name colors to rarity', () => {
    expect(rarityFromColor('#f08a2c')).toBe('legendary');
    expect(rarityFromColor('#ffff64')).toBe('rare');
    expect(rarityFromColor('#6e91ff')).toBe('magic');
    expect(rarityFromColor('#b27dff')).toBe('mythic');
    expect(rarityFromColor('#c7b377')).toBe('unique');
    expect(rarityFromColor(undefined)).toBeNull();
  });
});
