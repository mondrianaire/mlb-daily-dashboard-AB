# PRODUCT_GRAPH — MLB Daily Dashboard

> Layer 2 (Product Intelligence Graph). Grounded at commit `b4c1e6c`. The "entities" here are **external API resources + computed view-models**, not owned DB tables — because the product owns no database. That distinction is the most important fact on this page.

## The data-flow graph (what relates to what)

There is no schema with foreign keys, so the graph is the **fetch → normalize → compute → render** pipeline. Edges are function calls; the "volume" on each node is per-load, not accumulated.

```
            MLB Stats API (statsapi.mlb.com)          MLB Static CDN
                     │                                      │
   ┌─────────────────┼──────────────────┐                  │ (logos)
   ▼                 ▼                  ▼                   ▼
 /teams         /standings         /schedule          team-logos/*.svg
   │                 │            /teams/stats              │
   ▼                 ▼                  ▼                   ▼
 fetchTeams()  fetchStandings()  fetchSchedule()      logo-helpers.js
   │            fetchStandings    fetchRecentResults   (preload+cache)
   │                 │            fetchCompletedGames14d    │
   │                 │            fetchTeam*Stats           │
   ▼                 ▼                  ▼                   │
 teams[30]  ── computeRankings() ── computeWeeklyTrends()   │
   │          (rankings-engine)    (trends-engine)          │
   │                 │                  │                   │
   └────────┬────────┴───────┬──────────┘                   │
            ▼                 ▼                              │
       Daily tab        Trends tab ◄───── Chart.js (lazy) ──┘
       (app.js)         (trends-charts.js, 7 widgets)
```

### Nodes (entity = API resource → normalized view-model)

| Node | What it is | Volume signal | Actions on it | Manual decision around it |
|------|-----------|---------------|---------------|---------------------------|
| **Team** | 1 of 30 MLB franchises | Fixed 30; static map in `teams.js` | merged with API metadata (`fetchTeams` data-client.js:86) | none (reference data) |
| **StandingEntry** | a team's W/L/PCT/GB + RS/RA/streak | 30 per load | `computeRankings` → division/league/wildcard (rankings-engine.js:35) | *user* mentally interprets "is this team good" |
| **ScheduleEntry / Game** | one game (teams, date, status, score) | ~15–80 per load (7-day window) | grouped by date, rendered (`renderUpcoming` app.js:313) | *user* decides which game matters to them |
| **GameResult** | a completed game from team's view (isWin, RS, RA) | ~7 per team last-7d; ~14d for heatmap | `computeWeeklyTrends` (trends-engine.js:29) | *user* infers momentum from sparkline |
| **HittingStats / PitchingStats** | season aggregate per team | 30 each per Trends load | merged in `buildMergedData` (trends-charts.js:44) | *user* compares teams across quadrant charts |
| **Trend** | computed: last7 W/L, runDiff7, streak, sparklinePoints | 30 per load | rendered as rows (`renderTrends` app.js:195) | *user* judges "hot/cold" |

**Critical observation:** every "manual decision" in the right column is **the human reading and interpreting** — there is no manual *operational* decision (no status to update, no record to triage, no content to author). This confirms the Layer 1 read: the only place intelligence can add value is in **interpreting the live numbers for the user**, not in automating an internal workflow.

## Capability map

### Existing capabilities (verified in code, with maturity)

| Capability | Maturity | Evidence |
|------------|----------|----------|
| Live standings (division + league + wild-card) | ✅ Shipped | `computeRankings` rankings-engine.js:35; `renderRankings` app.js:113 |
| Weekly trend rollups (W/L, run diff, streak) | ✅ Shipped | `computeWeeklyTrends` trends-engine.js:29 |
| Inline SVG sparklines per team | ✅ Shipped | `renderSparkline` app.js:259 |
| Upcoming-schedule view (7-day, grouped) | ✅ Shipped | `renderUpcoming` app.js:313 |
| Advanced analytics tab (7 Chart.js widgets) | ✅ Shipped | `trends-charts.js`; manifest.json:63 |
| League/division filtering (Trends) | ✅ Shipped | filter chips index.html:64; `wireFilterChips` |
| Resilient loading/error/empty states + retry | ✅ Shipped | `setPanelLoading`/`showError` app.js:415–449 |
| Typed network error handling | ✅ Shipped | `DataClientError` data-client.js:25; `StatsClientError` stats-client.js:21 |
| 30-team integrity guarantee (partial-API tolerant) | ✅ Shipped | `ALL_TEAM_IDS` fill in `fetchTeams` data-client.js:96 |
| Official team logos + brand colors | ✅ Shipped | `logo-helpers.js`; `teams.js` color map |
| Lazy CDN loading (Chart.js on demand) | ✅ Shipped | `loadChartJs` app.js:497 |
| Dynamic current-season (no annual rot) | ✅ Shipped | `currentSeason()` data-client.js:20 |
| Accessibility scaffolding (ARIA tabs/roles) | ✅ Shipped (basic) | `role="tablist"`/`aria-selected` index.html:23–30 |

### Missing capabilities (the opportunity surface — *missing ≠ should-build*)

| Missing | Note |
|---------|------|
| Any backend / serverless function | Hard prerequisite for safe LLM/API-key use |
| Data persistence / historical accumulation | No DB; no day-over-day memory |
| User accounts / favorites / personalization | No auth, no per-user state |
| Telemetry / analytics | No signal on what users view |
| Natural-language summaries of the data | No generative surface |
| Semantic search / Q&A over the data | No RAG; no corpus |
| Predictive models (game/playoff odds) | No training data owned; would lean on API or external models |
| Notifications / push (game alerts) | No push layer; pull-only |
| Player-level depth (only team-level today) | Stats are team aggregates only |
| Multi-season / historical browsing | Single current season only |
| Caching across loads (refetches everything) | `dailyFetchCache` is per-session only |
| Automated tests | None in repo |
| PWA / installability | `manifest.json` here is a build manifest, **not** a web-app manifest |

## Where leverage actually sits

The high-value edge in this graph is **`StandingEntry`/`Trend`/`Stats` → the user's interpretation**. Today the product renders the numbers and stops; the human does all the synthesis ("who's hot, who should I watch, what does this chart mean"). That interpretation gap — not any internal automation — is the only place AI can honestly 10x this product. Layer 3 scores those ideas against the hard constraint that there is **no backend and no owned data** to build on.
