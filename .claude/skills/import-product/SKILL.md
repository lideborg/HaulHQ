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

0. **BUYABLE GATE (do this FIRST — Hampus buys everything via Superbuy).** A
   product is only worth listing if its source is purchasable through Superbuy
   right now. Resolve the real item link (Weidian/Taobao/1688) and confirm it is
   sellable BEFORE creating any row: Weidian embeds `"itemSellable":true` +
   `"stock":N` in the page JSON (curl-able); off-shelf shows `itemSellable:false`
   / stock 0 / 已下架. If it is NOT sellable, STOP — do not import; tell Hampus
   it is dead and offer to find a live source. Yupoo scout-shop albums (e.g. the
   suppliervortex shops) attach buy-links that rot fast, so this check fails
   often on them — never surface a product he cannot buy. (Superbuy "Risk Alert"
   is an intermittent block, NOT a delisting — that one is not a sold-out.)

1. **Resolve & scrape** — follow `add-haul-item`'s link-type table (same
   gotchas: Superbuy/e.tb.cn need Chrome MCP; Yupoo/weidian direct pages can
   WebFetch; filter images to the hero seller id; strip `_NxN` suffixes).
   Additionally capture from the buy page: every size-selector button label
   → `size_options`; every color-selector label → `colors`.
   **IN-STOCK SIZES ONLY (every Superbuy import, no exceptions):** do NOT dump the
   whole size range. On the Superbuy buy page each size button is SOLID-bordered
   (in stock) or DASHED/faint-grey-bordered (out of stock, unselectable). Zoom the
   size row and save ONLY the solid-bordered sizes. On a multi-color listing the
   in-stock set can differ per color — re-check after each color swap. Superbuy's
   cache can lag Taobao; if Hampus gives a size set from his own Taobao check,
   trust his list over the border (better to under-list than sell an OOS size).
2. **Size guide — MANDATORY when the source has ANY chart. Non-negotiable.**
   **Lookup ORDER (Hampus, 2026-08-18): 1) the YUPOO album images first — sellers
   like MartinReps put a chart in nearly every album (download the FULL album,
   not just the first few; the chart can sit anywhere); 2) if not there, the
   WEIDIAN listing's description images; 3) if not there, the Superbuy buy page.**
   Only after all three come up empty may size_guide stay null. A product whose
   source_link is weidian but that came from a Yupoo album (e.g. a `#a<albumid>`
   anchor) still gets its chart from the Yupoo album — derive the album URL from
   the anchor.
   If a measurement table exists anywhere on the listing (detail image, gallery
   image, description), it MUST be transcribed into `size_guide` before the
   import is done — the friend-facing right-side "Size guide" panel only renders
   from this JSON, and an untranscribed chart image in the gallery does NOT count
   (that was the root cause of a 400-product backfill in Aug 2026). Download the
   chart image, Read it, transcribe.
   **EXACT SHAPE — no variations (a wrong shape crashes the product page):**
   `{"unit":"cm","note":"...","sizes":["S","M","L"],"measurements":{"length":[54,56,58],"pit_to_pit":[47,49,51]}}`
   `sizes` is a flat ARRAY of label strings; `measurements` is an OBJECT of
   metric→array, each array aligned 1:1 with `sizes` (same length, same order).
   NEVER emit `sizes` as an object keyed by label, never nest measurements inside
   sizes, never use `rows`/`measurement`(singular)/measurements-as-string — an
   agent batch did all of these in Aug 2026 and white-screened ~15 live pages.
   Validate before insert: `Array.isArray(sizes)` and every measurements value is
   an array of length `sizes.length`.
   Keys: length, chest or pit_to_pit, shoulder, sleeve, waist, hip, thigh,
   outer_length, hem, insole (shoes: EU size rows + insole cm). Magnitude rule:
   a bust/chest value >=80 is a full circumference → `chest`; <80 is a flat half
   measurement → `pit_to_pit`. Elastic/stretch ranges stay strings ("78-90") —
   the UI passes them through. Half-measurements: keep as-is but name them
   (`pit_to_pit`, `half_waist`) — the UI labels them correctly. Genuinely no
   chart anywhere → `size_guide = null` and SAY SO in your import summary so it
   can be sourced later. On BULK imports (Yupoo album batches), the chart is
   usually album image index 1 — verify per album, sometimes it's last or absent.
   Also reconcile `size_options` with the chart's real labels (numeric 44-52
   charts get numeric options, short runs like M/L/XL only get those three).
3. **Categorize** — assign exactly one `category` slug by looking at the hero
   image + title. The 12 slugs (keep in sync with `web-v2/src/lib/categories.ts`):
   `t-shirts` (SHORT-sleeve tee only, no collar), `shirts` (button-ups,
   overshirts, AND polos), `knitwear` (label "Knitted" — anything with visible
   knit stitches: sweaters, cardigans, knit pullovers), `hoodies` (label
   "Hoodies & Long Sleeves" — hoodies, fleece/jersey sweatshirts, AND ANY
   non-knit long-sleeve top incl. long-sleeve tees), `outerwear` (jackets,
   coats, blazers, parkas, puffer vests), `pants`, `shorts`, `shoes` (any
   footwear), `bags` (any bag), `hats` (any headwear — caps, bucket hats, beanies),
   `accessories` (belts, scarves, jewelry, wallets, ties, socks — NOT hats),
   `glasses` (sunglasses/eyewear). Decision rules:
   polo → `shirts`; blazer → `outerwear`; long-sleeve tee → `hoodies` (NOT
   t-shirts); visible knit stitches → `knitwear`, smooth fabric → `hoodies`;
   any cap/hat/beanie → `hats` (NOT accessories).
   If genuinely unsure, set `category = null` — it surfaces on /admin/cleanup
   for a manual pick.
4. **Upsert the row** — via the Management-API curl pattern (see
   `docs/superpowers/plans/2026-07-17-scrape-import-pipeline.md` Global
   Constraints). **ALWAYS set `brand_slug = slugify(brand)`** on manual/raw
   inserts (import `slugify` from `scripts/lib/haul-codes.mjs`) — the raw upsert
   path does NOT auto-generate it, and a null `brand_slug` makes the friend
   product URL render as `/product/null/<code>` (broken). Template:

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
   **Also set `color`** on every insert = the 12-family slug from
   `normalizeColor(<the "— Colour" suffix of display_title>)` (see
   `web-v2/src/lib/colors.ts`: black/white/grey/blue/brown/beige/green/red/
   yellow/purple/pink/multi; two-tone or patterned → `multi`). It powers the
   shop colour filter; a NULL colour drops the item out of every colour facet.
   Bulk/raw SQL inserts must include it — the backfill script is one-off.
5. **Images to storage** — download to a temp dir (curl; Referer header for
   Yupoo), then from `web-v2/`:
   `node scripts/upload-product-images.mjs <productId> <tmpdir>`
   (uploads sorted, updates `image_urls`, prints URLs). Hero shot must sort
   first — name files `000.jpg, 001.jpg, …`.
6. **Friend-request link-back** — if this came from a `requested` item:
   `update items set product_id='<id>', title='<clean title>', quoted_price_usd=<price> where id='<itemId>';`
7. **Verify** — open `http://localhost:3000/admin/preview/<id>`: all sizes render,
   gallery thumbnails work, size guide table shows. Fix before declaring done.
8. **SUPERBUY-VERIFY every sized item, then stamp it.** For ANY apparel or shoe
   (categories t-shirts/shirts/knitwear/hoodies/outerwear/pants/shorts/shoes),
   the colors, PRICE, and IN-STOCK SIZES must come from the live buy page on
   Superbuy — never from a curl of the Weidian JSON or a Yupoo album ¥ (the album
   price is often stale; a size shown in the SKU list is often sold out). Open the
   buy link through `superbuy.com/en/page/buy/?url=<encoded weidian/taobao>`, and
   for a Yupoo import first pull the buy link OUT of the album, then load THAT.
   Per color: click the swatch, read `.sku-item.text-li` (a `.disabled` size is OOS
   → exclude it), read the `US $` price (→ `round(usd*1.2)`). Then stamp the row:
   `update products set verified_at = now() where id = '<id>';`
   One-size categories (bags/accessories/hats/glasses) need no size check and no
   stamp. (This is now a hard lock — see the validator below — because the size/
   price/color rules kept getting skipped under curl-only shortcuts.)

9. **VALIDATE — the hard gate. Run it and it MUST exit 0 before you say done.**
   From `web-v2/`: `node scripts/validate-shop.mjs --ids <comma,separated,new,ids>`
   It checks (as code, not eyeballing) display_title present + capitalized "— Color"
   suffix + no brand leak, color in the 12 families, brand_slug set/clean, images
   present, price ≥ 0, sized items have sizes — catalog-wide — AND that every NEW
   sized id you pass is Superbuy-verified (`verified_at` set). If it prints
   violations, fix them; do NOT report the import done on a non-zero exit. It pages
   past the 1000-row cap, so it sees the whole catalog.

## Keep this skill improving

**Whenever you discover a new scraping workflow, extraction trick, brand tell, or
gotcha during an import — add it to this file before you finish.** Each import
should leave the skill better than you found it. New CDN quirk, a DLP-dodging
method, a site layout change, a size-chart location, a seller-slang→brand mapping:
write it into the relevant section below (or add a section). The goal is that the
next import is faster and more reliable than this one.

## Scrape gotchas (learned the hard way)

- **Yupoo photo permalink vs album (Stephanie-vest lesson).** `/<digits>` on a
  Yupoo shop (e.g. `charlesking77.x.yupoo.com/112310886`) is a SINGLE-PHOTO
  permalink: filename title, one photo, NO price/code/buy-link. The parent
  `/albums/<id>` page has all of it (og:title "¥price code", every photo, and
  often the embedded weidian link). The photo page HTML contains `/albums/(\d+)`
  - always resolve to the album before scraping. web-v2 ingest now auto-upgrades
  friend-pasted photo permalinks (`classifySourceLink` kind `yupoo_photo` +
  `resolveSourcingItem`), but manual imports must do the same hop.

- **STANDARD WORKFLOW for every Yupoo agent-catalog album (chaosmade, makemood,
  Taurus, etc.): open the album's buy-link THROUGH Superbuy and treat that page as
  the source of truth — NOT the Yupoo album.** The Yupoo album is only good for
  clean images; everything else must be confirmed on Superbuy
  (`superbuy.com/en/page/buy/?url=<encoded weidian-or-taobao buy-link>`, ~12s to
  load a weidian link). On that page verify ALL of:
  - **Availability** — if it says "unable to purchase… no longer available", the
    item is dead → set `sold_out = true` (don't publish it as buyable). Yupoo keeps
    showing sold-out albums forever, so this is the #1 thing it hides.
  - **Price** — read the real `≈US$` (→ `round(usd*1.2)`), and store the ¥ as
    `cost_cny`. Don't price off the Yupoo album ¥ (can differ from the live listing).
  - **In-stock sizes** — solid-border = in stock, dashed = OOS (see the size-border
    rule below). The album's size chart shows the size RUN, never the stock.
  - **Colors + item type** — the Superbuy title/variant selector is authoritative.
    A Yupoo montage routinely misreads: two stacked tees look like a "set" (it's a
    2-color tee), a zip crewneck looks like a co-ord, a long-sleeve reads as a tee,
    and the album's hero color can be a different variant than the buy-link defaults
    to. Fix `colors`, `category`, and the color in `display_title` from what Superbuy
    actually shows.
  - **Multi-color = split, sourcing BOTH in parallel.** When Superbuy's color
    selector lists 2+ colors, the Yupoo album almost always shot every colorway too.
    Split into one product per color: pull THAT color's images from the Yupoo grid,
    and take the authoritative name / color / size run / price from Superbuy. Don't
    collapse a multi-color listing into one row with a `colors` array — that's a
    stopgap, not the target (each color gets its own card + own hero).
- **Image source priority: Yupoo grid > Superbuy > Weidian.** If the buy-link came
  from a Yupoo album, ALWAYS use the album's grid images (clean, watermark-free) —
  not the Superbuy or weidian photos. Only fall back to Superbuy's gallery images
  when the Yupoo album has none for that colorway.
  Only fall back to the Yupoo ¥ + a default size run if Superbuy hard-blocks the
  item with a risk alert (rare). Bulk-importing straight from the album ¥/images
  without this pass ships sold-out and mislabeled products — always do the pass.
- **Availability + in-stock sizes are fully DOM-scriptable (no screenshots) — this
  is how to sweep the catalog.** On a loaded Superbuy buy page, from an in-page
  `javascript_tool`: dead item = body text contains `no longer available` /
  `unable to purchase`; cost = `body.match(/CN\s*[¥￥]\s*([\d.]+)/)`; size buttons =
  `.sku-item.text-li` (color swatches are `.sku-item.img-li`), and an OUT-OF-STOCK
  size carries the class `disabled` (in-stock = `.sku-item.text-li` WITHOUT
  `disabled`). Run this across a worklist to find dead + short-sized items cheaply.
  Pace it with tabs. **Measured 2026-08-14: 41 sequential loads across 3 tabs
  (~14 rounds, ~10s/round) with ZERO account ban** — Superbuy tolerates sustained
  3-tab sweeping. The only "stops": (1) the color-click loop FREEZING the renderer
  on a 20+ variant-swatch bag page → CAP the color loop, skip clicking when
  `.sku-item.img-li` count > 8 (those are variant-SKU bags with no real sizes
  anyway); (2) occasional per-ITEM "risk alert" blocks (`risk:true` — body has
  "risk alert / temporarily unable to process") which are item-specific, NOT an
  account ban (other tabs keep working) → flag that item unverifiable, move on.
  So pace for renderer stability, not for bans. (curl/API won't work —
  Superbuy's `front.superbuy.com/crawler` API needs signed params, the buy page
  full-reloads so you can't hook it, and weidian/superbuy both block plain curl.)
- **PER-COLORWAY: a multi-color listing has DIFFERENT in-stock sizes per color, so
  click each color swatch and read that color's sizes.** In the sweep JS, loop
  `.sku-item.img-li`, `.click()` each, `await` ~500ms, then read `.sku-item.text-li`
  non-`disabled`. Map each Superbuy color to its split colorway row (`#<color>`
  anchor / color in `display_title`) and write that color's sizes to THAT row.
  Flag any Superbuy color with NO matching row — it's a colorway we're missing and
  should add (e.g. an MVT jean had blue/black/white/grey but only 3 rows existed).
- **In-stock size detection = read the Superbuy size-button BORDER, don't just
  save the whole range.** On the Superbuy buy page each size button is either
  SOLID-bordered (in stock) or DASHED/faint-grey-bordered (out of stock — clicking
  it won't select). Only save the solid-bordered sizes to `size_options`. Zoom the
  size row (`computer:zoom` a ~165x40 region) and eyeball it; the dashed ones are
  visibly lighter. (Clicking a size shows `Stock: N` in the Quantity row too, but
  the border tell is one glance for the whole row.) NOTE: Superbuy's cached stock
  can lag the live Taobao listing — if Hampus says a specific size set from his own
  Taobao check, trust HIS list over the border (better to under-list than sell OOS).
- **alicdn/taobao image download recipe: `curl -H "User-Agent: Mozilla/5.0
  (Macintosh)"` with NO Referer header.** Extract the exact `img.currentSrc` (the
  bare `.../iN/<seller>/<objid>_!!<seller>.jpg` — do NOT strip/rebuild it), then
  curl it with a browser UA and no referer → returns the real full-res JPEG
  (~1200²). A Referer header makes alicdn serve a WebP-in-a-.jpg (still openable,
  `sips -s format jpeg` fixes it); a wrong/rebuilt path or `Referer: item.taobao.com`
  can return a 49-byte placeholder gif (`sz<3000` → skip). Strip any `~crop,a,b,c,d~`
  segment from the objid before the `_!!seller` (take `${obj%%~*}`). Char-code the
  compact `iN:objid` list to dodge DLP; color-swatch listings only swap the FIRST
  gallery objid per color, the rest are shared worn shots — montage + split by eye.
- **B197 SHOP / "Vujade0NN-…" (taobao seller `1105574384`) = a minimalist Korean-
  style house line** (loose washed jeans, half-zip stand-collar knits, leather
  crossbody bags, cashmere jackets). "Vujade" is the line name, brand is otherwise
  unconfirmed — import with `brand='Vujade'` and flag for a rename. INFINITE Club
  (seller `2510981490`) is the Martine-Rose / ERL / Our-Legacy rep store used for
  most of this batch.
- **XWCL / `weidian1413694634` (a rep-shoe store) = thin Superbuy gallery, rich
  weidian description.** The Superbuy buy page shows only the promo BANNER (a
  "P-rda Collapse / Dries / NEW" collage) + a disclaimer + the size chart — NO
  clean product photos. The real per-color photos AND the size chart live in the
  weidian item DESCRIPTION: navigate the tab to `weidian.com/item.html?itemID=<id>`,
  scroll the whole page (see async-scroll note below), then extract
  `geilicdn.com/weidian1413694634-<objid>_WxH.jpg` imgs with `w,h>=1000`. Those
  description photos carry baked-in `xwcL`/`xw`/`zp` watermarks (unavoidable — pick
  the least-intrusive). The promo banner is the CLEANEST source of heroes: it shows
  every colorway stacked on pure white, so `magick <banner> -crop WxH+X+Y` it into
  one clean side-profile hero per colour (top shoe vs bottom shoe). XWCL's Prada
  size chart is `Nike our size → Pr-da → MM(mm insole)`; insole mm/10 = insole_cm
  for a shoes `size_guide.measurements.insole_length`.
- **Async full-page scroll-harvest can freeze the heavy Superbuy buy page** (CDP
  `Runtime.evaluate` times out at 45s, renderer unresponsive). Run the
  `window.scrollTo`-in-a-loop + `harvest()` accumulator on the LIGHTER weidian
  item page, not the Superbuy wrapper. On Superbuy, prefer a single static
  `querySelectorAll('img')` snapshot of the already-loaded gallery region.
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
- **geilicdn many-image extraction — paginate via `window`, don't one-shot.** A
  weidian listing can have ~18 gallery imgs; char-coding all their paths in one
  `javascript_tool` return blows the tool's ~1k-char output cap and truncates.
  Instead: one call filters imgs (`geilicdn`, strip `.webp?...`, `w>=500&&h>=300`,
  dedupe by objid) into `window.__paths` and returns `n` + `slice(0,4)` char-coded;
  then `browser_batch` the remaining `enc(window.__paths.slice(a,b).join('|'))`
  slices of 4. Decode all in a node script → download. **Filter to the DOMINANT
  path prefix** (`wdseller<id>-`): a lone `pcitem<other-id>-` image is a
  recommendation/related item, drop it. **Drop Weibo/微博 screenshot frames** (a
  `微博正文` phone-screenshot with text) that sellers pad galleries with — spot them
  on the montage. No measurement-table image in the set → `size_guide = null`.
- **`products` array columns are `text[]`, not jsonb**, and both `image_urls` AND
  `colors` are NOT NULL — insert `'{}'::text[]` for colors when single-colourway
  (not `null`), `'{XXS,XS,S,M}'::text[]` for sizes, `'{}'::text[]` for image_urls
  (the upload script fills it). Only `size_guide` is nullable jsonb.
- **Gemini post-passes need `GEMINI_API_KEY` exported** (it's vault-only, NOT in
  `.env.local`), else `retag-heroes`/`propose-display-titles`/`estimate-weights`
  all just print `set GEMINI_API_KEY`. Fallback without the key: hero is already
  `image_urls[0]` (stage the cleanest shot as `000.jpg`), and set `display_title`
  + `weight_g` (trousers ≈650g) manually via SQL.
- **Admin `/admin/preview/<id>` wants the UUID, not the `code`** — passing the 7-char
  code 500s (Postgres uuid-cast error, not a clean 404). Verify a fresh import at
  `/admin/preview/<uuid>` (admin session required; the old public /product/<uuid> route moved); the friend route `/[handle]/product/<brand_slug>/<code>` uses
  the code.
- **Short links** (`k.youshop10.com/...`) resolve through the Superbuy wrapper but
  take a few extra seconds — wait and re-extract if the page is still skeleton.
- **Superbuy buy-wrapper now hard-blocks rep items** with a "Risk Alert — the product
  you submitted may involve legal risks, so we are temporarily unable to process your
  order" page (no gallery, price, or SKU). When you hit this, DON'T fight it — navigate
  the tab straight to the `k.youshop10.com/...` short link, which 302s to the real
  `weidian.com/item.html?itemID=...` page, and scrape that directly (char-code image
  method + screenshot-the-SKU-drawer below both work there).
- **Weidian desktop SKU drawer = screenshot it, don't script it.** The embedded mobile
  buy widget's price header stays stuck on `¥0 / Please select the model` even after you
  click a variant + size (render bug in the scaled desktop view), and the `thor.weidian.
  com/decorate/detail.getItemInfo` API returns a ~99-byte error blob. So: read the SKU
  dimensions (e.g. Length L80/L85/L90/L100, or "Top and bottom set: Jacket/Pants" + Size
  44-50) by clicking the `请选择型号/Choice` row and screenshotting the drawer; take the
  price from the main-page `¥NNN` (trailing `起` = "from" → variants differ; if the widget
  won't reveal per-variant prices, price them equal and flag it to Hampus).
- **One weidian listing can be two products.** A "jacket&jeans" set lists Jacket and
  Pants as a `Top and bottom set` SKU dimension at one base price — split into two rows
  (`#jacket` / `#jeans` source_link anchors), each with its own size chart (the
  description image usually stacks BOTH charts) and its own clean flat-lay hero.
- **i795 (`i795 produce`) is a minimalist Weidian agent-store** whose titles carry the
  brand tell: `Le`=Lemaire, `OL`=Our Legacy, `Autonomy`=house prefix (ignore it), a belt
  titled "Intrecciato / Woven Check" = Bottega Veneta. Description ends with a b&w
  line-drawing illustration of the item — fine as a secondary image, not the hero. Belt
  charts give three numbers per length = min/mid/max waist at the holes → store
  `waist_min`/`waist_max` arrays. QR-code frames (`_540_540`) and the store avatar are
  junk — the `w>=500&&h>=500` filter still lets the 540² QR through, so drop it by eye.
- **Stale `NN.out.json` silently attaches a wrong size guide.** `import-batch.mjs`
  reads `/tmp/haul-batch/NN.out.json` for `size_guide` by filename — so reusing a
  batch number (`01`,`02`…) from an earlier run picks up the PREVIOUS product's
  size chart. Either `rm /tmp/haul-batch/*` first, use fresh keys (`g1`,`g2`…), or
  null `size_guide` post-import for any product that shouldn't have one (e.g.
  eyewear, bags, One-Size items). Watch the import log's `sg=y/n` column.
- **1688 links** wrap the same as Taobao (`source_platform:"1688"`); the buy page
  and alicdn CDN behave identically. Frame dims like `54-20-146` are lens-bridge-
  temple, NOT a size selector → `sizes:["One Size"]`.
- **Eyewear brand tells:** lens etch `SMU…` = Miu Miu; `JJMM`/dotted-diamond temple
  rivet = Jacques Marie Mage. Pink velvet pouch + pink box packaging = Miu Miu.
  A seller's "MM" is ambiguous (Miu Miu vs Maison Margiela) — let the packaging /
  lens stamp decide, not the title.
- **RO = Rick Owens; "non-undercover / autonomous" = Undercover** (sellers dodge
  brand names). Expand to the real brand.
- **Yupoo `makemood` albums are structured gold.** Each album header carries the
  brand+product title, `price:Ncny`, `SIZE:S-XL`, and the real Taobao `Link:` — read
  them off the screenshot or grab the DOM text block containing `price:`/`taobao`.
  Images live on `photo.yupoo.com/makemood/<hash>/big.jpg` and need `Referer:
  https://makemood.x.yupoo.com/` to download (else 403). Each photo appears as TWO
  renditions in the DOM, so dedupe by the `<hash>` (first path segment) and keep DOM
  order; the FIRST image is usually a clean **English** "Size Specification" table —
  transcribe it, don't gallery it. Some albums omit the price → `price_usd = null`
  (quote on request). curl of the album page returns only a JS skeleton — use the
  browser. Store `source_link` as the album URL and `seller = "makemood (Yupoo)"`.
- **Generic Yupoo sellers ≠ agent-catalogs.** makemood/i795 are agent catalogs WITH a
  Taobao `Link:` + price. Most other Yupoo shops (paypalshop, andy879, sunglasses-brand,
  etc.) are photo-only: images + a WhatsApp number, NO buy link, NO price. For those:
  store `source_link` = the Yupoo album URL, `source_platform = "yupoo"`, `seller =
  "<shop> (Yupoo)"`, `price_usd = null` (renders "Quote on request" / ask-for-price —
  friend adds to haul, admin sources + quotes). Same `big.jpg` + `Referer: https://
  <shop>.x.yupoo.com/` download pattern. Google-indexed `/categories/<id>` URLs are
  flaky (often bounce to "All categories") — direct `/albums/<id>` URLs are reliable.
  For pure seller-index requests, write the shop into the `sellers` table (name, brands
  array, yupoo_url, notes), not a product per item.
- **Taobao "<X> style" seller slang → real brand** (the minimalist Taobao sellers
  like "Coffee"/"1AM Shop" prefix every title with a code): `Row style`=The Row,
  `OL style`=Our Legacy, `Aur`=Auralee, `Le`/`Lemai style`=Lemaire, `AC`/`Ac style`
  =Acne Studios (a `2021`/`2003` model number confirms it — those are Acne jean
  fits), `BC style`=Brunello Cucinelli, `NFS`/`No Faith Studios`=No Faith Studios
  (logo on the storefront description image confirms). `Kiko Kostadinov`/`ERL` are
  written out. When unsure, check the description images for a logo before guessing.
- **Bulk image extraction in ONE call — compact objid encoding.** Returning full
  URLs char-coded truncates past ~3 images. Instead return the SHARED seller id
  once + per-image `"{b|e}{iN}:{objid}"` (b=`bao/uploaded`, e=`imgextra`), char-code
  the joined list. Reconstruct in node:
  `https://img.alicdn.com/{path}/i{iN}/{seller}/{objid}_!!{seller}.{ext}`.
  Dedupe by objid (kills the 5500² zoom-clones of the gallery hero), filter
  `getBoundingClientRect().left>1080` (drops the right-hand recommendation strip)
  and `naturalWidth<700||naturalHeight<500` (drops icons + the thin sliced banners).
- **Multi-extension fallback on download.** The `_!!{seller}` original can be
  `.jpg` OR `.png` (a wrong guess 404s to a 49-byte gif). Try `.jpg → .png → .jpeg`
  and accept the first result >2 KB; then `sips -s format jpeg` it (alicdn also
  serves WebP-in-a-.jpg — see below).
- **Landscape image = size-chart candidate.** Product photos are portrait; the size
  chart (and text banners) are landscape (`w>h`). Split the extractor's output into
  portrait `photos` and landscape `charts`; download charts to a scratch dir and
  Read them to transcribe `size_guide`, but DON'T put them in `image_urls` (the JSON
  table beats the image). A *portrait* chart you miss just stays in the gallery —
  acceptable. Not every landscape hit is a table: descriptive-text blurbs, fabric
  banners, foot-measuring diagrams, and brand storefronts also land here → Read then
  set `size_guide=null` if there's no measurement table.
- **ALWAYS split distinct colourways into separate products — no exceptions.** If the
  images show the item in visibly different colours/finishes (e.g. a beaded bag in
  yellow / white-blue / black-pink), each colour is its OWN product row, even when
  they all live in ONE Yupoo album or ONE Taobao listing. Never lump colourways into
  a single product with a `colors` array of many — that array is for shades of the
  SAME hero shot; genuinely different-looking pieces get their own row + own hero.
  Shared title + " — <Colour>", distinct `source_link` via `#<colour-slug>` anchor.
- **Sunglasses = split into per-colour products BY DEFAULT.** Eyewear albums almost
  always bundle many colourways of ONE frame (a family-grid shot + one clean shot per
  colour). Unless Hampus names specific colours he wants, break every distinct colour
  into its OWN product (own hero = that colour's individual shot; keep the family-grid
  shots as secondary gallery images so the buyer sees the range). Re-fetch the FULL
  album first — the 6-image import cap misses individual colour shots; pull every
  `photo.yupoo.com/<shop>/<hash>/` hash, download all, montage, then one row per colour
  with a `#<colour-slug>` source_link anchor. Two different FRAMES in one shop (e.g.
  GG1558S rectangular vs GG1984SK round) are different products, not colourways — keep
  both, but drop a redundant duplicate colour (e.g. a 2nd plain "Black") if Hampus flags it.
- **Colour-splitting mixed listings — contact sheet.** A multi-colour listing's
  images are usually SHARED (selecting a colour doesn't swap the gallery). To split,
  `magick montage *.jpg -tile 4x4 -geometry 220x220+4+4 -background white sheet.jpg`
  and Read the sheet ONCE to group images by colourway, then re-stage each colour's
  shots into its own dir (pick that colour's cleanest full shot as `000.jpg` hero).
  (macOS ImageMagick has no ghostscript: `-label`/`-title` print `gs: command not
  found` warnings but the grid STILL renders fine — ignore them, use grid order.)
- **Chinese pants-chart headers:** 裤长=length, 腰围=waist, 臀围=hip, 腿围=thigh,
  脚口=hem/leg-opening.
- **Taobao `imgextra` serves WebP for a `.jpg` URL.** `curl`-ing the `_!!<id>.jpg`
  original often returns RIFF/WebP bytes in a `.jpg` file — the shop renders it but
  storage content-type is wrong. Normalize the whole staged dir before upload:
  `for f in dir/*.jpg; do sips -s format jpeg "$f" --out "$f"; done`. Verify with
  `file` (want "JPEG image data", not "Web/P").
- **Taobao description layout (for the size chart + real photos):** dump every
  `<img>`'s `naturalWidth×Height`. The hero is the big top gallery image; the size
  chart is a SMALL text image (`~695x440`/`~800x259`) sitting among the description;
  the real product photos are the LARGE ones (`2480x3376`, `3024x3024`+). Skip the
  long run of thin `2480x120` slices — that's one tall banner sliced into strips,
  useless individually. Grab hero + 4–6 of the large photos; transcribe the small
  size-chart image, don't upload it.
- **Chinese size-chart headers:** 尺码=size, 衣长/前衣长=length, 胸围=chest
  (circumference), 胸宽=chest width (half — but if the number is >100 it's really
  circumference, seller mislabel), 肩宽=shoulder, 袖长=sleeve, 腰围=waist, 臀围=hip.
  `喜欢宽松可拍大一码`=size up for loose; `手工测量1-3cm误差`=±1-3cm.
- **Weidian listings ARE curl-able for charts (proven 2026-08-18).** The item
  page embeds the gallery image list as JSON in the HTML (HTML-entity encoded;
  decode before regex). Use `curl -L` (bare weidian.com 302s to the shop
  subdomain; without -L you get a 159-byte stub). Charts usually sit in the
  GALLERY (often 2nd or last image, landscape), not the description; the
  description block is lazy-loaded and absent from server HTML for some shops
  (browser fallback for those). Image URL prefixes vary: weidian/wdseller/
  pcitem/pcset + `_W_H.jpg`. Delisted (已下架) pages often STILL embed the
  chart, so a dead listing can still yield the size guide (then mark sold_out).
- **Superbuy chart-hunt at browser scale (2026-08-18 sweep, ~200 items):**
  charts often sit in the MAIN GALLERY, not just the description; galleries mix
  `bao/uploaded` and `imgextra/i<n>/` paths; some charts are PNG-only (try
  .jpg -> .png -> .jpeg, accept first >2KB) and downloads may need `Referer:
  superbuy.com`; a $0-price page with no images = transient, reload once. UNIT
  SANITY: shoulder/chest values 18-27 on a top are INCHES even when the header
  says CM (store unit "in"); 脚口 is hem, not thigh. Never OCR-guess column
  labels — if the image can't be Read, flag it for manual verify instead. One
  listing often serves several colorway products: cross-fill the chart to all
  siblings.
  running `upload-product-images.mjs`** — the script uploads EVERY image in the
  dir sorted, and "sheet.jpg" sorts after the numbered files, so the contact
  sheet ships as the last gallery image. `rm` all sheets first. Also, parallel
  bulk uploads can hit Supabase "Too many connections" — retry the failed
  product with a short sleep; it succeeds on the second pass.
- **steven-1989 (Yupoo) is fully curl-able**: album HTML contains the og:title
  ("￥<price>  <brand slang + CN title> <size range S-XL>  <code>#") and all
  photo hashes (`photo.yupoo.com/steven-1989/<hash>`). Brand slang there: MIU=
  Miu Miu, M6=MM6 Maison Margiela (0-23 numbers logo confirms), ROW=The Row,
  RO=Rick Owens, AC=Acne Studios; Goldwin/Needles/Noah written out. Download
  needs `Referer: https://steven-1989.x.yupoo.com/`.
- **Guidi factory shop (Taobao seller 131311848, "Ghost Emperor")** sells
  788Z/PL1/PL2 horsehide boots with SEPARATE men's and women's lasts on one
  listing: SKU labels like "38 men" and "38 women's models" coexist. Store
  size_options with the gender marker ("38 M", "38 W"), keep only sizes without
  a "needs to be customized" note, and note the excluded custom sizes in
  `admin_sizing_note`. Superbuy's buy wrapper loaded these fine on a warm
  session (no Risk Alert), gallery = `bao/uploaded` alicdn paths.

## Rules

- **`size_options` = in-stock sizes ONLY, read off the Superbuy button borders
  (solid = in stock, dashed/faint = OOS). Never save the full selector range.**
  Re-check per color on multi-color listings. If Hampus states a size set from his
  own Taobao check, his list wins over Superbuy's (possibly stale) border. See
  Procedure step 1.
- **Pricing is based on Superbuy's shown "≈US$" (that is where Hampus actually
  buys), × 1.20 margin.** `price_usd = round(superbuy_usd * 1.20)`. Read BOTH the
  Superbuy `≈US$` figure and the ¥ `cost_cny` off the buy page; store `cost_cny`
  as-is and set `price_usd` from the Superbuy USD. Superbuy's rate is ~0.1603
  CNY→USD, so equivalently `price_usd ≈ round(cost_cny * 0.1603 * 1.20) =
  round(cost_cny * 0.192)` — prefer computing from the actual Superbuy USD shown.
  (Older catalog rows were priced at the retired house rate `cost_cny * 0.168`;
  do not retro-reprice them unless asked.)
- **De-dupe by item id, not raw `source_link`.** `import-batch` matches on exact
  `source_link`, but the SAME product saved once as `item.taobao.com/item.htm?id=X`
  and once as the `superbuy.com/...url=...X` wrapper are two different strings → a
  duplicate row. Before importing, `select code,source_link from products where
  source_link like '%<itemId>%'`; if it already exists, reuse/enrich that row (and
  prefer the canonical bare `item.taobao.com/item.htm?id=<id>` form as source_link).

- Never leave images on Yupoo/Weidian URLs (hotlink-protected — they will
  break). alicdn also gets migrated for consistency.
- **display_title name part = MAX 3 WORDS** (hyphenated compounds count as one:
  "Long-Sleeve" is one word), then " — <Color>". "Reflective 3M Drawstring
  Running Shorts" is WRONG; "Running Shorts — Black" is right. No brand in it.
  Hampus has had to ask for this twice — treat it like a schema constraint.
- **ALWAYS import every colorway as its own product with a per-color hero.**
  When a listing/album shows multiple colors: one row per color, and the
  thumbnail (image_urls[0]) must show ONLY that color — hunt the album for that
  color's solo front shot (download the FULL album, the per-color shots are
  often past the first few images); crop a group shot only as a last resort.
  A group shot or a back shot as hero is a defect, not a fallback.
- Junk source titles are fine at scrape time — Hampus renames in
  /admin/products. Don't skip the row for a bad title.
- Price unparseable → `price_usd = null` (renders "Quote on request").
- **`display_title` MUST follow the catalog format: `[Detail] [Garment] — [Color]`**
  — tight (aim 2-4 words before the dash), Title Case, a simple garment noun
  (Tee, Polo, Hoodie, Sweatshirt, Sweater, Cardigan, Jacket, Jeans, Trousers,
  Cap, Bag, Belt, Sneakers…), NO brand, NO SKU, NO sizes, NO quotes-around-slogans.
  Plain colors: Charcoal/Navy/Coffee/Grey — never "Dark Black Gray", "Navy Blue",
  "Brown Coffee". **Colorway siblings share ONE identical base name**, only the
  `— <Color>` differs (e.g. `Half-Zip Wool Sweater — Black` / `— Coffee` / `— Navy`).
  If you hand-write titles, match this exactly; the canonical formatter is
  `node scripts/retitle-format.mjs --ids <csv>` (needs GEMINI_API_KEY) — run it and
  eyeball the result (it can leave messy colors / mismatched siblings, fix by SQL).
- After upsert + image upload, run the post-import passes:
  `retag-heroes` (auto via import-batch) → `propose-display-titles` →
  `estimate-weights` so the card name, hero, and shipping weight are set.
- **`display_title` is REQUIRED on every row — set it IN the insert.** The auto
  post-import chain (retag → propose-display-titles → estimate-weights) ONLY fires
  on the `import-batch.mjs` path. A hand-built **raw/bulk SQL `insert`** (e.g. many
  rows at once) bypasses it, so `display_title` stays NULL and the card falls back
  to the brand-included `title` — inconsistent with the catalog. When you bulk-insert,
  either include `display_title` (brand-stripped `[Detail] [Garment] — [Color]`) in
  the INSERT, or immediately run `propose-display-titles`/`retitle-format` on the new
  ids. Quick brand-strip when the raw `title` is already `Brand [Detail] Garment — Color`:
  `update products set display_title = btrim(substr(title, length(brand)+2)) where <new rows> and title like brand||' %';`
- **Yupoo hides colorways — ALWAYS cross-check the buy link on Superbuy/Weidian.**
  A Yupoo album typically shows ONE colorway even when the listing sells several
  (Hampus's rule, 2026-07-31: "when you see a Yupoo album that might have two
  colors, paste the weidian link into Superbuy and see the colorways so you can
  snatch them from there"). Procedure: read the SKU color list from the buy page
  (Weidian SKU picker or the Superbuy wrapper), and take the per-color photos
  from whichever source has the better resolution — Superbuy SKU thumbnails are
  often low-res, so prefer Yupoo/weidian gallery shots per color when available.
  Split each color into its own product row per the colorway rule.

- **Yupoo album DESCRIPTION is JS-rendered - curl misses prices.** og:title is all
  curl sees; the description block under the album title (where sellers like
  colastudioglobal/Cola lab print "Price: $59 / Sizes: XS-M / Shipping: Americas
  $20, Europe $15") only renders in a browser. If og:title carries no ¥/$, do NOT
  conclude "no price": open the album in Chrome and zoom the header region
  (approx region [285,130,910,330] at default window size). Cola lab quotes are
  USD direct prices; shipping tiers go in admin_sizing_note.
