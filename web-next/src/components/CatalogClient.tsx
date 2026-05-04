"use client";

// Top-level client wrapper for the Catalog tab. Owns filter UI + filtering;
// the underlying CatalogGrid + Card components are pure presentation.

import { useMemo } from "react";
import { CatalogGrid } from "./CatalogGrid";
import { CategoryFilter } from "./CategoryFilter";
import { OwnerFilterBar } from "./OwnerFilter";
import { SortControl } from "./SortControl";
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
      <CategoryFilter
        categories={categories}
        active={state.category}
        onChange={(category) => set({ category })}
      />
      <OwnerFilterBar
        active={state.owner}
        onChange={(owner) => set({ owner })}
      />
      <SortControl
        sort={state.sort}
        showOos={state.showOos}
        hiddenCount={hiddenCount}
        onSortChange={(sort) => set({ sort })}
        onShowOosChange={(showOos) => set({ showOos })}
      />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <CatalogGrid items={filtered} />
      </main>
    </>
  );
}
