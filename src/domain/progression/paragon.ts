import type { Build, ParagonStep } from '../builds/schema';

/**
 * Milestone-based Paragon guidance. Node-by-node routing is only shown when the
 * source provides it; otherwise the plan is the ordered list of boards and
 * glyphs, each of which the player checks off.
 */

export interface ParagonMilestone extends ParagonStep {
  order: number;
  completed: boolean;
  current: boolean;
}

export function paragonMilestones(build: Build, completed: readonly string[]): ParagonMilestone[] {
  const done = new Set(completed);
  let currentAssigned = false;
  return build.paragon.map((step, i) => {
    const isDone = done.has(step.id);
    const current = !isDone && !currentAssigned;
    if (current) currentAssigned = true;
    return { ...step, order: i + 1, completed: isDone, current };
  });
}

export function currentParagonObjective(build: Build, completed: readonly string[]): ParagonMilestone | null {
  return paragonMilestones(build, completed).find((m) => m.current) ?? null;
}

export function paragonProgress(build: Build, completed: readonly string[]): { done: number; total: number } {
  const ids = new Set(build.paragon.map((p) => p.id));
  return { done: completed.filter((c) => ids.has(c)).length, total: build.paragon.length };
}
