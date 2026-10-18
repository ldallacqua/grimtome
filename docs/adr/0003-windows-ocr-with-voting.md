# 0003 — Windows OCR, tooltip segmentation and multi-scale voting

- Status: accepted
- Date: 2026-10-18

## Context

Items must be read from the screen. Options: Tesseract (bundled model, larger install, slower on small game text), cloud OCR (violates local-first), or `Windows.Media.Ocr` (built in, offline, word boxes).

## Decision

Use `Windows.Media.Ocr`:

1. Capture a band around the cursor; OCR it once to find tooltip clusters by anchors (item power, rarity/type line, level requirement) and pick the one nearest the cursor; detect an "Equipped" comparison tooltip.
2. OCR the tooltip crop at three scales and vote per line.
3. Split bullets read as characters and sample bullet and text colors for rarity, Greater Affix and tempered detection.
4. Repair systematic misreadings in the TypeScript parser (`repairOcr`) so uploads and pastes benefit too.

## Consequences

- Measured on recorded fixtures: single-pass OCR dropped bold item-power numbers and misread `%`; three-pass voting recovered every item-power line and all Greater Affix markers in the fixtures, at 30–75 ms per tooltip.
- Accuracy depends on the Windows OCR language packs installed by the user.
- Real in-game captures still need manual validation (CI has no game).
