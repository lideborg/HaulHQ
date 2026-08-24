import { test } from "node:test";
import assert from "node:assert/strict";
import { parseYupooAlbum, parseWeidianItem, yupooParentAlbum } from "./sourceParse.ts";

const YUPOO_HTML = `<!doctype html><html><head>
<meta property="og:title" content="TR* 24ss suede loafers ¥560 | Yupoo">
<meta property="og:image" content="//photo.yupoo.com/99team/abc123/big.jpg">
<title>TR* 24ss suede loafers ¥560 | Yupoo</title>
</head><body></body></html>`;

test("yupoo: title from og:title, pipe-suffix stripped, price from ¥", () => {
  const r = parseYupooAlbum(YUPOO_HTML);
  assert.equal(r.title, "TR* 24ss suede loafers ¥560");
  assert.equal(r.imageUrl, "https://photo.yupoo.com/99team/abc123/big.jpg");
  assert.equal(r.priceCny, 560);
});

test("yupoo: strips full multi-pipe suffix from real og:title", () => {
  const html = `<html><head>
<meta property="og:title" content="item OF0391 Crochet tote bag | 相册 | happywhale | Supplier Product Catalog">
</head></html>`;
  const r = parseYupooAlbum(html);
  assert.equal(r.title, "item OF0391 Crochet tote bag");
});

test("yupoo: falls back to <title>, null price when absent", () => {
  const html = `<html><head><title>Plain album | Yupoo</title></head></html>`;
  const r = parseYupooAlbum(html);
  assert.equal(r.title, "Plain album");
  assert.equal(r.imageUrl, null);
  assert.equal(r.priceCny, null);
});

const WEIDIAN_HTML = `<html><head>
<meta name="og:title" content="The Row 平底穆勒鞋">
</head><body><script>window.__DATA={"itemMainPic":"//img.weidian.com/x/y.jpg","price":"268.00"}</script></body></html>`;

test("weidian: title, protocol-relative image, embedded price", () => {
  const r = parseWeidianItem(WEIDIAN_HTML);
  assert.equal(r.title, "The Row 平底穆勒鞋");
  assert.equal(r.imageUrl, "https://img.weidian.com/x/y.jpg");
  assert.equal(r.priceCny, 268);
});

test("weidian: all-null on unparseable html", () => {
  const r = parseWeidianItem("<html><body>captcha</body></html>");
  assert.deepEqual(r, { title: null, imageUrl: null, priceCny: null });
});

test("yupooParentAlbum: pulls album id from a photo permalink page", () => {
  const html = `<html><body>
    <a href="/albums/244957347?uid=1&referrercate=1">back to album</a>
    <img src="https://photo.yupoo.com/charlesking77/abc/big.jpg">
  </body></html>`;
  assert.equal(yupooParentAlbum(html), "244957347");
});

test("yupooParentAlbum: null when the page names no album", () => {
  assert.equal(yupooParentAlbum("<html><body>photo only</body></html>"), null);
});
