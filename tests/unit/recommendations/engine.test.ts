import { describe, expect, it } from 'vitest';
import { SAMPLE_ENDGAME, SAMPLE_LEVELING } from '@/domain/builds/samples';
import { parseTooltip } from '@/domain/items/parser';
import type { OcrLine, ParsedItem } from '@/domain/items/types';
import { evaluateItem } from '@/domain/recommendations/engine';
import { renderReason } from '@/domain/recommendations/explain';
import { identifyAspect, identifyUnique } from '@/domain/recommendations/identify';
import type { EvaluationContext } from '@/domain/recommendations/types';
import {
  GARBLED,
  LEGENDARY_GLOVES_EARTHQUAKES,
  MYTHIC_HARLEQUIN,
  RARE_AMULET_ENDGAME,
  RARE_GLOVES_CRIT,
  RARE_RING_UNKNOWN,
  UNIQUE_MAGNUM_OPUS,
  type TooltipFixture,
} from '../../fixtures/tooltips';

const parse = (f: TooltipFixture): ParsedItem =>
  parseTooltip(f.lines.map((text, i): OcrLine => ({ text, ...(f.colors?.[i] ?? {}) })));

const leveling: EvaluationContext = {
  builds: { leveling: SAMPLE_LEVELING, endgame: SAMPLE_ENDGAME },
  activeRole: 'leveling',
};
const endgame: EvaluationContext = { ...leveling, activeRole: 'endgame' };

describe('evaluateItem — future build awareness', () => {
  it('stashes a unique the endgame build requires while leveling', () => {
    const ev = evaluateItem(parse(UNIQUE_MAGNUM_OPUS), leveling);
    expect(ev.verdict).toBe('stash');
    expect(ev.reasons.map((r) => r.code)).toContain('unique-future');
    expect(ev.summary).toMatch(/requires Ramaladni's Magnum Opus/);
    expect(ev.fits.endgame?.unique?.required).toBe(true);
  });

  it('re-evaluates after switching to the endgame build', () => {
    const item = parse(UNIQUE_MAGNUM_OPUS);
    expect(evaluateItem(item, leveling).verdict).toBe('stash');
    const ev = evaluateItem(item, endgame);
    expect(ev.verdict).toBe('upgrade');
    expect(ev.fits.leveling).toBeUndefined();
  });

  it('stashes a legendary whose aspect only the endgame build uses, explaining why', () => {
    const ev = evaluateItem(parse(LEGENDARY_GLOVES_EARTHQUAKES), leveling);
    expect(ev.verdict).toBe('stash');
    expect(ev.fits.endgame?.aspect?.name).toBe('Aspect of Earthquakes');
    expect(ev.summary).toMatch(
      /^Not particularly useful for your leveling build, but it carries Aspect of Earthquakes/,
    );
    expect(ev.summary).toMatch(/Consider storing it\.$/);
  });

  it('stashes rares with strong endgame affixes', () => {
    const ev = evaluateItem(parse(RARE_AMULET_ENDGAME), leveling);
    expect(ev.verdict).toBe('stash');
    expect(ev.fits.endgame?.tier).toBe('strong');
  });
});

describe('evaluateItem — active build', () => {
  it('flags strong rares as upgrade candidates without claiming DPS', () => {
    const ev = evaluateItem(parse(RARE_GLOVES_CRIT), leveling);
    expect(ev.verdict).toBe('upgrade');
    expect(ev.fits.leveling?.matched.map((m) => m.key)).toEqual(
      expect.arrayContaining(['critical-strike-chance', 'attack-speed']),
    );
    expect(ev.reasons.map((r) => r.code)).toContain('compare-equipped');
    expect(JSON.stringify(ev)).not.toMatch(/dps/i);
  });

  it('keeps instead of upgrading when the equipped item fits better', () => {
    const better = parse(RARE_GLOVES_CRIT);
    const weaker = parseTooltip([
      'Plain Gloves',
      'Rare Gloves',
      '800 Item Power',
      '◆ +12% Attack Speed',
      '◆ +4% Lucky Hit Chance',
      '◆ +80 Strength',
    ]);
    const ev = evaluateItem(weaker, { ...leveling, equipped: { gloves: better } });
    expect(ev.verdict).not.toBe('upgrade');
  });

  it('keeps unused mythics and salvages unused uniques', () => {
    const crest = parse(MYTHIC_HARLEQUIN);
    // Harlequin Crest is an optional unique in the endgame sample → stash while leveling.
    expect(evaluateItem(crest, leveling).verdict).toBe('stash');
    const otherMythic = { ...crest, name: 'Shroud of Nothing' };
    expect(evaluateItem(otherMythic, leveling).verdict).toBe('keep');
    const otherUnique = { ...parse(UNIQUE_MAGNUM_OPUS), name: 'Fists of Fate' };
    expect(evaluateItem(otherUnique, leveling).verdict).toBe('salvage');
  });

  it('suggests salvaging items with no identified value', () => {
    const ev = evaluateItem(parse(RARE_RING_UNKNOWN), leveling);
    expect(ev.verdict).toBe('salvage');
    expect(ev.reasons.map((r) => r.code)).toContain('no-value');
  });
});

describe('evaluateItem — conservative handling', () => {
  it('asks for review on unreadable tooltips', () => {
    const ev = evaluateItem(parseTooltip(GARBLED.lines), leveling);
    expect(ev.verdict).toBe('review');
    expect(ev.confidence).toBe('low');
  });

  it('never salvages a legendary whose power could not be identified', () => {
    const item = parseTooltip([
      'Mysterious Gloves',
      'Legendary Gloves',
      '800 Item Power',
      '◆ +20% Fire Resistance',
      'Your skills sometimes do something remarkable that nobody planned for at all.',
    ]);
    expect(evaluateItem(item, leveling).verdict).toBe('review');
  });

  it('asks for a build when none is loaded', () => {
    expect(evaluateItem(parse(RARE_GLOVES_CRIT), { builds: {}, activeRole: 'leveling' }).verdict).toBe(
      'review',
    );
  });

  it('trusts verified items even if OCR was poor', () => {
    const item = {
      ...parse(RARE_GLOVES_CRIT),
      verified: true,
      confidence: { level: 'low' as const, score: 0.2, issues: [] },
    };
    expect(evaluateItem(item, leveling).verdict).toBe('upgrade');
  });
});

describe('identification & explanations', () => {
  it('identifies aspects from item names', () => {
    expect(
      identifyAspect({ name: 'Gauntlets of Earthquakes', powerText: null }, [
        { name: 'Aspect of Earthquakes' },
      ])?.name,
    ).toBe('Aspect of Earthquakes');
    expect(
      identifyAspect({ name: "Earthstriker's Gloves", powerText: null }, [{ name: "Earthstriker's Aspect" }]),
    ).not.toBeNull();
    expect(
      identifyAspect({ name: 'Plain Gloves', powerText: null }, [{ name: 'Aspect of Earthquakes' }]),
    ).toBeNull();
  });

  it('identifies uniques tolerating OCR slips but not substrings of short names', () => {
    expect(identifyUnique("Ramaladni's Magnum 0pus", [{ name: "Ramaladni's Magnum Opus" }])).not.toBeNull();
    expect(identifyUnique('Eggs and Bacon', [{ name: 'Egg' }])).toBeNull();
  });

  it('renders reasons in English and Brazilian Portuguese', () => {
    const params = { aspect: 'Aspect of Earthquakes', build: 'Earthquake Hammer' };
    expect(renderReason('aspect-future', params)).toMatch(/planned Earthquake Hammer build/);
    expect(renderReason('aspect-future', params, 'pt-BR')).toMatch(/build planejada/);
  });
});
