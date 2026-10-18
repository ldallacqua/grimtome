# AGENTS.md — working on Grimtome

Read this before changing anything. It is the complete brief; you should not need the original conversation.

## Project overview

Grimtome is a Windows desktop companion for Diablo IV (Tauri 2 + React 19 + TypeScript + Rust). The player keeps two builds — leveling and endgame. Grimtome reads item tooltips from the screen (global hotkey → GDI capture → Windows OCR → parser) and gives a deterministic, explained verdict for both builds. It also guides skill points, Paragon milestones and the switch to the endgame build, and shows verdicts in an in-game overlay. Optionally, it imports textures and names from the player's own game installation so the UI uses the game's native look. Everything runs locally.

Key docs: [ARCHITECTURE](docs/ARCHITECTURE.md) · [COMPLIANCE](docs/COMPLIANCE.md) · [ASSETS](docs/ASSETS.md) · [TESTING](docs/TESTING.md) · [RESEARCH](docs/RESEARCH.md) · [ADRs](docs/adr) · [CHECKLIST](docs/CHECKLIST.md)

## Security and compliance rules (never break these)

The application must not:

- Read Diablo IV process memory.
- Inject code or DLLs.
- Modify the game executable.
- Intercept game network traffic.
- Automate gameplay or inventory actions.
- Bypass anti-cheat mechanisms.
- Circumvent DRM or access controls.
- Attempt to conceal its behavior from anti-cheat software.

Also:

- Never send input to the game. Hotkeys trigger Grimtome's own actions only.
- Never fetch guide sites (Maxroll disallows it). Do not bypass access controls, authentication requirements, rate limits, or anti-bot protections. Do not invent APIs or unsupported capabilities.
- No telemetry, no network calls at runtime, no automatic uploads of anything (assets, screenshots, data).
- Never decrypt protected game content (`d4data` refuses encrypted BLTE blocks; keep it that way).
- Avoid unnecessary administrator privileges. Do not assume signing certificates are available.

## Asset and licensing restrictions

- No Blizzard file, texture, extracted image or screenshot containing game textures may be committed or packaged. Imported assets live only in `%LOCALAPPDATA%\Grimtome\assets\current`.
- `pnpm check:assets` must pass (it also compares committed images with the local import cache).
- Visual baselines and README images are taken without game assets (`vite preview`).
- Scratch work (texture dumps, contact sheets) goes in `.scratch/` (git-ignored).
- Original artwork (brand mark in `assets/brand`, line icons in `src/design-system/icons.tsx`) is MIT; fonts are OFL.

## Commands

```bash
pnpm install
pnpm dev                 # browser UI on :1420 (dev middleware serves the local asset cache if present)
pnpm app:dev             # desktop app
pnpm app:build           # release exe + NSIS/MSI in target/release/bundle
pnpm lint && pnpm format:check && pnpm typecheck
pnpm test                # unit + integration (Vitest)
pnpm test:e2e            # Playwright vs vite preview
pnpm test:visual         # screenshot comparison; :update to regenerate (review diffs!)
pnpm test:desktop        # drives the built exe over WebView2 CDP (Windows)
pnpm check:assets
cargo fmt --all && cargo clippy --workspace --all-targets -- -D warnings && cargo test --workspace
cargo run --release -p d4data --bin grimtome-extract -- export          # refresh local asset cache
cargo run --release -p grimtome --bin grimtome-ocr -- image.png en-US   # record OCR output
```

Rust needs `%USERPROFILE%\.cargo\bin` on PATH in some shells.

## Architecture and module boundaries

```text
src/domain          pure TypeScript: builds (zod), items (OCR repair, parser, affixes),
                    recommendations, progression. No React, no I/O, no Tauri.
src/services        platform (tauri | browser) behind PlatformApi, importers, asset resolver
src/app             zustand store, versioned persistence, scan ingestion, shell, bootstrap
src/design-system   tokens, components, icons, native skin (skin.ts)
src/features        one folder per screen (+ overlay window)
src-tauri/src       Rust host: commands; pure logic in tooltip.rs
crates/d4data       read-only reader for local game files
tests/              unit, integration, e2e, visual, desktop, fixtures
```

- Only `src/services/platform/*` and `src/main.tsx` may import `@tauri-apps/*` (ESLint enforces it).
- Domain code receives everything it needs as arguments (builds, catalog hints, dictionary); no globals.
- Do not hard-code item, aspect or skill names in business logic; they come from builds, the catalog or the affix dictionary.
- Rust commands stay thin; put logic in pure, unit-tested functions.

## Coding standards and naming

- TypeScript strict with `noUncheckedIndexedAccess`; validate external data with zod (builds, settings, persisted state).
- Small, testable functions; explicit state in the store; versioned persistence (`PERSIST_VERSION`, `BuildFileSchema`).
- Meaningful errors: messages tell the player what to do ("Run Diablo IV in Windowed or Borderless mode…").
- Files: `PascalCase.tsx` for components, `camelCase.ts` otherwise; CSS classes `gt-block__element--modifier`; ids `kebab-case`; asset ids `category.class.slug`.
- Comments explain why, not what. Prettier (110 cols, single quotes) and rustfmt (120 cols) are authoritative.
- Name magic numbers (`IN_APP_SCAN_DELAY_MS`, `MAX_PARAGON_LEVEL`).

## How to…

### Add an importer
1. Create `src/services/importers/<name>.ts` that returns a `Build` (or `BuildFile`) and validates with `BuildSchema` / `parseBuildFile`.
2. Use only data the user provided or the local catalog. No network fetching from guide sites.
3. Add a mode in `features/builds/ImportDialog.tsx` with a review step before saving.
4. Unit tests in `tests/unit/builds`, including malformed input.

### Implement a new evaluation rule
1. Add the logic in `src/domain/recommendations` (`fit.ts` for build fit, `engine.ts` for verdict selection).
2. Add a `ReasonCode` in `explain.ts` with English and pt-BR templates; emit `{ code, params, tone, role }`.
3. Keep it conservative: unknown or low-confidence data must not produce "Salvage".
4. Tests in `tests/unit/recommendations/engine.test.ts` for each verdict path.

### Add OCR test cases
Follow [TESTING.md → Adding OCR test cases](docs/TESTING.md#adding-ocr-test-cases): record with `grimtome-ocr`, add ground truth in `tests/fixtures/tooltips.ts`, fix systematic misreadings in `repairOcr` with a unit test.

### Update game mechanics (new season or patch)
1. Re-run the importer to refresh the catalog (names, skills, uniques, aspects, affix templates).
2. Update `src/domain/shared/ids.ts` (classes, slots, level/Paragon caps) and the built-in affix dictionary in `src/domain/items/affixes.ts` if labels changed.
3. Update sample builds (`src/domain/builds/samples.ts`) and the research notes with sources.
4. If an atlas layout changed, update frame numbers in `crates/d4data/src/catalog.rs` / `skin.ts` and the guarded frame counts.

### Extend the design system / native skin
- Always use the game's own texture when it exists; design something new only when it does not. Find textures with `grimtome-extract textures <words>` and `dump`.
- Add the atlas to `UI_TEXTURES` (or a 9-slice in `COMPOSITES`), map it in `SKIN_TEXTURES`, and style under `:root[data-skin='game']` in the component's CSS ("Native skin" section). Keep the original styling as the fallback.
- Feature screens use the shared `gt-card` and `gt-well` surfaces (`design-system/surfaces.css`) instead of custom borders.

## Definition of done

- Behavior implemented end to end, with an error state and the asset-free fallback.
- Tests added or updated; `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `cargo clippy -D warnings`, `cargo test` pass. Run `pnpm test:e2e` / `test:visual` for UI changes and review screenshots yourself (with and without game assets).
- `pnpm check:assets` passes; no game files or game-texture screenshots committed.
- Compliance rules above still hold; docs (and `docs/CHECKLIST.md`) updated when behavior or status changes.
- Never claim a test passed, a feature works, or a release exists unless you ran or checked it.
