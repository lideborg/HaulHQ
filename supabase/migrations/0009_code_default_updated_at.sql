-- Root-cause fixes from the 2026-07 repo audit.

-- products.code had no default, so every script-side insert produced NULL codes
-- and broke /[handle]/product/<brand>/<code> URLs until a manual backfill.
-- Give it a DB default so no import path can forget it.
alter table products
  alter column code set default substr(md5(gen_random_uuid()::text), 1, 7);

update products set code = substr(md5(id::text), 1, 7) where code is null;

-- updated_at existed on products/items but nothing maintained it.
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists products_set_updated_at on products;
create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

drop trigger if exists items_set_updated_at on items;
create trigger items_set_updated_at
  before update on items
  for each row execute function set_updated_at();
