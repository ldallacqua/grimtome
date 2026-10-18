# Game assets

Grimtome works fully without any Diablo IV files. Optionally, a player can import textures and names from **their own** Steam installation so the interface uses the game's native look and real skill/item icons. Nothing imported is ever committed, bundled or uploaded. Read [COMPLIANCE.md](COMPLIANCE.md) first.

## Resolution order

`AssetResolver` (`src/services/assets/resolver.ts`) resolves a semantic id to a URL:

1. A locally imported game asset (only when the user enabled game assets).
2. A user-provided asset pack (`%LOCALAPPDATA%\app.grimtome.desktop\assets\user\manifest.json`, same format).
3. Nothing — the caller renders Grimtome's original artwork (line icons, CSS styling, brand mark).

Paths never appear in code; every file is looked up through a manifest.

## The cache

`%LOCALAPPDATA%\app.grimtome.desktop\assets\current` (this exact path is also the Tauri `assetProtocol` scope):

- `manifest.json` — `{ schemaVersion, gameBuild, locale, generatedAtUnix, source, assets: { id: { file, category, width, height, sha256, texture, frame } }, failures }`
- `catalog.json` — classes, skills (with upgrades), uniques (slot, class, power text), aspects, glyphs, Paragon boards, affix templates — in the chosen locale.
- `ui/`, `skills/`, `items/`, `paragon/`, `classes/`, `art/` — PNGs.

A current import produces about 1,900 files (~86 MB) in 2 seconds: 1,135 UI pieces, 318 unique item icons, 273 skill icons, 131 glyph icons, class icons/emblems and 9 loading-screen illustrations (downscaled to 2048 px). The export writes to a staging folder and swaps it in atomically, so a failed import never leaves a half cache.

## Asset ids

| Id pattern | Source |
| --- | --- |
| `skill.<class>.<slug>` | skill icon frame referenced by the power definition |
| `item.<slug>` | inventory icon of a unique/mythic (black background keyed out) |
| `paragon.glyph.<slug>` | glyph icon |
| `class.<key>`, `class.<key>.emblem` | class icon, rendered class emblem |
| `ui.<texture-slug>.<frame>` | one frame of a UI atlas (e.g. `ui.buttons.97`) |
| `ui.<texture-slug>` | a single-frame UI texture (e.g. `ui.tiled-stonebasetile`) |
| `ui.nine.<name>` | a 9-slice image assembled from split panel pieces (see below) |
| `art.<slug>` | large illustration |

UI atlases are listed in `UI_TEXTURES` (`crates/d4data/src/catalog.rs`); every frame is exported. `COMPOSITES` assembles frames into grids — the game draws panels from nine separate pieces, which CSS `border-image` needs as one image. Each composite declares the frame count it was verified against and is skipped if a patch changes the atlas.

## The native skin

`src/design-system/skin.ts` maps 153 textures to CSS custom properties (`--d4-panel`, `--d4-btn-primary`, `--d4-checkbox-on`, …) and sets `data-skin="game"` on `<html>` when the cache has the required pieces. Component CSS has a `Native skin` section per file with rules under `:root[data-skin='game']`:

- buttons: `ui.buttons.95–99` (stone/red), hero `ui.buttons-sharedelements.13–15`, danger `…18–20`, icon squares `ui.buttons.60–62`, window controls;
- panels: `ui.nine.panel` (tooltip leather with silver filigree), `ui.nine.frame-iron`, modal frame `ui.frames-modal.13`, selection glow `ui.nine.selection`;
- item cards: `ui.nine.tooltip-<rarity>`, separators `ui.tooltip.9/12`, glyph bullets `ui.fonticon.0/65/86`, sockets;
- forms: input fields, checkbox, radio, slider and scrollbar pieces from `ui.controls.*`, tabs `ui.smalltabs.*`;
- navigation: menu glyphs `ui.menunav.*` and `ui.inventorytabicons.*`, red list banners, the menu bar and its ember glow;
- inventory: paper-doll slot silhouettes and rarity wells; skill frames; Paragon node frames; progress bars; toasts.

**Adding a native style:** find the texture (developer CLI below), add the atlas to `UI_TEXTURES` (or a composite), re-import, add a variable to `SKIN_TEXTURES`, and write the rule under `:root[data-skin='game']`, keeping the original styling as the fallback. Only design something new when the game has no matching asset.

## Developer CLI

```bash
cargo run --release -p d4data --bin grimtome-extract -- detect
cargo run --release -p d4data --bin grimtome-extract -- export [--game <dir>] [--out <dir>] [--locale enUS]
cargo run --release -p d4data --bin grimtome-extract -- textures button frame   # list atlases
cargo run --release -p d4data --bin grimtome-extract -- dump <out-dir> 2DUI_Buttons   # write frames to inspect
```

Write inspection output to a git-ignored folder (`.scratch/`). `pnpm extract:dev` runs `export` with defaults.

## How the reader works (Steam installs)

- `Data/.build.config` gives the VFS root and key layout bits. Encoded keys map to files `0x####-{meta|payload|child}.dat` (and per-id files) by a 2-bit layout selector, an 8-bit folder and a 46-bit field (`keys.rs`).
- Blobs are zlib or BLTE (`N`, `Z`, `F` modes). Encrypted BLTE blocks (`E`) are **refused**, never decrypted.
- The TVFS root lists the `base` file system with `meta/`, `payload/`, `paylow/`, `child/` SNOs and root files (`CoreTOC.dat`, `Texture-Base-Global.dat`, `StringList-Text-<locale>.dat`).
- `CoreTOC.dat` names every SNO by group (Power 29, StringList 42, Texture 44, Item 73, Aspect 128, …). Texture definitions give format, size and atlas frames; payloads are BC1/BC3/BC4/BC5/BC7 or BGRA8 with rows padded to 256 bytes.
- Icons are found by reference scanning: definitions store 32-bit atlas frame hashes, which are matched against frames of the relevant atlas family (`2DUI_Skills_*`, `2DInventory*`, `2DUI_ParagonGlyphs`).

Battle.net (CASC) installs are detected but not read yet.

## Licensing check

`pnpm check:assets` scans every tracked or new file: it rejects game data file types and cache folders, and compares every image's SHA-256 with the local import manifest so a copied texture cannot slip into a commit. It runs in CI and in the release workflow.
