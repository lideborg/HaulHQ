// Crawl every seller's Yupoo /categories page, LLM-map category titles to
// canonical brand names, and upsert seller_brand_links. Idempotent: existing
// urls are updated in place, vanished categories are deactivated, other
// sellers' rows are never touched. Run from web-v2/:
//
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs           # all sellers
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs --dry     # print only
//   GEMINI_API_KEY=... node scripts/crawl-seller-categories.mjs --only deateath
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";
import { parseCategories } from "./lib/yupoo-categories.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("set GEMINI_API_KEY"); process.exit(1); }
const DRY = process.argv.includes("--dry");
const ONLY = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1]
  : null;

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      title: { type: "STRING" },
      brand: { type: "STRING", nullable: true },
    },
    required: ["title", "brand"],
  },
};

async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 16384,
          responseMimeType: "application/json",
          responseSchema: SCHEMA,
        },
      }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) {
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) return JSON.parse(txt);
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 1500 * (t + 1)));
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (titles) =>
  `These are category titles from a Chinese rep-fashion seller's Yupoo photo site. ` +
  `Map each to the canonical fashion brand name, or null when the category is not a single brand ` +
  `(garment types like "T-SHIRT T恤", info pages like "About Us", multi-brand groupings, "other").\n` +
  `Sellers censor brand names — expand them: "P⭐A⭐A"→"Prada", "B⭐L⭐⭐⭐IA⭐A"→"Balenciaga", ` +
  `"R* Lau*ren"→"Ralph Lauren", "Bru*nello c*"→"Brunello Cucinelli", "LP"→"Loro Piana", ` +
  `"BV"→"Bottega Veneta", "BLCG"→"Balenciaga", "GGDB"→"Golden Goose", "TR"→"The Row", ` +
  `"N⭐K⭐"→"Nike", "CDG"→"Comme des Garçons", "MM6"/"Margiela"→"Maison Margiela". ` +
  `Strip emoji and qualifiers ("👜The Row"→"The Row", "ACNE jeans"→"Acne Studios"). ` +
  `Return one entry per input title, same order.\n\nTitles:\n` +
  titles.map((t) => `- ${t}`).join("\n");

const { data: sellers, error } = await sb
  .from("sellers")
  .select("name, yupoo_url")
  .not("yupoo_url", "is", null);
if (error) { console.error(error.message); process.exit(1); }

let targets = sellers.map((s) => ({
  name: s.name,
  sub: new URL(s.yupoo_url).hostname.split(".")[0].toLowerCase(),
}));
if (ONLY) targets = targets.filter((t) => t.sub === ONLY);
console.log(`${targets.length} sellers${DRY ? " (dry)" : ""}\n`);

for (const t of targets) {
  const label = `${t.sub} (Yupoo)`;
  try {
    const res = await fetch(`https://${t.sub}.x.yupoo.com/categories`, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) { console.log(`${t.sub}: HTTP ${res.status}, skipped`); continue; }
    const cats = parseCategories(await res.text());
    if (!cats.length) { console.log(`${t.sub}: 0 categories, skipped`); continue; }

    const mapped = await gemini([{ text: PROMPT(cats.map((c) => c.title)) }]);
    const byTitle = new Map(mapped.map((m) => [m.title, m.brand]));
    const rows = cats
      .map((c) => ({
        seller: label,
        brand: byTitle.get(c.title) ?? null,
        alias: c.title,
        url: `https://${t.sub}.x.yupoo.com/categories/${c.id}`,
        active: true,
      }))
      .filter((r) => r.brand);
    console.log(`${t.sub}: ${cats.length} categories → ${rows.length} brand links`);
    if (DRY) { rows.slice(0, 8).forEach((r) => console.log(`   ${r.brand}  ←  ${r.alias}`)); continue; }

    const { data: existing } = await sb
      .from("seller_brand_links")
      .select("id, url")
      .eq("seller", label);
    const existingByUrl = new Map((existing ?? []).map((e) => [e.url, e.id]));
    const liveUrls = new Set(rows.map((r) => r.url));

    for (const r of rows) {
      const id = existingByUrl.get(r.url);
      if (id) await sb.from("seller_brand_links").update(r).eq("id", id);
      else await sb.from("seller_brand_links").insert(r);
    }
    // Page fetched fine, so a missing category really is gone (spec §3.4).
    const gone = (existing ?? []).filter((e) => !liveUrls.has(e.url));
    for (const e of gone)
      await sb.from("seller_brand_links").update({ active: false }).eq("id", e.id);
    if (gone.length) console.log(`   deactivated ${gone.length} vanished links`);
  } catch (e) {
    console.log(`${t.sub}: ${e.message}, skipped`);
  }
}
console.log("\ndone");
