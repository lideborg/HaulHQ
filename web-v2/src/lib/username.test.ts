import { test } from "node:test";
import assert from "node:assert/strict";
import { usernameError } from "./username.ts";

test("accepts valid usernames and the auto-generated id form", () => {
  assert.equal(usernameError("jan"), null);
  assert.equal(usernameError("u48231"), null);
  assert.equal(usernameError("aviva-b"), null);
  assert.equal(usernameError("a1b2c3"), null);
});

test("rejects bad format", () => {
  assert.equal(usernameError("ab"), "format"); // too short
  assert.equal(usernameError("Jan"), "format"); // uppercase
  assert.equal(usernameError("a b"), "format"); // space
  assert.equal(usernameError("jan_b"), "format"); // underscore
  assert.equal(usernameError("x".repeat(21)), "format"); // too long
});

test("rejects reserved route names", () => {
  assert.equal(usernameError("admin"), "reserved");
  assert.equal(usernameError("shop"), "reserved");
  assert.equal(usernameError("setup"), "reserved");
});
