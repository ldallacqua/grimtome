import type { AffixPriority, Build, GearPlan, NamedRef } from '../builds/schema';
import type { ParsedItem } from '../items/types';
import type { BuildRole } from '../shared/ids';
import { identifyAspect, identifyUnique, type AspectCandidate } from './identify';
import type { BuildFit, CatalogHints, FitTier, MatchedAffix } from './types';

/** How many of a slot's priorities an item can realistically carry (affixes + tempers). */
const TOP_PRIORITIES = 4;

function plansForSlot(build: Build, item: ParsedItem): GearPlan[] {
  if (!item.slot) return [];
  return build.gear.filter((g) => g.slot === item.slot);
}

function dedupePriorities(list: AffixPriority[]): AffixPriority[] {
  const best = new Map<string, AffixPriority>();
  for (const p of list) {
    const cur = best.get(p.key);
    if (!cur || p.weight > cur.weight) best.set(p.key, p);
  }
  return [...best.values()].sort((a, b) => b.weight - a.weight);
}

function fitAgainstPlan(build: Build, plan: GearPlan | null, item: ParsedItem) {
  const affixPriorities = dedupePriorities([...(plan?.affixes ?? []), ...build.globalAffixes]);
  const temperKeys = new Set((plan?.tempers ?? []).map((t) => t.key));
  const all = dedupePriorities([...affixPriorities, ...(plan?.tempers ?? [])]);
  const matched: MatchedAffix[] = [];
  for (const a of item.affixes) {
    if (!a.key) continue;
    const p = all.find((x) => x.key === a.key);
    if (p && !matched.some((m) => m.key === p.key)) {
      matched.push({ key: p.key, label: p.label, weight: p.weight, greater: a.greater, tempered: a.tempered || temperKeys.has(p.key) });
    }
  }
  const possible = all.slice(0, TOP_PRIORITIES).reduce((s, p) => s + p.weight, 0);
  const got = matched.reduce((s, m) => s + m.weight + (m.greater ? 0.5 : 0), 0);
  const essentials = affixPriorities.filter((p) => p.weight === 3);
  const missingEssentials = essentials.filter((e) => !matched.some((m) => m.key === e.key)).map((e) => e.label);
  const ratio = possible ? Math.min(1, got / possible) : 0;
  const essentialHits = essentials.length - missingEssentials.length;
  let tier: FitTier;
  if (!all.length) tier = 'unknown';
  else if (ratio >= 0.62 || essentialHits >= 2) tier = 'strong';
  else if (ratio >= 0.3 || essentialHits >= 1) tier = 'partial';
  else if (matched.length) tier = 'weak';
  else tier = 'none';
  return { matched, missingEssentials, ratio: Math.round(ratio * 100) / 100, tier, hasGuidance: all.length > 0 };
}

function uniqueCandidates(build: Build): (NamedRef & { required: boolean })[] {
  const fromGear = build.gear.flatMap((g) => (g.unique ? [{ ...g.unique, required: g.unique.required }] : []));
  const fromTransition = (build.transition?.requiredUniques ?? []).map((u) => ({ ...u, required: true }));
  const merged = new Map<string, NamedRef & { required: boolean }>();
  for (const u of [...fromGear, ...fromTransition]) {
    const k = u.name.toLowerCase();
    const cur = merged.get(k);
    merged.set(k, cur ? { ...cur, required: cur.required || u.required } : u);
  }
  return [...merged.values()];
}

function aspectCandidates(build: Build, catalog?: CatalogHints): AspectCandidate[] {
  const names = new Set<string>();
  const out: AspectCandidate[] = [];
  const add = (a: NamedRef) => {
    if (names.has(a.name.toLowerCase())) return;
    names.add(a.name.toLowerCase());
    const cat = catalog?.aspects?.find((c) => c.name.toLowerCase() === a.name.toLowerCase());
    out.push({ ...(a.id ? { id: a.id } : {}), name: a.name, description: cat?.description ?? null });
  };
  build.gear.forEach((g) => g.aspect && add(g.aspect));
  (build.transition?.requiredAspects ?? []).forEach(add);
  return out;
}

export function evaluateFit(build: Build, role: BuildRole, item: ParsedItem, catalog?: CatalogHints): BuildFit {
  const plans = plansForSlot(build, item);
  // Rings (and some builds' weapons) can have several plans; keep the best-fitting one.
  const candidates = (plans.length ? plans : [null]).map((p) => ({ plan: p, fit: fitAgainstPlan(build, p, item) }));
  candidates.sort((a, b) => b.fit.ratio - a.fit.ratio);
  const best = candidates[0]!;

  let unique: BuildFit['unique'] = null;
  if (item.rarity === 'unique' || item.rarity === 'mythic') {
    unique = identifyUnique(item.name, uniqueCandidates(build));
  }
  let aspect: BuildFit['aspect'] = null;
  if (item.rarity === 'legendary') {
    const found = identifyAspect(item, aspectCandidates(build, catalog));
    if (found) aspect = found;
  }
  return { role, buildName: build.name, ...best.fit, unique, aspect };
}
