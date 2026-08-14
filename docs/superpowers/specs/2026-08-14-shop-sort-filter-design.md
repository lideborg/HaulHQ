# Shop Sort & Filter Control — Design

**Goal:** Give friends a compact sort + filter control on the v2 shop — sort the grid (price, newest, brand, popularity) and filter by a normalized color family and a price range — in the "All" view and inside any brand/category.

**Architecture:** One settings popover behind a small grid icon in the results header. All state is URL-driven (like the existing `SearchBox` / `SoldOutToggle`), so it composes with the current `?brand`/`?category`/`?q`/`?all` params, is shareable, and survives refresh. Two data additions back it: a normalized `color` column (backfilled from the `— Colour` suffix already in every `display_title`) and a product-popularity count (from the `items` table).

**Tech stack:** Next.js 16 App Router (server component page + client control), Supabase (`createAdminClient`), Tailwind.

## Global Constraints

- No em dashes in any code comment / commit / doc written for Hampus (product TITLES may keep them).
- Friend-facing copy says "admin", never "Hampus".
- `main` is checked out in another worktree; branch off `origin/main`. Build this on its own branch `feat/shop-sort-filter`.
- `web-v2/` runs against the PRODUCTION Supabase DB (`pqfiwdscftwhmcutspay`) locally — the `color` backfill touches live rows.
- Keep `web-v2/src/lib/categories.ts` as the source-of-truth pattern; mirror it for colors.

---

## 1. Placement & trigger

A small **grid/settings icon** at the far-left of the results header row (`shop/page.tsx`, the flex row currently holding the item-count label + `SearchBox`), positioned **before** the "CATEGORY · N ITEMS" label. Clicking it toggles a **popover panel** anchored under the icon. The control renders on every shop view (All, brand, category) and only refines the current result set — it does not change the active brand/category.

## 2. Panel contents (three sections, top → bottom)

**SORT** (single-select, radio behavior):
- Price: Low → High  (`sort=price-asc`)
- Price: High → Low  (`sort=price-desc`)
- Recently added  (`sort=new`, DEFAULT — current `created_at desc` behavior)
- Brand: A → Z  (`sort=brand`)
- Most popular  (`sort=popular`, by haul-add count)

**COLOR** (single-select filter, rendered as little **selectable colored squares** + text label on hover/aria):
- 12 families, ordered by catalog volume, plus an "All" square to clear:
  `Black, White & Cream, Grey, Blue, Brown, Beige & Tan, Green, Red & Burgundy, Yellow & Gold, Purple, Pink, Multi / Print`
- URL: `color=<family-slug>` (e.g. `color=black`); absent/`all` = no filter.
- Squares lay out ~6 per row (2 rows), compact — NOT a text list.
- Selected square shows a ring/outline. "Multi / Print" square is a small checker/gradient; "All" is an outlined empty square.

**── divider ──**

**PRICE RANGE** (two small number inputs, min–max):
- URL: `min=<usd>&max=<usd>`. Empty = unbounded. Placeholder shows the catalog bounds (~$0–$670).
- Applies on blur / Enter.

A small **Reset** link clears `sort`/`color`/`min`/`max` (keeps brand/category/q).

## 3. Data model additions

### 3a. `color` column (normalized family)
- `alter table products add column color text;` (nullable).
- Backfill: parse the text after the last `— ` in `display_title`, normalize to one of the 12 family slugs via a keyword map (see below). Rows with no `— ` or unmatched → `color = 'multi'` (safe bucket) — but log the unmatched set so Hampus can eyeball.
- **Source of truth:** a new `web-v2/src/lib/colors.ts` exporting `COLOR_FAMILIES` (slug, label, swatch hex/style, order) and `normalizeColor(raw: string): ColorSlug`. Both the backfill script and the import pipeline import `normalizeColor` so new products get `color` set automatically.
- Add `normalizeColor` into the import-product flow (the raw-insert path sets `color = normalizeColor(display_title suffix)`), mirroring the `display_title` rule.

Normalization keyword map (raw substring, case-insensitive → family):
| family (slug) | matches |
|---|---|
| `black` | black, ebony, jet |
| `white` (White & Cream) | white, cream, ivory, off-white, oatmeal, ecru, milky |
| `grey` | grey, gray, charcoal, heather, slate, cement, cloud, elephant |
| `blue` | blue, navy, indigo, denim, sky, aqua, haze, dusty, smoky, ink, royal, cobalt |
| `brown` | brown, coffee, mocha, cognac, taupe, camel, caramel, chocolate, tortoise |
| `beige` (Beige & Tan) | beige, tan, khaki, sand, apricot, natural, oat, nude |
| `green` | green, olive, army, forest, sage, matcha, moss |
| `red` (Red & Burgundy) | red, burgundy, wine, maroon, crimson |
| `yellow` (Yellow & Gold) | yellow, gold, mustard, amber |
| `purple` | purple, violet, lilac |
| `pink` | pink, rose, blush |
| `multi` (Multi / Print) | multi, camo, camouflage, flag, print, plaid, check, `/`, `&`, clear, silver |

Precedence: test families in the order above BUT match the FIRST word of the raw color first (e.g. "Black/White" → `black` only if we decide two-tone counts as its base; simpler: any `/` or `&` → `multi`). Decision: **two-tone/slashed strings → `multi`**; otherwise first keyword hit wins in table order.

### 3b. Popularity
- Add a Postgres view `product_popularity as select product_id, count(*) as adds from items group by product_id;`
- `getPublishedProducts` left-joins/reads it only when `sort=popular`, ordering by `adds desc nulls last, created_at desc`. (Simplest correct impl: fetch the popularity map once, sort the returned rows in-app when `sort=popular` — the result set is already filtered and small. Either is acceptable; prefer the view + in-app sort to avoid a fragile supabase-js aggregate join.)

## 4. Data flow

`shop/page.tsx` reads new params (`sort`, `color`, `min`, `max`) → passes to `getPublishedProducts(brand, category, q, inStockOnly, { sort, color, min, max })`:
- `color` → `.eq("color", color)`
- `min`/`max` → `.gte/.lte("price_usd", n)` (null-priced items excluded when a bound is set)
- `sort` → switch the `.order(...)`; `popular` uses the popularity map.
Default (no `sort`) stays `created_at desc`.

The popover is a new client component `ShopSortFilter` (sibling of `ShopControls`), taking the current params + `handle`, writing them back via `router.replace` with merged query string (reuse the query-merge pattern already in `ShopControls`).

## 5. Components / files

- Create `web-v2/src/lib/colors.ts` — `COLOR_FAMILIES`, `normalizeColor`, `ColorSlug`.
- Create `web-v2/src/components/ShopSortFilter.tsx` — icon button + popover (Sort radios, Color squares, Price range, Reset).
- Modify `web-v2/src/lib/data.ts` — extend `getPublishedProducts` signature + query; add popularity read.
- Modify `web-v2/src/app/[handle]/shop/page.tsx` — parse new params, render `<ShopSortFilter/>` in the header row.
- Create `web-v2/scripts/backfill-colors.mjs` — one-time normalize + set `color`; prints the unmatched-color report.
- Migration: `alter table products add column color text;` + `create view product_popularity ...`.
- Modify import skill / raw-insert path to set `color` on new products.

## 6. Error handling / edge cases

- Null `price_usd` ("quote on request"): excluded when a price bound is set; sort-by-price puts them last.
- Empty result after filtering: existing "No catalog matches" empty state covers it; Reset is one tap away.
- Unmatched colors backfill to `multi` (never crash); report lists them for manual cleanup.
- `sort=popular` with zero adds → falls back to newest order (nulls last).

## 7. Testing

- Unit: `normalizeColor` table-driven (messy string → family): "Washed Black"→black, "Heather Grey"→grey, "Black/White"→multi, "Vintage White"→white, "Olive Green"→green, "Cognac"→brown, unknown→multi.
- Unit/integration: `getPublishedProducts` honors each `sort`, `color`, and price bound.
- Manual (browser, Playwright per repro rule): open popover on All + inside a brand; pick a color square, a sort, a price range; confirm grid updates + URL reflects it + refresh persists + Reset clears.

## 8. Out of scope (YAGNI)

- Multi-select colors (single-select to start).
- The tonal "sort by color" wall (rejected in favor of the SSENSE-style color filter).
- Saving a friend's default sort/filter preference.
- Filtering by category/brand inside this panel (that stays in the sidebar).
