import Link from "next/link";
import { BrandSidebar } from "@/components/BrandSidebar";
import { CategorySidebar } from "@/components/CategorySidebar";
import { ProductCard } from "@/components/ProductCard";
import { SoldOutToggle, SearchBox } from "@/components/ShopControls";
import { ShopSortFilter } from "@/components/ShopSortFilter";
import { ScrollRestorer } from "@/components/ScrollRestorer";
import {
  getPublishedProducts,
  getShopFacets,
  getSellerBrandLinks,
} from "@/lib/data";
import { CATEGORY_LABEL } from "@/lib/categories";

export const dynamic = "force-dynamic";

// Next delivers repeated query params as arrays (?q=a&q=b) — take the first.
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

// seller_brand_links.seller looks like "deateath (Yupoo)" — show "Deateath".
const prettySeller = (s: string) => {
  const name = s.replace(/\s*\(yupoo\)\s*$/i, "");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : s;
};

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const brand = one(sp.brand);
  const category = one(sp.category);
  const q = one(sp.q);
  // Sold-out items are hidden by default; ?all=1 shows everything.
  const showAll = one(sp.all) === "1";
  const sort = one(sp.sort);
  const color = one(sp.color);
  const minStr = one(sp.min);
  const maxStr = one(sp.max);
  const min = minStr ? Number(minStr) : undefined;
  const max = maxStr ? Number(maxStr) : undefined;
  const [products, facets, sellerLinks] = await Promise.all([
    getPublishedProducts(brand, category, q, !showAll, { sort, color, min, max }),
    getShopFacets(!showAll),
    q ? getSellerBrandLinks(q) : Promise.resolve([]),
  ]);
  const label = [
    q ? `“${q}”` : null,
    brand,
    category ? CATEGORY_LABEL[category] ?? category : null,
  ]
    .filter(Boolean)
    .join(" · ");
  // One line per seller (first matching category + count) keeps the fallback
  // readable now that big shops carry dozens of links per brand; the full
  // list lives on the Factories page.
  const bySeller = new Map<string, typeof sellerLinks>();
  for (const l of sellerLinks) {
    const list = bySeller.get(l.seller) ?? [];
    list.push(l);
    bySeller.set(l.seller, list);
  }
  const sellerGroups = [...bySeller.entries()].slice(0, 6);
  return (
    <div className="flex flex-col gap-8 md:flex-row">
      <ScrollRestorer />
      <aside className="w-full shrink-0 md:w-52 md:pr-6">
        <div className="mb-6">
          <SoldOutToggle brand={brand} category={category} q={q} showAll={showAll} />
        </div>
        <BrandSidebar
          brands={facets.brands}
          total={facets.total}
          active={brand}
          activeCategory={category}
          showAll={showAll}
        />
        <CategorySidebar
          categories={facets.categories}
          total={facets.total}
          activeBrand={brand}
          active={category}
          showAll={showAll}
        />
      </aside>
      <section className="flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShopSortFilter
              brand={brand}
              category={category}
              q={q}
              showAll={showAll}
              sort={sort}
              color={color}
              min={minStr}
              max={maxStr}
            />
            <p className="text-[11px] uppercase tracking-widest text-neutral-500">
              {label ? `${label} · ` : ""}
              {products.length} item{products.length === 1 ? "" : "s"}
            </p>
          </div>
          <SearchBox brand={brand} category={category} q={q} showAll={showAll} />
        </div>
        {products.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {q ? "No catalog matches." : "Nothing here yet."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        {sellerGroups.length > 0 && (
          <div className="mt-10 border-t border-neutral-200 pt-6">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest">
              Browse this brand at our sellers
            </p>
            <ul className="space-y-1.5">
              {sellerGroups.map(([seller, links]) => (
                <li key={seller} className="text-xs">
                  <a
                    href={links[0].url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-neutral-500"
                  >
                    {links[0].brand} at {prettySeller(seller)} →
                  </a>
                  {links.length > 1 && (
                    <span className="text-neutral-400"> +{links.length - 1} more</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[10px] text-neutral-400">
              Found something? Paste the link on the Factories page and it goes
              straight into your haul.
            </p>
          </div>
        )}
        {q && (
          <p className="mt-6 text-xs text-neutral-500">
            Can&rsquo;t find it?{" "}
            <Link
              href={`/factories?q=${encodeURIComponent(q)}`}
              className="underline hover:text-black"
            >
              Search our factories →
            </Link>
          </p>
        )}
      </section>
    </div>
  );
}
