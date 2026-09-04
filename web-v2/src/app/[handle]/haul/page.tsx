import Link from "next/link";
import { redirect } from "next/navigation";
import { getFriendByHandle, getHaulsWithItems } from "@/lib/data";
import { getCurrentFriend } from "@/lib/friend";
import { isAdmin } from "@/lib/adminAuth";
import { estimateShipping } from "@/lib/shipping";
import { removeFromHaul, approveHaul } from "@/app/[handle]/haul-actions";
import { QuantityStepper } from "@/components/QuantityStepper";
import { haulLabel, LOCKED_STATUSES, isUnavailable } from "@/lib/hauls";
import type { HaulGroup } from "@/lib/hauls";

export const dynamic = "force-dynamic";

const usd = (n: number) => `US$ ${Math.round(n)}`;
const grams = (g: number | null | undefined) =>
  g == null ? "—" : g >= 1000 ? `${(g / 1000).toFixed(1)} kg` : `${g} g`;
const LOCKED = new Set(LOCKED_STATUSES);
const approvedDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HaulPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  // Only trust a sane haul number in the success note (query param is
  // user-editable).
  const approvedNum = Number(one(sp.approved));
  const justApproved =
    Number.isInteger(approvedNum) && approvedNum > 0 ? approvedNum : null;
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
  const { open, past } = await getHaulsWithItems(friend.id);
  const items = open?.items ?? [];
  // No open haul yet (fresh friend, or right after approving): show the
  // number the next add will start.
  const currentNumber = open?.haul.number ?? (past[0]?.haul.number ?? 0) + 1;

  const qty = (i: (typeof items)[number]) => i.quantity ?? 1;
  // Items admin flagged "not available from seller" stay visible as a record
  // but count toward nothing — totals, weight, and Approve all ignore them.
  const counted = items.filter((i) => !isUnavailable(i.status));
  const totalCost = counted.reduce((s, i) => s + (i.quoted_price_usd ?? 0) * qty(i), 0);
  const totalUnits = counted.reduce((s, i) => s + qty(i), 0);
  const unpriced = counted.filter((i) => i.quoted_price_usd == null).length;
  const totalGrams = counted.reduce((s, i) => s + (i.products?.weight_g ?? 0) * qty(i), 0);
  const unweighed = counted.filter((i) => i.products?.weight_g == null).length;
  const shipping = estimateShipping(totalGrams);
  const editable = counted.filter((i) => !LOCKED.has(i.status ?? ""));

  const pastSummary = (g: HaulGroup) => {
    const units = g.items.reduce((s, i) => s + (i.quantity ?? 1), 0);
    const cost = g.items.reduce(
      (s, i) => s + (i.quoted_price_usd ?? 0) * (i.quantity ?? 1),
      0,
    );
    return { units, cost };
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        {haulLabel(currentNumber)}
        {totalUnits > 0 ? ` (${totalUnits})` : ""}
      </h1>

      {justApproved != null && (
        <p className="border border-neutral-200 bg-neutral-50 px-4 py-3 text-xs text-neutral-600">
          {haulLabel(justApproved)} approved and sent to admin. Anything new
          you add starts {haulLabel(currentNumber)}.
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Nothing in {haulLabel(currentNumber)} yet.{" "}
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
              const locked = LOCKED.has(item.status ?? "");
              const unavailable = isUnavailable(item.status);
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
                  <div
                    className={`h-16 w-16 shrink-0 overflow-hidden bg-neutral-100${unavailable ? " opacity-40" : ""}`}
                  >
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
                      <Link
                        href={productHref}
                        className={`block truncate text-sm hover:underline${unavailable ? " text-neutral-400 line-through" : ""}`}
                      >
                        {name}
                      </Link>
                    ) : (
                      <p className={`truncate text-sm${unavailable ? " text-neutral-400 line-through" : ""}`}>
                        {name}
                      </p>
                    )}
                    {unavailable ? (
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {item.chosen_size ? `Size ${item.chosen_size} · ` : ""}Reached
                        out to the factory — no reply
                      </p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-neutral-500">
                        {sourcing
                          ? "Finding the details…"
                          : `${item.chosen_size ? `Size ${item.chosen_size}` : "No size"} · ~${grams(item.products?.weight_g)}`}
                        {locked ? " · locked in" : ""}
                      </p>
                    )}
                    {own && !locked && !unavailable && (
                      <div className="mt-1.5">
                        <QuantityStepper
                          handle={handle}
                          itemId={item.id}
                          quantity={qty(item)}
                        />
                      </div>
                    )}
                    {locked && qty(item) > 1 && (
                      <p className="mt-1 text-[11px] text-neutral-500">× {qty(item)}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm tabular-nums${unavailable ? " text-neutral-400" : ""}`}
                    >
                      {unavailable
                        ? "—"
                        : item.quoted_price_usd != null
                          ? qty(item) > 1
                            ? `${usd(item.quoted_price_usd)} × ${qty(item)}`
                            : usd(item.quoted_price_usd)
                          : sourcing
                            ? "Price coming"
                            : "Quote"}
                    </p>
                    {own && (!locked || unavailable) && (
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

          <Link
            href={`/${handle}/shop`}
            className="inline-block text-[11px] uppercase tracking-widest text-neutral-500 underline hover:text-black"
          >
            + Add more from the shop
          </Link>

          {/* totals, spreadsheet style */}
          <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Items ({totalUnits})</span>
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
            {own && editable.length > 0 && (
              <form action={approveHaul.bind(null, handle)} className="pt-3">
                <label className="block pb-2">
                  <span className="mb-1 block text-[10px] leading-relaxed text-neutral-500">
                    Add your email and we&apos;ll update you as your items
                    arrive at the warehouse.
                  </span>
                  <input
                    type="email"
                    name="email"
                    defaultValue={friend?.email ?? ""}
                    placeholder="you@email.com"
                    autoComplete="email"
                    className="w-full border border-neutral-300 px-3 py-2 text-[12px] outline-none focus:border-black"
                  />
                </label>
                <button
                  type="submit"
                  className="w-full border border-black py-2.5 text-[11px] uppercase tracking-widest transition hover:bg-black hover:text-white"
                >
                  Approve {haulLabel(currentNumber)}
                </button>
                <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-400">
                  Locks in these items and sends your haul to admin for ordering.
                </p>
              </form>
            )}
            <p className="pt-2 text-[10px] leading-relaxed text-neutral-400">
              Weights are estimates; shipping is based on past EMS parcels to the
              US and settles at the real parcel weight. Final quote from Admin
              before anything ships.
            </p>
          </div>
        </>
      )}

      {past.length > 0 && (
        <div className="border-t border-neutral-200 pt-6">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-neutral-400">
            Past hauls
          </h2>
          <div className="space-y-1">
            {past.map((g) => {
              const { units, cost } = pastSummary(g);
              return (
                <Link
                  key={g.haul.id}
                  href={`/${handle}/haul/${g.haul.number}`}
                  className="flex items-baseline justify-between border-b border-neutral-100 py-2.5 text-sm hover:bg-neutral-50"
                >
                  <span className="font-medium">{haulLabel(g.haul.number)}</span>
                  <span className="text-xs text-neutral-500">
                    Approved {approvedDate(g.haul.approved_at)} · {units}{" "}
                    {units === 1 ? "item" : "items"} · {usd(cost)} →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
