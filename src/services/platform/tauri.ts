import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { emitTo, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { OcrResult } from '@/domain/items/types';
import type { AssetCacheStatus, AssetManifest, GameCatalog } from '../assets/types';
import type {
  CaptureSettings,
  HotkeyMap,
  ImportSummary,
  Installation,
  OverlayMessage,
  PlatformApi,
  PlatformEvent,
  ScanPayload,
} from './types';

/** Desktop host: thin wrappers around the Rust commands in `src-tauri/src/commands`. */

interface RawAssetStatus {
  root: string | null;
  manifest: string | null;
  catalog: string | null;
  userManifest: string | null;
  error: string | null;
}

function parseJson<T>(text: string | null): T | null {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function createTauriPlatform(): PlatformApi {
  const handlers = new Set<(e: PlatformEvent) => void>();
  const emit = (e: PlatformEvent) => handlers.forEach((h) => h(e));
  void listen<ScanPayload>('scan://result', (e) => emit({ type: 'scan', payload: e.payload }));
  void listen<string>('scan://error', (e) => emit({ type: 'scan-error', message: e.payload }));
  void listen<{ stage: string; done: number; total: number }>('assets://progress', (e) =>
    emit({ type: 'import-progress', payload: e.payload }),
  );
  void listen<boolean>('overlay://click-through', (e) =>
    emit({ type: 'overlay-click-through', enabled: e.payload }),
  );
  void listen('app://close-requested', () => emit({ type: 'close-requested' }));

  return {
    kind: 'tauri',
    storage: {
      read: (key) => invoke<string | null>('storage_read', { key }),
      write: (key, value) => invoke('storage_write', { key, value }),
      clearAll: () => invoke('storage_clear'),
      location: () => invoke<string>('storage_location'),
    },
    assets: {
      async status(): Promise<AssetCacheStatus> {
        const raw = await invoke<RawAssetStatus>('assets_status');
        return {
          root: raw.root,
          manifest: parseJson<AssetManifest>(raw.manifest),
          catalog: parseJson<GameCatalog>(raw.catalog),
          userManifest: parseJson<AssetManifest>(raw.userManifest),
          ...(raw.error ? { error: raw.error } : {}),
        };
      },
      urlFor: (root, file) => convertFileSrc(`${root}\\${file.replace(/\//g, '\\')}`),
      detectInstallations: () => invoke<Installation[]>('assets_detect'),
      inspect: (path) => invoke<Installation | null>('assets_inspect', { path }),
      import: (path, locale) => invoke<ImportSummary>('assets_import', { path, locale }),
      clear: () => invoke('assets_clear'),
      reveal: () => invoke('assets_reveal'),
    },
    capture: {
      available: true,
      configure: (settings: CaptureSettings) => invoke('capture_configure', { settings }),
      scan: (settings: CaptureSettings) => invoke<ScanPayload>('scan_capture', { settings }),
    },
    ocr: {
      available: true,
      engineName: 'Windows OCR',
      recognize: (image) => invoke<OcrResult>('ocr_image', { imageBase64: toBase64(image) }),
      languages: () => invoke<string[]>('ocr_languages'),
    },
    windows: {
      minimize: () => getCurrentWindow().minimize(),
      toggleMaximize: () => getCurrentWindow().toggleMaximize(),
      close: () => getCurrentWindow().close(),
      showOverlay: (visible) => invoke('overlay_show', { visible }),
      setOverlayClickThrough: (enabled) => invoke('overlay_click_through', { enabled }),
      sendToOverlay: (message) => emitTo('overlay', 'overlay://message', message),
      onOverlayMessage(handler: (m: OverlayMessage) => void) {
        const un = listen<OverlayMessage>('overlay://message', (e) => handler(e.payload));
        return () => void un.then((f) => f());
      },
      fitCurrent: (width, height) =>
        getCurrentWindow().setSize(new LogicalSize(Math.ceil(width), Math.ceil(height))),
      hideCurrent: () => invoke('overlay_show', { visible: false }),
      exit: () => invoke('app_exit'),
    },
    hotkeys: {
      supported: true,
      apply: (map: HotkeyMap) => invoke<{ failed: string[] }>('hotkeys_apply', { map }),
    },
    dialogs: {
      async pickFolder(title) {
        const r = await openDialog({ directory: true, multiple: false, title });
        return typeof r === 'string' ? r : null;
      },
    },
    openExternal: (url) => openUrl(url),
    subscribe(handler) {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
  };
}
