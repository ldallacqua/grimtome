# Testing

| Layer | Tool | Command | Where |
| --- | --- | --- | --- |
| Unit (TS) | Vitest, jsdom | `pnpm test:unit` | `tests/unit`, `src/**/*.test.ts` |
| Integration (TS) | Vitest | `pnpm test:integration` | `tests/integration` |
| Unit (Rust) | cargo | `cargo test --workspace` | `crates/d4data`, `src-tauri/src` |
| Web E2E | Playwright (Chromium) against `vite preview` | `pnpm test:e2e` | `tests/e2e` |
| Visual regression | Playwright screenshots | `pnpm test:visual` | `tests/visual` |
| Desktop smoke | Playwright over WebView2 CDP, real exe | `pnpm test:desktop` | `tests/desktop` |
| Asset licensing | Node script | `pnpm check:assets` | `scripts/check-asset-licensing.mjs` |

`pnpm test` runs unit + integration. CI (`.github/workflows/ci.yml`, Windows runners) runs everything above plus lint, Prettier, `tsc`, rustfmt and clippy (`-D warnings`), and builds the installers.

## What is covered

- **Parser and OCR normalization:** headers, rarity from name color, slots in English and pt-BR, affix matching (exact, skill-rank, fuzzy), Greater Affix and tempered detection from bullet colors, roll ranges, OCR repairs, garbled input → low confidence.
- **Recorded Windows OCR** (`tests/integration/ocr-fixtures.test.ts`): real `Windows.Media.Ocr` output for six tooltips must parse to the same item and the same verdict (both roles) as the hand-written ground truth.
- **Recommendations:** every verdict, future-build awareness (stash for endgame), re-evaluation after switching builds, unknown items, mythics, equipped comparison, conservative handling of low confidence.
- **Progression:** next skill point, skill milestones, Paragon objectives, transition readiness and the state machine (accept, revert, postpone, invalid transitions).
- **Builds:** schema validation and migration, JSON import/export, paste importer, Maxroll link parsing.
- **Rust:** storage key layouts, TVFS, BLTE (including refusing encrypted blocks), TOC, packed files, strings, texture decoding, frame composition; tooltip anchors, clustering, Equipped detection, bullet splitting, multi-pass voting, color sampling; capture settings and timestamps.
- **E2E:** onboarding → load two builds → set level → scan a sample tooltip (OCR → parse) → verdict "Stash for endgame" → switch to endgame → verdict becomes "Upgrade candidate" → reload → state, history and phase persist. Paste-text flow.
- **Visual:** dashboard, item advisor, skills, Paragon, builds, settings and the transition dialog at 1920×1080, 2560×1440 and 1280×800 @2x, plus the overlay. Baselines are captured **without game assets** (`vite preview` never serves them), so they are safe to commit.
- **Desktop smoke:** launches `target/release/grimtome.exe` with `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`, checks native commands (storage, OCR languages, asset status, native skin when assets are imported), then shows a sample tooltip in the window and runs a real `scan_capture` in region mode — GDI capture plus Windows OCR — asserting the item name and item power.

## Adding OCR test cases

1. Put a tooltip image somewhere local (a real in-game crop or `pnpm fixtures:tooltips` output). Do not commit screenshots that contain game UI textures; the sample tooltips are rendered by `scripts/render-tooltip-fixtures.ts` with Grimtome's own styling.
2. Record the engine output: `cargo run --release -p grimtome --bin grimtome-ocr -- path/to/tooltip.png en-US > tests/fixtures/ocr/<id>.json`
3. Add the ground truth (`tests/fixtures/tooltips.ts`, same `<id>`), with bullet glyphs and the colors that matter.
4. `pnpm test:integration`. If the parse differs because of a systematic misreading, fix it in `repairOcr` (`src/domain/items/text.ts`) with a unit test — never special-case a fixture.

## Visual baselines

`pnpm test:visual:update` regenerates them. Review every changed image before committing. Rendering can differ slightly between machines (fonts are bundled; GPU/antialiasing are not), so the threshold is 1% of pixels.

## Manual Windows smoke test (in game)

Not automated, because CI has no Diablo IV. Run before a release and record the result in the release notes:

1. Install from the NSIS installer; start Grimtome; finish onboarding with your builds or the samples.
2. Optional: Settings → Game assets → Import; confirm the native look.
3. Start Diablo IV in Windowed or Borderless mode. Hover a legendary item, press Ctrl+Shift+D. Expect the overlay to show a verdict within ~1 s, without the game losing focus.
4. Hover an item while the "Equipped" comparison is visible; confirm both are read (Item Advisor → equipped data).
5. Ctrl+Shift+X: clicks pass through the overlay; Ctrl+Shift+O hides/shows it.
6. Switch to exclusive full screen and scan: expect the "capture came back black" message.
7. Close Grimtome right after changing progress; reopen; the change is kept.
