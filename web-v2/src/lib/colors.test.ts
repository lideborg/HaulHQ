import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeColor, COLOR_FAMILIES } from "./colors.ts";

test("maps common exact colors to their family", () => {
  assert.equal(normalizeColor("Black"), "black");
  assert.equal(normalizeColor("White"), "white");
  assert.equal(normalizeColor("Grey"), "grey");
  assert.equal(normalizeColor("Blue"), "blue");
  assert.equal(normalizeColor("Brown"), "brown");
  assert.equal(normalizeColor("Beige"), "beige");
});

test("rolls messy variants into the right family", () => {
  assert.equal(normalizeColor("Washed Black"), "black");
  assert.equal(normalizeColor("Heather Grey"), "grey");
  assert.equal(normalizeColor("Vintage White"), "white");
  assert.equal(normalizeColor("Faded Blue"), "blue");
  assert.equal(normalizeColor("Navy"), "blue");
  assert.equal(normalizeColor("Cognac"), "brown");
  assert.equal(normalizeColor("Khaki"), "beige");
  assert.equal(normalizeColor("Olive Green"), "green");
  assert.equal(normalizeColor("Burgundy"), "red");
  assert.equal(normalizeColor("Mud Red"), "red");
});

test("two-tone / slashed / patterned strings become multi", () => {
  assert.equal(normalizeColor("Black/White"), "multi");
  assert.equal(normalizeColor("Black & White"), "multi");
  assert.equal(normalizeColor("Camo"), "multi");
  assert.equal(normalizeColor("Grey Multi"), "multi");
});

test("empty / unknown falls back to multi and never throws", () => {
  assert.equal(normalizeColor(""), "multi");
  assert.equal(normalizeColor("Qianxing"), "multi");
  // @ts-expect-error runtime guard for non-strings
  assert.equal(normalizeColor(undefined), "multi");
});

test("COLOR_FAMILIES has 12 unique slugs in volume order", () => {
  const slugs = COLOR_FAMILIES.map((f) => f.slug);
  assert.equal(slugs.length, 12);
  assert.equal(new Set(slugs).size, 12);
  assert.equal(slugs[0], "black");
});
