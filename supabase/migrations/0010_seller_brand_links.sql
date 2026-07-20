-- Brand → Yupoo-seller-category index for shop search fall-through.
-- One row per (seller, brand category): `brand` is the canonical brand name,
-- `alias` the seller's raw category label ("LEM", "Pra"), `url` the category
-- page. Populated by web-v2/scripts/index-yupoo-brands.mjs.
create table if not exists seller_brand_links (
  id         uuid primary key default gen_random_uuid(),
  seller     text not null,
  brand      text not null,
  alias      text,
  url        text not null,
  active     boolean not null default true,
  created_at timestamptz not null default now(),
  unique (seller, url)
);

-- Same posture as the rest of the schema: deny-all, service-role only.
alter table seller_brand_links enable row level security;
