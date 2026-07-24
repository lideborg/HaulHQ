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
