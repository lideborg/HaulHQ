import Link from "next/link";
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
  const { data, error: dbError } = await sb
    .from("friends")
    .select("id")
    .eq("setup_token", token)
    .maybeSingle();
  // A transient DB error must NOT tell the friend their valid link is dead —
  // throw to the error boundary ("try again") instead.
  if (dbError) throw dbError;

  if (!data) {
    // A spent setup link is the common case here: the friend already finished
    // setup and re-tapped the same link. Don't dead-end them; send them to
    // sign in with the account they already made.
    return (
      <main className="mx-auto max-w-xs px-6 py-24">
        <p className="text-sm text-neutral-500">
          This link has already been used. If you already set up your account,
          just sign in below. Otherwise ask the admin for a new link.
        </p>
        <Link
          href="/login"
          className="mt-6 block w-full bg-black py-2 text-center text-xs uppercase tracking-widest text-white"
        >
          Sign in
        </Link>
      </main>
    );
  }

  const msg =
    error === "short"
      ? "Password must be at least 6 characters."
      : error === "match"
        ? "Passwords don't match."
        : error === "email"
          ? "Enter a valid email address."
          : error === "taken"
            ? "That email is already in use."
            : error === "invalid"
              ? "This link is no longer valid."
              : null;

  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Set up your account
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        Your email and a password are all you need to sign in.
      </p>
      <form action={setPassword} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <input
          type="email"
          name="email"
          required
          placeholder="Email"
          autoFocus
          autoComplete="email"
          autoCapitalize="none"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="new-password"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="confirm"
          placeholder="Confirm password"
          autoComplete="new-password"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Create account
        </button>
      </form>
      <p className="mt-6 text-[11px] text-neutral-400">
        You can always come back and sign in at{" "}
        <span className="text-neutral-600">haulhq.shop</span> with these.
      </p>
    </main>
  );
}
