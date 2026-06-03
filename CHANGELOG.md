# Changelog

All notable changes to the MLB Daily Dashboard (product life) are recorded here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/); this project
uses semantic-ish versioning starting from the AutoBuilder promotion baseline.

The **canonical version string** lives in `index.html` at `#app-version`
(`data-version` attribute + visible text in the footer strip). Bump it here and
there together on every release — they are the single source of truth used for
deploy/testing verification.

## [Unreleased]

## [1.18.0] — 2026-06-02
### Changed — One register across both tabs (audit Finding 02 close-out)
- **Trends now follows the theme.** The Trends tab previously stayed dark in
  every mode, so switching the app to light mode left a navy island behind. The
  whole tab — standings table, leaderboard, heatmap, KPI strip, filter chips,
  and all Chart.js scatter/bar charts — now adopts a light "paper" palette under
  light mode and the original dark "instrument" palette under dark. Dark remains
  the default; light mode is fully available and now genuinely unified.
- Implemented purely with CSS custom properties: a `[data-theme="light"]
  .trends-surface` block mirrors the Daily light tokens, so every namespaced
  `--trends-*` value re-resolves on toggle. Chart.js axis/grid/label colors are
  read from those vars at render time (dark output is byte-identical to before —
  no regression), and the theme toggle re-renders the charts so they re-color
  live. Verified in-browser: dark `#0b1220/#e6edf7`, light `#eef1f5/#1a1d22`.

This resolves the last open item from the 2026-05-31 audit. Suite 92, green.

## [1.17.0] — 2026-06-02
### Fixed — Closing the 2026-05-31 design audit
- **Mobile Trends overflow (audit Finding 03 — the only true defect).** The
  Standings table carried 12 columns and clipped narrow viewports. On screens
  ≤640px it now collapses to a five-column glance set (Team / W / L / GB / Last 10),
  drops the long club name (abbreviation kept), and exposes a **"Show all columns"**
  tap-toggle that reveals the full table, which then scrolls horizontally inside
  its card instead of clipping. The 14-day heatmap gains a "scroll sideways"
  affordance; the Last-10 leaderboard columns tighten so its bar never overflows.
  Desktop is unchanged (all 12 columns, no toggle). Verified at 375px and 1280px.
- **Copy honesty (audit Finding 05).** The header no longer says "Last updated"
  (which implied a backend cadence the static page doesn't have) — it now reads
  **"Fetched HH:MM TZ on load"**, matching the footer's "Updates on every page
  load." Game start times across the scoreboard, upcoming games, and featured
  matchup now carry the viewer's local timezone label (e.g. "19:10 EDT") instead
  of an ambiguous bare time.

Audit status: Findings 01 (Today zone) and 04 (pin your team) were already
shipped; 03 and 05 close here; 02 (tab register) is a deliberate dark-direction
choice that diverges from this audit's light-register preference. Suite 92, green.

## [1.16.0] — 2026-06-02
### Added — Quick wins
- **Favorites / "My Team"** — a ★ toggle on each standings row marks favorite
  clubs (localStorage); favorites are highlighted everywhere they appear at once —
  standings, live scoreboard, upcoming games, and the featured matchup. New pure
  `favorites.js` (store + ordering) with 6 tests.
- **Probable starters** — upcoming games (and the featured matchup) now show the
  probable pitching matchup, e.g. "Cole vs Sale", via the schedule's
  `probablePitcher` hydrate. 2 tests.
- **Magic numbers** — division leaders show a clinch magic number ("MN 8") late
  in the season (gated so it's hidden when not yet meaningful), and "✓ Clinched"
  at zero. New pure `magicNumber` / `divisionMagic` in rankings-engine; 3 tests.
- **Multi-day position trend** — building on the daily standings snapshots, each
  team's run-differential trajectory is drawn as a small sparkline in the
  standings once ≥3 days are on record. `history-engine.teamSeries`; tests added.
- **Installable PWA + offline** — a web manifest, an SVG app icon, and a service
  worker that caches the app shell. Installable to a phone home screen and works
  offline after the first visit (the MLB API still goes to the network; the app's
  cache handles data resilience). Theme-color matches the dark default.

Suite now 92, green.

## [1.15.0] — 2026-06-02
### Removed
- **All LLM / Cloudflare scaffolding** — the dashboard is now purely static again.
  The serverless worker existed only to safely hold an API key for *optional*
  LLM rephrasing of the briefing; that's over-engineered for a read-only data
  dashboard that already refreshes itself live from the MLB API on every load.
  Deleted: `server/` (worker, `wrangler.toml`, deploy script, runbook),
  `briefing-llm.js` + its tests, the CI deploy workflow, `docs/intelligence/AI_STACK.md`,
  the `briefing-llm-endpoint` meta tag, the `deploy:briefing` npm script, and the
  client enhancement call.
- **No functional change.** The deterministic briefing is generated fresh on each
  load and remains the source of truth — exactly what was already showing, since
  the LLM path was default-off and never enabled. Suite trimmed to 80, green.

## [1.14.0] — 2026-06-02
### Added
- **Day-over-day memory** (`GAP-002`) — the dashboard now remembers. Each day's
  division standings are snapshotted to localStorage (rolling ~30 days), and
  today's standings are diffed against the most recent prior day to show **rank
  movement** (▲/▼N) next to each team in the Daily standings. Client-side only —
  no backend, no PII, per-browser. Deltas appear once there's a prior day on
  record (nothing on a brand-new visit, by design).
- New pure `history-engine.js` (`buildSnapshot` / `diffRanks` / `mostRecentBefore`)
  + injectable store, with 7 tests. Suite now 97, green.

## [1.13.0] — 2026-06-02
### Added
- **Privacy-light, default-off telemetry** (`GAP-003`). The app keeps **local
  per-feature counts** in localStorage — inspect them anytime with
  `window.__telemetry()` in the console — so there's finally a signal for *what
  gets used* (tab switches, theme choice, live-games seen). It is **off for the
  network by default**: no cookies, no PII, no fingerprinting, no requests. To
  enable aggregate analytics, point a `telemetry-endpoint` meta tag at a collector
  that accepts a tiny `{ e, t }` JSON beacon (sent via `navigator.sendBeacon`).
- New `telemetry.js` (injectable storage/beacon/clock) with 8 tests; wired to
  load, tab, theme, and live-scoreboard events. Suite now 90, green.

## [1.12.0] — 2026-06-02
### Added
- **API resilience — network-first cache with stale fallback** (`RISK-001`
  hardening). The dashboard depends on a single public API; a transient blip used
  to blank the page. Now every request tries the network first and caches
  successes (`sessionStorage`); when a fetch fails, the **last good response** is
  served (up to 6h old) instead of throwing — so live polling and reloads ride
  through hiccups. A quiet, auto-clearing **"showing the last loaded data —
  reconnecting…"** notice appears while degraded. A genuine first-load failure
  with nothing cached still shows the existing error banner + retry.
- New pure-ish `api-cache.js` (injectable storage + clock) with 7 tests; wired
  into both `data-client.js` and `stats-client.js`. Suite now 82, green.

## [1.11.0] — 2026-06-02
### Added
- **Light / dark theme toggle, default dark** (design audit P1, completes the audit).
  The product now defaults to the dark "instrument" register so the Daily and Trends
  tabs are unified out of the box (the previous OS-driven default could mismatch the
  always-dark Trends tab). A header toggle (☀ / ☾) flips light ↔ dark, the choice
  **persists** to `localStorage`, and a tiny head script applies it before first
  paint (no flash). `color-scheme` is set per theme for native controls/scrollbars.

### Changed
- Theme is now governed by an explicit `data-theme` attribute rather than
  `prefers-color-scheme`, so the user's toggle wins over the OS. Refactored the
  trend run-diff / streak colors onto the shared `--rd-pos` / `--rd-neg` tokens,
  removing the last per-component dark media queries.

### Notes
- The Trends tab's chart surface remains its dark instrument palette in both modes
  (its Chart.js colors are dark-tuned); light mode lightens the Daily chrome. With
  dark as the default, the tabs are unified for the common case.

## [1.10.0] — 2026-06-02
### Changed
- **Quadrant chart instruments** (design audit P5) — the Trends-tab scatter charts
  now explain their own meaning instead of leaning on the caption, via a small
  inline Chart.js plugin (no new dependency):
  - **OPS-vs-ERA** and **Power-vs-Discipline** gain a dashed **median crosshair**
    with the standout corner shaded green and labeled (`ELITE · BOTH SIDES`,
    `POWER + COMMAND`) and the opposite corner shaded red (`REBUILDING`).
  - **RS-vs-RA** shades the break-even diagonal — above it green (`OUTSCORING`),
    below it red (`OUTSCORED`).
- Fixed the RS-vs-RA caption, which described the diagonal backwards (above the
  diagonal is outscoring, not below).

## [1.9.0] — 2026-06-02
### Added
- **Live scoreboard** — a new "Today's games" section at the top of the Daily tab
  showing every game today with live scores and state: **in-progress games** show
  the running score, inning (Top/Bot/Mid), and outs with a pulsing live dot;
  **finals** show the final (and extra-inning marker, e.g. Final/11); **scheduled**
  games show first pitch. Games are ordered live → scheduled → final, and the
  leading team's score is emphasized.
- **Auto-refresh** — the scoreboard polls on its own loop (every **30s** while any
  game is live, **120s** otherwise) and stops when there are no games today. It
  runs independently of the main page load and degrades quietly on transient
  errors. A status line shows the live count and last-updated time.
- New `scoreboard-engine.js` (pure classify / state-description / ordering) with 7
  tests, and `data-client.fetchScoreboard()` (hydrates the linescore). Suite now 75, green.

## [1.8.0] — 2026-06-02
### Added
- **Featured matchup card** (design audit P6) — tonight's single most-watchable
  game (from the watchability ranker) is promoted to a **hero card** atop the
  Upcoming panel: enlarged team logos, each club's W–L record, the reason it's the
  pick, and first pitch. It's then **excluded from the day list** so it isn't shown
  twice; the remaining games keep their inline badges.

## [1.7.0] — 2026-06-02
### Added
- **Trend pulse on the Daily view** (design audit P3) — a compact two-card strip
  surfacing the week's **hottest** and **coldest** club (logo, last-7 record,
  sparkline, run differential) directly on first contact, so the product's
  namesake capability is visible in zero clicks. Backed by a new pure
  `pulse-engine.js` (`computePulse`) with deterministic hottest/coldest selection.
- **Run-differential spine** (design audit P4) — the Daily division standings gain
  a **Diff** column rendering run differential as a colored, tabular value with a
  small diverging bar; the Trends standings table's existing Diff column gains the
  same bar. Run diff is the truest form signal, now the table's visual spine.

### Changed
- **Tabular-lining numerals** across standings — numeric cells now use tabular
  figures (and a mono face on the division tables) so columns lock and a glance
  ranks the league.
- Shared `--rd-pos` / `--rd-neg` run-diff color tokens (light + dark).

### Tests
- 5 new `pulse-engine` cases (selection, ties, single-team, no-games). Suite now 68, green.

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
