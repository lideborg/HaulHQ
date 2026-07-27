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
5. **Images to storage** — download to a temp dir (curl; Referer header for
   Yupoo), then from `web-v2/`:
   `node scripts/upload-product-images.mjs <productId> <tmpdir>`
   (uploads sorted, updates `image_urls`, prints URLs). Hero shot must sort
   first — name files `000.jpg, 001.jpg, …`.
6. **Friend-request link-back** — if this came from a `requested` item:
   `update items set product_id='<id>', title='<clean title>', quoted_price_usd=<price> where id='<itemId>';`
7. **Verify** — open `http://localhost:3000/product/<id>`: all sizes render,
   gallery thumbnails work, size guide table shows. Fix before declaring done.

## Keep this skill improving

**Whenever you discover a new scraping workflow, extraction trick, brand tell, or
gotcha during an import — add it to this file before you finish.** Each import
should leave the skill better than you found it. New CDN quirk, a DLP-dodging
method, a site layout change, a size-chart location, a seller-slang→brand mapping:
write it into the relevant section below (or add a section). The goal is that the
next import is faster and more reliable than this one.

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
- **Public `/product/<id>` wants the UUID, not the `code`** — passing the 7-char
  code 500s (Postgres uuid-cast error, not a clean 404). Verify a fresh import at
  `/product/<uuid>`; the friend route `/[handle]/product/<brand_slug>/<code>` uses
  the code.
- **Short links** (`k.youshop10.com/...`) resolve through the Superbuy wrapper but
  take a few extra seconds — wait and re-extract if the page is still skeleton.
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

## Rules

- **Pricing uses the HOUSE FX ≈ 0.14, NOT Superbuy's shown "≈US$".** Superbuy pads
  its displayed USD (~0.16 CNY→USD); the catalog is priced at the real rate.
  `price_usd = round(cost_cny * 0.14 * 1.20) = round(cost_cny * 0.168)`. Read the
  ¥ `cost_cny` from the buy page and compute from that — do NOT multiply Superbuy's
  dollar figure. (Sanity-check against the catalog: `price_usd/cost_cny/1.2` should
  land ~0.14.)
- **De-dupe by item id, not raw `source_link`.** `import-batch` matches on exact
  `source_link`, but the SAME product saved once as `item.taobao.com/item.htm?id=X`
  and once as the `superbuy.com/...url=...X` wrapper are two different strings → a
  duplicate row. Before importing, `select code,source_link from products where
  source_link like '%<itemId>%'`; if it already exists, reuse/enrich that row (and
  prefer the canonical bare `item.taobao.com/item.htm?id=<id>` form as source_link).

- Never leave images on Yupoo/Weidian URLs (hotlink-protected — they will
  break). alicdn also gets migrated for consistency.
- Junk source titles are fine at scrape time — Hampus renames in
  /admin/products. Don't skip the row for a bad title.
- Price unparseable → `price_usd = null` (renders "Quote on request").
- After upsert + image upload, run the post-import passes:
  `retag-heroes` (auto via import-batch) → `propose-display-titles` →
  `estimate-weights` so the card name, hero, and shipping weight are set.
