# Numbered Hauls (Haul 01, 02, …) - Design

**Date:** 2026-08-04 · **Approved by:** Hampus (option A, voice note)

## Problem

Today a friend has ONE continuous haul: a flat `items` list where approved
items are "locked" rows mixed in with new ones. After approving, the page
dead-ends: no sense that "Haul 01 was saved", no way to see past batches as
things, and no obvious way to keep adding.

## Model (approved: "close + open next")

- A **haul** is a numbered batch per friend: Haul 01, Haul 02, …
- The friend always has **at most one open haul** (the one they're building).
  It is created lazily on first add.
- **Approve** closes the open haul (status `approved`, `approved_at` stamped,
  items → `confirmed`) and pings admin. The next add starts the next number.
- Past hauls stay visible forever: a list on the haul page linking to a
  read-only detail view per haul with per-item statuses and totals.

## Schema

```sql
create table hauls (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references friends(id) on delete cascade,
  number int not null,
  status text not null default 'open',          -- 'open' | 'approved'
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, number)
);
create unique index hauls_one_open_per_owner on hauls(owner_id) where status = 'open';
alter table items add column haul_id uuid references hauls(id) on delete set null;
create index items_haul_id_idx on items(haul_id);
-- RLS: enable + deny-all (same posture as every other table; service role only).
```

**Backfill:** per friend with items: locked items (`confirmed/ordered/
shipped/arrived`) → Haul 1 `approved` (approved_at = max(updated_at));
unlocked items → next number, `open`.

**Self-heal:** any item with `haul_id is null` (written by old code between
migration and deploy) is adopted on next haul-page/admin-page load:
unlocked → open haul (created if needed), locked → newest approved haul.

## Behavior changes

- `addToHaul`: idempotency now scoped to the OPEN haul (re-adding a product
  that lives in a past haul creates a new row - buying it again is legit).
  Inserts carry `haul_id`.
- `addLinkToHaul` (Factories): inserts carry `haul_id`.
- `approveHaul`: only items in the open haul; marks the haul approved;
  notification payload gains the haul number.
- `unlockHaul` (admin): per haul. Reopens it (items → `saved`); if a newer
  open haul already exists, its items merge into the reopened one and the
  newer haul row is deleted (invariant: one open haul; numbering self-repairs).
- `getHaulCount` (nav badge): units in UNLOCKED statuses = current haul
  (robust to orphans). Admin list count stays total.

## UI

**/[handle]/haul** - heading "Haul NN" (open haul's number; "Haul 01" if none
yet). Current items exactly as today (stepper, remove, totals, Approve).
Under the list: "+ Add more from the shop" link. Below totals: **Past hauls**
rows: "Haul 01 · Approved Aug 3 · 3 items · US$ 66 →".

**/[handle]/haul/[number]** - read-only past haul: approved date, item rows
with per-item status (Confirmed / Ordered / Shipped / Arrived), totals.
Viewable by the friend and admin (same auth rule as the haul page).

**/admin/friends/[handle]** - items grouped under haul headers ("Haul 02 ·
open", "Haul 01 · approved Aug 3"), Unlock button per approved haul.

## Non-goals

- No change to `orders`/`payments`.
- No friend-initiated "start new haul" button (approval is the boundary).
- No per-haul shipping snapshots; estimates stay live-computed.

## Rollout

1. Apply migration + backfill to prod (local dev shares this DB; old code
   ignores the new table).
2. Ship code. Orphans self-heal on first page loads.

## Testing

- Pure helpers (`haulLabel`, grouping) unit-tested with node --test.
- Full flow verified in a browser on localhost against prod DB with the
  admintest profile: add → approve → Haul 01 archived → add again → Haul 02,
  past-haul page, admin grouping + unlock-merge.
