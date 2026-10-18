# 0001 — Tauri 2 + React + TypeScript, with Rust for Windows integration

- Status: accepted
- Date: 2026-10-18

## Context

The app needs a premium custom UI, a second always-on-top overlay window, global hotkeys, screen capture, OCR and a reader for local game files. It targets Windows 10/11 only.

## Decision

Tauri 2 with a React 19 + TypeScript (strict) front end and a Rust host. Windows APIs (GDI, `Windows.Media.Ocr`, window styles) are called from Rust through the `windows` crate. Game-file reading lives in a separate, testable crate (`crates/d4data`).

## Consequences

- Small installers (≈4–6 MB) using the system WebView2; per-user install without admin rights.
- One language per concern: UI in TypeScript, platform and binary parsing in Rust, both strongly typed.
- The UI talks to the host only through `PlatformApi`; a browser implementation makes the UI runnable and testable without the desktop shell.
- WebView2 is required (preinstalled on Windows 11, bootstrapped by the installer otherwise).
