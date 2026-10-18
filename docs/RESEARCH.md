# Research notes

Findings that shaped Grimtome, with sources. Verified October 2026; game details change every season, so re-check before relying on them.

## Game state (October 2026)

- **Season 15, "Season of Hell's Legacy"**, started September 15, 2026, on the 3.2.x patch line. ([d4guides.gg — Season 15](https://d4guides.gg/en/season15), [d4guides.gg — start date and content](https://d4guides.gg/en/news/diablo-4-season-15-season-of-hell-s-legacy-start-date-content-and-rewards), [allthings.how](https://allthings.how/diablo-4-season-15-start-date-and-time/), [GameWatcher](https://www.gamewatcher.com/diablo-4-season-15-release-date-latest-news), [Mein-MMO](https://mein-mmo.de/en/diablo-4-season-15-everything-about-start-release-date-and-the-best-classes))
- **Lord of Hatred** (second expansion) launched April 28, 2026: new Warlock class plus the Paladin, a reworked skill tree, character level cap 70 and Paragon up to 300. ([KeenGamer](https://www.keengamer.com/articles/guides/diablo-iv-lord-of-hatred-all-new-changes-and-updates/), [Gaming Nexus](https://www.gamingnexus.com/Article/16372/Diablo-IV-Lord-of-Hatred/), [patched.gg](https://patched.gg/games/diablo-iv/diablo-iv-lord-of-hatred-expansion-available-now), [DiabloBytes](https://www.diablobytes.com/diablo-iv/lord-of-hatred/))
- **Itemization** still uses Greater Affixes (marked with a distinct icon), tempering (extra affixes from a recipe), masterworking (quality ranks with critical bumps), Ancestral items and Mythic Uniques. ([Icy Veins — tempering](https://www.icy-veins.com/d4/guides/tempering-guide/), [Icy Veins — masterworking](https://www.icy-veins.com/d4/guides/masterworking-guide/), [Maxroll — masterworking](https://maxroll.gg/d4/resources/masterworking-guide), [timesaver.gg — S15 masterworking](https://timesaver.gg/blog/diablo-4-masterworking-season-15-guide))

Consequences: `MAX_CHARACTER_LEVEL = 70`, `MAX_PARAGON_LEVEL = 300`, eight classes in `domain/shared/ids.ts`, Greater Affix and tempered flags on parsed affixes, masterwork rank parsing. The imported catalog (when available) is the source of truth for names; the built-in affix dictionary is a fallback.

## How can Grimtome know about the character?

| Option | Verdict |
| --- | --- |
| Official API for Diablo IV characters | We found no published Blizzard API for Diablo IV character or inventory data. Not used. |
| Local save data | Characters are server-side; nothing usable on disk. |
| Game memory | Prohibited (EULA; Blizzard has warned about TurboHUD-style tools). Never. |
| Network traffic | Prohibited. Never. |
| **Screen capture + OCR** | Works on what the player sees. Chosen for items. |
| Manual input | Level, Paragon, owned uniques/aspects, skill steps. Chosen for progression. |

## Terms of service

- Blizzard EULA section 1.C restricts third-party software that interacts with the games, including software that "reads or mines" game information. ([Blizzard EULA](https://www.blizzard.com/en-us/legal/fba4d00f-c7e4-4883-b8b9-1b4500a402ea/blizzard-end-user-license-agreement))
- Blizzard flagged TurboHUD4 (a memory-reading overlay) as grounds for disciplinary action and warned about mods. ([MP1st](https://mp1st.com/news/diablo-4-turbohud4-flagged-by-blizzard-as-software-that-can-lead-to-disciplinary-action-and-even-permanent-suspension), [Blue's News](https://www.bluesnews.com/s/262177/diablo-iv-third-party-software-warning), [TweakTown](https://www.tweaktown.com/news/92570/do-you-use-diablo-4-mods-blizzard-might-hit-with-the-perma-ban-stick/), [Film Stories](https://filmstories.co.uk/news/diablo-iv-modders-will-be-banned-blizzard-warns))

See [COMPLIANCE.md](COMPLIANCE.md) for how this is applied, including the gray area of the optional asset importer.

## Build sources

- Maxroll publishes Diablo IV build guides and a planner. Its `robots.txt` disallows `/d4/planner/*` for crawlers, and the site prohibits automated scraping without permission. No public API for third-party import was found. ([robots.txt](https://maxroll.gg/robots.txt), [build guides](https://maxroll.gg/d4/build-guides/))
- Decision: no fetching. Paste-from-guide importer, stored links for attribution, and Grimtome's own JSON format ([ADR 0004](adr/0004-no-guide-scraping.md)).

## Windows platform

- **Capture:** GDI `BitBlt` from the screen DC captures windowed and borderless games; exclusive full-screen surfaces can come back black. Windows.Graphics.Capture is the fallback candidate if GDI proves unreliable in game.
- **OCR:** `Windows.Media.Ocr` ships with Windows 10/11, runs offline, needs no model download and returns words with bounding boxes ([API reference](https://learn.microsoft.com/en-us/uwp/api/windows.media.ocr.ocrengine)). Measured on sample tooltips: small text (11–14 px glyphs) is read much better after upscaling, and each scale makes different mistakes — `%` read as `96`, a dropped bold number, a bullet read as `+` or `•`. Voting across three scales fixed all dropped numbers in our fixtures ([ADR 0003](adr/0003-windows-ocr-with-voting.md)).
- **Overlay:** a separate top-most tool window with `WS_EX_NOACTIVATE` and `SW_SHOWNOACTIVATE` never takes focus from the game; click-through via `set_ignore_cursor_events`.
- **Hotkeys:** `RegisterHotKey` (Tauri global-shortcut plugin) works while the game has focus.

## Local game files (Steam installation)

Investigated by reading the files of a local Steam installation (build reported by the Steam manifest); details in [ASSETS.md](ASSETS.md). Key facts: a "static container" layout (not CASC) with a TVFS root, zlib/BLTE blobs, a `CoreTOC.dat` that names all SNOs by group, packed texture and string-list bundles, BCn textures with atlas frames, and atlas frame hashes referenced from power/item/glyph definitions. Battle.net installs use CASC and are not supported yet. Steam help for locating installs: [Steam Support](https://help.steampowered.com/).
