// Propose clean, human-readable product titles for machine-translated / SKU-prefixed
// listings. For each junk-titled active product, Gemini looks at the HERO image +
// brand + category + current title and writes a shop-quality title.
//
//   node scripts/propose-titles.mjs            # propose → /tmp/title-proposals.json + print table
//   node scripts/propose-titles.mjs --apply    # apply the saved proposals to the DB
//
// Two-phase on purpose: run once to review, then --apply (no second Gemini pass).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
const OUT = "/tmp/title-proposals.json";
const APPLY = process.argv.includes("--apply");

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const SCHEMA = {
  type: "OBJECT",
  properties: { title: { type: "STRING" }, reason: { type: "STRING" } },
  required: ["title"],
};

function shrink(buf) {
  const b = path.join(os.tmpdir(), "pt-" + Math.random().toString(36).slice(2));
  try { fs.writeFileSync(b + ".in", buf); execFileSync("sips", ["-s", "format", "jpeg", "-Z", "768", b + ".in", "--out", b + ".jpg"], { stdio: "ignore" }); return fs.readFileSync(b + ".jpg"); }
  catch { return buf; }
  finally { try { fs.unlinkSync(b + ".in"); } catch {} try { fs.unlinkSync(b + ".jpg"); } catch {} }
}

async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.3, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) { const txt = j.candidates?.[0]?.content?.parts?.[0]?.text; if (txt) return JSON.parse(txt); }
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (t + 1))); continue; }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (p) =>
  `You are titling a product for a curated quiet-luxury rep-fashion shop. Look at the product photo and write ONE clean, human-readable title.\n` +
  `Brand: ${p.brand}\nCategory: ${p.category}\nCurrent (messy, machine-translated) title: "${p.title}"\n\n` +
  `Rules:\n` +
  `- Start with the brand name (spelled out, e.g. "Bottega Veneta" not "BV").\n` +
  `- Describe the ACTUAL product from the photo: type + silhouette/shape + key material or finish + color if obvious.\n` +
  `- DROP scrape/SKU noise: codes like JSC3664, HZ0405, "Item Y00610", "ERD25SS", "SS25", "MM114", "style 251208"; and fluff like "wholesale / new arrival / genuine / high-end / same style as <celebrity>".\n` +
  `- Do NOT invent model names or numbers. Only keep an identifier if it is a real, well-known model line.\n` +
  `- <= 9 words, Title Case, no trailing period.\n` +
  `Return {title, reason}.`;

// PostgREST `or` can't express these regexes cleanly, so pull active products and
// filter with the same heuristic in JS.
const q = await sb.from("products").select("id,code,brand,category,title,image_urls,sold_out").eq("sold_out", false);
if (q.error) { console.error(q.error.message); process.exit(1); }
const junkRe = [/^[A-Z]{2,4}[0-9]{2,}/, /^item [A-Z0-9]/i, /^[0-9]{3,}/, /wholesale|no middleman|madman|new arrival/i, /(men|women)'?s (casual|jeans|shoes|shirt|sneaker)/i];
const list = (q.data || []).filter(p => (p.image_urls || []).length && junkRe.some(re => re.test(p.title || "")));

if (APPLY) {
  const proposals = JSON.parse(fs.readFileSync(OUT, "utf8"));
  let n = 0;
  for (const pr of proposals) {
    if (!pr.proposed || pr.proposed === pr.old) continue;
    const { error: ue } = await sb.from("products").update({ title: pr.proposed }).eq("id", pr.id);
    if (ue) { console.log(`ERR ${pr.code}: ${ue.message}`); continue; }
    n++; console.log(`[${pr.code}] ${pr.proposed}`);
  }
  console.log(`\napplied ${n} titles.`);
  process.exit(0);
}

console.log(`${list.length} junk-titled products to propose\n`);
const proposals = [];
for (const p of list) {
  try {
    const r = await fetch(p.image_urls[0]);
    if (!r.ok) throw new Error(`hero fetch ${r.status}`); // don't send an error page to Gemini as "the image"
    const buf = shrink(Buffer.from(await r.arrayBuffer()));
    const d = await gemini([{ text: PROMPT(p) }, { inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } }]);
    proposals.push({ id: p.id, code: p.code, brand: p.brand, old: p.title, proposed: d.title, reason: d.reason || "" });
    console.log(`[${p.code}] ${p.brand}\n   OLD: ${p.title}\n   NEW: ${d.title}\n`);
  } catch (e) { console.log(`[${p.code}] ERR ${e.message}`); }
}
fs.writeFileSync(OUT, JSON.stringify(proposals, null, 2));
console.log(`\nwrote ${proposals.length} proposals to ${OUT}. Review, then: node scripts/propose-titles.mjs --apply`);
