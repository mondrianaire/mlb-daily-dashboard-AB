// tests/rankings-engine.test.js
// Unit tests for the pure standings-projection computation.
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRankings } from "../rankings-engine.js";

function se(teamId, league, division, wins, losses, pct) {
  return {
    teamId,
    teamName: `Team ${teamId}`,
    teamAbbreviation: String(teamId),
    league,
    division,
    wins,
    losses,
    pct,
    gb: "-"
  };
}

test("throws when input is not an array", () => {
  assert.throws(() => computeRankings(null), TypeError);
  assert.throws(() => computeRankings({}), TypeError);
});

test("throws when an entry is not an object", () => {
  assert.throws(() => computeRankings([42]), TypeError);
});

test("always returns exactly six division buckets, even when empty", () => {
  const r = computeRankings([]);
  assert.deepEqual(
    Object.keys(r.divisionStandings).sort(),
    ["AL_Central", "AL_East", "AL_West", "NL_Central", "NL_East", "NL_West"]
  );
  for (const k of Object.keys(r.divisionStandings)) {
    assert.deepEqual(r.divisionStandings[k], []);
  }
});

test("buckets teams into the correct league_division key", () => {
  const data = [
    se(1, "AL", "East", 10, 5, 0.667),
    se(2, "NL", "West", 8, 7, 0.533)
  ];
  const r = computeRankings(data);
  assert.equal(r.divisionStandings.AL_East.length, 1);
  assert.equal(r.divisionStandings.AL_East[0].teamId, 1);
  assert.equal(r.divisionStandings.NL_West.length, 1);
  assert.equal(r.divisionStandings.NL_West[0].teamId, 2);
});

test("sorts a division by pct desc, tiebreak wins then teamId", () => {
  const data = [
    se(3, "AL", "East", 9, 6, 0.600),
    se(1, "AL", "East", 12, 3, 0.800),
    se(2, "AL", "East", 9, 6, 0.600) // tie with team 3 on pct+wins -> lower id first
  ];
  const r = computeRankings(data);
  assert.deepEqual(
    r.divisionStandings.AL_East.map((t) => t.teamId),
    [1, 2, 3]
  );
});

test("league standings include all of a league's teams sorted by pct", () => {
  const data = [
    se(1, "AL", "East", 10, 5, 0.667),
    se(2, "AL", "West", 12, 3, 0.800),
    se(3, "NL", "East", 8, 7, 0.533)
  ];
  const r = computeRankings(data);
  assert.deepEqual(r.leagueStandings.AL.map((t) => t.teamId), [2, 1]);
  assert.deepEqual(r.leagueStandings.NL.map((t) => t.teamId), [3]);
});

test("wild card excludes division leaders and takes top 3 by pct", () => {
  const data = [
    // AL East: leader 1, then 2
    se(1, "AL", "East", 14, 1, 0.933),
    se(2, "AL", "East", 10, 5, 0.667),
    // AL Central: leader 3, then 4
    se(3, "AL", "Central", 13, 2, 0.867),
    se(4, "AL", "Central", 11, 4, 0.733),
    // AL West: leader 5, then 6 and 7
    se(5, "AL", "West", 12, 3, 0.800),
    se(6, "AL", "West", 9, 6, 0.600),
    se(7, "AL", "West", 8, 7, 0.533)
  ];
  const r = computeRankings(data);
  const wcIds = r.wildCard.AL.map((t) => t.teamId);
  // Leaders 1,3,5 excluded; remaining non-leaders by pct: 4(.733),2(.667),6(.600),7(.533) -> top 3
  assert.deepEqual(wcIds, [4, 2, 6]);
  assert.equal(wcIds.length, 3);
  for (const leader of [1, 3, 5]) {
    assert.ok(!wcIds.includes(leader), `leader ${leader} must not be in wild card`);
  }
});
