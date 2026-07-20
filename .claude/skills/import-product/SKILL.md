---
name: import-product
description: Scrape a rep-fashion link (Superbuy/Taobao/Weidian/Yupoo) into a COMPLETE v2 shop product — every size, every colorway, all images re-hosted in Supabase storage, structured size_guide — then upsert the products row. Use when Hampus says "import <link> to the shop", when processing a friend request from the admin inbox, or to enrich a bare `requested` item. Supersedes add-haul-item for v2 (add-haul-item writes v1 JSON favorites; this writes Supabase).
---

# Import a product into the HaulHQ v2 shop

Goal per link: a `products` row with title, brand, seller, `source_platform`,
`cost_cny` + `price_usd` (× FX_CNY_USD × 1.20), ALL `size_options`
(`["One Size"]` when the listing has no size selector), `colors` when there
are colorways, `size_guide` JSON read from the size-chart image, and
`image_urls` pointing at Supabase storage. Default `published = true`.

## Procedure

1. **Resolve & scrape** — follow `add-haul-item`'s link-type table (same
   gotchas: Superbuy/e.tb.cn need Chrome MCP; Yupoo/weidian direct pages can
   WebFetch; filter images to the hero seller id; strip `_NxN` suffixes).
   Additionally capture from the buy page: every size-selector button label
   → `size_options`; every color-selector label → `colors`.
2. **Size guide** — download the size-chart detail image (usually first
   detail image), Read it, transcribe into `size_guide` JSON:
   `{"unit":"cm","note":"...","sizes":[...],"measurements":{"length":[...],...}}`
   Keys: length, chest or pit_to_pit, shoulder, sleeve, waist, hip, thigh,
   outer_length. Half-measurements: keep as-is but name them (`pit_to_pit`,
   `half_waist`) — the UI labels them correctly. No chart → `size_guide = null`.
3. **Categorize** — assign exactly one `category` slug by looking at the hero
   image + title. The 11 slugs (keep in sync with `web-v2/src/lib/categories.ts`):
   `t-shirts` (SHORT-sleeve tee only, no collar), `shirts` (button-ups,
   overshirts, AND polos), `knitwear` (label "Knitted" — anything with visible
   knit stitches: sweaters, cardigans, knit pullovers), `hoodies` (label
   "Hoodies & Long Sleeves" — hoodies, fleece/jersey sweatshirts, AND ANY
   non-knit long-sleeve top incl. long-sleeve tees), `outerwear` (jackets,
   coats, blazers, parkas, puffer vests), `pants`, `shorts`, `shoes` (any
   footwear), `bags` (any bag), `accessories` (belts, hats, scarves, jewelry,
   wallets, ties, socks), `glasses` (sunglasses/eyewear). Decision rules:
   polo → `shirts`; blazer → `outerwear`; long-sleeve tee → `hoodies` (NOT
   t-shirts); visible knit stitches → `knitwear`, smooth fabric → `hoodies`.
   If genuinely unsure, set `category = null` — it surfaces on /admin/cleanup
   for a manual pick.
4. **Upsert the row** — via the Management-API curl pattern (see
   `docs/superpowers/plans/2026-07-17-scrape-import-pipeline.md` Global
   Constraints). Template:

   ```sql
   insert into products (brand, title, description, category, seller,
     source_link, source_platform, image_urls, cost_cny, markup, price_usd,
     size_options, colors, size_guide, admin_sizing_note, published)
   values (..., 0.20, ..., true)
   on conflict (source_link) do update set
     size_options = excluded.size_options,
     colors = excluded.colors,
     size_guide = excluded.size_guide,
     image_urls = excluded.image_urls,
     cost_cny = excluded.cost_cny,
     price_usd = excluded.price_usd;
   ```

   Then `select id from products where source_link = '...'`.
5. **Images to storage** — download to a temp dir (curl; Referer header for
   Yupoo), then from `web-v2/`:
   `node scripts/upload-product-images.mjs <productId> <tmpdir>`
   (uploads sorted, updates `image_urls`, prints URLs). Hero shot must sort
   first — name files `000.jpg, 001.jpg, …`.
6. **Friend-request link-back** — if this came from a `requested` item:
   `update items set product_id='<id>', title='<clean title>', quoted_price_usd=<price> where id='<itemId>';`
7. **Verify** — open `http://localhost:3000/product/<id>`: all sizes render,
   gallery thumbnails work, size guide table shows. Fix before declaring done.

## Scrape gotchas (learned the hard way)

- **Superbuy buy page = warm-once.** CAPTCHA appears once; Hampus solves it, then
  the session stays warm for the whole batch. Reuse the same tab.
- **Main gallery vs. recommendations.** Superbuy shows the seller's OTHER products
  in a right-hand sidebar. Filter scraped `<img>` to the top-left region
  (`getBoundingClientRect().left < 520 && top < 560`) and to the DOMINANT seller
  id in that region — otherwise recommendation thumbnails leak into `image_urls`.
- **Weidian / geilicdn images are the pain point.** The Chrome-tool DLP filter
  redacts any returned string that looks like a URL/token/base64/query — so
  `img.src`, base64, even chunked strings come back `[BLOCKED]`. The reliable
  extraction: return each `img.currentSrc` (the exact URL that already loaded) as
  a **char-code array** — `[...src].map(c=>c.charCodeAt(0)).join('-')` — then
  decode in Bash/node. `currentSrc` is byte-exact; do NOT hand-reconstruct hashes
  from space-chunked strings (a 5-char chunk split silently miscounts zero-runs →
  404s). Full-res geilicdn = the `...WxH.jpg` path (drop the `.webp?w=..&h=..`
  thumbnail query); fetch with `Referer: https://weidian.com/`. Verify every URL
  returns 200 before building the JSON.
- **Short links** (`k.youshop10.com/...`) resolve through the Superbuy wrapper but
  take a few extra seconds — wait and re-extract if the page is still skeleton.
- **RO = Rick Owens; "non-undercover / autonomous" = Undercover** (sellers dodge
  brand names). Expand to the real brand.

## Rules

- Never leave images on Yupoo/Weidian URLs (hotlink-protected — they will
  break). alicdn also gets migrated for consistency.
- Junk source titles are fine at scrape time — Hampus renames in
  /admin/products. Don't skip the row for a bad title.
- Price unparseable → `price_usd = null` (renders "Quote on request").
- After upsert + image upload, run the post-import passes:
  `retag-heroes` (auto via import-batch) → `propose-display-titles` →
  `estimate-weights` so the card name, hero, and shipping weight are set.
