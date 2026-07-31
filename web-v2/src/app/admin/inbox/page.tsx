import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifySourceLink, superbuyWrap } from "@/lib/sourceLink";
import type { Friend, HaulItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Open friend requests (items submitted via /request, not yet priced/sourced).
export default async function InboxPage() {
  const sb = createAdminClient();
  const [{ data: requested, error }, { data: friends }] = await Promise.all([
    sb
      .from("items")
      .select("*")
      .in("status", ["requested", "sourcing"])
      .order("created_at", { ascending: false }),
    sb.from("friends").select("id, name, handle"),
  ]);
  if (error) throw error;
  const friendById = new Map(
    ((friends ?? []) as Pick<Friend, "id" | "name" | "handle">[]).map((f) => [f.id, f]),
  );
  const items = (requested ?? []) as HaulItem[];

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-tight">
        Inbox
      </h1>
      <p className="mb-8 text-xs text-neutral-500">
        {items.length} open request{items.length === 1 ? "" : "s"} — source it,
        import the link, then price it on the friend&rsquo;s haul.
      </p>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing waiting. 🎉</p>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const friend = friendById.get(item.owner_id);
            const src = item.source_link ? classifySourceLink(item.source_link) : null;
            const superbuy =
              src && (src.kind === "weidian" || src.kind === "taobao")
                ? superbuyWrap(src.url)
                : null;
            return (
              <div key={item.id} className="border-b border-neutral-100 pb-4">
                <p className="text-[11px] uppercase tracking-tight text-neutral-400">
                  {friend?.name ?? "Unknown friend"}
                  {friend?.handle ? ` · @${friend.handle}` : ""} ·{" "}
                  {new Date(item.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                  {item.status === "sourcing" ? " · sourcing…" : ""}
                </p>
                <p className="mt-1 break-all text-sm">
                  {item.source_link ? (
                    <a
                      href={item.source_link}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-neutral-500"
                    >
                      {item.source_link}
                    </a>
                  ) : (
                    item.title ?? "No link"
                  )}
                </p>
                <p className="mt-1 text-[11px] text-neutral-500">
                  {item.chosen_size ? `Size ${item.chosen_size}` : "No size given"}
                  {item.notes ? ` · “${item.notes}”` : ""}
                </p>
                {(item.sourcing_note || superbuy) && (
                  <p className="mt-1 text-[11px] text-neutral-500">
                    {item.sourcing_note}
                    {item.sourcing_note && superbuy ? " · " : ""}
                    {superbuy && (
                      <a
                        href={superbuy}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-black"
                      >
                        Open in Superbuy →
                      </a>
                    )}
                  </p>
                )}
                {friend?.handle && (
                  <Link
                    href={`/admin/friends/${friend.handle}`}
                    className="mt-2 inline-block text-[11px] uppercase tracking-tight underline"
                  >
                    Open {friend.name}&rsquo;s haul →
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
