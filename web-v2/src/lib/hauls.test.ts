import { test } from "node:test";
import assert from "node:assert/strict";
import {
  haulLabel,
  isUnlocked,
  isUnavailable,
  REMOVABLE_STATUSES,
  groupItemsByHaul,
} from "./hauls.ts";
import type { Haul, HaulItem } from "./types.ts";

test("haulLabel zero-pads to two digits", () => {
  assert.equal(haulLabel(1), "Haul 01");
  assert.equal(haulLabel(9), "Haul 09");
  assert.equal(haulLabel(12), "Haul 12");
});

test("isUnlocked treats null and friend-editable statuses as unlocked", () => {
  assert.equal(isUnlocked(null), true);
  assert.equal(isUnlocked(undefined), true);
  assert.equal(isUnlocked("saved"), true);
  assert.equal(isUnlocked("sourcing"), true);
  assert.equal(isUnlocked("confirmed"), false);
  assert.equal(isUnlocked("shipped"), false);
});

test("isUnavailable matches only the unavailable status", () => {
  assert.equal(isUnavailable("unavailable"), true);
  assert.equal(isUnavailable("saved"), false);
  assert.equal(isUnavailable(null), false);
  assert.equal(isUnavailable(undefined), false);
  // Not editable, and not part of the locked order flow either.
  assert.equal(isUnlocked("unavailable"), false);
});

test("REMOVABLE_STATUSES lets a friend delete editable and unavailable items", () => {
  assert.ok(REMOVABLE_STATUSES.includes("saved"));
  assert.ok(REMOVABLE_STATUSES.includes("unavailable"));
  assert.ok(!REMOVABLE_STATUSES.includes("confirmed"));
});

const haul = (id: string, number: number, status: Haul["status"]): Haul => ({
  id,
  owner_id: "o",
  number,
  status,
  approved_at: status === "approved" ? "2026-08-03T00:00:00Z" : null,
  created_at: "2026-08-01T00:00:00Z",
});

const item = (id: string, haul_id: string | null, created_at: string): HaulItem =>
  ({ id, haul_id, created_at, owner_id: "o" }) as HaulItem;

test("groupItemsByHaul splits open vs past and sorts", () => {
  const hauls = [haul("h1", 1, "approved"), haul("h2", 2, "approved"), haul("h3", 3, "open")];
  const items = [
    item("a", "h1", "2026-08-01T10:00:00Z"),
    item("b", "h3", "2026-08-04T10:00:00Z"),
    item("c", "h3", "2026-08-04T12:00:00Z"),
    item("d", "h2", "2026-08-02T10:00:00Z"),
    item("e", null, "2026-08-04T13:00:00Z"), // orphan: ignored here
  ];
  const { open, past } = groupItemsByHaul(hauls, items);
  assert.equal(open?.haul.id, "h3");
  assert.deepEqual(open?.items.map((i) => i.id), ["c", "b"]); // newest first
  assert.deepEqual(past.map((g) => g.haul.number), [2, 1]); // newest haul first
  assert.deepEqual(past[1].items.map((i) => i.id), ["a"]);
});

test("groupItemsByHaul with no open haul", () => {
  const { open, past } = groupItemsByHaul([haul("h1", 1, "approved")], []);
  assert.equal(open, null);
  assert.equal(past.length, 1);
  assert.equal(past[0].items.length, 0);
});
