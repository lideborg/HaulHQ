"use client";

// Top-level client wrapper for the Catalog tab. Owns filter + view-mode
// state; underlying ItemList swaps between Grid / List / Compact.

import { useMemo } from "react";
import { ItemList } from "./ItemList";
import { CategoryFilter } from "./CategoryFilter";
import { OwnerFilterBar } from "./OwnerFilter";
import { SortControl } from "./SortControl";
import { ViewModeToggle } from "./ViewModeToggle";
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
      <div className="flex justify-center">
        <ViewModeToggle active={state.view} onChange={(view) => set({ view })} />
      </div>
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <ItemList items={filtered} view={state.view} />
      </main>
    </>
  );
}
