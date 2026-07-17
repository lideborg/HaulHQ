# HaulHQ v2 — Build Plan

Spec: `docs/v2-design-brief.md` · Branch: `feat/v2-groupbuy` · App dir: `web-v2/`
DB: Supabase `pqfiwdscftwhmcutspay` · Schema: `supabase/migrations/0001_init.sql`

## Phase 0 — Foundation (do first, mostly sequential)
- [ ] Scaffold `web-v2/` — Next.js 16 (App Router, TS, Tailwind), matching v1 tooling.
- [ ] Add `@supabase/supabase-js` + `@supabase/ssr`; server client (service role) + browser client (anon).
- [ ] `web-v2/.env.local` (Hampus fills): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_EMAIL`, `FX_CNY_USD` (fixed rate for now).
- [ ] Run `0001_init.sql` in Supabase (Hampus, one paste).
- [ ] Seed `sellers` from v1 `research/saved-sellers.md` (script).

## Phase 1 — Friend storefront (SSENSE layout)
- [ ] Per-friend link auth: `/f/[token]` sets a session; middleware guards friend routes.
- [ ] **Shop** — left collapsible brand sidebar + 4-col product grid (image / BRAND / desc / USD price). Published products only.
- [ ] Search + brand filter; **no-match fallback** card → suggested sellers (from `sellers`) + "paste a link."
- [ ] Product detail → size picker → add to cart (creates `items` row, status `requested`).
- [ ] **Request** page — paste link + size + note → calls scrape endpoint → clean card → cart.
- [ ] **My Orders** — cart + per-item status timeline (`status_events`), USD total, mark-paid request.
- [ ] **Profile** — shipping address form (writes `friends.shipping_address`).

## Phase 2 — Scrape endpoint (reuse v1 pipeline)
- [ ] Port `add-haul-item` logic into `POST /api/request` — detect link type, scrape images + title + size chart, write a draft `item` + `notification(kind=new_request)`.
- [ ] Image handling → upload to Supabase storage bucket `product-images`.

## Phase 3 — Admin console (`/admin`, Supabase Auth single admin)
- [ ] Supabase Auth magic-link; gate `/admin/*` on `ADMIN_EMAIL`.
- [ ] **Inbox** — new requests: rename/clean title, set brand, set price (cost×markup), assign seller, **Publish** or **Order** → status `ordered`.
- [ ] **All Items** — filter by friend / status / seller; edit status → writes `status_events`.
- [ ] **Orders** — Superbuy order no + parcel no, consolidation view, per-friend shipping + tracking.
- [ ] **Friends** — create friend (generates `access_token`), revoke (`active=false`), who-owes-what.
- [ ] **Catalog** — publish/unpublish, rename, set per-item markup.

## Phase 4 — Notifications
- [ ] Supabase Edge Function on `notifications` insert → email (Resend) or Telegram bot ping to admin.

## Phase 5 — Polish / review
- [ ] Empty states, loading, mobile grid (4→2→1 cols).
- [ ] Review pass against `docs/v2-design-brief.md`.
- [ ] Seed a few published products from v1 favorites so the shop isn't empty.

## Backlog (phase 2, not now)
- Consistent flatlay product images via the `rondorff-campaign-batch` image pipeline.
- Live FX, Stripe, real friend accounts, analytics.

## Orchestration
Foundation (Phase 0) sequential. Then fan out agents per Phase-1/3 page (each a vertical slice: route + component + data hook), with a review agent per slice against the brief. Worktree isolation where agents touch shared files.
