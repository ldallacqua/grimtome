# Architecture

Grimtome is a Tauri 2 desktop app: a React/TypeScript UI in WebView2 and a Rust host for everything that touches Windows. A Rust library (`d4data`) reads the optional local game assets.

```text
┌────────────────────────── WebView2 (React 19, TypeScript, zustand) ──────────────────────────┐
│ features/   dashboard · item-advisor · skills · paragon · builds · settings · onboarding ·     │
│             overlay (2nd window) · transitions                                                │
│ design-system/  tokens, components, native skin (skin.ts → --d4-* CSS variables)              │
│ app/        store (zustand), persistence (versioned), scan ingestion, bootstrap               │
│ services/   platform (tauri | browser) · importers (paste, json, maxroll link) · assets        │
│ domain/     builds (zod schema) · items (OCR repair, parser, affixes) · recommendations ·     │
│             progression (skills, paragon, transition state machine)   ← framework-free        │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │ invoke() / events
┌────────────────────────────── src-tauri (Rust) ┴──────────────────────────────────────────────┐
│ storage.rs  JSON documents in %APPDATA%\app.grimtome.desktop\storage                          │
│ assets.rs   import (progress events), status, clear, reveal                                   │
│ scan.rs     capture → find tooltip → 3-pass OCR vote → colors                                  │
│ capture.rs  GDI screen copy, cursor and monitor geometry                                      │
│ ocr.rs      Windows.Media.Ocr                                                                 │
│ tooltip.rs  pure: anchors, clustering, voting, color sampling (unit-tested)                   │
│ overlay.rs  no-activate topmost window, click-through        hotkeys.rs  global shortcuts     │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                     crates/d4data — read-only reader for the Steam "static container" layout:
                     keys/tvfs/storage/blte → CoreTOC, packed SNO files, StringLists, textures
                     → catalog.json + PNGs in %LOCALAPPDATA%\Grimtome\assets\current
```

## Module boundaries

- `src/domain` has no React, no Tauri and no I/O. Everything there is a pure function over typed data and is unit-tested.
- Only `src/services/platform/*` and `src/main.tsx` may import `@tauri-apps/*` (enforced by ESLint). The UI talks to the host through the `PlatformApi` interface; `browser.ts` implements it for the dev server and tests (no capture, OCR from recorded samples, localStorage).
- Game knowledge lives in data, not code: affix labels in `domain/items/affixes.ts` (plus the imported catalog's templates), builds in the zod-validated build model, item names from the catalog. Business logic never hard-codes item names.
- Rust commands are thin; testable logic sits in pure modules (`tooltip.rs`, `d4data`).

## The scan path

1. **Trigger:** global hotkey (Rust), in-app button (3 s delayed, window minimized), screenshot upload or pasted text.
2. **Capture** (`capture.rs`): GDI copy of a band around the cursor on the monitor under it (smart), a box around the cursor, or a fixed region. A black frame (exclusive full screen) is reported as an actionable error.
3. **Find the tooltip** (`tooltip.rs`): one OCR pass over the capture; lines are clustered into vertically stacked, aligned columns; clusters with anchors (item power, rarity/type line, level requirement) are tooltips; the one nearest the cursor wins; a cluster headed "Equipped" is the comparison tooltip.
4. **Read it:** the tooltip crop is OCR'd at three scales and each line is voted on (each scale makes different mistakes). A bullet the OCR read as `+`/`•` is split off and its box color sampled; text color is sampled from glyph cores. Colors identify rarity (name), Greater Affixes (orange star) and tempered affixes (blue).
5. **Parse** (`domain/items/parser.ts`): OCR repair (`%` read as `96`, `1 ,190`, broken roll ranges), header/type/power/affix/footer classification, affix dictionary matching (exact, skill-rank, fuzzy with margins), confidence score with explained deductions.
6. **Evaluate** (`domain/recommendations`): identify the item against both builds (uniques, aspects, affix priorities, slot), compare with equipped items when known, produce a verdict, reasons (localizable codes), caveats and confidence. Unknown or low-confidence items become _Needs review_.
7. **Present:** Item Advisor and the overlay (via `emitTo('overlay', …)`); the scan is stored in history.

## State and persistence

- One zustand store (`app/store.ts`); slices persisted as a versioned document (`app/persistence.ts`) with per-section validation, so one bad section never wipes the rest.
- Writes are debounced (250 ms) and flushed on `pagehide`/`visibilitychange`; on the desktop the main window's close is held until the UI has flushed (`app://close-requested` → `app_exit`, 2 s fallback).
- Settings are a zod schema with defaults; unknown/invalid values fall back safely.

## Build transitions

`domain/progression/transition.ts` is a small state machine (`leveling` → `endgame`, with `ACCEPT`, `REVERT`, `POSTPONE`). Readiness is computed from the endgame build's criteria and the player's progress (level, Paragon, owned uniques/aspects, skill steps). Changing phase changes the active role, which every evaluation reads, so verdicts update immediately.

## Assets and the native skin

`services/assets/resolver.ts` resolves semantic ids (`skill.barbarian.bash`, `ui.nine.panel`) in priority order: imported game asset → user asset pack → none (callers render Grimtome's original artwork). `design-system/skin.ts` maps ~150 UI textures to `--d4-*` CSS variables and sets `data-skin="game"` when they are available; component CSS draws 9-slice `border-image`s and glyphs from those variables and otherwise keeps the original styling. See [ASSETS.md](ASSETS.md).

## Overlay

A second Tauri window (`?window=overlay`), transparent and undecorated, made a tool window that never activates. It sizes itself to its content (`fitCurrent`) so no invisible area blocks the game, and supports click-through. The main window sends it verdicts; it reads settings from the same persisted store.

## Extension points

- **Importers** (`services/importers`): produce a `Build` and pass `BuildSchema` validation.
- **Evaluation rules** (`domain/recommendations`): reasons are codes + params rendered per locale; new rules add a code, a renderer and tests.
- **AI features (future, optional):** explanations must be generated from the structured evaluation (codes, params, fits), never from free text, so they stay grounded in deterministic results. No external AI service is required.
