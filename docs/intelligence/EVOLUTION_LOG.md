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

**Notes for next run:**
- If a serverless proxy appears → re-score `OPP-002` LLM path and reconsider `GAP-001` toward resolved.
- If unit tests for `rankings-engine`/`trends-engine` land → transition `GAP-004`.
- If any telemetry is added → `GAP-003` moves; unlocks evidence-based reconsideration of personalization.
- Watch for off-season data sparseness affecting trend widgets (related to `RISK-001`).
