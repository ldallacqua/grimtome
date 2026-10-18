import { z } from 'zod';
import { BUILD_ROLES, CLASS_IDS, MAX_CHARACTER_LEVEL, MAX_PARAGON_LEVEL, SLOTS } from '../shared/ids';

/**
 * Versioned, source-agnostic build model. Importers (sample, JSON, paste, manual)
 * all normalize into this shape; nothing downstream knows where a build came from.
 *
 * Partial builds are valid: every list may be empty and unknown details stay absent
 * instead of being invented.
 */

export const BUILD_SCHEMA_VERSION = 1 as const;

/** A reference to a game entity by display name, with an optional catalog id. */
export const NamedRefSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
});

/** 3 = essential, 2 = important, 1 = nice to have. */
export const AffixWeightSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const AffixPrioritySchema = z.object({
  /** Normalized affix key, see `domain/items/affixes.ts#affixKey`. */
  key: z.string().min(1),
  label: z.string().min(1),
  weight: AffixWeightSchema,
  /** A Greater Affix roll on this stat is especially valuable. */
  greater: z.boolean().optional(),
});

export const GearPlanSchema = z.object({
  slot: z.enum(SLOTS),
  unique: NamedRefSchema.extend({ required: z.boolean().default(false) }).optional(),
  aspect: NamedRefSchema.optional(),
  affixes: z.array(AffixPrioritySchema).default([]),
  tempers: z.array(AffixPrioritySchema).default([]),
  masterwork: z.array(AffixPrioritySchema).default([]),
  notes: z.string().optional(),
});

export const SkillStepSchema = z.object({
  skill: NamedRefSchema,
  kind: z.enum(['rank', 'upgrade']).default('rank'),
  /** Skill rank reached after this point (for `rank` steps). */
  rank: z.number().int().min(1).max(20).optional(),
  maxRank: z.number().int().min(1).max(20).optional(),
  /** Upgrade / enhancement chosen at this point (for `upgrade` steps). */
  upgrade: z.string().min(1).optional(),
  note: z.string().optional(),
});

export const ParagonStepSchema = z.object({
  id: z.string().min(1),
  board: NamedRefSchema,
  glyph: NamedRefSchema.optional(),
  /** Free-text routing guidance copied from the source (never invented). */
  focus: z.string().optional(),
  targetParagon: z.number().int().min(0).max(MAX_PARAGON_LEVEL).optional(),
});

/** Conditions for moving *into* this build (meaningful on the endgame build). */
export const TransitionCriteriaSchema = z.object({
  minLevel: z.number().int().min(1).max(MAX_CHARACTER_LEVEL).optional(),
  minParagon: z.number().int().min(0).max(MAX_PARAGON_LEVEL).optional(),
  requiredUniques: z.array(NamedRefSchema).default([]),
  requiredAspects: z.array(NamedRefSchema).default([]),
  /** Number of leveling skill steps that should be allocated first. */
  minSkillSteps: z.number().int().min(0).optional(),
  custom: z.array(z.string().min(1)).default([]),
});

export const BuildSourceSchema = z.object({
  kind: z.enum(['sample', 'json', 'manual', 'paste', 'maxroll-link']),
  url: z.string().url().optional(),
  attribution: z.string().optional(),
  importedAt: z.string().min(1),
});

export const BuildSchema = z.object({
  schemaVersion: z.literal(BUILD_SCHEMA_VERSION),
  id: z.string().min(1),
  name: z.string().min(1),
  classId: z.enum(CLASS_IDS),
  role: z.enum(BUILD_ROLES),
  source: BuildSourceSchema,
  season: z.string().optional(),
  patch: z.string().optional(),
  summary: z.string().optional(),
  skills: z.array(SkillStepSchema).default([]),
  gear: z.array(GearPlanSchema).default([]),
  /** Affixes valued on any slot (e.g. a main stat). */
  globalAffixes: z.array(AffixPrioritySchema).default([]),
  paragon: z.array(ParagonStepSchema).default([]),
  transition: TransitionCriteriaSchema.optional(),
  updatedAt: z.string().min(1),
});

export type NamedRef = z.infer<typeof NamedRefSchema>;
export type AffixWeight = z.infer<typeof AffixWeightSchema>;
export type AffixPriority = z.infer<typeof AffixPrioritySchema>;
export type GearPlan = z.infer<typeof GearPlanSchema>;
export type SkillStep = z.infer<typeof SkillStepSchema>;
export type ParagonStep = z.infer<typeof ParagonStepSchema>;
export type TransitionCriteria = z.infer<typeof TransitionCriteriaSchema>;
export type BuildSource = z.infer<typeof BuildSourceSchema>;
export type Build = z.infer<typeof BuildSchema>;
export type BuildInput = z.input<typeof BuildSchema>;

/** File format used for JSON import/export. */
export const BuildFileSchema = z.object({
  format: z.literal('grimtome.builds'),
  version: z.literal(1),
  leveling: BuildSchema.optional(),
  endgame: BuildSchema.optional(),
});
export type BuildFile = z.infer<typeof BuildFileSchema>;

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

/** Upgrades older payloads to the current schema, then validates. */
export function migrateBuild(raw: unknown): ValidationResult<Build> {
  const candidate =
    raw && typeof raw === 'object' && !('schemaVersion' in raw)
      ? { ...(raw as object), schemaVersion: BUILD_SCHEMA_VERSION }
      : raw;
  const parsed = BuildSchema.safeParse(candidate);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: formatIssues(parsed.error) };
}

export function parseBuildFile(raw: unknown): ValidationResult<BuildFile> {
  const parsed = BuildFileSchema.safeParse(raw);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, errors: formatIssues(parsed.error) };
}
