import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFriendsWithHaulCounts } from "@/lib/data";
import { createFriend } from "@/app/admin/friends/actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  handle:
    "Handle must be lowercase letters/numbers/dashes, 2–20 chars, and not reserved",
  taken: "That handle is already taken",
  name: "Name is required",
};

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const { created, error } = await searchParams;

  const sb = createAdminClient();
  const [{ count: products }, { count: pub }, { count: requests }, friends] =
    await Promise.all([
      sb.from("products").select("*", { count: "exact", head: true }),
      sb
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("published", true),
      sb
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("status", "requested"),
      getFriendsWithHaulCounts(),
    ]);

  const errorMessage = error
    ? (ERROR_MESSAGES[error] ?? "Something went wrong")
    : null;

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-[0.25em]">
        HaulHQ — HQ
      </h1>

      {created && (
        <div className="mb-6 rounded border border-green-600/40 bg-green-50 px-4 py-3 text-sm text-green-800">
          Friend added — their link:{" "}
          <a href={`/${created}`} className="font-medium underline">
            /{created}
          </a>
        </div>
      )}

      {errorMessage && (
        <div className="mb-6 rounded border border-red-600/40 bg-red-50 px-4 py-3 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      <div className="mb-10 flex gap-10 text-sm">
        <p>
          {products ?? 0} products ({pub ?? 0} visible)
        </p>
        <p>{requests ?? 0} open requests</p>
      </div>

      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
          Friends &amp; their hauls
        </h2>
        {friends.length === 0 ? (
          <p className="text-sm text-neutral-500">No friends yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs uppercase tracking-widest text-neutral-500">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Handle</th>
                <th className="py-2 pr-4 font-medium">Link</th>
                <th className="py-2 pr-4 font-medium">Items</th>
                <th className="py-2 font-medium">Haul</th>
              </tr>
            </thead>
            <tbody>
              {friends.map((f) => (
                <tr key={f.id} className="border-b border-neutral-100">
                  <td className="py-2 pr-4">{f.name}</td>
                  <td className="py-2 pr-4 text-neutral-500">
                    {f.handle ? `@${f.handle}` : "—"}
                  </td>
                  <td className="py-2 pr-4">
                    {f.handle ? (
                      <a href={`/${f.handle}`} className="underline">
                        /{f.handle}
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-2 pr-4">{f.haul_count}</td>
                  <td className="py-2">
                    {f.handle ? (
                      <a
                        href={`/admin/friends/${f.handle}`}
                        className="text-xs uppercase tracking-widest underline"
                      >
                        View haul →
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mb-12">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
          Add a friend
        </h2>
        <form action={createFriend} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            name="name"
            placeholder="Name"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="text"
            name="handle"
            placeholder="handle (e.g. jan)"
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            className="rounded bg-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white"
          >
            Add friend
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
          Manage
        </h2>
        <Link
          href="/admin/products"
          className="inline-block text-xs uppercase tracking-widest underline"
        >
          Manage products →
        </Link>
        <Link
          href="/admin/cleanup"
          className="ml-6 inline-block text-xs uppercase tracking-widest underline"
        >
          Cleanup: brands & titles →
        </Link>
      </section>
    </main>
  );
}
