import { test } from "node:test";
import assert from "node:assert/strict";
import { legacyRedirectPath } from "./legacyPaths.ts";

test("legacy handle-prefixed paths lose the handle", () => {
  assert.equal(legacyRedirectPath("/u38403/shop"), "/shop");
  assert.equal(legacyRedirectPath("/tranimal/haul"), "/haul");
  assert.equal(legacyRedirectPath("/lillis/haul/2"), "/haul/2");
  assert.equal(legacyRedirectPath("/ori/product/prada/abc1234"), "/product/prada/abc1234");
  assert.equal(legacyRedirectPath("/u96"), "/");
});

test("current routes and system paths are untouched", () => {
  for (const p of [
    "/",
    "/shop",
    "/haul",
    "/haul/2",
    "/welcome",
    "/profile",
    "/factories",
    "/product/prada/abc1234",
    "/login",
    "/setup/tok123",
    "/forgot",
    "/reset/tok123",
    "/account/email",
    "/admin",
    "/admin/friends/xyz",
    "/request",
    "/api/whatever",
    "/favicon.ico",
    "/opengraph-image.png",
  ]) {
    assert.equal(legacyRedirectPath(p), null, p);
  }
});
