// Estimate each product's shipped weight (grams, incl. light packaging) from
// its category + titles — no images needed. Writes products.weight_g.
//
//   node scripts/estimate-weights.mjs          # products missing weight_g
//   node scripts/estimate-weights.mjs --all    # re-estimate everything
//   node scripts/estimate-weights.mjs --dry    # print only
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("set GEMINI_API_KEY"); process.exit(1); }
const DRY = process.argv.includes("--dry");
const ALL = process.argv.includes("--all");
const CONC = 10;

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SCHEMA = {
  type: "OBJECT",
  properties: { weight_g: { type: "INTEGER" } },
  required: ["weight_g"],
};

async function gemini(text, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 512, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) { const txt = j.candidates?.[0]?.content?.parts?.[0]?.text; if (txt) return JSON.parse(txt); }
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (t + 1))); continue; }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (p) =>
  `Estimate the SHIPPED weight in grams for this fashion item (item + light poly packaging; shoes include a lightweight box). Return one integer.\n` +
  `Item: ${p.display_title ?? ""} — ${p.title} (brand ${p.brand ?? "?"}, category ${p.category ?? "?"})\n\n` +
  `Reference points: light tee 200g; heavy/boxy tee 300g; shirt 300g; overshirt 450g; light knit 400g; heavy knit/cardigan 600g; hoodie/sweatshirt 600g; sweatpants 550g; jeans 750g; wool trousers 500g; light trousers 400g; shorts 300g; light jacket 700g; blazer 900g; wool coat 1400g; puffer 1100g; sneakers 1200g; loafers/mules 1000g; boots 1600g; slides 700g; small bag 500g; tote 800g; large leather bag 1300g; belt 250g; cap 150g; scarf 250g; sunglasses w/ case 300g; socks 100g. Adjust for the specific material (suede/leather heavier, linen/silk lighter).`;

let q = sb.from("products").select("id,code,brand,title,display_title,category,weight_g").order("created_at");
if (!ALL) q = q.is("weight_g", null);
const { data: rows, error } = await q;
if (error) { console.error(error.message); process.exit(1); }
const list = rows ?? [];
console.log(`${list.length} products${DRY ? " (dry)" : ""}, concurrency ${CONC}\n`);

let done = 0, failed = 0;
for (let i = 0; i < list.length; i += CONC) {
  await Promise.all(list.slice(i, i + CONC).map(async (p) => {
    try {
      const d = await gemini(PROMPT(p));
      const g = Math.round(Number(d.weight_g));
      if (!Number.isFinite(g) || g < 30 || g > 6000) throw new Error(`implausible ${d.weight_g}`);
      if (!DRY) {
        const { error: ue } = await sb.from("products").update({ weight_g: g }).eq("id", p.id);
        if (ue) throw new Error(ue.message);
      }
      done++;
      console.log(`[${p.code}] ${String(g).padStart(5)} g  ${(p.display_title ?? p.title).slice(0, 40)}`);
    } catch (e) { failed++; console.log(`[${p.code}] ERR ${e.message}`); }
  }));
}
console.log(`\ndone. ${done} written, ${failed} failed.${DRY ? " (dry)" : ""}`);
