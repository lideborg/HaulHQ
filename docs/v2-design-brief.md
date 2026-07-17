# HaulHQ v2 — Group-Buy Concierge Portal · Design Brief

Status: **design locked, pre-planning** · Branch: `feat/v2-groupbuy` · v1 frozen at tag `v1-snapshot`

## 1. What we're building
A friends-facing storefront + personal-shopper backend. Friends browse a curated catalog or paste any rep-fashion link; Hampus sources everything through Superbuy, consolidates in the warehouse, and reships per-friend — taking a margin. Friends **never see Superbuy/Yupoo/Weidian** — Hampus is the translation layer, and the app *is* that layer.

This is a **rebuild** on top of v1's proven pieces (the `add-haul-item` scrape pipeline + the item data model), not a patch. New stack, new multi-user data layer.

## 2. Users & roles
- **Friends** (~6 now, widen later): access via a **private per-friend link** (token, no password). See only clean product cards + their own orders.
- **Admin** (Hampus, single): **Supabase Auth email magic-link**, `is_admin` allowlist gate on `/admin/*`. No Clerk. Can generate/revoke friend links.

## 3. Friend experience (3 pages)
- **Shop** — brand chips (The Row, ERD, Lemaire, Prada…) + search bar + clean product cards (image, name, **USD price**, size options). Only items Hampus has flagged **published**.
  - Search **hit** → cards; pick size → add to cart.
  - Search **miss** → friendly card: "Not in the shop yet — paste a link or request it," **plus the real seller names** from the saved-sellers list who carry that brand.
- **Request** — paste any link + size + note → scrape pipeline → clean card → into cart.
- **My Orders** — cart + per-item status timeline `requested → ordered → in warehouse → shipped (tracking)`, USD total, "mark as paid" button.
- **Profile** — shipping address (private), currency (USD default).

## 4. Admin experience
- **Inbox** — new requests to review; **naming + pricing + order trigger in one gate**. Nothing reaches the Shop until cleaned here (fixes ugly Yupoo titles). Fires a notification on new submission.
- **All Items** — filter by friend / status / seller.
- **Orders** — Superbuy order tracking, warehouse consolidation, per-friend shipping.
- **Friends** — generate/revoke per-friend links, see who owes what.
- **Catalog** — publish/unpublish, rename, set per-item markup.

## 5. Pricing model
- **Curated shop items:** displayed price = **cost × 1.20** (20% markup), converted to **USD**, margin invisible. Per-item override allowed.
- **Friend-pasted links** (they already saw a source price): **quoted manually** at order time — no hidden markup possible, treated as a favor.
- **Shipping:** friends' international shipping billed per-parcel; margin handling stays manual/off-app for now. No automated fee engine in v2.
- **Payment:** money **up front** — friend confirms → pays (manual: Venmo/Revolut) → admin marks paid → order placed.

## 6. Order lifecycle
`requested` (friend submits) → admin reviews/names/prices/orders on Superbuy → `ordered` → `in warehouse` → consolidate → `shipped` (+ tracking) to friend's saved address. Same Superbuy delivery-order flow as the Brooklyn parcels, destination = each friend's address; everything pools in the warehouse until shipped.

## 7. Data model (Supabase / Postgres)
- `users` — id, name, login token (per-friend), email (admin), shipping_address (private), currency, is_admin
- `items` — id, owner→users, source_link, title (cleaned), image_urls, price/cost, markup, seller, size_options, chosen_size, status, published, notes
- `orders` — id, superbuy_order_no, cost breakdown, item refs
- `payments` — user, amount, paid?, method, date
- `sellers` — brand → seller mapping (powers the no-match fallback search)
- `status_events` — item status timeline ("X → warehouse at [ts]") = the "know when things are coming in" feed
- `notifications` — logged/deduped admin pings

Images move to **Supabase storage** (no more local git image dumps). v1 `owners:[...]` field ports directly to the users↔items relationship.

## 8. Tech stack
- **Next.js** (already on 16) + **Supabase** (Postgres + Auth + Storage)
- **Keep the `add-haul-item` scrape pipeline** → becomes the `/request` endpoint (Yupoo/Weidian/Taobao/Superbuy-wrapper → clean card)
- **Notifications:** Supabase insert → Edge Function → email (Resend) or Telegram bot ping to admin on new request

## 9. MVP scope (in)
Per-friend links · Shop (browse+search+brand chips) · Request (paste→scrape) · My Orders (status timeline) · Admin inbox/items/orders/friends/catalog · 20% markup on curated items · manual payment · per-friend shipping · admin notifications.

## 10. Out / backlog (phase 2)
- **Consistent flatlay product images** (reuse the `rondorff-campaign-batch` image-gen pipeline) — make the shop look like a real e-boutique.
- Automated fee/shipping engine · Stripe · real friend accounts · analytics.

## 11. Build process
1. ✅ Snapshot v1 (`v1-snapshot` tag) — done.
2. Install **superpowers** (Claude Code plugin) — brainstorm→plan→subagent-build→review methodology.
3. Turn this brief into a **task plan** (2–5 min tasks).
4. **Build `/v2` with a fleet of agents**, subagent-driven, with a clean-up pass.

## 12. Open/deferred
- Currency conversion source (fixed rate vs live FX) — decide at build.
- Whether "mark as paid" is friend-initiated or admin-only — lean admin-confirms.
