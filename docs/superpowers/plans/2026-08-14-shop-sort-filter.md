# Shop Sort & Filter Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a grid-icon popover to the v2 shop that sorts the product grid (price / newest / brand / popularity) and filters by a normalized color-family (selectable squares) and a price range.

**Architecture:** URL-driven, mirroring the existing `ShopControls` (`shopHref` + `URLSearchParams` + `<Link>`). A new `colors.ts` is the source of truth for color families + a `normalizeColor` pure function (TDD). A one-time script backfills a new `products.color` column; a `product_popularity` view powers the "Most popular" sort. `getPublishedProducts` gains a sort/color/price options bag. A `ShopSortFilter` client component renders the popover.

**Tech Stack:** Next.js 16 App Router, Supabase (`createAdminClient`, service role), Tailwind, Node built-in test runner (`node --test`).

## Global Constraints

- No em dashes in code comments, commits, or docs written for Hampus (product TITLES may keep them).
- Friend-facing copy says "admin", never "Hampus".
- Branch off `origin/main` as `feat/shop-sort-filter` (main is checked out in another worktree).
- `web-v2/` runs against the PRODUCTION Supabase DB (`pqfiwdscftwhmcutspay`) locally — the backfill + migration touch live rows/schema.
- Tests run via `npm test` (`node --test "src/lib/**/*.test.*"`). Test files: `src/lib/*.test.ts`, import with explicit `.ts` extension, use `node:test` + `node:assert/strict`.
- Source-of-truth pattern for enumerable UI data mirrors `src/lib/categories.ts`.
- Default sort stays `created_at desc` (today's behavior) when no `sort` param is present.

---

### Task 1: Color families + `normalizeColor` (source of truth, TDD)

**Files:**
- Create: `web-v2/src/lib/colors.ts`
- Test: `web-v2/src/lib/colors.test.ts`

**Interfaces:**
- Produces:
  - `type ColorSlug = "black"|"white"|"grey"|"blue"|"brown"|"beige"|"green"|"red"|"yellow"|"purple"|"pink"|"multi"`
  - `COLOR_FAMILIES: readonly { slug: ColorSlug; label: string; swatch: string; order: number }[]` (volume order)
  - `normalizeColor(raw: string): ColorSlug`
  - `COLOR_LABEL: Record<string,string>`

- [ ] **Step 1: Write the failing test**

Create `web-v2/src/lib/colors.test.ts`:
```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeColor, COLOR_FAMILIES } from "./colors.ts";

test("maps common exact colors to their family", () => {
  assert.equal(normalizeColor("Black"), "black");
  assert.equal(normalizeColor("White"), "white");
  assert.equal(normalizeColor("Grey"), "grey");
  assert.equal(normalizeColor("Blue"), "blue");
  assert.equal(normalizeColor("Brown"), "brown");
  assert.equal(normalizeColor("Beige"), "beige");
});

test("rolls messy variants into the right family", () => {
  assert.equal(normalizeColor("Washed Black"), "black");
  assert.equal(normalizeColor("Heather Grey"), "grey");
  assert.equal(normalizeColor("Vintage White"), "white");
  assert.equal(normalizeColor("Faded Blue"), "blue");
  assert.equal(normalizeColor("Navy"), "blue");
  assert.equal(normalizeColor("Cognac"), "brown");
  assert.equal(normalizeColor("Khaki"), "beige");
  assert.equal(normalizeColor("Olive Green"), "green");
  assert.equal(normalizeColor("Burgundy"), "red");
  assert.equal(normalizeColor("Mud Red"), "red");
});

test("two-tone / slashed / patterned strings become multi", () => {
  assert.equal(normalizeColor("Black/White"), "multi");
  assert.equal(normalizeColor("Black & White"), "multi");
  assert.equal(normalizeColor("Camo"), "multi");
  assert.equal(normalizeColor("Grey Multi"), "multi");
});

test("empty / unknown falls back to multi and never throws", () => {
  assert.equal(normalizeColor(""), "multi");
  assert.equal(normalizeColor("Qianxing"), "multi");
  // @ts-expect-error runtime guard for non-strings
  assert.equal(normalizeColor(undefined), "multi");
});

test("COLOR_FAMILIES has 12 unique slugs in volume order", () => {
  const slugs = COLOR_FAMILIES.map((f) => f.slug);
  assert.equal(slugs.length, 12);
  assert.equal(new Set(slugs).size, 12);
  assert.equal(slugs[0], "black"); // most common
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd web-v2 && npm test`
Expected: FAIL — `Cannot find module './colors.ts'`.

- [ ] **Step 3: Write the minimal implementation**

Create `web-v2/src/lib/colors.ts`:
```ts
// Single source of truth for shop color-family filtering.
// products.color stores the SLUG; the shop filter renders the swatch + label.
// normalizeColor() folds the free-text colour (from display_title "— Colour")
// into one of 12 families. Mirrors the categories.ts pattern.
export const COLOR_FAMILIES = [
  { slug: "black", label: "Black", swatch: "#111111", order: 0 },
  { slug: "white", label: "White & Cream", swatch: "#efe9dc", order: 1 },
  { slug: "grey", label: "Grey", swatch: "#8c8c8c", order: 2 },
  { slug: "blue", label: "Blue", swatch: "#3a5a95", order: 3 },
  { slug: "brown", label: "Brown", swatch: "#6b4a2f", order: 4 },
  { slug: "beige", label: "Beige & Tan", swatch: "#cbb891", order: 5 },
  { slug: "green", label: "Green", swatch: "#4b6b3f", order: 6 },
  { slug: "red", label: "Red & Burgundy", swatch: "#7c2430", order: 7 },
  { slug: "yellow", label: "Yellow & Gold", swatch: "#c9a227", order: 8 },
  { slug: "purple", label: "Purple", swatch: "#6a4a8a", order: 9 },
  { slug: "pink", label: "Pink", swatch: "#d99fb0", order: 10 },
  { slug: "multi", label: "Multi / Print", swatch: "conic", order: 11 },
] as const;

export type ColorSlug = (typeof COLOR_FAMILIES)[number]["slug"];

export const COLOR_SLUGS: readonly string[] = COLOR_FAMILIES.map((f) => f.slug);
export const COLOR_LABEL: Record<string, string> = Object.fromEntries(
  COLOR_FAMILIES.map((f) => [f.slug, f.label]),
);

// Ordered keyword table. First family whose keyword appears in the (lowercased)
// string wins. Two-tone / slashed / patterned strings short-circuit to "multi".
const FAMILY_KEYWORDS: [Exclude<ColorSlug, "multi">, string[]][] = [
  ["black", ["black", "ebony", "jet"]],
  ["white", ["white", "cream", "ivory", "oatmeal", "ecru", "milky"]],
  ["grey", ["grey", "gray", "charcoal", "heather", "slate", "cement", "cloud", "elephant"]],
  ["blue", ["blue", "navy", "indigo", "denim", "sky", "aqua", "haze", "dusty", "smoky", "ink", "royal", "cobalt"]],
  ["brown", ["brown", "coffee", "mocha", "cognac", "taupe", "camel", "caramel", "chocolate", "tortoise"]],
  ["beige", ["beige", "tan", "khaki", "sand", "apricot", "natural", "oat", "nude"]],
  ["green", ["green", "olive", "army", "forest", "sage", "matcha", "moss"]],
  ["red", ["red", "burgundy", "wine", "maroon", "crimson"]],
  ["yellow", ["yellow", "gold", "mustard", "amber"]],
  ["purple", ["purple", "violet", "lilac"]],
  ["pink", ["pink", "rose", "blush"]],
];

const MULTI_WORDS = ["multi", "camo", "camouflage", "flag", "print", "plaid", "check", "clear", "silver"];

export function normalizeColor(raw: string): ColorSlug {
  const s = typeof raw === "string" ? raw.toLowerCase().trim() : "";
  if (!s) return "multi";
  if (s.includes("/") || s.includes("&") || s.includes(" and ")) return "multi";
  if (MULTI_WORDS.some((w) => s.includes(w))) return "multi";
  for (const [slug, kws] of FAMILY_KEYWORDS) {
    if (kws.some((k) => s.includes(k))) return slug;
  }
  return "multi";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd web-v2 && npm test`
Expected: PASS (all `colors.test.ts` tests green).

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/lib/colors.ts web-v2/src/lib/colors.test.ts
git commit -m "feat(v2): color-family source of truth + normalizeColor"
```

---

### Task 2: `color` column migration + backfill script

**Files:**
- Create: `web-v2/scripts/backfill-colors.mjs`
- Modify (DB): add column via Supabase MCP `apply_migration`.

**Interfaces:**
- Consumes: `normalizeColor` from Task 1.
- Produces: every `published` product row has a non-null `color` slug; new column `products.color text`.

- [ ] **Step 1: Add the column (migration)**

Apply via Supabase MCP (`apply_migration`, name `add_products_color`):
```sql
alter table public.products add column if not exists color text;
```

- [ ] **Step 2: Write the backfill script**

Create `web-v2/scripts/backfill-colors.mjs` (mirrors the env-loading of existing scripts — reads `.env.local` `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`):
```js
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { normalizeColor } from "../src/lib/colors.ts";

// minimal .env.local loader (same as sibling scripts)
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, "")]),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data, error } = await sb.from("products").select("id, display_title");
if (error) throw error;

const unmatched = new Map();
let n = 0;
for (const p of data) {
  const raw = (p.display_title || "").split("— ").pop()?.trim() ?? "";
  const color = normalizeColor(raw);
  if (color === "multi" && raw && !/multi|camo|\/|&/i.test(raw)) {
    unmatched.set(raw, (unmatched.get(raw) || 0) + 1); // report colours that fell through
  }
  const { error: e } = await sb.from("products").update({ color }).eq("id", p.id);
  if (e) throw e;
  n++;
}
console.log(`backfilled color on ${n} products`);
console.log("fell through to multi (eyeball these):");
for (const [c, cnt] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${cnt}x ${c}`);
```

- [ ] **Step 3: Run the backfill**

Run: `cd web-v2 && node scripts/backfill-colors.mjs`
Expected: `backfilled color on <N> products` then a short "fell through" list. Spot-check with SQL: `select color, count(*) from products where published group by color order by 2 desc;` — Black should be the largest bucket (~355), all 12 slugs present, no NULLs among published rows.

- [ ] **Step 4: Commit**

```bash
git add web-v2/scripts/backfill-colors.mjs
git commit -m "feat(v2): add products.color + backfill from display_title"
```

---

### Task 3: `product_popularity` view + `getPublishedProducts` options

**Files:**
- Modify (DB): create view via Supabase MCP `apply_migration`.
- Modify: `web-v2/src/lib/data.ts` (`getPublishedProducts`, lines ~23-45).

**Interfaces:**
- Consumes: `ColorSlug` from Task 1.
- Produces: new signature
  `getPublishedProducts(brand?, category?, search?, inStockOnly=false, opts?: { sort?: string; color?: string; min?: number; max?: number }): Promise<Product[]>`

- [ ] **Step 1: Create the popularity view (migration)**

Apply via Supabase MCP (`apply_migration`, name `product_popularity_view`):
```sql
create or replace view public.product_popularity as
  select product_id, count(*)::int as adds from public.items group by product_id;
```

- [ ] **Step 2: Extend `getPublishedProducts`**

In `web-v2/src/lib/data.ts`, replace the current `getPublishedProducts` body with:
```ts
export async function getPublishedProducts(
  brand?: string,
  category?: string,
  search?: string,
  inStockOnly = false,
  opts: { sort?: string; color?: string; min?: number; max?: number } = {},
): Promise<Product[]> {
  const sb = createAdminClient();
  let q = sb.from("products").select("*").eq("published", true);
  if (brand) q = q.eq("brand", brand);
  if (category) q = q.eq("category", category);
  if (opts.color) q = q.eq("color", opts.color);
  const term = searchTerm(search);
  if (term)
    q = q.or(`title.ilike.%${term}%,brand.ilike.%${term}%,display_title.ilike.%${term}%`);
  if (inStockOnly) q = q.eq("sold_out", false);
  if (typeof opts.min === "number") q = q.gte("price_usd", opts.min);
  if (typeof opts.max === "number") q = q.lte("price_usd", opts.max);

  // Non-popular sorts map straight to an ORDER BY; popular needs the add-counts.
  if (opts.sort === "price-asc") q = q.order("price_usd", { ascending: true, nullsFirst: false });
  else if (opts.sort === "price-desc") q = q.order("price_usd", { ascending: false, nullsFirst: false });
  else if (opts.sort === "brand") q = q.order("brand", { ascending: true }).order("created_at", { ascending: false });
  else q = q.order("created_at", { ascending: false }); // "new" and default

  const { data, error } = await q;
  if (error) throw error;
  let rows = (data ?? []) as Product[];

  if (opts.sort === "popular") {
    const { data: pop } = await sb.from("product_popularity").select("product_id, adds");
    const rank = new Map((pop ?? []).map((r) => [r.product_id as string, r.adds as number]));
    rows = [...rows].sort((a, b) => (rank.get(b.id) ?? 0) - (rank.get(a.id) ?? 0));
  }
  return rows;
}
```

- [ ] **Step 3: Verify the query compiles + runs**

Run: `cd web-v2 && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0 (no type errors).
Then a runtime smoke check via SQL parity: `select id from products where published and color='black' and price_usd between 50 and 200 order by price_usd asc limit 3;` returns rows (confirms column + filters are valid).

- [ ] **Step 4: Commit**

```bash
git add web-v2/src/lib/data.ts
git commit -m "feat(v2): sort/color/price options in getPublishedProducts + popularity view"
```

---

### Task 4: `ShopSortFilter` popover component

**Files:**
- Create: `web-v2/src/components/ShopSortFilter.tsx`

**Interfaces:**
- Consumes: `COLOR_FAMILIES`, `ColorSlug` from Task 1.
- Produces: `<ShopSortFilter handle brand category q showAll sort color min max />` (client component).

- [ ] **Step 1: Write the component**

Create `web-v2/src/components/ShopSortFilter.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLOR_FAMILIES } from "@/lib/colors";

const SORTS = [
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "new", label: "Recently added" },
  { key: "brand", label: "Brand: A to Z" },
  { key: "popular", label: "Most popular" },
] as const;

function buildHref(
  handle: string,
  base: Record<string, string | undefined>,
  over: Record<string, string | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return `/${handle}/shop${s ? `?${s}` : ""}`;
}

export function ShopSortFilter({
  handle, brand, category, q, showAll, sort, color, min, max,
}: {
  handle: string; brand?: string; category?: string; q?: string;
  showAll: boolean; sort?: string; color?: string; min?: string; max?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lo, setLo] = useState(min ?? "");
  const [hi, setHi] = useState(max ?? "");
  const base = { brand, category, q, all: showAll ? "1" : undefined, sort, color, min, max };
  const go = (over: Record<string, string | undefined>) =>
    router.replace(buildHref(handle, base, over));
  const activeSort = sort ?? "new";

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Sort and filter"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 w-7 items-center justify-center border ${
          open || sort || color || min || max ? "border-black" : "border-neutral-300"
        } hover:border-black`}
      >
        {/* 2x2 grid glyph */}
        <span className="grid grid-cols-2 gap-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] bg-black" />
          ))}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-64 border border-black bg-white p-4 shadow-lg">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Sort</p>
          <ul className="space-y-1.5">
            {SORTS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => go({ sort: s.key === "new" ? undefined : s.key })}
                  className={`text-xs ${activeSort === s.key ? "font-semibold text-black" : "text-neutral-600 hover:text-black"}`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="my-3 border-t border-neutral-200" />

          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Color</p>
          <div className="grid grid-cols-6 gap-1.5">
            <button
              type="button"
              aria-label="All colors"
              onClick={() => go({ color: undefined })}
              className={`h-6 w-6 border text-[8px] leading-none ${!color ? "ring-2 ring-black ring-offset-1" : "border-neutral-300"}`}
            >
              All
            </button>
            {COLOR_FAMILIES.map((f) => (
              <button
                key={f.slug}
                type="button"
                aria-label={f.label}
                title={f.label}
                onClick={() => go({ color: color === f.slug ? undefined : f.slug })}
                className={`h-6 w-6 border border-neutral-300 ${color === f.slug ? "ring-2 ring-black ring-offset-1" : ""}`}
                style={
                  f.swatch === "conic"
                    ? { background: "conic-gradient(#e5484d,#f5a623,#f7e017,#4caf50,#3a5a95,#8a4a8a,#e5484d)" }
                    : { backgroundColor: f.swatch }
                }
              />
            ))}
          </div>

          <div className="my-3 border-t border-neutral-200" />

          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Price (USD)</p>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go({ min: lo || undefined, max: hi || undefined });
            }}
          >
            <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value.replace(/\D/g, ""))}
              placeholder="0" className="w-16 border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-black" />
            <span className="text-neutral-400">to</span>
            <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value.replace(/\D/g, ""))}
              placeholder="670" className="w-16 border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-black" />
            <button type="submit" className="border border-black px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white">Go</button>
          </form>

          {(sort || color || min || max) && (
            <button
              type="button"
              onClick={() => { setLo(""); setHi(""); go({ sort: undefined, color: undefined, min: undefined, max: undefined }); }}
              className="mt-3 text-[10px] uppercase tracking-widest text-neutral-400 underline hover:text-black"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd web-v2 && npx tsc --noEmit -p tsconfig.json`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add web-v2/src/components/ShopSortFilter.tsx
git commit -m "feat(v2): ShopSortFilter popover (sort, color squares, price range)"
```

---

### Task 5: Wire the control into the shop page

**Files:**
- Modify: `web-v2/src/app/[handle]/shop/page.tsx`

**Interfaces:**
- Consumes: `ShopSortFilter` (Task 4), extended `getPublishedProducts` (Task 3).

- [ ] **Step 1: Parse params + pass to the query**

In `web-v2/src/app/[handle]/shop/page.tsx`, after the existing `const showAll = ...` line, add:
```ts
  const sort = one(sp.sort);
  const color = one(sp.color);
  const minStr = one(sp.min);
  const maxStr = one(sp.max);
  const min = minStr ? Number(minStr) : undefined;
  const max = maxStr ? Number(maxStr) : undefined;
```
Change the `getPublishedProducts(...)` call inside `Promise.all` to:
```ts
    getPublishedProducts(brand, category, q, !showAll, { sort, color, min, max }),
```

- [ ] **Step 2: Render the icon in the header row**

Add the import at the top:
```ts
import { ShopSortFilter } from "@/components/ShopSortFilter";
```
Replace the header `<div className="mb-6 flex ...">` block's left side so the icon sits before the count label:
```tsx
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShopSortFilter
              handle={handle} brand={brand} category={category} q={q}
              showAll={showAll} sort={sort} color={color} min={minStr} max={maxStr}
            />
            <p className="text-[11px] uppercase tracking-widest text-neutral-500">
              {label ? `${label} · ` : ""}
              {products.length} item{products.length === 1 ? "" : "s"}
            </p>
          </div>
          <SearchBox handle={handle} brand={brand} category={category} q={q} showAll={showAll} />
        </div>
```

- [ ] **Step 3: Verify build + browser (repro rule: use Playwright)**

Run: `cd web-v2 && npx tsc --noEmit -p tsconfig.json` (exit 0), then `npm run dev` and open `/hampus/shop`.
Confirm, via Playwright MCP:
- The grid icon shows left of the item count; clicking toggles the popover.
- Picking "Price: Low to High" reorders the grid and sets `?sort=price-asc`; refresh keeps it.
- Tapping the Black square filters to black items and sets `?color=black`; tapping it again clears.
- Entering min/max + Go filters the grid (`?min=&max=`).
- Reset clears sort/color/price but keeps the active brand/category.
- Works the same inside a brand (e.g. `/hampus/shop?brand=Prada`).

- [ ] **Step 4: Commit**

```bash
git add web-v2/src/app/[handle]/shop/page.tsx
git commit -m "feat(v2): wire sort/filter control into the shop grid"
```

---

### Task 6: New imports set `color` automatically

**Files:**
- Modify: `.claude/skills/import-product/SKILL.md`

**Interfaces:** none (documentation of the insert convention).

- [ ] **Step 1: Document the color column in the import rule**

In `.claude/skills/import-product/SKILL.md`, in the upsert/columns guidance, add a bullet next to the `display_title` rule:
```
- **Set `color` on every insert** = `normalizeColor(<the "— Colour" suffix of display_title>)`
  (the 12-family slug from `web-v2/src/lib/colors.ts`: black/white/grey/blue/brown/
  beige/green/red/yellow/purple/pink/multi). Two-tone / patterned → `multi`. This
  powers the shop colour filter; a NULL colour drops the item out of every colour facet.
  Bulk/raw SQL inserts must include it (the backfill script only runs one-off).
```

- [ ] **Step 2: Commit**

```bash
git add .claude/skills/import-product/SKILL.md
git commit -m "docs(import): set products.color on new inserts"
```

---

## Self-Review

**Spec coverage:**
- §1 placement → Task 5 Step 2. §2 sort → Tasks 3+4+5. §2 color squares → Tasks 1+4. §2 price range → Tasks 3+4. §3a color column + normalize + source of truth → Tasks 1+2. §3a import sets color → Task 6. §3b popularity → Task 3. §4 data flow → Tasks 3+5. §5 files → all covered. §6 edge cases → Task 3 (nulls, price bounds) + Task 1 (unmatched→multi). §7 testing → Task 1 (unit), Task 5 Step 3 (browser). §8 out-of-scope respected (single-select, no tonal sort, no saved prefs). No gaps.

**Placeholder scan:** none — every code step has complete code and exact commands.

**Type consistency:** `ColorSlug` / `COLOR_FAMILIES` / `normalizeColor` defined in Task 1 and consumed unchanged in Tasks 2/3/4. `getPublishedProducts` opts bag `{sort,color,min,max}` defined in Task 3 and matched by Task 5's call site. `ShopSortFilter` props defined in Task 4 and matched by Task 5's usage. Sort keys (`price-asc/price-desc/new/brand/popular`) consistent between Task 3's switch and Task 4's `SORTS`.
