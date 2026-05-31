// tests/briefing-llm.test.js
// Unit tests for the pure guard helpers of the optional LLM briefing enhancer
// (Phase 4). The network path is not unit-tested; the safety logic is.
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  extractNumbers, preservesNumbers, validateRephrased, getEndpoint, rephraseHighlights
} from "../briefing-llm.js";

// ---------- extractNumbers ----------
test("extractNumbers pulls integers, decimals, signs, and .615-style", () => {
  assert.deepEqual(extractNumbers("won 6 of last 10, +12 diff, OPS .615, ERA 3.10"),
    ["6", "10", "12", ".615", "3.10"]);
});
test("extractNumbers normalizes a leading plus", () => {
  assert.deepEqual(extractNumbers("up +4 games"), ["4"]);
});

// ---------- preservesNumbers ----------
test("preservesNumbers allows rewording that keeps the same numbers", () => {
  assert.equal(
    preservesNumbers("The Yankees have won 6 games in a row.",
                     "Riding high, the Yankees have reeled off 6 straight wins."),
    true
  );
});
test("preservesNumbers allows dropping a number", () => {
  assert.equal(preservesNumbers("Up 4 games in the AL East.", "Leading the AL East."), true);
});
test("preservesNumbers rejects an invented number (the cardinal sin)", () => {
  assert.equal(
    preservesNumbers("The Yankees have won 6 games in a row.",
                     "The Yankees have won 7 games in a row."),
    false
  );
});
test("preservesNumbers rejects a sneaky added stat", () => {
  assert.equal(
    preservesNumbers("Tight AL East race.",
                     "Tight AL East race, just 2 games separate them."),
    false
  );
});

// ---------- validateRephrased ----------
const originals = [
  { text: "The Yankees have won 6 games in a row.", kind: "streak" },
  { text: "Just 1 game separates first place in the AL Central.", kind: "race" }
];

test("validateRephrased accepts good rewrites and flags them enhanced", () => {
  const out = validateRephrased(originals, [
    "The Yankees have rattled off 6 in a row.",
    "Only 1 game splits the top of the AL Central."
  ]);
  assert.equal(out.length, 2);
  assert.ok(out[0].enhanced && out[1].enhanced);
  assert.equal(out[0].kind, "streak");
});

test("validateRephrased falls back per-item when a rewrite invents a number", () => {
  const out = validateRephrased(originals, [
    "The Yankees have won 9 games in a row.",   // fabricated -> reject
    "Only 1 game splits the AL Central."         // ok
  ]);
  assert.equal(out[0].enhanced, false);
  assert.equal(out[0].text, originals[0].text); // kept original
  assert.equal(out[1].enhanced, true);
});

test("validateRephrased rejects wholesale on length mismatch", () => {
  assert.equal(validateRephrased(originals, ["only one"]), null);
  assert.equal(validateRephrased(originals, "not an array"), null);
});

test("validateRephrased tolerates {text} object items", () => {
  const out = validateRephrased([originals[0]], [{ text: "Yankees: 6 straight." }]);
  assert.equal(out[0].enhanced, true);
  assert.match(out[0].text, /6 straight/);
});

// ---------- getEndpoint ----------
test("getEndpoint reads the meta tag, trims, and treats empty as off", () => {
  const docWith = (content) => ({
    querySelector: () => ({ getAttribute: () => content })
  });
  assert.equal(getEndpoint(docWith("  https://x.workers.dev  "), {}), "https://x.workers.dev");
  assert.equal(getEndpoint(docWith(""), {}), "");
  assert.equal(getEndpoint({ querySelector: () => null }, {}), "");
});
test("getEndpoint falls back to a window global", () => {
  const doc = { querySelector: () => null };
  assert.equal(getEndpoint(doc, { __BRIEFING_LLM_ENDPOINT__: "https://w.dev" }), "https://w.dev");
});

// ---------- rephraseHighlights (with injected fetch) ----------
test("rephraseHighlights returns null when no endpoint", async () => {
  const r = await rephraseHighlights(originals, { endpoint: "" });
  assert.equal(r, null);
});
test("rephraseHighlights validates the server response", async () => {
  const fakeFetch = async () => ({
    ok: true,
    json: async () => ({ items: ["The Yankees have won 6 straight.", "1 game splits the AL Central."] })
  });
  const r = await rephraseHighlights(originals, { endpoint: "https://x", fetchImpl: fakeFetch });
  assert.equal(r.length, 2);
  assert.ok(r[0].enhanced);
});
test("rephraseHighlights returns null on a non-ok response", async () => {
  const fakeFetch = async () => ({ ok: false, json: async () => ({}) });
  const r = await rephraseHighlights(originals, { endpoint: "https://x", fetchImpl: fakeFetch });
  assert.equal(r, null);
});
test("rephraseHighlights swallows fetch errors (keeps deterministic)", async () => {
  const fakeFetch = async () => { throw new Error("network down"); };
  const r = await rephraseHighlights(originals, { endpoint: "https://x", fetchImpl: fakeFetch });
  assert.equal(r, null);
});
