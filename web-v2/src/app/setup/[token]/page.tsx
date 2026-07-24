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
        : error === "format"
          ? "Username must be 3-20 characters: lowercase letters, numbers, dashes."
          : error === "reserved"
            ? "That username is reserved. Pick another."
            : error === "taken"
              ? "That username is taken. Pick another."
              : error === "invalid"
                ? "This link is no longer valid."
                : null;

  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Set up your account
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        Pick a username to sign in with, or keep the private one below. Then
        choose a password.
      </p>
      <form action={setPassword} className="space-y-3">
        <input type="hidden" name="token" value={token} />
        <div>
          <input
            name="username"
            defaultValue={data.handle ?? ""}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full border border-neutral-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-[10px] text-neutral-400">
            Keep this for a private, hard-to-guess sign-in, or replace it with
            your own.
          </p>
        </div>
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
    </main>
  );
}
