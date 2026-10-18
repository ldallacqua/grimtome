# Grimtome 0.1.0 — first preview

Unofficial Diablo IV companion for Windows 10/11 (x64). Not affiliated with Blizzard Entertainment.

## Highlights

- Two builds (leveling + endgame) with item verdicts that consider both: Upgrade candidate, Keep, Stash for endgame, Salvage / sell, Needs review — each with reasons.
- Ctrl+Shift+D reads the hovered item's tooltip from the screen (GDI capture + Windows OCR, tooltip detection, Equipped comparison). Upload and paste work too.
- Skill point order, Paragon board and glyph milestones, build transition readiness.
- In-game overlay that never takes focus, with click-through (Ctrl+Shift+X) and toggle (Ctrl+Shift+O).
- Optional: import textures and names from your own Steam installation for a native Diablo IV look (stays on your PC).
- No account, no cloud, no telemetry; never reads game memory or touches the game.

## Downloads

- `Grimtome_0.1.0_x64-setup.exe` — per-user installer (recommended)
- `Grimtome_0.1.0_x64_en-US.msi` — MSI installer
- `grimtome-0.1.0-portable.exe` — no install
- `SHA256SUMS.txt`

The files are **not code-signed**: Windows SmartScreen will warn on first run (More info → Run anyway). Compare the SHA-256 with `SHA256SUMS.txt`.

## Testing status

Automated: 69 TypeScript unit/integration tests (including real Windows OCR fixtures), 32 Rust tests, web E2E, 22 visual baselines, and a desktop smoke test that runs the built app and reads a tooltip from the screen with real capture + OCR. These exact files were also checked by hand: silent per-user install of the NSIS build (no admin), the smoke test against the installed exe, and a clean uninstall that removes the program, shortcut and registry entry while keeping user data. **Not yet verified against a live Diablo IV session** — please report capture or recognition issues with your resolution and UI scale.

## Known limitations

Run the game in Windowed or Borderless mode (exclusive full screen captures black). Battle.net installs cannot import game textures yet. Paragon guidance is milestone-based. Build import from guides is copy/paste (no website scraping).
