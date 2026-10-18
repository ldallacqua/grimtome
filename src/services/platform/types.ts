import type { OcrResult } from '@/domain/items/types';
import type { AssetCacheStatus } from '../assets/types';

/**
 * Everything the UI needs from the host. Two implementations exist:
 * `tauri.ts` (the Windows desktop app) and `browser.ts` (dev server, tests and
 * visual regression, with capture disabled and OCR backed by recorded fixtures).
 */

export interface Installation {
  root: string;
  dataDir: string;
  source: 'steam' | 'battleNet' | 'manual';
  layout: 'steamStatic' | 'casc' | 'unknown';
  build: string | null;
}

export interface ImportProgress {
  stage: string;
  done: number;
  total: number;
}

export interface ImportSummary {
  assets: number;
  failures: string[];
  gameBuild: string | null;
  elapsedMs: number;
}

export interface CaptureSettings {
  mode: 'smart' | 'cursor' | 'region';
  /** Region in physical screen pixels (for `region` mode). */
  region?: { x: number; y: number; width: number; height: number } | null;
  /** Box around the cursor (for `cursor` mode), in physical pixels. */
  cursorBox?: { width: number; height: number };
  language?: string;
  /** Wait this long (app minimized) before capturing, for in-app scans. */
  delayMs?: number;
}

export interface ScanPayload {
  ocr: OcrResult;
  /** PNG data URL of the captured tooltip area (kept in memory only). */
  image: string | null;
  /** OCR of a second, "Equipped" tooltip when the game shows a comparison. */
  equipped: OcrResult | null;
  capturedAt: string;
  captureMs: number;
}

export interface HotkeyMap {
  scan: string;
  toggleOverlay: string;
  clickThrough: string;
}

export type PlatformEvent =
  | { type: 'scan'; payload: ScanPayload }
  | { type: 'scan-error'; message: string }
  | { type: 'import-progress'; payload: ImportProgress }
  | { type: 'overlay-click-through'; enabled: boolean }
  /** Desktop: the main window is closing; flush state, then call `windows.exit()`. */
  | { type: 'close-requested' }
  | { type: 'state-changed' };

export interface OverlayMessage {
  kind: 'evaluation';
  verdict: string;
  headline: string;
  summary: string;
  itemName: string | null;
  rarity: string | null;
  slot: string | null;
  reasons: { tone: string; text: string; role?: string }[];
  confidence: string;
  activeBuild: string | null;
  iconUrl: string | null;
  at: string;
}

export interface PlatformApi {
  kind: 'tauri' | 'browser';
  storage: {
    read(key: string): Promise<string | null>;
    write(key: string, value: string): Promise<void>;
    clearAll(): Promise<void>;
    location(): Promise<string>;
  };
  assets: {
    status(): Promise<AssetCacheStatus>;
    urlFor(root: string, file: string): string;
    detectInstallations(): Promise<Installation[]>;
    inspect(path: string): Promise<Installation | null>;
    import(path: string | null, locale: string): Promise<ImportSummary>;
    clear(): Promise<void>;
    reveal(): Promise<void>;
  };
  capture: {
    available: boolean;
    /** Keeps the host's copy of the capture settings current (used by the global hotkey). */
    configure(settings: CaptureSettings): Promise<void>;
    scan(settings: CaptureSettings): Promise<ScanPayload>;
  };
  ocr: {
    available: boolean;
    engineName: string;
    recognize(image: Uint8Array): Promise<OcrResult>;
    languages(): Promise<string[]>;
  };
  windows: {
    minimize(): Promise<void>;
    toggleMaximize(): Promise<void>;
    close(): Promise<void>;
    showOverlay(visible: boolean): Promise<void>;
    setOverlayClickThrough(enabled: boolean): Promise<void>;
    sendToOverlay(message: OverlayMessage): Promise<void>;
    /** Overlay window only: listen for verdicts sent by the main window. */
    onOverlayMessage(handler: (m: OverlayMessage) => void): () => void;
    /** Resizes the current window to fit its content (logical pixels). */
    fitCurrent(width: number, height: number): Promise<void>;
    hideCurrent(): Promise<void>;
    /** Quits the app (desktop) after the UI has saved its state. */
    exit(): Promise<void>;
  };
  hotkeys: {
    supported: boolean;
    apply(map: HotkeyMap): Promise<{ failed: string[] }>;
  };
  dialogs: {
    pickFolder(title: string): Promise<string | null>;
  };
  openExternal(url: string): Promise<void>;
  subscribe(handler: (e: PlatformEvent) => void): () => void;
}
