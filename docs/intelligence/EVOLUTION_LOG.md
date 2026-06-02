# EVOLUTION_LOG — MLB Daily Dashboard

> Append-only memory of every product-intelligence run. Never overwrite; each run adds an entry. This is the longitudinal record.

---

## 2026-05-31 · commit `b4c1e6c` · BASELINE CHECKPOINT

**Mode:** analyze-product + generate-ai-features + tracking baseline (first run).

**Git-history read:** This is the promotion commit — the repo's first and only commit, forked from AutoBuilder at ratification. No product-life history yet; this entry establishes the zero point against which all future runs measure movement.

**What was established:**
- Layer 1–2 docs: `PROJECT_SUMMARY.md`, `PRODUCT_GRAPH.md`
- Layer 3 docs: `AI_OPPORTUNITIES.md`, `FEATURE_SCORES.md`
- Scores: `MATURITY_SCORECARD.md`
- Tracking ledger seeded: 11 findings (3 opportunities, 4 gaps, 2 risks, 2 assets)
- First snapshot + generated `dashboard.html`
- **Action plan:** `IMPLEMENTATION_ROADMAP.md` — sequenced Phases 0–4, grounded to real files. Phases 1–3 (the top wins) need no backend/AI vendor; Phase 4 (backend + LLM phrasing) is opt-in and resolves `GAP-001`. Recommended start: Phase 0 → Phase 1.

**Headline reads (all grounded at `b4c1e6c`):**
- **Domain:** Sports-analytics spectator dashboard (High confidence). Vanilla-JS static site, no backend, no DB, no auth, no build step.
- **AI Readiness: 18/100 (Low).** Not a code-quality problem — a foundations problem (owns no data, no telemetry, no backend). The clean layered architecture (`ASSET-001`) is the bright spot and makes future extension cheap.
- **Behavioral profile:** few signals present → conservative posture. The only honest AI footing is **interpreting already-fetched live data for the user** (Generative + Intelligence categories), not automating an owned workflow (there isn't one).
- **Top recommendations (both need no AI vendor / no backend):** `OPP-001` watchability ranker (Fit 7) and `OPP-002` template daily briefing (Fit 7). Deferred the LLM Q&A (`OPP-004`-class idea, scored 4) on gimmick-risk + backend dependency.
- **Key constraints logged as findings:** `GAP-001` no backend (blocks keyed AI), `GAP-002` no persistence (no predictive training data), `RISK-001` single-point dependency on the public MLB API, `RISK-002` predictive-odds-as-gimmick guardrail.

---

## 2026-05-31 · build progress · Phase 0 + Phase 1 shipped

**Mode:** implement (roadmap execution), with tracking reconciliation.

**Phase 0 — Foundation (v1.1.0):**
- Public version marker `#app-version` in the footer (static HTML + `data-version` + `window.__APP_VERSION__`) for deploy/test verification.
- `node:test` harness (`npm test`, zero runtime deps), `CHANGELOG.md`, and backfilled unit tests for `rankings-engine` + `trends-engine` (15 cases).

**Phase 1 — OPP-001 Watchability ranker (v1.2.0):**
- New pure `watchability-engine.js`: scores tonight's games from in-memory data (form/quality/stakes/streak + division bonus); top 3 badged with plain-language reasons, sorted to lead their day.
- Wired into `app.js` `renderUpcoming`/`renderGameRow`; gold theme tokens added (light + dark).
- 8 engine tests added → **suite 23 green**. Verified in-browser via mocked fetch (3 of 4 games badged, marquee NYY@BOS leads, plain row un-badged, gold styling confirmed via computed styles).

**Ledger movement (snapshot #2):**
- `OPP-001` open → **resolved** (built + tested + browser-verified).
- `GAP-004` open → in-progress → **resolved** (all 3 pure engines covered).
- Counts: open 11 → 9, resolved 0 → 2.
- Scores nudged on real evidence: `maturity_product` 7 → 8 (feature completeness + first tests), `maturity_differentiation` 3 → 4 (a genuinely useful, non-commodity surface), `ai_readiness` 18 → 22 (more clean, tested, extensible compute). Other dims unchanged — honestly, no backend/monetization/enterprise work was done.

**Still true (not yet addressed):** `GAP-001` (no backend), `GAP-002` (no persistence), `GAP-003` (no telemetry), `RISK-001` (single-point API dependency) all remain open. `OPP-001`'s value is real but the moat is unchanged — the ranking math is replicable.

---

## 2026-05-31 · build progress · Phase 2 shipped

**Mode:** implement (roadmap execution), with tracking reconciliation.

**Phase 2 — OPP-002 Daily Briefing, template version (v1.3.0):**
- New pure `briefing-engine.js`: rule-based, produces 3–5 grounded "Today around the league" highlights (best record, hot streak, best weekly run diff, tightest race, biggest lead, skid, slate size) with team de-duplication and singular/plural correctness. Never fabricates a stat — empty trends → no streak/rundiff lines.
- New `#briefing` card atop the Daily tab; `renderBriefing()` in app.js; hides itself when nothing is noteworthy or on failed load. Navy-accent card styling (light + dark).
- 10 engine tests added → **suite 33 green**. Verified in-browser via mocked fetch (full pipeline): 5 highlights rendered, all traceable to real numbers; styling confirmed via computed styles.

**Ledger movement (snapshot #3):**
- `OPP-002` open → **resolved** (template built + tested + browser-verified).
- Counts: open 9 → 8, resolved 2 → 3.
- Scores: `maturity_ai` 2 → 3 and `maturity_differentiation` 4 → 5 (two genuinely useful interpretive surfaces now shipped), `ai_readiness` 22 → 24 (more clean tested compute). No backend/monetization/enterprise movement — none was done.

**Roadmap status:** Phases 0, 1, 2 complete. Remaining: Phase 3 (chart explainers, `OPP-003`, optional polish) and Phase 4 (backend + LLM, opt-in, would resolve `GAP-001`). The two highest-value recommendations (`OPP-001`, `OPP-002`) are both shipped — backend-free, as predicted.

---

## 2026-05-31 · build progress · shipped to PR + Phase 3

**Mode:** ship + implement, with tracking reconciliation.

**Shipped:** Phases 0–2 committed to branch `claude/thirsty-cori-10c801` (two commits: docs checkpoint + feature code) and opened as **PR #1** to `main`.

**Phase 3 — OPP-003 Chart explainers (v1.4.0):**
- New pure `trends-explainers.js`: data-driven "Today:" captions for the 4 analytical charts (RS-vs-RA, OPS-vs-ERA, home/road, power/discipline), naming the current extremes; combined phrasing when one team leads both dimensions; graceful empty-data handling.
- `trends-charts.js` injects via `setExplainer()` inside each render path, so captions refresh with the league/division filters.
- 11 engine tests → **suite 45 green**. Verified in-browser with a stubbed Chart.js (CDN blocked in sandbox): all 4 captions render with correct leaders + accent styling.

**Ledger movement (snapshot #4):**
- `OPP-003` open → **resolved**. Counts: open 8 → 7, resolved 3 → 4.
- `ai_readiness` 24 → 25 (more clean tested compute); other dims unchanged — this was polish, not a capability shift.

**Roadmap status:** Phases 0–3 complete. **All three near-term opportunities (`OPP-001/002/003`) shipped, every one backend-free.** Only Phase 4 (backend + LLM, opt-in, resolves `GAP-001`) remains, alongside the still-open infra gaps (`GAP-001/002/003`) and `RISK-001`.

---

## 2026-05-31 · build progress · PR #1 merged + Phase 4

**Mode:** merge + implement, with tracking reconciliation.

**Merged:** PR #1 (Phases 0–3) merged to `main` (`9376a2e`). New work continues on `claude/phase4-briefing-llm` off updated `main`.

**Phase 4 — optional LLM phrasing for the daily briefing (v1.5.0), host: Cloudflare Workers, model: Anthropic Claude Haiku:**
- `server/briefing-worker.js` — default-off Worker that rewords the grounded highlights; key held as a Wrangler secret (never in repo/browser). Optional KV daily-cache.
- `briefing-llm.js` — client enhancer; posts highlights, swaps reworded text in place, falls back to deterministic on any failure.
- **Triple numeric guardrail** (system prompt + server `preservesNumbers` + client re-check) so the model can reword but never fabricate a stat (`RISK-002`).
- `server/wrangler.toml`, `server/README.md` (runbook), `docs/intelligence/AI_STACK.md` (Layer-4 architecture + cost model — headline: KV cache collapses cost to ~1 model call/day at any scale).
- 16 tests → **suite 61 green**. Browser-verified both paths: OFF = zero network/identical to v1.4.0; ON = worker called once, text swapped in place, numbers preserved.

**Ledger movement (snapshot #5):**
- `GAP-001` open → **in-progress** (a deployable backend path now exists; not resolved because it's default-off and undeployed — needs the owner's Cloudflare account + ANTHROPIC_API_KEY).
- `OPP-002` stays resolved, with a note that its optional LLM upgrade now exists.
- Counts: open 7 → 6, in-progress 0 → 1, resolved 4.
- Scores: `ai_readiness` 25 → 38 (a real LLM surface + backend path now exist, behind clean guardrails), `maturity_ai` 3 → 5, `maturity_differentiation` 5 → 6 (the triple no-fabrication guard is a genuinely thoughtful, less-common touch). `maturity_infra` held at 8 — the worker is optional and separate; the static site is unchanged.

**Honest status:** the feature is *built and safe* but *not active*. By default the product behaves exactly as v1.4.0. Real activation is a deliberate owner decision (deploy + key + cost), which is correct — Phase 4 was always the opt-in one. Remaining open: `GAP-002` (persistence), `GAP-003` (telemetry), `RISK-001` (single-point API dependency), `RISK-002` (guardrail, now reinforced in code).

---

## 2026-06-02 · design audit → first implementation (v1.6.0)

**Mode:** design audit (external, telos-only) → engineering implementation.

A standalone **design audit** (App 05 in the user's `Documents/Claude/Design Audits` system) critiqued the live dashboard in design language only — no code read, no code output. Five findings: trends hidden behind a tab; light/dark register split between tabs; **briefing dressed as a footnote**; numerals without tabular rhythm or a run-diff spine; quadrant charts that aren't self-explaining instruments. Deliverable styled in the project's own dark "instrument" register (R2).

**First implementation — P2 (briefing broadcast-wire), v1.6.0:**
- The briefing is the product's synthesized lede; it now renders as one — enlarged lead story with a team-color rule, a dateline, and a team-chip rundown (neutral chips for league-wide lines).
- `briefing-engine.js` exposes `teamId` per highlight (stays pure); `briefing-llm.js` preserves it through the optional rephrasing path. 63 tests green; browser-verified.
- Tracked as `OPP-005` (resolved). `maturity_product` 8 → 9 (the lede now matches its informational weight).

**Decisions logged for the remaining audit work:** dark unification (P1) will ship as a light/dark **toggle defaulting to dark**, deferred to last. Queue: trend pulse (P3), tabular numerals + run-diff spine (P4), featured matchup card (P6), quadrant chart instruments (P5).

---

## 2026-06-02 · design audit fully implemented + live scores (v1.6.0 → v1.11.0)

All five App-05 design-audit findings are now shipped, plus a net-new live-score feature:

- **P2** (v1.6.0) — briefing broadcast-wire. `OPP-005`.
- **P3** (v1.7.0) — trend pulse on first contact. `OPP-006`.
- **P4** (v1.7.0) — tabular numerals + run-diff spine. `OPP-007`.
- **P6** (v1.8.0) — featured matchup hero card. `OPP-008`.
- **Live scoreboard** (v1.9.0, net-new user request) — auto-refreshing today's-games panel. `OPP-009`.
- **P5** (v1.10.0) — quadrant chart instruments (inline Chart.js plugin). `OPP-010`.
- **P1** (v1.11.0) — light/dark theme toggle, **default dark**, unifying the tabs. `OPP-011`.

Every increment shipped on its own branch → PR → merge → live, each verified in-browser and version-cache-busted. Engine logic stayed pure and tested throughout (suite grew 45 → 75). Ledger: **13 resolved**, scores moved on real evidence (`maturity_product` 8→9, `differentiation` 6→8, AI readiness held at 38 — no new AI foundations were added; these were UX/feature wins).

**Honest standing:** the still-open items are the structural ones the checkpoint named on day one — `GAP-001` (backend, in-progress/opt-in via the Phase-4 worker), `GAP-002` (persistence), `GAP-003` (telemetry), `RISK-001` (single-point MLB-API dependency, now exercised harder by live polling). The product is materially more useful and more coherent; the remaining work is infrastructure, not features.

---

## 2026-06-02 · simplification — removed the LLM/Cloudflare backend (v1.15.0)

Owner decision, and the right one: the product is **purely static** again. The only
thing that ever needed a server was the *optional* LLM rephrasing of the briefing —
over-engineered for a read-only dashboard that already refreshes itself live from the
MLB API on every page load (the API is the "database"; nothing to maintain).

Removed: `server/` (worker, wrangler.toml, deploy.mjs, runbook), `briefing-llm.js` +
tests, the CI deploy workflow, `AI_STACK.md`, the `briefing-llm-endpoint` meta tag,
the `deploy:briefing` script, and the client enhancement call. **No user-facing
change** — the deterministic briefing was always the source of truth and the LLM path
was default-off. Suite 97 → 80 (dropped the LLM-client tests), green.

Ledger: `GAP-001` (no backend) → **wontfix** — not an unmet gap, a deliberate
architecture stance. `OPP-002` stays resolved (deterministic briefing intact). Honest
score movement: `ai_readiness` 44 → 38 and `maturity_ai` 5 → 3, because we *removed*
the AI surface on purpose — the "smart" features are all deterministic interpretation,
not ML. The repo is leaner (16 client modules, zero server), which is a better fit for
what this is. If richer phrasing is ever wanted, the static-friendly path is a
build-time JSON precompute (scheduled CI → committed `briefing.json`), not a runtime
server.

**Notes for next run:**
- If a serverless proxy appears → re-score `OPP-002` LLM path and reconsider `GAP-001` toward resolved.
- If unit tests for `rankings-engine`/`trends-engine` land → transition `GAP-004`.
- If any telemetry is added → `GAP-003` moves; unlocks evidence-based reconsideration of personalization.
- Watch for off-season data sparseness affecting trend widgets (related to `RISK-001`).
