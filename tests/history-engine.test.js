// tests/history-engine.test.js
// Unit tests for day-over-day memory (GAP-002).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildSnapshot, diffRanks, mostRecentBefore, createHistoryStore, teamSeries
} from "../history-engine.js";

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}
function div(...entries) { return entries; }
function t(teamId, wins, losses) { return { teamId, wins, losses }; }

test("buildSnapshot captures 1-based rank within each division", () => {
  const snap = buildSnapshot({
    AL_East: div(t(147, 41, 22), t(111, 36, 27), t(139, 30, 33)),
    NL_West: div(t(119, 40, 23))
  }, "2026-06-02");
  assert.equal(snap.date, "2026-06-02");
  assert.deepEqual(snap.ranks[147], { rank: 1, div: "AL_East", w: 41, l: 22, rd: 0 });
  assert.deepEqual(snap.ranks[111], { rank: 2, div: "AL_East", w: 36, l: 27, rd: 0 });
  assert.deepEqual(snap.ranks[119], { rank: 1, div: "NL_West", w: 40, l: 23, rd: 0 });
});

test("diffRanks reports up/down movement (positive = moved up)", () => {
  const prev = buildSnapshot({ AL_East: div(t(111, 35, 26), t(147, 34, 27)) }, "2026-06-01");
  const cur = buildSnapshot({ AL_East: div(t(147, 41, 22), t(111, 36, 27)) }, "2026-06-02");
  const d = diffRanks(cur, prev);
  assert.equal(d[147].rankDelta, 1);  // was 2nd, now 1st -> up 1
  assert.equal(d[111].rankDelta, -1); // was 1st, now 2nd -> down 1
  assert.equal(d[147].wDelta, 7);
  assert.equal(d[147].isNew, false);
});

test("diffRanks flags teams that are new or changed division", () => {
  const prev = buildSnapshot({ AL_East: div(t(147, 1, 1)) }, "2026-06-01");
  const cur = buildSnapshot({ AL_East: div(t(147, 1, 1)), AL_West: div(t(117, 2, 0)) }, "2026-06-02");
  const d = diffRanks(cur, prev);
  assert.equal(d[117].isNew, true);   // not in prev
  assert.equal(d[147].isNew, false);
});

test("mostRecentBefore returns the latest snapshot strictly before the date", () => {
  const hist = [
    { date: "2026-05-30", ranks: {} },
    { date: "2026-06-01", ranks: {} },
    { date: "2026-06-02", ranks: {} }
  ];
  assert.equal(mostRecentBefore(hist, "2026-06-02").date, "2026-06-01");
  assert.equal(mostRecentBefore(hist, "2026-05-30"), null); // nothing strictly before
  assert.equal(mostRecentBefore([], "2026-06-02"), null);
});

test("store upserts same-date and prunes to the rolling window", () => {
  const store = createHistoryStore({ storage: fakeStorage(), maxDays: 3 });
  store.save({ date: "2026-06-01", ranks: { 1: { rank: 1 } } });
  store.save({ date: "2026-06-01", ranks: { 1: { rank: 2 } } }); // replace same date
  store.save({ date: "2026-06-02", ranks: {} });
  store.save({ date: "2026-06-03", ranks: {} });
  store.save({ date: "2026-06-04", ranks: {} }); // pushes 06-01 out (maxDays 3)
  const all = store.load();
  assert.deepEqual(all.map((s) => s.date), ["2026-06-02", "2026-06-03", "2026-06-04"]);
});

test("store.previousBefore finds yesterday; today's own save isn't 'previous'", () => {
  const store = createHistoryStore({ storage: fakeStorage() });
  store.save({ date: "2026-06-01", ranks: { 7: { rank: 3, div: "AL_East", w: 1, l: 1 } } });
  store.save({ date: "2026-06-02", ranks: { 7: { rank: 1, div: "AL_East", w: 3, l: 1 } } });
  const prev = store.previousBefore("2026-06-02");
  assert.equal(prev.date, "2026-06-01");
});

test("buildSnapshot stores run differential; teamSeries returns it oldest->newest", () => {
  const s1 = buildSnapshot({ AL_East: [{ teamId: 147, wins: 30, losses: 20, runsScored: 150, runsAllowed: 120 }] }, "2026-06-01");
  const s2 = buildSnapshot({ AL_East: [{ teamId: 147, wins: 33, losses: 20, runsScored: 170, runsAllowed: 125 }] }, "2026-06-02");
  assert.equal(s1.ranks[147].rd, 30);
  assert.equal(s2.ranks[147].rd, 45);
  // unsorted input -> sorted by date
  assert.deepEqual(teamSeries([s2, s1], 147, "rd"), [30, 45]);
  assert.deepEqual(teamSeries([s1, s2], 147, "rank"), [1, 1]);
  assert.deepEqual(teamSeries([s1, s2], 999, "rd"), []); // absent team
});

test("works without storage (no memory, never throws)", () => {
  const store = createHistoryStore({ storage: null });
  store.save({ date: "2026-06-02", ranks: {} });
  assert.deepEqual(store.load(), []);
  assert.equal(store.previousBefore("2026-06-02"), null);
});
