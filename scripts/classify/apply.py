import json, glob, urllib.request, subprocess, sys

SLUGS = {"t-shirts","shirts","knitwear","hoodies","outerwear","pants",
         "shorts","shoes","bags","accessories","glasses"}

manifest = {m["id"]: m for m in json.load(open("/tmp/haul-classify/manifest.json"))}

assigned = {}   # id -> slug
review = []      # ids left null
bad = []
for f in sorted(glob.glob("/tmp/haul-classify/out/batch-*.json")):
    for r in json.load(open(f)):
        cat = r.get("category")
        if r.get("confident") and cat in SLUGS:
            assigned[r["id"]] = cat
        else:
            review.append(r["id"])
            if cat is not None and cat not in SLUGS:
                bad.append((r["id"], cat))

seen = set(assigned) | set(review)
missing = [i for i in manifest if i not in seen]
print(f"assigned={len(assigned)} review={len(review)} missing_from_output={len(missing)} bad_slugs={len(bad)}")
if bad: print("  BAD SLUGS:", bad[:10])
if missing: print("  MISSING:", missing[:10])

# Build SQL: bulk-assign via VALUES join, then null-out the review set.
vals = ",".join(f"('{i}'::uuid,'{c}')" for i, c in assigned.items())
sql = f"update products p set category=v.cat from (values {vals}) as v(id,cat) where p.id=v.id;"
null_ids = review + missing
if null_ids:
    ids = ",".join(f"'{i}'::uuid" for i in null_ids)
    sql += f" update products set category=null where id in ({ids});"

pat = json.load(open(".mcp.json"))["mcpServers"]["supabase"]["env"]["SUPABASE_ACCESS_TOKEN"]
open("/tmp/apply.json","w").write(json.dumps({"query": sql}))
out = subprocess.run(
    ["curl","-s","-X","POST","-H",f"Authorization: Bearer {pat}",
     "-H","Content-Type: application/json","--data","@/tmp/apply.json",
     "https://api.supabase.com/v1/projects/pqfiwdscftwhmcutspay/database/query"],
    capture_output=True, text=True)
print("apply response:", out.stdout[:300])

# Needs-review titles for the user
if null_ids:
    print("\nNEEDS REVIEW (left blank -> cleanup page):")
    for i in null_ids:
        m = manifest.get(i, {})
        print(f"  - {m.get('brand','')} {m.get('title','')[:55]}  [coarse={m.get('coarse','')}]")
