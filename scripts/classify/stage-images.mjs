// Temp: download up to 4 images per product (by id) for the vision classification pass.
// Reads /tmp/haul-classify-products.json, writes /tmp/haul-classify/<id>/NNN.jpg,
// plus manifest.json and batch-00..09.json.
import fs from "node:fs";
import path from "node:path";

const ROOT = "/tmp/haul-classify";
const MAX_IMGS = 4;
const BATCHES = 10;

const products = JSON.parse(fs.readFileSync("/tmp/haul-classify-products.json", "utf8"));
fs.mkdirSync(ROOT, { recursive: true });
fs.mkdirSync(path.join(ROOT, "out"), { recursive: true });

async function dl(url, dest) {
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false; // skip tiny/placeholder
    fs.writeFileSync(dest, buf);
    return true;
  } catch {
    return false;
  }
}

const manifest = [];
let done = 0;
// modest concurrency
const queue = [...products];
async function worker() {
  while (queue.length) {
    const p = queue.shift();
    const dir = path.join(ROOT, p.id);
    fs.mkdirSync(dir, { recursive: true });
    const urls = (p.image_urls || []).slice(0, MAX_IMGS);
    const local = [];
    for (let i = 0; i < urls.length; i++) {
      const dest = path.join(dir, String(i).padStart(3, "0") + ".jpg");
      if (await dl(urls[i], dest)) local.push(dest);
    }
    manifest.push({
      id: p.id,
      brand: p.brand,
      title: p.title,
      coarse: p.coarse,
      images: local,
    });
    if (++done % 25 === 0) console.log(`  ${done}/${products.length}`);
  }
}
await Promise.all(Array.from({ length: 8 }, worker));

// stable order for reproducible batches
manifest.sort((a, b) => a.id.localeCompare(b.id));
fs.writeFileSync(path.join(ROOT, "manifest.json"), JSON.stringify(manifest, null, 2));

// round-robin into BATCHES so each agent gets a mix of coarse types
const batches = Array.from({ length: BATCHES }, () => []);
manifest.forEach((m, i) => batches[i % BATCHES].push(m));
batches.forEach((b, i) =>
  fs.writeFileSync(
    path.join(ROOT, `batch-${String(i).padStart(2, "0")}.json`),
    JSON.stringify(b, null, 2),
  ),
);

const noImg = manifest.filter((m) => m.images.length === 0).length;
console.log(
  `staged ${manifest.length} products, ${noImg} with no downloadable image, into ${BATCHES} batches`,
);
