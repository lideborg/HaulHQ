-- HaulHQ initial catalog schema.
--
-- Tables:
--   sellers   — replaces data/notes/sellers.json
--   items     — replaces data/<source>/<slug>.json
--   images    — one row per photo, FK to items
--
-- Owners are stored as a text[] on items (matches Phase-1 JSON shape:
-- ["hampus"], ["jan"], or ["hampus","jan"] for shared). When auth lands
-- we'll move per-user wishlists to a separate table.
--
-- Rollback: drop tables in reverse order: images, items, sellers,
-- and drop the helper enums.

-- ---------------------------------------------------------------------------
-- Enums (loose: created as text + check constraints so we can extend without
-- migrations, but keep callers honest about the closed-set fields).
-- ---------------------------------------------------------------------------

create type seller_verdict as enum ('trusted', 'use-via-agent', 'avoid', 'unknown');
create type data_source as enum ('yupoo', 'superbuy', 'weidian', 'taobao', '1688');
create type item_category as enum ('apparel-top', 'apparel-bottom', 'eyewear', 'bag', 'shoes', 'accessory');
create type acquisition_kind as enum ('superbuy', 'contact-seller');

-- ---------------------------------------------------------------------------
-- Sellers
-- ---------------------------------------------------------------------------
create table sellers (
  id uuid primary key default gen_random_uuid(),
  -- "name" is a stable display key (matches data/notes/sellers.json[].name).
  name text not null unique,
  yupoo text,
  yupoo_password text,
  specialty text,
  verdict seller_verdict not null default 'unknown',
  contact jsonb not null default '{}'::jsonb,
  notes text,
  reachable text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sellers_verdict_idx on sellers (verdict);

-- ---------------------------------------------------------------------------
-- Items (the catalog)
-- ---------------------------------------------------------------------------
create table items (
  id uuid primary key default gen_random_uuid(),

  -- Identity / lookup
  slug text not null,
  source data_source not null,
  -- (slug, source) is unique because the same slug exists under both yupoo/
  -- and superbuy/ namespaces in the legacy file layout.
  unique (slug, source),

  user_label text not null,
  title text,
  title_translated text,
  description text,
  brand text,
  category item_category,
  item_code text,
  model_code text,

  -- Source URL on the original site (Yupoo album, Taobao item, etc.)
  url text,
  source_url text,

  -- Seller association — soft FK by name so a missing seller row doesn't
  -- block item creation, but we can join when present.
  seller_name text,
  seller_id uuid references sellers (id) on delete set null,

  -- Pricing snapshot (free-form for legacy compatibility + numeric for sort).
  price text,                         -- raw "¥320" string from listing
  price_cny numeric(12, 2),
  price_usd numeric(12, 2),
  quoted_by text,
  quoted_on date,

  -- Sizing
  sizing text,
  size_chart jsonb,                   -- { unit, sizes[], measurements{...} }
  variants text[] not null default array[]::text[],
  target_size text,
  target_variant text,
  preferred_size text,

  -- Hero photo + ownership + state flags
  hero_image_id uuid,                 -- set after images insert; fk added below
  owners text[] not null default array[]::text[]
    check (owners <@ array['hampus','jan']),

  out_of_stock boolean not null default false,
  skipped boolean not null default false,
  skipped_reason text,
  locked boolean not null default false,
  requires_contact boolean not null default false,
  acquisition acquisition_kind,

  notes text,
  params jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_source_idx       on items (source);
create index items_category_idx     on items (category);
create index items_owners_gin_idx   on items using gin (owners);
create index items_seller_id_idx    on items (seller_id);
create index items_seller_name_idx  on items (seller_name);

-- ---------------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------------
create type image_kind as enum ('gallery', 'detail');

create table images (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items (id) on delete cascade,
  -- Storage path within the catalog-images bucket OR an external URL for
  -- not-yet-migrated items. Phase-2 migration writes only storage paths.
  path text not null,
  external_url text,                  -- e.g. photo.yupoo.com/... reference
  ordinal int not null,               -- 0-based; 0 = album order, hero set via items.hero_image_id
  kind image_kind not null default 'gallery',
  width int,
  height int,
  bytes int,
  created_at timestamptz not null default now()
);

create unique index images_item_kind_ordinal_uniq on images (item_id, kind, ordinal);
create index        images_item_id_idx            on images (item_id);

-- Now that images exists, wire items.hero_image_id back to it.
alter table items
  add constraint items_hero_image_fk
  foreign key (hero_image_id) references images (id) on delete set null;

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sellers_updated_at
  before update on sellers
  for each row execute function set_updated_at();

create trigger items_updated_at
  before update on items
  for each row execute function set_updated_at();
