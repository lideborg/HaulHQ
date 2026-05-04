"use client";

// Top-level client wrapper for the Catalog tab. Owns filter state; the
// underlying CardGrid is pure presentation.

import { useMemo } from "react";
import { CardGrid } from "./CardGrid";
import { FilterBar } from "./FilterBar";
import { HaulPeek } from "./HaulPeek";
import { useFilterState } from "@/lib/useFilterState";
import { applyFilters, distinctCategories } from "@/lib/filters";
import type { Item } from "@/types/catalog";

export interface CatalogClientProps {
  items: Item[];
}

export function CatalogClient({ items }: CatalogClientProps) {
  const { state, set } = useFilterState();
  const categories = useMemo(() => distinctCategories(items), [items]);
  const filtered = useMemo(() => applyFilters(items, state), [items, state]);
  const hiddenCount = useMemo(
    () => items.filter((it) => it.out_of_stock || it.skipped).length,
    [items]
  );

  return (
    <>
      <FilterBar
        state={state}
        categories={categories}
        hiddenCount={hiddenCount}
        onChange={set}
      />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <CardGrid items={filtered} />
      </main>
      <HaulPeek items={items} />
    </>
  );
}
