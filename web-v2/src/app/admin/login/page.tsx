import { login } from "./actions";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-6 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ Admin
      </h1>
      <form action={login} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full border border-neutral-300 px-3 py-2 text-sm"
        />
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Enter
        </button>
        {error && <p className="text-xs text-red-600">Wrong password.</p>}
      </form>
    </main>
  );
}
