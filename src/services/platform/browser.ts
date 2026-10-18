import type { AssetCacheStatus, AssetManifest, GameCatalog } from '../assets/types';
import { loadSamples } from '../samples';
import type { PlatformApi, PlatformEvent } from './types';

/**
 * Browser host used by the dev server, Playwright and visual tests.
 *
 * - Persistence: localStorage.
 * - Game assets: only in `vite dev`, through the dev-only `/__game-assets/` route.
 * - OCR: recorded results for the bundled sample tooltips (matched by SHA-256);
 *   real OCR requires the desktop app.
 */

const PREFIX = 'grimtome:';
const listeners = new Set<(e: PlatformEvent) => void>();

async function sha256(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

const unsupported = (what: string) => () =>
  Promise.reject(new Error(`${what} is only available in the Grimtome desktop app.`));

export function createBrowserPlatform(): PlatformApi {
  return {
    kind: 'browser',
    storage: {
      async read(key) {
        try {
          return localStorage.getItem(PREFIX + key);
        } catch {
          return null;
        }
      },
      async write(key, value) {
        try {
          localStorage.setItem(PREFIX + key, value);
        } catch {
          /* storage unavailable (private mode) — keep running in memory */
        }
      },
      async clearAll() {
        try {
          Object.keys(localStorage)
            .filter((k) => k.startsWith(PREFIX))
            .forEach((k) => localStorage.removeItem(k));
        } catch {
          /* ignore */
        }
      },
      async location() {
        return 'Browser local storage';
      },
    },
    assets: {
      async status(): Promise<AssetCacheStatus> {
        if (!import.meta.env.DEV) return { root: null, manifest: null, catalog: null, userManifest: null };
        const manifest = await fetchJson<AssetManifest>('/__game-assets/manifest.json');
        const catalog = manifest ? await fetchJson<GameCatalog>('/__game-assets/catalog.json') : null;
        return { root: manifest ? '/__game-assets' : null, manifest, catalog, userManifest: null };
      },
      urlFor: (root, file) => `${root}/${file}`,
      detectInstallations: async () => [],
      inspect: async () => null,
      import: unsupported('Importing game assets'),
      clear: async () => undefined,
      reveal: async () => undefined,
    },
    capture: {
      configure: async () => {},
      available: false,
      scan: unsupported('Screen capture'),
    },
    ocr: {
      available: true,
      engineName: 'Sample tooltips (browser preview)',
      async recognize(image) {
        const hash = await sha256(image);
        const hit = (await loadSamples()).find((s) => s.sha256 === hash);
        if (!hit) {
          throw new Error(
            'The browser preview can only read Grimtome’s sample tooltips. Use the desktop app for real screenshots, or paste the tooltip text instead.',
          );
        }
        return { ...hit.ocr, engine: 'fixture' };
      },
      languages: async () => ['en-US'],
    },
    windows: {
      minimize: async () => undefined,
      toggleMaximize: async () => undefined,
      close: async () => undefined,
      showOverlay: async () => undefined,
      setOverlayClickThrough: async () => undefined,
      sendToOverlay: async () => undefined,
      onOverlayMessage: () => () => undefined,
      fitCurrent: async () => undefined,
      exit: async () => {},
      hideCurrent: async () => undefined,
    },
    hotkeys: {
      supported: false,
      apply: async () => ({ failed: [] }),
    },
    dialogs: {
      pickFolder: async () => null,
    },
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener,noreferrer');
    },
    subscribe(handler) {
      listeners.add(handler);
      return () => listeners.delete(handler);
    },
  };
}

/** Test hook: lets Playwright inject platform events in the browser preview. */
export function emitBrowserEvent(e: PlatformEvent) {
  listeners.forEach((l) => l(e));
}
