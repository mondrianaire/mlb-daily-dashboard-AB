# Daily-briefing rephrasing proxy (Cloudflare Worker)

Optional, **default-off** backend for the dashboard's daily briefing. It rephrases
the already-grounded highlights (computed client-side by `briefing-engine.js`) into
livelier wording using Anthropic Claude — without ever putting the API key in the
browser. If you never deploy this, the dashboard works exactly as before with the
deterministic briefing.

## What it does (and what it refuses to do)

- **Does:** rewrites each highlight into one livelier sentence.
- **Refuses:** to change, add, or remove any number, team, or fact. Enforced three
  ways — the system prompt, a server-side numeric check (`preservesNumbers`), and a
  client-side check in `briefing-llm.js`. If a rewrite introduces a number that
  wasn't in the original, the original sentence is kept. A wrong stat on a stats
  product is unacceptable (`RISK-002`).
- On any model error it returns the deterministic originals with `fallback: true`,
  so the client never shows a degraded state.

## Prerequisites

- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier is plenty).
- [`wrangler`](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
  installed: `npm i -g wrangler` then `wrangler login`.
- An [Anthropic API key](https://console.anthropic.com/).

## One-command deploy (recommended)

From the repo root:

```bash
npm run deploy:briefing
```

That guided script automates everything that can be automated. You only do the two
things that are inherently yours:

1. **Authorize Cloudflare** in the browser when it opens (one click).
2. **Paste your Anthropic API key** at the hidden prompt (wrangler stores it as an
   encrypted secret — the script never sees it).

It then deploys the worker, optionally creates + binds the KV daily-cache, captures
the deployed URL, **writes it into `index.html`'s `briefing-llm-endpoint` meta tag**,
and offers to commit + push (which makes the live site start using it).

Flags: `--ship` (auto commit+push), `--no-cache` (skip KV), `--yes` (accept prompts).

Prefer to do it by hand? The manual steps are below.

### Even more automated: CI redeploys (optional)

`.github/workflows/deploy-briefing-worker.yml` redeploys the worker automatically on
every change under `server/**`, once you add two repo secrets
(`CLOUDFLARE_API_TOKEN`, `ANTHROPIC_API_KEY`) — see the comments at the top of that
file. It no-ops until those secrets exist. Run `npm run deploy:briefing` once first to
wire the endpoint into the site; after that, CI keeps the worker code deployed.

## Manual deploy (≈3 minutes)

```bash
cd server

# 1) Store the API key as an encrypted secret (NOT in any file):
wrangler secret put ANTHROPIC_API_KEY        # paste your key when prompted

# 2) (Recommended) restrict CORS to your site origin — edit wrangler.toml:
#    ALLOWED_ORIGIN = "https://mondrianaire.github.io"

# 3) Deploy:
wrangler deploy
# → prints a URL like https://mlb-briefing-proxy.<subdomain>.workers.dev
```

### Optional: daily cache (cuts cost to ~1 model call/day)

The briefing is identical for every visitor on a given day, so cache it:

```bash
wrangler kv namespace create BRIEFING_CACHE   # prints an id
# uncomment the [[kv_namespaces]] block in wrangler.toml and paste the id
wrangler deploy
```

## Turn it on in the site

Set the endpoint in `index.html` (single line; empty = off):

```html
<meta name="briefing-llm-endpoint" content="https://mlb-briefing-proxy.<subdomain>.workers.dev">
```

That's the only client change. Reload the dashboard: the deterministic briefing
renders instantly, then (if the proxy responds) the wording is swapped in place.

## Test the worker directly

```bash
curl -s -X POST https://mlb-briefing-proxy.<subdomain>.workers.dev \
  -H 'Content-Type: application/json' \
  -d '{"highlights":[{"text":"The Yankees have won 6 games in a row.","kind":"streak"}]}'
# → {"items":["The Yankees are rolling, winners of six straight."]}
```

## Cost

Claude Haiku, ~1 short call per request. See `docs/intelligence/AI_STACK.md` for the
full model with assumptions. Headline: **with the KV daily-cache enabled, cost is
roughly one model call per day (cents/month) regardless of traffic**, because all
visitors share the same daily briefing. Without the cache it scales linearly with
page loads (still only Haiku-priced short calls).

## Security notes

- The key lives only as a Wrangler secret; it is never sent to the browser.
- Set `ALLOWED_ORIGIN` to your Pages origin in production rather than `*`.
- Input is validated (≤8 highlights, ≤300 chars each) before any model call.
- Consider adding Cloudflare rate-limiting rules if you expose the worker publicly.
