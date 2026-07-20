// Upload a directory of images to a product's storage folder and point the
// product at them. Usage (from web-v2/):
//   node scripts/upload-product-images.mjs <productId> <absoluteDir>
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";

const [productId, dir] = process.argv.slice(2);
if (!productId || !dir) {
  console.error("usage: node scripts/upload-product-images.mjs <productId> <dir>");
  process.exit(1);
}
const env = loadEnv(".env.local");
const sb = adminClient(env);
const files = readdirSync(dir)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort()
  .map((f) => join(dir, f));
if (!files.length) {
  console.error("no images in " + dir);
  process.exit(1);
}
const urls = await uploadProductImages(sb, env, productId, files);
// image_meta is aligned 1:1 with image_urls — null it so a retag repopulates.
const { error } = await sb.from("products").update({ image_urls: urls, image_meta: null }).eq("id", productId);
if (error) throw error;
console.log(JSON.stringify(urls, null, 2));
console.log(`(image_meta cleared — retag with: node scripts/retag-heroes.mjs --ids ${productId})`);
