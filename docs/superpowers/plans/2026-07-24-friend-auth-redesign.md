# Friend Auth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the name-based magic-link friend login with anonymous `u#####` IDs + self-set passwords (bcrypt-hashed, admin never sees them), keeping the existing cookie session.

**Architecture:** Add `password_hash` + `setup_token` columns to `friends`, drop `email`. Admin creates a friend with a private name label; the app generates a `u#####` handle + one-time `setup_token` and shows a `/setup/<token>` link to send. The friend sets a password there (bcrypt hash stored), which sets the same `friend_token` cookie the app already uses. Returning friends log in at `/login` with ID + password. `getCurrentFriend()` is unchanged.

**Tech Stack:** Next.js 16.2.10 App Router (async params, server actions, `src/proxy.ts` middleware), Supabase (admin client, project `pqfiwdscftwhmcutspay`), `bcryptjs` for hashing, `node:test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-07-24-friend-auth-redesign-design.md`

## Global Constraints

- Run npm/tsc from `web-v2/`; commit from repo root; never `--no-verify`.
- **Read `node_modules/next/dist/docs/`** guides before writing route/action/page code (this Next version differs from training data).
- Identity always comes from the `friend_token` cookie via `getCurrentFriend()`, never the URL handle (IDOR rule).
- **No personal data:** no `email` column; `name` is an admin-only private label, NEVER rendered on any friend-facing page or URL; no name field in `shipping_address`; no "Hampus" anywhere (already swept to "Admin").
- **Passwords** are bcrypt-hashed via `bcryptjs`; never store, log, or return plaintext.
- **IDs** are `"u"` + 5 random digits (e.g. `u28736`), unique across `friends.handle`.
- **Admin login stays password-only** (`ADMIN_PASSWORD`); `ADMIN_EMAIL` is unused and gets removed. (Spec said "username + password" but the code has no username/email in login, so password-only already meets the "no admin email" goal.)
- Supabase writes via `createAdminClient()` from `@/lib/supabase/admin`.
- `npm test` runs `node --test "src/lib/**/*.test.*" "scripts/lib/**/*.test.*"`; keep `*.test.ts` files excluded from tsc.
- **Deploy note:** `main` auto-deploys to haulhq.shop. After merge, remove `ADMIN_EMAIL` from the Vercel project's env (it's harmless but stale). No new runtime env vars are introduced.

---

### Task 1: Schema migration + deps + types + auth lib (TDD)

**Files:**
- Create: `supabase/migrations/0014_friend_auth.sql`
- Create: `web-v2/src/lib/auth.ts`
- Create: `web-v2/src/lib/auth.test.ts`
- Modify: `web-v2/src/lib/types.ts` (Friend interface)
- Modify: `web-v2/package.json` (add bcryptjs)

**Interfaces:**
- Consumes: nothing.
- Produces (used by Tasks 2-4):
  - `randomUserId(rand?: () => number): string` → `"u" + 5 digits`
  - `randomToken(): string` → 32 hex chars
  - `hashPassword(pw: string): Promise<string>`
  - `verifyPassword(pw: string, hash: string): Promise<boolean>`
  - `Friend` gains `password_hash: string | null`, `setup_token: string | null`; loses `email`.

- [ ] **Step 1: Apply the migration.** Use Supabase MCP `apply_migration` (load via ToolSearch `select:mcp__supabase__apply_migration`), name `friend_auth`, query:

```sql
alter table public.friends add column if not exists password_hash text;
alter table public.friends add column if not exists setup_token text;
alter table public.friends drop column if exists email;
```

Also write the same SQL to `supabase/migrations/0014_friend_auth.sql` (repo record; highest prior is `0013_onboarded_at.sql`).

- [ ] **Step 2: Verify columns.** MCP `execute_sql`: `select column_name from information_schema.columns where table_name='friends' and column_name in ('password_hash','setup_token','email');`
Expected: `password_hash` and `setup_token` present, `email` absent.

- [ ] **Step 3: Install bcryptjs.** From `web-v2/`: `npm install bcryptjs@^2.4.3 && npm install -D @types/bcryptjs@^2.4.6`. Verify `grep bcryptjs package.json` shows both.

- [ ] **Step 4: Write the failing tests.** `web-v2/src/lib/auth.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUserId, randomToken, hashPassword, verifyPassword } from "./auth.ts";

test("randomUserId is 'u' + exactly 5 digits", () => {
  assert.equal(randomUserId(() => 0), "u10000");
  assert.equal(randomUserId(() => 0.9999999), "u99999");
  assert.match(randomUserId(), /^u\d{5}$/);
});

test("randomToken is 32 hex chars and unique", () => {
  const a = randomToken(), b = randomToken();
  assert.match(a, /^[0-9a-f]{32}$/);
  assert.notEqual(a, b);
});

test("password hashes, verifies, and never equals plaintext", async () => {
  const h = await hashPassword("hunter2");
  assert.notEqual(h, "hunter2");
  assert.equal(await verifyPassword("hunter2", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
});
```

- [ ] **Step 5: Run tests, verify they fail.** `cd web-v2 && npm test` → FAIL (cannot find `./auth.ts`).

- [ ] **Step 6: Implement `web-v2/src/lib/auth.ts`.**

```ts
// Friend password + id helpers. Pure (no next/headers) so it stays unit-testable.
// Passwords are bcrypt-hashed; the admin/db never sees plaintext.
import bcrypt from "bcryptjs";

// Anonymous login id: "u" + 5 digits (10000-99999). Not a secret — it's a
// username; the password is the secret. `rand` is injectable for tests.
export function randomUserId(rand: () => number = Math.random): string {
  return "u" + String(10000 + Math.floor(rand() * 90000));
}

// One-time token for the send-yourself setup/reset link.
export function randomToken(): string {
  return crypto.randomUUID().replace(/-/g, "");
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}
```

- [ ] **Step 7: Update `web-v2/src/lib/types.ts` Friend interface.** Remove the `email` line; add the two fields. The interface becomes (change only these lines):

```ts
  // email removed — no personal data stored.
  password_hash: string | null;
  setup_token: string | null;
```

(Delete the existing `email: string | null;` line.)

- [ ] **Step 8: Run tests + typecheck.** `cd web-v2 && npm test` → all pass (3 new + existing). `npx tsc --noEmit` → clean. If tsc flags a `friend.email` use anywhere, note it for Task 5 (should only be admin page).

- [ ] **Step 9: Commit.**

```bash
git add supabase/migrations/0014_friend_auth.sql web-v2/src/lib/auth.ts web-v2/src/lib/auth.test.ts web-v2/src/lib/types.ts web-v2/package.json web-v2/package-lock.json
git commit -m "feat(v2): friend auth schema + bcrypt auth lib (TDD)"
```

---

### Task 2: Admin friend management (create / reset / delete)

**Files:**
- Modify: `web-v2/src/app/admin/friends/actions.ts`
- Modify: `web-v2/src/app/admin/page.tsx` (the admin friends screen + create form + banner)

**Interfaces:**
- Consumes: `randomUserId`, `randomToken` from `@/lib/auth` (Task 1); `createAdminClient`.
- Produces: `createFriend`, `resetFriendPassword`, `deleteFriend` server actions. `createFriend`/`resetFriendPassword` redirect to `/admin?setup=<token>&id=<handle>` so the page can show the setup link.

- [ ] **Step 0: Read** `web-v2/src/app/admin/page.tsx` fully to see the current create form (`name` + `handle` inputs), the `created`/`error` banner, and the friends list (renders `f.handle`, maybe `f.name`).

- [ ] **Step 1: Rewrite `createFriend` + add `resetFriendPassword` + `deleteFriend`** in `web-v2/src/app/admin/friends/actions.ts`. Replace the existing `createFriend` and add a private `uniqueUserId` helper + the imports:

```ts
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { randomUserId, randomToken } from "@/lib/auth";

async function uniqueUserId(
  sb: ReturnType<typeof createAdminClient>,
): Promise<string> {
  for (let i = 0; i < 25; i++) {
    const id = randomUserId();
    const { data } = await sb
      .from("friends")
      .select("id")
      .eq("handle", id)
      .maybeSingle();
    if (!data) return id;
  }
  throw new Error("could not generate a unique id");
}

// Create a friend: `name` is a PRIVATE admin-only label (never shown publicly).
// Generates the anonymous u##### id + a one-time setup token, then shows the
// admin a /setup/<token> link to send.
export async function createFriend(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin?error=name");

  const sb = createAdminClient();
  const handle = await uniqueUserId(sb);
  const setup_token = randomToken();
  const { error } = await sb.from("friends").insert({
    name,
    handle,
    active: true,
    access_token: randomUUID(),
    setup_token,
  });
  if (error) redirect("/admin?error=save");
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&id=${handle}`);
}

// Issue a fresh setup link so the friend can set a new password. The old
// password keeps working until they complete the new setup (we don't clear it).
export async function resetFriendPassword(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  const setup_token = randomToken();
  await sb.from("friends").update({ setup_token }).eq("handle", id);
  revalidatePath("/admin");
  redirect(`/admin?setup=${setup_token}&id=${id}`);
}

export async function deleteFriend(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const sb = createAdminClient();
  await sb.from("friends").delete().eq("handle", id).eq("is_admin", false);
  revalidatePath("/admin");
  redirect("/admin");
}
```

Keep the existing `toggleSource` and `setAdminNote` actions in the file unchanged.

- [ ] **Step 2: Update the admin create form + banner** in `web-v2/src/app/admin/page.tsx`:
  - Change `searchParams` type to include `setup?: string; id?: string` (keep `error`).
  - Replace the create form so it has a single `name` input (label: "Name (private, only you see this)") and the `createFriend` action. **Remove the `handle` input entirely.**
  - Replace the success banner: when `setup` and `id` are present, show the copyable setup link. Use this block:

```tsx
{setup && id && (
  <div className="mb-6 border border-neutral-300 p-3 text-sm">
    <p>
      Created <span className="font-medium">{id}</span>. Send them this
      one-time setup link:
    </p>
    <code className="mt-2 block break-all rounded bg-neutral-100 px-2 py-1 text-xs">
      https://haulhq.shop/setup/{setup}
    </code>
  </div>
)}
```

  - In the friends list rows, next to each `f.handle`, add a **Reset** and **Delete** control (import `resetFriendPassword`, `deleteFriend`):

```tsx
<form action={resetFriendPassword} className="inline">
  <input type="hidden" name="id" value={f.handle ?? ""} />
  <button className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black">
    Reset password
  </button>
</form>
<form action={deleteFriend} className="inline">
  <input type="hidden" name="id" value={f.handle ?? ""} />
  <button className="text-[10px] uppercase tracking-widest text-red-400 hover:text-red-700">
    Delete
  </button>
</form>
```

  - If the current page renders `f.email` anywhere, remove that (column is gone). `f.name` may stay (admin-only label).

- [ ] **Step 3: Typecheck + lint.** `cd web-v2 && npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 4: Commit.**

```bash
git add "web-v2/src/app/admin/friends/actions.ts" "web-v2/src/app/admin/page.tsx"
git commit -m "feat(v2): admin creates anonymous friends w/ setup link + reset/delete"
```

---

### Task 3: Set-password flow (`/setup/[token]`)

**Files:**
- Create: `web-v2/src/app/setup/[token]/page.tsx`
- Create: `web-v2/src/app/setup/[token]/actions.ts`

**Interfaces:**
- Consumes: `hashPassword` from `@/lib/auth`; `createAdminClient`.
- Produces: `/setup/<token>` page + `setPassword` action that sets `password_hash`, clears `setup_token`, sets the `friend_token` cookie, and redirects into the app.

- [ ] **Step 0: Read** `web-v2/src/app/f/[token]/route.ts` to copy the exact `friend_token` cookie options (httpOnly, sameSite lax, secure in prod, path "/", maxAge 1yr).

- [ ] **Step 1: Create `web-v2/src/app/setup/[token]/actions.ts`.**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPassword } from "@/lib/auth";

export async function setPassword(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const pw = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (pw.length < 6) redirect(`/setup/${token}?error=short`);
  if (pw !== confirm) redirect(`/setup/${token}?error=match`);

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("access_token, handle, onboarded_at")
    .eq("setup_token", token)
    .maybeSingle();
  if (!friend) redirect(`/setup/${token}?error=invalid`);

  await sb
    .from("friends")
    .update({ password_hash: await hashPassword(pw), setup_token: null })
    .eq("setup_token", token);

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(
    friend.onboarded_at ? `/${friend.handle}/shop` : `/${friend.handle}/welcome`,
  );
}
```

- [ ] **Step 2: Create `web-v2/src/app/setup/[token]/page.tsx`.**

```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import { setPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function SetupPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  const sb = createAdminClient();
  const { data } = await sb
    .from("friends")
    .select("handle")
    .eq("setup_token", token)
    .maybeSingle();

  if (!data) {
    return (
      <main className="mx-auto max-w-xs px-6 py-24 text-sm text-neutral-500">
        This link is invalid or has already been used. Ask for a new one.
      </main>
    );
  }

  const msg =
    error === "short"
      ? "Password must be at least 6 characters."
      : error === "match"
        ? "Passwords don't match."
        : error === "invalid"
          ? "This link is no longer valid."
          : null;

  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Create your password
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        Your ID is <span className="font-medium text-black">{data.handle}</span>.
        You&apos;ll use it to sign in.
      </p>
      <form action={setPassword} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="confirm"
          placeholder="Confirm password"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Set password
        </button>
        {msg && <p className="text-xs text-red-600">{msg}</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Typecheck + lint.** `cd web-v2 && npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 4: Commit.**

```bash
git add "web-v2/src/app/setup"
git commit -m "feat(v2): /setup/[token] set-password page + action"
```

---

### Task 4: Login + logout

**Files:**
- Create: `web-v2/src/app/login/page.tsx`
- Create: `web-v2/src/app/login/actions.ts`
- Modify: `web-v2/src/components/FriendHeader.tsx` (logout link)

**Interfaces:**
- Consumes: `verifyPassword` from `@/lib/auth`; `createAdminClient`.
- Produces: `/login` page, `loginFriend` + `logout` actions.

- [ ] **Step 1: Create `web-v2/src/app/login/actions.ts`.**

```ts
"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPassword } from "@/lib/auth";

export async function loginFriend(formData: FormData) {
  const id = String(formData.get("id") ?? "").trim().toLowerCase();
  const pw = String(formData.get("password") ?? "");

  const sb = createAdminClient();
  const { data: friend } = await sb
    .from("friends")
    .select("access_token, handle, password_hash, onboarded_at, active")
    .eq("handle", id)
    .maybeSingle();

  // Generic failure for missing user / no password / wrong password — no enumeration.
  if (
    !friend ||
    !friend.active ||
    !friend.password_hash ||
    !(await verifyPassword(pw, friend.password_hash))
  ) {
    redirect("/login?error=1");
  }

  (await cookies()).set("friend_token", friend.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(
    friend.onboarded_at ? `/${friend.handle}/shop` : `/${friend.handle}/welcome`,
  );
}

export async function logout() {
  (await cookies()).delete("friend_token");
  redirect("/login");
}
```

- [ ] **Step 2: Create `web-v2/src/app/login/page.tsx`.**

```tsx
import { loginFriend } from "./actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ
      </h1>
      <form action={loginFriend} className="space-y-3">
        <input
          name="id"
          placeholder="Your ID (e.g. u28736)"
          autoFocus
          autoCapitalize="none"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Sign in
        </button>
        {error && <p className="text-xs text-red-600">Wrong ID or password.</p>}
      </form>
    </main>
  );
}
```

- [ ] **Step 3: Add a logout control to `web-v2/src/components/FriendHeader.tsx`.** Import `logout` and add, inside the `<nav>` after the Profile link:

```tsx
<form action={logout} className="inline">
  <button className="uppercase tracking-widest text-neutral-500 hover:text-black">
    Sign out
  </button>
</form>
```

Add `import { logout } from "@/app/login/actions";` at the top.

- [ ] **Step 4: Typecheck + lint.** `cd web-v2 && npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 5: Commit.**

```bash
git add "web-v2/src/app/login" web-v2/src/components/FriendHeader.tsx
git commit -m "feat(v2): friend /login (id + password) + logout"
```

---

### Task 5: Routing + privacy cleanup

**Files:**
- Delete: `web-v2/src/app/f/[token]/route.ts` (and the empty `f/[token]`/`f` dirs)
- Modify: `web-v2/src/app/[handle]/layout.tsx` (unauth → `/login`)
- Modify: `web-v2/src/app/[handle]/page.tsx` (neutral greeting)
- Modify: `web-v2/src/app/[handle]/welcome/page.tsx` (neutral greeting)
- Modify: `web-v2/src/components/ProfileForm.tsx` (drop name field)

**Interfaces:**
- Consumes: nothing new.
- Produces: no magic-link route; unauthenticated `/[handle]/*` redirects to `/login`; no name shown on any friend page; no name field in the address form.

- [ ] **Step 1: Delete the magic-link route.** `git rm "web-v2/src/app/f/[token]/route.ts"` and remove the now-empty `web-v2/src/app/f` directory.

- [ ] **Step 2: Redirect unauthenticated friends to `/login`.** In `web-v2/src/app/[handle]/layout.tsx`, change the existing `redirect("/")` (the unauthorized branch) to `redirect("/login")`.

- [ ] **Step 3: Neutral greeting on `web-v2/src/app/[handle]/page.tsx`.** Replace `Hey {friend.name} 👋` with `Welcome 👋` (remove the `friend.name` reference so no private label is shown).

- [ ] **Step 4: Neutral greeting on `web-v2/src/app/[handle]/welcome/page.tsx`.** Remove the `firstName` line and change `Hi {firstName} — welcome.` to `Welcome.` (no name).

- [ ] **Step 5: Drop the name field from `web-v2/src/components/ProfileForm.tsx`.** Delete the "Full name" input block (the `<div className="sm:col-span-2"><span className={label}>Full name</span> ... setA("name") ... </div>`). Leave the rest of the address fields. The `name` key simply won't be collected into `shipping_address`.

- [ ] **Step 6: Grep guard.** `cd web-v2 && grep -rn "friend.name\|\.email\b\|Hi {firstName}\|Hey {friend" src/` → only admin-side `f.name` (private label) may remain; no friend-facing name usage, no `/f/` route.

- [ ] **Step 7: Typecheck + lint.** `cd web-v2 && npx tsc --noEmit && npm run lint` → clean.

- [ ] **Step 8: Commit.**

```bash
git add -A web-v2/src
git commit -m "feat(v2): remove magic-link, unauth->/login, strip names from friend UI"
```

---

### Task 6: End-to-end verification + env cleanup

**Files:** none (verification; fix + amend if issues found).

- [ ] **Step 1: Full build.** `cd web-v2 && npm run build` → succeeds; route list includes `/login` and `/setup/[token]`, and NO `/f/[token]`.

- [ ] **Step 2: Reset test data.** Via a node one-liner from `web-v2/` (Supabase MCP may be flaky): delete non-admin friends, then create one test friend through the flow. Use the admin client:

```bash
node -e 'Promise.all([import("./scripts/lib/env.mjs"),import("./scripts/lib/storage.mjs")]).then(async([{loadEnv},{adminClient}])=>{const db=adminClient(loadEnv(".env.local"));await db.from("friends").delete().eq("is_admin",false);console.log("cleared non-admin friends");})'
```

- [ ] **Step 3: Browser pass (Playwright MCP).** Start dev (`PORT=1500 npm run dev` if not running). Then:
  1. Log into `/admin/login` with `ADMIN_PASSWORD`; create a friend named "Test" → confirm a `/setup/<token>` link with a `u#####` id appears.
  2. Open that setup link → set a password (min 6) → land on `/{u#####}/welcome`.
  3. Sign out (header) → `/login`. Sign in with the `u#####` id + password → land on shop. Wrong password → "Wrong ID or password."
  4. Confirm no real name appears anywhere on the friend surface, and `/f/<anything>` 404s.
  5. In admin, hit "Reset password" on the friend → new setup link works; "Delete" removes them.

- [ ] **Step 4: Env cleanup.** Remove the stale `ADMIN_EMAIL` from `web-v2/.env.local`, and from the Vercel project (`cd web-v2 && vercel env rm ADMIN_EMAIL production --scope lideborgs-projects --yes` if it exists there; it may only be local). Admin login (password-only) is unaffected.

- [ ] **Step 5: Final check + commit any fixes.**

```bash
cd web-v2 && npm test && npx tsc --noEmit && npm run lint
git add -A && git commit -m "chore(v2): auth redesign e2e polish" # only if fixes were needed
```

## Notes for the deploy (after all tasks merge to main)

- `main` auto-deploys to haulhq.shop. No new runtime env vars are needed (bcryptjs is a dependency, not config).
- The admin will wipe + recreate real friends via the new flow after deploy.
- Later (separate work): automated invite/reset emails via Resend, once the domain's sending is verified.
