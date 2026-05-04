"use client";

// Haul tab — wishlisted items + grand-total footer. Filter UI is shared
// with Catalog so users can drill into "Hampus's haul" or "just eyewear",
// but the footer always reflects the FULL wishlist.

import { useMemo } from "react";
import { ItemList } from "./ItemList";
import { CategoryFilter } from "./CategoryFilter";
import { OwnerFilterBar } from "./OwnerFilter";
import { SortControl } from "./SortControl";
import { ViewModeToggle } from "./ViewModeToggle";
import { HaulFooter } from "./HaulFooter";
import { ShippingPanel } from "./ShippingPanel";
import { useFilterState } from "@/lib/useFilterState";
import { useWishlist } from "@/lib/useWishlist";
import { applyFilters, distinctCategories } from "@/lib/filters";
import { itemKey } from "@/lib/items";
import type { Item } from "@/types/catalog";
import type { ShippingData } from "@/types/shipping";

export interface HaulClientProps {
  items: Item[];
  shippingData: ShippingData;
}

export function HaulClient({ items, shippingData }: HaulClientProps) {
  const { state, set } = useFilterState();
  const { wishlist } = useWishlist();
  const wishedItems = useMemo(
    () => items.filter((it) => wishlist.has(itemKey(it))),
    [items, wishlist]
  );
  const categories = useMemo(() => distinctCategories(wishedItems), [wishedItems]);
  // Wishlisted items always pass the visibility filter (out-of-stock items
  // you've picked stay visible).
  const filtered = useMemo(
    () => applyFilters(wishedItems, { ...state, showOos: true }),
    [wishedItems, state]
  );
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
        {wishedItems.length === 0 ? (
          <div className="py-16 text-center text-(--color-muted)">
            Your haul is empty — click ★ on any item to add it.
          </div>
        ) : (
          <>
            <ItemList items={filtered} view={state.view} />
            <HaulFooter items={wishedItems} />
            <ShippingPanel data={shippingData} items={wishedItems} />
          </>
        )}
      </main>
    </>
  );
}
