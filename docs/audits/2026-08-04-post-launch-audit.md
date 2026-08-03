# HaulHQ post-launch audit · 2026-08-04

**Method:** 18 agents in a verification workflow: 6 dimension auditors (security,
correctness, performance, code quality, UX flows, ops) read the repo and live DB,
every P0/P1 claim was then attacked by an adversarial verifier that had to refute
it from code before it could stand; 3 research agents studied the proxy-shopping
ecosystem, private-commerce UX, and current Next.js 16 + Supabase practice.
Supabase's own security and performance advisors were run as an extra input.
Score: 8 findings confirmed serious, 1 refuted, ~55 minor. No P0s. IDOR
coverage, the SSRF allowlist, storage write lockdown, CSRF posture, and the
deny-all RLS design were each explicitly verified sound.

## Fixed during the audit

- **[P1] Re-ordering from a past haul was impossible.** The pre-hauls global
  unique index `items_owner_product_uniq (owner_id, product_id)` survived the
  numbered-hauls migration, so adding a product that lived in ANY past haul
  failed with a raw duplicate-key error. Replaced live with
  `items_owner_product_haul_uniq (owner_id, product_id, haul_id)`.

## Confirmed, needs action

### P1

1. **Post-approve dead-end (the product's biggest broken promise).** Nothing in
   the app ever moves an item past `confirmed`: no admin control for
   ordered/shipped/arrived, no friend-facing signal ever again. Copy promises
   "sends your haul to admin for ordering" with no next act; the archive reads
   "Confirmed" forever. Fix: per-item / per-haul status buttons on
   /admin/friends/[handle] (Ordered, Shipped + tracking, Arrived) writing
   items.status + status_events; friend past-haul page already renders the labels.

2. **Storage over the 1 GB free cap + unverified backups.** product-images =
   2,999 files, ~1.03 GB, growing ~2 GB/month at current import pace, while
   orders/payments now carry real money. If the project is on Free, uploads will
   start failing and there are NO scheduled backups. (Image transforms respond,
   which suggests Pro; verify in the dashboard.) Action: confirm plan is Pro,
   confirm daily backups are listed, and add the image-resize work below to slow
   bucket growth.

3. **All local dev and bulk scripts write prod with the service-role key, with
   no snapshot tooling.** Most scripts have --dry; the two heaviest writers
   (import-batch.mjs, split-colors.mjs) do not. One bad batch file has no undo.
   Action: scripts/db-snapshot.mjs (dump 8 tables to timestamped JSON, ~30
   lines) called at the top of both writers, and add --dry to import-batch.

### P2

4. **No quoting workflow exists.** quoted_price_usd is only ever copied from
   product.price_usd at add time; the `quoted` status is unreachable; factories
   link items show "Quote" forever; 18 published products have no price. Fix: a
   price input per item on the admin friend page (writes quoted_price_usd,
   flips status to quoted), with sourcing_note shown beside it.

5. **Full-res images served everywhere.** Shop grid = 632 heroes totalling
   ~200 MB if scrolled; first phone viewport alone 2.6 MB; product pages avg
   1.4 MB, worst 11 MB. The Supabase render/image endpoint IS enabled and
   returns a 400px thumb at ~1/3 to 1/50 the bytes. Fix: thumb(url, width)
   helper used at every render site (grid 400, rows 128, gallery 1080, original
   only in lightbox). Longer term: next/image + remotePatterns (see research).

6. **Numbered-hauls DDL never recorded in supabase/migrations.** The hauls
   table, partial unique index (the race-safety guarantee), items.haul_id,
   items.quantity, items.sourcing_note exist only in prod and a design doc. A
   fresh environment cannot run the app. Fix: record 0015/0016 marked
   "applied out-of-band", per the 0013 convention. Also: legacy v1 migration
   set in the same dir conflicts with the live schema; archive it.

7. **Prod errors are invisible.** No Sentry; error boundaries discard the error
   prop; Vercel Hobby logs evaporate after ~1 hour; 9 PRs shipped since this
   was first scheduled. Fix: @sentry/nextjs free tier + instrumentation.ts
   onRequestError + captureException in both boundaries (~30 min).

8. **No CI.** Tests run only on whoever remembers; merge deploys straight to
   prod. Fix: one GitHub Action running tsc + eslint + node --test on PRs.

## Security hardening queue (all P2, none remotely exploitable today)

- **Admin cookie = unsalted SHA-256 of the admin password.** Static forever,
  offline-crackable to the password itself, no expiry/revocation. Fix: HMAC
  with a server secret + expiry, or random session value.
- **Friend sessions unrevocable.** access_token never rotates, password reset
  keeps old sessions + old password valid. Fix: rotate access_token on every
  setPassword completion.
- **Setup/reset tokens never expire** and ride in GET URLs (including
  /admin?setup=...). Fix: 7-day TTL + move token out of the admin redirect URL.
- **Admin read pages rely solely on the proxy matcher** (actions are guarded,
  pages are not). Middleware-bypass is a recurring Next CVE class. Fix: one
  requireAdmin() line per admin page.
- **No rate limit on mutating friend endpoints**; addLinkToHaul amplifies into
  ~30s of server-side fetching + storage writes per call. Fix: reuse the
  existing limiter on addLinkToHaul at minimum.
- Minor: bump sharp (3 npm-audit highs), set search_path on set_updated_at
  (advisor WARN), scheme-validate DB-sourced hrefs, note /product/[id] is
  intentionally public.

## Worth scheduling (curated from ~55 minors)

- **approveHaul ignores write errors** on its two critical writes; five server
  actions swallow Supabase errors; three error-signaling conventions coexist.
- **Approving while a link is still `sourcing` discards the enrichment**
  (status flips to confirmed mid-resolve; title/image/price arrive to a locked
  item or never). Guard: block approve while any item is sourcing, or let the
  resolver finish on confirmed items too.
- **Admin dashboard haul_count counts every item ever** (all statuses), so the
  ITEMS column reads high after hauls archive.
- **Items stuck in `sourcing` forever if the resolver dies** (no retry, no
  timeout flag); admin inbox requests can never be resolved from the UI;
  notifications/status_events are write-only (nothing reads them).
- "Deactivate them instead" error copy exists but no deactivate control does.
- AddToHaul silently preselects the first size; changing size after adding
  does not persist a second choice visibly.
- public/ ships ~12 MB of internal dev-review artifacts on the live domain;
  landing hero is a 678 kB PNG.
- Item-row markup duplicated in 3 places; dead Supabase client libs;
  shipping.ts untested; types.ts drifted from live schema (HaulItem missing
  color/tracking/order_id/updated_at); admin products page unfiltered 730 rows
  + ~1 MB payload; admin "View shop" hardcodes /hampus/shop; server-side dates
  format in UTC (approved late-night can display the previous day).
- Mixed "Admin"/"admin" capitalization and a few em dashes remain in
  friend-facing strings (house style: never em dashes).

## Refuted by verification

- "Storage objects served with cache-control: no-cache" - false; objects are
  served cacheable. (The perf auditor's other claims stood.)

## Supabase advisors

- Security: 10x "RLS enabled, no policy" = intended deny-all posture, fine.
  1 WARN: set_updated_at mutable search_path (fix in the 0015 migration).
- Performance: unindexed FKs on items.product_id, items.order_id,
  notifications.friend_id/item_id, orders.owner_id, payments.owner_id. Cheap
  to add; items.product_id sits in the add-to-haul lookup path.

## What the research says (condensed, applicability-first)

### Ecosystem (proxy agents + rep community practice)

- **QC photos are THE trust primitive.** Agent flow is warehouse -> QC photos ->
  buyer green-lights before international shipping. HaulHQ should let admin
  attach Superbuy QC photos to haul items and (optionally) let the friend
  green-light their own item. Best possible status update is a photo of YOUR item.
- **The canonical pipeline defines the statuses friends expect:** ordered ->
  arrived at warehouse -> QC -> shipped -> reshipped by admin -> delivered. The
  admin-reship leg deserves its own visible stage + tracking.
- **US de minimis is dead (May/Aug 2025).** Every haul is dutiable now; prefer
  tariff-inclusive lines, validate the x1.2 margin against duty-inclusive
  reality, keep friend prices all-in. Have a quiet seized-parcel playbook
  (declare realistically, abandon rather than petition, make friends whole);
  model a seized/lost terminal status eventually.
- **Order fast after approval** (stock mismatch between approval and agent
  purchase is the #1 complaint cluster); minimize dwell time and balance held
  at any single agent (the Pandabuy collapse pattern).
- **Group-buy organizers run on deadlines + upfront money.** Payment chasing is
  the #1 organizer time sink; collect at approval, not delivery.

### Private-commerce UX (patterns to steal)

- **Pizza-tracker timeline** on the past-haul page: visible stages with
  timestamps beat silence (operational-transparency research). Pairs exactly
  with P1 finding #1.
- **"No news is still news":** a haul_updates mini-feed ("still at warehouse,
  consolidation Friday") + "Last update: 3 days ago" label. Delays are
  forgiven; silence is not.
- **Date RANGES with a reason, never "soon":** eta_start/eta_end on hauls
  ("Estimated arrival Sep 10-24 - ships from China in one batch").
- **Notify on stage transitions only, always deep-linking the status page**
  (kills "any update?" DMs; Resend free tier or a prefilled wa.me blast link).
- **Settlement per friend at approval:** item lines + shipping share + a "Copy
  Swish request" button (prefilled amount + "Haul 02 - 3 items" note). Deposit
  pattern fits naturally: items cost at approval, shipping share at ship time.
- **Haul close date as an event:** closes_at + countdown + "4 friends in"
  converts batching from annoyance into a drop mechanic. Private social proof
  (who's in, "in 2 friends' hauls") is a feature in a closed friend group.
- **Set lead-time expectations at add-to-haul time** (badge: "batch-shipped
  from China, usually 2-6 weeks after the haul closes"), not after approval.

### Tech practice (Next 16 + Supabase, 2026)

- **Images:** prefer next/image + Vercel optimizer (remotePatterns to
  *.supabase.co) over Supabase transformations at this scale (transform
  billing ~$20/mo at 750x5 images vs Vercel Hobby's free tier); the
  render/image thumb() helper is still the right same-day stopgap.
- **Caching:** Next 16 cacheComponents + 'use cache' + cacheTag('products'),
  revalidateTag on admin writes + a secret /api/revalidate for import scripts;
  drop force-dynamic from catalog surfaces, keep friend/admin dynamic.
- **Sentry free tier** (5k errors/mo) is the monitoring answer; Vercel Hobby
  logging is effectively useless (1h retention, no drains).
- **Email:** Resend free tier (3k/mo) + React Email for status emails; blocked
  on the haulhq.shop DNS being stuck at GoDaddy - one more reason to finish
  that fight.
- **Background jobs:** Supabase pg_cron/pgmq (free, hourly-capable) or Vercel
  cron (daily on Hobby) for the nightly availability sweep; heavy scraping
  stays in local scripts.

## Prioritized roadmap

**Now (done in this audit):** reorder-blocking index fixed live.

**This week (order of impact/effort):**
1. Sentry (~30 min) - fly blind no longer.
2. thumb() image helper at all render sites (~1-2 h) - biggest felt UX win.
3. Verify Supabase plan is Pro + backups exist; add db-snapshot.mjs + --dry to
   import-batch (~1 h).
4. Admin status buttons (Ordered/Shipped+tracking/Arrived) + friend timeline on
   past-haul page - closes the biggest product gap; quoting input rides along.
5. Record 0015/0016 migrations + FK indexes + set_updated_at search_path.
6. requireAdmin() on admin pages + rate-limit addLinkToHaul (~30 min).

**This month:** CI action; error-handling convention for server actions +
approveHaul checks; rotate access_token on password set + setup-token TTL;
admin cookie HMAC; sourcing-vs-approve guard; inbox resolve action; clean
public/; next/image migration; haul_updates feed + Resend emails once DNS
lands; settlement view with Swish request.

**Later:** cacheComponents migration; closes_at event mechanic + social proof;
QC-photo attachments with green-light flow; seized/lost status + refund flow;
nightly availability sweep on pg_cron; extract shared item-row component;
admin products filters.
