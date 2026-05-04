-- Create the catalog-images storage bucket.
--
-- Public-read so the Next.js app can render images via plain <img src> URLs
-- without signing every request. Writes are restricted to the service role
-- (the migration script + scraper agents).
--
-- Rollback: delete from storage.buckets where id = 'catalog-images';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'catalog-images',
  'catalog-images',
  true,                                      -- public read
  20971520,                                  -- 20 MB per file (oversized hero photos exist)
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;
