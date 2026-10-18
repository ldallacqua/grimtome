import type { ParsedItem } from '../items/types';
import { SLOT_NAMES, type BuildRole } from '../shared/ids';
import { renderReason, type Params, type ReasonCode } from './explain';
import { evaluateFit } from './fit';
import type { BuildFit, Evaluation, EvaluationContext, Reason, ReasonTone, Verdict } from './types';

/**
 * Deterministic, explainable item evaluation against the configured builds.
 *
 * Rules are ordered from most to least decisive. Every verdict carries the
 * reasons that produced it. When information is missing the engine says so
 * (`review`) instead of guessing, and it never advises salvaging uniques,
 * mythics or unidentified legendaries on thin evidence.
 */

export interface StructuredReason extends Reason {
  code: ReasonCode;
  params: Params;
}

export interface StructuredEvaluation extends Evaluation {
  reasons: StructuredReason[];
}

function reason(tone: ReasonTone, code: ReasonCode, params: Params = {}, role?: BuildRole): StructuredReason {
  return { tone, code, params, ...(role ? { role } : {}), text: renderReason(code, params) };
}

const labels = (fit: BuildFit) => fit.matched.map((m) => m.label).join(', ');

export function evaluateItem(item: ParsedItem, ctx: EvaluationContext): StructuredEvaluation {
  const active = ctx.builds[ctx.activeRole];
  // While leveling, the endgame build is the "future" build. After the
  // transition, the leveling build no longer matters for item decisions.
  const futureRole: BuildRole | null = ctx.activeRole === 'leveling' && ctx.builds.endgame ? 'endgame' : null;
  const future = futureRole ? ctx.builds[futureRole] : undefined;

  const fits: Evaluation['fits'] = {};
  if (active) fits[ctx.activeRole] = evaluateFit(active, ctx.activeRole, item, ctx.catalog);
  if (future && futureRole) fits[futureRole] = evaluateFit(future, futureRole, item, ctx.catalog);
  const a = fits[ctx.activeRole];
  const f = futureRole ? fits[futureRole] : undefined;

  const reasons: StructuredReason[] = [];
  const caveats: string[] = [];
  const slotName = item.slot ? SLOT_NAMES[item.slot] : 'item';

  const result = (verdict: Verdict, headline: string, summary: string): StructuredEvaluation => {
    const dataGaps = [a, f].filter((x) => x && x.tier === 'unknown').length;
    let confidence: Evaluation['confidence'] = item.verified ? 'high' : item.confidence.level;
    if (dataGaps && confidence === 'high') confidence = 'medium';
    if (verdict === 'review') confidence = 'low';
    return { verdict, headline, summary, reasons, fits, confidence, caveats };
  };

  if (!active) {
    reasons.push(reason('warning', 'no-guidance', { build: 'your active build' }));
    return result('review', 'Add a build first', 'Load a leveling and an endgame build so Grimtome can judge this item.');
  }

  // 1. Unreliable reads are never turned into firm advice.
  if (item.confidence.level === 'low' && !item.verified) {
    reasons.push(reason('warning', 'low-confidence'));
    for (const issue of item.confidence.issues) caveats.push(issue);
    return result('review', 'Needs a closer look', 'The tooltip was hard to read. Check the recognized details and correct them for a recommendation.');
  }
  if (!item.slot && !(a?.unique || f?.unique)) {
    reasons.push(reason('warning', 'unknown-slot'));
    return result('review', 'Item type unclear', 'The item type could not be recognized. Set the slot to get a recommendation.');
  }
  if (item.ancestral) reasons.push(reason('neutral', 'ancestral'));
  const greaterOn = (fit: BuildFit | undefined) => fit?.matched.filter((m) => m.greater).map((m) => m.label) ?? [];

  // 2. Uniques and mythics are decided by build usage first.
  if (item.rarity === 'unique' || item.rarity === 'mythic') {
    const name = item.name ?? 'This unique';
    if (a?.unique) {
      reasons.push(reason('positive', 'unique-active', { unique: name, build: a.buildName, required: a.unique.required ? 1 : 0 }, ctx.activeRole));
      const eq = item.slot ? ctx.equipped?.[item.slot] : undefined;
      if (eq?.name && eq.name.toLowerCase() === name.toLowerCase()) {
        return result('keep', `Already part of ${a.buildName}`, `${name} is part of your ${a.buildName} build and you already wear one — keep the better roll.`);
      }
      reasons.push(reason('neutral', 'compare-equipped', { slot: slotName }));
      return result('upgrade', `Equip it in ${a.buildName}`, `${name} is part of your ${a.buildName} build. Equip it if you are not already using it.`);
    }
    if (f?.unique && futureRole) {
      reasons.push(reason('positive', 'unique-future', { unique: name, build: f.buildName, required: f.unique.required ? 1 : 0 }, futureRole));
      return result(
        'stash',
        `Save it for ${f.buildName}`,
        `Not used while leveling, but your ${f.buildName} build ${f.unique.required ? 'requires' : 'uses'} ${name}. Store it for the transition.`,
      );
    }
    if (item.rarity === 'mythic') {
      reasons.push(reason('neutral', 'mythic-unused'));
      return result('keep', 'Rare mythic — keep it', 'Neither build uses this mythic unique, but mythics are rare — keep it until you have checked other builds.');
    }
    reasons.push(reason('negative', 'unique-unused', { unique: name }));
    if (!a?.hasGuidance && !(f?.hasGuidance ?? true)) {
      caveats.push('Your builds have little gear data, so this could be wrong.');
      return result('review', 'Little gear data to compare', 'Neither build lists this unique, but your builds have little gear data to compare against.');
    }
    return result('salvage', 'Not used by either build', `Neither of your builds uses ${name}. Salvage or sell it unless you plan another build.`);
  }

  // 3. Legendary aspects.
  if (item.rarity === 'legendary') {
    if (a?.aspect) {
      reasons.push(reason('positive', 'aspect-active', { aspect: a.aspect.name, build: a.buildName, slot: slotName }, ctx.activeRole));
      if (a.tier === 'strong') {
        reasons.push(reason('positive', 'affixes-active', { count: a.matched.length, labels: labels(a), build: a.buildName }, ctx.activeRole));
        reasons.push(reason('neutral', 'compare-equipped', { slot: slotName }));
        return result('upgrade', `Likely upgrade for ${a.buildName}`, `Has the ${a.aspect.name} your build uses and strong affixes for this slot.`);
      }
      return result('keep', `Keep for its ${a.aspect.name}`, `Carries ${a.aspect.name}, which your ${a.buildName} build uses. Keep it to equip or imprint the aspect.`);
    }
    if (f?.aspect && futureRole) {
      reasons.push(reason('positive', 'aspect-future', { aspect: f.aspect.name, build: f.buildName }, futureRole));
      if (f.matched.length) reasons.push(reason('positive', 'affixes-future', { count: f.matched.length, labels: labels(f), build: f.buildName }, futureRole));
      const lead = a && a.tier !== 'strong' ? 'Not particularly useful for your leveling build, but it ' : 'It ';
      const extra = f.matched.length ? ` and ${f.matched.length} priority affix${f.matched.length === 1 ? '' : 'es'}` : '';
      return result('stash', `Save it for ${f.buildName}`, `${lead}carries ${f.aspect.name}${extra} for your ${f.buildName} build. Consider storing it.`);
    }
  }

  // 4. Affix fit.
  const eqItem = item.slot ? ctx.equipped?.[item.slot] : undefined;
  if (a && a.tier === 'strong') {
    reasons.push(reason('positive', 'affixes-active', { count: a.matched.length, labels: labels(a), build: a.buildName }, ctx.activeRole));
    const ga = greaterOn(a);
    if (ga.length) reasons.push(reason('positive', 'greater-affix', { labels: ga.join(', ') }, ctx.activeRole));
    if (eqItem) {
      const eqFit = evaluateFit(active, ctx.activeRole, eqItem, ctx.catalog);
      if (eqFit.ratio > a.ratio + 0.1) {
        reasons.push(reason('negative', 'equipped-better', { slot: slotName, build: a.buildName }, ctx.activeRole));
        if (f && futureRole && f.tier === 'strong') {
          reasons.push(reason('positive', 'affixes-future', { count: f.matched.length, labels: labels(f), build: f.buildName }, futureRole));
          return result('stash', `Save it for ${f.buildName}`, `Your equipped ${slotName} is better for now, but this one fits ${f.buildName} well.`);
        }
        return result('keep', `Backup for ${a.buildName}`, `Good affixes, but your equipped ${slotName} fits ${a.buildName} better. Keep it as a backup.`);
      }
    } else {
      reasons.push(reason('neutral', 'compare-equipped', { slot: slotName }));
    }
    return result('upgrade', `Likely upgrade for ${a.buildName}`, `Matches ${a.matched.length} top priorities for ${slotName} in ${a.buildName}. It may improve your character.`);
  }
  if (f && futureRole && f.tier === 'strong') {
    reasons.push(reason('positive', 'affixes-future', { count: f.matched.length, labels: labels(f), build: f.buildName }, futureRole));
    const ga = greaterOn(f);
    if (ga.length) reasons.push(reason('positive', 'greater-affix', { labels: ga.join(', ') }, futureRole));
    if (a && a.tier !== 'strong' && a.tier !== 'unknown') {
      reasons.push(reason('neutral', 'affixes-active', { count: a.matched.length, labels: labels(a) || 'none', build: a.buildName }, ctx.activeRole));
    }
    return result('stash', `Save it for ${f.buildName}`, `Not a priority while leveling, but it has ${f.matched.length} affixes your ${f.buildName} build wants. Consider storing it.`);
  }
  if (a && a.tier === 'partial') {
    reasons.push(reason('neutral', 'affixes-active', { count: a.matched.length, labels: labels(a), build: a.buildName }, ctx.activeRole));
    if (a.missingEssentials.length) reasons.push(reason('negative', 'missing-essentials', { labels: a.missingEssentials.join(', '), build: a.buildName }, ctx.activeRole));
    return result('keep', `Useful for ${a.buildName} for now`, `Partially matches ${a.buildName} for ${slotName}. Useful until you find a better one.`);
  }
  if (f && futureRole && f.tier === 'partial' && greaterOn(f).length) {
    reasons.push(reason('positive', 'greater-affix', { labels: greaterOn(f).join(', ') }, futureRole));
    return result('stash', `Save it for ${f.buildName}`, `Has a Greater Affix your ${f.buildName} build values. Consider storing it.`);
  }

  // 5. Unidentified legendary powers are never salvaged automatically.
  const buildsHaveAspects = [active, future].some((b) => b?.gear.some((g) => g.aspect));
  if (item.rarity === 'legendary' && item.powerText && buildsHaveAspects) {
    reasons.push(reason('warning', 'aspect-unidentified'));
    return result('review', 'Unrecognized legendary power', 'Its legendary power did not match your builds’ aspects. Check the power before salvaging.');
  }

  // 6. No identified value.
  const guidance = [a, f].filter((x): x is BuildFit => !!x);
  if (guidance.every((g) => !g.hasGuidance)) {
    guidance.forEach((g) => reasons.push(reason('warning', 'no-guidance', { build: g.buildName }, g.role)));
    return result('review', 'No priorities for this slot', `Your builds don't list priorities for ${slotName}, so Grimtome can't judge this item yet.`);
  }
  reasons.push(reason('negative', 'no-value'));
  if (item.confidence.level !== 'high' && !item.verified) {
    caveats.push('Some lines were not recognized; double-check before salvaging.');
  }
  return result('salvage', 'No use in either build', 'Neither of your builds has an identified use for this item.');
}
