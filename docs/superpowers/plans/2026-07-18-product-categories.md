# Product Categories Implementation Plan

> **For agentic workers:** the classification phase (Task 2) fans out ~10 parallel subagents; the rest is executed inline. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give every product one of 11 human categories, add a category filter to the shop sidebar (under Designers), surface uncertain ones on the cleanup page, and teach the import tool to assign a category on future scrapes.

**Architecture:** Reuse the existing `products.category` text column (currently coarse auto-labels). Normalize it to 11 canonical slugs defined once in `web-v2/src/lib/categories.ts`. A one-shot vision pass (10 subagents reading each product's title + images) writes the precise category; low-confidence items are left `null` to appear in a "Needs review" section on the cleanup page. Sidebar + import mapper both read the shared constant.

**Tech Stack:** Next.js 16 (App Router), Supabase (Management API via curl), Node ESM scripts, parallel subagents.

## Global Constraints

- Stored category values are **slugs** from the canonical list; UI renders labels via `CATEGORY_LABEL`.
- Canonical 11 (slug → label): `t-shirts`→T-Shirts · `shirts`→Shirts · `knitwear`→Sweaters & Knitwear · `hoodies`→Hoodies & Sweatshirts · `outerwear`→Jackets & Coats · `pants`→Pants · `shorts`→Shorts · `shoes`→Shoes · `bags`→Bags · `accessories`→Accessories · `glasses`→Glasses.
- Never hardcode the list in more than one place — everything imports `CATEGORIES`.
- Supabase writes go through the Management API with curl (Python urllib is Cloudflare-403'd). PAT read from `.mcp.json`.
- Ambiguous/low-confidence classifications → leave `category = null`, do NOT guess.

---

### Task 1: Canonical taxonomy constant

**Files:**
- Create: `web-v2/src/lib/categories.ts`

- [ ] `CATEGORIES` array of `{slug, label}` (the 11 above), `CategorySlug` type, `CATEGORY_LABEL` slug→label map, `CATEGORY_SLUGS` set for validation.

### Task 2: Bulk vision classification

**Files:**
- Create (temp): `scripts/classify/stage-images.mjs` (download first ≤4 images per product by id → `/tmp/haul-classify/<id>/`, emit `manifest.json` + `batch-00..09.json`)
- Output: `/tmp/haul-classify/out/batch-NN.json` written by each subagent

- [ ] Export all products (id, brand, title, coarse category, image_urls) to `/tmp/haul-classify/products.json`.
- [ ] Stage images locally + split into 10 batches (~24 each).
- [ ] Dispatch 10 subagents in parallel. Each: for every item, read image 000 first; if the type isn't obvious, read 001–003; pick exactly one slug from the 11; return `confident` bool + one-line `reason`. Coarse label is a hint, not gospel. Write results to its batch-out file.
- [ ] Merge outputs. Apply confident ones via SQL `update products set category=… where id=…`. Set `category=null` for non-confident.
- [ ] Print per-category counts + the list of null/needs-review for the user.

### Task 3: Cleanup page — category dropdown + needs-review section

**Files:**
- Modify: `web-v2/src/app/admin/cleanup/page.tsx` (add "Needs a category" section listing `category is null`, each row = image + title + `<select>` of the 11)
- Modify: `web-v2/src/app/admin/cleanup/actions.ts` (add `setCategory(formData)` server action; revalidate `/admin/cleanup` and `/`)

### Task 4: Shop sidebar category filter

**Files:**
- Create: `web-v2/src/components/CategorySidebar.tsx` (mirrors `BrandSidebar`, links `/?category=<slug>`, renders labels)
- Modify: `web-v2/src/app/page.tsx` (await `category` from searchParams, pass to data layer, render `<CategorySidebar>` under `<BrandSidebar>`)
- Modify: `web-v2/src/lib/data.ts` (`getPublishedProducts(brand?, category?)` adds `.eq("category", category)`; add `getCategories()` returning slugs present among published products, ordered by the canonical order)

### Task 5: Teach the import tool to categorize

**Files:**
- Modify: `web-v2/scripts/lib/map-favorite.mjs` (validate `fav.category` against `CATEGORY_SLUGS`; keep null if absent/invalid)
- Modify: `web-v2/scripts/lib/map-favorite.test.mjs` (assert valid slug passes through, invalid → null)
- Modify: `.claude/skills/import-product/SKILL.md` (add a step: after fetching images, classify into one of the 11 slugs and set `category`)

### Task 6 (optional, last): integrity constraint

- [ ] Once all rows conform, add a CHECK constraint restricting `products.category` to the 11 slugs (or null). New migration `0006_category_check.sql`.

## Self-Review

- Every requirement (11 cats, sidebar-under-brands, cleanup fallback, import pickup) has a task. ✓
- Slug list defined once (Task 1), consumed by Tasks 3/4/5. ✓
- Glasses kept separate from Accessories per user. ✓
