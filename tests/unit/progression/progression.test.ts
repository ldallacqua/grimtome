import { describe, expect, it } from 'vitest';
import { SAMPLE_ENDGAME, SAMPLE_LEVELING } from '@/domain/builds/samples';
import { migrateBuild, parseBuildFile } from '@/domain/builds/schema';
import { currentParagonObjective, paragonMilestones, paragonProgress } from '@/domain/progression/paragon';
import { milestones, nextSkillPoint, stepLabel, summarizeSkills } from '@/domain/progression/skills';
import {
  emptyProgress,
  initialTransitionState,
  shouldPromptTransition,
  transition,
  TransitionError,
  transitionReadiness,
  type CharacterProgress,
} from '@/domain/progression/transition';

const builds = { leveling: SAMPLE_LEVELING, endgame: SAMPLE_ENDGAME };

describe('skill progression', () => {
  it('recommends the next skill point with a rank label', () => {
    const next = nextSkillPoint(SAMPLE_LEVELING, 6);
    expect(next?.step.skill.name).toBe('Whirlwind');
    expect(next?.label).toBe('Rank 3/5');
    expect(nextSkillPoint(SAMPLE_LEVELING, 999)).toBeNull();
    expect(stepLabel(SAMPLE_LEVELING.skills[2]!)).toBe('Upgrade: Enhanced Whirlwind');
  });

  it('summarizes ranks and upgrades per skill in plan order', () => {
    const summary = summarizeSkills(SAMPLE_LEVELING, 4);
    expect(summary[0]).toMatchObject({ name: 'Lunging Strike', rank: 1, plannedRank: 1 });
    const ww = summary.find((s) => s.name === 'Whirlwind')!;
    expect(ww).toMatchObject({ rank: 2, plannedRank: 5, maxRank: 5 });
    expect(ww.upgradesTaken).toEqual(['Enhanced Whirlwind']);
    expect(ww.upgradesPlanned).toEqual(['Enhanced Whirlwind', 'Winding']);
  });

  it('groups steps into milestones', () => {
    const m = milestones(SAMPLE_LEVELING, 5);
    expect(m[0]).toMatchObject({ from: 0, to: 5 });
    expect(m.at(-1)!.to).toBe(SAMPLE_LEVELING.skills.length);
  });
});

describe('paragon milestones', () => {
  it('tracks completion and the current objective', () => {
    const done = ['end-start'];
    const ms = paragonMilestones(SAMPLE_ENDGAME, done);
    expect(ms[0]).toMatchObject({ completed: true, current: false, order: 1 });
    expect(ms[1]).toMatchObject({ completed: false, current: true });
    expect(currentParagonObjective(SAMPLE_ENDGAME, done)?.glyph?.name).toBe('Marshal');
    expect(paragonProgress(SAMPLE_ENDGAME, [...done, 'unknown-id'])).toEqual({ done: 1, total: 5 });
  });
});

describe('transition readiness', () => {
  const ready: CharacterProgress = {
    ...emptyProgress(),
    level: 60,
    paragon: 25,
    ownedUniques: ["ramaladni's magnum opus"],
    ownedAspects: ['aspect of earthquakes', 'aspect of ancestral force'],
    skillSteps: { leveling: 12, endgame: 0 },
  };

  it('is unavailable without an endgame build', () => {
    expect(transitionReadiness({ leveling: SAMPLE_LEVELING }, ready).status).toBe('unavailable');
  });

  it('does not depend on level alone', () => {
    const r = transitionReadiness(builds, { ...ready, ownedUniques: [] });
    expect(r.status).toBe('not-ready');
    expect(r.missing.map((c) => c.kind)).toEqual(['unique']);
    expect(r.missing[0]?.label).toBe("Obtain Ramaladni's Magnum Opus");
  });

  it('is ready when every required criterion is met; skill steps are advisory', () => {
    const r = transitionReadiness(builds, { ...ready, skillSteps: { leveling: 3, endgame: 0 } });
    expect(r.status).toBe('ready');
    expect(r.missing.map((c) => c.kind)).toEqual(['skills']);
  });
});

describe('transition state machine', () => {
  const at = '2026-10-18T10:00:00Z';

  it('accepts, reverts and records history', () => {
    let s = initialTransitionState();
    s = transition(s, { type: 'ACCEPT', at }, true);
    expect(s.phase).toBe('endgame');
    s = transition(s, { type: 'REVERT', at }, true);
    expect(s.phase).toBe('leveling');
    expect(s.history.map((h) => h.kind)).toEqual(['accept', 'revert']);
  });

  it('rejects invalid events', () => {
    expect(() => transition(initialTransitionState(), { type: 'REVERT', at }, true)).toThrow(TransitionError);
    expect(() => transition(initialTransitionState(), { type: 'ACCEPT', at }, false)).toThrow(/No endgame/);
  });

  it('snoozes the prompt until the chosen paragon level', () => {
    const readiness = transitionReadiness(builds, {
      ...emptyProgress(),
      level: 60,
      paragon: 25,
      ownedUniques: ["ramaladni's magnum opus"],
      ownedAspects: ['aspect of earthquakes', 'aspect of ancestral force'],
    });
    const s = transition(initialTransitionState(), { type: 'POSTPONE', at, untilParagon: 40 }, true);
    expect(shouldPromptTransition(initialTransitionState(), readiness, { level: 60, paragon: 25 })).toBe(true);
    expect(shouldPromptTransition(s, readiness, { level: 60, paragon: 25 })).toBe(false);
    expect(shouldPromptTransition(s, readiness, { level: 60, paragon: 40 })).toBe(true);
  });
});

describe('build schema', () => {
  it('validates the bundled samples', () => {
    expect(migrateBuild(SAMPLE_LEVELING).ok).toBe(true);
    expect(migrateBuild(SAMPLE_ENDGAME).ok).toBe(true);
  });

  it('migrates payloads without a schema version and reports errors precisely', () => {
    const { schemaVersion: _v, ...noVersion } = SAMPLE_LEVELING;
    expect(migrateBuild(noVersion).ok).toBe(true);
    const bad = migrateBuild({ ...SAMPLE_LEVELING, classId: 'amazon' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors.join()).toMatch(/classId/);
  });

  it('accepts partial builds and validates build files', () => {
    const partial = migrateBuild({
      id: 'x',
      name: 'Only a name',
      classId: 'rogue',
      role: 'leveling',
      source: { kind: 'manual', importedAt: '2026-10-18' },
      updatedAt: '2026-10-18',
    });
    expect(partial.ok && partial.value.skills).toEqual([]);
    expect(parseBuildFile({ format: 'grimtome.builds', version: 1, leveling: SAMPLE_LEVELING }).ok).toBe(true);
    expect(parseBuildFile({ format: 'other' }).ok).toBe(false);
  });
});
