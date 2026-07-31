import Link from "next/link";
import { redirect } from "next/navigation";
import { getFriendByHandle, getHaul } from "@/lib/data";
import { getCurrentFriend } from "@/lib/friend";
import { isAdmin } from "@/lib/adminAuth";
import { estimateShipping } from "@/lib/shipping";
import { removeFromHaul } from "@/app/[handle]/haul-actions";

export const dynamic = "force-dynamic";

const usd = (n: number) => `US$ ${Math.round(n)}`;
const grams = (g: number | null | undefined) =>
  g == null ? "—" : g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;

export default async function HaulPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // Identity from the cookie, not the URL — same ownership rule as the write
  // actions. An admin session may view (not edit) any friend's haul.
  const cookieFriend = await getCurrentFriend();
  const own = cookieFriend != null && cookieFriend.handle === handle;
  const friend = own
    ? cookieFriend
    : (await isAdmin())
      ? await getFriendByHandle(handle)
      : null;
  if (!friend) redirect("/");
  const items = await getHaul(friend.id);

  const totalCost = items.reduce((s, i) => s + (i.quoted_price_usd ?? 0), 0);
  const unpriced = items.filter((i) => i.quoted_price_usd == null).length;
  const totalGrams = items.reduce((s, i) => s + (i.products?.weight_g ?? 0), 0);
  const unweighed = items.filter((i) => i.products?.weight_g == null).length;
  const shipping = estimateShipping(totalGrams);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Haul{items.length > 0 ? ` (${items.length})` : ""}
      </h1>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing in your haul yet.{" "}
          <Link href={`/${handle}/shop`} className="underline">
            Browse the shop →
          </Link>
        </p>
      ) : (
        <>
          {/* line items, checkout style */}
          <div className="border-t border-neutral-200">
            {items.map((item) => {
              const img = item.image_urls?.[0];
              const sourcing = item.status === "sourcing";
              const linkHost = (() => {
                try {
                  return item.source_link ? new URL(item.source_link).hostname : null;
                } catch {
                  return null;
                }
              })();
              const name =
                item.products?.display_title ?? item.title ?? linkHost ?? "Untitled";
              const productHref =
                item.products?.brand_slug && item.products?.code
                  ? `/${handle}/product/${item.products.brand_slug}/${item.products.code}`
                  : null;
              return (
                <div
                  key={item.id}
                  className="flex items-center gap-4 border-b border-neutral-100 py-3"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden bg-neutral-100">
                    {img ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img} alt={name} className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                      {item.brand ?? "—"}
                    </p>
                    {productHref ? (
                      <Link href={productHref} className="block truncate text-sm hover:underline">
                        {name}
                      </Link>
                    ) : (
                      <p className="truncate text-sm">{name}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      {sourcing
                        ? "Finding the details…"
                        : `${item.chosen_size ? `Size ${item.chosen_size}` : "No size"} · ~${grams(item.products?.weight_g)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm tabular-nums">
                      {item.quoted_price_usd != null
                        ? usd(item.quoted_price_usd)
                        : sourcing
                          ? "Price coming"
                          : "Quote"}
                    </p>
                    {own && (
                      <form action={removeFromHaul.bind(null, handle, item.id)}>
                        <button
                          type="submit"
                          className="mt-1 text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black"
                        >
                          Remove
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* totals, spreadsheet style */}
          <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Items ({items.length})</span>
              <span className="tabular-nums">
                {usd(totalCost)}
                {unpriced > 0 ? ` + ${unpriced} unquoted` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Approx. weight</span>
              <span className="tabular-nums">
                {shipping ? `~${shipping.chargeableKg.toFixed(1)} kg` : "—"}
                {unweighed > 0 ? ` (${unweighed} unknown)` : ""}
              </span>
            </div>
            <div className="flex justify-between border-b border-neutral-200 pb-2">
              <span className="text-neutral-500">Est. shipping (EMS)</span>
              <span className="tabular-nums">
                {shipping ? `${usd(shipping.lowUsd)}–${usd(shipping.highUsd)}` : "—"}
              </span>
            </div>
            <div className="flex justify-between pt-1 font-semibold">
              <span>Estimated total</span>
              <span className="tabular-nums">
                {/* Unweighed/unpriced items contribute 0, so the number is a
                    floor, not a range midpoint — say "from". */}
                {unweighed > 0 || unpriced > 0 ? "from " : ""}
                {shipping
                  ? `${usd(totalCost + shipping.lowUsd)}–${usd(totalCost + shipping.highUsd)}`
                  : usd(totalCost)}
              </span>
            </div>
            <p className="pt-2 text-[10px] leading-relaxed text-neutral-400">
              Weights are estimates; shipping is based on past EMS parcels to the
              US and settles at the real parcel weight. Final quote from Admin
              before anything ships.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
