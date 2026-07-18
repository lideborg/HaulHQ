# Haul Inspiration Boards — Implementation Plan

> **For agentic workers:** Phase 0 (foundation) is sequential — everything depends on it. Phase 1 (pages) is parallel — each task owns distinct files. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a per-friend handle routing layer and reframe the "cart" as a **haul** — friends browse `/<handle>/shop`, tap **+ Add to haul**, and Hampus sees each friend's haul in `/admin`.

**Architecture:** Next.js 16 App Router. New `src/app/[handle]/` route subtree (validated in a layout) holds the friend experience; `src/app/page.tsx` becomes a splash; `/admin` gains friend + haul views. Shared reads/actions live in `src/lib/data.ts` and per-feature `actions.ts`. Products get a short `code` for pretty URLs.

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Supabase (Management API via curl), `node --test` for pure helpers.

## Global Constraints

- **Runs on localhost only. This plan contains NO deploy/hosting/DNS step.** (Vercel is the user's own later action.)
- **No payments, no order-status lifecycle.** Friends never see any status.
- Copy: button = **+ Add to haul**; friend page title = **Your Haul**; admin flag = **I'll source this**.
- Handle rules: `^[a-z0-9-]{2,20}$`, not in reserved set `{admin, product, shop, haul, f, api, _next, favicon.ico}`, unique.
- Product code: 5-char base62 (`[0-9a-zA-Z]`), unique.
- Supabase writes via Management API curl; PAT from `.mcp.json`. Migration file recorded under `supabase/migrations/` AND applied.
- Whole-dollar prices already in place; reuse `Math.round(price_usd)` display pattern.

## File Structure

**Phase 0 — foundation (sequential):**
- `supabase/migrations/0006_haul_boards.sql` — schema (create)
- `web-v2/scripts/lib/haul-codes.mjs` + `.test.mjs` — `slugify`, `makeCode`, `isValidHandle`, `RESERVED_HANDLES` (create, TDD)
- `web-v2/scripts/backfill-haul.mjs` — generate codes + brand_slugs + handle backfill (create, run once)
- `web-v2/src/lib/handles.ts` — app-side `RESERVED_HANDLES`, `isValidHandle` mirror (create)
- `web-v2/src/lib/types.ts` — add `handle` to Friend; `code`,`brand_slug` to Product; add `HaulItem` (modify)
- `web-v2/src/lib/data.ts` — add `getFriendByHandle`, `getProductByCode`, `getHaul`, `getFriendsWithHaulCounts` (modify)
- `web-v2/src/app/[handle]/haul-actions.ts` — `addToHaul`, `removeFromHaul` (create)
- `web-v2/src/app/admin/friends/actions.ts` — `createFriend`, `toggleSource`, `setAdminNote` (create)
- `web-v2/src/components/AddToHaul.tsx` — renamed from AddToCart (create; delete AddToCart.tsx)

**Phase 1 — pages (parallel, each task = its own files):**
- T7 `web-v2/src/app/page.tsx` — splash (rewrite)
- T8 `web-v2/src/app/[handle]/layout.tsx` + `[handle]/page.tsx` — validate + greet
- T9 `web-v2/src/app/[handle]/shop/page.tsx` + `BrandSidebar.tsx` + `CategorySidebar.tsx` + `ProductCard.tsx` (handle-aware)
- T10 `web-v2/src/app/[handle]/product/[brand]/[code]/page.tsx`
- T11 `web-v2/src/app/[handle]/haul/page.tsx`
- T12 `web-v2/src/app/admin/page.tsx` (restructure) — friends list + add-friend form
- T13 `web-v2/src/app/admin/friends/[handle]/page.tsx` — friend haul detail

---

## Phase 0 — Foundation (sequential)

### Task 1: Migration + backfill

**Files:** Create `supabase/migrations/0006_haul_boards.sql`, `web-v2/scripts/backfill-haul.mjs`.

**Interfaces produced:** columns `friends.handle`, `products.code`, `products.brand_slug`, `items.to_source`, `items.admin_note`; partial unique index `items(owner_id,product_id)`.

- [ ] Write `0006_haul_boards.sql`:
```sql
alter table friends   add column if not exists handle text unique;
alter table products  add column if not exists code text unique;
alter table products  add column if not exists brand_slug text;
alter table items     add column if not exists to_source boolean not null default false;
alter table items     add column if not exists admin_note text;
create unique index if not exists items_owner_product_uniq
  on items (owner_id, product_id) where product_id is not null;
```
- [ ] Apply it via Management API curl (HTTP 201).
- [ ] Write `backfill-haul.mjs`: import `{slugify, makeCode}` from `./lib/haul-codes.mjs`; export products, assign unique `code` (Set-checked) + `brand_slug=slugify(brand)`, `update` each; set the one existing friend's `handle` (slugify of name, fallback `friend1`). Print a summary.
- [ ] Run it; verify `select count(*) from products where code is null` = 0 and the friend has a handle.

### Task 2: Pure helpers (TDD)

**Files:** Create `web-v2/scripts/lib/haul-codes.mjs`, `web-v2/scripts/lib/haul-codes.test.mjs`.

**Interfaces produced:**
- `slugify(s: string) → string` (lowercase, non-alnum→`-`, collapse/trim `-`)
- `makeCode(rand = Math.random) → string` (5 chars from `[0-9a-zA-Z]`)
- `RESERVED_HANDLES: string[]`, `isValidHandle(h: string) → boolean`

- [ ] Write failing tests:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { slugify, makeCode, isValidHandle } from "./haul-codes.mjs";

test("slugify", () => {
  assert.equal(slugify("Saint Laurent"), "saint-laurent");
  assert.equal(slugify("Enfants Riches Déprimés"), "enfants-riches-d-prim-s");
  assert.equal(slugify("  The Row  "), "the-row");
});
test("makeCode is 5 base62 chars, deterministic w/ stub", () => {
  const seq = [0, 0.5, 0.99, 0.2, 0.7]; let i = 0;
  const code = makeCode(() => seq[i++]);
  assert.match(code, /^[0-9a-zA-Z]{5}$/);
  assert.equal(code.length, 5);
});
test("isValidHandle", () => {
  assert.equal(isValidHandle("jan"), true);
  assert.equal(isValidHandle("ab"), true);
  assert.equal(isValidHandle("a"), false);         // too short
  assert.equal(isValidHandle("Jan"), false);       // uppercase
  assert.equal(isValidHandle("admin"), false);     // reserved
  assert.equal(isValidHandle("has space"), false);
});
```
- [ ] Run `node --test 'scripts/lib/haul-codes.test.mjs'` → FAIL.
- [ ] Implement:
```js
export const RESERVED_HANDLES = ["admin","product","shop","haul","f","api","_next","favicon.ico"];
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function slugify(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
export function makeCode(rand = Math.random) {
  let out = "";
  for (let i = 0; i < 5; i++) out += ALPHABET[Math.floor(rand() * ALPHABET.length)];
  return out;
}
export function isValidHandle(h) {
  return /^[a-z0-9-]{2,20}$/.test(h) && !RESERVED_HANDLES.includes(h);
}
```
- [ ] Run tests → PASS. Commit.

### Task 3: Types + app-side handle guard

**Files:** Modify `web-v2/src/lib/types.ts`; create `web-v2/src/lib/handles.ts`.

**Interfaces produced:** `Friend.handle`, `Product.code`, `Product.brand_slug`, `HaulItem` type; `isValidHandle`, `RESERVED_HANDLES` (TS).

- [ ] In `types.ts`: add `handle: string | null` to `Friend`; add `code: string | null; brand_slug: string | null;` to `Product`; add:
```ts
export interface HaulItem {
  id: string;
  owner_id: string;
  product_id: string | null;
  title: string | null;
  brand: string | null;
  image_urls: string[] | null;
  chosen_size: string | null;
  quoted_price_usd: number | null;
  to_source: boolean;
  admin_note: string | null;
  created_at: string;
}
```
- [ ] Create `handles.ts` (mirror of the mjs; keep-in-sync comment):
```ts
// Keep in sync with scripts/lib/haul-codes.mjs
export const RESERVED_HANDLES = ["admin","product","shop","haul","f","api","_next","favicon.ico"];
export function isValidHandle(h: string): boolean {
  return /^[a-z0-9-]{2,20}$/.test(h) && !RESERVED_HANDLES.includes(h);
}
```
- [ ] `npx tsc --noEmit` → clean. Commit.

### Task 4: Data-layer reads

**Files:** Modify `web-v2/src/lib/data.ts`.

**Interfaces produced (consumed by pages):**
- `getFriendByHandle(handle: string) → Promise<Friend | null>` (active only)
- `getProductByCode(code: string) → Promise<Product | null>`
- `getHaul(friendId: string) → Promise<HaulItem[]>` (newest first)
- `getFriendsWithHaulCounts() → Promise<Array<Friend & { haul_count: number }>>`

- [ ] Add the four functions using `createAdminClient()` (follow existing `getProductById` pattern). `getFriendByHandle`: `.eq("handle", handle).eq("active", true).maybeSingle()`. `getProductByCode`: `.eq("code", code).maybeSingle()`. `getHaul`: `from("items").select("*").eq("owner_id", friendId).order("created_at",{ascending:false})`. `getFriendsWithHaulCounts`: fetch friends, then counts per owner_id (one grouped query or per-friend head counts).
- [ ] `npx tsc --noEmit` → clean. Commit.

### Task 5: Server actions

**Files:** Create `web-v2/src/app/[handle]/haul-actions.ts`, `web-v2/src/app/admin/friends/actions.ts`.

**Interfaces produced:**
- `addToHaul(handle: string, productId: string, size: string | null) → Promise<{ok:boolean; error?:string}>`
- `removeFromHaul(handle: string, itemId: string) → Promise<void>`
- `createFriend(formData: FormData)` (reads `name`,`handle`; redirects to `/admin?created=<handle>` or `/admin?error=…`)
- `toggleSource(formData: FormData)` (reads `id`), `setAdminNote(formData: FormData)` (reads `id`,`note`)

- [ ] `haul-actions.ts`: `"use server"`. `addToHaul` — resolve friend via `getFriendByHandle`; if none return error; load product; upsert into `items` (owner_id, product_id, title/brand/image_urls/quoted_price_usd snapshot, chosen_size, status:'saved') using `.upsert(..., { onConflict: "owner_id,product_id" })`; `revalidatePath('/'+handle+'/haul')`; return `{ok:true}`. `removeFromHaul` — delete where `id=itemId and owner_id=friend.id`; revalidate.
- [ ] `admin/friends/actions.ts`: `"use server"`. `createFriend` — trim name+handle; `if(!isValidHandle(handle)) redirect("/admin?error=handle")`; insert `{name, handle, active:true, access_token: crypto.randomUUID()}`; on unique violation `redirect("/admin?error=taken")`; else `redirect("/admin?created="+handle)`. `toggleSource` — read current `to_source`, flip, update, `revalidatePath` the admin friend page. `setAdminNote` — update `admin_note`, revalidate.
- [ ] `npx tsc --noEmit` → clean. Commit.

### Task 6: AddToHaul component

**Files:** Create `web-v2/src/components/AddToHaul.tsx`; delete `web-v2/src/components/AddToCart.tsx`.

**Interface produced:** `<AddToHaul handle={string} productId={string} sizes={string[]} />`.

- [ ] Copy AddToCart, rename to `AddToHaul`, add `handle` prop, call `addToHaul(handle, productId, size)` from `@/app/[handle]/haul-actions`. Button label **+ Add to haul**; success **In your haul ✓** with a link to `/${handle}/haul`.
- [ ] Delete `AddToCart.tsx` and its action `src/app/product/[id]/actions.ts`'s `addToCart` usage (the `/product/[id]` preview page keeps rendering but drop its AddToCart import — preview is admin-only, no haul button needed).
- [ ] `npx tsc --noEmit` → clean. Commit.

---

## Phase 1 — Pages (PARALLEL — dispatch one agent per task)

Each task consumes only the Phase 0 interfaces above and creates/edits its own files. No two tasks touch the same file.

### Task 7: Splash `/`
Rewrite `src/app/page.tsx` to a static splash: centered "HaulHQ" wordmark, an "invite only" line, full-height neutral background. No data fetching, no `Header`, no product grid. `export const dynamic = "force-static"` is fine.

### Task 8: Friend layout + home
- `src/app/[handle]/layout.tsx`: `async`, `params: Promise<{handle:string}>`; `getFriendByHandle`; if null → `notFound()`. Render a friend `Header` (links `/${handle}/shop`, `/${handle}/haul`) + `{children}`. Pass nothing else (pages read their own params).
- `src/app/[handle]/page.tsx`: greet — "Hey {friend.name} 👋" + a link/button to `/${handle}/shop`.

### Task 9: Friend shop + handle-aware nav
- `src/app/[handle]/shop/page.tsx`: like the OLD root shop (git shows prior `page.tsx`), but `params: Promise<{handle}>` + `searchParams` for `brand`/`category`; fetch `getPublishedProducts(brand,category)`, `getBrands()`, `getCategories()`; render sidebars + grid.
- `BrandSidebar.tsx`, `CategorySidebar.tsx`: add a `handle` prop; build hrefs as `/${handle}/shop?…` instead of `/?…`.
- `ProductCard.tsx`: add `handle` prop; link to `/${handle}/product/${product.brand_slug}/${product.code}`.

### Task 10: Friend product page
`src/app/[handle]/product/[brand]/[code]/page.tsx`: `params: Promise<{handle,brand,code}>`; `getProductByCode(code)`; `notFound()` if missing; render `ProductGallery`, brand, title, `US$ ${Math.round(price)}` (or "Sold out"/"Quote on request"), `SizeGuide` if present, and `<AddToHaul handle={handle} productId={product.id} sizes={product.size_options ?? []} />` (only when not sold out).

### Task 11: Your Haul page
`src/app/[handle]/haul/page.tsx`: `getFriendByHandle` → `getHaul(friend.id)`; grid of items (image, brand, title, `US$ round(price)`, chosen size). Each item: a small form calling `removeFromHaul(handle, item.id)` → "Remove". Empty state: "Nothing in your haul yet." No status anywhere.

### Task 12: Admin dashboard restructure
`src/app/admin/page.tsx`: `searchParams` for `created`/`error` banners. Section 1: `getFriendsWithHaulCounts()` → table of name · handle · link `/${handle}` · haul count → link to `/admin/friends/${handle}`. Section 2: `createFriend` form (name + handle inputs). Section 3: keep existing "Manage products" + "Cleanup" links. Show a success banner with the shareable link when `?created=`.

### Task 13: Admin friend haul detail
`src/app/admin/friends/[handle]/page.tsx`: `getFriendByHandle` (+ `notFound`) → `getHaul`; gallery of picks; per item a `toggleSource` form (button shows **I'll source this** / **✓ Sourcing**) and a `setAdminNote` textarea+Save. Admin-only (already behind the proxy gate).

---

## Self-Review

- **Spec coverage:** splash ✓(T7) · nested handle routing ✓(T8) · shop ✓(T9) · pretty product URL+code ✓(T1,T10) · add-to-haul ✓(T5,T6,T10) · Your Haul+remove ✓(T11) · admin friends+add ✓(T12) · admin haul+source flag+note ✓(T13) · migration/backfill ✓(T1) · helpers TDD ✓(T2) · no payments/status/deploy ✓(constraints). No gaps.
- **Placeholder scan:** none.
- **Type consistency:** `getFriendByHandle`/`getProductByCode`/`getHaul`/`getFriendsWithHaulCounts`, `addToHaul(handle,productId,size)`, `HaulItem`, `Product.code/brand_slug`, `Friend.handle` used identically across tasks. ✓
