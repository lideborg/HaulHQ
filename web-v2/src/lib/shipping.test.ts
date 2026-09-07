import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateShipping, destinationName } from "./shipping.ts";

test("US estimate matches the calibrated receipts (9020g parcel ≈ $214 real)", () => {
  const est = estimateShipping(9020 / 1.18); // receipts are billed weight; undo the bridge
  assert.ok(est);
  // real $214.21 + 20% margin = $257 — the single figure should be close
  assert.ok(Math.abs(est.usd - 257) < 15, `usd ${est.usd}`);
});

test("destination factor: Sweden ≈ 1.3x the US estimate", () => {
  const us = estimateShipping(2500, "US");
  const se = estimateShipping(2500, "SE");
  assert.ok(us && se);
  const ratio = se.usd / us.usd;
  assert.ok(Math.abs(ratio - 1.3) < 0.02, `ratio ${ratio}`);
  assert.equal(se.chargeableKg, us.chargeableKg); // weight unchanged, only price
});

test("US and unknown/missing country default to the calibrated base", () => {
  const a = estimateShipping(2500);
  const b = estimateShipping(2500, "US");
  const c = estimateShipping(2500, "us");
  assert.deepEqual(a, b);
  assert.deepEqual(b, c);
});

test("non-US countries all get the international factor", () => {
  const se = estimateShipping(2500, "SE");
  const de = estimateShipping(2500, "DE");
  assert.deepEqual(se, de);
});

test("destinationName renders a human label from codes and free text", () => {
  assert.equal(destinationName("SE"), "Sweden");
  assert.equal(destinationName("US"), "United States");
  assert.equal(destinationName("SWEDEN"), "Sweden");
  assert.equal(destinationName("Sweden"), "Sweden");
  assert.equal(destinationName(undefined), null);
  assert.equal(destinationName("??"), null);
});

test("free-text countries route correctly (profile stores what friends typed)", () => {
  const us = estimateShipping(2500, "United States");
  const usBare = estimateShipping(2500, "US");
  const se = estimateShipping(2500, "SWEDEN");
  assert.deepEqual(us, usBare);
  assert.ok(se && us && se.usd > us.usd);
});

test("zero grams still returns null", () => {
  assert.equal(estimateShipping(0, "SE"), null);
});
