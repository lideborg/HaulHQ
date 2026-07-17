---
name: add-haul-item
description: Scrape a rep-fashion product link into a HaulHQ favorite — detect link type (Yupoo / Superbuy / Weidian / Taobao short link), pull high-res images, read the size chart, and write sizing advice against Hampus's body measurements. Use whenever Hampus pastes one or more product links to "add to favorites", "save", "what size", or import. Handles e.tb.cn short links, *.x.yupoo.com albums, and superbuy.com/page/buy wrappers.
---

# Add a HaulHQ item from a link

When Hampus pastes a product link (or several) to save as a favorite, this is the pipeline. The goal each time: a clean `data/favorites/<slug>.json` with real product name, price, local images (correct thumbnail), **and a size recommendation read from the actual size chart and compared to his reference garments.**

Always include BOTH `url` (Superbuy purchase link) and `yupoo_url` when the item came from Yupoo — the web app shows both.

## Step 1 — Detect the link type

| Link pattern | Type | Images live on | Size chart |
|---|---|---|---|
| `<seller>.x.yupoo.com/albums/<id>` | **Yupoo** | `photo.yupoo.com` | Rarely — last 1-2 album images, else ask seller |
| `e.tb.cn/h.xxx` or `m.tb.cn/h.xxx` | **Taobao short link** | resolves to `item.taobao.com` | In Taobao **detail images** |
| `superbuy.com/...page/buy/?url=...taobao...` | **Superbuy→Taobao** | `img.alicdn.com` | In detail images |
| `superbuy.com/...page/buy/?url=...weidian...` | **Superbuy→Weidian** | `si.geilicdn.com` | Often none |
| `k.youshop10.com/...` | **Weidian short link** | redirects to `weidian.com/item` → `si.geilicdn.com` | Often none |
| `goofish.com` / Xianyu | **Secondhand** | needs login — can't scrape | ask for screenshot |

**Key fact that drives everything:** `WebFetch` returns **403 on Superbuy** and **empty on `e.tb.cn` short links**. Those MUST go through the **Chrome MCP** (the browser is logged into Superbuy and renders the page). WebFetch *does* work on direct `*.x.yupoo.com` and direct `weidian.com/item.html?itemID=` pages.

## Step 2 — Scrape by type

### Yupoo (WebFetch works)
`WebFetch` the album URL → extract title, price (in title as `￥NNN`), Weidian/Taobao link, `photo.yupoo.com/.../big.jpg` image URLs. Download with curl + `-H "Referer: https://<seller>.x.yupoo.com/"` (CDN returns a ~7KB placeholder without it). Skip files <15 KB. FashionBroda and similar sellers put good descriptions on the album — capture into `notes`.

### Taobao short link / Superbuy wrapper (Chrome MCP required)
This is the proven flow — it resolves short links AND gets the size chart. Open the Superbuy wrapper URL in Chrome MCP, then run the extractor below via `javascript_tool`. See `reference/extract-superbuy.js` in this skill folder for the full script. It returns: resolved `srcLink`, `sellerId`, price, and **seller-filtered** gallery + detail image URLs.

Critical: filter every image to the hero's `sellerId` (`/<sellerId>/` or `-<sellerId>-` in the path). Without it you scoop up "recommended product" thumbnails from other shops. `img.alicdn.com` has **no hotlink protection** — plain `curl` downloads work.

### Weidian (WebFetch the direct item page)
`weidian.com/item.html?itemID=` 301-redirects to `shop<id>.v.weidian.com/...` — follow it. `si.geilicdn.com` images **reject non-browser curl** (writes 0 bytes silently) — pull them through Chrome MCP `fetch` if needed, or accept the one hero image the page exposes.

## Step 3 — Find and read the size chart

For Taobao/Superbuy items the chart is almost always **the first detail image** (occasionally a body-text table). Download the 2-3 detail images and `Read` them — they're size charts ~90% of the time. Chinese labels: 胸围=chest, 衣长=length, 肩宽=shoulder, 袖长=sleeve, 腰围=waist, 臀围=hips, 裤长=pants length, 大腿围=thigh, 脚口/裤口=leg opening. Watch for **half measurements** (半胸围 / a chest value like "55 (21.65")" where cm≈inches means it's the pit-to-pit, not full circumference — don't double-count).

Many Taobao brands also print a **height/weight guide** ("180cm/80kg = L") — quote it; it's the cleanest signal.

## Step 4 — Size recommendation against Hampus's references

Read `research/user-sizing.md`. Match the garment TYPE to his measured reference garments and recommend a size, stated plainly in the `sizing` field ("Size L for 183cm/75kg — …"). His body: **183cm, 75kg, ~96cm chest, 89cm waist (94-95 low/hips), ~46cm shoulder, EU 41 shoe.**

- **Tee** → regular zone pit 60-62 / shoulder 55-58 / length 72-75; oversized pit 64-71
- **Shirt** → oversized ref (JW Anderson) pit 74 / shoulder 62.5 / length 91 / sleeve 74.5
- **Knit/sweater** → good-fit ref (Jenkem) pit 69.5 / length 84; oversized (Acne knit) pit 71.5 / shoulder 69.5 / length 85.5
- **Blazer** → boxy (Yohji) pit 71 / shoulder 66.5; relaxed (OL) pit 70 / shoulder 60 / length 87
- **Pants** → his oversized zone full waist 105-111, inseam 76-84
- **Shorts** → full waist 105-111, inseam 22-30

If the item runs slim and even the largest size is under his oversized target, say so explicitly (don't pretend it'll be oversized). If Hampus says he wants a specific fit (boxy/oversized), size toward that reference, not "true to size."

## Step 5 — Write the favorite

Create `data/favorites/<slug>.json` (descriptive slug like `fb-loewe-poplin-shirt`, never `album-<timestamp>`) using the schema in `research/scraping-playbook.md` §2. Minimum fields: `user_label`, `url` (Superbuy), `source_url`, `yupoo_url` (if applicable), `title`, `brand`, `category`, `source`, `seller`, `price`, `status:"favorite"`, `sizing`, `size_chart` (when read), `notes`, `owners:["hampus"]`, `image_urls`, `local_image_paths`. First entry in `local_image_paths` is the thumbnail — put the cleanest front-facing product shot first (or whichever image Hampus names). Append `{"file":"<slug>.json"}` to `data/favorites/_index.json`.

Images go to `data/favorites/images/<slug>/000.jpg…`, paths stored relative (`images/<slug>/000.jpg`).

## Batch handling

Hampus often pastes 1-20 links at once. Dedupe against existing favorites first (`grep -l "albums/<id>" data/favorites/*.json`). For >4 items, dispatch parallel Agent subagents (4-7 items each — more blows the context reading detail PNGs). Don't re-scrape Yupoo aggressively (rate-limits after ~30-50 hits/session).

## The /import web UI (alternative flow)

There's a browser-based importer at `localhost:3000/import` for when Hampus wants to hand-pick images. Flow: `POST /api/import/preload {urls}` scrapes server-side → open `/import` in Chrome MCP → it auto-loads → Hampus tags each image (★ thumbnail / ✓ keep / 📏 size-chart, all start deselected) → Submit writes the favorites. The `POST /api/import/save` route only downloads tagged images. Use this when he says "open the import page" or wants visual selection; use the scripted pipeline above for "just add these."

## Reference files
- `reference/extract-superbuy.js` — the Chrome MCP page extractor (paste into `javascript_tool`)
- `research/scraping-playbook.md` — full source-by-source quirks, Chinese label table, schema
- `research/user-sizing.md` — Hampus's + Jan's measured reference garments
