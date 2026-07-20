import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { SizeGuide } from "@/components/SizeGuide";
import { ProductGallery } from "@/components/ProductGallery";
import { getProductById } from "@/lib/data";
import { isAdmin } from "@/lib/adminAuth";

// Admin/import preview only (the import-product skill opens this to verify a row).
export const dynamic = "force-dynamic";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();
  // Drafts are admin-only; this route sits outside the /admin proxy matcher.
  if (!product.published && !(await isAdmin())) notFound();

  const price = product.sold_out
    ? "Sold out"
    : product.price_usd != null
      ? `US$ ${Math.round(product.price_usd)}`
      : "Quote on request";

  return (
    <>
      <Header />
      <main className="mx-auto grid max-w-[1100px] gap-10 px-6 py-8 md:grid-cols-2">
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
          <div className="mt-6">
            {product.size_guide && <SizeGuide guide={product.size_guide} />}
          </div>
        </div>
      </main>
    </>
  );
}
