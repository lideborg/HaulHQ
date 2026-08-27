import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows, PAGE_SIZE } from "./paginate.ts";

// A fake PostgREST-style pager over a synthetic dataset. Records how many
// windows were requested so we can assert the loop stops correctly.
function pager(total: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  let calls = 0;
  const makePage = (from: number, to: number) => {
    calls++;
    return Promise.resolve({ data: rows.slice(from, to + 1), error: null });
  };
  return { makePage, calls: () => calls };
}

test("returns every row when the table exceeds one page", async () => {
  const p = pager(PAGE_SIZE + 12); // the real bug: 1012 rows, only 1000 fetched before
  const rows = await fetchAllRows<number>(p.makePage);
  assert.equal(rows.length, PAGE_SIZE + 12);
  assert.equal(rows[0], 0);
  assert.equal(rows[rows.length - 1], PAGE_SIZE + 11);
  assert.equal(p.calls(), 2); // full page + short page
});

test("handles multiple full pages then a short one", async () => {
  const p = pager(PAGE_SIZE * 2 + 5);
  const rows = await fetchAllRows<number>(p.makePage);
  assert.equal(rows.length, PAGE_SIZE * 2 + 5);
  assert.equal(p.calls(), 3);
});

test("an exact multiple of PAGE_SIZE needs a trailing empty page to stop", async () => {
  const p = pager(PAGE_SIZE); // exactly 1000: page 1 is full, so it must probe page 2
  const rows = await fetchAllRows<number>(p.makePage);
  assert.equal(rows.length, PAGE_SIZE);
  assert.equal(p.calls(), 2);
});

test("under one page makes a single request", async () => {
  const p = pager(42);
  const rows = await fetchAllRows<number>(p.makePage);
  assert.equal(rows.length, 42);
  assert.equal(p.calls(), 1);
});

test("empty table returns [] in one request", async () => {
  const p = pager(0);
  const rows = await fetchAllRows<number>(p.makePage);
  assert.deepEqual(rows, []);
  assert.equal(p.calls(), 1);
});

test("a PostgREST error is thrown, not swallowed", async () => {
  await assert.rejects(
    fetchAllRows<number>(() =>
      Promise.resolve({ data: null, error: { message: "boom" } }),
    ),
    (err: unknown) => (err as { message: string }).message === "boom",
  );
});

test("null data on a page is treated as empty and stops", async () => {
  let calls = 0;
  const rows = await fetchAllRows<number>(() => {
    calls++;
    return Promise.resolve({ data: null, error: null });
  });
  assert.deepEqual(rows, []);
  assert.equal(calls, 1);
});
