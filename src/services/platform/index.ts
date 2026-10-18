import { createBrowserPlatform } from './browser';
import { createTauriPlatform } from './tauri';
import type { PlatformApi } from './types';

export type * from './types';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** The single host abstraction used by the whole UI. */
export const platform: PlatformApi = isTauri ? createTauriPlatform() : createBrowserPlatform();

/** Which window this bundle is rendering (`main` or `overlay`). */
export function currentWindowKind(): 'main' | 'overlay' {
  return new URLSearchParams(window.location.search).get('window') === 'overlay' ? 'overlay' : 'main';
}
