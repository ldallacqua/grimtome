import type { Build, NamedRef } from '../builds/schema';
import type { ParsedItem } from '../items/types';
import type { BuildRole, Slot } from '../shared/ids';

export const VERDICTS = ['upgrade', 'keep', 'stash', 'salvage', 'review'] as const;
export type Verdict = (typeof VERDICTS)[number];

export type FitTier = 'strong' | 'partial' | 'weak' | 'none' | 'unknown';

export interface MatchedAffix {
  key: string;
  label: string;
  weight: 1 | 2 | 3;
  greater: boolean;
  tempered: boolean;
}

export interface BuildFit {
  role: BuildRole;
  buildName: string;
  /** The build has gear guidance for this item's slot (or global priorities). */
  hasGuidance: boolean;
  matched: MatchedAffix[];
  /** Essential (weight 3) priorities for the slot that this item does not have. */
  missingEssentials: string[];
  /** 0–1 share of the slot's top priorities covered by this item. */
  ratio: number;
  tier: FitTier;
  unique: (NamedRef & { required: boolean }) | null;
  aspect: (NamedRef & { confidence: number }) | null;
}

export type ReasonTone = 'positive' | 'negative' | 'neutral' | 'warning';

export interface Reason {
  tone: ReasonTone;
  text: string;
  role?: BuildRole;
}

export interface Evaluation {
  verdict: Verdict;
  /** Short headline, e.g. “Stash for your endgame build”. */
  headline: string;
  /** One or two sentences a player can read at a glance. */
  summary: string;
  reasons: Reason[];
  fits: Partial<Record<BuildRole, BuildFit>>;
  /** How much the verdict can be trusted, combining OCR and data completeness. */
  confidence: 'high' | 'medium' | 'low';
  /** Data that would change or strengthen the verdict. */
  caveats: string[];
}

export interface CatalogHints {
  aspects?: readonly { id?: string; name: string; description?: string | null }[];
  uniques?: readonly { id?: string; name: string; slot?: string }[];
}

export interface EvaluationContext {
  builds: Partial<Record<BuildRole, Build>>;
  activeRole: BuildRole;
  /** Items the player marked as currently equipped, per slot. */
  equipped?: Partial<Record<Slot, ParsedItem>>;
  catalog?: CatalogHints;
}
