import { describe, expect, it } from 'vitest';
import { SAMPLE_BUILDS } from '@/domain/builds/samples';
import { parseTooltip } from '@/domain/items/parser';
import type { OcrResult, ParsedItem } from '@/domain/items/types';
import { evaluateItem } from '@/domain/recommendations/engine';
import * as tooltips from '../fixtures/tooltips';
import type { TooltipFixture } from '../fixtures/tooltips';

/**
 * Real Windows OCR output (recorded with `grimtome-ocr` from the sample tooltip
 * images) must parse to the same item as the hand-written ground truth, and get
 * the same verdict. This is the full capture → OCR → parse → evaluate path minus
 * the screen grab itself.
 */

const recorded = Object.entries(
  import.meta.glob<OcrResult>('../fixtures/ocr/*.json', { eager: true, import: 'default' }),
).map(([path, ocr]) => ({
  id: path
    .split('/')
    .pop()!
    .replace(/\.json$/, ''),
  ocr,
}));
const truth = new Map(
  Object.values(tooltips)
    .filter((v): v is TooltipFixture => typeof v === 'object' && v !== null && 'id' in v && 'lines' in v)
    .map((f) => [f.id, f]),
);

function summary(item: ParsedItem) {
  return {
    name: item.name,
    rarity: item.rarity,
    slot: item.slot,
    itemPower: item.itemPower,
    affixes: item.affixes.map((a) => ({ key: a.key, value: a.value, greater: a.greater })),
  };
}

describe('recorded Windows OCR fixtures', () => {
  it('covers every sample tooltip', () => {
    expect(recorded.length).toBeGreaterThanOrEqual(6);
  });

  for (const { id, ocr } of recorded) {
    it(`${id} parses like its ground truth`, () => {
      expect(ocr.engine).toBe('windows');
      const fixture = truth.get(id);
      expect(fixture, `ground truth for ${id}`).toBeDefined();
      const fromOcr = parseTooltip(ocr.lines);
      const fromTruth = parseTooltip(
        fixture!.lines.map((text, i) => ({ text, ...(fixture!.colors?.[i] ?? {}) })),
      );
      expect(summary(fromOcr)).toEqual(summary(fromTruth));
      expect(fromOcr.confidence.level).not.toBe('low');
      for (const role of ['leveling', 'endgame'] as const) {
        const ctx = { builds: SAMPLE_BUILDS, activeRole: role };
        expect(evaluateItem(fromOcr, ctx).verdict).toBe(evaluateItem(fromTruth, ctx).verdict);
      }
    });
  }
});
