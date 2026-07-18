-- Per-friend haul inspiration boards: friend handles, product short codes,
-- and admin-only "I'll source this" flag + note on haul items.

alter table friends  add column if not exists handle text unique;
alter table products add column if not exists code text unique;
alter table products add column if not exists brand_slug text;
alter table items    add column if not exists to_source boolean not null default false;
alter table items    add column if not exists admin_note text;

-- A friend can't add the same product to their haul twice. Full unique index
-- (not partial) so upsert ON CONFLICT can target it; NULL product_id rows
-- (link requests) stay distinct under Postgres default NULLS DISTINCT.
create unique index if not exists items_owner_product_uniq
  on items (owner_id, product_id);
