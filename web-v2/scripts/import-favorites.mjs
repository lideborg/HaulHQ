// Bulk-import v1 favorites (data/favorites/*.json) into Supabase products.
// Usage (from web-v2/): node scripts/import-favorites.mjs [--dry] [--limit N] [--only slug]
import { readFileSync, existsSync } from "node:fs";
import { resolve, join, basename } from "node:path";
import { loadEnv } from "./lib/env.mjs";
import { adminClient, uploadProductImages } from "./lib/storage.mjs";
import { mapFavorite, localImagePaths } from "./lib/map-favorite.mjs";

const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const LIMIT = args.includes("--limit") ? parseInt(args[args.indexOf("--limit") + 1], 10) : Infinity;
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const FAV_DIR = resolve("../data/favorites");
const env = loadEnv(".env.local");
const FX = parseFloat(env.FX_CNY_USD || "0.14");
const sb = DRY ? null : adminClient(env);

const index = JSON.parse(readFileSync(join(FAV_DIR, "_index.json"), "utf8"));
const seenLinks = new Set();
const report = { ok: [], updated: [], skipped: [], errors: [], flagged: [] };

let n = 0;
for (const entry of index.entries) {
  if (n >= LIMIT) break;
  const slug = basename(entry.file, ".json");
  if (ONLY && slug !== ONLY) continue;
  n++;
  try {
    const fav = JSON.parse(readFileSync(join(FAV_DIR, entry.file), "utf8"));
    const row = mapFavorite(fav, FX);
    if (row.source_link && seenLinks.has(row.source_link)) {
      report.skipped.push(`${slug}: duplicate source_link`);
      continue;
    }
    if (row.source_link) seenLinks.add(row.source_link);
    if (!fav.size_chart?.sizes?.length) report.flagged.push(`${slug}: no size chart -> sizes=${JSON.stringify(row.size_options)}`);
    if (row.price_usd == null) report.flagged.push(`${slug}: unparseable price "${fav.price}" -> quote on request`);

    const imgs = localImagePaths(fav)
      .map((p) => join(FAV_DIR, p))
      .filter((p) => existsSync(p));
    if (DRY) {
      console.log(`[dry] ${slug}: "${row.title}" | ${row.brand} | $${row.price_usd} | sizes=${row.size_options.join(",")} | guide=${!!row.size_guide} | imgs=${imgs.length}`);
      report.ok.push(slug);
      continue;
    }

    // select-then-write keyed on source_link
    let id = null;
    if (row.source_link) {
      const { data } = await sb.from("products").select("id").eq("source_link", row.source_link).maybeSingle();
      id = data?.id ?? null;
    }
    if (id) {
      const { error } = await sb.from("products").update(row).eq("id", id);
      if (error) throw error;
      report.updated.push(slug);
    } else {
      const { data, error } = await sb.from("products").insert(row).select("id").single();
      if (error) throw error;
      id = data.id;
      report.ok.push(slug);
    }

    if (imgs.length) {
      let urls;
      try {
        urls = await uploadProductImages(sb, env, id, imgs);
      } catch {
        try {
          urls = await uploadProductImages(sb, env, id, imgs); // one retry
        } catch (e2) {
          report.flagged.push(`${slug}: image upload failed twice (${e2.message}) — kept remote URLs`);
          urls = fav.image_urls || [];
        }
      }
      if (urls.length) {
        const { error } = await sb.from("products").update({ image_urls: urls }).eq("id", id);
        if (error) throw error;
      }
    } else {
      report.flagged.push(`${slug}: no local images found`);
    }
  } catch (e) {
    report.errors.push(`${slug}: ${e.message}`);
  }
}

console.log("\n=== IMPORT REPORT ===");
for (const k of ["ok", "updated", "skipped", "errors"]) console.log(`${k}: ${report[k].length}`);
for (const k of ["skipped", "errors", "flagged"]) if (report[k].length) console.log(`\n-- ${k} --\n` + report[k].join("\n"));
