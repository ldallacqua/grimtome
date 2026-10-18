# 0004 — No scraping of build guide sites

- Status: accepted
- Date: 2026-10-18

## Context

Most players follow Maxroll guides. Maxroll's robots.txt disallows `/d4/planner/*` and its notice prohibits automated scraping without permission; no public import API was found.

## Decision

Never fetch Maxroll or other guide sites. Support (a) pasting text copied from a guide, matched against catalog names, with a reviewable draft; (b) storing guide links for attribution; (c) Grimtome's own versioned JSON format.

## Consequences

- Import needs a copy/paste step. Recognition is strongest with the imported game catalog.
- If a site offers an official export or API, an importer can be added behind the same `Build` schema (see AGENTS.md → "Adding an importer").
