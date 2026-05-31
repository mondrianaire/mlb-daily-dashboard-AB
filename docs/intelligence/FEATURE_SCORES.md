# FEATURE_SCORES — MLB Daily Dashboard

> Strategic Fit scoring per `scoring-rubrics.md`. Sub-factors: Workflow improvement (0–4, weighted highest), Revenue (0–2), Retention (0–2), Feasibility (0–2), minus Gimmick risk (0 to −3). Grounded at commit `b4c1e6c`.

## Scored table (sorted by fit)

| # | Feature | Workflow (0–4) | Revenue (0–2) | Retention (0–2) | Feasibility (0–2) | Gimmick (−) | **Fit /10** |
|---|---------|:---:|:---:|:---:|:---:|:---:|:---:|
| B | "Who should I watch tonight?" ranker | 3 | 0 | 2 | 2 | 0 | **7** |
| A | AI Daily Briefing (template→LLM) | 3 | 0 | 2 | 2 | 0 | **7** |
| C | Plain-language chart explainers | 2 | 0 | 1 | 2 | 0 | **5** |
| D | Scoped NL Q&A ("Ask the dashboard") | 2 | 1 | 1 | 1 | −1 | **4** |

> Revenue is 0–1 across the board on purpose: this is a free, no-account, public hobby dashboard with **no billing code and no monetization surface** anywhere in the repo. Inventing an "AI tier" upsell would be a vapor tier — explicitly refused (see REVENUE note below).

## Per-feature rationale (sub-factor evidence)

### B — Watchability ranker · **7/10**
- **Workflow 3/4:** Replaces the manual eyeball-the-schedule decision (`renderUpcoming` app.js:333). Strong, but it's an enhancement to an existing view, not a new workflow — hence 3 not 4.
- **Retention 2/2:** "What's the good game tonight" is a *daily-return* reason — the exact loop a daily dashboard wants.
- **Feasibility 2/2:** All inputs already computed (`schedule`, `trends`, `rankings`); **no backend, no LLM, no new fetch.** Pure scoring function.
- **Gimmick 0:** Answers a real recurring question with correlated signals.
- **Workflow it improves:** choosing tonight's game to watch. **Evidence:** app.js:71/75 + rankings-engine.js:67.

### A — AI Daily Briefing · **7/10**
- **Workflow 3/4:** Replaces cross-panel manual synthesis on every visit. Capped at 3 because the data is already visible — it accelerates reading, doesn't unlock the impossible.
- **Retention 2/2:** A fresh narrative each day is a genuine return reason.
- **Feasibility 2/2** *for the template version* (no backend); the **LLM version drops to ~1** until a serverless key-proxy exists. Scored on the shippable template path.
- **Gimmick 0:** Summarizes data the page already holds — not decoration.
- **Workflow it improves:** "what happened around the league today." **Evidence:** `dailyFetchCache` app.js:79 holds standings+trends+schedule already.

### C — Chart explainers · **5/10**
- **Workflow 2/4:** The static widget descriptions (index.html:86–123) already orient the user; this adds *today's* names. Marginal.
- **Feasibility 2/2:** Template fill over `buildMergedData` (trends-charts.js:44); no dependency.
- **Gimmick 0:** but low ceiling. Good polish, not a headline.

### D — Scoped NL Q&A · **4/10**
- **Workflow 2/4:** Only helps when the question isn't already a widget — large overlap with the existing complete-ish UI shrinks the real gain.
- **Feasibility 1/2:** Needs backend + LLM + anti-hallucination guardrails (a stats product cannot afford a wrong number).
- **Gimmick −1:** Real risk of being "a chatbot because chatbots are cool." Deferred, not killed.

## Decision

**Build B and A (template) first — both score 7, both need no AI vendor and no backend.** They are the grounded wins. C is cheap polish. D waits for evidence (and telemetry, which doesn't exist yet).

## Revenue note (no vapor tiers)

There is **no monetization surface in this codebase** — no billing, no accounts, no plan gating. Per the rubric ("No upsell without a backing feature"), this checkpoint records **Monetization Potential: Low/None** for the product as-is. If the owner ever wanted revenue, the honest paths are *product changes first* (accounts → favorites → optional premium briefing/alerts), not an AI sticker on a static page. Captured as observation, not recommendation.
