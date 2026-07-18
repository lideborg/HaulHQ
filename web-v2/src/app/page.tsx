import { Header } from "@/components/Header";
import { BrandSidebar } from "@/components/BrandSidebar";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { getPublishedProducts, getBrands, getCategories } from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/categories";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ brand?: string; category?: string }>;
}) {
  const { brand, category } = await searchParams;
  const [products, brands, categories] = await Promise.all([
    getPublishedProducts(brand, category),
    getBrands(),
    getCategories(),
  ]);

  const label = [brand, category ? CATEGORY_LABEL[category] ?? category : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <Header />
      <main className="mx-auto flex max-w-[1400px] flex-col gap-8 px-6 py-8 md:flex-row">
        <aside className="w-full shrink-0 md:w-52 md:pr-6">
          <BrandSidebar brands={brands} active={brand} activeCategory={category} />
          <CategorySidebar
            categories={categories}
            activeBrand={brand}
            active={category}
          />
        </aside>
        <section className="flex-1">
          {label && (
            <p className="mb-6 text-[11px] uppercase tracking-widest text-neutral-500">
              {label} · {products.length} item{products.length === 1 ? "" : "s"}
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
