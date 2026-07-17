import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

export function adminClient(env) {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const MIME = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg", jpg: "image/jpeg" };

export async function uploadProductImages(sb, env, productId, absFilePaths) {
  const urls = [];
  for (let i = 0; i < absFilePaths.length; i++) {
    const fp = absFilePaths[i];
    const ext = (fp.split(".").pop() || "jpg").toLowerCase();
    const key = `products/${productId}/${String(i).padStart(3, "0")}.${ext}`;
    const { error } = await sb.storage
      .from("product-images")
      .upload(key, readFileSync(fp), { contentType: MIME[ext] || "image/jpeg", upsert: true });
    if (error) throw new Error(`upload ${key}: ${error.message}`);
    urls.push(`${env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`);
  }
  return urls;
}
