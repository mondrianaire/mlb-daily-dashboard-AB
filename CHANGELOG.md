# Changelog

All notable changes to the MLB Daily Dashboard (product life) are recorded here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this project
uses semantic-ish versioning starting from the AutoBuilder promotion baseline.

The **canonical version string** lives in `index.html` at `#app-version`
(`data-version` attribute + visible text in the footer strip). Bump it here and
there together on every release — they are the single source of truth used for
deploy/testing verification.

## [Unreleased]

## [1.6.0] — 2026-06-02
### Changed
- **Daily briefing → broadcast-wire treatment** (design audit P2). The briefing
  is the product's synthesized lede; it now reads like one. The top-priority
  highlight renders as an enlarged **lead story** with a team-color rule, above a
  tighter **rundown** where each remaining line carries a small team-color chip,
  with a human **dateline** ("Tue · Jun 2 · around the league"). Previously a flat
  bullet list of equal-weight lines.
- `briefing-engine.js` now exposes the `teamId` behind each highlight (engine stays
  pure — no color/DOM concern); `briefing-llm.js` preserves it through the optional
  rephrasing path so the chips survive an LLM pass. League-wide lines (division
  race, slate size) correctly get a neutral chip.
- 2 new tests (teamId emitted + preserved). Suite now 63, green.

### Notes
- First implementation from the App 05 design audit (`Documents/Claude/Design Audits/`).
  Remaining audit recommendations (trend pulse, tabular numerals + run-diff spine,
  featured matchup card, quadrant chart instruments, dark unification) are tracked
  and queued.

## [1.5.3] — 2026-05-31
### Fixed
- **Trends chart still growing for some users after 1.5.2.** Two robustness gaps
  let the 1.5.2 fix be masked:
  - **Stale CSS cache** — `styles.css`/`app.js` were referenced without any
    cache-busting, so returning visitors kept running the *old* stylesheet (the
    HTML version marker updated, but the CSS fix didn't load). Asset URLs are now
    versioned (`styles.css?v=…`, `app.js?v=…`).
  - **`:has()` reliance** — the fixed-height rule depended on the CSS `:has()`
    selector. The four chart containers now carry an explicit
    `trends-body--chart` class, so the rule applies in every browser regardless
    of `:has()` support. Added a hard `max-height: 280px` cap as a final
    backstop so the canvas can never grow past its box.

## [1.5.2] — 2026-05-31
### Fixed
- **Infinitely-growing chart on the Trends tab.** The scatter/bar charts use
  Chart.js with `responsive: true` + `maintainAspectRatio: false` inside a flex
  body whose height was indeterminate, so the canvas height fed back into layout
  (collapse or unbounded growth — the classic Chart.js feedback loop). Chart
  bodies that contain a `<canvas>` now have a **definite height (280px)** with the
  canvas filling it absolutely, per Chart.js's documented container requirement.
  Table/heatmap bodies are unaffected (they keep `flex:1` and flow naturally).
- The Home-vs-Road logo strip is now rendered as a sibling **below** the chart
  body instead of inside it, so it no longer fights the canvas sizing.

## [1.5.1] — 2026-05-31
### Fixed
- **Oversized team logos on the Trends scatter charts** (RS-vs-RA, OPS-vs-ERA,
  Power-vs-Discipline). The MLB cap SVGs declare a `viewBox` but no intrinsic
  `width`/`height`, so a bare `Image()` defaulted to 150×150 — and Chart.js draws
  an image point-style at the image's own size (it ignores `pointRadius`). The
  preloaded marker images in `logo-helpers.js` are now pinned to 22×22, so the
  scatter markers render as small logos instead of overrunning the plot area.
  Inline DOM logos were unaffected (they already set explicit width/height).

## [1.5.0] — 2026-05-31
### Added
- **Optional LLM phrasing for the daily briefing** (Phase 4, `GAP-001`) — a
  **default-off** Cloudflare Worker (`server/briefing-worker.js`) that calls
  Anthropic Claude (Haiku) to reword the already-grounded briefing highlights,
  keeping the API key off the browser. Client enhancer `briefing-llm.js` posts the
  deterministic highlights and swaps in livelier wording **in place**, only when a
  `briefing-llm-endpoint` meta tag is set. The deterministic briefing remains the
  source of truth and stands on any failure.
- **Triple numeric guardrail** so the model can reword but never fabricate a stat:
  system prompt + server-side `preservesNumbers()` + client-side re-check. Any
  reworded line that introduces a new number is rejected per-item.
- Optional KV daily-cache in the worker (briefing is identical for all visitors on
  a day → ~1 model call/day at any scale).
- `server/wrangler.toml`, `server/README.md` (deploy runbook), and
  `docs/intelligence/AI_STACK.md` (Layer-4 architecture + cost model).
- `tests/briefing-llm.test.js` — 16 cases (number extraction/guard, per-item
  fallback on fabrication, endpoint resolution, injected-fetch paths). Suite 61, green.

### Notes
- **No behavior change by default**: with the meta tag empty there is zero network
  call and the dashboard is identical to v1.4.0. Enabling requires deploying the
  worker with your own `ANTHROPIC_API_KEY` (never committed) and setting the endpoint.
- The static GitHub Pages site is unchanged; the worker is a separate, optional deploy.

## [1.4.0] — 2026-05-31
### Added
- **Chart explainers** (`OPP-003`) — `trends-explainers.js`, pure helpers that add
  a data-driven "Today:" caption under four Trends-tab charts, naming who's
  actually at the extremes right now: RS-vs-RA (best/worst run differential),
  OPS-vs-ERA (elite-on-both or separate bat/arm leaders), Home-vs-Road (biggest
  home edge or road-warrior fallback), Power-vs-Discipline (HR + K/BB leaders,
  combined when one team leads both). Captions update live with the league/
  division filters and degrade to nothing when a filtered set lacks the stat.
- `tests/trends-explainers.test.js` — 11 cases (extremes, elite-on-both, combined
  power/command, road fallback, empty-data, deterministic id tiebreak). Suite 45, green.

### Changed
- `trends-charts.js` injects the captions via a new `setExplainer()` helper inside
  each chart's render path (so they refresh on filter changes).

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
