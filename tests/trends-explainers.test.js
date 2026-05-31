// tests/trends-explainers.test.js
// Unit tests for the Trends-tab chart explainers (OPP-003).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  explainRSRA, explainOpsEra, explainHomeRoad, explainPowerDisc
} from "../trends-explainers.js";

function team(id, abbr, props = {}) {
  return {
    id, abbr,
    rs: 0, ra: 0, diff: 0, ops: 0, era: 0, hr: 0, kp9: 0, bbp9: 1,
    homeW: 0, awayW: 0, ...props
  };
}

// ---------- RS vs RA ----------
test("RSRA names the best and worst run differential", () => {
  const teams = [
    team(1, "AAA", { rs: 500, ra: 380, diff: 120 }),
    team(2, "BBB", { rs: 350, ra: 530, diff: -180 }),
    team(3, "CCC", { rs: 420, ra: 410, diff: 10 })
  ];
  const out = explainRSRA(teams);
  assert.match(out, /AAA leads run differential \(\+120\)/);
  assert.match(out, /BBB most outscored \(-180\)/);
});

test("RSRA returns empty string when no run data", () => {
  assert.equal(explainRSRA([team(1, "AAA")]), "");
  assert.equal(explainRSRA([]), "");
});

// ---------- OPS vs ERA ----------
test("OpsEra calls out a team elite on both sides", () => {
  const teams = [
    team(1, "AAA", { ops: 0.812, era: 3.10 }),
    team(2, "BBB", { ops: 0.700, era: 4.50 })
  ];
  const out = explainOpsEra(teams);
  assert.match(out, /AAA is elite on both sides/);
  assert.match(out, /OPS \.812/);
  assert.match(out, /ERA 3\.10/);
});

test("OpsEra names separate bat and arm leaders when different", () => {
  const teams = [
    team(1, "BAT", { ops: 0.820, era: 4.80 }),
    team(2, "ARM", { ops: 0.690, era: 3.05 })
  ];
  const out = explainOpsEra(teams);
  assert.match(out, /BAT tops the bats \(OPS \.820\)/);
  assert.match(out, /ARM owns the best ERA \(3\.05\)/);
});

test("OpsEra returns empty when neither stat present", () => {
  assert.equal(explainOpsEra([team(1, "AAA")]), "");
});

// ---------- Home vs Road ----------
test("HomeRoad reports the biggest home edge", () => {
  const teams = [
    team(1, "HOM", { homeW: 10, awayW: 3 }),
    team(2, "BAL", { homeW: 6, awayW: 6 })
  ];
  const out = explainHomeRoad(teams);
  assert.match(out, /HOM has the biggest home edge \(10 home vs 3 road wins/);
});

test("HomeRoad falls back to road-warriors when no home edge exists", () => {
  const teams = [team(1, "RDW", { homeW: 2, awayW: 9 })];
  const out = explainHomeRoad(teams);
  assert.match(out, /RDW are road warriors \(9 road vs 2 home wins/);
});

test("HomeRoad returns empty with no games", () => {
  assert.equal(explainHomeRoad([team(1, "AAA")]), "");
});

// ---------- Power vs Discipline ----------
test("PowerDisc names the HR leader and the best K/BB command", () => {
  const teams = [
    team(1, "PWR", { hr: 230, kp9: 8.0, bbp9: 4.0 }),   // K/BB 2.0
    team(2, "CMD", { hr: 150, kp9: 9.9, bbp9: 3.0 })    // K/BB 3.3
  ];
  const out = explainPowerDisc(teams);
  assert.match(out, /PWR leads in power \(230 HR\)/);
  assert.match(out, /CMD has the sharpest command \(3\.30 K\/BB\)/);
});

test("PowerDisc combines into one clause when a team leads both", () => {
  const teams = [
    team(1, "BOTH", { hr: 220, kp9: 10, bbp9: 2.5 }), // most HR and best K/BB (4.0)
    team(2, "MEH", { hr: 150, kp9: 8, bbp9: 4.0 })
  ];
  const out = explainPowerDisc(teams);
  assert.match(out, /BOTH leads in both power \(220 HR\) and command \(4\.00 K\/BB\)/);
});

test("PowerDisc returns empty when no power/command data", () => {
  assert.equal(explainPowerDisc([team(1, "AAA", { bbp9: 0 })]), "");
});

// ---------- determinism ----------
test("ties break deterministically by lower teamId", () => {
  const teams = [
    team(5, "EEE", { rs: 100, ra: 50, diff: 50 }),
    team(2, "BBB", { rs: 100, ra: 50, diff: 50 }),  // ties EEE for best; lower id wins
    team(9, "CCC", { rs: 40, ra: 70, diff: -30 })   // clear worst
  ];
  assert.match(explainRSRA(teams), /BBB leads run differential \(\+50\)/);
  assert.match(explainRSRA(teams), /CCC most outscored \(-30\)/);
});
