# Factories — search curated sellers + paste-link add to haul

**Date:** 2026-07-30
**Status:** Approved by Hampus (in-chat, section by section)
**App:** `web-v2/` (Next.js 16 App Router + Supabase, project ref `pqfiwdscftwhmcutspay`)

## Problem

Friends think the curated shop is everything they can get. In reality we have 41
curated factories/sellers (Yupoo shops, a few Taobao-only) and can source any
brand they carry. Friends need to (a) discover that, (b) search any brand across
those factories, and (c) paste a product link and have it land in their haul
with details filled in automatically.

## What exists already (build on, don't rebuild)

- `sellers` table: 41 rows with `name`, `brands[]`, `yupoo_url`, `superbuy_store`.
- `seller_brand_links` table: 2,469 rows across 15 sellers — direct
  brand → Yupoo-category URLs with `alias` for censored names ("P⭐A⭐A" → Prada).
  `getSellerBrandLinks(search)` in `web-v2/src/lib/data.ts` matches
  `brand ilike OR alias ilike` and is already used as a shop-search fallback.
- `getSellersForBrand(brand)` in `data.ts` (`sellers.brands` contains-match).
- `/[handle]/request` page + `submitRequest` server action: paste link →
  `items` row (`owner_id`, `source_link`, `status: "requested"`) + `notifications`
  (`kind: "new_request"`) + `status_events`. Admin prices in inbox.
- `items` table already has `title`, `brand`, `image_urls[]`, `quoted_price_usd`,
  `status`, `chosen_size`, `color`, `notes`, `admin_note`, `to_source` — no new
  columns needed beyond a new `status` value.
- Product images live in Supabase Storage bucket `product-images`
  (`products/<id>/000.jpg`); item images mirror there under `items/<item-id>/`.
- Yupoo `/categories` pages fetch fine server-side with a plain browser UA
  (verified 2026-07-30 on 99team, aristide, deateath, mvt-shop01). Category IDs
  are stable. Naming is messy: clean brands (99team), censored ("R* Lau*ren",
  "P⭐A⭐A"), Chinese garment types — needs LLM normalization to canonical brands.

## Design

### 1. Factories tab

New page `/[handle]/factories`. Friend nav order becomes
**Shop · Factories · Profile · Haul** (`FriendHeader.tsx`).

Page layout, top to bottom:

1. Intro copy (site voice, short). Approved wording, near-verbatim:
   > These factories and sellers have been curated — most we've researched or
   > ordered from. Looking for a brand that isn't in the shop? Search it here
   > and we'll show you which factories carry it. They open in a separate site —
   > browse, and when you find something you like, paste the link below and
   > it's added to your haul. You can remove it any time.

   Do NOT name Yupoo in the copy ("a separate site" is enough).
2. Brand search box.
3. Paste-link "Add to your haul" box — always visible under the search, never
   buried at the bottom.
4. Factory grid: with no search typed, ALL 41 factories render so the page
   never feels empty.

### 2. Search behavior → factory cards

Typing e.g. "prada" matches `seller_brand_links` (brand + alias) UNION sellers
whose `brands[]` array matches. Results are **factory cards** (never fake
product feeds — no live Yupoo scraping at search time):

- Seller display name = stored name with the first letter capitalized
  ("deateath" → "Deateath", "99team" stays "99team").
- Their brand list (trimmed to a reasonable number, e.g. first 6 + "+N more").
- The link: direct **"Prada at Deateath →"** into that shop's brand category
  when `seller_brand_links` has the mapping; otherwise **"Visit their shop →"**
  to `sellers.yupoo_url`. All external links open in a new tab.
- Sellers with no Yupoo (Taobao-only, e.g. Frank Chang) render without an
  external link but still show in the grid; friends reach them via requests.

Shop search keeps its existing seller-links fallback and gains one line in the
results area: **"Can't find it? Search our factories →"** linking to the tab.

### 3. Category crawl (fills in the other 26 sellers)

Re-runnable script alongside the other import scripts
(`web-v2/scripts/crawl-seller-categories.mjs`):

1. For each seller with a `yupoo_url`: fetch `<shop>.x.yupoo.com/categories`
   with a desktop-browser User-Agent.
2. Extract `(category_id, raw_title)` pairs from the HTML.
3. Send raw titles to the LLM (Gemini 2.5 Flash via `GEMINI_API_KEY`, same as
   the classify pipeline) to map each to a canonical brand name or `null`
   (skip garment-type/info categories like "T-SHIRT T恤", "About Us").
4. Upsert into `seller_brand_links` (`seller`, `brand`, `alias` = raw title,
   `url`, `active`). Keep/refresh the 15 sellers already present; never delete
   rows for sellers the crawl couldn't reach — mark `active = false` only when
   a category verifiably disappeared.
5. Idempotent: safe to re-run occasionally or when a seller is added.

### 4. Paste-link add box → background sourcing

Friend pastes a Yupoo / Weidian / Taobao / Superbuy-wrapped link, hits
**Add product**:

1. **Instantly (in the server action):** validate + classify the URL, insert an
   `items` row: `owner_id`, `source_link` (original link; if Superbuy-wrapped,
   unwrap and store the underlying Weidian/Taobao link), `status: "sourcing"`,
   plus the same `notifications` (`new_request`) + `status_events` writes as
   `submitRequest`. The friend sees the item in their haul immediately with a
   "Finding the details…" state.
2. **In the background (Next `after()`; server keeps working post-response):**
   - **Yupoo album link** → fetch album page: title → `items.title`, hero
     image downloaded (with Yupoo referer header) and uploaded to
     `product-images/items/<item-id>/000.jpg`, public URL → `items.image_urls[0]`.
     Source stays the Yupoo link.
   - **Weidian/Taobao link** → best-effort fetch of title/image/price. Title +
     mirrored image as above. The Superbuy wrapper is NOT stored — admin UI
     builds it on the fly from the item ID.
   - On success: `status` → `"requested"` (details filled).
   - **Any failure** (blocked page, timeout, unparseable): `status` →
     `"requested"` with just the link — identical to today's request flow.
     Sourcing is best-effort; the admin inbox is the guarantee. An item must
     never be stuck in `"sourcing"` (the background task always transitions it).
3. **Price:** friend sees "Price coming" until admin prices it. NO auto-markup
   (the 20% idea is dropped). If a price was scraped, write it into
   `admin_note` (e.g. "listed ¥268 ≈ $37") so pricing in the inbox is instant.

### 5. Friend haul rendering

`sourcing` items render like normal haul items with a subtle "details on the
way" state (link shown, placeholder image). Once resolved they show image +
title. Once priced they behave like any requested item. Friend can remove them
any time until ordered, same as today.

### 6. Out of scope (explicitly)

- No live cross-Yupoo product search / scraped product feeds.
- No auto-markup on scraped prices.
- No changes to the existing `/request` page beyond the shop-search hint link
  (the Factories add box supersedes it in practice; leave the page working).

### 7. Testing

- Unit tests (node --test, like `sizing.test.ts`): link detection/classification
  — Yupoo album vs Yupoo shop root vs Weidian vs Taobao vs Superbuy-wrapped
  (unwrap correctly), and reject junk URLs.
- Crawl script: parser unit-tested against saved HTML fixtures from the four
  verified shops (99team clean, aristide censored, deateath starred/Chinese,
  mvt-shop01 type-based).
- Playwright E2E: search a brand → factory card with correct deep link → paste
  a real Yupoo album link → item appears in haul as sourcing → background fill
  lands (title + image) → admin inbox shows the request.
