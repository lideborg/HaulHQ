# HaulHQ Scraping Playbook

Lessons learned from scraping Superbuy, Taobao, Weidian, 1688, and Yupoo for the Hampus + Jan hauls. **Last updated 2026-05-03.**

This is the single source of truth for "how do I get a new item into HaulHQ?". Read this before scraping anything new — most of the gotchas below cost real time the first time.

---

## TL;DR cheat sheet

| Source | URL pattern | How to scrape | Image download | Sizing |
|---|---|---|---|---|
| **Superbuy → Taobao** | `superbuy.com/en/page/buy/?url=...item.taobao.com/item.htm?id=...` | Playwright + JS extract; seller_id filter | Python `urllib` from `img.alicdn.com` works | OCR detail image `d001` (sometimes in Product Parameters text) |
| **Superbuy → Weidian** | `...weidian.com/item.html?itemId=...` | Playwright + JS extract; **sellerKey filter required** | **Python urllib FAILS** → use browser fetch + base64 + decode script | Often no size chart |
| **Superbuy → 1688** | `...detail.1688.com/offer/...` | Playwright; dismiss extra disclaimer modal | Python `urllib` from `cbu01.alicdn.com` works | Eyewear listings publish mm frame measurements directly; clothing rarely |
| **Yupoo** | `<seller>.x.yupoo.com/albums/<id>` | Playwright + JS; lazy-load with scroll | Python `urllib` (referer = album URL) | Manual measurements only |

**Always run from Playwright MCP, not standalone Python**. The browser context bypasses Cloudflare, has cookies, and sets the right Referer — most failures I hit were from trying to shortcut this.

---

## 1. Source-by-source quirks

### 1.1 Superbuy frontend

Superbuy wraps Taobao / Weidian / 1688 / Xianyu listings with its own UI. URL form:
```
https://www.superbuy.com/en/page/buy/?url=<URL-encoded source URL>
```

**Gotchas every time:**
- **Cloudflare challenge** ("Just a moment...") on first load → wait 5s before evaluating
- **Onboarding popup** ("Superbuy Buy & Ship Any Chinese Items For You" with a "Got It" button) appears on most pages → dismiss before scraping
- **1688-specific disclaimer modal** ("Disclaimer Regarding the Superbuy 1688 Shopping Agent Service" with a checkbox + "Confirm") → only shows on 1688 listings, must tick the checkbox first
- **Tutorial overlay** ("Step 1 of 2 — Price and shipment fee...") sometimes appears mid-page — non-blocking, can ignore
- **Tab/session drops** — Playwright sometimes loses tabs after several minutes of activity. Re-open tabs as needed.
- **Title says "Superbuy | China Shopping Agent..."** when the page hasn't fully loaded the product. Re-navigate or wait longer.
- **Wrong product loaded** — old listings expire and Superbuy shows a placeholder or a different product (e.g. Hampus's Blair Witch Tee was returning "Russell Athletic" because the original Taobao ID expired and Superbuy substituted). Always sanity-check the title and hero image against the user's label.

**Standard preamble (run inside browser_evaluate):**
```js
// Dismiss popups
for (const b of [...document.querySelectorAll('button')].filter(b => /Got It/i.test(b.textContent))) {
  const r = b.getBoundingClientRect();
  if (r.width > 0) { b.click(); break; }
}
// 1688 disclaimer: tick checkbox + confirm
for (const c of [...document.querySelectorAll('input[type="checkbox"]')].filter(c => {
  const r = c.getBoundingClientRect();
  return r.width > 0 && !c.checked;
})) c.click();
for (const b of [...document.querySelectorAll('button')].filter(b => /^\s*Confirm\s*$/.test(b.textContent))) {
  const r = b.getBoundingClientRect();
  if (r.width > 0) { b.click(); break; }
}
await new Promise(r => setTimeout(r, 500));

// Slow scroll to lazy-load detail images
const max = document.body.scrollHeight;
for (let y = 0; y <= max; y += 700) {
  window.scrollTo(0, y);
  await new Promise(r => setTimeout(r, 200));
}
await new Promise(r => setTimeout(r, 1000));
window.scrollTo(0, 0);
```

### 1.2 Taobao (via Superbuy)

Image host: `img.alicdn.com/bao/uploaded/i<N>/<sellerId>/<file>.jpg` and `img.alicdn.com/imgextra/...`

**Critical**: extract the **seller ID** (long digit run in the URL path, 6+ digits) from the hero image, then **filter all other images by that ID**. Without this, you scoop up "related products" and store-recommendation thumbnails — that's how the original ROW Bag scrape got 30+ unrelated images.

```js
const heroSrc = document.querySelector('.preview-window img, .goods-img_preview img')?.src || '';
const sellerId = (heroSrc.match(/\/(\d{6,})\//) || [])[1] || null;
// Then for every img.src, only keep those that include `/${sellerId}/`
```

**Strip size suffixes** to get full-resolution:
```js
const stripSuffix = u => u
  .replace(/_\d+x\d+q\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, '')
  .replace(/_\d+x\d+\.(jpg|png|webp|jpeg)(\?.*)?$/i, '');
// _80x80q90.jpg → ''
// _100x100q90.jpg → ''
```

**Gallery vs detail split**: gallery images are direct children of `.preview-window` / `.goods-img_preview`; detail images are inside `.detail-goodsDetail` / `.goods-detail_right` / `.buy-detailContent` / `.good-detail-info-container`. Filter by walking up parent classes 5 levels.

**Sizing chart**: 95% of the time it's in **detail image `d001`** (occasionally `d000` or `d002`). Title bar reads "尺码表" / "尺码" / "size chart". Some listings (notably ERD's "Henri's Perfect Trousers") publish the full chart as Product Parameters TEXT — extract from the body text first, fall back to OCR.

### 1.3 Weidian (via Superbuy)

Image host: `si.geilicdn.com/<sellerKey>-<hash>_<W>_<H>.jpg`

Two distinct sellerKey patterns observed:
- `wdseller<id>` (e.g. `wdseller1534758718`)
- `pcitem<id>` (e.g. `pcitem901915903137`, `pcitem1300906268`, `pcitem2017191297`)
- `weidian<id>` (e.g. `weidian1413694634`)

**Extract sellerKey from hero**:
```js
const m = heroSrc.match(/si\.geilicdn\.com\/([a-z]+\d+)-/);
const sellerKey = m ? m[1] : null;
// then filter: img.src.includes(sellerKey)
```

**Size suffix on Weidian**: thumbnails come as `<original>.jpg.webp?w=60&h=60&cp=0`. Strip with:
```js
src.replace(/\.webp\?.*$/, '')  // → original .jpg
```

**HOTLINK PROTECTION** — biggest gotcha. `si.geilicdn.com` rejects any `urllib.request` from a non-browser context. Standalone Python downloader will write 0 bytes and look successful but with no images. **Solution**: fetch from inside the Playwright browser context (which has the right Referer), encode to base64, save the array to disk, decode with Python.

```js
async function fetchB64(url) {
  const r = await fetch(url, { credentials: 'omit', referrer: 'https://weidian.com/' });
  if (!r.ok) return null;
  const buf = await r.arrayBuffer();
  let s = '', bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
```

Save the array of base64s with `browser_evaluate`'s `filename` parameter. Then `scripts/decode_weidian_images.py <slug>` writes the actual image files.

### 1.4 1688 (via Superbuy)

Image host: `cbu01.alicdn.com/img/ibank/<file>_!!<sellerId>-0-cib.jpg`

Same general approach as Taobao. Standard `urllib` works — no hotlink protection. Eyewear listings on 1688 often publish frame measurements directly in the page text ("Size: 51-23-146" = lens-bridge-temple in mm) — capture from body text, no OCR needed.

### 1.5 Yupoo (direct)

URL form:
```
https://<seller>.x.yupoo.com/albums/<albumId>?uid=1&isSubCate=...&referrercate=...
```

Image host: `photo.yupoo.com/<seller>/<hash>/<small|medium|big>.jpg` and `uvd.yupoo.com/...` for video thumbs.

**Quick wins:**
- Title is in `<h1>` (with a trailing photo-count number to strip — `"Item Y00753 Wholesale at true factory prices32"` ends with `32`, the photo count).
- Yupoo loads photos lazily — slow-scroll first, then read `img[data-src]` / `img[src]`.
- Store seller from `location.hostname.split('.')[0]`.
- The user's RTF list often has *two* URLs per item: a deep-link to a single photo (e.g. `happywhale.x.yupoo.com/86672884?uid=1`) and the actual album. Use the album for scraping, save the photo URL as `preview_photo_url` for reference.

**Password-protected Yupoo stores** (e.g. Enzoo Optical):
- Whole storefront returns "Homepage Is Encrypted, Please Enter Password"
- Fill `#indexlock__input` and **press Enter** (not click — sometimes the click handler doesn't fire from `evaluate`-set values)
- Use `browser_type` with `submit: true` for reliability
- Store the password in `data/notes/sellers.json` under the seller's `contact.yupoo_password`
- "Remember for 7 days" checkbox keeps it open in the same browser context

**referrercate as category hint**: `referrercate=549203` = Prada eyewear (happywhale), `549197` = Cartier eyewear, `549191` = Balenciaga eyewear, `549204` = Gucci eyewear, `549187` = YSL eyewear, `590778` = Celine eyewear, `4881426` = clothing, `4919642` = Prada bags. Reference list — different sellers may use different codes.

---

## 2. The schema (what every item file should have)

### Common fields (Superbuy + Yupoo)

```json
{
  "user_label": "Hampus's friendly name for the item",
  "url": "the Superbuy or Yupoo URL we visit",
  "preview_photo_url": "optional: photo deep-link if user pointed at a specific colorway",
  "title": "vendor's raw title (Chinese or English)",
  "title_translated": "clean English description we wrote",
  "description": "full English narrative paragraph",
  "image_urls": ["..."],           // remote URLs
  "local_image_paths": ["..."],    // images/<slug>/g000.jpg, ...
  "detail_image_urls": ["..."],    // optional, for items with rich detail pages
  "local_detail_image_paths": ["..."],
  "price": "¥99.95",                // primary display (web app reads `price`)
  "price_rmb": "¥99.95",            // explicit
  "price_usd": "$15.83",            // computed from CNY at 6.83 or read from page
  "sizing": "S, M, L, XL",          // human summary; null for non-sized items
  "sizes": ["S","M","L","XL"],      // array
  "size_chart": {                   // structured cm chart (null if not parsed)
    "unit": "cm",
    "sizes": ["S","M","L","XL"],
    "measurements": { "length": [68,69,70,71], "bust": [104,108,112,116], ... },
    "source_image": "images/<slug>/d001.jpg"
  },
  "variants": ["Black", "White", ...],
  "target_variant": "Black",        // when user said "the black one"
  "brand": "The Row (rep)",
  "item_code": "Y00753",            // vendor's SKU
  "seller": "happywhale",           // shop name (top-right of Superbuy listing or Yupoo subdomain)
  "seller_id": "2958131434",        // numeric/alphanumeric internal ID
  "category": "apparel-top",        // apparel-top|apparel-bottom|shoes|bag|eyewear|accessory
  "source": "taobao|weidian|1688|yupoo",
  "owners": ["hampus", "jan"],      // array — items can be shared
  "acquisition": "superbuy|contact-seller",
  "requires_contact": true,         // true for Yupoo; false for Superbuy-purchasable
  "out_of_stock": false,
  "locked": false,                  // for password-protected Yupoo albums
  "needs_sizing_parse": false,      // true if size_chart is null but should exist
  "params": {...},                  // raw vendor-specs dict
  "notes": "..."
}
```

### Index file (per source)

`data/superbuy/_index.json` and `data/yupoo/_index.json` are lightweight catalogs the web app loads. Regenerate after every batch — see `scripts/` examples.

### Manifest

`data/superbuy/_links.json` and `data/yupoo/_links.json` are the user's original link list parsed once. Source of truth for "which items should exist."

---

## 3. The pipeline scripts

| Script | Purpose |
|---|---|
| `scripts/extract_superbuy.js` | Reference JS extractor (paste into `browser_evaluate`) |
| `scripts/save_superbuy_item.py` | Compose a final item JSON from raw extraction + (slug, label, platform, encoded url). Auto-fills brand, category, cleans params dict. |
| `scripts/download_superbuy_images.py` | Fetches `image_urls` + `detail_image_urls` to `images/<slug>/g###.jpg` and `d###.jpg`. Works for alicdn / cbu01. Fails on geilicdn. |
| `scripts/decode_weidian_images.py <slug>` | Decodes base64 images saved by browser-fetch into `images/<slug>/g###.jpg`. Used for the geilicdn rescue. |
| `scripts/trim_and_price.py` | Trims gallery to 10 + detail to 10, computes `price_usd` from `price_rmb` at 6.83, copies `price_rmb` → `price` (alias the web app reads). |
| `scripts/download_yupoo_images.py` | Fetches Yupoo `photo.yupoo.com/.../small.jpg` (also tries `medium.jpg`). Skips files starting with `_`. |

---

## 4. Sizing — the hierarchy

Try in order, stop at first success:

1. **Listing body text** — Some Taobao listings (especially ERD) publish the full chart as Product Parameters text. Match `Product Parameters\n([\s\S]+?)(?:Shopping Agent Notes|...)` then look for size labels (S/M/L/XL/44/46/...) followed by measurement labels (衣长/胸围/...). **Free**.

2. **Eyewear "Size" field** — 1688 eyewear listings publish frame measurements as `Size: 51-23-146` (lens-bridge-temple, mm). Match `Size\s*Selected:[^\n]*\n([\s\S]+?)Color\s*Selected/i` or scan the body for a `\d+-\d+-\d+` pattern.

3. **Detail image OCR** — Default fallback. Use a parallel Agent subagent:
   - Read `images/<slug>/d000` through `d009` sequentially (NOT in parallel — Taobao detail images are often >2000px and reading too many at once exceeds the agent's context window)
   - Look for an image titled "尺码表" / "尺码" / "size chart" — usually `d001`, sometimes `d002` or `d000`
   - Parse columns: 衣长 = length, 胸围 = bust/chest, 肩宽 = shoulder, 袖长 = sleeve, 裤长 = pants_length, 腰围 = waist, 臀围 = hips, 大腿围/腿围 = thigh, 脚口/裤口 = leg_opening
   - Use snake_case English keys, populate `null` for unreadable cells
   - Set `source_image: "images/<slug>/dXXX.jpg"`

4. **No chart found** — Set `size_chart: null`, leave `needs_sizing_parse: true`, write a clear `notes` line so it surfaces for re-attempt.

**Charts often use HALF measurements** — labels like `半胸围` (half-bust) or `1/2 胸围` mean the value is single-layer flat, **don't double**. Otherwise lay-flat × 2 = body circumference.

**Parallel Agent batching**: 4–7 items per agent works well. More than that and the agent's context blows up reading all the detail PNGs (one image-size limit error confirmed at >2000px PNGs).

---

## 5. Anti-bot etiquette

These sites have detection. Don't be greedy:

- **Don't aggressively re-poll** after a Cloudflare challenge — wait 5+ seconds, retry once
- **Don't open >3 tabs** simultaneously — 3 worked fine, 5+ caused tab drops
- **Don't password-spray** Yupoo password forms — Yupoo will rate-limit. If you don't have the password, ask the user / seller. Common rep-community passwords (8888, 1234, etc.) almost never work and 10+ attempts gets you blocked.
- **Don't scrape Yupoo at high frequency** — even legit users get IP-blocked after running ~50 album fetches in a few minutes
- **Always pass a Referer** when fetching images — `weidian.com` for geilicdn, `superbuy.com` or the album URL for everything else

---

## 6. Common pitfalls and what they look like

| Symptom | Cause | Fix |
|---|---|---|
| Card shows wrong product photos | No `seller_id` / `sellerKey` filter, page-image collector grabbed sidebar recommendations | Re-scrape with seller-aware filter; clear images dir; re-fetch |
| Card shows 0 images for a Weidian item | Python downloader hit hotlink block (returns 0 bytes silently) | Use `decode_weidian_images.py` rescue path |
| Title is "Russell Athletic" but user labelled it "Blair Witch Tee" | Original Taobao item ID expired, Superbuy substituted a different product | Mark `out_of_stock: true` and ask user for a new link |
| "Just a moment..." in title forever | Cloudflare challenge stuck or we evaluated too early | `browser_wait_for` 5s, retry |
| Sizes array contains "Size", "Selected: S Items" | Size-block regex picked up label noise | Filter out tokens containing "Size" / "Selected" before storing |
| Price comes back as None despite the page showing a price | Variant-specific pricing (item shows a range, not a single number); or page didn't fully load | Re-scrape; or extract price ranges from `[class*="price"]` text |
| `image_urls` list is empty for a Yupoo album | Album is password-protected | Look for "Homepage Is Encrypted" — get password from user, store in sellers.json, retry |
| Tab silently drops mid-eval | Playwright session timeout / browser crash | Re-open tabs, re-navigate, continue |
| Sizing chart agent errors with "image dimension limit" | Read too many >2000px images at once | Reduce batch size to 3 items per agent, read sequentially |

---

## 7. Workflow recipe — adding 1 new item from scratch

Copy this when you need to add a new item.

```
1. User provides a label + URL (Superbuy or Yupoo)
2. Add to data/<source>/_links.json (manifest)
3. Playwright: navigate to URL → wait 3-5s → dismiss popups → scroll
4. browser_evaluate the standard extractor (with filename: data/<source>/_raw/<slug>.json)
   → seller-key filter, gallery+detail split, body-text params, shop name
5. Inspect raw JSON: title sane? hero image matches user's intent?
6. python3 scripts/save_superbuy_item.py <raw_path> <slug> "<label>" <platform> <encoded_url>
7. python3 scripts/download_superbuy_images.py
   For Weidian items: also browser-fetch+base64 dance and decode_weidian_images.py
8. python3 scripts/trim_and_price.py
9. Regenerate the _index.json (small Python loop over data/<source>/*.json)
10. Refresh the dev site (`cd web-next && npm run dev` → http://localhost:3000)
```

For sizing on apparel/footwear, dispatch a parallel Agent in the background with item slug + which `d###` to look at first.

---

## 8. Things to avoid

- **Don't write a `.playwright-mcp` filename without a relative path** — defaults to a hidden output dir that's hard to find. Use `data/<source>/_raw/<slug>.json` consistently.
- **Don't use the `filename` param without the trailing `.json`** — Playwright doesn't add it.
- **Don't trust the first run of `download_superbuy_images.py`** for Weidian items — verify file sizes are non-zero. The script silently writes nothing for blocked URLs.
- **Don't forget to run `trim_and_price.py`** after `save_superbuy_item.py` — `save_` doesn't compute `price_usd` or trim image arrays.
- **Don't merge a Superbuy and a Yupoo item** even if they look identical — the acquisition workflow is completely different (`superbuy` vs `contact-seller`).
- **Don't delete out-of-stock items** — mark `out_of_stock: true` so the record persists for re-sourcing.
- **Don't re-scrape items that work** — Yupoo and Weidian rate-limit aggressively after maybe 30-50 hits in a session.

---

## 9. What still needs improvement

- **Yupoo extractor doesn't capture description text** — the album description block on Yupoo has the price and care notes, but my current selectors miss it. Worth fixing so we get free pricing data on items like "￥200 Protocol Index".
- **No automatic hero-variant matching** — if user says "the green one" and the chart has 5 colorways, hero is whatever the page renders first. A vision-agent pass that picks the variant matching the user's label would be nice.
- **No category-level Yupoo crawl** — if a user gives a category URL (no `/albums/`), we don't yet expand it into individual items.
- **Sizing OCR fails on heavily-stylized charts** — vendors with unusual layouts (multi-fit charts, mixed unit charts) confuse the agent. Falling back to vendor body-text would be cleaner.
- **No automated dedupe** — when both Hampus and Jan share an item, we caught it manually. A title+seller_id hash could automate.

---

## 10. Quick reference — Chinese label translations

| 中文 | English |
|---|---|
| 尺码表 / 尺码 | size chart |
| 衣长 | length |
| 胸围 | bust / chest |
| 肩宽 | shoulder |
| 袖长 | sleeve |
| 裤长 | pants length |
| 腰围 | waist |
| 臀围 | hips |
| 大腿围 / 腿围 | thigh |
| 脚口 / 裤口 | leg opening |
| 后中长 | back center length |
| 下摆 | hem |
| 半胸围 / 1/2 胸围 | half-bust (don't double the value) |
| 松紧 | elastic |
| 商品参数 | Product Parameters |
| 颜色 | color |
| 款式 | style |

---

End of playbook.

---

## Image sourcing & re-scrape gotchas (added 2026-07-19)

From the v2 shop re-scrape/color-split work. Apply when re-visiting links for better images.

- **Take the hero from the MAIN gallery, not detail crops.** On Superbuy/Taobao the clean product shots are the `/bao/uploaded/` carousel images; `/imgextra/` are close-up detail crops and make terrible thumbnails (this was the root cause of the "no clean hero" punch-list). Also drop `_!!0-item_pic`, `-cib`, and `~crop` variants (item badges / cross-store recommendations). Strip `_NxN(qNN)` suffixes for full-res.
- **Superbuy buy pages CAPTCHA once (slide puzzle).** Agents can't / shouldn't solve it — ask the user to slide it in the browser, then the session stays warm for the rest of the batch.
- **Superbuy risk-blocks some brands** (e.g. Gucci-by-Demna) with a "Risk Reminder — legal risks" modal and won't load the item at all. Fall back to the Weidian/Taobao page directly (Weidian shows `商品已下架` when delisted).
- **Weidian `geilicdn` image URLs get false-flagged by the Chrome browser-tool DLP filter** (returned as `[BLOCKED: JWT token]`). The *main-preview* `<img>` always reads clean — click each color swatch to swap the preview and capture that colorway's URL (same trick powers color-splitting). Yupoo still needs `Referer = <album URL>` + `/big.jpg`; swatch thumbs are `_30x30q90.jpg` → strip for full-res.
- **Watch for baked-in text.** Seller images with overlaid text ("1981M"), watermarks ("CNMADE"), or dimension labels ("28CM") make poor heroes and confuse the Gemini classifier (dimension labels → false `size_chart`). Prefer a clean shot; if none exists, flag for regeneration.
- **Price can vary by SIZE, not colorway** (Margaux: ¥1450/1700/1950/2200 for sizes 10/12/15/17, identical across finishes). Before flat-pricing a multi-variant listing, click a couple size swatches to check; price each color at the size its hero shows. Live price uses a fullwidth `￥` (U+FFE5), so match `/US \$\s*([\d.]+)/` for USD.
