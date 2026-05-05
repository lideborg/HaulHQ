-- Enable Row Level Security on the catalog tables and add public-read policies.
--
-- Without this migration, the anon API key (which ships to the browser) has
-- the default GRANT ALL on every table — anyone with the key could
-- INSERT/UPDATE/DELETE rows. Phase 1 of Supabase wiring expects only SELECT
-- from anon; writes go through the service-role key in scripts/migrate/.
--
-- Rollback: alter table ... disable row level security; drop policies.

alter table sellers enable row level security;
alter table items   enable row level security;
alter table images  enable row level security;

-- Anon: read-only on all three. Auth users (when we add auth) inherit the
-- same policies via "public" role unless we add stricter ones.
create policy "anon read sellers" on sellers for select to anon, authenticated using (true);
create policy "anon read items"   on items   for select to anon, authenticated using (true);
create policy "anon read images"  on images  for select to anon, authenticated using (true);

-- No insert/update/delete policies for anon. The service-role key bypasses
-- RLS entirely, so the migrate script + future scraper agents can still
-- write. Phase 2 will add per-user policies on a `wishlists` table once
-- auth is in place.
