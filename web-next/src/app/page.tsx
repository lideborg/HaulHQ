// Browse page — shows favorited items (not yet purchased).

import { Suspense } from "react";
import { Header } from "@/components/Header";
import { BrowseClient } from "@/components/BrowseClient";
import { loadBrowseItems } from "@/lib/data";

export const dynamic = "force-static";

export default async function BrowsePage() {
  const items = await loadBrowseItems();
  return (
    <>
      <Header active="catalog" />
      <Suspense>
        <BrowseClient items={items} />
      </Suspense>
    </>
  );
}
