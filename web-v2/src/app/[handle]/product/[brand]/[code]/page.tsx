import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SizeGuide } from "@/components/SizeGuide";
import { ProductGallery } from "@/components/ProductGallery";
import { AddToHaul } from "@/components/AddToHaul";
import { getProductByCode } from "@/lib/data";

export const dynamic = "force-dynamic";

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

  return (
    <div className="mx-auto max-w-[1100px]">
      <Link
        href={`/${handle}/shop`}
        className="mb-6 inline-block text-[11px] uppercase tracking-widest text-neutral-400 hover:text-black"
      >
        ← Back to shop
      </Link>
      <div className="grid gap-10 md:grid-cols-2">
      <ProductGallery images={product.image_urls ?? []} alt={product.title} />

      <div className="self-start md:sticky md:top-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest">
            {product.brand}
          </p>
          <p className="text-sm text-neutral-600">
            {product.display_title ?? product.title}
          </p>
          <p className="text-sm">{price}</p>
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
        </div>
        {!product.sold_out && (
          <div className="mt-6">
            <AddToHaul
              handle={handle}
              productId={product.id}
              sizes={product.size_options ?? []}
            />
          </div>
        )}
        {product.size_guide && (
          <div className="mt-6">
            <SizeGuide guide={product.size_guide} />
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
