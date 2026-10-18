# 0002 — Optional, local, read-only import of game assets

- Status: accepted
- Date: 2026-10-18

## Context

A native look (real buttons, frames, tooltips, skill and item icons) makes the app feel like part of the game. Blizzard's files cannot be redistributed, and the EULA's position on reading game data files is unclear.

## Decision

Ship Grimtome's own artwork and styling, and offer an **opt-in** importer that reads the player's own Steam installation read-only, offline, and writes decoded textures and names to `%LOCALAPPDATA%\app.grimtome.desktop\assets\current`. Encrypted content is refused. The UI resolves assets by id through manifests (game → user pack → original artwork). A native skin maps imported UI textures to CSS variables; every component keeps its original styling as the fallback.

## Consequences

- No game file is in the repository or installer; `pnpm check:assets` enforces it.
- The app is complete without the import; with it, every surface uses the game's textures.
- Patches can change atlas layouts; composites and class icon frames are guarded by verified frame counts and skipped if they change.
- Battle.net (CASC) installs are not supported yet.
- The consent dialog states the EULA gray area; the importer can be removed without affecting other features.
