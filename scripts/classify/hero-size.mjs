// Gemini image classifier for the shop import pipeline.
//
// Given one product's candidate image URLs (seller-filtered, from the buy page),
// asks Gemini 2.5 Flash — in ONE vision call — to classify every image
// (display / detail / size_chart / flat_lay / trash), pick the single best
// front-facing HERO, and flag the size-chart image. A second call transcribes
// that size chart into the structured `size_guide` JSON the shop expects.
//
// Uses the Google AI Studio REST API (generativelanguage.googleapis.com) — same
// endpoint the setset repos use — with GEMINI_API_KEY. gemini-2.5-flash is on a
// free tier, so low-volume classification is effectively $0. Zero npm deps.
//
// Usage:
//   GEMINI_API_KEY=... node scripts/classify/hero-size.mjs <in.json> [out.json] [stageDir]
//
// <in.json>  = { "id": "...", "title": "...", "brand": "...", "images": ["<url>", ...] }
// out.json   = { hero_index, keep_indexes (hero first), trash_indexes, size_guide, images:[...] }
// stageDir   = optional; kept images copied there as 000.jpg,001.jpg,... (hero first).

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const KEY = process.env.GEMINI_API_KEY;
const MAX_IMAGES = 30;
const MIN_BYTES = 15000;

if (!KEY) {
  console.error("ERROR: set GEMINI_API_KEY in the environment.");
  process.exit(1);
}
const inPath = process.argv[2];
const outPath = process.argv[3] || (inPath ? inPath.replace(/\.json$/, "") + ".out.json" : null);
const stageDir = process.argv[4] || null;
if (!inPath) {
  console.error("usage: node hero-size.mjs <in.json> [out.json] [stageDir]");
  process.exit(1);
}

const product = JSON.parse(fs.readFileSync(inPath, "utf8"));
const urls = (product.images || []).slice(0, MAX_IMAGES);

function mediaType(buf, url) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf.slice(8, 12).toString() === "WEBP") return "image/webp";
  return /\.png(\?|$)/i.test(url) ? "image/png" : "image/jpeg";
}

// Downscale to a max dimension with macOS `sips` (zero-dep). Returns a smaller
// JPEG for the multi-image classify call; falls back to the original on failure.
function shrink(buf, maxDim) {
  const base = path.join(os.tmpdir(), "cls-" + Math.random().toString(36).slice(2));
  const inF = base + ".in";
  const outF = base + ".jpg";
  try {
    fs.writeFileSync(inF, buf);
    execFileSync("sips", ["-s", "format", "jpeg", "-Z", String(maxDim), inF, "--out", outF], { stdio: "ignore" });
    return { buf: fs.readFileSync(outF), media_type: "image/jpeg" };
  } catch {
    return { buf, media_type: mediaType(buf, "") };
  } finally {
    try { fs.unlinkSync(inF); } catch {}
    try { fs.unlinkSync(outF); } catch {}
  }
}

async function fetchImages() {
  const kept = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0", Referer: product.referer || new URL(url).origin + "/" },
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < MIN_BYTES) continue; // placeholder / tracking pixel
      const mt = mediaType(buf, url);
      if (mt === "image/gif") continue;
      const sm = shrink(buf, 1024); // small copy so the multi-image call stays under the inline limit
      kept.push({ url, buf, media_type: mt, small: sm.buf, small_mt: sm.media_type });
    } catch {
      /* skip unreachable */
    }
  }
  return kept;
}

const imgPart = (buf, mt) => ({ inline_data: { mime_type: mt, data: buf.toString("base64") } });

async function gemini(parts, schema, maxTokens = 4000) {
  const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: maxTokens,
        responseMimeType: "application/json",
        responseSchema: schema,
      },
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(`Gemini ${res.status}: ${json.error?.message || JSON.stringify(json).slice(0, 300)}`);
  }
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("no text in response: " + JSON.stringify(json).slice(0, 400));
  return { data: JSON.parse(text), usage: json.usageMetadata };
}

// Gemini responseSchema uses uppercase OpenAPI-style types.
const CLASSIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    hero_index: {
      type: "INTEGER",
      description:
        "Index of the SINGLE best display image: a clean, front-facing shot of the product itself (prefer a flat/ghost product shot on a plain background; else the clearest front-facing worn shot). Never a size chart, detail crop, or text page.",
    },
    size_chart_index: {
      type: "INTEGER",
      description: "Index of the image that is a measurements/size table (numbers for length/chest/shoulder/sleeve/etc). Use -1 if there is no size chart.",
    },
    images: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          category: { type: "STRING", enum: ["display", "detail", "size_chart", "flat_lay", "trash"] },
          keep: {
            type: "BOOLEAN",
            description:
              "true for real product photos worth showing (display/flat_lay/good detail). false for size charts, text/policy pages, logos, unrelated/other-product images, blurry junk.",
          },
          reason: { type: "STRING" },
        },
        required: ["index", "category", "keep", "reason"],
      },
    },
  },
  required: ["hero_index", "size_chart_index", "images"],
};

const NUM_ARR = { type: "ARRAY", items: { type: "NUMBER", nullable: true } };
const SIZE_GUIDE_SCHEMA = {
  type: "OBJECT",
  properties: {
    unit: { type: "STRING", enum: ["cm", "in"] },
    note: { type: "STRING" },
    sizes: { type: "ARRAY", items: { type: "STRING" } },
    measurements: {
      type: "OBJECT",
      properties: {
        length: NUM_ARR,
        chest: NUM_ARR,
        pit_to_pit: NUM_ARR,
        shoulder: NUM_ARR,
        sleeve: NUM_ARR,
        waist: NUM_ARR,
        hip: NUM_ARR,
        thigh: NUM_ARR,
        outer_length: NUM_ARR,
      },
    },
  },
  required: ["unit", "sizes", "measurements"],
};

async function main() {
  const imgs = await fetchImages();
  if (!imgs.length) {
    console.error("no usable images downloaded");
    fs.writeFileSync(outPath, JSON.stringify({ hero_index: -1, keep_indexes: [], trash_indexes: [], size_guide: null, images: [] }, null, 2));
    return;
  }

  // ---- Pass 1: classify all images in one call ----
  const parts = [
    {
      text:
        `Product: ${product.brand || ""} ${product.title || ""}\n` +
        `You are given ${imgs.length} scraped images (index 0..${imgs.length - 1}, in order). ` +
        `Classify each, choose the single best HERO display image, and flag the size chart. ` +
        `Junk to drop (keep=false): size charts, Chinese policy/care/notice text pages, brand logos, ` +
        `tracking pixels, and any image that is clearly a DIFFERENT product (recommendations).`,
    },
    ...imgs.flatMap((im, i) => [{ text: `image ${i}:` }, imgPart(im.small, im.small_mt)]),
  ];
  const { data: cls, usage: u1 } = await gemini(parts, CLASSIFY_SCHEMA, 5000);

  // ---- Pass 2: transcribe the size chart, if any ----
  let size_guide = null;
  let u2 = null;
  const sc = cls.size_chart_index;
  if (Number.isInteger(sc) && sc >= 0 && imgs[sc]) {
    try {
      const r = await gemini(
        [
          {
            text:
              "This is a garment size chart. Transcribe it into JSON. Include only measurement rows present in the table. " +
              "Keep half-measurements named as-is (pit_to_pit, half_waist). Arrays align 1:1 with `sizes`. Use null for a missing cell.",
          },
          imgPart(imgs[sc].buf, imgs[sc].media_type),
        ],
        SIZE_GUIDE_SCHEMA,
        2048,
      );
      size_guide = r.data;
      u2 = r.usage;
    } catch (e) {
      console.error("size-guide pass failed:", e.message);
    }
  }

  // ---- Assemble output ----
  const keep = (cls.images || []).filter((r) => r.keep && r.index !== cls.hero_index).map((r) => r.index);
  const keep_indexes = [cls.hero_index, ...keep].filter((i) => Number.isInteger(i) && imgs[i]);
  const trash_indexes = (cls.images || []).filter((r) => !r.keep).map((r) => r.index);

  const out = {
    id: product.id,
    hero_index: cls.hero_index,
    keep_indexes,
    trash_indexes,
    size_chart_index: sc,
    size_guide,
    kept_urls: keep_indexes.map((i) => imgs[i].url),
    images: cls.images,
    usage: { classify: u1, size_guide: u2 },
  };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));

  if (stageDir) {
    fs.mkdirSync(stageDir, { recursive: true });
    keep_indexes.forEach((idx, n) => {
      const ext = imgs[idx].media_type === "image/png" ? "png" : "jpg";
      fs.writeFileSync(path.join(stageDir, String(n).padStart(3, "0") + "." + ext), imgs[idx].buf);
    });
  }

  console.log(
    `hero=${cls.hero_index} keep=${keep_indexes.length}/${imgs.length} ` +
      `size_chart=${sc >= 0 ? "yes" : "none"} size_guide=${size_guide ? "read" : "null"} -> ${outPath}`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
