// tests/magic-number.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { magicNumber, divisionMagic } from "../rankings-engine.js";

test("magicNumber = seasonGames + 1 - leaderWins - runnerUpLosses", () => {
  // 162-game season: leader 95 W, runner-up 60 L -> 163 - 95 - 60 = 8
  assert.equal(magicNumber(95, 60), 8);
  // already clinched -> floored at 0
  assert.equal(magicNumber(100, 70), 0);
  assert.equal(magicNumber(120, 80), 0);
});

test("magicNumber tolerates missing values and custom season length", () => {
  assert.equal(magicNumber(undefined, undefined), 163);
  assert.equal(magicNumber(50, 50, 60), 61 - 100 < 0 ? 0 : 61 - 100); // clamped to 0
});

test("divisionMagic uses leader vs runner-up; null for <2 teams", () => {
  const entries = [{ wins: 95, losses: 50 }, { wins: 88, losses: 60 }, { wins: 70, losses: 78 }];
  assert.equal(divisionMagic(entries), 163 - 95 - 60); // 8
  assert.equal(divisionMagic([{ wins: 95, losses: 50 }]), null);
  assert.equal(divisionMagic([]), null);
});
