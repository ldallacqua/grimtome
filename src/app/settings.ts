import { z } from 'zod';

/** User settings — versioned and validated; unknown or invalid values fall back to defaults. */
export const SettingsSchema = z.object({
  language: z.enum(['en', 'pt-BR']).default('en'),
  hotkeys: z
    .object({
      scan: z.string().default('CommandOrControl+Shift+D'),
      toggleOverlay: z.string().default('CommandOrControl+Shift+O'),
      clickThrough: z.string().default('CommandOrControl+Shift+X'),
    })
    .default({ scan: 'CommandOrControl+Shift+D', toggleOverlay: 'CommandOrControl+Shift+O', clickThrough: 'CommandOrControl+Shift+X' }),
  capture: z
    .object({
      mode: z.enum(['smart', 'cursor', 'region']).default('smart'),
      region: z.object({ x: z.number(), y: z.number(), width: z.number().positive(), height: z.number().positive() }).nullable().default(null),
      cursorBox: z.object({ width: z.number().min(200).max(3000), height: z.number().min(200).max(3000) }).default({ width: 1000, height: 1200 }),
      language: z.string().default('en-US'),
    })
    .default({ mode: 'smart', region: null, cursorBox: { width: 1000, height: 1200 }, language: 'en-US' }),
  overlay: z
    .object({
      enabled: z.boolean().default(true),
      opacity: z.number().min(0.4).max(1).default(0.96),
      mode: z.enum(['compact', 'expanded']).default('compact'),
      clickThrough: z.boolean().default(false),
      showOnScan: z.boolean().default(true),
      autoHideSeconds: z.number().int().min(0).max(120).default(0),
    })
    .default({ enabled: true, opacity: 0.96, mode: 'compact', clickThrough: false, showOnScan: true, autoHideSeconds: 0 }),
  assets: z
    .object({
      useGameAssets: z.boolean().default(true),
      consentAcceptedAt: z.string().nullable().default(null),
      gamePath: z.string().nullable().default(null),
    })
    .default({ useGameAssets: true, consentAcceptedAt: null, gamePath: null }),
  appearance: z
    .object({
      reduceMotion: z.boolean().default(false),
      showGameArt: z.boolean().default(true),
    })
    .default({ reduceMotion: false, showGameArt: true }),
  privacy: z
    .object({
      keepScanImages: z.boolean().default(false),
      scanHistoryLimit: z.number().int().min(0).max(200).default(40),
    })
    .default({ keepScanImages: false, scanHistoryLimit: 40 }),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const defaultSettings = (): Settings => SettingsSchema.parse({});

export function parseSettings(raw: unknown): Settings {
  const r = SettingsSchema.safeParse(raw ?? {});
  return r.success ? r.data : defaultSettings();
}

/** Display form of an accelerator, e.g. `CommandOrControl+Shift+D` → ["Ctrl", "Shift", "D"]. */
export function hotkeyParts(accel: string): string[] {
  return accel
    .split('+')
    .map((p) => (p === 'CommandOrControl' || p === 'CmdOrCtrl' || p === 'Control' ? 'Ctrl' : p))
    .filter(Boolean);
}
