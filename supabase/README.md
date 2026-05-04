# Supabase (Phase 2)

Backend for HaulHQ. Replaces the JSON-on-disk catalog from Phase 1 with
Postgres + Storage + Auth, enabling multi-user access and giving scraper
agents (Phase 2.5) a real place to write.

## Project

- **Ref**: `fsypzohsyqiiakxcugib`
- **Region**: East US (North Virginia)
- **Dashboard**: https://supabase.com/dashboard/project/fsypzohsyqiiakxcugib
- **API URL**: `https://fsypzohsyqiiakxcugib.supabase.co`

## Local development

```bash
# One-time login (writes ~/.supabase/access-token)
supabase login

# Link this repo to the remote project (already done — recreate if your
# .temp/project-ref is missing)
supabase link --project-ref fsypzohsyqiiakxcugib

# Spin up a local Postgres + Auth + Storage stack
supabase start

# Apply local migrations to the remote project (use with care!)
supabase db push
```

## Environment variables

`web-next/.env.local` (gitignored):

```
NEXT_PUBLIC_SUPABASE_URL=https://fsypzohsyqiiakxcugib.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon JWT>
SUPABASE_SERVICE_ROLE_KEY=<service_role JWT — server-only>
```

Templates live in `web-next/.env.local.example`. Pull current values via:

```bash
supabase projects api-keys --project-ref fsypzohsyqiiakxcugib
```

## Migrations

Each schema change lives in `supabase/migrations/<timestamp>_<name>.sql`.
Conventions:

- One concept per migration. Adding a column → its own file. Renaming a
  table → its own file. Don't squash unrelated changes.
- Include rollback hints in a top-of-file comment.
- Test locally with `supabase db reset` before pushing to remote.

## Phase 2 plan

- [ ] Schema: `items`, `sellers`, `images`, `quotes`, `hauls`, `haul_items`, `wishlists`
- [ ] Migration script: read `data/**/*.json` and `data/<src>/images/<slug>/*.jpg`,
      insert rows + upload to Supabase Storage bucket `catalog-images`.
- [ ] Wire Next.js readers to use Drizzle/Supabase client instead of `fs.readFile`.
- [ ] Auth (magic-link) so the wishlist becomes per-user instead of localStorage-only.
- [ ] Once parity confirmed, delete the `data/**/*.json` files. They become a
      one-shot snapshot in git history.
