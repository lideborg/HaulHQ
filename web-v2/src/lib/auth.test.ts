import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUserId, randomToken, hashPassword, verifyPassword } from "./auth.ts";

test("randomUserId is 'u' + exactly 5 digits", () => {
  assert.equal(randomUserId(() => 0), "u10000");
  assert.equal(randomUserId(() => 0.9999999), "u99999");
  assert.match(randomUserId(), /^u\d{5}$/);
});

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
