import { test } from "node:test";
import assert from "node:assert/strict";
import { randomToken, hashPassword, verifyPassword } from "./auth.ts";

test("randomToken is 32 hex chars and unique", () => {
  const a = randomToken(), b = randomToken();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("password hashes, verifies, and never equals plaintext", async () => {
  const h = await hashPassword("hunter2");
  assert.notEqual(h, "hunter2");
  assert.equal(await verifyPassword("hunter2", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
});

test("normalizeEmail trims and lowercases", async () => {
  const { normalizeEmail } = await import("./auth.ts");
  assert.equal(normalizeEmail("  Foo@Bar.COM "), "foo@bar.com");
  assert.equal(normalizeEmail(""), "");
});

test("isEmail accepts real shapes, rejects junk and handles", async () => {
  const { isEmail } = await import("./auth.ts");
  assert.equal(isEmail("a@b.co"), true);
  assert.equal(isEmail("first.last+tag@sub.domain.io"), true);
  assert.equal(isEmail("u38403"), false);
  assert.equal(isEmail("a@b"), false);
  assert.equal(isEmail("a b@c.com"), false);
});

test("reset expiry is one hour out and expiry check honors the clock", async () => {
  const { resetTokenExpiry, tokenExpired } = await import("./auth.ts");
  const now = new Date("2026-09-04T12:00:00Z");
  const exp = resetTokenExpiry(now);
  assert.equal(exp.toISOString(), "2026-09-04T13:00:00.000Z");
  assert.equal(tokenExpired(exp.toISOString(), new Date("2026-09-04T12:59:00Z")), false);
  assert.equal(tokenExpired(exp.toISOString(), new Date("2026-09-04T13:01:00Z")), true);
  assert.equal(tokenExpired(null, now), true);
});
