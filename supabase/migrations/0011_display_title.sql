-- Short card-facing name: "[Color] [Material?] [Garment]", <= 4 words
-- ("White Tee", "Heather Grey Hoodie", "Black Leather Tote"). The full scraped
-- title stays in `title` as the saved long description; cards render
-- display_title when present. Populated by scripts/propose-display-titles.mjs,
-- editable in /admin/products.
alter table products add column if not exists display_title text;
