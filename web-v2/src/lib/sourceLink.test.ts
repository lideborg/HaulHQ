import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySourceLink, superbuyWrap, yupooAlbumUrl, yupooSubdomain } from "./sourceLink.ts";

test("yupoo album link", () => {
  const r = classifySourceLink("https://99team.x.yupoo.com/albums/196799387?uid=1&isSubCate=false");
  assert.equal(r?.kind, "yupoo_album");
  assert.equal(r?.itemId, "196799387");
  assert.equal(r?.shop, "99team");
});

test("yupoo shop / category link", () => {
  const r = classifySourceLink("https://deateath.x.yupoo.com/categories/4568344");
  assert.equal(r?.kind, "yupoo_shop");
  assert.equal(r?.shop, "deateath");
  assert.equal(r?.itemId, null);
});

test("weidian item link", () => {
  const r = classifySourceLink("https://weidian.com/item.html?itemID=7405328504&spider_token=4a2c");
  assert.equal(r?.kind, "weidian");
  assert.equal(r?.itemId, "7405328504");
});

test("taobao item link", () => {
  const r = classifySourceLink("https://item.taobao.com/item.htm?id=929261115961&ali_trackid=x");
  assert.equal(r?.kind, "taobao");
  assert.equal(r?.itemId, "929261115961");
});

test("superbuy wrapper unwraps to the inner link", () => {
  const inner = "https://weidian.com/item.html?itemID=7405328504";
  const r = classifySourceLink(`https://www.superbuy.com/en/page/buy/?from=search-input&url=${encodeURIComponent(inner)}`);
  assert.equal(r?.kind, "weidian");
  assert.equal(r?.itemId, "7405328504");
  assert.equal(r?.url, inner);
});

test("junk is rejected", () => {
  assert.equal(classifySourceLink("not a url"), null);
  assert.equal(classifySourceLink("https://google.com/whatever"), null);
  assert.equal(classifySourceLink("ftp://weidian.com/item.html?itemID=1"), null);
  assert.equal(classifySourceLink("https://www.superbuy.com/en/page/buy/"), null);
});

test("superbuyWrap builds the buy-page wrapper", () => {
  assert.equal(
    superbuyWrap("https://weidian.com/item.html?itemID=1"),
    "https://www.superbuy.com/en/page/buy/?from=search-input&url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D1",
  );
});

test("yupooSubdomain", () => {
  assert.equal(yupooSubdomain("https://mvt-shop01.x.yupoo.com/albums"), "mvt-shop01");
  assert.equal(yupooSubdomain("https://deateath.x.yupoo.com/"), "deateath");
  assert.equal(yupooSubdomain("https://weidian.com/item.html?itemID=1"), null);
  assert.equal(yupooSubdomain(null), null);
});

test("taobao short links accepted as taobao", () => {
  const r = classifySourceLink("https://e.tb.cn/h.hg66Nab2zkpGkNL?tk=x");
  assert.equal(r?.kind, "taobao");
  assert.equal(r?.itemId, null);
  assert.equal(classifySourceLink("https://m.tb.cn/h.abc")?.kind, "taobao");
});

test("goofish and 1688 accepted as other", () => {
  assert.equal(classifySourceLink("https://www.goofish.com/item?id=1")?.kind, "other");
  assert.equal(classifySourceLink("https://detail.1688.com/offer/123.html")?.kind, "other");
});

test("yupoo photo permalink classified as yupoo_photo with ids", () => {
  const r = classifySourceLink("https://charlesking77.x.yupoo.com/112310886?uid=1");
  assert.equal(r?.kind, "yupoo_photo");
  assert.equal(r?.itemId, "112310886");
  assert.equal(r?.shop, "charlesking77");
});

test("yupoo non-numeric paths still classified as yupoo_shop", () => {
  assert.equal(classifySourceLink("https://deateath.x.yupoo.com/categories/123")?.kind, "yupoo_shop");
  assert.equal(classifySourceLink("https://deateath.x.yupoo.com/search/album?q=x")?.kind, "yupoo_shop");
  // short numeric run (< 6 digits) is not a photo id
  assert.equal(classifySourceLink("https://deateath.x.yupoo.com/123")?.kind, "yupoo_shop");
});

test("superbuy-wrapped photo permalink unwraps to yupoo_photo", () => {
  const wrapped =
    "https://www.superbuy.com/en/page/buy/?url=" +
    encodeURIComponent("https://charlesking77.x.yupoo.com/112310886");
  assert.equal(classifySourceLink(wrapped)?.kind, "yupoo_photo");
});

test("yupooAlbumUrl carries uid=1 (yupoo 404s without it)", () => {
  assert.equal(
    yupooAlbumUrl("charlesking77", "244957347"),
    "https://charlesking77.x.yupoo.com/albums/244957347?uid=1",
  );
});
