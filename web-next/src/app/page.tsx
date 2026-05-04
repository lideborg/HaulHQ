// Catalog page — landing.

import { Suspense } from "react";
import { Header } from "@/components/Header";
import { CatalogClient } from "@/components/CatalogClient";
import { loadAllItems } from "@/lib/data";

export const dynamic = "force-static";

export default async function CatalogPage() {
  const items = await loadAllItems();
  return (
    <>
      <Header active="catalog" />
      <Suspense>
        <CatalogClient items={items} />
      </Suspense>
    </>
  );
}
