import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { tokenExpired } from "@/lib/auth";
import { resetPassword } from "./actions";

export const dynamic = "force-dynamic";

export default async function ResetPage({
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
    .select("reset_token_expires")
    .eq("reset_token", token)
    .maybeSingle();
  // Transient DB error must not read as "your link is dead" — error boundary.
  if (dbError) throw dbError;

  if (!data || tokenExpired(data.reset_token_expires)) {
    return (
      <main className="mx-auto max-w-xs px-6 py-24">
        <p className="text-sm text-neutral-500">
          This reset link is no longer valid — it may have expired or already
          been used.
        </p>
        <Link
          href="/forgot"
          className="mt-6 block w-full bg-black py-2 text-center text-xs uppercase tracking-widest text-white"
        >
          Request a new link
        </Link>
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
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.25em]">
        Choose a new password
      </h1>
      <form action={resetPassword} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <input
          type="password"
          name="password"
          placeholder="New password"
          autoFocus
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
          Save password
        </button>
      </form>
    </main>
  );
}
