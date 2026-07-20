// Upsert a directory of scraped+classified products into the shop.
// Reads /tmp/haul-batch/NN.json (metadata) + NN.out.json (size_guide) and
// /tmp/haul-stage/NN/ (classified images, hero first), inserts the products row,
// and re-hosts the staged images to Supabase storage. Run from web-v2/.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";
import { slugify as slug } from "./lib/haul-codes.mjs";
import { retagProducts } from "./retag-heroes.mjs";

const BATCH = "/tmp/haul-batch";
const STAGE = "/tmp/haul-stage";
const env = loadEnv(".env.local");
const sb = adminClient(env);

// Optional CLI args pick specific products (e.g. `import-batch.mjs y1 y2 y3`);
// with no args it imports every NN.json in the batch dir.
const only = process.argv.slice(2);
const files = only.length
  ? only.map((n) => `${n}.json`)
  : readdirSync(BATCH).filter((f) => /^\d+\.json$/.test(f)).sort();
const importedIds = [];
for (const f of files) {
  const n = f.replace(".json", "");
  const p = JSON.parse(readFileSync(join(BATCH, f), "utf8"));
  let size_guide = null;
  const outP = join(BATCH, `${n}.out.json`);
  if (existsSync(outP)) {
    try { size_guide = JSON.parse(readFileSync(outP, "utf8")).size_guide ?? null; } catch {}
  }

  const row = {
    brand: p.brand || null,
    brand_slug: slug(p.brand),
    title: p.title,
    category: p.category || null,
    seller: p.seller || null,
    source_link: p.source_link,
    source_platform:
      p.source_platform ||
      (p.source_link.includes("weidian") ? "weidian" : p.source_link.includes("yupoo") ? "yupoo" : "taobao"),
    yupoo_url: p.source_link.includes("yupoo") ? p.source_link : null,
    cost_cny: p.cost_cny ?? null,
    markup: 0.2,
    price_usd: p.price_usd ?? null,
    size_options: p.sizes || [],
    colors: p.colors || [],
    size_guide,
    published: true,
    sold_out: false,
  };

  // Re-imports must not stomp curated state (renamed titles, sold_out flags,
  // unpublished drafts): update only scrape-owned fields on existing rows.
  const { data: existing } = await sb
    .from("products")
    .select("id,code")
    .eq("source_link", p.source_link)
    .maybeSingle();

  let data;
  if (existing) {
    const refresh = {
      cost_cny: row.cost_cny, price_usd: row.price_usd,
      size_options: row.size_options, colors: row.colors,
      size_guide: row.size_guide, seller: row.seller,
      source_platform: row.source_platform, yupoo_url: row.yupoo_url,
    };
    const { error } = await sb.from("products").update(refresh).eq("id", existing.id);
    if (error) { console.log(`[${n}] UPDATE ERROR: ${error.message}`); continue; }
    data = existing;
  } else {
    const { data: inserted, error } = await sb
      .from("products").insert(row).select("id,code").single();
    if (error) { console.log(`[${n}] INSERT ERROR: ${error.message}`); continue; }
    data = inserted;
  }

  const dir = join(STAGE, n);
  let nimg = 0;
  if (existsSync(dir)) {
    const imgs = readdirSync(dir).filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).sort().map((x) => join(dir, x));
    if (imgs.length) {
      try {
        const urls = await uploadProductImages(sb, env, data.id, imgs);
        // image_meta is aligned 1:1 with image_urls — null it until retag runs.
        const { error: ie } = await sb
          .from("products").update({ image_urls: urls, image_meta: null }).eq("id", data.id);
        if (ie) throw new Error(`image_urls update: ${ie.message}`);
        nimg = urls.length;
      } catch (e) {
        console.log(`[${n}] UPLOAD ERROR (row kept, images unchanged): ${e.message}`);
      }
    }
  }
  if (nimg) importedIds.push(data.id);
  console.log(`[${n}] ${p.title.slice(0, 42).padEnd(42)} $${p.price_usd}  id=${data.id.slice(0, 8)} code=${data.code} imgs=${nimg} sg=${size_guide ? "y" : "n"}`);
}

// Tag the freshly-imported images (flat_lay/front/worn/detail/... + hero) so new
// products carry the same image_meta as the rest of the catalog. Runs only if a
// GEMINI_API_KEY is present; otherwise skip (backfill later with retag-heroes).
if (importedIds.length && process.env.GEMINI_API_KEY) {
  console.log(`\ntagging ${importedIds.length} imported product(s)…`);
  await retagProducts(sb, env, process.env.GEMINI_API_KEY, { ids: importedIds, log: (m) => console.log(m) });
} else if (importedIds.length) {
  console.log(`\n(set GEMINI_API_KEY to auto-tag; or: node scripts/retag-heroes.mjs --ids ${importedIds.join(",")})`);
}
console.log("done.");
