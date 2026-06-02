// tests/api-cache.test.js
// Unit tests for the network-first cache with stale fallback (RISK-001).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { createApiCache, withinMaxAge, onApiHealth } from "../api-cache.js";

// Minimal in-memory Storage stand-in.
function fakeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, v),
    removeItem: (k) => m.delete(k),
    _map: m
  };
}

test("withinMaxAge: true inside window, false when older or in the future", () => {
  assert.equal(withinMaxAge(1000, 500, 1400), true);   // age 400 <= 500
  assert.equal(withinMaxAge(1000, 500, 1600), false);  // age 600 > 500
  assert.equal(withinMaxAge(1000, 500, 900), false);   // negative age (clock skew)
  assert.equal(withinMaxAge(undefined, 500, 1400), false);
});

test("getJSON returns fresh network data and caches it", async () => {
  const storage = fakeStorage();
  let t = 1000;
  const cache = createApiCache({ storage, now: () => t });
  const r = await cache.getJSON("/x", async () => ({ ok: 1 }));
  assert.deepEqual(r, { data: { ok: 1 }, fromCache: false, cachedAt: null });
  // cache was written
  assert.deepEqual(cache.read("/x"), { ts: 1000, data: { ok: 1 } });
});

test("getJSON serves the last good value when the network fails", async () => {
  const storage = fakeStorage();
  let t = 1000;
  const cache = createApiCache({ storage, now: () => t, maxAgeMs: 10_000 });
  await cache.getJSON("/x", async () => ({ v: "good" }));   // populate
  t = 5000;                                                  // 4s later
  const r = await cache.getJSON("/x", async () => { throw new Error("network down"); });
  assert.deepEqual(r.data, { v: "good" });
  assert.equal(r.fromCache, true);
  assert.equal(r.cachedAt, 1000);
});

test("getJSON rethrows when the cached value is too old", async () => {
  const storage = fakeStorage();
  let t = 1000;
  const cache = createApiCache({ storage, now: () => t, maxAgeMs: 1000 });
  await cache.getJSON("/x", async () => ({ v: 1 }));
  t = 5000; // age 4000 > maxAge 1000
  await assert.rejects(
    () => cache.getJSON("/x", async () => { throw new Error("down"); }),
    /down/
  );
});

test("getJSON rethrows when there is no cache at all", async () => {
  const cache = createApiCache({ storage: fakeStorage(), now: () => 1 });
  await assert.rejects(
    () => cache.getJSON("/x", async () => { throw new Error("first-load failure"); }),
    /first-load failure/
  );
});

test("works without storage (caching disabled, never throws on cache ops)", async () => {
  const cache = createApiCache({ storage: null, now: () => 1 });
  const r = await cache.getJSON("/x", async () => ({ a: 1 }));
  assert.deepEqual(r.data, { a: 1 });
  assert.equal(cache.read("/x"), null);
});

test("emits health: healthy on success, degraded on cache fallback", async () => {
  const storage = fakeStorage();
  let t = 1000;
  const cache = createApiCache({ storage, now: () => t, maxAgeMs: 10_000 });
  const seen = [];
  const off = onApiHealth((s) => seen.push(s));
  await cache.getJSON("/y", async () => ({ v: 1 }));                 // healthy
  await cache.getJSON("/y", async () => { throw new Error("x"); });  // degraded (served cache)
  off();
  assert.deepEqual(seen, ["healthy", "degraded"]);
});
