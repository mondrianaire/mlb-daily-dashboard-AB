# IMPLEMENTATION_ROADMAP — MLB Daily Dashboard

## Status — evaluated 2026-06-02 (live v1.16.0)

**Visual roadmap:** [`roadmap.html`](./roadmap.html) (open in a browser).

The original checkpoint roadmap below is **fully delivered**, plus a design audit, a live-score feature, a deliberate simplification, and a quick-win batch. Snapshot:

| Track | Status |
|---|---|
| **Original roadmap** (Phases 0–4 below) | ✅ all delivered — foundation + tests, watchability ranker, briefing, chart explainers, and the (later-removed) optional LLM backend |
| **Stability fixes** | ✅ chart logo size, infinite-growth, cache-busting (v1.5.1–1.5.3) |
| **Design audit — App 05 (P1–P6)** | ✅ all five findings shipped (v1.6–1.11): briefing wire, trend pulse + run-diff spine, featured matchup, quadrant chart instruments, dark unification |
| **Live scoreboard** | ✅ auto-refreshing in-game scores (v1.9) |
| **Resilience / telemetry / memory** | ✅ network-first cache (RISK-001), local telemetry (GAP-003), day-over-day memory (GAP-002) — v1.12–1.14 |
| **Simplification** | ✅ removed the LLM/Cloudflare backend → purely static (v1.15); `GAP-001` → **wontfix** by choice |
| **Quick wins** | ✅ favorites, probable starters, magic numbers, multi-day trend, installable PWA (v1.16) |

**Ledger:** 25 findings — 18 resolved · 3 in-progress (mitigated/opt-in: GAP-002 memory, GAP-003 telemetry, RISK-001 API) · 3 open (2 standing **assets** + 1 **guardrail**, none are work) · 1 wontfix. **92 tests, 0 fail. 18 PRs merged.**

**Next — bigger bets (optional depth; nothing is required):**
1. **Game box-score detail** — line score by inning, team lines, scoring plays · *Impact High · ~1 day*
2. **Player leaders** — HR / AVG / ERA / K / SB leaderboards · *Impact Med-High · ~½–1 day*
3. **Accessibility + mobile pass** — keyboard nav, ARIA, contrast/touch · *Impact Med · ~½–1 day*
4. **PNG app icons** — install fidelity on older Android · *Impact Low · ~1 hr*

**Deliberately not building:** an LLM/serverless backend (static by choice — `GAP-001` wontfix), predictive odds (`RISK-002` guardrail), real push notifications (needs a backend).

---

## Original plan (delivered) — preserved below for the record

> Sequenced build plan derived from `FEATURE_SCORES.md` + `AI_OPPORTUNITIES.md`. Ordered by **fit ÷ effort ÷ dependency**. Grounded at commit `b4c1e6c`. Every step names the real files it touches.
>
> Guiding constraint (from the checkpoint): the **highest-value near-term work needs no backend and no AI vendor** — it's deterministic interpretation of data the app already fetches into `dailyFetchCache` (app.js:79). Phases 1–3 honor that. Phase 4 is the only one that takes on infrastructure, and it's explicitly opt-in.

## Design principles (respect the existing codebase)

1. **Match the established idioms.** Pure computation → a new `*-engine.js` module (like `rankings-engine.js`, `trends-engine.js`): no DOM, no HTTP, deterministic. Rendering → functions inside `app.js`, the only DOM-touching module (app.js:3).
2. **No new fetches in Phases 1–3.** Reuse `dailyFetchCache.{teams,standings,schedule,recentResults}` and the already-computed `rankings`/`trends` from `init()` (app.js:68–93).
3. **Zero-dependency, zero-build stays true.** New code is plain ES modules. Tests use Node's built-in `node:test` (no npm dependency added).
4. **Ship deterministic first, AI-phrase later.** Template versions are the product; LLM is a phrasing upgrade gated on a backend.

---

## Phase 0 — Foundation & safety net  *(effort: S · do this first)*

Rationale: we're about to add two pure engines; stand up the test harness now so every engine ships verified. Also resolves `GAP-004` cheaply.

| Step | File(s) | Detail | Acceptance |
|------|---------|--------|------------|
| 0.1 Add test runner | `package.json` (new, dev-only) or none | Use `node --test`; add a `"test": "node --test"` script. No runtime deps. | `node --test` runs green locally |
| 0.2 Backfill engine tests | `tests/rankings-engine.test.js`, `tests/trends-engine.test.js` | Unit-test existing pure engines against fixture standings/results (division split, wild-card exclusion of leaders, streak/run-diff math). | Both engines covered; `GAP-004` → in-progress |
| 0.3 Add CHANGELOG | `CHANGELOG.md` (root) | Per CLAUDE.md product-life guidance — start tracking post-fork changes. | File exists with an "Unreleased" section |

**Closes/advances:** `GAP-004` (tests), sets up clean verification for Phases 1–2.

---

## Phase 1 — OPP-001: "Who should I watch tonight?" ranker  *(Fit 7/10 · effort: M · no backend)*

The highest-feasibility recommendation: deterministic, all inputs already in memory, answers a real daily question.

### Build
| Step | File(s) | Detail |
|------|---------|--------|
| 1.1 Watchability engine | `watchability-engine.js` (new, pure) | Export `computeWatchability({ schedule, trends, rankings, today })` → returns the schedule annotated with a `watchScore` (0–100) and a `reasons[]` string array, plus the top-N gameIds. **No DOM, no fetch.** |
| 1.2 Scoring model | same | Combine signals from existing view-models: (a) **team form** — both teams' `runDiff7` + `last7W/L` from `trends`; (b) **stakes** — small `gb` near a division top or wild-card cut line from `rankings.divisionStandings` / `rankings.wildCard` (rankings-engine.js:67); (c) **streak heat** — `trend.streak` magnitude; (d) **divisional-matchup bonus** — both teams share league+division (`teams.js` meta). Weight stakes + form highest; document weights in-file. |
| 1.3 Tonight filter | same | Filter the 7-day `schedule` (app.js:71) to games whose `gameDate` is today (reuse `DateUtil.todayISO`, data-client.js:304). |
| 1.4 Render badges | `app.js` `renderUpcoming` (app.js:313) + `renderGameRow` (app.js:349) | Badge the top 1–3 games with a "⭐ Top game" pill and a one-line `reasons[0]` (e.g. "Tight NL West race · both teams hot"). Sort tonight's group so badged games lead. |
| 1.5 Styles | `styles.css` | `.watch-badge` pill using existing team-color tokens; keep it subtle. |
| 1.6 Tests | `tests/watchability-engine.test.js` | Fixture: two contrived schedules → assert ranking order + reason strings are deterministic. |

### Integration point
In `init()` (app.js:91–94), after `rankings`/`trends` are computed, call `computeWatchability(...)` and pass results into `renderUpcoming`. No change to the fetch path.

### Acceptance criteria
- Top 1–3 tonight games badged with a human-readable reason.
- Engine is pure + unit-tested; zero new network calls (verify in devtools Network tab — count unchanged vs baseline).
- Off-season / no-games-tonight → panel falls back to the existing "No games scheduled" empty state (app.js:320). **No badge, no error.**

**Closes/advances:** `OPP-001` → in-progress/resolved.

---

## Phase 2 — OPP-002 (template): AI Daily Briefing, deterministic  *(Fit 7/10 · effort: M · no backend)*

A short plain-language "today around the league" block at the top of the Daily tab. Template/rules version — `$0`, no vendor.

### Build
| Step | File(s) | Detail |
|------|---------|--------|
| 2.1 Briefing engine | `briefing-engine.js` (new, pure) | Export `computeBriefing({ rankings, trends, schedule, today })` → returns an ordered `highlights[]` of `{ text, kind }`. **No DOM, no fetch.** |
| 2.2 Rules | same | Deterministic thresholds over existing data: longest active win/loss streak (`trend.streak`); biggest division lead (max `gb` gap at a division top); hottest team by `runDiff7`; closest race (smallest non-zero `gb` among 2nd-place teams); count of sub-.500 teams playing tonight (`schedule` ∩ `rankings`). Emit 3–5 sentences, most interesting first. |
| 2.3 Markup slot | `index.html` | New `<section id="briefing" class="briefing" aria-live="polite">` directly above `.dashboard-grid` (index.html:38), inside `#tab-daily`. |
| 2.4 Render | `app.js` new `renderBriefing(highlights)` | Populate `#briefing`; reuse `escapeHtml` (app.js:483). Wire into `init()` after compute. Loading/empty states mirror the existing `setPanelLoading`/`setPanelEmpty` pattern (app.js:415). |
| 2.5 Styles | `styles.css` | `.briefing` card matching the existing panel aesthetic. |
| 2.6 Tests | `tests/briefing-engine.test.js` | Fixtures → assert sentence selection + ordering are deterministic. |

### Acceptance criteria
- 3–5 grounded sentences render above the Daily grid on load.
- Every sentence is traceable to a real number on the page (no invented stats — the cardinal rule for a stats product).
- Degrades gracefully when data is sparse (off-season): fewer sentences, never a fabricated one.

**Closes/advances:** `OPP-002` (template path) → in-progress/resolved.

---

## Phase 3 — OPP-003: Plain-language chart explainers  *(Fit 5/10 · effort: S · no backend)*

Cheap polish. Replace the *static* widget descriptions (index.html:86–123) with today's actual standouts.

| Step | File(s) | Detail |
|------|---------|--------|
| 3.1 Explainer helper | `trends-charts.js` | Small pure helper that, per widget, picks the axis max/min from the already-built `MLB_DATA` merged records (`buildMergedData` trends-charts.js:44) and fills a sentence ("Top-right: Braves; bottom-left: White Sox"). |
| 3.2 Inject captions | `trends-charts.js` render fns (`renderRSRA`, `renderOpsEra`, `renderPowerDisc`, etc.) | Write the dynamic caption into each card's `.desc` node after render. |
| 3.3 Style | `styles.css` | Distinguish dynamic caption from the static description (e.g. a "Today:" prefix). |

**Acceptance:** each Trends widget shows a today-specific standout line; no new data fetched.
**Closes/advances:** `OPP-003`.

---

## Phase 4 — Backend enablement + LLM upgrades  *(opt-in · effort: L · resolves GAP-001)*

**Only do this if you want richer natural-language phrasing or scoped Q&A.** Phases 1–3 already deliver the grounded value without it. This phase trades the zero-infra property for AI phrasing.

| Step | Detail |
|------|--------|
| 4.1 Serverless proxy | Add a single serverless function (Cloudflare Worker / Vercel / Netlify function) that holds the model API key and exposes one POST endpoint. **Resolves `GAP-001`.** Keep the static site on Pages; the function is a separate small deploy. |
| 4.2 OPP-002 LLM upgrade | Send the Phase-2 `highlights[]` (already grounded numbers) to the model for *phrasing only* — never let it invent stats. The deterministic engine remains the source of truth and the fallback if the proxy is down. |
| 4.3 OPP-004 (Q&A) — reassess first | Still scored 4/10 (high widget overlap + gimmick risk). **Do not build on spec.** Gate on real demand, which needs telemetry (`GAP-003`) to measure. Revisit only with evidence. |

**Hard guardrail (from `RISK-002`):** the model phrases pre-computed truths; it does not generate numbers. A wrong stat discredits the whole product.

---

## Cross-cutting / prerequisite work (surfaced, not scheduled)

These are findings worth addressing but not blocking the above:

- `RISK-001` — single-point dependency on the public MLB API. Consider a thin response cache (sessionStorage/short TTL) so a transient API blip doesn't blank the page. Small, improves resilience; candidate to fold into Phase 0.
- `GAP-003` — no telemetry. A privacy-light event counter would unlock evidence-based prioritization (and is the precondition for ever justifying `OPP-004`). Not required for Phases 1–3.

---

## Sequencing summary

```
Phase 0 (S)  Foundation: tests + changelog        → verifies everything after
   ↓
Phase 1 (M)  OPP-001 Watchability ranker          → ship first; no backend, highest feasibility
   ↓
Phase 2 (M)  OPP-002 Daily briefing (template)    → no backend, high value
   ↓
Phase 3 (S)  OPP-003 Chart explainers             → cheap polish
   ↓
Phase 4 (L)  [OPT-IN] Backend + LLM phrasing       → only for richer NL; resolves GAP-001
                                                     OPP-004 stays deferred pending telemetry
```

**Recommended start:** Phase 0 → Phase 1. Both are low-risk, fully grounded, and need no infrastructure decisions. Phase 1 alone delivers a visible, genuinely useful feature ("what's the good game tonight") on the existing static deploy.

## Tracking linkage

Building these transitions ledger findings: `OPP-001`/`OPP-002`/`OPP-003` → in-progress→resolved; `GAP-004` → resolved (Phase 0); `GAP-001` → resolved only if Phase 4 is taken. Re-run the checkpoint after each phase to move the dashboard.
