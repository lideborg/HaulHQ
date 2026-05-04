// Catalog page — landing.

import { Header } from "@/components/Header";
import { CatalogGrid } from "@/components/CatalogGrid";
import { loadAllItems } from "@/lib/data";

export const dynamic = "force-static";

export default async function CatalogPage() {
  const items = await loadAllItems();
  // Hide skipped + out-of-stock by default (matches current site behavior).
  const visible = items.filter((it) => !it.skipped && !it.out_of_stock);

  return (
    <>
      <Header active="catalog" />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-14">
        <CatalogGrid items={visible} />
      </main>
    </>
  );
}
