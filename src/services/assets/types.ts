/** Mirrors `crates/d4data/src/export.rs` and `catalog.rs` (camelCase JSON). */

export interface AssetRecord {
  file: string;
  category: string;
  width: number;
  height: number;
  sha256: string;
  texture: string;
  frame: number | null;
}

export interface AssetManifest {
  schemaVersion: number;
  gameBuild: string | null;
  locale: string;
  generatedAtUnix: number;
  source: string;
  assets: Record<string, AssetRecord>;
  failures: string[];
}

export interface CatalogClass {
  id: string;
  key: string;
  name: string;
  icon: string | null;
  emblem: string | null;
}
export interface CatalogSkill {
  id: string;
  class: string;
  sno: number;
  name: string;
  summary: string | null;
  upgrades: string[];
  icon: string | null;
}
export interface CatalogUnique {
  id: string;
  sno: number;
  name: string;
  slot: string;
  class: string | null;
  power: string | null;
  flavor: string | null;
  icon: string | null;
}
export interface CatalogAspect {
  id: string;
  sno: number;
  name: string;
  class: string | null;
  description: string | null;
}
export interface CatalogGlyph {
  id: string;
  sno: number;
  name: string;
  icon: string | null;
}
export interface CatalogBoard {
  id: string;
  sno: number;
  name: string;
  class: string | null;
}
export interface CatalogAffixTemplate {
  key: string;
  text: string;
}

export interface GameCatalog {
  schemaVersion: number;
  gameBuild: string | null;
  locale: string;
  classes: CatalogClass[];
  skills: CatalogSkill[];
  uniques: CatalogUnique[];
  aspects: CatalogAspect[];
  glyphs: CatalogGlyph[];
  paragonBoards: CatalogBoard[];
  affixTemplates: CatalogAffixTemplate[];
}

export type AssetSource = 'game' | 'user' | 'app' | 'none';

export interface ResolvedAsset {
  url: string | null;
  source: AssetSource;
  width?: number;
  height?: number;
}

export interface AssetCacheStatus {
  /** Absolute cache folder on disk (desktop) or a URL prefix (browser dev). */
  root: string | null;
  manifest: AssetManifest | null;
  catalog: GameCatalog | null;
  userManifest: AssetManifest | null;
  error?: string;
}
