import type { AssetManifest, ResolvedAsset } from './types';

/**
 * Resolves semantic asset ids (`skill.barbarian.bash`, `class.rogue`,
 * `ui.tooltipbackgroundrarity-legendary.6`) to URLs, in priority order:
 *
 * 1. a locally imported game asset (only if the user enabled game assets),
 * 2. a user-provided asset pack,
 * 3. nothing — callers then render Grimtome's original artwork.
 *
 * Paths never come from code: every file is looked up through a manifest.
 */
export class AssetResolver {
  constructor(
    private readonly game: { manifest: AssetManifest; urlFor: (file: string) => string } | null,
    private readonly user: { manifest: AssetManifest; urlFor: (file: string) => string } | null = null,
  ) {}

  static empty(): AssetResolver {
    return new AssetResolver(null, null);
  }

  get hasGameAssets(): boolean {
    return !!this.game && Object.keys(this.game.manifest.assets).length > 0;
  }

  get gameBuild(): string | null {
    return this.game?.manifest.gameBuild ?? null;
  }

  has(id: string): boolean {
    return !!(this.game?.manifest.assets[id] || this.user?.manifest.assets[id]);
  }

  resolve(id: string | null | undefined): ResolvedAsset {
    if (!id) return { url: null, source: 'none' };
    const g = this.game?.manifest.assets[id];
    if (g && this.game)
      return { url: this.game.urlFor(g.file), source: 'game', width: g.width, height: g.height };
    const u = this.user?.manifest.assets[id];
    if (u && this.user)
      return { url: this.user.urlFor(u.file), source: 'user', width: u.width, height: u.height };
    return { url: null, source: 'none' };
  }

  url(id: string | null | undefined): string | null {
    return this.resolve(id).url;
  }

  /** Number of assets per category, for the settings screen. */
  counts(): Record<string, number> {
    const out: Record<string, number> = {};
    for (const rec of Object.values(this.game?.manifest.assets ?? {}))
      out[rec.category] = (out[rec.category] ?? 0) + 1;
    return out;
  }
}
