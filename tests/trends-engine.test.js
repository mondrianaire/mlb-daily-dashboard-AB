// tests/trends-engine.test.js
// Unit tests for the pure weekly-trends computation.
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWeeklyTrends } from "../trends-engine.js";

function gr(teamId, gameDate, runsScored, runsAllowed) {
  return {
    teamId,
    gameDate,
    isWin: runsScored > runsAllowed,
    runsScored,
    runsAllowed
  };
}

test("throws when input is not a Map", () => {
  assert.throws(() => computeWeeklyTrends([]), TypeError);
  assert.throws(() => computeWeeklyTrends({}), TypeError);
  assert.throws(() => computeWeeklyTrends(null), TypeError);
});

test("throws when a team's value is not an array", () => {
  const m = new Map([[100, "nope"]]);
  assert.throws(() => computeWeeklyTrends(m), TypeError);
});

test("empty game list yields a zeroed trend", () => {
  const m = new Map([[110, []]]);
  const [t] = computeWeeklyTrends(m);
  assert.equal(t.teamId, 110);
  assert.equal(t.last7W, 0);
  assert.equal(t.last7L, 0);
  assert.equal(t.runDiff7, 0);
  assert.equal(t.streak, null);
  assert.deepEqual(t.sparklinePoints, []);
});

test("counts wins/losses and run differential", () => {
  const m = new Map([[
    147,
    [
      gr(147, "2026-05-01", 5, 2), // W, +3
      gr(147, "2026-05-02", 1, 4), // L, -3
      gr(147, "2026-05-03", 7, 6)  // W, +1
    ]
  ]]);
  const [t] = computeWeeklyTrends(m);
  assert.equal(t.last7W, 2);
  assert.equal(t.last7L, 1);
  assert.equal(t.runDiff7, 1); // +3 -3 +1
});

test("sparkline is the cumulative run differential per game", () => {
  const m = new Map([[
    147,
    [
      gr(147, "2026-05-01", 5, 2), // +3 -> 3
      gr(147, "2026-05-02", 1, 4), // -3 -> 0
      gr(147, "2026-05-03", 7, 6)  // +1 -> 1
    ]
  ]]);
  const [t] = computeWeeklyTrends(m);
  assert.deepEqual(t.sparklinePoints, [3, 0, 1]);
});

test("streak reflects the trailing run of same-result games", () => {
  const win2 = new Map([[
    1,
    [gr(1, "2026-05-01", 1, 9), gr(1, "2026-05-02", 5, 0), gr(1, "2026-05-03", 6, 1)]
  ]]);
  assert.equal(computeWeeklyTrends(win2)[0].streak, "W2");

  const loss1 = new Map([[
    1,
    [gr(1, "2026-05-01", 9, 1), gr(1, "2026-05-02", 0, 5)]
  ]]);
  assert.equal(computeWeeklyTrends(loss1)[0].streak, "L1");
});

test("defensively sorts unsorted input by gameDate before computing", () => {
  const m = new Map([[
    1,
    [
      gr(1, "2026-05-03", 7, 6), // last chronologically: W
      gr(1, "2026-05-01", 5, 2),
      gr(1, "2026-05-02", 1, 4)
    ]
  ]]);
  const [t] = computeWeeklyTrends(m);
  // After sort: +3, -3, +1 -> cumulative [3,0,1], trailing result W1
  assert.deepEqual(t.sparklinePoints, [3, 0, 1]);
  assert.equal(t.streak, "W1");
});

test("output is sorted by teamId ascending and stable in length", () => {
  const m = new Map([
    [147, [gr(147, "2026-05-01", 1, 0)]],
    [108, [gr(108, "2026-05-01", 0, 1)]],
    [110, []]
  ]);
  const out = computeWeeklyTrends(m);
  assert.deepEqual(out.map((t) => t.teamId), [108, 110, 147]);
});
