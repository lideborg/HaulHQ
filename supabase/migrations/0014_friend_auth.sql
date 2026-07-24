alter table public.friends add column if not exists password_hash text;
alter table public.friends add column if not exists setup_token text;
alter table public.friends drop column if exists email;
