# AI_OPPORTUNITIES — MLB Daily Dashboard

> Layer 3 (AI Opportunity Engine). Governing question for every idea: **"Does AI actually improve this workflow?"** Grounded at commit `b4c1e6c`.

## The honest framing first

This product **owns no data, has no backend, and has no user accounts.** That kills three of the usual high-value sports-analytics AI plays outright, and any reader should see that stated plainly:

- **Predictive AI (game/playoff odds)** — normally the crown jewel of sports analytics — has **no owned training data** here, and a credible model is a project unto itself. Bolting a half-baked "win probability" number onto a hobby dashboard would be a *gimmick that erodes trust the moment it's wrong.* ❌ Cut as a near-term feature.
- **Personalization / recommendations** — needs telemetry and accounts. Neither exists. ❌ Cut until those exist.
- **Conversational chatbot over the whole site** — the surface is two tabs and a dozen widgets; users are not lost. A chat box would be a chatbot shoved where none was needed. ❌ Cut (classic gimmick).

What *does* survive the workflow gate is narrow and real: the product renders numbers and makes the **human do all the interpretation**. AI that closes that interpretation gap — turning the already-fetched JSON into plain-language insight — genuinely improves the one workflow this product has (*"help me understand what today's data means"*). Everything below is judged against that, and against the **no-backend constraint** (anything calling a paid model API needs a serverless proxy first — noted as a dependency, never hand-waved).

## Category sweep (walked deliberately; most don't fit — that's the point)

| Category | Fits here? | Why / why not |
|----------|-----------|----------------|
| Predictive AI | ❌ Weak | No owned historical data; credible odds are out of scope and gimmicky if faked |
| Agentic AI | ❌ No | No multi-step workflow to automate; it's one fetch→render pass |
| Conversational AI | 🟡 Narrow | Only as a *scoped data Q&A*, not a general site chatbot |
| Generative AI | ✅ Best fit | Users would value plain-language summaries of standings/trends they currently read raw |
| Intelligence AI (ranking/NBA) | ✅ Fits | "Who should I watch tonight" is a real choice over many games, made manually today |
| Operational AI | ❌ No | No events/logs/ops burden (it's a static site) |
| Knowledge AI (RAG) | ❌ No | No document corpus to retrieve over |
| Collaborative AI | ❌ No | Single-user, no teams/sharing |

Only **Generative** and **Intelligence** categories have honest footing. Candidates below live there.

---

## Candidate features (each with the mandatory workflow + evidence lines)

### Feature A — AI Daily Briefing ("Today around the league")
- **Category:** Generative AI
- **Strategic Fit:** 7/10 (see FEATURE_SCORES.md for breakdown)
- **What it is:** A short, auto-generated natural-language summary at the top of the Daily tab — "The Dodgers extended their win streak to 6 and now lead the NL West by 4; three sub-.500 teams have winnable matchups tonight." Generated from the data *already fetched* (`dailyFetchCache`, app.js:79) — standings + trends + schedule — so it adds **zero new data fetches**.
- **Workflow improvement (the honest test):** Replaces the manual scan-and-synthesize the user does across three panels every visit. The data is already on the page; AI does the reading-and-summarizing the human does today.
- **Evidence in code:** `computeRankings` output + `computeWeeklyTrends` output + `fetchSchedule` results are all already assembled in `init()` (app.js:68–93). A briefing is a pure transform of data the app *already has in memory*.
- **Hard dependency:** needs a serverless proxy (e.g. a Cloudflare/Vercel function) to hold the model key — the static site cannot call a paid LLM client-side. **This is the gating cost, not the prompt.**
- **Cheaper grounded alternative:** a **template-based** briefing (no LLM) — deterministic sentences from thresholds (streak ≥ 5, GB swing, run-diff leaders). ~80% of the value, $0 cost, no backend. **Recommend shipping this first**, upgrade to LLM phrasing only if users want it.

### Feature B — "Who should I watch tonight?" (Game-of-the-day ranker)
- **Category:** Intelligence AI (ranking / next-best-action)
- **Strategic Fit:** 7/10
- **What it is:** Rank tonight's `fetchSchedule` games by a watchability score — combined team form (runDiff7 from `trends-engine`), standings stakes (close division/wild-card races from `rankings-engine`), and streaks — and badge the top 1–3 in the Upcoming panel.
- **Workflow improvement:** Today the user eyeballs a flat date-grouped list (`renderUpcoming` app.js:333) and manually decides what's worth their evening. This surfaces the answer.
- **Evidence in code:** all inputs exist — `schedule` (app.js:71), `trends` (app.js:75), `rankings` wild-card/division gaps (rankings-engine.js:67). It's a scoring function over existing view-models.
- **Hard dependency:** **None** — this is deterministic ranking, not an LLM. Ships on the static site as-is. **Highest feasibility of any candidate.**
- **Why it's not a gimmick:** it answers a question the user genuinely asks ("what's the good game tonight?") using signals that actually correlate with watchability.

### Feature C — Plain-language chart explainers (Trends tab)
- **Category:** Generative AI
- **Strategic Fit:** 5/10
- **What it is:** A one-line, data-driven caption under each Trends widget that names the standout — "Top-right quadrant: Braves (elite OPS + sub-3.50 ERA); bottom-left rebuild: White Sox." The widget descriptions in `index.html` (lines 86–123) are currently *static prose*; this makes them reflect today's actual leaders.
- **Workflow improvement:** The charts already tell the user *where to look* (descriptions exist); this tells them *who's there today* without hovering every bubble.
- **Evidence in code:** `buildMergedData` (trends-charts.js:44) already computes the per-team merged records the captions would reference.
- **Dependency:** can be **template-based (no LLM, no backend)** — pick max/min on each axis and fill a sentence. LLM optional for nicer phrasing.
- **Note:** lower fit because the static descriptions already do most of this job; marginal value.

### Feature D — Scoped natural-language Q&A ("Ask the dashboard")
- **Category:** Conversational AI (scoped, not a general chatbot)
- **Strategic Fit:** 4/10
- **What it is:** A single input — "Which AL East team has the best last-10?" / "Who has the worst bullpen ERA?" — answered from the already-loaded data.
- **Workflow improvement:** Real *only if* a user's question isn't already answered by an existing widget. Given the dashboard is fairly complete, that overlap is large — which is exactly why this scores low.
- **Evidence in code:** the merged dataset (trends-charts.js:44) is queryable; intent→filter mapping is feasible.
- **Dependency:** needs backend + LLM (key safety) **and** careful guardrails so it only answers from real data (no hallucinated stats — the cardinal sin for a stats product).
- **Verdict:** **Defer.** High gimmick risk (−2 on the rubric), high overlap with existing widgets, hard dependency. Revisit only after A and B prove demand.

---

## What to build, in order (preview — full sequencing in IMPLEMENTATION_ROADMAP.md)

1. **Feature B** (watchability ranker) — no backend, deterministic, highest feasibility, real user question. Ship first.
2. **Feature A, template version** (daily briefing without LLM) — no backend, high value, $0.
3. **Feature A, LLM upgrade** *(only if a serverless proxy is added and users want richer phrasing)*.
4. **Feature C** (chart explainers, template) — nice polish, low effort.
5. **Feature D** — defer; reassess against real usage signal (which itself requires adding telemetry first).

The throughline: **the genuinely good near-term moves need no AI vendor at all** — they're deterministic interpretation of data the app already fetches. That's the grounded answer, even though it's less exciting than "add a copilot."
