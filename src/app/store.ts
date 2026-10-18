import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';
import { SAMPLE_BUILDS } from '@/domain/builds/samples';
import type { Build } from '@/domain/builds/schema';
import { defaultAffixDictionary, type AffixDictionary } from '@/domain/items/affixes';
import { markVerified } from '@/domain/items/parser';
import type { ParsedItem } from '@/domain/items/types';
import { transition, transitionReadiness, type CharacterProgress } from '@/domain/progression/transition';
import { evaluateItem, type StructuredEvaluation } from '@/domain/recommendations/engine';
import type { CatalogHints } from '@/domain/recommendations/types';
import { MAX_CHARACTER_LEVEL, MAX_PARAGON_LEVEL, type BuildRole, type Slot } from '@/domain/shared/ids';
import { AssetResolver } from '@/services/assets/resolver';
import type { AssetCacheStatus, GameCatalog } from '@/services/assets/types';
import { platform } from '@/services/platform';
import {
  defaultPersisted,
  deserialize,
  PERSIST_KEY,
  serialize,
  type PersistedState,
  type ScanRecord,
} from './persistence';
import type { Settings } from './settings';

export type Route = 'dashboard' | 'advisor' | 'skills' | 'paragon' | 'builds' | 'settings';

export interface Toast {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'danger';
  title: string;
  body?: string;
}

interface RuntimeState {
  ready: boolean;
  route: Route;
  selectedScanId: string | null;
  assetStatus: AssetCacheStatus | null;
  resolver: AssetResolver;
  catalog: GameCatalog | null;
  dictionary: AffixDictionary;
  toasts: Toast[];
  scanning: boolean;
}

interface Actions {
  hydrate(): Promise<void>;
  navigate(route: Route): void;
  selectScan(id: string | null): void;
  toast(t: Omit<Toast, 'id'>): void;
  dismissToast(id: string): void;
  setScanning(v: boolean): void;

  setAssetStatus(status: AssetCacheStatus | null): void;

  setBuild(role: BuildRole, build: Build): void;
  removeBuild(role: BuildRole): void;
  loadSampleBuilds(): void;

  setLevel(level: number): void;
  setParagon(paragon: number): void;
  setSkillSteps(role: BuildRole, steps: number): void;
  toggleParagonStep(role: BuildRole, stepId: string): void;
  toggleOwned(kind: 'unique' | 'aspect', name: string, owned?: boolean): void;
  toggleCustomCriterion(label: string): void;

  acceptTransition(): void;
  postponeTransition(untilParagon: number): void;
  revertTransition(): void;

  addScan(scan: Omit<ScanRecord, 'id' | 'at'> & { at?: string }): ScanRecord;
  updateScanItem(id: string, item: ParsedItem, verified?: boolean): void;
  removeScan(id: string): void;
  clearScans(): void;
  setEquipped(slot: Slot, item: ParsedItem | null): void;

  updateSettings(patch: (s: Settings) => Settings): void;
  completeOnboarding(): void;
  resetAll(): Promise<void>;
}

export type AppState = PersistedState & RuntimeState & Actions;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const now = () => new Date().toISOString();

function dictionaryFor(catalog: GameCatalog | null): AffixDictionary {
  return catalog?.affixTemplates?.length
    ? defaultAffixDictionary.withTemplates(catalog.affixTemplates)
    : defaultAffixDictionary;
}

function resolverFor(status: AssetCacheStatus | null, useGame: boolean): AssetResolver {
  if (!status?.root) return AssetResolver.empty();
  const root = status.root;
  const game =
    useGame && status.manifest
      ? { manifest: status.manifest, urlFor: (f: string) => platform.assets.urlFor(root, f) }
      : null;
  const userRoot = root.replace(/[\\/]current$/, '');
  const user = status.userManifest
    ? {
        manifest: status.userManifest,
        urlFor: (f: string) =>
          platform.assets.urlFor(`${userRoot}${root.includes('\\') ? '\\' : '/'}user`, f),
      }
    : null;
  return new AssetResolver(game, user);
}

export const useApp = create<AppState>()((set, get) => ({
  ...defaultPersisted(),
  ready: false,
  route: 'dashboard',
  selectedScanId: null,
  assetStatus: null,
  resolver: AssetResolver.empty(),
  catalog: null,
  dictionary: defaultAffixDictionary,
  toasts: [],
  scanning: false,

  async hydrate() {
    const text = await platform.storage.read(PERSIST_KEY);
    const data = deserialize(text);
    set({ ...data, ready: true, selectedScanId: data.scans[0]?.id ?? null });
  },

  navigate: (route) => set({ route }),
  selectScan: (id) => set({ selectedScanId: id }),
  toast(t) {
    const id = newId();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    setTimeout(() => get().dismissToast(id), t.tone === 'danger' ? 9000 : 5000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setScanning: (scanning) => set({ scanning }),

  setAssetStatus(status) {
    const useGame = get().settings.assets.useGameAssets;
    const catalog = useGame ? (status?.catalog ?? null) : null;
    set({
      assetStatus: status,
      resolver: resolverFor(status, useGame),
      catalog,
      dictionary: dictionaryFor(status?.catalog ?? null),
    });
  },

  setBuild: (role, build) => set((s) => ({ builds: { ...s.builds, [role]: { ...build, role } } })),
  removeBuild: (role) =>
    set((s) => {
      const builds = { ...s.builds };
      delete builds[role];
      const t =
        role === 'endgame' && s.transition.phase === 'endgame'
          ? { ...s.transition, phase: 'leveling' as const }
          : s.transition;
      return { builds, transition: t };
    }),
  loadSampleBuilds: () =>
    set({ builds: { leveling: SAMPLE_BUILDS.leveling, endgame: SAMPLE_BUILDS.endgame } }),

  setLevel: (level) =>
    set((s) => ({
      progress: { ...s.progress, level: Math.max(1, Math.min(MAX_CHARACTER_LEVEL, Math.round(level))) },
    })),
  setParagon: (paragon) =>
    set((s) => ({
      progress: { ...s.progress, paragon: Math.max(0, Math.min(MAX_PARAGON_LEVEL, Math.round(paragon))) },
    })),
  setSkillSteps: (role, steps) =>
    set((s) => {
      const max = s.builds[role]?.skills.length ?? 0;
      return {
        progress: {
          ...s.progress,
          skillSteps: { ...s.progress.skillSteps, [role]: Math.max(0, Math.min(max, steps)) },
        },
      };
    }),
  toggleParagonStep: (role, stepId) =>
    set((s) => {
      const cur = s.progress.paragonCompleted[role];
      const next = cur.includes(stepId) ? cur.filter((x) => x !== stepId) : [...cur, stepId];
      return {
        progress: { ...s.progress, paragonCompleted: { ...s.progress.paragonCompleted, [role]: next } },
      };
    }),
  toggleOwned: (kind, name, owned) =>
    set((s) => {
      const key: keyof CharacterProgress = kind === 'unique' ? 'ownedUniques' : 'ownedAspects';
      const lower = name.toLowerCase();
      const list = s.progress[key];
      const has = list.includes(lower);
      const want = owned ?? !has;
      const next = want ? (has ? list : [...list, lower]) : list.filter((x) => x !== lower);
      return { progress: { ...s.progress, [key]: next } };
    }),
  toggleCustomCriterion: (label) =>
    set((s) => {
      const cur = s.progress.customMet;
      return {
        progress: {
          ...s.progress,
          customMet: cur.includes(label) ? cur.filter((c) => c !== label) : [...cur, label],
        },
      };
    }),

  acceptTransition() {
    const s = get();
    set({ transition: transition(s.transition, { type: 'ACCEPT', at: now() }, !!s.builds.endgame) });
  },
  postponeTransition(untilParagon) {
    const s = get();
    set({
      transition: transition(s.transition, { type: 'POSTPONE', at: now(), untilParagon }, !!s.builds.endgame),
    });
  },
  revertTransition() {
    const s = get();
    set({ transition: transition(s.transition, { type: 'REVERT', at: now() }, !!s.builds.endgame) });
  },

  addScan(scan) {
    const record: ScanRecord = { ...scan, id: newId(), at: scan.at ?? now() };
    set((s) => ({
      scans: [record, ...s.scans].slice(0, Math.max(1, s.settings.privacy.scanHistoryLimit)),
      selectedScanId: record.id,
    }));
    return record;
  },
  updateScanItem: (id, item, verified = true) =>
    set((s) => ({
      scans: s.scans.map((sc) => (sc.id === id ? { ...sc, item: verified ? markVerified(item) : item } : sc)),
    })),
  removeScan: (id) =>
    set((s) => {
      const scans = s.scans.filter((x) => x.id !== id);
      return { scans, selectedScanId: s.selectedScanId === id ? (scans[0]?.id ?? null) : s.selectedScanId };
    }),
  clearScans: () => set({ scans: [], selectedScanId: null }),
  setEquipped: (slot, item) =>
    set((s) => {
      const equipped = { ...s.equipped };
      if (item) equipped[slot] = item;
      else delete equipped[slot];
      return { equipped };
    }),

  updateSettings(patch) {
    const before = get().settings;
    const settings = patch(before);
    set({ settings });
    if (settings.assets.useGameAssets !== before.assets.useGameAssets)
      get().setAssetStatus(get().assetStatus);
  },
  completeOnboarding: () => set({ onboardingComplete: true }),
  async resetAll() {
    await platform.storage.clearAll();
    set({ ...defaultPersisted(), selectedScanId: null, route: 'dashboard' });
  },
}));

/** Persist relevant slices whenever they change (debounced, flushed on exit). */
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function writeNow(): Promise<void> {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = null;
  const {
    builds,
    transition: t,
    progress,
    scans,
    equipped,
    settings,
    onboardingComplete,
    version,
  } = useApp.getState();
  return platform.storage.write(
    PERSIST_KEY,
    serialize({ builds, transition: t, progress, scans, equipped, settings, onboardingComplete, version }),
  );
}

export function startPersistence() {
  // A pending write must not be lost when the page goes away (reload, window
  // close, app shutdown). Browser storage writes synchronously here; the desktop
  // host additionally asks the UI to flush before it exits.
  const flushPending = () => {
    if (persistTimer) void writeNow();
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') flushPending();
  };
  window.addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribe = useApp.subscribe((s, prev) => {
    if (!s.ready) return;
    const changed =
      s.builds !== prev.builds ||
      s.transition !== prev.transition ||
      s.progress !== prev.progress ||
      s.scans !== prev.scans ||
      s.equipped !== prev.equipped ||
      s.settings !== prev.settings ||
      s.onboardingComplete !== prev.onboardingComplete;
    if (!changed) return;
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => void writeNow(), 250);
  });
  return () => {
    unsubscribe();
    window.removeEventListener('pagehide', flushPending);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

/** Flush pending writes immediately (before resets, on app exit, in tests). */
export async function flushPersistence() {
  await writeNow();
}

// ---- Selectors -------------------------------------------------------------

export const selectActiveRole = (s: AppState): BuildRole => s.transition.phase;
export const selectActiveBuild = (s: AppState): Build | undefined => s.builds[s.transition.phase];

export function catalogHints(catalog: GameCatalog | null): CatalogHints | undefined {
  if (!catalog) return undefined;
  return { aspects: catalog.aspects, uniques: catalog.uniques };
}

export function evaluate(
  s: Pick<AppState, 'builds' | 'transition' | 'equipped' | 'catalog'>,
  item: ParsedItem,
): StructuredEvaluation {
  const hints = catalogHints(s.catalog);
  return evaluateItem(item, {
    builds: s.builds,
    activeRole: s.transition.phase,
    equipped: s.equipped,
    ...(hints ? { catalog: hints } : {}),
  });
}

export function readiness(s: Pick<AppState, 'builds' | 'progress'>) {
  return transitionReadiness(s.builds, s.progress);
}

/** The minimal slice item evaluation depends on (stable across unrelated updates). */
export const useEvalState = () =>
  useApp(
    useShallow((s) => ({
      builds: s.builds,
      transition: s.transition,
      equipped: s.equipped,
      catalog: s.catalog,
    })),
  );
