import type { Build, SkillStep } from '../builds/schema';

/**
 * Skill-point guidance. A build's `skills` list is the ordered allocation plan
 * from its source; progress is simply how many steps the player has marked done.
 * Nothing is inferred beyond what the source listed.
 */

export interface NextSkillPoint {
  index: number;
  total: number;
  step: SkillStep;
  /** e.g. “Rank 3/5”, “Upgrade: Enhanced Whirlwind”. */
  label: string;
}

export interface SkillSummary {
  name: string;
  id?: string;
  rank: number;
  plannedRank: number;
  maxRank?: number;
  upgradesTaken: string[];
  upgradesPlanned: string[];
  /** Index of the first step for this skill in the plan (for ordering). */
  firstStep: number;
}

export function stepLabel(step: SkillStep): string {
  if (step.kind === 'upgrade') return step.upgrade ? `Upgrade: ${step.upgrade}` : 'Upgrade';
  if (step.rank && step.maxRank) return `Rank ${step.rank}/${step.maxRank}`;
  if (step.rank) return `Rank ${step.rank}`;
  return 'Learn';
}

export function clampAllocated(build: Build, allocated: number): number {
  return Math.max(0, Math.min(build.skills.length, Math.floor(allocated)));
}

export function nextSkillPoint(build: Build, allocated: number): NextSkillPoint | null {
  const i = clampAllocated(build, allocated);
  const step = build.skills[i];
  if (!step) return null;
  return { index: i, total: build.skills.length, step, label: stepLabel(step) };
}

export function summarizeSkills(build: Build, allocated: number): SkillSummary[] {
  const done = clampAllocated(build, allocated);
  const map = new Map<string, SkillSummary>();
  build.skills.forEach((step, i) => {
    const key = step.skill.id ?? step.skill.name.toLowerCase();
    let s = map.get(key);
    if (!s) {
      s = {
        name: step.skill.name,
        ...(step.skill.id ? { id: step.skill.id } : {}),
        rank: 0,
        plannedRank: 0,
        upgradesTaken: [],
        upgradesPlanned: [],
        firstStep: i,
      };
      map.set(key, s);
    }
    if (step.maxRank) s.maxRank = step.maxRank;
    if (step.kind === 'rank') {
      const r = step.rank ?? s.plannedRank + 1;
      s.plannedRank = Math.max(s.plannedRank, r);
      if (i < done) s.rank = Math.max(s.rank, r);
    } else if (step.upgrade) {
      s.upgradesPlanned.push(step.upgrade);
      if (i < done) s.upgradesTaken.push(step.upgrade);
    }
  });
  return [...map.values()].sort((a, b) => a.firstStep - b.firstStep);
}

/** Steps grouped into milestones of `size` points for a compact checklist. */
export function milestones(build: Build, size = 5): { from: number; to: number; steps: SkillStep[] }[] {
  const out: { from: number; to: number; steps: SkillStep[] }[] = [];
  for (let i = 0; i < build.skills.length; i += size) {
    out.push({
      from: i,
      to: Math.min(build.skills.length, i + size),
      steps: build.skills.slice(i, i + size),
    });
  }
  return out;
}
