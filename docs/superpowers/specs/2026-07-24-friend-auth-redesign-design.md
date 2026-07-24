# Friend Auth Redesign — Anonymous IDs + Self-Set Passwords

**Date:** 2026-07-24
**Status:** Approved by user (chat), pending spec review
**Scope:** web-v2 (Next.js 16 + Supabase, project ref `pqfiwdscftwhmcutspay`), live at haulhq.shop

## Purpose

Replace the current name-based magic-link login with **anonymous numeric IDs +
self-set passwords**. Goals: no personal data (no emails anywhere), friends log
in with a `u#####` ID + a password the admin can never see, and nothing public
ever exposes a real name (including the admin's).

## Current state (what we're replacing)

- `friends` table: `id, name, email, access_token, shipping_address, currency,
  is_admin, active, created_at, measurements, handle, onboarded_at`.
- Friends have **no password**. Login = magic link `/f/<access_token>` which sets
  an httpOnly `friend_token` cookie. `getCurrentFriend()` (`src/lib/friend.ts`)
  resolves that cookie → friend by `access_token`.
- `handle` is a human name (`hampus`, `avivaben`); URLs are `/{handle}/shop` etc.
- Admin login (`/admin/login`) uses `ADMIN_EMAIL` + `ADMIN_PASSWORD`.

## Chosen approach (Option 1: build on existing setup)

Hash passwords into a new column on `friends`, keep the existing cookie session.
NOT Supabase Auth (email-centric, would need synthetic emails + RLS rewrite).
Password is one-way hashed with **bcrypt** (`bcryptjs`, pure-JS, runs on Vercel),
so the admin/db never sees plaintext.

## Data model changes

Migration `00NN_friend_passwords.sql` on `friends`:
- **Add** `password_hash text` (null until the friend sets one).
- **Add** `setup_token text` (one-time code for the setup/reset link; cleared on use).
- **Drop** `email` (no emails anywhere). Clear any existing values first.
- **Keep** `name` — repurposed as a **private admin-only label** (e.g. "Jan").
  Never rendered publicly, never in a URL, admin panel only.
- `handle` now holds the `u#####` ID.
- `access_token` is repurposed as the **session token** (the value stored in the
  `friend_token` cookie). It stays per-friend and stable; it is no longer put in
  any URL. `getCurrentFriend()` is unchanged.

`shipping_address` jsonb: **drop the `name` field**. Address only (`line1, line2,
city, region, postal, country, phone?`). At fulfilment the admin supplies the
recipient name from the private label / their own record of who they invited.

## ID generation

`u` + 5 random digits (e.g. `u28736`). Helper `generateUserId()` in
`src/lib/handles.ts`: loops until it finds a value not already used as a `handle`
(collision check against `friends`). Anonymous, does not leak member count.

## Flows

### Invite (admin, option B — no email dependency)
1. Admin `/admin/friends`: enters a **name label** (e.g. "Jan"). No email field.
2. Action generates `handle = u#####`, `setup_token = random`, inserts the friend
   (`password_hash` null, `active` true, `onboarded_at` null).
3. Admin is shown a ready-made **setup link**: `haulhq.shop/setup/<setup_token>`
   to copy and send however they like.

### Set password (friend, first time) — `/setup/[token]`
1. Friend opens the link. Page looks up the friend by `setup_token` (404 if
   missing/used).
2. "Welcome — create your password." Friend submits a password (min length, confirm).
3. Action: `password_hash = bcrypt(password)`, `setup_token = null`, sets the
   `friend_token` cookie (= `access_token`), redirects to `/{handle}/welcome`.

### Login (returning friend) — `/login`
1. Fields: **ID** (`u#####`) + **password**. No email.
2. Action: look up friend by `handle`, `bcrypt.compare(password, password_hash)`.
   Generic "Wrong ID or password" on any failure (no user enumeration).
3. On success: set `friend_token` cookie, redirect to `/{handle}/shop`.

### Logout
Add a **Logout** link in `FriendHeader` → server action clears the `friend_token`
cookie → redirect to `/login`. (None exists today.)

### Forgot password (admin reset, until email exists)
Admin `/admin/friends` row → "Reset password" → generates a new `setup_token`,
shows a fresh setup link to send. The friend's old password stops working once
they complete the new setup. (Self-service email reset is out of scope, see below.)

## Routing changes

- `/[handle]/*` is unchanged in structure; `handle` is now `u#####`. Ownership
  checks (`friend.handle === handle`) work as-is.
- **Remove** `/f/[token]` (magic link) route.
- **Add** `/login` and `/setup/[token]` (both public, outside the `[handle]` layout).
- Unauthenticated access to `/[handle]/*` redirects to `/login` (today it goes `/`).

## Admin login change

- Switch `/admin/login` to **username + password**: replace `ADMIN_EMAIL` env with
  `ADMIN_USERNAME` (e.g. `admin`); keep `ADMIN_PASSWORD`. Removes the admin email
  from the system. Update `src/lib/adminAuth.ts` + the login form + Vercel env vars.

## Privacy / no-name sweep

- No "Hampus" anywhere in user-facing copy — already swept to "Admin"
  (haul/shop/request pages). Keep it that way.
- The private `name` label is never rendered on any friend-facing page or URL.
- Friend-facing greetings that currently print a name (`/[handle]` "Hey {name}",
  `/welcome` "Hi {name}") switch to a neutral greeting (e.g. "Welcome") so no name
  is shown. (A friend seeing their own label is harmless, but neutral keeps the
  anonymous model consistent and avoids showing an admin nickname back to them.)

## Migration

The admin will **delete the current 4 friends and recreate them** via the new
invite flow. So: no data migration needed. The migration SQL just alters the
schema; existing rows can be removed by the admin (or a one-line cleanup).

## Testing

- Unit (`node --test`): `generateUserId()` format + collision retry; bcrypt
  hash/verify round-trip; login rejects wrong password and unknown ID identically.
- Manual (browser): create friend in admin → copy setup link → set password →
  land on welcome → logout → login with ID+password → shop; wrong password
  rejected; admin "reset password" issues a working new link; `/f/<token>` gone;
  no name/email visible anywhere public.

## Out of scope (later)

- **Automated invite/reset emails** via Resend (needs domain verification on
  haulhq.shop). This build is manual setup links only.
- Supabase Auth migration + database RLS.
- Rate limiting / lockout on the login form (add if abuse appears).
