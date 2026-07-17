-- 0003: scrape-import pipeline (spec 2026-07-17)
alter table products add column if not exists size_guide jsonb;
alter table products add column if not exists admin_sizing_note text;
alter table products add column if not exists source_platform text; -- yupoo|weidian|taobao|superbuy|1688
alter table products add column if not exists colors text[] not null default '{}';
alter table items    add column if not exists color text;
alter table friends  add column if not exists measurements jsonb;
-- plain unique (multiple NULLs allowed in Postgres)
create unique index if not exists products_source_link_key on products(source_link);
-- public image bucket
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;
