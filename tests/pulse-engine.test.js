// tests/pulse-engine.test.js
// Unit tests for the trend-pulse selection (audit P3).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computePulse } from "../pulse-engine.js";

function tr(teamId, w, l, runDiff7) {
  return { teamId, last7W: w, last7L: l, runDiff7, streak: null, sparklinePoints: [] };
}

test("empty / no-games input yields nulls", () => {
  assert.deepEqual(computePulse([]), { hottest: null, coldest: null });
  assert.deepEqual(computePulse([tr(1, 0, 0, 0)]), { hottest: null, coldest: null });
  assert.deepEqual(computePulse(null), { hottest: null, coldest: null });
});

test("picks the best and worst run differential among teams that played", () => {
  const { hottest, coldest } = computePulse([
    tr(1, 5, 1, 18),
    tr(2, 3, 3, 1),
    tr(3, 1, 5, -14),
    tr(9, 0, 0, 0)   // didn't play -> ignored
  ]);
  assert.equal(hottest.teamId, 1);
  assert.equal(coldest.teamId, 3);
});

test("a single qualifying team is the hottest, with no coldest contrast", () => {
  const { hottest, coldest } = computePulse([tr(7, 4, 2, 9), tr(8, 0, 0, 0)]);
  assert.equal(hottest.teamId, 7);
  assert.equal(coldest, null);
});

test("ties break deterministically (wins, then teamId for hottest)", () => {
  const { hottest } = computePulse([tr(5, 4, 2, 10), tr(2, 4, 2, 10), tr(3, 3, 3, 10)]);
  // all +10; most wins (4) shared by 5 and 2 -> lower teamId (2) wins
  assert.equal(hottest.teamId, 2);
});

test("coldest ties break on losses, then teamId", () => {
  const { coldest } = computePulse([tr(1, 6, 0, 20), tr(4, 1, 5, -8), tr(6, 2, 5, -8)]);
  // both -8; more losses shared (5) -> lower teamId (4)
  assert.equal(coldest.teamId, 4);
});
