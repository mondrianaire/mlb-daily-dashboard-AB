# PROJECT_SUMMARY — MLB Daily Dashboard

> Layer 1 (Repository Intelligence) baseline. Grounded in code at commit `b4c1e6c` (2026-05-31). Every claim cites a file.

## What it is (one line)

A zero-build, vanilla-JS **static web app** that renders a live daily snapshot of all 30 MLB teams — standings, weekly trends, upcoming schedule, and a Chart.js analytics tab — pulling entirely from the public MLB Stats API on each page load. No backend, no database, no auth, no build step.

## Technical stack (detected, not claimed)

| Layer | Finding | Evidence |
|-------|---------|----------|
| Frontend | Vanilla ES modules, no framework. Hand-rolled DOM rendering. | `app.js` is "the only module that touches the DOM" (app.js:3); `<script type="module" src="app.js">` (index.html:136) |
| Routing | None. Two in-page tabs (Daily / Trends) toggled via `hidden`. | `activateTab()` app.js:564 |
| State | Module-level globals; a `dailyFetchCache` object reused across tabs. | app.js:36, app.js:79 |
| Build | **None.** Static files served directly; `build_step_required: false`. | manifest.json:35 |
| Backend | **None.** Browser fetches the public API directly. | `API_BASE = "https://statsapi.mlb.com/api/v1"` (data-client.js:17) |
| Data store | **None.** No persistence; data is fetched fresh every load. | No DB/ORM anywhere; footer "Updates on every page load" (index.html:132) |
| Auth | **None.** Fully public, anonymous. | No auth code in repo |
| External services | MLB Stats API (data); MLB Static CDN (logos); jsDelivr CDN (Chart.js 4.4.0, lazy). | manifest.json:36–53 |
| Charting | Chart.js 4.4.0, **lazy-loaded** only on first Trends-tab open. | `CHART_JS_URL` app.js:495; `loadChartJs()` app.js:497 |
| Hosting | GitHub Pages (static). | README provenance; `static_only: true` manifest.json:34 |

**Dependency-as-capability read:** there are *no* package dependencies (no `package.json` in the deliverable). The only runtime imports are two CDN URLs. This is an honest signal that the product is a **thin, dependency-free presentation layer over a third-party API** — not a data-owning application.

## Module architecture (clean layering)

The codebase is unusually well-separated for its size — a documented layered architecture with inter-module "contracts" (manifest.json:54–61):

```
                 ┌─────────────┐
   index.html →  │   app.js    │  ui-render: the ONLY DOM-touching module
                 └──────┬──────┘
        ┌───────────────┼────────────────┬──────────────┐
   data-client.js  stats-client.js  rankings-engine.js  trends-engine.js
   (HTTP, no DOM)  (HTTP, no DOM)   (pure compute)      (pure compute)
        └───────────────┴───────┬────────┴──────────────┘
                            teams.js (static reference data: 30 teams)
                                │
              logo-helpers.js / trends-charts.js (view + assets)
```

- **Data layer** (HTTP only, typed errors, no DOM): `data-client.js`, `stats-client.js`
- **Compute layer** (pure, deterministic, no HTTP/DOM): `rankings-engine.js`, `trends-engine.js`
- **Reference data**: `teams.js` (hardcoded 30-team map: abbr, league, division, brand colors, logo URLs)
- **View layer** (DOM): `app.js` (Daily tab + orchestration), `trends-charts.js` (Trends tab, 7 widgets), `logo-helpers.js`

## What users actually do here (the core verbs)

Reading the rendered surfaces, the user can only **read and slice** — there is no write path:

1. **View standings** — division tables + AL/NL wild-card races (`renderRankings` app.js:113).
2. **Scan weekly trends** — per-team last-7-days W/L, run differential, streak, SVG sparkline (`renderTrends` app.js:195).
3. **Check upcoming games** — next 7 days grouped by date (`renderUpcoming` app.js:313).
4. **Explore analytics** — Trends tab: sortable standings, last-10 leaderboard, RS-vs-RA bubble map, OPS-vs-ERA scatter, home/road bars, power-vs-discipline scatter, 14-day W/L heatmap (`trends-charts.js`, 7 widgets per manifest.json:63).
5. **Filter the Trends view** by league/division via filter chips (`wireFilterChips`, index.html:64–76).
6. **Retry** on a failed load (error banner, app.js:429).

That's the whole interaction surface. **It is a single-user, read-only, anonymous dashboard.**

## Behavioral profile (Layer 1 classification)

| Property | Present? | Evidence / verdict |
|----------|----------|--------------------|
| Collaborative | ❌ No | No users, teams, sharing, or permissions anywhere |
| Workflow-heavy | ❌ No | No state machines, no multi-step user flows; one fetch→render pass |
| Data-rich (owns data) | ❌ No | Owns *zero* data; all data is third-party and ephemeral per load |
| Repetitive (automatable ops) | 🟡 Marginal | Only "repetition" is the user manually reloading for fresh data |
| Content-generating | ❌ No | No user-authored content of any kind |

**Conclusion:** Few behavioral signals are present. Per Layer 1 guidance ("Few ⇒ be conservative; don't manufacture opportunity"), this product has **Low intrinsic AI-automation potential in its current form** — and honesty here matters more than an exciting story. The AI opportunities that *do* exist (see `AI_OPPORTUNITIES.md`) are about **interpreting** the live data for the user, not automating an owned workflow, because there is no owned workflow or accumulated dataset to learn from.

## Domain classification

- **Domain:** Sports analytics / data-visualization dashboard (spectator-facing). **Confidence: High.**
- **Evidence:** MLB Stats API endpoints (`/standings`, `/schedule`, `/teams/stats`); baseball-specific compute (run differential, OPS vs ERA, K/BB, wild-card logic) in `rankings-engine.js` and `trends-charts.js`; 30 hardcoded MLB franchises in `teams.js`.
- **Sub-type:** Read-only "second-screen" companion dashboard, not a fantasy/betting/transactional product (no accounts, no picks, no money).

## Honest gaps that shape everything downstream

1. **No data ownership / no accumulation.** The single biggest constraint. Predictive AI (the highest-value sports-analytics category) normally needs historical data to train on; this app keeps none. Any forecasting would depend on the live API's historical endpoints or a new persistence layer.
2. **No telemetry.** Zero analytics/event tracking, so there is no signal about what users look at — which removes the usual basis for personalization/recommendations.
3. **No backend.** Any AI feature using an LLM/model API needs *somewhere* to hold a key and proxy calls; a pure GitHub-Pages static site cannot safely call a paid AI API client-side. This is an architectural prerequisite, not a detail.
4. **Single-season scope.** `currentSeason()` is `new Date().getFullYear()` (data-client.js:20) — the app shows only the current year; no historical browsing.

These gaps are not failures of the build (the build is clean and does exactly what was asked); they are the **boundary conditions** any AI/feature recommendation must respect to stay grounded.
