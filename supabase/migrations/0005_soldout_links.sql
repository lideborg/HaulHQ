-- 0005: sold-out tagging + yupoo link (admin link display)
alter table products add column if not exists sold_out boolean not null default false;
alter table products add column if not exists yupoo_url text;
