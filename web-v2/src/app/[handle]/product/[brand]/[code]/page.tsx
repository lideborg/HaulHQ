import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SizeGuide } from "@/components/SizeGuide";
import { AddToHaul } from "@/components/AddToHaul";
import { StackedGallery } from "@/components/StackedGallery";
import { getProductByCode } from "@/lib/data";
import { getCurrentFriend } from "@/lib/friend";
import { recommendSize } from "@/lib/sizing";

export const dynamic = "force-dynamic";

// Clean two-column layout: left column stacks every image full-width (click any
// to zoom full-screen); right column is a sticky info panel (brand, title,
// price, size + add-to-haul, size guide) that never covers the images.
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

  // Size recommendations are personal to the friend on their OWN surface.
  const friend = await getCurrentFriend();
  const own = friend != null && friend.handle === handle;
  const hasProfile =
    own &&
    friend!.measurements != null &&
    Object.keys(friend!.measurements).length > 0;
  const recommended = hasProfile
    ? recommendSize(friend!.measurements, product)
    : null;

  const price = product.sold_out
    ? "Sold out"
    : product.price_usd != null
      ? `US$ ${Math.round(product.price_usd)}`
      : "Quote on request";
  const name = product.display_title ?? product.title;
  const images = product.image_urls ?? [];

  return (
    <div className="mx-auto max-w-[1180px] md:grid md:grid-cols-[1.5fr_1fr] md:gap-14">
      {/* left: back link + stacked images */}
      <div>
        <Link
          href={`/${handle}/shop`}
          className="mb-4 inline-block text-[10px] uppercase tracking-widest text-neutral-400 hover:text-black"
        >
          ← Shop
        </Link>
        <StackedGallery images={images} alt={name} />
      </div>

      {/* right: sticky info panel */}
      <div className="mt-8 md:mt-0">
        <div className="md:sticky md:top-8">
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-neutral-500">
            {product.brand}
          </p>
          <h1 className="mt-2 text-lg font-medium tracking-tight">{name}</h1>
          <p className="mt-1 text-sm text-neutral-600">{price}</p>

          {!product.sold_out && (
            <div className="mt-6 max-w-xs">
              <AddToHaul
                handle={handle}
                productId={product.id}
                sizes={product.size_options ?? []}
                recommended={recommended}
                profileHref={own && !hasProfile ? `/${handle}/profile` : null}
              />
            </div>
          )}

          {product.size_guide && (
            <div className="mt-6 max-w-xs border-t border-neutral-200 pt-4">
              <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
                Size guide
              </p>
              <SizeGuide guide={product.size_guide} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
