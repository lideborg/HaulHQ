# Email-based friend auth + transactional email (Resend)

**Goal:** Friends log in with **email + password** (no visible usernames/IDs anywhere), URLs stop identifying the person (`/shop` not `/u38403/shop`), password reset is self-serve via email, and a welcome email confirms signup. Sending goes through Resend on the verified `haulhq.shop` domain.

**Approved by Hampus 2026-09-04** (conversation). Supersedes the handle-login part of `2026-07-24-friend-auth-redesign-design.md`; the invite-link + self-set-password + cookie-session mechanics from that design stay.

## Decisions (locked)

1. **Login = email + password.** Single "Email" field + password. Error copy: `Wrong email or password.`
2. **Invite flow unchanged mechanically.** Admin types a private name, gets a `/setup/<token>` link, sends it himself (WhatsApp etc.). No email needed at invite time.
3. **Setup page = email + password only.** No username field. Email is required and becomes the login credential. After setup: log them in and send the **welcome email**.
4. **Self-serve password reset.** Login page links to `/forgot`; friend enters email; if it matches a friend, they get a reset link (60-min, single-use). `/reset/<token>` sets the new password and logs them in. Response is identical whether the email exists or not ("If that email has an account, we sent a link."). Admin's manual reset-link button in `/admin` stays as backup.
5. **Session-based URLs.** All friend pages move from `/[handle]/…` to top-level: `/shop`, `/haul`, `/haul/[number]`, `/welcome`, `/profile`, `/factories`, `/product/[brand]/[code]`, `/` (home). Who you are comes from the existing `friend_token` cookie. Old `/<handle>/…` links 307-redirect to the same path without the first segment.
6. **Handle survives only as hidden legacy plumbing.** 16/29 live friends have no email but do have passwords. Login lookup: case-insensitive email match first, then exact `handle` match (invisible, undocumented). After login, a friend with `email IS NULL` is gated to a small "add your email" form before reaching the shop. Handle is removed from every UI surface and URL; the column stays until everyone has an email.
7. **Email infra = Resend.** Domain `haulhq.shop` added + DNS (DKIM/SPF/DMARC) live on Vercel DNS (done 2026-09-04, verification pending→auto). From-addresses: `HaulHQ <hello@haulhq.shop>` for account emails now; `orders@haulhq.shop` reserved for order/QC updates later. Copy says "admin", never a personal name; no em dashes in copy.

## Non-goals (this build)

- Inbound email / `info@` inbox forwarding (decide Resend Receiving vs ImprovMX later).
- Broadcast/marketing emails (Resend Broadcasts exists; nothing to build).
- Admin "view as friend" impersonation (admin lost the `/{handle}` shortcut; acceptable, admin pages already show hauls).
- Order-update / QC emails (parked with the QC-in-cart feature).
- Rate limiting beyond single-use + expiring tokens.

## Schema (live DB `pqfiwdscftwhmcutspay`, table `friends`)

Existing relevant columns: `email text NULL`, `handle text NULL`, `password_hash`, `setup_token`, `access_token`, `active`, `onboarded_at`.

Migration `friend_email_auth`:
```sql
alter table friends
  add column if not exists reset_token text,
  add column if not exists reset_token_expires timestamptz;
create unique index if not exists friends_email_unique
  on friends (lower(email)) where email is not null;
```
Emails are stored trimmed + lowercased at write time. Setup/reset actions must reject an email already used by another friend (`That email is already in use.`).

## Routing & middleware

- New route group `src/app/(friend)/` with a layout that resolves the friend from the `friend_token` cookie (existing auth lib) and `redirect("/login")` when absent/inactive. The 8 pages move here unchanged except: no `params.handle`; friend comes from the layout/session helper; internal links lose the handle prefix.
- `middleware.ts`: for a path whose first segment is not reserved (`shop, haul, welcome, profile, factories, product, login, logout, setup, forgot, reset, account, admin, api, _next`, files with a dot), redirect to the path minus the first segment (covers every legacy `/<handle>/…` link, including bare `/<handle>` → `/`).
- `/account/email`: the post-login gate page for legacy friends with no email (form: email; validates uniqueness; then continues to `/shop`).

## Email sending (`src/lib/email.ts`)

- `resend` npm package; `RESEND_API_KEY` env (dev `.env.local` + Vercel project env before deploy).
- `sendWelcomeEmail(to)` and `sendResetEmail(to, resetUrl)`; plain HTML strings (no react-email dep), minimal black-on-white styling matching the site's tone.
- Guard: if `RESEND_API_KEY` unset, log the would-be email to console and continue (dev-safe, never blocks auth flows). Send failures are logged, never break the user flow.
- Base URL from `NEXT_PUBLIC_SITE_URL ?? "https://haulhq.shop"`.

## Flows (exact)

- **Login `/login`:** fields Email (`type=email` but no `required` so legacy handles pass browser validation; label stays "Email"), Password. Action: normalize input; lookup by `lower(email)`, else by `handle`; verify bcrypt; set `friend_token` cookie; redirect `/welcome` if `onboarded_at` null else `/shop`; if `email` null → `/account/email` first. Footer link: `Forgot your password?` → `/forgot`.
- **Setup `/setup/[token]`:** fields Email, Password, Confirm. Validates: email format, uniqueness, pw ≥ 6, match. Writes `email`, `password_hash`, clears `setup_token`, sets cookie, sends welcome email, redirects as today.
- **Forgot `/forgot`:** field Email. Action: always render "If that email has an account, we sent a reset link." If matched: set `reset_token` (crypto random), `reset_token_expires = now()+1h`, send reset email with `/reset/<token>`.
- **Reset `/reset/[token]`:** valid+unexpired token → Password/Confirm form; on submit: update `password_hash`, clear reset columns, set cookie, redirect `/shop`. Invalid/expired → message + link to `/forgot`.
- **Admin `/admin`:** friend rows stop linking to `/{handle}` and stop displaying handles; show name + email (or "no email"). Create-friend and reset-password keep producing `/setup/…` links (reset button now also clears `reset_token`). `randomUserId`/username-picking code is deleted; new friends get `handle = null`.

## Testing & verification

- `node --test` unit tests (existing pattern, e.g. `src/lib/auth.test.ts`): email normalization, lookup order (email-then-handle), token expiry logic, middleware path-stripping decisions, email-template rendering includes the reset URL.
- Browser E2E on `localhost:3000` (Playwright MCP, per repro-before-PR practice): login with email (Stephanie test clone), legacy-handle login + email gate, full forgot→reset roundtrip (token from DB), setup link flow, legacy URL redirect `/u38403/shop → /shop`.
- Real email verification: one welcome + one reset sent to Hampus's own address once Resend verifies.

## Rollout

1. Merge + deploy (Vercel env var `RESEND_API_KEY` added first).
2. Existing sessions keep working (cookie unchanged). Friends with emails can log in with them immediately; legacy-handle logins keep working silently.
3. No announcement needed; the gate collects missing emails organically.
