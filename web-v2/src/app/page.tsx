import { Header } from "@/components/Header";
import { BrandSidebar } from "@/components/BrandSidebar";
import { ProductCard } from "@/components/ProductCard";
import { getPublishedProducts, getBrands } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string }>;
}) {
  const { brand } = await searchParams;
  const [products, brands] = await Promise.all([
    getPublishedProducts(brand),
    getBrands(),
  ]);

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-8 md:flex-row">
        <BrandSidebar brands={brands} active={brand} />
        <section className="flex-1">
          {brand && (
            <p className="mb-6 text-[11px] uppercase tracking-widest text-neutral-500">
              {brand} · {products.length} item{products.length === 1 ? "" : "s"}
            </p>
          )}
          {products.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing here yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
