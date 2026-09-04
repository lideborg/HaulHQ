import Link from "next/link";
import { requestReset } from "./actions";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Reset password
      </h1>
      {sent ? (
        <p className="text-sm text-neutral-500">
          If that email has an account, we sent a reset link. Check your inbox
          (and spam) — the link works once and expires in 60 minutes.
        </p>
      ) : (
        <>
          <p className="mb-6 text-xs text-neutral-500">
            Enter your email and we&rsquo;ll send you a link to choose a new
            password.
          </p>
          <form action={requestReset} className="space-y-3">
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
            <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
              Send reset link
            </button>
          </form>
        </>
      )}
      <p className="mt-6 text-[11px] text-neutral-400">
        <Link href="/login" className="underline hover:text-black">
          Back to sign in
        </Link>
      </p>
    </main>
  );
}
