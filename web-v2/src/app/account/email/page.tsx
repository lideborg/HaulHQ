import { redirect } from "next/navigation";
import { getCurrentFriend } from "@/lib/friend";
import { saveEmail } from "./actions";

export const dynamic = "force-dynamic";

export default async function AccountEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const friend = await getCurrentFriend();
  if (!friend) redirect("/login");
  if (friend.email) redirect("/shop");

  const msg =
    error === "format"
      ? "Enter a valid email address."
      : error === "taken"
        ? "That email is already in use."
        : null;

  return (
    <main className="mx-auto max-w-xs px-6 py-24">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Add your email
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        Signing in now works with your email address. Add yours once and use it
        with your existing password from here on.
      </p>
      <form action={saveEmail} className="space-y-3">
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
        {msg && <p className="text-xs text-red-600">{msg}</p>}
        <button className="w-full bg-black py-2 text-xs uppercase tracking-widest text-white">
          Save
        </button>
      </form>
    </main>
  );
}
