import { z } from 'zod';
import { BuildSchema } from '@/domain/builds/schema';
import type { ParsedItem } from '@/domain/items/types';
import {
  emptyProgress,
  initialTransitionState,
  type CharacterProgress,
  type TransitionState,
} from '@/domain/progression/transition';
import type { Slot } from '@/domain/shared/ids';
import { parseSettings, type Settings } from './settings';

/**
 * The persisted application state, stored as one versioned JSON document.
 * Each section is validated independently so one corrupted section never wipes
 * the others; invalid sections fall back to defaults.
 */

export const PERSIST_VERSION = 1;
export const PERSIST_KEY = 'state';

export interface ScanRecord {
  id: string;
  at: string;
  source: 'capture' | 'upload' | 'paste' | 'sample';
  item: ParsedItem;
  /** Raw OCR text lines, kept so corrections can be reviewed. */
  lines: string[];
  /** In-memory only unless the user opts in to keeping images. */
  image?: string | null;
}

export interface PersistedState {
  version: number;
  builds: { leveling?: z.infer<typeof BuildSchema>; endgame?: z.infer<typeof BuildSchema> };
  transition: TransitionState;
  progress: CharacterProgress;
  scans: ScanRecord[];
  equipped: Partial<Record<Slot, ParsedItem>>;
  settings: Settings;
  onboardingComplete: boolean;
}

const ProgressSchema = z.object({
  level: z.number().int().min(1).max(70),
  paragon: z.number().int().min(0).max(300),
  ownedUniques: z.array(z.string()),
  ownedAspects: z.array(z.string()),
  skillSteps: z.object({ leveling: z.number().int().min(0), endgame: z.number().int().min(0) }),
  paragonCompleted: z.object({ leveling: z.array(z.string()), endgame: z.array(z.string()) }),
  customMet: z.array(z.string()),
});

const TransitionSchema = z.object({
  phase: z.enum(['leveling', 'endgame']),
  postponedUntil: z.object({ level: z.number().optional(), paragon: z.number().optional() }).nullable(),
  history: z.array(
    z.object({
      at: z.string(),
      kind: z.enum(['accept', 'revert', 'postpone']),
      from: z.enum(['leveling', 'endgame']),
      to: z.enum(['leveling', 'endgame']),
    }),
  ),
});

const ItemSchema = z
  .object({
    name: z.string().nullable(),
    rarity: z.string().nullable(),
    slot: z.string().nullable(),
    affixes: z.array(z.object({ raw: z.string(), key: z.string().nullable() }).loose()),
    confidence: z.object({
      level: z.enum(['high', 'medium', 'low']),
      score: z.number(),
      issues: z.array(z.string()),
    }),
  })
  .loose();

const ScanSchema = z.object({
  id: z.string(),
  at: z.string(),
  source: z.enum(['capture', 'upload', 'paste', 'sample']),
  item: ItemSchema,
  lines: z.array(z.string()),
  image: z.string().nullable().optional(),
});

function section<T>(schema: z.ZodType<T>, raw: unknown, fallback: () => T): T {
  const r = schema.safeParse(raw);
  return r.success ? r.data : fallback();
}

export function defaultPersisted(): PersistedState {
  return {
    version: PERSIST_VERSION,
    builds: {},
    transition: initialTransitionState(),
    progress: emptyProgress(),
    scans: [],
    equipped: {},
    settings: parseSettings({}),
    onboardingComplete: false,
  };
}

export function deserialize(text: string | null): PersistedState {
  if (!text) return defaultPersisted();
  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return defaultPersisted();
  }
  const base = defaultPersisted();
  const builds = (raw.builds ?? {}) as Record<string, unknown>;
  const lev = BuildSchema.safeParse(builds.leveling);
  const end = BuildSchema.safeParse(builds.endgame);
  const scans = Array.isArray(raw.scans) ? raw.scans.filter((s) => ScanSchema.safeParse(s).success) : [];
  const equippedRaw = (raw.equipped ?? {}) as Record<string, unknown>;
  const equipped: PersistedState['equipped'] = {};
  for (const [slot, item] of Object.entries(equippedRaw)) {
    if (ItemSchema.safeParse(item).success) equipped[slot as Slot] = item as ParsedItem;
  }
  return {
    version: PERSIST_VERSION,
    builds: { ...(lev.success ? { leveling: lev.data } : {}), ...(end.success ? { endgame: end.data } : {}) },
    transition: section(TransitionSchema, raw.transition, () => base.transition),
    progress: section(ProgressSchema, raw.progress, () => base.progress),
    scans: scans as ScanRecord[],
    equipped,
    settings: parseSettings(raw.settings),
    onboardingComplete: raw.onboardingComplete === true,
  };
}

export function serialize(state: PersistedState): string {
  const keepImages = state.settings.privacy.keepScanImages;
  const scans = state.scans
    .slice(0, state.settings.privacy.scanHistoryLimit)
    .map((s) => (keepImages ? s : { ...s, image: null }));
  return JSON.stringify({ ...state, version: PERSIST_VERSION, scans });
}
