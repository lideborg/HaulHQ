// Availability sweep: re-check active products' source links and flag dead ones
// sold_out. Weidian direct pages are fetchable (they return "商品已下架" when
// off-shelf) — no browser needed. Yupoo (403/Cloudflare) and Taobao (anti-bot)
// need the browser and are skipped here.
//
//   node scripts/sweep-availability.mjs            # dry: report alive/dead
//   node scripts/sweep-availability.mjs --apply    # mark dead ones sold_out
import { loadEnv } from "./lib/env.mjs";
import { adminClient } from "./lib/storage.mjs";

const env = loadEnv(".env.local");
const sb = adminClient(env);
const APPLY = process.argv.includes("--apply");

const { data: rows, error } = await sb
  .from("products").select("id,code,brand,title,source_link")
  .eq("sold_out", false).ilike("source_link", "%weidian%");
if (error) { console.error(error.message); process.exit(1); }

// dedupe by the base item URL (strip #color fragments) so shared items are hit once
const byBase = new Map();
for (const p of rows) {
  const base = p.source_link.split("#")[0];
  if (!byBase.has(base)) byBase.set(base, []);
  byBase.get(base).push(p);
}
console.log(`${rows.length} active Weidian products across ${byBase.size} unique listings\n`);

const dead = [];
let alive = 0, uncertain = 0;
const bases = [...byBase.keys()];
const CONC = 6;
for (let i = 0; i < bases.length; i += CONC) {
  await Promise.all(bases.slice(i, i + CONC).map(async (base) => {
    const items = byBase.get(base);
    try {
      const r = await fetch(base, { headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" }, redirect: "follow" });
      const html = await r.text();
      const isDead = /商品已下架|该商品不存在|宝贝不存在|商品不存在/.test(html);
      const looksReal = /商品|价格|itemInfo|weidian/i.test(html);
      if (isDead) { dead.push(...items); console.log(`DEAD  ${items.map(p => p.code).join(",")}  ${items[0].brand} — ${(items[0].title || "").slice(0, 40)}`); }
      else if (!looksReal || html.length < 500) { uncertain++; console.log(`?     ${items.map(p => p.code).join(",")}  (unclear — ${r.status}, ${html.length}b)`); }
      else alive += items.length;
    } catch (e) { uncertain++; console.log(`?     ${items.map(p => p.code).join(",")}  (fetch err: ${e.message})`); }
  }));
}

console.log(`\nalive ${alive} · dead ${dead.length} · uncertain ${uncertain}`);
if (dead.length && APPLY) {
  const ids = dead.map(p => p.id);
  const { error: ue } = await sb.from("products").update({ sold_out: true }).in("id", ids);
  console.log(ue ? `apply err: ${ue.message}` : `\nmarked ${ids.length} sold_out.`);
} else if (dead.length) {
  console.log(`\n(dry run — re-run with --apply to mark ${dead.length} sold_out)`);
}
