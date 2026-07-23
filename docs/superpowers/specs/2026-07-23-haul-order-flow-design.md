# Haul Page Enhancements — Design

**Date:** 2026-07-23
**Status:** Approved by user (chat), pending spec review
**Scope:** web-v2 (Next.js 16 + Supabase, project ref `pqfiwdscftwhmcutspay`)

## Purpose

Make a friend's haul orderable. Add per-item quantity, an "Order Haul" button
that submits the whole haul as an order (locking it and pinging admin in-app),
a persistent short welcome on the landing page, and copy fixes (never show the
admin's real name; state realistic shipping timing).

## Existing plumbing (reuse, don't rebuild)

- `items` table columns: `id, owner_id, product_id, source_link, title, brand,
  image_urls, chosen_size, quoted_price_usd, status, tracking, notes, order_id,
  color, to_source, admin_note, created_at, updated_at`. Statuses in use today:
  `saved` (added to haul), `requested` (friend request via /request).
- `orders` table exists but is empty/unused; `items.order_id` FK already present.
  Columns: `id, owner_id, superbuy_order_no, parcel_no, cost_breakdown, status
  (default 'open'), created_at` — all except id/status/created_at are nullable,
  so a friend-placed order inserts cleanly as `{ owner_id, status: 'placed' }`.
- `notifications` requires NOT-NULL `kind`; `status_events` requires NOT-NULL
  `status` (both confirmed against the live schema).
- `notifications` table + insert pattern: `src/app/request/actions.ts` inserts
  `{ kind, item_id, friend_id, payload }`. Reuse for order pings.
- `status_events` table: `{ item_id, status, note }` audit rows.
- Haul page: `src/app/[handle]/haul/page.tsx`; write actions in
  `src/app/[handle]/haul-actions.ts` (cookie-auth via `getCurrentFriend()`,
  ownership from cookie NOT URL — IDOR rule).
- Admin Inbox: `src/app/admin/inbox/page.tsx` (pattern to mirror for Orders).
- Shipping math: `src/lib/shipping.ts` `estimateShipping(totalGrams)`.
- No email service is wired (only `ADMIN_EMAIL`/`ADMIN_PASSWORD` for admin
  login). Notifications are in-app only, by decision.

## 1. Landing page welcome — `/{handle}` (`src/app/[handle]/page.tsx`)

Under the existing "Hey {name} 👋" heading, add a short persistent paragraph
(distinct from the one-time onboarding copy on `/welcome`):

> This is a small, invite-only shop of pieces hand-picked and quality-checked.
> Add what you like to your haul — everything's ordered together so prices and
> shipping stay low.

Keep the "Browse the shop →" link.

## 2. Per-item quantity

**Migration:** `alter table items add column if not exists quantity integer not
null default 1;` (new migration file `00NN_item_quantity.sql`, next sequential
number; idempotent).

**Type:** add `quantity: number` to `HaulItem` in `src/lib/types.ts`; ensure the
haul query (`getHaul` in `src/lib/data.ts`) selects it.

**UI (haul line):** a `− [n] +` stepper replacing nothing else on the row.
Default and minimum 1 (the `−` button is disabled at 1). "Remove" still deletes
the line. Rendered only when `own` (same gate as Remove). No hard max in v1.

**Action:** `setHaulQuantity(handle, itemId, qty): Promise<{ ok: boolean; error?:
string }>` in `haul-actions.ts` — cookie-auth, clamps `qty` to `>= 1`, updates
`items.quantity` where `id = itemId AND owner_id = friend.id`, refuses if the
item's status is not `saved` (a placed haul is locked). `revalidatePath` the
haul.

**Totals (quantity-aware):** extract a pure helper
`haulTotals(items)` into `src/lib/haul.ts` returning
`{ totalCost, unpriced, totalGrams, unweighed, unitCount }` where each line
contributes `quantity ×` its price and weight, and `unitCount = Σ quantity`.
The page feeds `totalGrams` into `estimateShipping` as today. Header count and
"Items (N)" use `unitCount` (total pieces), not line count.

## 3. Copy changes

- Replace every **user-facing** "Hampus" with "admin":
  - `haul/page.tsx`: "Final quote from **admin** before anything ships."
  - `shop/page.tsx`: "…Paste the link on the Request page and **admin** will price it."
  - `request/page.tsx`: both mentions → "**admin** will source it…", "once **admin** has priced it."
  - (Code comments in `layout.tsx`, `cleanup/page.tsx`, `shipping.ts` are not
    user-facing — leave them.)
- Add to the haul totals block, near the quote disclaimer:
  > Order to delivery usually takes 2–4 weeks.

## 4. Order Haul flow

**States:** a haul is "placed" when it has ≥1 item whose status is `placed`
(equivalently: linked to an order). Because `saved` and `placed` items don't mix
in practice (placing flips all of them at once), the page derives
`isPlaced = items.some(i => i.status === "placed")`.

**Button:** at the bottom of the haul, show **"Order Haul"** only when
`own && items.length > 0 && !isPlaced`. Client component with a confirm step
("Place this haul? Admin will confirm and send your final quote.") and a pending
state; on success the page re-renders into the placed state.

**Action:** `placeHaul(handle): Promise<{ ok: boolean; error?: string }>` in
`haul-actions.ts`:
1. Cookie-auth; require `friend.handle === handle`.
2. Load the friend's `saved` items; if none, return `{ ok:false }`.
3. Insert an `orders` row `{ owner_id: friend.id, status: "placed" }` and select
   `id` (all other columns are nullable / auto — confirmed above).
4. Update those items: `status = "placed"`, `order_id = <new id>`.
5. Insert one `notifications` row `{ kind: "haul_placed", friend_id: friend.id,
   payload: { order_id, item_count, unit_count, total_usd, friend: friend.name } }`
   (item_id nullable here — this is an order-level ping).
6. Insert a `status_events` row per item (`status: "placed", note: "Haul placed"`).
7. `revalidatePath` the haul.
   Steps 3–6 are best-effort-ordered; a failure after the items update still
   leaves a valid placed haul (notification/audit failures are logged, not fatal
   — matches the request-flow precedent).

**Placed view:** when `isPlaced`, replace the stepper/remove/Order button with a
calm banner: **"Haul placed ✓ — admin will confirm and send your final quote."**
Line items render read-only (quantities shown, no controls). Totals still show.

**Guard:** `setHaulQuantity` and `removeFromHaul` refuse when the item's status
is not `saved`, so a placed haul cannot be mutated from the UI even via stale
forms.

## 5. Admin Orders view — `/admin/orders` (`src/app/admin/orders/page.tsx`)

Mirror the Inbox. List placed orders newest-first: for each order, the friend
(name · @handle), placed date, its items (thumbnail, name, size, quantity,
quoted price), and the order total. Read-only in v1 (management/fulfilment
actions are out of scope). Add an "Orders" link to the admin nav next to Inbox.

## 6. Testing

- Unit tests (`node --test`, colocated `*.test.ts`) for `src/lib/haul.ts`
  `haulTotals`: quantity multiplies cost and weight; `unitCount` sums
  quantities; unpriced/unweighed counts count lines (not units); empty haul → zeros.
- Manual browser pass (dev server): stepper changes totals live; Order Haul
  confirm → placed banner + locked list; item appears in `/admin/orders`;
  `setHaulQuantity`/`removeFromHaul` no-op on a placed haul; landing-page
  welcome shows; no "Hampus" anywhere user-facing.

## Out of scope (later)

- Email/SMS notification on order (in-app only for now).
- Admin order fulfilment actions (status transitions, tracking, quoting) beyond
  the read-only list.
- Re-opening / editing a placed haul from the UI (handled over text).
- Per-item max-quantity caps.
