// One-shot backfill: product short codes + brand_slug for every product,
// and a handle for the existing friend. Idempotent-ish (only fills nulls).
import fs from "node:fs";
import { slugify, makeCode } from "./lib/haul-codes.mjs";

const PAT = JSON.parse(fs.readFileSync("../.mcp.json", "utf8"))
  .mcpServers.supabase.env.SUPABASE_ACCESS_TOKEN;
const URL = "https://api.supabase.com/v1/projects/pqfiwdscftwhmcutspay/database/query";

async function sql(query) {
  const res = await fetch(URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${PAT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text}`);
  return JSON.parse(text);
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

// products needing a code
const products = await sql(
  "select id, coalesce(brand,'') as brand from products where code is null",
);
const used = new Set(
  (await sql("select code from products where code is not null")).map((r) => r.code),
);
const rows = products.map((p) => {
  let code;
  do { code = makeCode(); } while (used.has(code));
  used.add(code);
  return { id: p.id, code, brand_slug: slugify(p.brand) || "misc" };
});

if (rows.length) {
  const values = rows
    .map((r) => `(${q(r.id)}::uuid, ${q(r.code)}, ${q(r.brand_slug)})`)
    .join(",");
  await sql(
    `update products p set code = v.code, brand_slug = v.brand_slug
     from (values ${values}) as v(id, code, brand_slug) where p.id = v.id;`,
  );
}

// friend handle
const friends = await sql("select id, name from friends where handle is null");
for (const f of friends) {
  const base = slugify(f.name) || "friend";
  await sql(`update friends set handle = ${q(base)} where id = ${q(f.id)}::uuid;`);
}

const check = await sql(
  "select (select count(*) from products where code is null) as no_code, (select count(*) from friends where handle is null) as no_handle, (select count(distinct code) from products) as codes",
);
console.log(`backfilled ${rows.length} product codes, ${friends.length} friend handle(s)`);
console.log("verify:", check[0]);
