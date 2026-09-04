// Hard gate for shop data quality. Deterministic — no judgment calls.
// The import-product rules that kept getting missed (title/color casing, color
// family, brand_slug, images, price, sizes) are checked here as CODE, not prose.
// Run it and it MUST exit 0 before an import is called done.
//
//   node scripts/validate-shop.mjs                 # catalog-wide structural check
//   node scripts/validate-shop.mjs --ids a,b,c     # ALSO require those rows are
//                                                    Superbuy-verified (verified_at
//                                                    set) + have real sizes. Pass the
//                                                    just-imported ids here.
//
// Exit 0 = clean. Exit 1 = violations printed. Used by the Stop hook + the skill.
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);

const idsArg = process.argv.find((a) => a.startsWith("--ids="))?.slice(6)
  ?? (process.argv.includes("--ids") ? process.argv[process.argv.indexOf("--ids") + 1] : null);
const NEW_IDS = new Set((idsArg ?? "").split(",").map((s) => s.trim()).filter(Boolean));

const COLOR_FAMILIES = new Set([
  "black", "white", "grey", "blue", "brown", "beige",
  "green", "red", "yellow", "purple", "pink", "multi",
]);
// Categories that are physically sized and therefore must be Superbuy size-checked
// on import (a stamp is required for these when passed via --ids).
const SIZED = new Set([
  "t-shirts", "shirts", "knitwear", "hoodies", "outerwear",
  "pants", "shorts", "shoes",
]);

// Page past PostgREST's 1000-row cap (same bug we just fixed in the app).
async function fetchAll() {
  const all = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("products")
      .select("id, code, brand, brand_slug, display_title, color, category, price_usd, size_options, image_urls, verified_at")
      .eq("published", true)
      .eq("sold_out", false)
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    all.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return all;
}

const rows = await fetchAll();
const bad = [];
const tag = (r, msg) => bad.push(`${r.display_title ?? r.title ?? r.code} (${r.code}): ${msg}`);

for (const r of rows) {
  const dt = r.display_title;
  if (!dt) tag(r, "display_title is null");
  else {
    if (!dt.includes("—")) tag(r, "display_title has no ' — Color' suffix");
    const color = dt.split(" — ")[1] ?? "";
    if (/^[a-z]/.test(color)) tag(r, `display_title color not capitalized: "${color}"`);
    if (r.brand && dt.toLowerCase().startsWith(r.brand.toLowerCase()))
      tag(r, "brand leaked into display_title");
  }
  if (!r.color || !COLOR_FAMILIES.has(r.color)) tag(r, `color not a valid family: "${r.color}"`);
  if (!r.brand_slug) tag(r, "brand_slug is null (breaks the friend URL)");
  else if (/[^a-z0-9-]/.test(r.brand_slug)) tag(r, `brand_slug malformed: "${r.brand_slug}"`);
  if (!r.image_urls || r.image_urls.length === 0) tag(r, "no images");
  // price_usd null is a VALID state — renders "Quote on request". Only a positive
  // price is required to be sane; 0 or negative is the bug.
  if (r.price_usd != null && Number(r.price_usd) <= 0) tag(r, "price_usd is 0 or negative");
  // Empty size_options is fine for one-size categories (bags/accessories/hats/
  // glasses); only physically-sized garments/shoes must carry sizes.
  if (SIZED.has(r.category) && (!r.size_options || r.size_options.length === 0))
    tag(r, "sized garment/shoe has empty size_options");

  // Superbuy-verification stamp: only enforced on the just-imported set, and only
  // for physically-sized categories (a card holder / one-size bag needs no size check).
  if (NEW_IDS.has(r.id) && SIZED.has(r.category) && !r.verified_at)
    tag(r, "NEW import not Superbuy-verified (verified_at unset) — check colors/price/in-stock sizes on the buy link first");
}

if (bad.length) {
  console.error(`\nSHOP VALIDATION FAILED — ${bad.length} issue(s):\n`);
  for (const b of bad) console.error("  ✗ " + b);
  console.error("\nFix these before calling the import done.\n");
  process.exit(1);
}
console.log(`shop validation passed — ${rows.length} published in-stock products, 0 issues.`);
