import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ftInToCm, lbsToKg, jeansWaistToCm, shoeToFootCm,
  estimateChestCm, estimateWaistCm, estimateFootCm,
} from "./sizing.ts";

test("unit conversions", () => {
  assert.equal(ftInToCm(5, 11), 180.3);
  assert.equal(lbsToKg(165), 74.8);
  assert.equal(jeansWaistToCm(32), 86.4); // (32+2)*2.54, vanity offset
});

test("shoe size to foot cm", () => {
  assert.equal(shoeToFootCm("us", 9, "male"), 26.8);
  assert.equal(shoeToFootCm("us", 8, "male"), 26.0);
  assert.equal(shoeToFootCm("eu", 42), 26.7);
  assert.equal(shoeToFootCm("eu", 41), 26.0);
  // women's US runs 1.5 sizes offset from men's on the same last
  assert.equal(shoeToFootCm("us", 8, "female"), shoeToFootCm("us", 6.5, "male"));
  assert.equal(shoeToFootCm("us", NaN, "male"), null);
});

test("chest estimation from height/weight/gender", () => {
  // male anchors: 180/75 ≈ 99, 170/60 ≈ 89, 190/95 ≈ 112 (±2cm)
  const est = (h: number, w: number, g: "male" | "female") =>
    estimateChestCm({ gender: g, height_cm: h, weight_kg: w })!;
  assert.ok(Math.abs(est(180, 75, "male") - 99) <= 2);
  assert.ok(Math.abs(est(170, 60, "male") - 89) <= 2);
  assert.ok(Math.abs(est(190, 95, "male") - 112) <= 2);
  assert.ok(est(170, 60, "female") < est(170, 60, "male"));
  // missing inputs → null
  assert.equal(estimateChestCm({ height_cm: 180 }), null);
});

test("explicit measurements override estimates", () => {
  const m = {
    gender: "male" as const, height_cm: 180, weight_kg: 75,
    jeans_waist_in: 32, shoe: { system: "us" as const, value: 9 },
    explicit: { chest_cm: 104, foot_cm: 27.2 },
  };
  assert.equal(estimateChestCm(m), 104);
  assert.equal(estimateFootCm(m), 27.2);
  assert.equal(estimateWaistCm(m), 86.4); // no explicit waist → jeans-derived
});

test("estimateWaistCm and estimateFootCm fall back to null", () => {
  assert.equal(estimateWaistCm({}), null);
  assert.equal(estimateFootCm({}), null);
});
