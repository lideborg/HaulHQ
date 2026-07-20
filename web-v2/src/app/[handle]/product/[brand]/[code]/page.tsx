import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SizeGuide } from "@/components/SizeGuide";
import { AddToHaul } from "@/components/AddToHaul";
import { getProductByCode } from "@/lib/data";

export const dynamic = "force-dynamic";

// Editorial split layout: left half is the hero, full viewport height and
// sticky, with a white info card overlaid ~80% down; right half is a white
// page the rest of the gallery scrolls through. -mx/-my escape the layout's
// container padding for a flush split.
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
    <div className="-mx-6 -my-8 grid md:grid-cols-2">
      {/* left: full-height hero with overlaid card */}
      <div className="relative h-[70vh] bg-neutral-100 md:sticky md:top-0 md:h-screen">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt={name} className="h-full w-full object-cover" />
        ) : null}

        <Link
          href={`/${handle}/shop`}
          className="absolute left-4 top-4 bg-white/85 px-3 py-1.5 text-[11px] uppercase tracking-widest text-black backdrop-blur-sm hover:bg-white"
        >
          ← Shop
        </Link>

        <div className="absolute bottom-[6%] left-1/2 w-[80%] max-w-md -translate-x-1/2 bg-white p-6 text-black shadow-[0_2px_24px_rgba(0,0,0,0.08)]">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em]">
            {product.brand}
          </p>
          <p className="mt-1.5 text-lg font-medium tracking-tight">{name}</p>
          <p className="mt-1 text-sm text-neutral-600">{price}</p>
          {!product.sold_out && (
            <div className="mt-5">
              <AddToHaul
                handle={handle}
                productId={product.id}
                sizes={product.size_options ?? []}
              />
            </div>
          )}
        </div>
      </div>

      {/* right: white page — rest of the gallery, then the details */}
      <div className="bg-white">
        <div className="flex flex-col gap-2 p-2 md:p-6">
          {rest.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${name} — ${i + 2}`}
              className="w-full bg-neutral-100 object-cover"
              loading="lazy"
            />
          ))}
          {rest.length === 0 && (
            <div className="flex h-64 items-center justify-center text-[11px] uppercase tracking-widest text-neutral-300">
              One photo for this one
            </div>
          )}
        </div>

        <div className="space-y-4 px-6 pb-16 md:px-10">
          {product.display_title && (
            <p className="text-xs leading-relaxed text-neutral-400">
              {product.title}
            </p>
          )}
          {product.description && (
            <p className="text-xs leading-relaxed text-neutral-500">
              {product.description}
            </p>
          )}
          {product.size_guide && <SizeGuide guide={product.size_guide} />}
        </div>
      </div>
    </div>
  );
}
