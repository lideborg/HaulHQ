# HaulHQ v2 — Scrape-Import Pipeline & Bulk Catalog Import · Design Spec

Date: 2026-07-17 · Status: approved in brainstorm, pending user review of this doc
Branch: `feat/v2-groupbuy` · Supabase project: `pqfiwdscftwhmcutspay`

## Purpose

Two importers that fill the friend shop with complete products:

1. **Bulk import** — one-time local script migrating the ~240 v1 favorites
   (`data/favorites/*.json`) into the `products` table, images into Supabase
   storage.
2. **Scrape-import pipeline** — for new links (pasted by Hampus or requested by
   friends): admin-triggered scrape that produces a complete product — all
   sizes, all images, structured size guide.

"Complete product" means: title, brand, seller, USD price (cost × 1.20), ALL
size options (or `["One Size"]`), colors when the listing has colorways, every
product image re-hosted in Supabase storage, and a structured `size_guide`
rendered as a text table (never an image) on the product page.

## Decisions made (with rationale)

- **Model A — admin-run enrichment.** Friend-pasted links create a bare
  `requested` item + a notification to Hampus. Hampus triggers the scrape from
  his machine (Chrome MCP session, logged into Superbuy). No server-side
  auto-scrape: Superbuy/Taobao/Yupoo are JS-rendered, auth-gated, and 403
  plain fetches — a "live" scrape would be flaky theater.
- **Import default = visible.** Everything imported is `published = true`
  (friends can browse all of it). Unpublishing is the exception, not the rule.
- **Model 1 — one catalog + visibility flag.** No separate personal catalog.
  Hampus's private HQ = the admin view over the same rows (plus, later, his
  personal Superbuy haul tracking). "For me only" = `published = false`.
- **Admin auth = env password.** `/admin` asks for `ADMIN_PASSWORD` (env var),
  sets an httpOnly cookie. No Supabase Auth, no Clerk.
- **No personal sizing recommendation UI.** Hampus asks Claude when buying.
  v1 `sizing` notes are preserved to `admin_sizing_note` (admin-only
  reference), but nothing user-facing is built on them.
- **Size guide = text table with cm ⇄ inch toggle.** Friends read measurements
  and pick their own size. Per-friend recommendations (friend measurements →
  tailored pick) are a later feature; `friends.measurements` exists so no
  migration is needed then.
- **No `weight_g`.** Item weight is only known after Superbuy's warehouse
  weighs it — it belongs to parcel tracking (future), not the product.

## Schema changes (migration `0003`)

```sql
alter table products add column if not exists size_guide jsonb;
alter table products add column if not exists admin_sizing_note text;
alter table products add column if not exists source_platform text; -- yupoo|weidian|taobao|superbuy|1688
alter table products add column if not exists colors text[] not null default '{}';
alter table items    add column if not exists color text;
alter table friends  add column if not exists measurements jsonb;
create unique index if not exists products_source_link_key
  on products(source_link) where source_link is not null;
```

`size_guide` shape (mirrors v1 `size_chart`, minus the image):

```json
{
  "unit": "cm",
  "note": "bust = full circumference; 1-3cm tolerance",
  "sizes": ["M", "L", "XL"],
  "measurements": { "length": [48,50,52], "chest": [100,104,108], "shoulder": [43,45,47] }
}
```

Storage: public bucket **`product-images`**; object path `products/<product-id>/<n>.jpg`.
All product images are re-hosted here — Yupoo/Weidian CDNs are hotlink-protected
and their URLs rot; alicdn happens to allow hotlinking today but is migrated
anyway for consistency.

## Component 1 — Bulk import script

`scripts/import-favorites.mjs` (Node, run locally; uses service-role key from
`web-v2/.env.local`). No live scraping — everything comes from the JSON + local
image files already on disk.

Per favorite file:

- **Map fields:** `title` ← title, `brand` ← brand (normalized: strip "(rep)"),
  `description` ← first sentence of notes (cleaned), `seller` ← seller,
  `source_link` ← source_url/yupoo_url/url (first non-null),
  `source_platform` ← source, `category` ← category.
- **Price:** parse first ¥ amount from `price` → `cost_cny`;
  `price_usd = round(cost_cny × FX_CNY_USD × 1.20, 2)`. Unparseable price →
  `price_usd = null` (renders "Quote on request").
- **Sizes:** `size_chart.sizes` if present, else sizes parsed from
  `target_size`/`sizing`, else `["One Size"]` (bags, belts, eyewear).
- **Size guide:** `size_chart` → `size_guide` (drop `source_image`).
- **Sizing note:** `sizing` → `admin_sizing_note`.
- **Images:** upload each `local_image_paths` file (skip `size-chart` images)
  from `data/<source-dir>/images/...` to `product-images/products/<id>/`;
  store public URLs in `image_urls`, original order (first = hero).
- **Publish:** `published = true`.
- **Idempotency:** upsert keyed on `source_link` (unique index added in the
  migration); re-running updates instead of duplicating.
- **Report:** per-file OK/skip/error summary printed at the end; items already
  purchased/shipped in v1 import the same as favorites (they're still
  sellable listings — status of Hampus's own copy is irrelevant to the shop).

## Component 2 — Scrape-import pipeline (admin-triggered)

Flow: link → (friend request OR Hampus direct) → scrape → review → live.

1. **Intake.** Friend pastes link on `/request` (creates `items` row,
   status `requested`, plus `notifications` row → email ping). Hampus can also
   paste a link directly in the admin ("Import product").
2. **Scrape (Claude-driven, in Hampus's session).** The existing proven
   procedure, now standardized: open link in Chrome MCP (resolves short links,
   Superbuy wrappers) → extract title, price, seller id → read the size
   selector → ALL size buttons (`["One Size"]` when absent) → read color
   selector when present → full-scroll, collect every `img` src filtered to
   the seller id, strip size suffixes for full-res → locate size-chart detail
   image, read measurements into `size_guide` JSON → download images →
   upload to `product-images` → upsert `products` row (published, cost,
   markup, price_usd).
3. **Link-back.** If the scrape originated from a friend request, set the
   item's `product_id`, fill `quoted_price_usd`, keep status `requested`
   until Hampus confirms the order.
4. **Review.** Hampus checks title/price/images in admin (rename if the
   source title is junk), adjusts, done. Publish is already true; he flips it
   off only for private items.

The scrape procedure lives as a project skill (`.claude/skills/import-product`)
superseding `add-haul-item`'s write-to-JSON step with write-to-Supabase.
`add-haul-item` remains for v1-style personal favorites until v2 fully
replaces it.

## Component 3 — Size-guide UI (friend product page)

- Renders `size_guide` as a table: measurement rows (length / chest /
  shoulder / …), size columns. Labels title-cased from the JSON keys.
- **cm ⇄ in toggle** (client-side): inches = cm ÷ 2.54, one decimal.
  Default cm.
- `note` renders as small print under the table.
- Products without `size_guide`: no table. Products with one size: size
  picker shows a single "One Size" button.

## Component 4 — Admin gate

- `/admin` → password form → compares to `ADMIN_PASSWORD` env var → sets
  httpOnly cookie (1 year) → all `/admin/*` routes check the cookie in
  middleware. Wrong password: generic error. No rate limiting (single-user,
  low value target) — revisit if the domain becomes public.

## Error handling

- Bulk import: per-item try/catch; one bad favorite never aborts the run;
  errors listed in the final report with file names.
- Image upload failures: retry once, then record the item with remote URLs as
  fallback and flag it in the report (shop still works; re-run to heal).
- Scrape: if sizes/chart can't be found, product is created with
  `["One Size"]` + no guide and flagged for manual fix in admin.

## Testing

- Bulk import: dry-run mode (`--dry`) printing the mapped rows for the first
  N files without writing; then run on 3 known favorites (one multi-size with
  chart, one One-Size accessory, one unparseable price) and verify in shop.
- Size-guide UI: render the 3 seeded ERD products (cardigan has a real chart);
  verify cm/inch toggle math.
- Scrape pipeline: run end-to-end on one fresh Superbuy link and one Yupoo
  album; verify sizes, colors, storage-hosted images, size guide.

## Out of scope (explicit)

- Per-friend sizing recommendations (schema ready, no UI).
- Server-side/automatic scraping.
- Parcel weight tracking, shipping-cost math.
- Flatlay image generation (phase 2 backlog).
