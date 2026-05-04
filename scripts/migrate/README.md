# scripts/migrate

One-shot migration tooling for moving Phase-1 data (JSONs + images on disk)
into the Phase-2 Supabase backend.

## Run

```bash
cd scripts/migrate
npm install
node --experimental-strip-types migrate-to-supabase.ts
```

Reads `web-next/.env.local` for `NEXT_PUBLIC_SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`. The service role is required because writes
bypass RLS and the `catalog-images` bucket policies.

## What it does

1. **Sellers** — upsert `data/notes/sellers.json` rows by `name`.
2. **Yupoo items** — for each entry in `data/yupoo/_index.json`:
   - upsert into `items` (`(slug, source)` unique key)
   - upload every image in `local_image_paths` + `local_detail_image_paths`
     to `catalog-images/yupoo/<slug>/<g|d><###>.{jpg|png}`
   - upsert image rows + set `items.hero_image_id` to the first gallery image
3. **Superbuy items** — same flow against `data/superbuy/`.

## Idempotency

Every operation is an upsert with explicit conflict targets, so re-running
the script after a partial failure picks up where it left off without
duplicating rows or images. Storage uploads use `upsert: true`.

## Robustness

Image uploads retry up to 5× with exponential backoff (0.5s → 4s) on
HTTP 429 / 502 / 503 from Supabase Storage. A whole-item failure logs
the slug and continues with the next one rather than killing the run.

## Phase-3 (cleanup)

Once the app reads from Supabase end-to-end and we're confident about
parity, the `data/yupoo/<slug>.json`, `data/superbuy/<slug>.json`, and
local image directories will be deleted in a separate PR. The git history
preserves the snapshot.
