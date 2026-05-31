# AI_STACK — MLB Daily Dashboard

> Layer 4 (AI Systems Architect). The architecture + cost model for the one AI feature taken on: **optional LLM phrasing of the daily briefing** (Phase 4). Grounded in the shipped code on branch `claude/phase4-briefing-llm`. Written so an engineer and a cost-conscious owner can both read it.

## Scope — deliberately narrow

This is **not** a general AI platform. The only model-backed feature is rewording the already-grounded daily-briefing highlights into livelier wording. Everything else in the product stays deterministic and backend-free. That narrowness is the point: it's the smallest possible footprint that adds real value without compromising the static-site simplicity or the "never show a wrong number" rule.

## Architecture

```
Browser (GitHub Pages, static)
  briefing-engine.js ──► deterministic highlights (SOURCE OF TRUTH, always rendered)
        │
        ▼  (only if a meta-tag endpoint is set; else STOP — no network)
  briefing-llm.js  ──POST {highlights}──►  Cloudflare Worker (server/briefing-worker.js)
        ▲                                        │
        │                                        ├─ validate input (≤8 items, ≤300 chars)
        │                                        ├─ [optional] KV cache lookup by hash
        │                                        ├─ Anthropic Messages API (Claude Haiku)
        │                                        │     system prompt cached (ephemeral)
        │                                        ├─ numeric guard: drop any reworded line
        │                                        │     that introduces a new number
        │                                        └─ [optional] KV cache store
        └──◄── {items:[reworded strings]} ──────┘
  client re-validates numbers, swaps text in place; any failure ⇒ keep deterministic
```

### What's reused vs new
- **Reused:** the entire deterministic pipeline (`briefing-engine.js`), the existing render path (`renderBriefing` in `app.js`), the static hosting. No change to the data layer or any other feature.
- **New (all optional, default-off):** `briefing-llm.js` (client enhancer + pure guards), `server/briefing-worker.js` (Cloudflare Worker), `server/wrangler.toml`, `server/README.md`. One `<meta>` tag toggles it.

### Data sources
- Input to the model is **only** the already-computed highlight strings (which are themselves pure functions of standings/trends/schedule). No raw data, no PII, no user data — there are no users. Nothing is persisted except an optional short-TTL cache of the day's reworded strings.

### AI stack
- **Model:** Anthropic Claude Haiku (`claude-3-5-haiku-latest`, configurable). Haiku is the right tier — the task is short, mechanical rephrasing, not reasoning.
- **Prompt caching:** the static system prompt is sent with `cache_control: ephemeral`, so its input tokens are largely free on repeated calls.
- **No embeddings, no vector store, no RAG** — there is no corpus to retrieve over. Adding any of that here would be unjustified infrastructure.

### The safety architecture (the part that matters most)
A stats product cannot show a fabricated number (`RISK-002`). Three independent guards enforce this:
1. **System prompt** forbids changing/adding/removing any number, team, or fact.
2. **Server-side** `preservesNumbers()` drops any reworded line that introduces a number absent from the original, per item.
3. **Client-side** the same check runs again in `briefing-llm.js` before any swap.
On any failure at any layer, the deterministic sentence stands. There is no degraded state — the worst case is "looks exactly like it does today."

## Cost model

**Assumptions:** Claude Haiku; ~1 request per page load; per call ≈ 200 system tokens (cached) + ~200 input + ~200 output. Haiku ≈ $0.80/M input, $4/M output ⇒ **≈ $0.0011 per uncached call**. Cloudflare Workers free tier covers 100k requests/day.

| Scenario | Without daily cache | **With KV daily cache** |
|----------|--------------------|--------------------------|
| Low (100 loads/day) | ~3k calls/mo → **~$3/mo** | ~30 calls/mo → **~$0.03/mo** |
| Moderate (2k loads/day) | ~60k calls/mo → **~$66/mo** | ~30 calls/mo → **~$0.03/mo** |
| High (50k loads/day) | ~1.5M calls/mo → **~$1,650/mo** | ~30 calls/mo → **~$0.03/mo** |

**Largest cost driver:** the per-load model call. **Mitigation (decisive here):** the briefing is *identical for every visitor on a given day*, so caching the reworded result by a hash of the highlights collapses cost to **~one model call per day regardless of traffic**. This is why the worker ships with optional KV caching — at any real scale it's the difference between dollars and thousands of dollars. Enable it.

- **Latency:** does NOT block UX. The deterministic briefing paints immediately; the reworded text swaps in asynchronously (p50 ~300–800ms for Haiku; a 4s client timeout caps the wait, after which deterministic simply stands).
- **Complexity:** Small. One worker, one client module, one meta tag. Riskiest unknown: model occasionally returns non-JSON or drifts a number — both are already handled (parse failure → originals; numeric drift → per-item fallback).
- **Scaling — what breaks first at 10×:** without the cache, cost (not latency or the free-tier request cap) is the first wall. With the cache, nothing in this feature breaks at 10× — the upstream MLB API (`RISK-001`) remains the system's real ceiling.

## Recommendation

Ship the code (done, default-off). **Turn it on only with the KV cache enabled** so cost is trivial. Treat it as a polish layer: the deterministic briefing is the product; this makes it read a little more like a broadcast. If usage data ever shows people don't notice or value the rephrasing, turning it off is a one-line revert (clear the meta tag) with zero collateral.
