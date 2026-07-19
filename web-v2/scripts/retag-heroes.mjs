// Re-tag every product's ALREADY-HOSTED images with Gemini: classify each image
// (flat_lay/front/worn/detail/size_chart/logo_text/other), pick the best hero
// (flat-lay > clean front > worn), reorder image_urls hero-first with non-photos
// demoted to the end, and persist the tags in products.image_meta. No scraping,
// no uploads, no deletions — pure reorder + tag over images we already store.
//
// Usage (run from web-v2/):
//   GEMINI_API_KEY=... node scripts/retag-heroes.mjs [--dry] [--multi] [--limit N] [--ids a,b,c]
//     --dry     classify + print, write nothing
//     --multi   only products with >=2 images (where reordering matters)
//     --limit N cap the number of products processed
//     --ids ..  comma-separated product ids (overrides other filters)
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

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const CONC = 8;

const A = process.argv.slice(2);
const DRY = A.includes("--dry");
const MULTI = A.includes("--multi");
const LIMIT = A.includes("--limit") ? +A[A.indexOf("--limit") + 1] : null;
const IDS = A.includes("--ids") ? A[A.indexOf("--ids") + 1].split(",") : null;

// hero preference + gallery ordering: lower = earlier
const KIND_RANK = { flat_lay: 0, front: 1, worn: 2, detail: 3, other: 4, size_chart: 5, logo_text: 6 };

const SCHEMA = {
  type: "OBJECT",
  properties: {
    hero_index: {
      type: "INTEGER",
      description:
        "Index of the SINGLE best hero image for a shop thumbnail: a clean, front-facing shot of the product itself. Prefer a flat-lay / ghost-mannequin / product-only shot on a plain background; else the clearest front-facing worn shot. NEVER a size chart, logo/text page, or tight detail crop.",
    },
    images: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          kind: {
            type: "STRING",
            enum: ["flat_lay", "front", "worn", "detail", "size_chart", "logo_text", "other"],
            description:
              "flat_lay = product laid flat / ghost mannequin on plain bg; front = clean front-facing product or worn front shot; worn = model/lifestyle shot; detail = close-up crop of fabric/hardware; size_chart = measurement table; logo_text = brand logo or text/policy page; other = anything else.",
          },
        },
        required: ["index", "kind"],
      },
    },
  },
  required: ["hero_index", "images"],
};

function mediaType(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return "image/jpeg";
}
function shrink(buf) {
  const base = path.join(os.tmpdir(), "rt-" + Math.random().toString(36).slice(2));
  const inF = base + ".in", outF = base + ".jpg";
  try {
    fs.writeFileSync(inF, buf);
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", "768", inF, "--out", outF], { stdio: "ignore" });
    return fs.readFileSync(outF);
  } catch { return buf; }
  finally { try { fs.unlinkSync(inF); } catch {} try { fs.unlinkSync(outF); } catch {} }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000, responseMimeType: "application/json", responseSchema: SCHEMA },
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && !json.error) {
      const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text);
    }
    if (res.status === 429 || res.status === 503 || res.status >= 500) { await sleep(1500 * (t + 1)); continue; }
    throw new Error(`Gemini ${res.status}: ${json.error?.message || "?"}`);
  }
  throw new Error("Gemini: retries exhausted");
}

const imgPart = (buf) => ({ inline_data: { mime_type: mediaType(buf), data: buf.toString("base64") } });

async function processProduct(p) {
  const urls = p.image_urls || [];
  if (!urls.length) return { id: p.id, skip: "no-images" };

  const bufs = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0" } });
      bufs.push(r.ok ? shrink(Buffer.from(await r.arrayBuffer())) : null);
    } catch { bufs.push(null); }
  }
  const usable = bufs.map((b, i) => (b ? i : -1)).filter((i) => i >= 0);
  if (!usable.length) return { id: p.id, skip: "unfetchable" };

  const parts = [
    { text: `Product: ${p.brand || ""} ${p.title || ""} (${p.category || "?"}). ${usable.length} images, index 0..${usable.length - 1}. Classify each and pick the best hero thumbnail.` },
    ...usable.flatMap((i, n) => [{ text: `image ${n}:` }, imgPart(bufs[i])]),
  ];
  const cls = await gemini(parts);

  // map compact indices (n) back to original url indices
  const kindByOrig = {};
  for (const r of cls.images || []) {
    const orig = usable[r.index];
    if (orig != null) kindByOrig[orig] = r.kind;
  }
  const heroOrig = usable[cls.hero_index] ?? usable[0];

  // new order: hero first, then remaining by kind rank (stable on original order)
  const rest = urls.map((_, i) => i).filter((i) => i !== heroOrig);
  rest.sort((a, b) => (KIND_RANK[kindByOrig[a]] ?? 4) - (KIND_RANK[kindByOrig[b]] ?? 4) || a - b);
  const order = [heroOrig, ...rest];

  const new_urls = order.map((i) => urls[i]);
  const image_meta = order.map((i) => ({ url: urls[i], kind: kindByOrig[i] || "other", hero: i === heroOrig }));
  const changed = new_urls[0] !== urls[0];
  return { id: p.id, title: p.title, changed, heroKind: kindByOrig[heroOrig] || "other", n: urls.length, new_urls, image_meta };
}

async function main() {
  let q = sb.from("products").select("id,brand,title,category,image_urls").order("created_at", { ascending: true });
  if (IDS) q = q.in("id", IDS);
  const { data: products, error } = await q;
  if (error) { console.error(error.message); process.exit(1); }

  let list = products.filter((p) => (p.image_urls || []).length >= (MULTI ? 2 : 1));
  if (LIMIT) list = list.slice(0, LIMIT);
  console.log(`${list.length} products to process${DRY ? " (dry)" : ""}, concurrency ${CONC}\n`);

  let done = 0, changed = 0, failed = 0;
  for (let i = 0; i < list.length; i += CONC) {
    const batch = list.slice(i, i + CONC);
    const results = await Promise.all(batch.map((p) => processProduct(p).catch((e) => ({ id: p.id, err: e.message }))));
    for (const r of results) {
      done++;
      if (r.err) { failed++; console.log(`  ERR  ${r.id.slice(0, 8)} ${r.err}`); continue; }
      if (r.skip) { console.log(`  skip ${r.id.slice(0, 8)} ${r.skip}`); continue; }
      if (!DRY) {
        const { error: ue } = await sb.from("products").update({ image_urls: r.new_urls, image_meta: r.image_meta }).eq("id", r.id);
        if (ue) { failed++; console.log(`  WRITE-ERR ${r.id.slice(0, 8)} ${ue.message}`); continue; }
      }
      if (r.changed) changed++;
      console.log(`  ${r.changed ? "MOVED" : "ok   "} hero=${r.heroKind.padEnd(10)} n=${r.n}  ${(r.title || "").slice(0, 46)}`);
    }
    console.log(`  -- ${done}/${list.length} (${changed} hero moved, ${failed} failed) --`);
  }
  console.log(`\ndone. ${done} processed, ${changed} heroes reordered, ${failed} failed.${DRY ? " (dry run — nothing written)" : ""}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
