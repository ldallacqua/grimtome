# 0005 — Deterministic, explainable recommendations over two builds

- Status: accepted
- Date: 2026-10-18

## Context

Players need to know why an item matters, including for a build they are not playing yet. Opaque scores or AI guesses would be untrustworthy and hard to test.

## Decision

`evaluateItem` is a pure function of the parsed item, both builds, the active role and known equipped items. It identifies uniques, aspects, affix priorities and slot fit for each build, then chooses one of five verdicts with ordered reasons (codes + parameters rendered per locale), caveats and a confidence. Unknown or low-confidence input leads to "Needs review" rather than a guess. Switching builds only changes the active role, so every verdict updates immediately.

## Consequences

- Every rule is unit-tested; explanations can be translated (English and Brazilian Portuguese exist).
- No damage simulation: "Upgrade candidate" means "fits the build better than what we know you have", not a DPS claim.
- Future AI explanations must be generated from the structured result, never from free text.
