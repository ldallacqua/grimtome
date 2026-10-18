import { platform } from '@/services/platform';
import { useApp } from './store';

/** Reloads the local asset cache status (manifest + catalog) into the store. */
export async function refreshAssets() {
  try {
    const status = await platform.assets.status();
    useApp.getState().setAssetStatus(status);
  } catch (e) {
    useApp
      .getState()
      .setAssetStatus({ root: null, manifest: null, catalog: null, userManifest: null, error: String(e) });
  }
}
