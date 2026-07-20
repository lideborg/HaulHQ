import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg", jpg: "image/jpeg" };

export async function uploadProductImages(sb, env, productId, absFilePaths) {
  // Guard the orphan sweep below: an empty batch must be a no-op, not a
  // "delete every stored image for this product".
  if (!absFilePaths.length) return [];
  const urls = [];
  const kept = new Set();
  for (let i = 0; i < absFilePaths.length; i++) {
    const fp = absFilePaths[i];
    const ext = (fp.split(".").pop() || "jpg").toLowerCase();
    const key = `products/${productId}/${String(i).padStart(3, "0")}.${ext}`;
    const { error } = await sb.storage
      .from("product-images")
      .upload(key, readFileSync(fp), { contentType: MIME[ext] || "image/jpeg", upsert: true });
    if (error) throw new Error(`upload ${key}: ${error.message}`);
    kept.add(key);
    urls.push(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`);
  }
  // Index-keyed uploads leave orphans when the new set is smaller (old 005.jpg
  // survives a 3-image re-upload) — remove anything not in this batch.
  const { data: listed } = await sb.storage.from("product-images").list(`products/${productId}`);
  const orphans = (listed ?? [])
    .map((f) => `products/${productId}/${f.name}`)
    .filter((key) => !kept.has(key));
  if (orphans.length) {
    const { error } = await sb.storage.from("product-images").remove(orphans);
    if (error) console.error(`orphan cleanup failed (non-fatal): ${error.message}`);
  }
  return urls;
}
