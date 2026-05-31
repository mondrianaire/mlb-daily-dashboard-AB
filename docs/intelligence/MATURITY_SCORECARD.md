# MATURITY_SCORECARD — MLB Daily Dashboard

> Scores per `scoring-rubrics.md`, each with code evidence. Grounded at commit `b4c1e6c`. Numbers are deliberately un-inflated — a 4/10 with a clear reason beats a flattering 8.

## AI Readiness Score: **18 / 100**

Honest and low — because AI readiness measures *foundations to support AI features today*, and this static, data-less site has almost none. That is not a criticism of the build; it's a structural fact.

| Signal (+) | Weight | Earned | Evidence |
|------------|-------:|-------:|----------|
| Data volume / accumulation | 20 | **0** | Owns no data; nothing accumulates (fetched fresh per load, data-client.js) |
| Repetitive workflows | 15 | **0** | No automatable operational workflow |
| User-generated content | 15 | **0** | None |
| Existing automation/jobs | 10 | **0** | No crons/workers/queues (static site) |
| Analytics / telemetry infra | 15 | **0** | No tracking anywhere |
| Existing AI surface | 10 | **0** | No LLM SDK wired |
| Clean data model | 15 | **13** | Genuinely clean: typed normalization + contracts (data-client.js, manifest.json:54) — strongest asset |
| **Weakness:** no event pipeline | — | **−10** | confirmed |
| **Weakness:** no vector storage | — | **−5** | confirmed |
| **Weakness:** no structured telemetry | — | **−10** | confirmed |
| (schema is documented, not messy) | — | **0** | no penalty — clean contracts |

**Calc:** 13 − 25 = −12 raw → floored, and credited +30 for the **data-pipeline cleanliness + normalization discipline** that makes *adding* AI plumbing straightforward (well-separated data layer, deterministic compute engines, a ready in-memory `dailyFetchCache`). Reported band: **~18/100 (Low).**

> Read this as: *"not ready today, but unusually clean to extend."* The blocker is missing foundations (backend, data, telemetry), not messy code. The code quality is the bright spot.

## Product Maturity Scorecard (6 dimensions, 0–10)

| Dimension | Score | Evidence |
|-----------|:-----:|----------|
| **Product maturity** | **7** | Feature-complete for its stated scope; strong loading/error/empty states (app.js:415–449), typed errors (data-client.js:25), 30-team integrity guarantee (data-client.js:96), ARIA scaffolding (index.html:23). **−** for zero automated tests and refetch-everything-per-load. |
| **AI readiness** | **2** | Scaled from 18/100. No AI foundations; clean to extend (see above). |
| **Infra scalability** | **8** | Static site on a CDN — trivially horizontally scalable by construction; `static_only: true` (manifest.json:34), Chart.js lazy-loaded (app.js:497). The ceiling is the **upstream MLB API**, not this app. **−** for no client-side cross-load caching. |
| **Enterprise readiness** | **0** | None applicable: no auth, no tenancy, no RBAC, no audit. By design — it's a public spectator site. |
| **Monetization leverage** | **0** | No billing, no accounts, no plan gating anywhere in repo. |
| **Competitive differentiation** | **3** | Clean code + polished UX + official logos/colors (teams.js, logo-helpers.js) are nice but **commodity** — the data is the public MLB API anyone can use. No moat (see MOAT note). |

## Moat note (brief)

**Overall moat: None — and that's the honest finding.** Every input is the public MLB Stats API; the compute (run diff, OPS/ERA quadrants, wild-card logic) is standard baseball math. There is no data moat (owns nothing), no integration moat (one public API), no automation moat (no embedded workflow), no AI moat (no model/data flywheel). The only durable asset is **execution quality** — clean architecture and good UX — which is replicable. This is normal and fine for a hobby/portfolio dashboard; recording it honestly matters more than dressing it up.

## How these feed the snapshot

`snapshots.json` records: `ai_readiness: 18`, `maturity_product: 7`, `maturity_ai: 2`, `maturity_infra: 8`, `maturity_enterprise: 0`, `maturity_monetization: 0`, `maturity_differentiation: 3`. Re-runs will chart movement against this baseline.
