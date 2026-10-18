# Implementation checklist

Status legend: **Done** (implemented and verified by the listed evidence) · **Fallback** (a documented alternative instead of the original ask) · **Partial** · **Not verified** (implemented, but not yet tested in the real setting).

## Acceptance criteria (from the brief)

| Criterion | Status | Evidence / notes |
| --- | --- | --- |
| Windows application launches | Done | `pnpm test:desktop` launches the built exe; NSIS and MSI installers built |
| Interface polished and consistent | Done | Reviewed screenshots of every screen, with and without game assets; visual baselines |
| Two builds can be loaded and stored | Done | E2E reload test; persistence unit tests |
| Maxroll integration where permitted, fallback otherwise | Fallback | Maxroll disallows automated access, so no fetching: links stored for attribution + paste-from-guide importer + JSON |
| Capture or upload an item screenshot | Done / Not verified in game | Upload: E2E. Capture: desktop smoke test does a real GDI capture + OCR of a tooltip shown on screen. Not yet run against a live Diablo IV session |
| OCR produces structured item information | Done | Real Windows OCR fixtures parse to ground truth (integration tests) |
| Review and correct OCR results | Done | Correction editor in Item Advisor; "verified" items unit-tested |
| Explainable recommendation | Done | Reasons with codes, roles and EN/pt-BR text; unit tests |
| Items for the future build identified | Done | "Stash for endgame" tests (uniques, aspects, affixes) |
| Unknown/ambiguous items handled conservatively | Done | "Needs review"; legendaries with unknown powers never salvaged |
| Skill progression guidance | Done | Next point, ranks, upgrades, allocation tracking |
| Paragon milestone tracking | Partial | Board order, glyphs, objectives and completion; no node-by-node paths (guides rarely provide them) |
| Build transitions update recommendations | Done | State machine tests; E2E verdict changes after switching |
| Desktop overlay works | Done / Not verified in game | No-activate topmost window, click-through, hotkeys implemented; browser demo covered by visual test. Behavior over the running game not yet verified |
| Works without proprietary assets | Done | All tests and baselines run without assets |
| Local asset integration only where permitted | Done (gray area documented) | Opt-in, read-only, offline, local; see COMPLIANCE.md |
| Original UI assets | Done | Brand mark, app icons, line icon set, CSS styling |
| No unauthorized assets committed or packaged | Done | `pnpm check:assets` (hash comparison with local cache) |
| Settings persist | Done | Persistence and settings tests; close handshake flushes state |
| Unit and integration tests pass | Done | 69 Vitest tests, 32 Rust tests |
| Applicable E2E tests pass | Done | 2 web E2E (CI) + desktop smoke (local: built exe and installed app) |
| Visual regression implemented | Done | 22 baselines (3 sizes + overlay) |
| Windows build artifact | Done | NSIS, MSI, portable exe |
| CI configured and passing | Done (desktop smoke is best effort in CI) | Lint, format, types, TS + Rust tests, clippy, asset check, web E2E and visual pass on Windows runners; installers build in CI. The desktop smoke test cannot start WebView2 on hosted runners, so it runs locally before releases |
| Comprehensive documentation | Done | README, AGENTS, docs/, ADRs |
| Published under ldallacqua | Done | https://github.com/ldallacqua/grimtome — release v0.1.0 (pre-release) with NSIS, MSI, portable exe and checksums |

## Milestones

- [x] Desktop foundation: app shell, design system, dashboard, persistence, two-build model, sample builds, overlay window, tests.
- [x] Screenshot recognition: hotkey capture, upload, paste, Windows OCR with tooltip segmentation and voting, parser, confidence, correction UI, OCR fixtures.
- [x] Recommendation engine: active and future build, stash logic, explanations, conservative unknowns, tests.
- [x] Progression: skills, Paragon milestones, manual progress, transition state machine, automatic re-evaluation.
- [x] Polish and assets: native skin from imported textures, original branding, asset resolver, importer, visual tests, onboarding and error states.
- [x] Release: tests, installers, docs, CI workflow, asset checks.

## Known gaps

- In-game validation (capture timing, OCR accuracy on real tooltips across resolutions and UI scales, overlay over the game) is a manual step — see TESTING.md.
- Exclusive full-screen capture returns black (detected and explained); Windows.Graphics.Capture is the planned fallback.
- Battle.net (CASC) installs: detected, not importable yet.
- pt-BR: parser keywords and recommendation texts exist; full UI translation is partial.
- Overlay position is not remembered between sessions.
