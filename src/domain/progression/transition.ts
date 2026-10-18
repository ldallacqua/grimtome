import type { Build, NamedRef } from '../builds/schema';
import type { BuildRole } from '../shared/ids';

/**
 * Leveling → endgame transition: readiness evaluation plus an explicit state
 * machine. The phase only changes through user events (ACCEPT / REVERT); the
 * app never switches builds on its own.
 */

export interface CharacterProgress {
  level: number;
  paragon: number;
  /** Lower-cased names of uniques the player has obtained. */
  ownedUniques: string[];
  /** Lower-cased names of aspects the player has obtained. */
  ownedAspects: string[];
  skillSteps: Record<BuildRole, number>;
  paragonCompleted: Record<BuildRole, string[]>;
  /** Custom criteria the player has checked off. */
  customMet: string[];
}

export const emptyProgress = (): CharacterProgress => ({
  level: 1,
  paragon: 0,
  ownedUniques: [],
  ownedAspects: [],
  skillSteps: { leveling: 0, endgame: 0 },
  paragonCompleted: { leveling: [], endgame: [] },
  customMet: [],
});

export interface Criterion {
  id: string;
  label: string;
  met: boolean;
  detail: string;
  /** Required criteria block the "ready" status; optional ones are informational. */
  required: boolean;
  kind: 'level' | 'paragon' | 'unique' | 'aspect' | 'skills' | 'custom';
}

export type ReadinessStatus = 'unavailable' | 'not-ready' | 'ready';

export interface Readiness {
  status: ReadinessStatus;
  criteria: Criterion[];
  met: number;
  total: number;
  missing: Criterion[];
}

const owns = (list: readonly string[], ref: NamedRef) => list.includes(ref.name.toLowerCase());

export function transitionReadiness(builds: Partial<Record<BuildRole, Build>>, progress: CharacterProgress): Readiness {
  const endgame = builds.endgame;
  if (!endgame) return { status: 'unavailable', criteria: [], met: 0, total: 0, missing: [] };
  const t = endgame.transition;
  const criteria: Criterion[] = [];
  if (t?.minLevel) {
    criteria.push({
      id: 'level',
      kind: 'level',
      label: `Reach level ${t.minLevel}`,
      met: progress.level >= t.minLevel,
      detail: `Level ${progress.level} / ${t.minLevel}`,
      required: true,
    });
  }
  if (t?.minParagon) {
    criteria.push({
      id: 'paragon',
      kind: 'paragon',
      label: `Reach Paragon ${t.minParagon}`,
      met: progress.paragon >= t.minParagon,
      detail: `Paragon ${progress.paragon} / ${t.minParagon}`,
      required: true,
    });
  }
  for (const u of t?.requiredUniques ?? []) {
    criteria.push({
      id: `unique:${u.name.toLowerCase()}`,
      kind: 'unique',
      label: `Obtain ${u.name}`,
      met: owns(progress.ownedUniques, u),
      detail: owns(progress.ownedUniques, u) ? 'Obtained' : 'Not obtained yet',
      required: true,
    });
  }
  for (const a of t?.requiredAspects ?? []) {
    criteria.push({
      id: `aspect:${a.name.toLowerCase()}`,
      kind: 'aspect',
      label: `Obtain ${a.name}`,
      met: owns(progress.ownedAspects, a),
      detail: owns(progress.ownedAspects, a) ? 'Obtained' : 'Not obtained yet',
      required: true,
    });
  }
  if (t?.minSkillSteps && builds.leveling) {
    const done = progress.skillSteps.leveling;
    criteria.push({
      id: 'skills',
      kind: 'skills',
      label: `Allocate ${t.minSkillSteps} leveling skill points`,
      met: done >= t.minSkillSteps,
      detail: `${Math.min(done, t.minSkillSteps)} / ${t.minSkillSteps}`,
      required: false,
    });
  }
  for (const c of t?.custom ?? []) {
    criteria.push({
      id: `custom:${c}`,
      kind: 'custom',
      label: c,
      met: progress.customMet.includes(c),
      detail: progress.customMet.includes(c) ? 'Done' : 'Not done',
      required: true,
    });
  }
  const required = criteria.filter((c) => c.required);
  const missing = criteria.filter((c) => !c.met);
  const status: ReadinessStatus = required.every((c) => c.met) ? 'ready' : 'not-ready';
  return { status, criteria, met: criteria.filter((c) => c.met).length, total: criteria.length, missing };
}

export interface TransitionEntry {
  at: string;
  kind: 'accept' | 'revert' | 'postpone';
  from: BuildRole;
  to: BuildRole;
}

export interface TransitionState {
  phase: BuildRole;
  /** When set, the "transition available" prompt is snoozed until one of these is reached. */
  postponedUntil: { level?: number; paragon?: number } | null;
  history: TransitionEntry[];
}

export const initialTransitionState = (): TransitionState => ({ phase: 'leveling', postponedUntil: null, history: [] });

export type TransitionEvent =
  | { type: 'ACCEPT'; at: string }
  | { type: 'REVERT'; at: string }
  | { type: 'POSTPONE'; at: string; untilLevel?: number; untilParagon?: number };

export class TransitionError extends Error {}

/** Pure reducer. Throws on invalid events so the UI can never desynchronize. */
export function transition(state: TransitionState, event: TransitionEvent, hasEndgame: boolean): TransitionState {
  switch (event.type) {
    case 'ACCEPT':
      if (state.phase !== 'leveling') throw new TransitionError('Already on the endgame build.');
      if (!hasEndgame) throw new TransitionError('No endgame build is configured.');
      return {
        phase: 'endgame',
        postponedUntil: null,
        history: [...state.history, { at: event.at, kind: 'accept', from: 'leveling', to: 'endgame' }],
      };
    case 'REVERT':
      if (state.phase !== 'endgame') throw new TransitionError('Already on the leveling build.');
      return {
        phase: 'leveling',
        postponedUntil: null,
        history: [...state.history, { at: event.at, kind: 'revert', from: 'endgame', to: 'leveling' }],
      };
    case 'POSTPONE':
      if (state.phase !== 'leveling') throw new TransitionError('Nothing to postpone after transitioning.');
      return {
        ...state,
        postponedUntil: {
          ...(event.untilLevel !== undefined ? { level: event.untilLevel } : {}),
          ...(event.untilParagon !== undefined ? { paragon: event.untilParagon } : {}),
        },
        history: [...state.history, { at: event.at, kind: 'postpone', from: 'leveling', to: 'leveling' }],
      };
  }
}

/** Whether to surface the “Endgame transition available” prompt. */
export function shouldPromptTransition(
  state: TransitionState,
  readiness: Readiness,
  progress: Pick<CharacterProgress, 'level' | 'paragon'>,
): boolean {
  if (state.phase !== 'leveling' || readiness.status !== 'ready') return false;
  const p = state.postponedUntil;
  if (!p) return true;
  return (p.level !== undefined && progress.level >= p.level) || (p.paragon !== undefined && progress.paragon >= p.paragon);
}
