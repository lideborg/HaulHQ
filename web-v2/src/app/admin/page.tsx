import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getFriendsWithHaulCounts } from "@/lib/data";
import {
  createFriend,
  resetFriendPassword,
  deleteFriend,
} from "@/app/admin/friends/actions";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  name: "Name is required",
  save: "Something went wrong saving, try again",
  "has-orders":
    "That friend has order or payment history, so they can't be deleted. Deactivate them instead if needed.",
};

export default async function AdminHome({
  searchParams,
}: {
  searchParams: Promise<{ setup?: string; id?: string; error?: string; action?: string }>;
}) {
  const { setup, id, error, action } = await searchParams;

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

      {setup && id && (
        <div className="mb-6 border border-neutral-300 p-3 text-sm">
          <p>
            {action === "reset" ? (
              <>
                New setup link for <span className="font-medium">{id}</span>. Send it to them:
              </>
            ) : (
              <>
                Created <span className="font-medium">{id}</span>. Send them this
                one-time setup link:
              </>
            )}
          </p>
          <code className="mt-2 block break-all rounded bg-neutral-100 px-2 py-1 text-xs">
            https://haulhq.shop/setup/{setup}
          </code>
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
        <Link href="/admin/inbox" className="underline">
          {requests ?? 0} open requests
        </Link>
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
                <th className="py-2 pr-4 font-medium">Haul</th>
                <th className="py-2 font-medium">Actions</th>
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
                  <td className="py-2 pr-4">
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
                  <td className="py-2">
                    {/* The delete action refuses admin rows — don't render a
                        button that silently no-ops. */}
                    {f.is_admin ? (
                      <span className="text-[10px] uppercase tracking-widest text-neutral-300">
                        You
                      </span>
                    ) : (
                      <div className="flex gap-3">
                        <form action={resetFriendPassword} className="inline">
                          <input type="hidden" name="id" value={f.handle ?? ""} />
                          <button className="text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black">
                            Reset password
                          </button>
                        </form>
                        <form action={deleteFriend} className="inline">
                          <input type="hidden" name="id" value={f.handle ?? ""} />
                          <button className="text-[10px] uppercase tracking-widest text-red-400 hover:text-red-700">
                            Delete
                          </button>
                        </form>
                      </div>
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
            placeholder="Name (private, only you see this)"
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
      </section>
    </main>
  );
}
