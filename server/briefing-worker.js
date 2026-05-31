/**
 * briefing-worker.js — Cloudflare Worker (Phase 4)
 *
 * A tiny proxy that rephrases the dashboard's *already-grounded* daily-briefing
 * highlights into livelier wording using Anthropic Claude, without ever exposing
 * the API key to the browser. The deterministic briefing-engine.js remains the
 * source of truth; this only rewords.
 *
 * Hard guardrail (RISK-002): the model may reword a highlight but may NOT add
 * any number that wasn't in the original. Enforced both by the system prompt and
 * by a server-side numeric check below (defense in depth). The client checks
 * again. A stats product cannot afford a fabricated number.
 *
 * Deploy: see server/README.md. Required secret: ANTHROPIC_API_KEY.
 * Optional: bind a KV namespace as BRIEFING_CACHE to cache the daily rephrasing
 * (the briefing is identical for all users on a given day → ~1 model call/day).
 *
 * Env vars / bindings:
 *   ANTHROPIC_API_KEY  (secret, required)
 *   MODEL              (var, optional; default "claude-3-5-haiku-latest")
 *   ALLOWED_ORIGIN     (var, optional; default "*"; set to your Pages origin)
 *   BRIEFING_CACHE     (KV namespace, optional)
 */

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MAX_HIGHLIGHTS = 8;
const MAX_TEXT_LEN = 300;
const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6h

const SYSTEM_PROMPT =
  "You rewrite short MLB dashboard highlights into livelier, natural one-sentence " +
  "blurbs for baseball fans. STRICT RULES: (1) Return ONLY a JSON array of strings " +
  "— no prose, no keys, no markdown. (2) The array must have exactly the same length " +
  "and order as the input highlights. (3) Each output is ONE sentence. (4) You MUST " +
  "preserve every number, team name, and fact exactly as given; never add, change, " +
  "remove, or round any number; never invent a statistic. If you are unsure, return " +
  "the input sentence unchanged. Keep it concise and broadcast-style.";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };
}

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) }
  });
}

// --- numeric guard (mirrors briefing-llm.js) ---
function extractNumbers(text) {
  const out = [];
  const re = /[+-]?(?:\d+\.\d+|\.\d+|\d+)/g;
  let m;
  while ((m = re.exec(String(text ?? ""))) !== null) {
    out.push(m[0].startsWith("+") ? m[0].slice(1) : m[0]);
  }
  return out;
}
function preservesNumbers(original, rephrased) {
  const allowed = new Set(extractNumbers(original));
  for (const n of extractNumbers(rephrased)) if (!allowed.has(n)) return false;
  return true;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function validateInput(payload) {
  if (!payload || !Array.isArray(payload.highlights)) return null;
  const hs = payload.highlights;
  if (hs.length < 1 || hs.length > MAX_HIGHLIGHTS) return null;
  const clean = [];
  for (const h of hs) {
    if (!h || typeof h.text !== "string") return null;
    const text = h.text.slice(0, MAX_TEXT_LEN);
    clean.push({ text, kind: typeof h.kind === "string" ? h.kind : "" });
  }
  return clean;
}

async function callAnthropic(highlights, env) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: env.MODEL || "claude-3-5-haiku-latest",
      max_tokens: 400,
      // System prompt is static across requests → cache it to cut input cost.
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        { role: "user", content: JSON.stringify(highlights.map((h) => h.text)) }
      ]
    })
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`anthropic ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data?.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
  let arr;
  try { arr = JSON.parse(text); } catch { return null; }
  return Array.isArray(arr) ? arr : null;
}

// Merge model output with originals under the numeric guard.
function applyGuard(highlights, modelArr) {
  if (!Array.isArray(modelArr) || modelArr.length !== highlights.length) {
    return highlights.map((h) => h.text); // reject wholesale → all originals
  }
  return highlights.map((h, i) => {
    const cand = typeof modelArr[i] === "string" ? modelArr[i].trim() : "";
    return (cand && preservesNumbers(h.text, cand)) ? cand : h.text;
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return json({ error: "POST only" }, 405, env);
    }
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "server not configured" }, 503, env);
    }

    let payload;
    try { payload = await request.json(); }
    catch { return json({ error: "invalid JSON" }, 400, env); }

    const highlights = validateInput(payload);
    if (!highlights) return json({ error: "invalid highlights" }, 400, env);

    // Cache: identical highlights → identical rephrasing (KV optional).
    const cacheKey = env.BRIEFING_CACHE
      ? "brief:v1:" + (await sha256Hex(JSON.stringify(highlights.map((h) => h.text))))
      : null;
    if (cacheKey) {
      const hit = await env.BRIEFING_CACHE.get(cacheKey, { type: "json" });
      if (hit && Array.isArray(hit.items)) {
        return json({ items: hit.items, cached: true }, 200, env);
      }
    }

    let items;
    try {
      const modelArr = await callAnthropic(highlights, env);
      items = applyGuard(highlights, modelArr);
    } catch (e) {
      // On any model failure, return the deterministic originals so the client
      // still gets a 200 and simply shows what it already had.
      return json({ items: highlights.map((h) => h.text), fallback: true, error: String(e).slice(0, 120) }, 200, env);
    }

    if (cacheKey) {
      await env.BRIEFING_CACHE.put(cacheKey, JSON.stringify({ items }), { expirationTtl: CACHE_TTL_SECONDS });
    }
    return json({ items }, 200, env);
  }
};
