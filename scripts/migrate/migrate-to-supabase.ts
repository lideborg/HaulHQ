// One-shot migration: read every Phase-1 JSON + local image file, insert
// rows into Supabase Postgres + upload images to the catalog-images bucket.
//
// Idempotent — uses upserts so re-running won't duplicate rows or images.
//
// Run from repo root:
//   cd scripts/migrate && npm install && npm run migrate
//
// Reads creds from web-next/.env.local (uses the SERVICE_ROLE key — server
// privileges needed to bypass RLS and write to storage).

import { createClient } from "@supabase/supabase-js";
import { config as dotenvConfig } from "dotenv";
import { promises as fs } from "node:fs";
import * as path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");
dotenvConfig({ path: path.join(REPO_ROOT, "web-next", ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in web-next/.env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

// ---------- helpers ----------

async function readJSON<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, "utf8")) as T;
}

function priceCny(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

function priceUsd(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const m = String(raw).match(/\$\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// ---------- sellers ----------

interface SellerJSON {
  name: string;
  yupoo?: string;
  yupoo_password?: string;
  contact?: Record<string, unknown>;
  specialty?: string;
  verdict?: string;
  notes?: string;
  reachable?: string | null;
}

async function migrateSellers() {
  const file = path.join(REPO_ROOT, "data", "notes", "sellers.json");
  const data = await readJSON<{ sellers: SellerJSON[] }>(file);
  console.log(`\n[sellers] importing ${data.sellers.length} rows`);

  const rows = data.sellers.map((s) => ({
    name: s.name,
    yupoo: s.yupoo ?? null,
    yupoo_password: s.yupoo_password ?? null,
    specialty: s.specialty ?? null,
    verdict: (["trusted", "use-via-agent", "avoid", "unknown"].includes(s.verdict ?? "")
      ? s.verdict
      : "unknown") as "trusted" | "use-via-agent" | "avoid" | "unknown",
    contact: s.contact ?? {},
    notes: s.notes ?? null,
    reachable: s.reachable ?? null,
  }));

  const { error } = await supabase.from("sellers").upsert(rows, { onConflict: "name" });
  if (error) throw error;
  console.log(`[sellers] ✓ upserted ${rows.length}`);
}

// ---------- items + images ----------

type ItemJSON = Record<string, unknown> & {
  user_label: string;
  url?: string | null;
  source_url?: string | null;
  title?: string | null;
  title_translated?: string | null;
  description?: string | null;
  brand?: string | null;
  category?: string | null;
  item_code?: string | null;
  model_code?: string | null;
  source?: string | null;
  seller?: string | null;
  price?: string | null;
  price_usd?: string | null;
  sizing?: string | null;
  size_chart?: unknown;
  variants?: string[];
  target_size?: string | null;
  target_variant?: string | null;
  preferred_size?: string | null;
  local_image_paths?: string[];
  local_detail_image_paths?: string[];
  owners?: string[];
  out_of_stock?: boolean;
  skipped?: boolean;
  skipped_reason?: string | null;
  locked?: boolean;
  requires_contact?: boolean;
  acquisition?: string | null;
  notes?: string | null;
  params?: Record<string, unknown>;
  quoted_by?: string | null;
  quoted_on?: string | null;
};

const VALID_SOURCE = new Set(["yupoo", "superbuy", "weidian", "taobao", "1688"]);
const VALID_CATEGORY = new Set([
  "apparel-top",
  "apparel-bottom",
  "eyewear",
  "bag",
  "shoes",
  "accessory",
]);
const VALID_ACQUISITION = new Set(["superbuy", "contact-seller"]);

async function readSellerIdByName(): Promise<Map<string, string>> {
  const { data, error } = await supabase.from("sellers").select("id, name");
  if (error) throw error;
  return new Map(data!.map((r) => [r.name, r.id as string]));
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function uploadImage(
  localPath: string,
  storagePath: string
): Promise<{ size: number } | null> {
  let buf: Buffer;
  try {
    buf = await fs.readFile(localPath);
  } catch {
    return null; // file missing — skip silently, FK will be left null
  }
  const contentType = localPath.endsWith(".png") ? "image/png" : "image/jpeg";
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { error } = await supabase.storage
      .from("catalog-images")
      .upload(storagePath, buf, { contentType, upsert: true });
    if (!error) return { size: buf.length };
    const isTransient =
      // @ts-expect-error supabase storage error has statusCode
      error.statusCode === 429 || error.statusCode === 503 || error.statusCode === 502;
    if (!isTransient || attempt === MAX_ATTEMPTS) {
      console.error(`    upload ${storagePath} failed after ${attempt} attempts: ${error.message}`);
      return null;
    }
    const backoff = 500 * Math.pow(2, attempt - 1); // 0.5s, 1s, 2s, 4s
    process.stdout.write(`    transient ${error.message}, retry in ${backoff}ms…\n`);
    await sleep(backoff);
  }
  return null;
}

async function migrateOneSource(sourceDir: "yupoo" | "superbuy") {
  const dir = path.join(REPO_ROOT, "data", sourceDir);
  const indexPath = path.join(dir, "_index.json");
  const idx = await readJSON<{ entries: { file: string }[] }>(indexPath);
  console.log(`\n[items/${sourceDir}] importing ${idx.entries.length} rows`);

  const sellerMap = await readSellerIdByName();

  for (const entry of idx.entries) {
    const slug = entry.file.replace(/\.json$/, "");
    let item: ItemJSON;
    try {
      item = await readJSON<ItemJSON>(path.join(dir, entry.file));
    } catch (e) {
      console.error(`  [${slug}] read failed:`, (e as Error).message);
      continue;
    }
    try {
      await migrateOneItem(sourceDir, dir, slug, item, sellerMap);
    } catch (e) {
      console.error(`  [${slug}] migration aborted:`, (e as Error).message);
      // Continue with the next item — don't kill the whole run.
    }
  }
}

async function migrateOneItem(
  sourceDir: "yupoo" | "superbuy",
  dir: string,
  slug: string,
  item: ItemJSON,
  sellerMap: Map<string, string>
) {
    const source = VALID_SOURCE.has(item.source ?? "") ? item.source : sourceDir;
    const category = VALID_CATEGORY.has(item.category ?? "") ? item.category : null;
    const acquisition = VALID_ACQUISITION.has(item.acquisition ?? "")
      ? item.acquisition
      : null;
    const owners = (item.owners ?? []).filter((o): o is "hampus" | "jan" =>
      o === "hampus" || o === "jan"
    );

    // Insert/upsert the item first (without hero_image_id)
    const itemRow = {
      slug,
      source,
      user_label: item.user_label,
      title: item.title ?? null,
      title_translated: item.title_translated ?? null,
      description: item.description ?? null,
      brand: item.brand ?? null,
      category,
      item_code: item.item_code ?? null,
      model_code: item.model_code ?? null,
      url: item.url ?? null,
      source_url: item.source_url ?? null,
      seller_name: item.seller ?? null,
      seller_id: item.seller ? sellerMap.get(item.seller) ?? null : null,
      price: item.price ?? null,
      price_cny: priceCny(item.price),
      price_usd: priceUsd(item.price_usd ?? null),
      quoted_by: item.quoted_by ?? null,
      quoted_on: item.quoted_on ?? null,
      sizing: item.sizing ?? null,
      size_chart: item.size_chart ?? null,
      variants: item.variants ?? [],
      target_size: item.target_size ?? null,
      target_variant: item.target_variant ?? null,
      preferred_size: item.preferred_size ?? null,
      owners,
      out_of_stock: item.out_of_stock ?? false,
      skipped: item.skipped ?? false,
      skipped_reason: item.skipped_reason ?? null,
      locked: item.locked ?? false,
      requires_contact: item.requires_contact ?? false,
      acquisition,
      notes: item.notes ?? null,
      params: item.params ?? {},
    };
    const { data: itemData, error: itemErr } = await supabase
      .from("items")
      .upsert(itemRow, { onConflict: "slug,source" })
      .select("id")
      .single();
    if (itemErr) {
      console.error(`  [${slug}] item upsert failed:`, itemErr.message);
      return;
    }
    const itemId = itemData.id as string;

    // Upload images: gallery + detail
    const galleryPaths = item.local_image_paths ?? [];
    const detailPaths = item.local_detail_image_paths ?? [];
    const imageIds: string[] = [];
    let heroImageId: string | null = null;

    for (let i = 0; i < galleryPaths.length; i++) {
      const local = path.join(dir, galleryPaths[i]);
      const storagePath = `${sourceDir}/${slug}/g${String(i).padStart(3, "0")}${path.extname(local) || ".jpg"}`;
      const upload = await uploadImage(local, storagePath);
      if (!upload) continue;
      const { data: img, error: imgErr } = await supabase
        .from("images")
        .upsert(
          {
            item_id: itemId,
            path: storagePath,
            ordinal: i,
            kind: "gallery",
            bytes: upload.size,
          },
          { onConflict: "item_id,kind,ordinal" }
        )
        .select("id")
        .single();
      if (imgErr) {
        console.error(`  [${slug}] image insert failed:`, imgErr.message);
        // Skip this image, keep going with the next one in the gallery loop.
        continue;
      }
      imageIds.push(img.id as string);
      if (i === 0) heroImageId = img.id as string;
    }

    for (let i = 0; i < detailPaths.length; i++) {
      const local = path.join(dir, detailPaths[i]);
      const storagePath = `${sourceDir}/${slug}/d${String(i).padStart(3, "0")}${path.extname(local) || ".jpg"}`;
      const upload = await uploadImage(local, storagePath);
      if (!upload) continue;
      await supabase
        .from("images")
        .upsert(
          {
            item_id: itemId,
            path: storagePath,
            ordinal: i,
            kind: "detail",
            bytes: upload.size,
          },
          { onConflict: "item_id,kind,ordinal" }
        );
    }

    // Update hero_image_id on the item
    if (heroImageId) {
      await supabase.from("items").update({ hero_image_id: heroImageId }).eq("id", itemId);
    }

    process.stdout.write(`  ${slug} (${imageIds.length} imgs)\n`);
}

// ---------- main ----------

async function main() {
  console.log("=== HaulHQ Phase-1 → Phase-2 migration ===");
  await migrateSellers();
  await migrateOneSource("yupoo");
  await migrateOneSource("superbuy");
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
