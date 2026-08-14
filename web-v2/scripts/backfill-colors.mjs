// One-time: set products.color (12-family slug) from the "— Colour" suffix
// already in every display_title. Idempotent — safe to re-run. Usage (web-v2/):
//   node scripts/backfill-colors.mjs
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";
import { normalizeColor } from "../src/lib/colors.ts";

const sb = adminClient(loadEnv(".env.local"));

const { data, error } = await sb.from("products").select("id, display_title");
if (error) throw error;

const unmatched = new Map();
let n = 0;
for (const p of data) {
  const raw = (p.display_title || "").split("— ").pop()?.trim() ?? "";
  const color = normalizeColor(raw);
  // Track colours that fell through to "multi" without an obvious multi cue,
  // so the report flags families we might be missing.
  if (color === "multi" && raw && !/multi|camo|\/|&/i.test(raw)) {
    unmatched.set(raw, (unmatched.get(raw) || 0) + 1);
  }
  const { error: e } = await sb.from("products").update({ color }).eq("id", p.id);
  if (e) throw e;
  n++;
}
console.log(`backfilled color on ${n} products`);
console.log("fell through to multi (eyeball these):");
for (const [c, cnt] of [...unmatched.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cnt}x ${c}`);
}
