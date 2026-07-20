// Generate short card-facing names for products: "[Color] [Material?] [Garment]",
// <= 4 words ("White Tee", "Heather Grey Hoodie", "Black Leather Tote").
// Looks at the hero image + the saved long title; writes products.display_title.
// The long `title` is untouched — it stays as the saved description.
//
//   node scripts/propose-display-titles.mjs            # all products missing one
//   node scripts/propose-display-titles.mjs --all      # regenerate every product
//   node scripts/propose-display-titles.mjs --dry      # print only
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
if (!KEY) { console.error("set GEMINI_API_KEY"); process.exit(1); }
const DRY = process.argv.includes("--dry");
const ALL = process.argv.includes("--all");
const CONC = 6;

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SCHEMA = {
  type: "OBJECT",
  properties: { display_title: { type: "STRING" } },
  required: ["display_title"],
};

function shrink(buf) {
  const b = path.join(os.tmpdir(), "dt-" + Math.random().toString(36).slice(2));
  try { fs.writeFileSync(b + ".in", buf); execFileSync("sips", ["-s", "format", "jpeg", "-Z", "640", b + ".in", "--out", b + ".jpg"], { stdio: "ignore" }); return fs.readFileSync(b + ".jpg"); }
  catch { return buf; }
  finally { try { fs.unlinkSync(b + ".in"); } catch {} try { fs.unlinkSync(b + ".jpg"); } catch {} }
}
async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) { const txt = j.candidates?.[0]?.content?.parts?.[0]?.text; if (txt) return JSON.parse(txt); }
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (t + 1))); continue; }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (p) =>
  `Write the short card-facing name for this shop product. Look at the photo; the long title is context: "${p.title}" (brand ${p.brand ?? "?"}, category ${p.category ?? "?"}).\n\n` +
  `Format: [Color] [Material-or-Detail]? [Garment] — MAXIMUM 4 words, Title Case.\n` +
  `- Color first (1-2 words): "White", "Heather Grey", "Grey & Black" ("&" not counted).\n` +
  `- Material/detail ONLY when it defines the item: Knit, Suede, Leather, Raffia, Striped, Paint-Splatter, Distressed. Never redundant ones (no "Denim Jeans").\n` +
  `- Simple garment noun: Tee, Shirt, Overshirt, Polo, Hoodie, Sweatshirt, Sweater, Cardigan, Jacket, Coat, Blazer, Jeans, Trousers, Shorts, Sneakers, Loafers, Boots, Mules, Sandals, Tote, Bag, Sunglasses, Glasses, Belt, Cap, Scarf, Gloves.\n` +
  `- NO brand name, NO SKU/model codes, NO sizes.\n` +
  `Examples: "White Tee", "Blue Jeans", "Heather Grey Hoodie", "Brown Knit Shirt", "Black Leather Tote", "Green Sunglasses".`;

let q = sb.from("products").select("id,code,brand,title,category,image_urls,display_title").order("created_at");
if (!ALL) q = q.is("display_title", null);
const { data: rows, error } = await q;
if (error) { console.error(error.message); process.exit(1); }
const list = (rows ?? []).filter((p) => (p.image_urls ?? []).length > 0);
console.log(`${list.length} products${DRY ? " (dry)" : ""}, concurrency ${CONC}\n`);

let done = 0, failed = 0;
for (let i = 0; i < list.length; i += CONC) {
  const batch = list.slice(i, i + CONC);
  await Promise.all(batch.map(async (p) => {
    try {
      const r = await fetch(p.image_urls[0]);
      if (!r.ok) throw new Error(`hero fetch ${r.status}`);
      const buf = shrink(Buffer.from(await r.arrayBuffer()));
      const d = await gemini([
        { text: PROMPT(p) },
        { inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } },
      ]);
      let t = String(d.display_title ?? "").trim();
      if (!t) throw new Error("empty");
      // enforce the cap defensively ("&" doesn't count as a word)
      const words = t.split(/\s+/).filter((w) => w !== "&");
      if (words.length > 4) t = t.split(/\s+/).slice(0, 4).join(" ");
      if (!DRY) {
        const { error: ue } = await sb.from("products").update({ display_title: t }).eq("id", p.id);
        if (ue) throw new Error(ue.message);
      }
      done++;
      console.log(`[${p.code}] ${t.padEnd(30)} <- ${(p.title || "").slice(0, 50)}`);
    } catch (e) { failed++; console.log(`[${p.code}] ERR ${e.message}`); }
  }));
}
console.log(`\ndone. ${done} written, ${failed} failed.${DRY ? " (dry)" : ""}`);
