-- HaulHQ v2 — initial schema (group-buy concierge)
-- Run in Supabase SQL editor (project pqfiwdscftwhmcutspay).
-- Auth model: friends use per-friend access tokens; the app server reads/writes
-- with the service_role key, so row security is enforced at the app layer for MVP.

create extension if not exists "pgcrypto";

-- People: friends (token login) + admin (Hampus).
create table if not exists friends (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  email            text,
  access_token     text unique not null default encode(gen_random_bytes(16), 'hex'),
  shipping_address jsonb,                         -- {line1,line2,city,state,zip,country,phone}
  currency         text not null default 'USD',
  is_admin         boolean not null default false,
  active           boolean not null default true, -- revoke a friend link by flipping this
  created_at       timestamptz not null default now()
);

-- Seller directory — powers the "no-match" fallback (search a brand -> who carries it).
create table if not exists sellers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  brands         text[] not null default '{}',
  yupoo_url      text,
  superbuy_store text,
  notes          text
);

-- Curated shop catalog (what friends browse). Marked-up USD price shown to friends.
create table if not exists products (
  id           uuid primary key default gen_random_uuid(),
  brand        text,
  title        text not null,
  description  text,
  category     text,
  seller       text,
  source_link  text,
  image_urls   text[] not null default '{}',
  cost_cny     numeric,                    -- source cost (admin only)
  markup       numeric not null default 0.20,
  price_usd    numeric,                    -- displayed price; null => quote-on-request
  size_options text[] not null default '{}',
  published    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Order lines: a friend's actual requested/ordered item.
-- Either references a shop product, OR carries a pasted source_link (friend request).
create table if not exists items (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null references friends(id) on delete cascade,
  product_id        uuid references products(id),      -- null for pasted-link requests
  source_link       text,                              -- set for pasted-link requests
  title             text,
  brand             text,
  image_urls        text[] not null default '{}',
  chosen_size       text,
  quoted_price_usd  numeric,                            -- final price friend pays
  status            text not null default 'requested', -- requested|ordered|warehouse|shipped
  tracking          text,
  notes             text,
  order_id          uuid,                               -- FK added after orders table
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- A shipment / Superbuy order grouping (consolidation -> per-friend parcel).
create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid references friends(id),
  superbuy_order_no text,
  parcel_no       text,
  cost_breakdown  jsonb,
  status          text not null default 'open',
  created_at      timestamptz not null default now()
);

alter table items
  drop constraint if exists items_order_id_fkey,
  add constraint items_order_id_fkey foreign key (order_id) references orders(id);

-- Manual payments (Venmo/Revolut) — admin marks paid.
create table if not exists payments (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references friends(id),
  amount_usd  numeric not null,
  paid        boolean not null default false,
  method      text,
  paid_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Status timeline per item = the "know when things are coming in" feed.
create table if not exists status_events (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid references items(id) on delete cascade,
  status     text not null,
  note       text,
  created_at timestamptz not null default now()
);

-- Admin pings (new request, etc.) — logged + deduped.
create table if not exists notifications (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,                    -- 'new_request', ...
  item_id    uuid references items(id),
  friend_id  uuid references friends(id),
  payload    jsonb,
  sent       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists items_owner_idx     on items(owner_id);
create index if not exists items_status_idx    on items(status);
create index if not exists products_pub_idx    on products(published);
create index if not exists products_brand_idx  on products(brand);
create index if not exists status_events_item  on status_events(item_id);
