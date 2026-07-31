import { test } from "node:test";
import assert from "node:assert/strict";
import { displaySellerName, groupFactories } from "./factories.ts";
import type { Seller } from "./types.ts";

const seller = (name: string, brands: string[], yupoo: string | null): Seller => ({
  id: name,
  name,
  brands,
  yupoo_url: yupoo,
  superbuy_store: null,
  notes: null,
});

const SELLERS = [
  seller("MVT", ["Supreme", "Gucci"], "https://mvt-shop01.x.yupoo.com/albums"),
  seller("deateath", ["Our Legacy", "Prada"], "https://deateath.x.yupoo.com/"),
  seller("Frank Chang", ["The Row"], null),
];

const LINKS = [
  { seller: "deateath (Yupoo)", brand: "Prada", alias: "P⭐A⭐A", url: "https://deateath.x.yupoo.com/categories/4568344" },
  { seller: "yolo66 (Yupoo)", brand: "Prada", alias: null, url: "https://yolo66.x.yupoo.com/categories/111" },
];

test("first letter capitalized, digits untouched", () => {
  assert.equal(displaySellerName("deateath"), "Deateath");
  assert.equal(displaySellerName("99team"), "99team");
  assert.equal(displaySellerName("MVT"), "MVT");
});

test("no search term: every seller gets a card, no links", () => {
  const cards = groupFactories(SELLERS, [], "");
  assert.equal(cards.length, 3);
  assert.ok(cards.every((c) => c.links.length === 0));
});

test("search groups links onto sellers by yupoo subdomain", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  const deateath = cards.find((c) => c.displayName === "Deateath");
  assert.equal(deateath?.links.length, 1);
  assert.equal(deateath?.links[0].brand, "Prada");
});

test("search filters to matching sellers; link-only shops get synthetic cards", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  // deateath (brands + link), yolo66 (link-only, not in sellers table)
  assert.deepEqual(
    cards.map((c) => c.displayName).sort(),
    ["Deateath", "Yolo66"],
  );
  const yolo = cards.find((c) => c.displayName === "Yolo66");
  assert.equal(yolo?.yupooUrl, "https://yolo66.x.yupoo.com");
});

test("brands-array match works without any brand link", () => {
  const cards = groupFactories(SELLERS, [], "supreme");
  assert.deepEqual(cards.map((c) => c.displayName), ["MVT"]);
});

test("cards with direct links sort before brands-only matches", () => {
  const cards = groupFactories(SELLERS, LINKS, "prada");
  assert.equal(cards[0].links.length > 0, true);
});
