"use client";

// Haul tab — everything you've bought (status purchased/warehouse/shipped,
// filtered server-side in loadHaulItems) + a grand-total footer. Items appear
// here automatically once bought; no manual starring required.

import { useMemo } from "react";
import { CardGrid } from "./CardGrid";
import { FilterBar } from "./FilterBar";
import { HaulFooter } from "./HaulFooter";
import { ShippingPanel } from "./ShippingPanel";
import { SellerCopyButtons } from "./SellerCopyButtons";
import { useFilterState } from "@/lib/useFilterState";
import { applyFilters, distinctCategories } from "@/lib/filters";
import type { Item } from "@/types/catalog";
import type { ShippingData } from "@/types/shipping";
import type { SellerMessagesFile } from "@/types/notes";

export interface HaulClientProps {
  items: Item[];
  shippingData: ShippingData;
  sellerMessages: SellerMessagesFile;
}

export function HaulClient({ items, shippingData, sellerMessages }: HaulClientProps) {
  const { state, set } = useFilterState();
  // Everything passed in is already a bought item (purchased/warehouse/shipped),
  // so the whole haul shows automatically — no wishlist gating.
  const haulItems = items;
  const categories = useMemo(() => distinctCategories(haulItems), [haulItems]);
  // Bought items always pass the visibility filter (skipped/oos items you've
  // already ordered stay visible in the haul).
  const filtered = useMemo(
    () => applyFilters(haulItems, { ...state, showOos: true }),
    [haulItems, state]
  );

  return (
    <>
      <FilterBar
        state={state}
        categories={categories}
        hiddenCount={0}
        onChange={set}
      />
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        {haulItems.length === 0 ? (
          <div className="py-16 text-center text-(--color-muted)">
            Your haul is empty — items appear here once you mark them purchased.
          </div>
        ) : (
          <>
            <CardGrid items={filtered} />
            <HaulFooter items={haulItems} />
            <SellerCopyButtons items={haulItems} data={sellerMessages} />
            <ShippingPanel data={shippingData} items={haulItems} />
          </>
        )}
      </main>
    </>
  );
}
