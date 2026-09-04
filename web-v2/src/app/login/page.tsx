import Link from "next/link";
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
        {/* type="text" not "email": legacy friends may still sign in with their
            old anonymous ID, which a browser email validator would reject. */}
        <input
          name="email"
          type="text"
          inputMode="email"
          placeholder="Email"
          autoFocus
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="username"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoComplete="current-password"
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        {error && <p className="text-xs text-red-600">Wrong email or password.</p>}
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Sign in
        </button>
      </form>
      <p className="mt-6 text-[11px] text-neutral-400">
        <Link href="/forgot" className="underline hover:text-black">
          Forgot your password?
        </Link>
      </p>
    </main>
  );
}
