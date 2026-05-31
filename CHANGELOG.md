# Changelog

All notable changes to the MLB Daily Dashboard (product life) are recorded here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this project
uses semantic-ish versioning starting from the AutoBuilder promotion baseline.

The **canonical version string** lives in `index.html` at `#app-version`
(`data-version` attribute + visible text in the footer strip). Bump it here and
there together on every release — they are the single source of truth used for
deploy/testing verification.

## [Unreleased]

## [1.3.0] — 2026-05-31
### Added
- **Daily briefing** (`OPP-002`, template version) — `briefing-engine.js`, a
  pure/deterministic module that produces 3–5 plain-language "Today around the
  league" highlights from in-memory data (best record, hot win streak, best
  weekly run differential, tightest race, biggest division lead, active skid,
  today's slate size). Rendered in a new `#briefing` card atop the Daily tab.
  **Rule-based — no LLM, no backend, no new fetches; never invents a stat.**
  A future Phase-4 LLM upgrade would rephrase these grounded highlights only.
- `tests/briefing-engine.test.js` — 10 cases (ordering, team de-duplication,
  no-fabrication on empty trends, plural/singular, 5-item cap). Suite now 33, green.

### Changed
- `init()` (app.js) computes the briefing alongside watchability and renders it
  via new `renderBriefing()`; the card hides itself when nothing is noteworthy
  (off-season) or on a failed load.

## [1.2.0] — 2026-05-31
### Added
- **Watchability ranker** (`OPP-001`) — `watchability-engine.js`, a pure/deterministic
  module that scores tonight's games from data already in memory (weekly trends +
  standings + schedule). The top 3 games are badged "★ Top game" in the Upcoming
  panel, sorted to lead their day, each with a plain-language reason (hot streak,
  tight race, division rivalry, both teams hot, two strong clubs). **No backend,
  no AI vendor, no new network calls.**
- `tests/watchability-engine.test.js` — 8 cases (scoring order, tonight filter,
  reason generation, top-3 cap, graceful degradation). Suite now 23 tests, green.
- Gold "featured" theme tokens (`--watch-gold`, `--watch-gold-bg`) for light + dark.

### Changed
- `renderUpcoming` / `renderGameRow` (app.js) now accept watchability results and
  apply the badge, reason line, and top-game ordering. Degrades to the prior
  behavior when scoring is unavailable (off-season, no games, or a scoring error).

## [1.1.0] — 2026-05-31
### Added
- **Version strip** in the footer (`#app-version`, `data-version="1.1.0"`) — a
  publicly visible, JS-independent build marker so a given deploy can be verified
  by reading page source or asserting on the element in automated tests.
- `window.__APP_VERSION__` exposed at runtime (read from the DOM marker) for
  programmatic verification in browser-driven tests.
- Product-intelligence checkpoint under `docs/intelligence/` (analysis, scores,
  tracking ledger, dashboard, and the implementation roadmap this work follows).

### Notes
- This is the first product-life change after the AutoBuilder promotion baseline
  (commit `b4c1e6c`), which is treated as **1.0.0**.
- Begins Phase 0 (Foundation) of `docs/intelligence/IMPLEMENTATION_ROADMAP.md`.

## [1.0.0] — 2026-05-31 (promotion baseline)
- Initial promoted deliverable from AutoBuilder run `mlb-daily-dashboard`:
  vanilla-JS static dashboard for all 30 MLB teams (Daily + Trends tabs), live
  from the MLB Stats API, hosted on GitHub Pages. No functional changes recorded
  here — this entry marks the fork point.
