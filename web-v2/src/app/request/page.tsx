import { Header } from "@/components/Header";
import { submitRequest } from "./actions";

export default async function RequestPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  return (
    <>
      <Header />
      <main className="mx-auto max-w-lg px-6 py-12">
        <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
          Request an item
        </h1>
        <p className="mb-8 text-xs text-neutral-500">
          Found something elsewhere? Paste the link — Admin will source it,
          price it, and add it to your orders.
        </p>
        {ok && (
          <p className="mb-6 border border-neutral-200 p-3 text-xs">
            Request received — it&apos;ll appear in your haul once Admin has priced it.
          </p>
        )}
        {error && (
          <p className="mb-6 border border-red-200 p-3 text-xs text-red-600">
            {error === "link"
              ? "That doesn't look like a link."
              : error === "session"
                ? "You're not signed in — open your personal invite link first, then resend."
                : "Something went wrong — try again."}
          </p>
        )}
        <form action={submitRequest} className="space-y-3">
          <input name="link" placeholder="https://…" className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <input name="size" placeholder="Size (optional)" className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <textarea name="note" placeholder="Anything else? (color, budget…)" rows={3} className="w-full border border-neutral-300 px-3 py-2 text-sm" />
          <button className="w-full bg-black py-3 text-xs uppercase tracking-widest text-white">
            Send request
          </button>
        </form>
      </main>
    </>
  );
}
