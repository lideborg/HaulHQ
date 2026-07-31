// Rewrite every product's display_title into the standard card format:
//   "[Material or defining detail] [Item] — [Color]"
// e.g. "Leather Belt — Tan", "Oil Wax Duffle Bag — Black", "Zev Wool Trousers — Grey".
// Looks at the hero image; the long title + current display_title are context.
// Colorway-split siblings keep their existing distinct color designation.
//
//   node scripts/retitle-format.mjs --dry --limit 15   # sample preview
//   node scripts/retitle-format.mjs                    # all products
//   node scripts/retitle-format.mjs --ids <id,id>      # specific rows
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
const LIMIT = process.argv.includes("--limit")
  ? Number(process.argv[process.argv.indexOf("--limit") + 1])
  : null;
const IDS = process.argv.includes("--ids")
  ? process.argv[process.argv.indexOf("--ids") + 1].split(",")
  : null;
const CONC = 6;

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const SCHEMA = {
  type: "OBJECT",
  properties: { display_title: { type: "STRING" } },
  required: ["display_title"],
};

function shrink(buf) {
  const b = path.join(os.tmpdir(), "rt-" + Math.random().toString(36).slice(2));
  try { fs.writeFileSync(b + ".in", buf); execFileSync("sips", ["-s", "format", "jpeg", "-Z", "640", b + ".in", "--out", b + ".jpg"], { stdio: "ignore" }); return fs.readFileSync(b + ".jpg"); }
  catch { return buf; }
  finally { try { fs.unlinkSync(b + ".in"); } catch {} try { fs.unlinkSync(b + ".jpg"); } catch {} }
}

async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    let res;
    try {
      res = await fetch(`${ENDPOINT}?key=${KEY}`, {
        method: "POST", headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(90000),
        body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, maxOutputTokens: 1024, responseMimeType: "application/json", responseSchema: SCHEMA } }),
      });
    } catch { await new Promise((r) => setTimeout(r, 1500 * (t + 1))); continue; }
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) {
      const txt = j.candidates?.[0]?.content?.parts?.[0]?.text;
      if (txt) { try { return JSON.parse(txt); } catch { continue; } }
    }
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (t + 1))); continue; }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}

const PROMPT = (p) =>
  `Rewrite this shop product's card title into EXACTLY this format:\n` +
  `[Material or defining detail] [Item] — [Color]\n\n` +
  `Context: long title "${p.title}", current card title "${p.display_title ?? ""}", brand ${p.brand ?? "?"}, category ${p.category ?? "?"}. Look at the photo.\n\n` +
  `Rules:\n` +
  `- Descriptor (0-2 words) ONLY when it defines the item: material (Leather, Suede, Wool, Silk, Ribbed Knit, Oil Wax, Raffia, Woven) or a defining detail (Distressed, Carpenter, Beaded Logo, GG-Stripe, Graphic). NEVER filler: no Classic, Soft Lux, Premium, Luxury, Vintage-style.\n` +
  `- Keep REAL model/line names as the descriptor when the product is known by them (Zev, Molino, Horsebit, Dunk Low, American's Cup).\n` +
  `- Item: a simple noun (Tee, Shirt, Overshirt, Polo, Hoodie, Sweatshirt, Sweater, Knit, Cardigan, Jacket, Coat, Blazer, Jeans, Trousers, Shorts, Sneakers, Loafers, Derby, Boots, Mules, Tote, Duffle Bag, Pouch, Bag, Sunglasses, Glasses, Belt, Cap, Scarf, Tie).\n` +
  `- Color: the " — <Color>" ending is REQUIRED (space, em dash, space). Title Case, natural name (Black, Faded Blue, Heather Grey, Cream, Black & White). Read it from the photo; when unsure, use the color word already in the current/long title. If the current card title already ends with "— <Color>", KEEP that exact color word (colorway variants must stay distinct). The ONLY case with no color ending is a true all-over multicolor print - almost never.\n` +
  `- NO brand name, NO SKU/style codes, NO sizes. Title Case throughout. 2-4 words before the dash.\n\n` +
  `Examples: "Leather Belt — Tan", "Ribbed Knit — White", "Baggy Jeans — Faded Blue", "Oil Wax Duffle Bag — Black", "Zev Wool Trousers — Grey", "GG-Stripe Polo — Black", "Molino Sunglasses — Black".`;

// Old titles are mostly "Color First Item" - recover a leading color phrase
// when the model forgets the " — Color" ending.
const COLOR_WORDS = new Set([
  "black","white","brown","grey","gray","navy","cream","beige","blue","green",
  "red","tan","olive","pink","purple","yellow","orange","silver","gold","khaki",
  "charcoal","ivory","burgundy","taupe","camel","indigo","heather","faded",
  "washed","light","dark","off-white","moss","sand","stone","ecru",
]);
function leadingColor(s) {
  if (!s) return null;
  const words = s.replace(/\s*[—–-]\s*/g, " ").split(/\s+/);
  const got = [];
  for (const w of words) {
    if (COLOR_WORDS.has(w.toLowerCase().replace(/[^a-z-]/g, ""))) got.push(w);
    else break;
  }
  return got.length ? got.join(" ") : null;
}
function trailingColor(s) {
  const m = s?.match(/—\s*([^—]+)$/);
  return m ? m[1].trim() : null;
}

let q = sb.from("products").select("id,code,brand,title,category,image_urls,display_title").order("created_at");
if (IDS) q = q.in("id", IDS);
const { data: rows, error } = await q;
if (error) { console.error(error.message); process.exit(1); }
let list = (rows ?? []).filter((p) => (p.image_urls ?? []).length > 0);
if (LIMIT) list = list.sort(() => Math.random() - 0.5).slice(0, LIMIT);
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
      // The model occasionally appends junk after a newline or leaks the
      // brand - keep the first line, strip the brand, drop dangling dashes.
      t = t.split("\n")[0].trim();
      if (p.brand) {
        const b = new RegExp(`\\b${p.brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        t = t.replace(b, "").replace(/\s{2,}/g, " ").trim();
      }
      t = t.replace(/\s*[-–—]\s*$/, "");
      if (!t) throw new Error("empty after sanitize");
      // Normalize the separator defensively (space-hyphen/en-dash -> em dash).
      // Requires a space before the dash so hyphenated compounds like
      // "Double-Pleated" are left alone.
      t = t.replace(/\s[-–]\s*(?=[A-Z][a-zA-Z& -]*$)/, " — ");
      // The color ending is mandatory: recover it from the old titles when
      // the model forgot, else ask once for just the dominant color.
      if (!t.includes(" — ")) {
        const color =
          trailingColor(p.display_title) ??
          leadingColor(p.display_title) ??
          leadingColor(p.title);
        if (color) {
          t = `${t} — ${color.replace(/\b\w/g, (c) => c.toUpperCase())}`;
        } else {
          const c = await gemini([
            { text: `Name ONLY the dominant color of this product, Title Case, 1-2 words (e.g. Black, Faded Blue, Heather Grey). Respond as {"display_title":"<color>"}.` },
            { inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } },
          ]).catch(() => null);
          const cc = String(c?.display_title ?? "").trim();
          if (cc && cc.length <= 20) t = `${t} — ${cc}`;
        }
      }
      if (!DRY) {
        const { error: ue } = await sb.from("products").update({ display_title: t }).eq("id", p.id);
        if (ue) throw new Error(ue.message);
      }
      done++;
      console.log(`[${p.code}] ${t.padEnd(38)} <- ${(p.display_title || "").slice(0, 40)}`);
    } catch (e) { failed++; console.log(`[${p.code}] ERR ${e.message}`); }
  }));
}
console.log(`\ndone. ${done} written, ${failed} failed.${DRY ? " (dry)" : ""}`);
