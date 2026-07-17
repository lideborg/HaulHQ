# Scrape-Import Pipeline & Bulk Catalog Import — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the HaulHQ v2 friend shop with complete products — bulk-import the ~240 v1 favorites and stand up the admin-triggered scrape pipeline (all sizes, storage-hosted images, text size guides, admin gate).

**Architecture:** A pure mapper turns v1 favorite JSON into `products` rows (testable, no I/O); a Node script wraps it with Supabase writes + storage uploads; the friend product page renders `size_guide` as a cm⇄inch table; `/admin` is gated by an env-password cookie via `src/proxy.ts` (Next 16 renamed middleware→proxy); `/request` gives friends link intake that notifies Hampus. Spec: `docs/superpowers/specs/2026-07-17-scrape-import-design.md`.

**Tech Stack:** Next.js 16.2.10 (App Router, `proxy.ts`, async `params`/`searchParams`), Supabase (Postgres + Storage, service-role via `@supabase/supabase-js`), Node 18+ `node:test` for script logic, Supabase Management API via curl for SQL (MCP tools may be absent in subagents).

## Global Constraints

- Repo root: `/Users/lidelaptop/conductor/workspaces/haulhq/lima` — all paths below relative to it. App dir: `web-v2/`.
- Branch `feat/v2-groupbuy`. Commit after every task with the exact message given.
- Next 16: `searchParams`/`params` are **Promises** (must await); middleware file is **`src/proxy.ts`** exporting `proxy()`; per `web-v2/AGENTS.md`, check `web-v2/node_modules/next/dist/docs/` before using any other Next API.
- Supabase project ref `pqfiwdscftwhmcutspay`. SQL via Management API curl pattern (below). NEVER print full keys/tokens; read them from files.
- Management-API SQL pattern (use everywhere; expect HTTP 201):
  ```bash
  cd /Users/lidelaptop/conductor/workspaces/haulhq/lima
  PAT=$(python3 -c "import json;print(json.load(open('.mcp.json'))['mcpServers']['supabase']['env']['SUPABASE_ACCESS_TOKEN'])")
  python3 -c "import json;open('/tmp/q.json','w').write(json.dumps({'query': open('THE_SQL_FILE').read()}))"   # or inline SQL string
  curl -s -o /tmp/out.json -w "%{http_code}\n" -X POST -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
    --data @/tmp/q.json "https://api.supabase.com/v1/projects/pqfiwdscftwhmcutspay/database/query"
  cat /tmp/out.json
  ```
- Python urllib gets Cloudflare-403'd on api.supabase.com — always curl.
- Markup 20% (`markup = 0.20`); FX from `web-v2/.env.local` `FX_CNY_USD` (currently 0.14). Prices in USD, 2 decimals.
- Everything imported: `published = true`. Sizes fallback chain: `size_chart.sizes` → `[target_size]` → `["One Size"]`.
- Friend-facing pages must never show `admin_sizing_note`, `cost_cny`, or source links.

---

### Task 1: Migration 0003 — schema + storage bucket + TS types

**Files:**
- Create: `supabase/migrations/0003_import_pipeline.sql`
- Modify: `web-v2/src/lib/types.ts`

**Interfaces:**
- Produces: DB columns `products.size_guide jsonb`, `products.admin_sizing_note text`, `products.source_platform text`, `products.colors text[]`, `items.color text`, `friends.measurements jsonb`; unique index `products_source_link_key`; public storage bucket `product-images`. TS: `SizeGuide` interface; extended `Product`, `Friend` fields (exact shapes below) — Tasks 2–8 consume these.

- [ ] **Step 1: Write the migration file** `supabase/migrations/0003_import_pipeline.sql`:

```sql
-- 0003: scrape-import pipeline (spec 2026-07-17)
alter table products add column if not exists size_guide jsonb;
alter table products add column if not exists admin_sizing_note text;
alter table products add column if not exists source_platform text; -- yupoo|weidian|taobao|superbuy|1688
alter table products add column if not exists colors text[] not null default '{}';
alter table items    add column if not exists color text;
alter table friends  add column if not exists measurements jsonb;
-- plain unique (multiple NULLs allowed in Postgres)
create unique index if not exists products_source_link_key on products(source_link);
-- public image bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
```

- [ ] **Step 2: Apply it** with the Global-Constraints curl pattern (`THE_SQL_FILE` = the migration path). Expected: `201` and `[]`.

- [ ] **Step 3: Verify** — run this SQL through the same pattern:

```sql
select
  (select count(*) from information_schema.columns where table_name='products' and column_name in ('size_guide','admin_sizing_note','source_platform','colors')) as product_cols,
  (select count(*) from storage.buckets where id='product-images') as bucket;
```

Expected: `[{"product_cols":4,"bucket":1}]`.

- [ ] **Step 4: Extend types** — in `web-v2/src/lib/types.ts` add above `Product`:

```ts
export interface SizeGuide {
  unit: "cm" | "in";
  note?: string;
  sizes: string[];
  measurements: Record<string, (number | null)[]>;
}
```

and add to `Product`: `size_guide: SizeGuide | null; admin_sizing_note: string | null; source_platform: string | null; colors: string[];` — to `Friend`: `measurements: Record<string, number> | null;` — and to the `items`-shaped usage add nothing yet (no Item interface exists; skip).

- [ ] **Step 5: Typecheck** — `cd web-v2 && npx tsc --noEmit`. Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0003_import_pipeline.sql web-v2/src/lib/types.ts
git commit -m "feat(v2): migration 0003 — size_guide, platform, colors, measurements + product-images bucket"
```

---

### Task 2: Favorite→product mapper (pure logic, TDD)

**Files:**
- Create: `web-v2/scripts/lib/map-favorite.mjs`
- Test: `web-v2/scripts/lib/map-favorite.test.mjs`

**Interfaces:**
- Produces (consumed by Tasks 3–4): `parseCostCny(price: string|null): number|null` · `deriveSizes(fav): string[]` · `deriveSizeGuide(fav): object|null` · `firstSentence(notes): string|null` · `localImagePaths(fav): string[]` (size-chart images excluded) · `mapFavorite(fav, fxCnyUsd, markup=0.2): row` where `row` has keys `brand,title,description,category,seller,source_link,source_platform,cost_cny,markup,price_usd,size_options,size_guide,admin_sizing_note,published`.

- [ ] **Step 1: Write the failing tests** `web-v2/scripts/lib/map-favorite.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCostCny, deriveSizes, deriveSizeGuide, firstSentence,
  localImagePaths, mapFavorite,
} from "./map-favorite.mjs";

test("parseCostCny reads the first yen amount", () => {
  assert.equal(parseCostCny("¥869 (~$137.28)"), 869);
  assert.equal(parseCostCny("¥215-237 ($31.53-34.71)"), 215);
  assert.equal(parseCostCny("~$76-78 (¥520-535)"), 520);
  assert.equal(parseCostCny("¥1,880"), 1880);
  assert.equal(parseCostCny("$50 only"), null);
  assert.equal(parseCostCny(null), null);
});

test("deriveSizes: chart sizes, then target_size, then One Size", () => {
  assert.deepEqual(deriveSizes({ size_chart: { sizes: ["M", "L"] } }), ["M", "L"]);
  assert.deepEqual(deriveSizes({ target_size: "XXL" }), ["XXL"]);
  assert.deepEqual(deriveSizes({}), ["One Size"]);
});

test("deriveSizeGuide maps chart, drops source_image, null without measurements", () => {
  const g = deriveSizeGuide({ size_chart: {
    unit: "cm", note: "n", sizes: ["M", "L"],
    measurements: { length: [48, 50] }, source_image: "images/x/01.jpg",
  }});
  assert.deepEqual(g, { unit: "cm", note: "n", sizes: ["M", "L"], measurements: { length: [48, 50] } });
  assert.equal(deriveSizeGuide({ size_chart: { sizes: ["M"] } }), null);
  assert.equal(deriveSizeGuide({}), null);
});

test("firstSentence trims notes", () => {
  assert.equal(firstSentence("First bit. Second bit."), "First bit.");
  assert.equal(firstSentence(null), null);
});

test("localImagePaths drops size-chart images", () => {
  assert.deepEqual(
    localImagePaths({ local_image_paths: ["images/a/01.jpg", "images/a/size-chart.png"] }),
    ["images/a/01.jpg"],
  );
});

test("mapFavorite computes usd price and strips (rep)", () => {
  const row = mapFavorite({
    title: "T", brand: "Prada (rep)", category: "bag", seller: "S",
    source_url: "https://x", source: "taobao", price: "¥100",
    notes: "One. Two.", sizing: "note",
  }, 0.14);
  assert.equal(row.brand, "Prada");
  assert.equal(row.cost_cny, 100);
  assert.equal(row.price_usd, 16.8); // 100 * 0.14 * 1.2
  assert.equal(row.source_link, "https://x");
  assert.equal(row.source_platform, "taobao");
  assert.deepEqual(row.size_options, ["One Size"]);
  assert.equal(row.admin_sizing_note, "note");
  assert.equal(row.published, true);
});
```

- [ ] **Step 2: Run to verify failure** — `cd web-v2 && node --test scripts/lib/`. Expected: FAIL (`Cannot find module ... map-favorite.mjs`).

- [ ] **Step 3: Implement** `web-v2/scripts/lib/map-favorite.mjs`:

```js
export function parseCostCny(price) {
  if (!price) return null;
  const m = String(price).match(/[¥￥]\s*([\d,]+(?:\.\d+)?)/);
  return m ? parseFloat(m[1].replace(/,/g, "")) : null;
}

export function deriveSizes(fav) {
  if (fav.size_chart?.sizes?.length) return fav.size_chart.sizes.map(String);
  if (fav.target_size) return [String(fav.target_size)];
  return ["One Size"];
}

export function deriveSizeGuide(fav) {
  const c = fav.size_chart;
  if (!c?.sizes?.length || !c?.measurements) return null;
  const g = { unit: c.unit || "cm", sizes: c.sizes.map(String), measurements: c.measurements };
  if (c.note) g.note = c.note;
  return { unit: g.unit, note: g.note, sizes: g.sizes, measurements: g.measurements };
}

export function firstSentence(notes) {
  if (!notes) return null;
  const s = String(notes).split(/(?<=\.)\s+/)[0].trim();
  if (!s) return null;
  return s.length > 200 ? s.slice(0, 197) + "..." : s;
}

export function localImagePaths(fav) {
  return (fav.local_image_paths || []).filter((p) => !/size[-_]?chart/i.test(p));
}

export function mapFavorite(fav, fxCnyUsd, markup = 0.2) {
  const cost = parseCostCny(fav.price);
  return {
    brand: (fav.brand || "").replace(/\s*\(rep\)\s*$/i, "").trim() || null,
    title: fav.title || fav.user_label || "Untitled",
    description: firstSentence(fav.notes),
    category: fav.category ?? null,
    seller: fav.seller ?? null,
    source_link: fav.source_url || fav.yupoo_url || fav.url || null,
    source_platform: fav.source ?? null,
    cost_cny: cost,
    markup,
    price_usd: cost != null ? Math.round(cost * fxCnyUsd * (1 + markup) * 100) / 100 : null,
    size_options: deriveSizes(fav),
    size_guide: deriveSizeGuide(fav),
    admin_sizing_note: fav.sizing ?? null,
    published: true,
  };
}
```

Note: `deriveSizeGuide` returns keys in a fixed order and omits nothing silently — `note` is `undefined` when absent, which `JSON.stringify` drops.

- [ ] **Step 4: Run tests** — `cd web-v2 && node --test scripts/lib/`. Expected: all pass (`# fail 0`).

- [ ] **Step 5: Commit**

```bash
git add web-v2/scripts/lib/map-favorite.mjs web-v2/scripts/lib/map-favorite.test.mjs
git commit -m "feat(v2): favorite->product mapper with tests"
```

---

### Task 3: Env/storage helpers + bulk import script (dry + limited run)

**Files:**
- Create: `web-v2/scripts/lib/env.mjs`, `web-v2/scripts/lib/storage.mjs`, `web-v2/scripts/import-favorites.mjs`

**Interfaces:**
- Consumes: Task 2 mapper exports; Task 1 columns/bucket.
- Produces: `loadEnv(path): Record<string,string>` · `adminClient(env): SupabaseClient` · `uploadProductImages(sb, env, productId, absFilePaths): Promise<string[]>` (public URLs, order preserved) — Task 9's CLI reuses these. CLI: `node scripts/import-favorites.mjs [--dry] [--limit N] [--only <slug>]` run from `web-v2/`.

- [ ] **Step 1: Write** `web-v2/scripts/lib/env.mjs`:

```js
import { readFileSync } from "node:fs";

export function loadEnv(path = ".env.local") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}
```

- [ ] **Step 2: Write** `web-v2/scripts/lib/storage.mjs`:

```js
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg", jpg: "image/jpeg" };

export async function uploadProductImages(sb, env, productId, absFilePaths) {
  const urls = [];
  for (let i = 0; i < absFilePaths.length; i++) {
    const fp = absFilePaths[i];
    const ext = (fp.split(".").pop() || "jpg").toLowerCase();
    const key = `products/${productId}/${String(i).padStart(3, "0")}.${ext}`;
    const { error } = await sb.storage
      .from("product-images")
      .upload(key, readFileSync(fp), { contentType: MIME[ext] || "image/jpeg", upsert: true });
    if (error) throw new Error(`upload ${key}: ${error.message}`);
    urls.push(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`);
  }
  return urls;
}
```

- [ ] **Step 3: Write** `web-v2/scripts/import-favorites.mjs`:

```js
// Bulk-import v1 favorites (data/favorites/*.json) into Supabase products.
// Usage (from web-v2/): node scripts/import-favorites.mjs [--dry] [--limit N] [--only slug]
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";
import { mapFavorite, localImagePaths } from "./lib/map-favorite.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : Infinity;
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const FAV_DIR = resolve("../data/favorites");
const env = loadEnv(".env.local");
const FX = parseFloat(env.FX_CNY_USD || "0.14");
const sb = DRY ? null : adminClient(env);

const index = JSON.parse(readFileSync(join(FAV_DIR, "_index.json"), "utf8"));
const seenLinks = new Set();
const report = { ok: [], updated: [], skipped: [], errors: [], flagged: [] };

let n = 0;
for (const entry of index.entries) {
  if (n >= LIMIT) break;
  const slug = basename(entry.file, ".json");
  if (ONLY && slug !== ONLY) continue;
  n++;
  try {
    const fav = JSON.parse(readFileSync(join(FAV_DIR, entry.file), "utf8"));
    const row = mapFavorite(fav, FX);
    if (row.source_link && seenLinks.has(row.source_link)) {
      report.skipped.push(`${slug}: duplicate source_link`);
      continue;
    }
    if (row.source_link) seenLinks.add(row.source_link);
    if (!fav.size_chart?.sizes?.length) report.flagged.push(`${slug}: no size chart -> sizes=${JSON.stringify(row.size_options)}`);
    if (row.price_usd == null) report.flagged.push(`${slug}: unparseable price "${fav.price}" -> quote on request`);

    const imgs = localImagePaths(fav)
      .map((p) => join(FAV_DIR, p))
      .filter((p) => existsSync(p));
    if (DRY) {
      console.log(`[dry] ${slug}: "${row.title}" | ${row.brand} | $${row.price_usd} | sizes=${row.size_options.join(",")} | guide=${!!row.size_guide} | imgs=${imgs.length}`);
      report.ok.push(slug);
      continue;
    }

    // select-then-write keyed on source_link
    let id = null;
    if (row.source_link) {
      const { data } = await sb.from("products").select("id").eq("source_link", row.source_link).maybeSingle();
      id = data?.id ?? null;
    }
    if (id) {
      const { error } = await sb.from("products").update(row).eq("id", id);
      if (error) throw error;
      report.updated.push(slug);
    } else {
      const { data, error } = await sb.from("products").insert(row).select("id").single();
      if (error) throw error;
      id = data.id;
      report.ok.push(slug);
    }

    if (imgs.length) {
      let urls;
      try {
        urls = await uploadProductImages(sb, env, id, imgs);
      } catch {
        try {
          urls = await uploadProductImages(sb, env, id, imgs); // one retry
        } catch (e2) {
          report.flagged.push(`${slug}: image upload failed twice (${e2.message}) — kept remote URLs`);
          urls = fav.image_urls || [];
        }
      }
      if (urls.length) {
        const { error } = await sb.from("products").update({ image_urls: urls }).eq("id", id);
        if (error) throw error;
      }
    } else {
      report.flagged.push(`${slug}: no local images found`);
    }
  } catch (e) {
    report.errors.push(`${slug}: ${e.message}`);
  }
}

console.log("\n=== IMPORT REPORT ===");
for (const k of ["ok", "updated", "skipped", "errors"]) console.log(`${k}: ${report[k].length}`);
for (const k of ["skipped", "errors", "flagged"]) if (report[k].length) console.log(`\n-- ${k} --\n` + report[k].join("\n"));
```

- [ ] **Step 4: Dry-run everything** — `cd web-v2 && node scripts/import-favorites.mjs --dry`. Expected: one `[dry]` line per favorite, report `errors: 0` (a handful of `flagged` is normal). If any file errors, read it, fix the mapper or flag as a data quirk in the report — do not hand-edit data files.

- [ ] **Step 5: Real run on the 3 known test cases** —

```bash
cd web-v2
node scripts/import-favorites.mjs --only cryptomade-erd-cropped-cardigan
node scripts/import-favorites.mjs --only cnmade-prada-enamel-belt
node scripts/import-favorites.mjs --only erd25fw-leather-flare-jeans
```

Expected: cardigan = `updated: 1` (it was seeded in 0002 — same source_link) with storage-hosted images; belt = insert, `sizes=["One Size"]` (no chart); jeans = insert with a 4-size guide and a `flagged` line only if images are missing.

- [ ] **Step 6: Verify in DB** — Management-API SQL:

```sql
select title, size_options, size_guide is not null as has_guide,
       image_urls[1] like '%supabase.co/storage%' as storage_hosted
from products
where source_link in (
  'https://item.taobao.com/item.htm?id=965649084862',
  'https://weidian.com/item.html?itemID=7742418749');
```

Expected: cardigan `has_guide=true, storage_hosted=true`; belt `size_options={"One Size"}`.

- [ ] **Step 7: Commit**

```bash
git add web-v2/scripts
git commit -m "feat(v2): bulk-import script — favorites to products with storage-hosted images"
```

---

### Task 4: Full bulk import (all ~240)

**Files:** none new (runs Task 3's script).

**Interfaces:** Consumes Task 3 CLI. Produces: fully populated `products` table (input to Tasks 5, 7).

- [ ] **Step 1: Run** — `cd web-v2 && node scripts/import-favorites.mjs` (no flags). This uploads ~1000 images; expect several minutes. Expected: report with `errors: 0` (investigate and fix any error before proceeding — rerunning is safe/idempotent).

- [ ] **Step 2: Verify counts** — Management-API SQL:

```sql
select count(*) as products,
  count(*) filter (where image_urls[1] like '%supabase.co/storage%') as storage_hosted,
  count(*) filter (where size_guide is not null) as with_guide,
  count(*) filter (where size_options = array['One Size']) as one_size
from products where published;
```

Expected: `products` within a few of the favorites count (duplicates skip), `storage_hosted` = majority. Record the numbers in the commit message.

- [ ] **Step 3: Eyeball the shop** — with the dev server running (`npm run dev` in `web-v2/` if not), `curl -s http://localhost:3000/ | grep -c "group block"` Expected: 20+ (grid full of products). Then check one brand filter: `curl -s "http://localhost:3000/?brand=Prada" | grep -ci prada` Expected: > 0.

- [ ] **Step 4: Save the report + commit** — paste the final report block into `docs/superpowers/import-report-2026-07-17.txt`:

```bash
git add docs/superpowers/import-report-2026-07-17.txt
git commit -m "feat(v2): full catalog import — <N> products live (<M> storage-hosted)"
```

---

### Task 5: SizeGuide component (cm ⇄ inch) on the product page

**Files:**
- Create: `web-v2/src/components/SizeGuide.tsx`
- Modify: `web-v2/src/app/product/[id]/page.tsx`

**Interfaces:**
- Consumes: `SizeGuide` type (Task 1), `product.size_guide` data (Task 4).
- Produces: `<SizeGuide guide={SizeGuideData} />` client component.

- [ ] **Step 1: Write** `web-v2/src/components/SizeGuide.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { SizeGuide as SizeGuideData } from "@/lib/types";

const LABELS: Record<string, string> = {
  pit_to_pit: "Chest (pit to pit)",
  bust: "Bust",
  chest: "Chest",
  half_waist: "Waist (half)",
  waist: "Waist",
  hip: "Hip",
  length: "Length",
  outer_length: "Outer length",
  shoulder: "Shoulder",
  sleeve: "Sleeve",
  thigh: "Thigh",
};

function label(key: string) {
  return (
    LABELS[key] ??
    key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function display(v: number | null, unit: "cm" | "in") {
  if (v == null) return "—";
  return unit === "cm" ? String(v) : (Math.round((v / 2.54) * 10) / 10).toFixed(1);
}

export function SizeGuide({ guide }: { guide: SizeGuideData }) {
  const [unit, setUnit] = useState<"cm" | "in">("cm");
  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest">
          Size guide
        </p>
        <div className="flex gap-1 text-[11px]">
          {(["cm", "in"] as const).map((u) => (
            <button
              key={u}
              onClick={() => setUnit(u)}
              className={`border px-2 py-0.5 uppercase ${
                unit === u ? "border-black bg-black text-white" : "border-neutral-300"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr className="border-b border-neutral-200 text-left">
            <th className="py-1.5 pr-2 font-normal text-neutral-500"> </th>
            {guide.sizes.map((s) => (
              <th key={s} className="py-1.5 pr-2 font-semibold">{s}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(guide.measurements).map(([key, vals]) => (
            <tr key={key} className="border-b border-neutral-100">
              <td className="py-1.5 pr-2 text-neutral-500">{label(key)}</td>
              {guide.sizes.map((_, i) => (
                <td key={i} className="py-1.5 pr-2">{display(vals[i] ?? null, unit)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {guide.note && (
        <p className="mt-2 text-[10px] text-neutral-400">{guide.note}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire into the product page** — in `web-v2/src/app/product/[id]/page.tsx`, import `{ SizeGuide }` and render below `<AddToCart …/>`:

```tsx
          <div className="mt-6">
            <AddToCart productId={product.id} sizes={product.size_options ?? []} />
            {product.size_guide && <SizeGuide guide={product.size_guide} />}
          </div>
```

(Replace the existing `<div className="mt-6">…</div>` block so AddToCart and SizeGuide share it.)

- [ ] **Step 3: Verify server render** — find the cardigan id via Management-API SQL (`select id from products where source_link like '%965649084862%';`), then `curl -s http://localhost:3000/product/<id> | grep -o "Size guide\|>M<\|>L<\|>XL<\|Length" | sort -u`. Expected: all present.

- [ ] **Step 4: Orchestrator browser check** — the cm→in math is client-side; the orchestrator (not the subagent) opens the cardigan page, clicks **IN**, and confirms length 48 cm renders as **18.9** (48/2.54=18.897→18.9). One screenshot in the review notes.

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/components/SizeGuide.tsx web-v2/src/app/product/[id]/page.tsx
git commit -m "feat(v2): size-guide table with cm/inch toggle on product page"
```

---

### Task 6: Admin gate (`/admin` password + proxy)

**Files:**
- Create: `web-v2/src/proxy.ts`, `web-v2/src/lib/adminAuth.ts`, `web-v2/src/app/admin/login/page.tsx`, `web-v2/src/app/admin/login/actions.ts`, `web-v2/src/app/admin/page.tsx`
- Modify: `web-v2/.env.local` and `web-v2/.env.local.example` (add `ADMIN_PASSWORD=`)

**Interfaces:**
- Produces: cookie `admin_session` = SHA-256 hex of `ADMIN_PASSWORD`; helper `sha256Hex(s: string): Promise<string>` in `adminAuth.ts` (used by both proxy and login action); gated `/admin` dashboard. Task 7 builds inside `/admin`.

- [ ] **Step 1: Add env** — append `ADMIN_PASSWORD=change-me-hampus` to `web-v2/.env.local` and `ADMIN_PASSWORD=pick-a-password` to `web-v2/.env.local.example`. (Hampus can change the real one any time; restart dev server after.)

- [ ] **Step 2: Write** `web-v2/src/lib/adminAuth.ts`:

```ts
export async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

- [ ] **Step 3: Write** `web-v2/src/proxy.ts` (Next 16 convention — `proxy`, NOT `middleware`; see `web-v2/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`):

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { sha256Hex } from "@/lib/adminAuth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const cookie = request.cookies.get("admin_session")?.value;
    const expected = await sha256Hex(process.env.ADMIN_PASSWORD ?? "");
    if (!process.env.ADMIN_PASSWORD || cookie !== expected) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }
  return NextResponse.next();
}

export const config = { matcher: "/admin/:path*" };
```

- [ ] **Step 4: Write** `web-v2/src/app/admin/login/actions.ts`:

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { sha256Hex } from "@/lib/adminAuth";

export async function login(formData: FormData) {
  const pw = String(formData.get("password") ?? "");
  if (pw && pw === process.env.ADMIN_PASSWORD) {
    (await cookies()).set("admin_session", await sha256Hex(pw), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}
```

- [ ] **Step 5: Write** `web-v2/src/app/admin/login/page.tsx`:

```tsx
import { login } from "./actions";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ Admin
      </h1>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Enter
        </button>
        {error && <p className="text-xs text-red-600">Wrong password.</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 6: Write the bare dashboard** `web-v2/src/app/admin/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const sb = createAdminClient();
  const [{ count: products }, { count: pub }, { count: requests }] =
    await Promise.all([
      sb.from("products").select("*", { count: "exact", head: true }),
      sb.from("products").select("*", { count: "exact", head: true }).eq("published", true),
      sb.from("items").select("*", { count: "exact", head: true }).eq("status", "requested"),
    ]);
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ — HQ
      </h1>
      <div className="flex gap-10 text-sm">
        <p>{products ?? 0} products ({pub ?? 0} visible)</p>
        <p>{requests ?? 0} open requests</p>
      </div>
    </main>
  );
}
```

- [ ] **Step 7: Verify the gate** — restart the dev server (env changed), then:

```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/admin
# Expected: 307 http://localhost:3000/admin/login
curl -s -c /tmp/cj -o /dev/null -X POST http://localhost:3000/admin/login -d "password=WRONG" -H "Content-Type: application/x-www-form-urlencoded" || true
# (server actions can't be POSTed raw — instead verify via page:)
curl -s http://localhost:3000/admin/login | grep -c "Password"
# Expected: 1
```

Full login verification is an orchestrator browser check: open `/admin`, get redirected, type the password, land on the dashboard with real counts.

- [ ] **Step 8: Typecheck + commit**

```bash
cd web-v2 && npx tsc --noEmit && cd ..
git add web-v2/src/proxy.ts web-v2/src/lib/adminAuth.ts web-v2/src/app/admin web-v2/.env.local.example
git commit -m "feat(v2): admin password gate via proxy.ts + bare HQ dashboard"
```

---

### Task 7: Admin product review list (rename / price / publish)

**Files:**
- Create: `web-v2/src/app/admin/products/page.tsx`, `web-v2/src/app/admin/products/actions.ts`
- Modify: `web-v2/src/app/admin/page.tsx` (add nav link)

**Interfaces:**
- Consumes: gate (Task 6), populated catalog (Task 4).
- Produces: server actions `updateProduct(formData)` (fields `id,title,price_usd`) and `togglePublished(formData)` (fields `id,published`).

- [ ] **Step 1: Write** `web-v2/src/app/admin/products/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

export async function updateProduct(formData: FormData) {
  const id = String(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const priceRaw = String(formData.get("price_usd") ?? "").trim();
  const price_usd = priceRaw === "" ? null : Number(priceRaw);
  const sb = createAdminClient();
  await sb.from("products").update({ title, price_usd }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}

export async function togglePublished(formData: FormData) {
  const id = String(formData.get("id"));
  const published = String(formData.get("published")) === "true";
  const sb = createAdminClient();
  await sb.from("products").update({ published: !published }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/");
}
```

- [ ] **Step 2: Write** `web-v2/src/app/admin/products/page.tsx`:

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { updateProduct, togglePublished } from "./actions";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-[0.25em]">
        Products ({products.length})
      </h1>
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b border-neutral-100 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-12 w-12 bg-neutral-100 object-cover" />
            <form action={updateProduct} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="title" defaultValue={p.title} className="flex-1 border border-neutral-200 px-2 py-1 text-xs" />
              <span className="text-[10px] uppercase text-neutral-400">{p.brand}</span>
              <input name="price_usd" defaultValue={p.price_usd ?? ""} className="w-20 border border-neutral-200 px-2 py-1 text-right text-xs" />
              <button className="border border-neutral-300 px-2 py-1 text-[10px] uppercase">Save</button>
            </form>
            <form action={togglePublished}>
              <input type="hidden" name="id" value={p.id} />
              <input type="hidden" name="published" value={String(p.published)} />
              <button
                className={`px-2 py-1 text-[10px] uppercase ${
                  p.published ? "bg-black text-white" : "border border-neutral-300 text-neutral-400"
                }`}
              >
                {p.published ? "Visible" : "Hidden"}
              </button>
            </form>
          </div>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Link it** — in `web-v2/src/app/admin/page.tsx` add under the counts:

```tsx
      <a href="/admin/products" className="mt-8 inline-block text-xs uppercase tracking-widest underline">
        Manage products →
      </a>
```

- [ ] **Step 4: Verify** — orchestrator browser check: open `/admin/products`, flip one product to Hidden, confirm it vanishes from `/` (shop), flip it back. Then `cd web-v2 && npx tsc --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add web-v2/src/app/admin
git commit -m "feat(v2): admin product list — rename, reprice, publish toggle"
```

---

### Task 8: Friend request intake (`/request`)

**Files:**
- Create: `web-v2/src/app/request/page.tsx`, `web-v2/src/app/request/actions.ts`

**Interfaces:**
- Consumes: `getCurrentFriend()` (`web-v2/src/lib/friend.ts`, exists), `createAdminClient`.
- Produces: `items` row (`status='requested'`, `source_link`, `chosen_size`, `notes`) + `notifications` row (`kind='new_request'`). Email delivery on that row is Phase-4 scope (spec: notifications), NOT this task.

- [ ] **Step 1: Write** `web-v2/src/app/request/actions.ts`:

```ts
"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentFriend } from "@/lib/friend";

export async function submitRequest(formData: FormData) {
  const link = String(formData.get("link") ?? "").trim();
  const size = String(formData.get("size") ?? "").trim() || null;
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!/^https?:\/\//.test(link)) redirect("/request?error=link");

  const friend = await getCurrentFriend();
  if (!friend) redirect("/request?error=session");

  const sb = createAdminClient();
  const { data: item, error } = await sb
    .from("items")
    .insert({
      owner_id: friend.id,
      source_link: link,
      title: null,
      chosen_size: size,
      notes: note,
      status: "requested",
    })
    .select("id")
    .single();
  if (error) redirect("/request?error=save");

  await sb.from("notifications").insert({
    kind: "new_request",
    item_id: item.id,
    friend_id: friend.id,
    payload: { link, size, note, friend: friend.name },
  });
  await sb.from("status_events").insert({
    item_id: item.id,
    status: "requested",
    note: "Link submitted",
  });
  redirect("/request?ok=1");
}
```

- [ ] **Step 2: Write** `web-v2/src/app/request/page.tsx`:

```tsx
import { Header } from "@/components/Header";
import { submitRequest } from "./actions";

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
          Request an item
        </h1>
        <p className="mb-8 text-xs text-neutral-500">
          Found something elsewhere? Paste the link — Hampus will source it,
          price it, and add it to your orders.
        </p>
        {ok && (
          <p className="mb-6 border border-neutral-200 p-3 text-xs">
            Request received — you&apos;ll see it in My Orders once priced.
          </p>
        )}
        {error && (
          <p className="mb-6 border border-red-200 p-3 text-xs text-red-600">
            {error === "link" ? "That doesn't look like a link." : "Something went wrong — try again."}
          </p>
        )}
        <form action={submitRequest} className="space-y-3">
          <input name="link" placeholder="https://…" className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <input name="size" placeholder="Size (optional)" className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <textarea name="note" placeholder="Anything else? (color, budget…)" rows={3} className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <button className="w-full bg-black py-3 text-xs uppercase tracking-widest text-white">
            Send request
          </button>
        </form>
      </main>
    </>
  );
}
```

- [ ] **Step 3: Verify** — orchestrator browser check: submit `https://example.com/item` size `L`; page shows the success note. Then Management-API SQL:

```sql
select i.source_link, i.chosen_size, i.status, n.kind
from items i join notifications n on n.item_id = i.id
order by i.created_at desc limit 1;
```

Expected: the row with `kind='new_request'`. Delete the test row after:

```sql
delete from items where source_link = 'https://example.com/item';
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd web-v2 && npx tsc --noEmit && cd ..
git add web-v2/src/app/request
git commit -m "feat(v2): friend request intake with notification row"
```

---

### Task 9: `import-product` skill + image-upload CLI

**Files:**
- Create: `web-v2/scripts/upload-product-images.mjs`, `.claude/skills/import-product/SKILL.md`

**Interfaces:**
- Consumes: `loadEnv`, `adminClient`, `uploadProductImages` (Task 3).
- Produces: CLI `node scripts/upload-product-images.mjs <productId> <dir>` (uploads every image in `<dir>` sorted by name, updates the product's `image_urls`, prints the URLs) — used by the skill and future admin flows.

- [ ] **Step 1: Write** `web-v2/scripts/upload-product-images.mjs`:

```js
// Upload a directory of images to a product's storage folder and point the
// product at them. Usage (from web-v2/):
//   node scripts/upload-product-images.mjs <productId> <absoluteDir>
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";

const [productId, dir] = process.argv.slice(2);
if (!productId || !dir) {
  console.error("usage: node scripts/upload-product-images.mjs <productId> <dir>");
  process.exit(1);
}
const env = loadEnv(".env.local");
const sb = adminClient(env);
const files = readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort()
  .map((f) => join(dir, f));
if (!files.length) {
  console.error("no images in " + dir);
  process.exit(1);
}
const urls = await uploadProductImages(sb, env, productId, files);
const { error } = await sb.from("products").update({ image_urls: urls }).eq("id", productId);
if (error) throw error;
console.log(JSON.stringify(urls, null, 2));
```

- [ ] **Step 2: Write** `.claude/skills/import-product/SKILL.md` — the admin-triggered scrape procedure. Full content:

```markdown
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
3. **Upsert the row** — via the Management-API curl pattern (see
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
4. **Images to storage** — download to a temp dir (curl; Referer header for
   Yupoo), then from `web-v2/`:
   `node scripts/upload-product-images.mjs <productId> <tmpdir>`
   (uploads sorted, updates `image_urls`, prints URLs). Hero shot must sort
   first — name files `000.jpg, 001.jpg, …`.
5. **Friend-request link-back** — if this came from a `requested` item:
   `update items set product_id='<id>', title='<clean title>', quoted_price_usd=<price> where id='<itemId>';`
6. **Verify** — open `http://localhost:3000/product/<id>`: all sizes render,
   gallery thumbnails work, size guide table shows. Fix before declaring done.

## Rules

- Never leave images on Yupoo/Weidian URLs (hotlink-protected — they will
  break). alicdn also gets migrated for consistency.
- Junk source titles are fine at scrape time — Hampus renames in
  /admin/products. Don't skip the row for a bad title.
- Price unparseable → `price_usd = null` (renders "Quote on request").
```

- [ ] **Step 3: Verify the CLI** — pick any imported product id, make a temp dir with one of its already-downloaded images (`mkdir /tmp/imgtest && cp data/favorites/images/cryptomade-erd-loafers/000.jpg /tmp/imgtest/`), run `cd web-v2 && node scripts/upload-product-images.mjs <loafers-product-id> /tmp/imgtest`. Expected: prints 1 storage URL; product page hero updates. Then re-run Task 3's `--only cryptomade-erd-loafers` to restore the full 4-image set. Clean up `/tmp/imgtest`.

- [ ] **Step 4: Commit**

```bash
git add web-v2/scripts/upload-product-images.mjs .claude/skills/import-product
git commit -m "feat(v2): import-product skill + storage upload CLI"
```

---

### Task 10: Spec-coverage check + production build

**Files:** none new.

- [ ] **Step 1: Walk the spec** (`docs/superpowers/specs/2026-07-17-scrape-import-design.md`) section by section and name the implementing task: schema (T1), bulk import w/ dry-run+idempotency+report (T3–4), scrape pipeline intake/notify (T8), scrape procedure (T9), review UI (T7), size-guide UI + cm/in + One Size (T5), admin gate (T6), error handling (T3 per-item try/catch, upload retry+fallback), out-of-scope untouched. Any gap → fix now.

- [ ] **Step 2: Full test + build** —

```bash
cd web-v2
node --test scripts/lib/
npx tsc --noEmit
npm run build
```

Expected: tests pass, no type errors, build succeeds. Fix anything that fails (build failures on the `img` lint rule → keep the existing `eslint-disable` comments pattern).

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "chore(v2): import-pipeline spec pass + green build" || echo "clean"
```
```

## Self-Review Notes (done at write time)

- **Spec coverage:** every spec component maps to a task (see Task 10 Step 1). Notification *email* is explicitly Phase-4 out-of-scope in both spec and Task 8.
- **Placeholders:** none — all code complete.
- **Type consistency:** `SizeGuide` defined once (T1), consumed in T5; `sha256Hex` defined in `adminAuth.ts`, used by proxy + login action; storage helpers defined in T3, reused in T9's CLI; `mapFavorite` field names match the `products` columns from 0001+0003.
