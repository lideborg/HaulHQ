// Upsert a directory of scraped+classified products into the shop.
// Reads /tmp/haul-batch/NN.json (metadata) + NN.out.json (size_guide) and
// /tmp/haul-stage/NN/ (classified images, hero first), inserts the products row,
// and re-hosts the staged images to Supabase storage. Run from web-v2/.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";

const BATCH = "/tmp/haul-batch";
const STAGE = "/tmp/haul-stage";
const env = loadEnv(".env.local");
const sb = adminClient(env);

const slug = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Optional CLI args pick specific products (e.g. `import-batch.mjs y1 y2 y3`);
// with no args it imports every NN.json in the batch dir.
const only = process.argv.slice(2);
const files = only.length
  ? only.map((n) => `${n}.json`)
  : readdirSync(BATCH).filter((f) => /^\d+\.json$/.test(f)).sort();
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

  const { data, error } = await sb
    .from("products")
    .upsert(row, { onConflict: "source_link" })
    .select("id,code")
    .single();
  if (error) { console.log(`[${n}] INSERT ERROR: ${error.message}`); continue; }

  const dir = join(STAGE, n);
  let nimg = 0;
  if (existsSync(dir)) {
    const imgs = readdirSync(dir).filter((x) => /\.(jpe?g|png|webp)$/i.test(x)).sort().map((x) => join(dir, x));
    if (imgs.length) {
      const urls = await uploadProductImages(sb, env, data.id, imgs);
      await sb.from("products").update({ image_urls: urls }).eq("id", data.id);
      nimg = urls.length;
    }
  }
  console.log(`[${n}] ${p.title.slice(0, 42).padEnd(42)} $${p.price_usd}  id=${data.id.slice(0, 8)} code=${data.code} imgs=${nimg} sg=${size_guide ? "y" : "n"}`);
}
console.log("done.");
