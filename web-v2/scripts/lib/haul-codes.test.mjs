import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, makeCode, isValidHandle } from "./haul-codes.mjs";

test("slugify lowercases, dashes non-alnum, trims", () => {
  assert.equal(slugify("Saint Laurent"), "saint-laurent");
  assert.equal(slugify("Enfants Riches Déprimés"), "enfants-riches-d-prim-s");
  assert.equal(slugify("  The Row  "), "the-row");
  assert.equal(slugify("Miu Miu x New Balance"), "miu-miu-x-new-balance");
});

test("makeCode is 5 base62 chars", () => {
  const seq = [0, 0.5, 0.99, 0.2, 0.7];
  let i = 0;
  const code = makeCode(() => seq[i++]);
  assert.match(code, /^[0-9a-zA-Z]{5}$/);
  assert.equal(code.length, 5);
});

test("isValidHandle enforces regex + reserved list", () => {
  assert.equal(isValidHandle("jan"), true);
  assert.equal(isValidHandle("ab"), true);
  assert.equal(isValidHandle("a"), false); // too short
  assert.equal(isValidHandle("Jan"), false); // uppercase
  assert.equal(isValidHandle("admin"), false); // reserved
  assert.equal(isValidHandle("has space"), false);
  assert.equal(isValidHandle("way-too-long-a-handle-here"), false); // >20
});
