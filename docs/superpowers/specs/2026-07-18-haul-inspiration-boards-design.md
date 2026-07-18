# HaulHQ — Per-Friend Haul Inspiration Boards (Design Spec)

**Date:** 2026-07-18
**Status:** Approved (brainstorming) — pending spec review

## Goal

Turn the flat catalog into a **per-friend inspiration tool**. Each friend gets their
own namespaced space, browses the catalog, and taps **+ Add to haul** on pieces they
like. Hampus opens `/admin` and sees each friend's haul — their taste, in one place —
to use for styling, with a private "I'll source this" flag on items he needs to look
into.

## Non-Goals (explicitly out of scope)

- **No payments** — the `payments` table stays untouched; no money handling anywhere.
- **No order lifecycle** — no quoted/ordered/shipped/delivered statuses. Friends never
  see any status.
- ** Deploy on vercel when ready

## Architecture Overview

The app already has: a `products` catalog with brand + category filters, a `SizeGuide`,
an admin gate (`src/proxy.ts` + `/admin/login`), and admin product tools. This spec
adds a **friend-handle routing layer** on top and reframes the "cart" as a **haul**.

Everything a friend touches is nested under their handle (`/jan/...`). The handle in
the URL is the source of truth for "whose space this is" — add-to-haul writes under
that friend. Admin stays at the top level (`/admin`), password-gated as today.

## URL / Routing Scheme

| URL | Purpose | Auth |
|---|---|---|
| `/` | Splash / landing — cool image, invite-only vibe, nothing shoppable | public |
| `/admin`, `/admin/*` | Hampus — dashboard, product tools, cleanup | admin password (existing) |
| `/<handle>` | Friend home — "Hey Jan 👋" greeting → into shop | valid handle |
| `/<handle>/shop` | Catalog with brand + category filters | valid handle |
| `/<handle>/product/<brand>/<code>` | Product page inside the friend's space | valid handle |
| `/<handle>/haul` | "Your Haul" — everything the friend added | valid handle |
| `/product/<id>` | **Kept** as admin/preview route (import-product skill uses it) | — |

**Handle validation:** a Next.js dynamic segment `src/app/[handle]/layout.tsx` looks up
the handle in `friends`; if it isn't an active friend, `notFound()`. Static routes
(`/admin`, `/`, `/product`) always win over `[handle]`, so they can't be shadowed.
**Reserved handles** (rejected at friend-creation): `admin`, `product`, `shop`, `haul`,
`f`, `api`, `_next`, `favicon.ico`.

**Short product codes:** add `products.code` (5-char base62, unique) and
`products.brand_slug`. The `<brand>` segment is cosmetic/readable; `<code>` is the
lookup key. Example: `/jan/product/prada/x7k2p`.

## Data Model Changes

Migration `0006_haul_boards.sql`:

- **`friends`**: add `handle text unique` (lowercase, `^[a-z0-9-]{2,20}$`). Backfill the
  one existing friend with a handle.
- **`products`**: add `code text unique` (5-char), `brand_slug text`. Backfill all 242:
  `code` = random 5-char base62 (collision-checked), `brand_slug` = slugify(brand).
- **`items`**: add `to_source boolean not null default false` (admin "I'll source this"
  flag) and `admin_note text` (Hampus's private note). Add a partial unique index on
  `(owner_id, product_id)` where `product_id is not null` so a friend can't add the same
  product twice. An item now means "a pick in someone's haul"; `status` is left as-is but
  unused by any workflow.
- `orders`, `payments` — untouched.

## Components & Pages

**Splash — `src/app/page.tsx` (rewritten).** Replaces today's shop-at-root. Full-bleed
image + "HaulHQ" wordmark, "invite only" line. No product data.

**Friend layout — `src/app/[handle]/layout.tsx` (new).** Resolves + validates the
handle, exposes it to children, renders the friend-facing `Header` (links to
`/<handle>/shop` and `/<handle>/haul`).

**Friend home — `src/app/[handle]/page.tsx` (new).** "Hey {name} 👋" + a Browse button →
`/<handle>/shop`.

**Shop — `src/app/[handle]/shop/page.tsx` (new; adapts current root shop).** Reuses
`BrandSidebar` + `CategorySidebar`, but their links become handle-aware
(`/<handle>/shop?brand=…&category=…`). `ProductCard` links to
`/<handle>/product/<brand_slug>/<code>`.

**Product — `src/app/[handle]/product/[brand]/[code]/page.tsx` (new).** Resolves product
by `code`. Renders gallery, brand, title, price, `SizeGuide`, and `AddToHaul`.

**AddToHaul — `src/components/AddToHaul.tsx` (renamed from `AddToCart`).** Button reads
**+ Add to haul**; optional size selector; calls `addToHaul(handle, productId, size)`.
On success: "In your haul ✓" + a link to `/<handle>/haul`.

**Your Haul — `src/app/[handle]/haul/page.tsx` (new).** Gallery of the friend's items
(image, brand, title, price, chosen size). Each has a **Remove** button. No status shown.

**Admin dashboard — `src/app/admin/page.tsx` (restructured).** Sections:
1. **Friends & their hauls** — each friend, their handle, their personal link
   (`/<handle>`), and haul item-count → click through to their haul.
2. **Add a friend** — name + handle form (validates uniqueness + reserved words),
   returns the shareable `/<handle>` link.
3. Existing links: Manage products, Cleanup.

**Admin friend haul — `src/app/admin/friends/[handle]/page.tsx` (new).** That friend's
haul gallery; per item a **"I'll source this"** toggle and an admin-note field
(both admin-only).

## Server Actions

- `addToHaul(handle, productId, size)` — resolve friend by handle, upsert item
  (owner_id, product_id, snapshot of title/brand/image_urls/price, chosen_size). Revalidate
  `/<handle>/haul`.
- `removeFromHaul(handle, itemId)` — delete if it belongs to that friend. Revalidate.
- `createFriend(name, handle)` — validate handle (regex, reserved list, uniqueness),
  insert, return link.
- `toggleSource(itemId)` — flip `to_source`. Admin only.
- `setAdminNote(itemId, note)` — save `admin_note`. Admin only.

## Data-layer additions (`src/lib/data.ts`)

- `getFriendByHandle(handle)` → Friend | null (active only)
- `getProductByCode(code)` → Product | null
- `getHaul(friendId)` → items[] (with product join for freshest image/price)
- `getFriendsWithHaulCounts()` → for the admin dashboard
- `getPublishedProducts(brand?, category?)` — unchanged, reused by `/<handle>/shop`

## Testing

- Unit: a `slugify`/`makeCode` helper (deterministic given a seed) + handle validator
  (regex + reserved list) — TDD with `node --test`, like the mapper.
- Manual/browser: create a friend, open `/<handle>`, add to haul, verify it appears in
  `/<handle>/haul` and in `/admin`, toggle "I'll source this", remove an item. Confirm
  `/` shows only the splash and a bogus handle 404s.

## What Stays Untouched

Admin gate/login, product management, cleanup page, categories, size guides, the import
pipeline (the `/product/<id>` preview route stays for the import-product skill), and the
`orders`/`payments` tables.
