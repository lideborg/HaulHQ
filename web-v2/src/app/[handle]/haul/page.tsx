import { redirect } from "next/navigation";
import { getHaul } from "@/lib/data";
import { getCurrentFriend } from "@/lib/friend";
import { removeFromHaul } from "@/app/[handle]/haul-actions";

export const dynamic = "force-dynamic";

export default async function HaulPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  // Identity from the cookie, not the URL — same ownership rule as the
  // write actions. The layout gates too; this keeps the page safe standalone.
  const friend = await getCurrentFriend();
  if (!friend || friend.handle !== handle) redirect("/");
  const items = await getHaul(friend.id);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Your Haul</h1>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing in your haul yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => {
            const img = item.image_urls?.[0];
            const price =
              item.quoted_price_usd != null
                ? `US$ ${Math.round(item.quoted_price_usd)}`
                : "Quote on request";
            return (
              <div key={item.id} className="group block">
                <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={item.title ?? ""}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>
                <div className="mt-3 space-y-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide">
                    {item.brand}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-neutral-500">
                    {item.title}
                  </p>
                  <p className="text-[11px]">{price}</p>
                  {item.chosen_size ? (
                    <p className="text-[11px] uppercase tracking-wide text-neutral-500">
                      Size {item.chosen_size}
                    </p>
                  ) : null}
                </div>
                <form action={removeFromHaul.bind(null, handle, item.id)}>
                  <button
                    type="submit"
                    className="mt-2 text-[11px] uppercase tracking-widest text-neutral-500 hover:text-black"
                  >
                    Remove
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
