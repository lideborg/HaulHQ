import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SizeGuide } from "@/components/SizeGuide";
import { AddToHaul } from "@/components/AddToHaul";
import { getProductByCode } from "@/lib/data";

export const dynamic = "force-dynamic";

// Editorial split: on desktop the page itself never scrolls — the left half
// holds a framed hero (~80% of the half) with a compact white info card
// overlaid; only the right half scrolls, through smaller centered gallery
// images. Stacks and scrolls normally on mobile.
export default async function FriendProductPage({
  params,
}: {
  params: Promise<{ handle: string; brand: string; code: string }>;
}) {
  const { handle, brand, code } = await params;
  const product = await getProductByCode(code);
  if (!product) notFound();
  // The code alone resolves the product; keep the brand segment canonical.
  if (product.brand_slug && brand !== product.brand_slug) {
    redirect(`/${handle}/product/${product.brand_slug}/${code}`);
  }

  const price = product.sold_out
    ? "Sold out"
    : product.price_usd != null
      ? `US$ ${Math.round(product.price_usd)}`
      : "Quote on request";
  const name = product.display_title ?? product.title;
  const hero = product.image_urls?.[0];
  const rest = (product.image_urls ?? []).slice(1);

  return (
    <div className="-mx-6 -my-8 md:grid md:h-[calc(100vh-54px)] md:grid-cols-2 md:overflow-hidden">
      {/* left: framed hero, fixed on desktop */}
      <div className="relative flex items-center justify-center p-6 md:h-full md:p-10">
        <Link
          href={`/${handle}/shop`}
          className="absolute left-6 top-5 text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black"
        >
          ← Shop
        </Link>

        <div className="relative w-[80%] border border-neutral-200 bg-neutral-50 p-2">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt={name}
              className="max-h-[72vh] w-full object-cover"
            />
          ) : (
            <div className="flex h-72 items-center justify-center text-[10px] uppercase tracking-widest text-neutral-300">
              No image
            </div>
          )}

          {/* compact info card straddling the frame's bottom edge */}
          <div className="absolute bottom-0 left-1/2 w-[78%] max-w-[280px] -translate-x-1/2 translate-y-[35%] bg-white p-4 text-left text-black shadow-[0_2px_20px_rgba(0,0,0,0.10)]">
            <p className="text-[9px] font-semibold uppercase tracking-[0.22em]">
              {product.brand}
            </p>
            <p className="mt-1 text-sm font-medium tracking-tight">{name}</p>
            <p className="mt-0.5 text-xs text-neutral-600">{price}</p>
            {!product.sold_out && (
              <div className="mt-3">
                <AddToHaul
                  handle={handle}
                  productId={product.id}
                  sizes={product.size_options ?? []}
                />
              </div>
            )}
            <details className="group mt-3 border-t border-neutral-100 pt-2">
              <summary className="cursor-pointer list-none text-[10px] uppercase tracking-widest text-neutral-500 hover:text-black">
                Size guide{" "}
                <span className="text-neutral-300 group-open:hidden">+</span>
                <span className="hidden text-neutral-300 group-open:inline">−</span>
              </summary>
              {product.size_guide ? (
                <div className="mt-1 max-h-48 overflow-y-auto">
                  <SizeGuide guide={product.size_guide} />
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-neutral-400">
                  Size guide not available yet.
                </p>
              )}
            </details>
          </div>
        </div>
      </div>

      {/* right: only this pane scrolls on desktop */}
      <div className="bg-white md:h-full md:overflow-y-auto">
        <div className="flex flex-col items-center gap-10 px-6 py-10">
          {rest.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${name} — ${i + 2}`}
              className="w-[65%] bg-neutral-100 object-cover"
              loading="lazy"
            />
          ))}
          {rest.length === 0 && (
            <div className="flex h-40 items-center justify-center text-[10px] uppercase tracking-widest text-neutral-300">
              One photo for this one
            </div>
          )}
        </div>
        <div className="space-y-3 px-10 pb-16">
          {product.display_title && (
            <p className="text-[11px] leading-relaxed text-neutral-400">
              {product.title}
            </p>
          )}
          {product.description && (
            <p className="text-[11px] leading-relaxed text-neutral-500">
              {product.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
