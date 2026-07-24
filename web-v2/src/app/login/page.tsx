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
        {error && <p className="text-xs text-red-600">Wrong ID or password.</p>}
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Sign in
        </button>
      </form>
    </main>
  );
}
