import { createContext, useContext } from 'react';
import { AssetResolver } from '@/services/assets/resolver';

/**
 * Supplies the asset resolver to design-system components without coupling
 * them to the app store. `enhanced` is true when imported game assets are in use.
 */
export interface AssetsContextValue {
  resolver: AssetResolver;
  enhanced: boolean;
  showArt: boolean;
}

export const AssetsContext = createContext<AssetsContextValue>({
  resolver: AssetResolver.empty(),
  enhanced: false,
  showArt: false,
});

export const useAssets = () => useContext(AssetsContext);

/** Returns the URL for a semantic asset id, or null (callers render a fallback). */
export function useAssetUrl(id: string | null | undefined): string | null {
  const { resolver } = useAssets();
  return resolver.url(id);
}
