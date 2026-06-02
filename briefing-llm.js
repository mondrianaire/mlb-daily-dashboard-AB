// briefing-llm.js  (OPP-002, Phase 4 — optional LLM phrasing)
// Default-OFF client enhancer for the daily briefing. The deterministic
// briefing-engine.js remains the single source of truth and is always rendered
// first; this module only *rephrases* those already-grounded highlights for
// livelier wording, and ONLY when an endpoint is configured.
//
// Safety contract (RISK-002 — a stats product cannot show a wrong number):
//   - The model may reword a highlight but may NOT introduce any number that
//     wasn't in the deterministic original. `preservesNumbers()` enforces this
//     client-side; the worker enforces it server-side too (defense in depth).
//   - Any failure (no endpoint, network error, timeout, guard violation) leaves
//     the deterministic text exactly as rendered. There is no degraded state.
//
// Configuration (static-site friendly, no code edit needed to enable):
//   <meta name="briefing-llm-endpoint" content="https://your-worker.workers.dev">
//   (empty / absent  => feature is OFF, zero network calls)

const DEFAULT_TIMEOUT_MS = 4000;

// ---------- pure helpers (unit-tested) ----------

// Extract numeric tokens from a string: integers, decimals, signed values,
// and pct-style ".615". Returned normalized (leading "+" dropped) for set
// comparison.
export function extractNumbers(text) {
  const out = [];
  const re = /[+-]?(?:\d+\.\d+|\.\d+|\d+)/g;
  const s = String(text ?? "");
  let m;
  while ((m = re.exec(s)) !== null) {
    let tok = m[0];
    if (tok.startsWith("+")) tok = tok.slice(1);
    out.push(tok);
  }
  return out;
}

// True iff `rephrased` introduces no numeric token absent from `original`.
// (Dropping a number is allowed; inventing one is not.)
export function preservesNumbers(original, rephrased) {
  const allowed = new Set(extractNumbers(original));
  for (const n of extractNumbers(rephrased)) {
    if (!allowed.has(n)) return false;
  }
  return true;
}

// Validate a model response against the deterministic highlights. Returns a new
// highlights array: each item uses the rephrased text ONLY if it is a non-empty
// string that preserves numbers; otherwise it falls back to the original text.
// Length/order must match; if not, the whole enhancement is rejected (null).
export function validateRephrased(originalHighlights, modelItems) {
  if (!Array.isArray(originalHighlights) || !Array.isArray(modelItems)) return null;
  if (modelItems.length !== originalHighlights.length) return null;
  return originalHighlights.map((h, i) => {
    const cand = modelItems[i];
    const text = typeof cand === "string" ? cand.trim()
      : (cand && typeof cand.text === "string" ? cand.text.trim() : "");
    if (text && preservesNumbers(h.text, text)) {
      return { text, kind: h.kind, teamId: h.teamId ?? null, enhanced: true };
    }
    return { text: h.text, kind: h.kind, teamId: h.teamId ?? null, enhanced: false };
  });
}

// Read the configured endpoint from the page (meta tag preferred, window global
// fallback). Returns "" when unset → feature OFF.
export function getEndpoint(doc = (typeof document !== "undefined" ? document : null),
                            win = (typeof window !== "undefined" ? window : null)) {
  const meta = doc?.querySelector?.('meta[name="briefing-llm-endpoint"]');
  const fromMeta = meta?.getAttribute?.("content")?.trim();
  if (fromMeta) return fromMeta;
  const fromWin = win?.__BRIEFING_LLM_ENDPOINT__;
  return (typeof fromWin === "string" && fromWin.trim()) ? fromWin.trim() : "";
}

// ---------- network (not unit-tested; thin I/O wrapper) ----------

// Fetch a rephrased briefing. Resolves to a validated highlights array, or null
// on any problem (caller keeps the deterministic render).
export async function rephraseHighlights(highlights, {
  endpoint,
  fetchImpl = (typeof fetch !== "undefined" ? fetch : null),
  timeoutMs = DEFAULT_TIMEOUT_MS
} = {}) {
  if (!endpoint || !fetchImpl) return null;
  if (!Array.isArray(highlights) || highlights.length === 0) return null;

  const controller = (typeof AbortController !== "undefined") ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ highlights: highlights.map((h) => ({ text: h.text, kind: h.kind })) }),
      signal: controller?.signal
    });
    if (!res.ok) return null;
    const data = await res.json();
    return validateRephrased(highlights, data?.items);
  } catch (_) {
    return null; // network/timeout/parse — silently keep deterministic
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// High-level integration entry point used by app.js. Fire-and-forget: if the
// feature is off or anything fails, it simply never calls onUpdate, and the
// already-rendered deterministic briefing stands.
export async function maybeEnhanceBriefing(highlights, onUpdate, opts = {}) {
  const endpoint = opts.endpoint ?? getEndpoint();
  if (!endpoint) return; // OFF — no network, no behavior change
  const enhanced = await rephraseHighlights(highlights, { endpoint, ...opts });
  if (enhanced && typeof onUpdate === "function") {
    onUpdate(enhanced);
  }
}
