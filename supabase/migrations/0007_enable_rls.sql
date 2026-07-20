-- Enable Row Level Security on all live v2 tables.
--
-- These tables shipped with RLS disabled while the anon (publishable) key ships
-- to the browser, so anyone with the key could read/write every row — including
-- friends.access_token (the friend-login credential), shipping addresses, and
-- payment amounts. Confirmed exploitable end-to-end (GET friends?select=access_token
-- returned live tokens; PATCH friends succeeded) against project pqfiwdscftwhmcutspay.
--
-- The app accesses these tables exclusively through the service_role client
-- (web-v2/src/lib/supabase/admin.ts), which bypasses RLS. Enabling RLS with no
-- policies therefore denies all anon/authenticated access without affecting the
-- app. Applied to production on 2026-07-18.
--
-- NOTE: this supersedes the never-applied 20260505120000_enable_rls_public_read.sql,
-- which targeted a legacy schema (sellers/items/images) — not the live v2 tables.
--
-- Rollback: alter table <t> disable row level security;

alter table public.friends       enable row level security;
alter table public.sellers       enable row level security;
alter table public.products      enable row level security;
alter table public.items         enable row level security;
alter table public.orders        enable row level security;
alter table public.payments      enable row level security;
alter table public.status_events enable row level security;
alter table public.notifications enable row level security;

-- Defense-in-depth: revoke direct table grants from the PostgREST API roles.
revoke all privileges on table
  public.friends, public.sellers, public.products, public.items,
  public.orders, public.payments, public.status_events, public.notifications
from anon, authenticated;
