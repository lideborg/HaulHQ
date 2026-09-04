import Link from "next/link";
import { notFound } from "next/navigation";
import { getFriendById, getHaulsWithItems } from "@/lib/data";
import {
  toggleSource,
  setAdminNote,
  unlockHaul,
  toggleUnavailable,
} from "@/app/admin/friends/actions";
import { viewAsFriend } from "@/app/admin/view-actions";
import { haulLabel, isUnavailable } from "@/lib/hauls";

export const dynamic = "force-dynamic";

const approvedDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

export default async function FriendHaulPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const friend = await getFriendById(id);
  if (!friend) notFound();
  const { open, past } = await getHaulsWithItems(friend.id);
  const sections = [...(open ? [open] : []), ...past];
  const totalPicks = sections.reduce((s, g) => s + g.items.length, 0);

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <Link
        href="/admin"
        className="text-[11px] uppercase tracking-tight text-neutral-400 underline"
      >
        ← Back to HQ
      </Link>
      <h1 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-tight">
        {friend.name}&rsquo;s hauls
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        {totalPicks} {totalPicks === 1 ? "pick" : "picks"} across{" "}
        {sections.length} {sections.length === 1 ? "haul" : "hauls"}
      </p>

      {sections.map((group) => (
        <section key={group.haul.id} className="mb-10">
          <div className="mb-3 flex flex-wrap items-center gap-3 border-b border-neutral-300 pb-2">
            <span className="text-xs font-semibold uppercase tracking-tight">
              {haulLabel(group.haul.number)}
            </span>
            <span className="text-xs text-neutral-500">
              {group.haul.status === "open"
                ? "open · being built"
                : `approved ${approvedDate(group.haul.approved_at)}`}
              {" · "}
              {group.items.length} {group.items.length === 1 ? "pick" : "picks"}
            </span>
            {group.haul.status === "approved" && (
              <form action={unlockHaul}>
                <input type="hidden" name="friend_id" value={friend.id} />
                <input type="hidden" name="haul_id" value={group.haul.id} />
                <button className="border border-neutral-300 px-3 py-1 text-[10px] uppercase tracking-tight hover:border-black">
                  Unlock haul
                </button>
              </form>
            )}
          </div>
          {group.items.length === 0 && (
            <p className="text-xs text-neutral-400">Empty.</p>
          )}
          <div className="space-y-4">
            {group.items.map((item) => {
              const unavailable = isUnavailable(item.status);
              return (
          <div
            key={item.id}
            className="flex items-start gap-5 border-b border-neutral-100 pb-4"
          >
            {item.image_urls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_urls[0]}
                alt={item.title ?? ""}
                className={`h-56 w-56 shrink-0 bg-neutral-100 object-contain${unavailable ? " opacity-40" : ""}`}
              />
            ) : (
              <div className="h-56 w-56 shrink-0 bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-tight text-neutral-400">
                {item.brand ?? "—"}
              </p>
              <p className={`mt-1 text-sm${unavailable ? " text-neutral-400 line-through" : ""}`}>
                {item.title ?? "Untitled"}
              </p>
              {unavailable && (
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-tight text-amber-700">
                  Not available from seller
                </p>
              )}
              <p className="mt-1 text-[11px] text-neutral-400">
                {item.chosen_size ? `Size ${item.chosen_size} · ` : ""}
                {(item.quantity ?? 1) > 1 ? `Qty ${item.quantity} · ` : ""}
                {item.quoted_price_usd != null
                  ? `US$ ${Math.round(item.quoted_price_usd)}`
                  : "Quote on request"}
                {item.status === "confirmed" ? " · CONFIRMED" : ""}
              </p>

              {(item.source_link ||
                (item.products?.code && item.products?.brand_slug)) && (
                <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px]">
                  {item.source_link && (
                    <a
                      href={item.source_link}
                      target="_blank"
                      rel="noreferrer"
                      className="max-w-full truncate text-blue-600 underline"
                    >
                      View source ↗
                    </a>
                  )}
                  {item.products?.code && item.products?.brand_slug && (
                    <form action={viewAsFriend} className="inline">
                      <input type="hidden" name="id" value={friend.id} />
                      <input
                        type="hidden"
                        name="next"
                        value={`/product/${item.products.brand_slug}/${item.products.code}`}
                      />
                      <button className="text-neutral-500 underline">
                        View in shop ↗
                      </button>
                    </form>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-start gap-3">
                <form action={toggleSource}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="friend_id" value={friend.id} />
                  <button
                    className={
                      item.to_source
                        ? "bg-black px-5 py-2 text-[11px] uppercase tracking-tight text-white"
                        : "border border-neutral-300 px-5 py-2 text-[11px] uppercase tracking-tight"
                    }
                  >
                    {item.to_source ? "✓ Sourcing" : "I'll source this"}
                  </button>
                </form>

                <form action={toggleUnavailable}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="friend_id" value={friend.id} />
                  <button
                    className={
                      unavailable
                        ? "border border-amber-600 px-5 py-2 text-[11px] uppercase tracking-tight text-amber-700"
                        : "border border-neutral-300 px-5 py-2 text-[11px] uppercase tracking-tight text-neutral-500 hover:border-amber-600 hover:text-amber-700"
                    }
                  >
                    {unavailable ? "↩ Restore" : "Mark unavailable"}
                  </button>
                </form>

                <form action={setAdminNote} className="flex flex-1 gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="friend_id" value={friend.id} />
                  <textarea
                    name="note"
                    rows={2}
                    defaultValue={item.admin_note ?? ""}
                    placeholder="Private note…"
                    className="min-w-0 flex-1 border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <button className="self-start bg-black px-5 py-2 text-[11px] uppercase tracking-tight text-white">
                    Save note
                  </button>
                </form>
              </div>
            </div>
          </div>
              );
            })}
          </div>
        </section>
      ))}
      {sections.length === 0 && (
        <p className="text-xs text-neutral-400">No picks yet.</p>
      )}
    </main>
  );
}
