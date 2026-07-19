// Split one multi-colorway source listing into one published product per color.
// Each color becomes its own products row (same title + " — <Color>", its own
// single hero image) so every colorway shows as a distinct card in the grid.
//
// Usage: node scripts/split-colors.mjs <spec.json>
//
// spec = {
//   brand, seller, title, category, price_usd, cost_cny, sizes[], size_guide?,
//   source_platform,            // "weidian" | "taobao" | "yupoo"
//   source_link_base,           // real buy link; a #<color-slug> fragment is
//                               // appended per color to keep source_link unique
//   reuse_id?,                  // existing product row to repurpose as the first
//                               // color (avoids leaving the old combined listing)
//   colors: [ { label, image, sizes? } ]  // image = absolute local file path;
//                                          // per-color sizes override spec.sizes
// }
import { readFileSync } from "node:fs";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";
import { retagProducts } from "./retag-heroes.mjs";

const spec = JSON.parse(readFileSync(process.argv[2], "utf8"));
const env = loadEnv(".env.local");
const sb = adminClient(env);

const slug = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const brandSlug = slug(spec.brand);

const createdIds = [];
for (let i = 0; i < spec.colors.length; i++) {
  const c = spec.colors[i];
  const source_link = `${spec.source_link_base}#${slug(c.label)}`;
  const row = {
    brand: spec.brand,
    brand_slug: brandSlug,
    title: `${spec.title} — ${c.label}`,
    category: spec.category || null,
    seller: spec.seller || null,
    source_link,
    source_platform: spec.source_platform,
    yupoo_url: spec.source_platform === "yupoo" ? spec.source_link_base : null,
    cost_cny: spec.cost_cny ?? null,
    markup: 0.2,
    price_usd: spec.price_usd ?? null,
    size_options: c.sizes || spec.sizes || [],
    colors: [c.label],
    size_guide: spec.size_guide ?? null,
    published: true,
    sold_out: false,
  };

  let id;
  if (i === 0 && spec.reuse_id) {
    const { error } = await sb.from("products").update(row).eq("id", spec.reuse_id);
    if (error) { console.log(`[${c.label}] UPDATE ERROR: ${error.message}`); continue; }
    id = spec.reuse_id;
  } else {
    const { data, error } = await sb
      .from("products")
      .upsert(row, { onConflict: "source_link" })
      .select("id")
      .single();
    if (error) { console.log(`[${c.label}] UPSERT ERROR: ${error.message}`); continue; }
    id = data.id;
  }

  const urls = await uploadProductImages(sb, env, id, [c.image]);
  await sb.from("products").update({ image_urls: urls }).eq("id", id);
  createdIds.push(id);
  console.log(`[${String(i).padStart(2)}] ${c.label.padEnd(28)} id=${id.slice(0, 8)} img=${urls.length}`);
}

// Tag each colorway's image (kind + hero) for a consistent image_meta.
if (createdIds.length && process.env.GEMINI_API_KEY) {
  console.log(`\ntagging ${createdIds.length} colorway product(s)…`);
  await retagProducts(sb, env, process.env.GEMINI_API_KEY, { ids: createdIds, log: (m) => console.log(m) });
} else if (createdIds.length) {
  console.log(`\n(set GEMINI_API_KEY to auto-tag; or: node scripts/retag-heroes.mjs --ids ${createdIds.join(",")})`);
}
console.log("done. Backfill any null codes: update products set code=substr(md5(id::text),1,7) where code is null;");
