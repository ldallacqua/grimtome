# Compliance, safety and licensing

Grimtome is an unofficial companion. It must be safe to run next to Diablo IV and must not redistribute Blizzard's property. These rules are non-negotiable for every change (see also [AGENTS.md](../AGENTS.md)).

## What the application never does

The application must not:

- Read Diablo IV process memory.
- Inject code or DLLs.
- Modify the game executable.
- Intercept game network traffic.
- Automate gameplay or inventory actions.
- Bypass anti-cheat mechanisms.
- Circumvent DRM or access controls.
- Attempt to conceal its behavior from anti-cheat software.

How the code honors this:

| Capability | How Grimtome does it | What it avoids |
| --- | --- | --- |
| Reading an item | GDI copy of screen pixels (`src-tauri/src/capture.rs`), the same data a screenshot key produces | No handles to the game process, no memory reads |
| Recognizing text | Windows' built-in OCR (`Windows.Media.Ocr`) on that copy | No hooks into the game's renderer |
| Hotkeys | `RegisterHotKey` through the Tauri global-shortcut plugin; triggers only Grimtome's own actions | No input is ever sent to the game |
| Overlay | A separate top-most window of our own process (`WS_EX_NOACTIVATE`, optional click-through) | No drawing inside the game, no injection |
| Game textures | Optional, opt-in, read-only reading of files in the user's own installation folder, never while modifying anything | No decryption of protected content (encrypted BLTE blocks are refused), no network access, no changes to game files |

There is no telemetry, no account and no network access at runtime other than what the user explicitly opens in their browser (guide links). The installer installs per user and needs no administrator rights.

## Blizzard's terms — the gray area, stated plainly

Blizzard's End User License Agreement restricts third-party software that interacts with its games; section 1.C lists, among other things, software that "reads or mines" information from the game ([EULA](https://www.blizzard.com/en-us/legal/fba4d00f-c7e4-4883-b8b9-1b4500a402ea/blizzard-end-user-license-agreement)). Blizzard has warned Diablo IV players about overlays and tools that read game memory, such as TurboHUD4 ([MP1st](https://mp1st.com/news/diablo-4-turbohud4-flagged-by-blizzard-as-software-that-can-lead-to-disciplinary-action-and-even-permanent-suspension), [Blue's News](https://www.bluesnews.com/s/262177/diablo-iv-third-party-software-warning), [TweakTown](https://www.tweaktown.com/news/92570/do-you-use-diablo-4-mods-blizzard-might-hit-with-the-perma-ban-stick/)).

- **Screen capture + OCR** works on pixels the player already sees. It is the same category as screenshot tools and stream overlays, and it does not touch the game client. We consider this low risk, but no third-party tool is endorsed by Blizzard.
- **The optional asset importer** reads data files from the game's installation folder on disk (not the running game). Whether this counts as "mining" under the EULA is not settled. Grimtome therefore makes it strictly **opt-in**, shows a consent dialog that says so, works **offline**, keeps results **only on the user's PC**, never decrypts protected content, and the app is fully functional without it.

Users decide whether to use the importer. If Blizzard objects, the importer can be disabled without affecting the rest of the app.

## Assets and the repository

- Blizzard-owned files must not be indiscriminately copied into the public GitHub repository or distributed with the application. Grimtome ships **no** game files: the installer contains only Grimtome's code, original artwork (logo, line icons) and open-source fonts.
- Imported textures live in `%LOCALAPPDATA%\app.grimtome.desktop\assets\current` and are never uploaded. Never upload imported assets, telemetry, or screenshots automatically — Grimtome uploads nothing at all.
- `pnpm check:assets` (run in CI and before releases) fails if game data file types, cache folders, or any image byte-identical to an asset in the local import cache would be committed.
- Screenshots in the repository (README, visual baselines) are taken **without** game assets.
- Item, skill and class **names** appear as factual references (sample builds, tests). They remain Blizzard's trademarks.

## Build guide sites

Maxroll's `robots.txt` disallows automated access to the Diablo IV planner (`Disallow: /d4/planner/*`, [robots.txt](https://maxroll.gg/robots.txt)) and its site notice prohibits automated scraping without written permission. Grimtome therefore never fetches Maxroll (or any guide site). Do not bypass access controls, authentication requirements, rate limits, or anti-bot protections. Supported paths:

- Store a Maxroll link with a build (attribution, open in browser).
- Paste text the player copied from a guide; Grimtome matches names against the local catalog.
- Grimtome's own versioned JSON format.

Do not invent APIs or unsupported capabilities; an official import path can be added if a site provides one.

## Privacy

- No telemetry by default (and none implemented).
- Scan history is stored locally; tooltip images are kept only if the user enables "Keep tooltip images".
- Settings → Data & privacy shows where data is stored and can erase everything.

## Distribution

- Do not assume signing certificates are available. Releases are unsigned; SmartScreen warns on first run, which the README documents. Checksums are published with each release.
- Avoid unnecessary administrator privileges: the NSIS installer uses per-user install mode.
