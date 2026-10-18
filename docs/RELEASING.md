# Releasing

1. Update the version in `package.json`, `src-tauri/tauri.conf.json` and `Cargo.toml` (`[workspace.package]`).
2. Run every check (see TESTING.md), including `pnpm check:assets`, the manual in-game smoke test and — locally, since it is not reliable on hosted CI runners — `pnpm test:desktop` against both the built exe and the installed app (`GRIMTOME_EXE=%LOCALAPPDATA%\Grimtome\grimtome.exe`), plus a silent install/uninstall (`setup.exe /S`, `uninstall.exe /S`).
3. Update `docs/RELEASE_NOTES.md` and `docs/CHECKLIST.md`.
4. Tag `vX.Y.Z` and push the tag. `.github/workflows/release.yml` builds the installers on Windows, writes `SHA256SUMS.txt` and opens a **draft** release with the NSIS installer, MSI, portable exe and checksums. Review and publish it.

Builds are **not code-signed** (no certificate is available). SmartScreen shows "Windows protected your PC" until a build gains reputation; the README explains "More info → Run anyway" and the checksum file.

The portable build is `grimtome-<version>-portable.exe`, the bare app executable (needs WebView2, which Windows 11 includes). Its data still goes to `%APPDATA%\app.grimtome.desktop` and `%LOCALAPPDATA%\app.grimtome.desktop`.
