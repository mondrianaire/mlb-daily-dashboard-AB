// tests/scoreboard-engine.test.js
// Unit tests for live-scoreboard classification + state description.
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  classifyGame, describeState, leader, summarize, sortForDisplay
} from "../scoreboard-engine.js";

function g(over = {}) {
  return {
    gameId: 1, gameDate: "2026-06-02T23:05:00Z",
    away: { teamId: 147, abbr: "NYY", score: null },
    home: { teamId: 111, abbr: "BOS", score: null },
    detailedState: "Scheduled", abstractState: "Preview",
    inning: null, inningState: null, outs: null, ...over
  };
}

test("classifyGame maps abstract/detailed states", () => {
  assert.equal(classifyGame(g({ abstractState: "Live" })), "live");
  assert.equal(classifyGame(g({ abstractState: "Final" })), "final");
  assert.equal(classifyGame(g({ abstractState: "Preview", detailedState: "Scheduled" })), "scheduled");
  assert.equal(classifyGame(g({ abstractState: "Preview", detailedState: "Warmup" })), "warmup");
  assert.equal(classifyGame(g({ abstractState: "Preview", detailedState: "Postponed" })), "other");
});

test("describeState formats a live game with inning + outs", () => {
  assert.equal(
    describeState(g({ abstractState: "Live", inning: 7, inningState: "Top", outs: 2 })),
    "Top 7 · 2 outs"
  );
  assert.equal(
    describeState(g({ abstractState: "Live", inning: 9, inningState: "Bottom", outs: 1 })),
    "Bot 9 · 1 out"
  );
  // Between halves — no outs shown.
  assert.equal(
    describeState(g({ abstractState: "Live", inning: 5, inningState: "Middle", outs: 3 })),
    "Mid 5"
  );
});

test("describeState marks extra-inning finals", () => {
  assert.equal(describeState(g({ abstractState: "Final", inning: 9 })), "Final");
  assert.equal(describeState(g({ abstractState: "Final", inning: 11 })), "Final/11");
});

test("describeState returns empty for scheduled (caller shows time)", () => {
  assert.equal(describeState(g()), "");
  assert.equal(describeState(g({ detailedState: "Warmup", abstractState: "Preview" })), "Warmup");
});

test("leader identifies the team ahead, null when tied/absent", () => {
  assert.equal(leader(g({ away: { score: 5 }, home: { score: 2 } })), "away");
  assert.equal(leader(g({ away: { score: 1 }, home: { score: 4 } })), "home");
  assert.equal(leader(g({ away: { score: 3 }, home: { score: 3 } })), null);
  assert.equal(leader(g()), null);
});

test("summarize counts live and final", () => {
  const s = summarize([
    g({ abstractState: "Live" }),
    g({ abstractState: "Live" }),
    g({ abstractState: "Final" }),
    g()
  ]);
  assert.equal(s.total, 4);
  assert.equal(s.liveCount, 2);
  assert.equal(s.finalCount, 1);
  assert.ok(s.games.every((x) => typeof x.cls === "string"));
});

test("sortForDisplay puts live first, then scheduled, then final", () => {
  const ordered = sortForDisplay([
    g({ gameId: 1, abstractState: "Final" }),
    g({ gameId: 2, abstractState: "Preview", detailedState: "Scheduled" }),
    g({ gameId: 3, abstractState: "Live" })
  ]);
  assert.deepEqual(ordered.map((x) => x.gameId), [3, 2, 1]);
});
