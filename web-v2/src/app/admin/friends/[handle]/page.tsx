import Link from "next/link";
import { notFound } from "next/navigation";
import { getFriendByHandle, getHaul } from "@/lib/data";
import { toggleSource, setAdminNote, unlockHaul } from "@/app/admin/friends/actions";

export const dynamic = "force-dynamic";

export default async function FriendHaulPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const friend = await getFriendByHandle(handle);
  if (!friend) notFound();
  const items = await getHaul(friend.id);

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <Link
        href="/admin"
        className="text-[11px] uppercase tracking-tight text-neutral-400 underline"
      >
        ← Back to HQ
      </Link>
      <h1 className="mb-2 mt-3 text-sm font-semibold uppercase tracking-tight">
        {friend.name}&rsquo;s haul
      </h1>
      <p className="mb-6 text-xs text-neutral-500">
        {items.length} {items.length === 1 ? "pick" : "picks"}
      </p>

      {items.some((i) => i.status === "confirmed") && (
        <div className="mb-10 flex flex-wrap items-center gap-4 border border-neutral-300 bg-neutral-50 px-4 py-3 text-xs">
          <span className="font-semibold uppercase tracking-tight">
            Haul confirmed
          </span>
          <span className="text-neutral-500">
            {items.filter((i) => i.status === "confirmed").length} item(s)
            approved by {friend.name} — locked on their side.
          </span>
          <form action={unlockHaul}>
            <input type="hidden" name="handle" value={handle} />
            <button className="border border-neutral-300 px-3 py-1 text-[10px] uppercase tracking-tight hover:border-black">
              Unlock haul
            </button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-start gap-5 border-b border-neutral-100 pb-4"
          >
            {item.image_urls?.[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_urls[0]}
                alt={item.title ?? ""}
                className="h-56 w-56 shrink-0 bg-neutral-100 object-contain"
              />
            ) : (
              <div className="h-56 w-56 shrink-0 bg-neutral-100" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-tight text-neutral-400">
                {item.brand ?? "—"}
              </p>
              <p className="mt-1 text-sm">{item.title ?? "Untitled"}</p>
              <p className="mt-1 text-[11px] text-neutral-400">
                {item.chosen_size ? `Size ${item.chosen_size} · ` : ""}
                {(item.quantity ?? 1) > 1 ? `Qty ${item.quantity} · ` : ""}
                {item.quoted_price_usd != null
                  ? `US$ ${Math.round(item.quoted_price_usd)}`
                  : "Quote on request"}
                {item.status === "confirmed" ? " · CONFIRMED" : ""}
              </p>

              <div className="mt-3 flex flex-wrap items-start gap-3">
                <form action={toggleSource}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="handle" value={handle} />
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

                <form action={setAdminNote} className="flex flex-1 gap-2">
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="handle" value={handle} />
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
        ))}
        {items.length === 0 && (
          <p className="text-xs text-neutral-400">No picks yet.</p>
        )}
      </div>
    </main>
  );
}
