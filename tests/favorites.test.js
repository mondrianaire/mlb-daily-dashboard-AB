// tests/favorites.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { createFavorites, isFavorite, sortFavoritesFirst } from "../favorites.js";

function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) };
}

test("toggle adds then removes; list + has reflect state", () => {
  const f = createFavorites({ storage: fakeStorage() });
  assert.deepEqual(f.list(), []);
  f.toggle(147);
  assert.deepEqual(f.list(), [147]);
  assert.equal(f.has(147), true);
  assert.equal(f.has(111), false);
  f.toggle("147"); // string id, same team
  assert.deepEqual(f.list(), []);
});

test("persists across instances sharing storage", () => {
  const s = fakeStorage();
  createFavorites({ storage: s }).toggle(119);
  assert.deepEqual(createFavorites({ storage: s }).list(), [119]);
});

test("ignores non-numeric ids", () => {
  const f = createFavorites({ storage: fakeStorage() });
  assert.deepEqual(f.toggle("abc"), []);
});

test("isFavorite handles number/string", () => {
  assert.equal(isFavorite([147, 119], 147), true);
  assert.equal(isFavorite([147], "147"), true);
  assert.equal(isFavorite([147], 111), false);
});

test("sortFavoritesFirst is stable and groups favorites first", () => {
  const rows = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  const out = sortFavoritesFirst(rows, (r) => r.id, [3, 1]);
  assert.deepEqual(out.map((r) => r.id), [1, 3, 2, 4]); // favs in original order, then rest
});

test("works without storage (no-op, never throws)", () => {
  const f = createFavorites({ storage: null });
  assert.deepEqual(f.toggle(1), []);
  assert.deepEqual(f.list(), []);
});
