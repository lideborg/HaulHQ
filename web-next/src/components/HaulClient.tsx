"use client";

// Haul tab — wishlisted items + grand-total footer. Shares the filter bar
// with Catalog so users can drill into "Hampus's haul" or "just eyewear",
// but the footer always reflects the FULL wishlist.

import { useMemo } from "react";
import { CardGrid } from "./CardGrid";
import { FilterBar } from "./FilterBar";
import { HaulFooter } from "./HaulFooter";
import { ShippingPanel } from "./ShippingPanel";
import { SellerCopyButtons } from "./SellerCopyButtons";
import { useFilterState } from "@/lib/useFilterState";
import { useWishlist } from "@/lib/useWishlist";
import { applyFilters, distinctCategories } from "@/lib/filters";
import { itemKey } from "@/lib/items";
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
  const { wishlist } = useWishlist();
  const wishedItems = useMemo(
    () => items.filter((it) => wishlist.has(itemKey(it))),
    [items, wishlist]
  );
  const categories = useMemo(() => distinctCategories(wishedItems), [wishedItems]);
  // Wishlisted items always pass the visibility filter (skipped/oos items
  // you've already picked stay visible in the haul).
  const filtered = useMemo(
    () => applyFilters(wishedItems, { ...state, showOos: true }),
    [wishedItems, state]
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
        {wishedItems.length === 0 ? (
          <div className="py-16 text-center text-(--color-muted)">
            Your haul is empty — click ★ on any item to add it.
          </div>
        ) : (
          <>
            <CardGrid items={filtered} />
            <HaulFooter items={wishedItems} />
            <SellerCopyButtons items={wishedItems} data={sellerMessages} />
            <ShippingPanel data={shippingData} items={wishedItems} />
          </>
        )}
      </main>
    </>
  );
}
