// Find + transcribe a garment size chart into products.size_guide.
// Reads /tmp/sg-jobs.json = [{ id, code, urls:[imageUrl,...], referer? }].
// For each job: download the candidate images, ask Gemini to locate the size/
// measurement chart among them and transcribe it into the size_guide JSON the
// shop renders. Writes size_guide only when a real chart is found.
//
//   node scripts/transcribe-sizeguide.mjs          # transcribe + update
//   node scripts/transcribe-sizeguide.mjs --dry     # print, write nothing
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const KEY = process.env.GEMINI_API_KEY;
const DRY = process.argv.includes("--dry");
const JOBS = "/tmp/sg-jobs.json";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const NUM_ARR = { type: "ARRAY", items: { type: "NUMBER", nullable: true } };
const SCHEMA = {
  type: "OBJECT",
  properties: {
    found: { type: "BOOLEAN", description: "true only if one of the images is a garment size/measurement table (numbers per size)." },
    chart_index: { type: "INTEGER", description: "index of the size-chart image, or -1." },
    unit: { type: "STRING", enum: ["cm", "in"] },
    note: { type: "STRING" },
    sizes: { type: "ARRAY", items: { type: "STRING" } },
    measurements: {
      type: "OBJECT",
      properties: {
        length: NUM_ARR, chest: NUM_ARR, pit_to_pit: NUM_ARR, shoulder: NUM_ARR,
        sleeve: NUM_ARR, waist: NUM_ARR, hip: NUM_ARR, thigh: NUM_ARR,
        rise: NUM_ARR, outer_length: NUM_ARR,
      },
    },
  },
  required: ["found", "chart_index"],
};

function shrink(buf) {
  const b = path.join(os.tmpdir(), "sg-" + Math.random().toString(36).slice(2));
  try { fs.writeFileSync(b + ".in", buf); execFileSync("sips", ["-s", "format", "jpeg", "-Z", "1100", b + ".in", "--out", b + ".jpg"], { stdio: "ignore" }); return fs.readFileSync(b + ".jpg"); }
  catch { return buf; }
  finally { try { fs.unlinkSync(b + ".in"); } catch {} try { fs.unlinkSync(b + ".jpg"); } catch {} }
}
async function gemini(parts, tries = 4) {
  for (let t = 0; t < tries; t++) {
    const res = await fetch(`${ENDPOINT}?key=${KEY}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.1, maxOutputTokens: 2048, responseMimeType: "application/json", responseSchema: SCHEMA } }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) { const txt = j.candidates?.[0]?.content?.parts?.[0]?.text; if (txt) return JSON.parse(txt); }
    if (res.status === 429 || res.status >= 500) { await new Promise(r => setTimeout(r, 1500 * (t + 1))); continue; }
    throw new Error(`Gemini ${res.status}: ${j.error?.message || "?"}`);
  }
  throw new Error("retries exhausted");
}
const imgPart = (buf) => ({ inline_data: { mime_type: "image/jpeg", data: buf.toString("base64") } });

const jobs = JSON.parse(fs.readFileSync(JOBS, "utf8"));
console.log(`${jobs.length} jobs${DRY ? " (dry)" : ""}\n`);
let found = 0, none = 0, failed = 0;
for (const job of jobs) {
  try {
    const bufs = [];
    for (const u of job.urls) {
      const r = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0", Referer: job.referer || new URL(u).origin + "/" } });
      if (r.ok) bufs.push(shrink(Buffer.from(await r.arrayBuffer())));
    }
    if (!bufs.length) { failed++; console.log(`[${job.code}] no images fetched`); continue; }
    const parts = [
      { text: `${bufs.length} images from one garment listing. Find the SIZE/MEASUREMENT CHART (a table with numbers per size — length/chest/shoulder/sleeve/waist/etc). Transcribe it: arrays align 1:1 with sizes, null for missing cells, keep half-measures named (pit_to_pit, half_waist). If NONE is a real measurement table, set found=false.` },
      ...bufs.flatMap((b, i) => [{ text: `image ${i}:` }, imgPart(b)]),
    ];
    const d = await gemini(parts);
    if (!d.found) { none++; console.log(`[${job.code}] no chart`); continue; }
    const size_guide = { unit: d.unit || "cm", note: d.note || undefined, sizes: d.sizes || [], measurements: d.measurements || {} };
    Object.keys(size_guide.measurements).forEach(k => { if (!Array.isArray(size_guide.measurements[k]) || size_guide.measurements[k].every(v => v == null)) delete size_guide.measurements[k]; });
    if (!size_guide.sizes.length || !Object.keys(size_guide.measurements).length) { none++; console.log(`[${job.code}] chart flagged but empty — skip`); continue; }
    if (!DRY) { const { error } = await sb.from("products").update({ size_guide }).eq("id", job.id); if (error) { failed++; console.log(`[${job.code}] WRITE ERR ${error.message}`); continue; } }
    found++; console.log(`[${job.code}] ${size_guide.sizes.length} sizes: ${size_guide.sizes.join("/")} | ${Object.keys(size_guide.measurements).join(", ")}`);
  } catch (e) { failed++; console.log(`[${job.code}] ERR ${e.message}`); }
}
console.log(`\ndone. ${found} transcribed, ${none} no-chart, ${failed} failed.${DRY ? " (dry)" : ""}`);
