import { BrandSidebar } from "@/components/BrandSidebar";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { ShopControls } from "@/components/ShopControls";
import {
  getPublishedProducts,
  getShopFacets,
  getSellerBrandLinks,
} from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Next delivers repeated query params as arrays (?q=a&q=b) — take the first.
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const brand = one(sp.brand);
  const category = one(sp.category);
  const q = one(sp.q);
  const instock = one(sp.instock) === "1" ? "1" : undefined;
  const [products, facets, sellerLinks] = await Promise.all([
    getPublishedProducts(brand, category, q, instock === "1"),
    getShopFacets(),
    q ? getSellerBrandLinks(q) : Promise.resolve([]),
  ]);
  const label = [
    q ? `“${q}”` : null,
    brand,
    category ? CATEGORY_LABEL[category] ?? category : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <aside className="w-full shrink-0 md:w-52 md:pr-6">
        <BrandSidebar
          handle={handle}
          brands={facets.brands}
          total={facets.total}
          active={brand}
          activeCategory={category}
        />
        <CategorySidebar
          handle={handle}
          categories={facets.categories}
          total={facets.total}
          activeBrand={brand}
          active={category}
        />
      </aside>
      <section className="flex-1">
        <ShopControls handle={handle} brand={brand} category={category} q={q} instock={instock} />
        {label && (
          <p className="mb-6 text-[11px] uppercase tracking-widest text-neutral-500">
            {label} · {products.length} item{products.length === 1 ? "" : "s"}
          </p>
        )}
        {products.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {q ? "No catalog matches." : "Nothing here yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} handle={handle} product={p} />
            ))}
          </div>
        )}
        {sellerLinks.length > 0 && (
          <div className="mt-10 border-t border-neutral-200 pt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest">
              Browse this brand at our sellers
            </p>
            <ul className="space-y-1.5">
              {sellerLinks.map((l) => (
                <li key={l.url} className="text-xs">
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-neutral-500"
                  >
                    {l.brand}
                    {l.alias && l.alias.toLowerCase() !== l.brand.toLowerCase()
                      ? ` (“${l.alias}”)`
                      : ""}{" "}
                    @ {l.seller}
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-neutral-400">
              Found something? Paste the link on the Request page and Hampus will price it.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
