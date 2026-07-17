import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCostCny, deriveSizes, deriveSizeGuide, firstSentence,
  localImagePaths, mapFavorite,
} from "./map-favorite.mjs";

test("parseCostCny reads the first yen amount", () => {
  assert.equal(parseCostCny("¥869 (~$137.28)"), 869);
  assert.equal(parseCostCny("¥215-237 ($31.53-34.71)"), 215);
  assert.equal(parseCostCny("~$76-78 (¥520-535)"), 520);
  assert.equal(parseCostCny("¥1,880"), 1880);
  assert.equal(parseCostCny("$50 only"), null);
  assert.equal(parseCostCny(null), null);
});

test("deriveSizes: chart sizes, then target_size, then One Size", () => {
  assert.deepEqual(deriveSizes({ size_chart: { sizes: ["M", "L"] } }), ["M", "L"]);
  assert.deepEqual(deriveSizes({ target_size: "XXL" }), ["XXL"]);
  assert.deepEqual(deriveSizes({}), ["One Size"]);
});

test("deriveSizeGuide maps chart, drops source_image, null without measurements", () => {
  const g = deriveSizeGuide({ size_chart: {
    unit: "cm", note: "n", sizes: ["M", "L"],
    measurements: { length: [48, 50] }, source_image: "images/x/01.jpg",
  }});
  assert.deepEqual(g, { unit: "cm", note: "n", sizes: ["M", "L"], measurements: { length: [48, 50] } });
  assert.equal(deriveSizeGuide({ size_chart: { sizes: ["M"] } }), null);
  assert.equal(deriveSizeGuide({}), null);
});

test("firstSentence trims notes", () => {
  assert.equal(firstSentence("First bit. Second bit."), "First bit.");
  assert.equal(firstSentence(null), null);
});

test("localImagePaths drops size-chart images", () => {
  assert.deepEqual(
    localImagePaths({ local_image_paths: ["images/a/01.jpg", "images/a/size-chart.png"] }),
    ["images/a/01.jpg"],
  );
});

test("mapFavorite computes usd price and strips (rep)", () => {
  const row = mapFavorite({
    title: "T", brand: "Prada (rep)", category: "bag", seller: "S",
    source_url: "https://x", source: "taobao", price: "¥100",
    notes: "One. Two.", sizing: "note",
  }, 0.14);
  assert.equal(row.brand, "Prada");
  assert.equal(row.cost_cny, 100);
  assert.equal(row.price_usd, 16.8); // 100 * 0.14 * 1.2
  assert.equal(row.source_link, "https://x");
  assert.equal(row.source_platform, "taobao");
  assert.deepEqual(row.size_options, ["One Size"]);
  assert.equal(row.admin_sizing_note, "note");
  assert.equal(row.published, true);
});
