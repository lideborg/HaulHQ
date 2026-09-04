import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getHaulsWithItems } from "@/lib/data";
import { getViewer } from "@/lib/viewer";
import { estimateShipping } from "@/lib/shipping";
import { haulLabel, isUnavailable } from "@/lib/hauls";

export const dynamic = "force-dynamic";

const usd = (n: number) => `US$ ${Math.round(n)}`;
const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  ordered: "Ordered",
  shipped: "Shipped",
  arrived: "Arrived",
};

// Read-only view of an approved (past) haul. Same identity rule as the live
// haul page: the session viewer (view-as resolves to the impersonated friend).
export default async function PastHaulPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number: numberParam } = await params;
  const number = Number(numberParam);
  if (!Number.isInteger(number) || number < 1) notFound();

  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { friend } = viewer;

  const { open, past } = await getHaulsWithItems(friend.id);
  // The open haul lives at /haul, not here.
  if (open?.haul.number === number) redirect("/haul");
  const group = past.find((g) => g.haul.number === number);
  if (!group) notFound();

  const items = group.items;
  const qty = (i: (typeof items)[number]) => i.quantity ?? 1;
  // Items admin flagged "not available from seller" stay listed but count
  // toward nothing.
  const counted = items.filter((i) => !isUnavailable(i.status));
  const totalUnits = counted.reduce((s, i) => s + qty(i), 0);
  const totalCost = counted.reduce((s, i) => s + (i.quoted_price_usd ?? 0) * qty(i), 0);
  const totalGrams = counted.reduce((s, i) => s + (i.products?.weight_g ?? 0) * qty(i), 0);
  const shipping = estimateShipping(totalGrams);
  const approvedDate = group.haul.approved_at
    ? new Date(group.haul.approved_at).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Link
          href="/haul"
          className="text-[11px] uppercase tracking-widest text-neutral-400 underline hover:text-black"
        >
          ← Back to your haul
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {haulLabel(number)}
        </h1>
        <p className="mt-1 text-xs text-neutral-500">
          {approvedDate ? `Approved ${approvedDate} · ` : ""}
          {totalUnits} {totalUnits === 1 ? "item" : "items"} · locked in with
          admin
        </p>
      </div>

      <div className="border-t border-neutral-200">
        {items.map((item) => {
          const img = item.image_urls?.[0];
          const unavailable = isUnavailable(item.status);
          const name =
            item.products?.display_title ?? item.title ?? "Untitled";
          const productHref =
            item.products?.brand_slug && item.products?.code
              ? `/product/${item.products.brand_slug}/${item.products.code}`
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
                <p className="mt-0.5 text-[11px] text-neutral-500">
                  {item.chosen_size ? `Size ${item.chosen_size}` : "No size"}
                  {qty(item) > 1 ? ` · × ${qty(item)}` : ""}
                  {" · "}
                  {unavailable
                    ? "Not available from seller"
                    : (STATUS_LABEL[item.status ?? ""] ?? "Confirmed")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={`text-sm tabular-nums${unavailable ? " text-neutral-400" : ""}`}>
                  {unavailable
                    ? "—"
                    : item.quoted_price_usd != null
                      ? qty(item) > 1
                        ? `${usd(item.quoted_price_usd)} × ${qty(item)}`
                        : usd(item.quoted_price_usd)
                      : "Quote"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="ml-auto w-full max-w-sm space-y-1.5 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Items ({totalUnits})</span>
          <span className="tabular-nums">{usd(totalCost)}</span>
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
            {shipping
              ? `${usd(totalCost + shipping.lowUsd)}–${usd(totalCost + shipping.highUsd)}`
              : usd(totalCost)}
          </span>
        </div>
        <p className="pt-2 text-[10px] leading-relaxed text-neutral-400">
          Shipping settles at the real parcel weight. Final quote from Admin
          before anything ships.
        </p>
      </div>
    </div>
  );
}
