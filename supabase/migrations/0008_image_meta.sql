-- Per-image tags for the shop gallery, produced by the hero/retag batch
-- (scripts/classify/retag-heroes.mjs). Aligned 1:1 with products.image_urls
-- AFTER the batch reorders it hero-first. Each entry:
--   { "url": text, "kind": "flat_lay|front|worn|detail|size_chart|logo_text|other",
--     "hero": bool }
-- `kind` lets us later pick the clean front/flat-lay as the base for generated
-- e-commerce imagery. Nullable: products not yet processed have image_meta = null.
alter table products add column if not exists image_meta jsonb;
