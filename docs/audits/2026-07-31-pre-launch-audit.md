# Pre-launch deep audit — 2026-07-31 (overnight)

Four parallel audits (code, data, performance, operations/E2E) ran against the
repo and the live Supabase project the night before invites go out. This file
is the compiled result: what was found, what was already fixed overnight, and
what needs a decision or scheduling from Hampus.

## Headline

**The app is launch-ready.** The July-18 criticals stay fixed (RLS deny-all
verified live with the anon key, no IDOR, cookie-derived identity everywhere,
no secrets in the repo). The audits found two genuine P0s in the newest code
and a short list of week-1 items; everything P0/cheap-P1 was fixed overnight
in the same PR as this report.

## Fixed overnight (this PR + tonight's data cleanups)

1. **Sourcing note vs admin note collision (P0).** The background sourcer
   wrote its "listed ¥X ≈ $Y" hint into `admin_note`, the same column the
   admin's private-note textarea edits, so each silently destroyed the other.
   New `items.sourcing_note` column (migrated); sourcer writes there, inbox
   renders it separately, the admin's note box is untouched.
2. **Background sourcing could be killed mid-flight (P0).** `after()` work is
   bounded by the route's `maxDuration`; none was set, and the resolver can
   run ~30s of fetches. On Vercel's default cap a slow Yupoo page would kill
   the function before the `finally` block, stranding items in "Finding the
   details…" forever. `export const maxDuration = 60` on the factories page.
3. **deleteFriend 500 (P1).** `notifications`/`orders`/`payments` FKs are NO
   ACTION, so deleting any friend who ever made a request threw. Now deletes
   notifications first and refuses (with `?error=has-orders`) when real
   order/payment history exists.
4. **Sourcing failures were invisible (P1).** The resolver's catch swallowed
   every error; now it `console.error`s with the item id so Vercel function
   logs show breakage.
5. **Setup link misreported DB blips (P1).** A transient Supabase error on
   `/setup/[token]` rendered "This link is invalid" to a friend holding a
   valid link. DB errors now throw to the error boundary ("try again").
6. **Malformed product UUID returned HTTP 500 (P2).** `/product/<junk>` now
   404s cleanly (22P02 treated as not-found).
7. **Shop grid loaded ~50 full-size images eagerly (P1).** `loading="lazy"`
   on the grid cards; heroes average ~200 KB each so this was the largest
   real page-weight lever.
8. **Security headers (P1).** `poweredByHeader: false` plus
   X-Content-Type-Options / X-Frame-Options / Referrer-Policy /
   Permissions-Policy on all routes.
9. **Haul total understated with unknowns (P1).** Unweighed/unpriced items
   contribute 0, so the "Estimated total" now reads "from $X–$Y" whenever any
   item is missing a weight or price.
10. **Self-service hints (P1).** `/login` now says "Forgot your password? Ask
    Hampus for a reset link"; error and 404 pages say to message Hampus.
11. **Data cleanups (live DB).** Deactivated the 3 junk yolo66 brand rows and
    one stale 404 acmeco link; deleted the 2 orphaned `items/` storage
    objects. Verified `friends.handle` has a unique index (username race is
    safe) and the items FK chain cascades cleanly.

## Needs a Hampus decision (morning)

- **19 buyable products have no price** and land in hauls as "Quote",
  polluting totals. Options: price them in admin, or one-shot
  `update products set sold_out = true where published and not sold_out and
  (price_usd is null or price_usd = 0)` until priced. Worst offender: the
  Dior "Reflexion Crest Long-Sleeve" (`e9d5ec09…`) which also has no sizes.
- **88 sold-out cards (16%) show by default.** Flip the shop default to
  in-stock-only for a cleaner first impression? (Toggle already exists.)
- **`og:url` points at the apex while the site serves from www** (unfurls
  work — most crawlers follow the 308 — but pick a canonical host).

## Scheduled (week 1, not launch-blocking)

- **Sentry free tier** (~15 min): error boundaries + the sourcing catch.
  Without it, the only signal is Vercel function logs.
- **Supabase PITR or scheduled pg_dump** before real money hits
  `orders`/`payments` (current default: daily backups only).
- **Thumbnail the grid images** via Supabase Storage transform params
  (`?width=400&quality=75`) — ~10× wire reduction, no build change.
- **Sizing: single-dimension estimates.** `estimateChestCm` needs BOTH height
  and weight; friends who fill one get no top recommendation and no
  explanation. Also: the shoulder measurement is collected but never used by
  the engine — use it or drop the field.
- **Trim `getPublishedProducts`** to grid columns (drops ~1 MB of unused
  `size_guide`/`image_meta` JSON per shop load).
- **Password reset flow doc**: reset is admin-initiated by design (anonymous
  accounts, no email). Works end to end; just remember the flow: admin →
  Reset password → send the setup link.

## Explicitly not worth doing at this scale (audited and rejected)

- No new DB indexes: the ilike scans are 4-25ms, fully RAM-resident; pg_trgm
  GIN would add cost for nothing at 7k rows.
- No shop-page caching: 3 queries/keystroke-pause at 20 users is fine;
  tag-invalidation complexity isn't.
- No next/image migration pre-launch (storage transforms are the better fit
  later).
- The admin-dashboard N+1 (6 round-trips at 5 friends) is noise.

## Reference: env vars the Vercel project needs

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both baked at
build; rotating them needs a rebuild), `SUPABASE_SERVICE_ROLE_KEY`,
`ADMIN_PASSWORD` (unset = admin unreachable, fails safe). `FX_CNY_USD` in
.env.local.example is dead — nothing reads it. `GEMINI_API_KEY` is
offline-scripts only; keep it off Vercel.

## Audit trail

Full agent reports (code / data / performance / ops) are preserved in the
session transcripts; the ledger at `.superpowers/sdd/progress.md` tracks all
PRs. Catalog state at audit time: 559 published products (471 buyable), 7,375
active seller brand links (~93% sampled reachable), 42 sellers, image bucket
100% healthy on sample, zero stuck/orphaned rows.
