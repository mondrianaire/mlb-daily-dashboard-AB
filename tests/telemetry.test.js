// tests/telemetry.test.js
// Unit tests for the privacy-light, default-off telemetry layer (GAP-003).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { createTelemetry, getTelemetryEndpoint } from "../telemetry.js";

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

test("track increments local counts and returns the new count", () => {
  const t = createTelemetry({ storage: fakeStorage() });
  assert.equal(t.track("load"), 1);
  assert.equal(t.track("tab:trends"), 1);
  assert.equal(t.track("tab:trends"), 2);
  assert.deepEqual(t.snapshot(), { load: 1, "tab:trends": 2 });
});

test("ignores non-string / empty events", () => {
  const t = createTelemetry({ storage: fakeStorage() });
  assert.equal(t.track(""), undefined);
  assert.equal(t.track(null), undefined);
  assert.equal(t.track(42), undefined);
  assert.deepEqual(t.snapshot(), {});
});

test("does NOT beacon when no endpoint configured (default OFF)", () => {
  const sent = [];
  const t = createTelemetry({ storage: fakeStorage(), beacon: (u, d) => sent.push([u, d]), endpoint: "" });
  t.track("load");
  assert.equal(t.isBeaconing(), false);
  assert.equal(sent.length, 0);
});

test("beacons a privacy-light payload when an endpoint IS configured", () => {
  const sent = [];
  const t = createTelemetry({
    storage: fakeStorage(),
    beacon: (u, d) => sent.push([u, d]),
    endpoint: "https://collector.example/e",
    now: () => 1234
  });
  t.track("theme:light", "x");
  assert.equal(t.isBeaconing(), true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "https://collector.example/e");
  const payload = JSON.parse(sent[0][1]);
  assert.deepEqual(payload, { e: "theme:light", t: 1234, m: "x" });
  // no user id / url / pii fields
  assert.deepEqual(Object.keys(payload).sort(), ["e", "m", "t"]);
});

test("bounds the number of distinct event types", () => {
  const t = createTelemetry({ storage: fakeStorage() });
  for (let i = 0; i < 60; i++) t.track("evt" + i);
  const snap = t.snapshot();
  assert.equal(Object.keys(snap).length, 50); // capped at MAX_EVENT_TYPES
  // an already-known event still counts past the cap
  assert.equal(t.track("evt0"), 2);
});

test("reset clears the counts", () => {
  const t = createTelemetry({ storage: fakeStorage() });
  t.track("a"); t.track("b");
  t.reset();
  assert.deepEqual(t.snapshot(), {});
});

test("works without storage (no-op counts, never throws)", () => {
  const t = createTelemetry({ storage: null });
  assert.equal(t.track("x"), 1);
  assert.deepEqual(t.snapshot(), {});
});

test("getTelemetryEndpoint reads the meta tag, empty = off", () => {
  const docWith = (content) => ({ querySelector: () => ({ getAttribute: () => content }) });
  assert.equal(getTelemetryEndpoint(docWith("  https://c.dev  ")), "https://c.dev");
  assert.equal(getTelemetryEndpoint(docWith("")), "");
  assert.equal(getTelemetryEndpoint({ querySelector: () => null }), "");
});
