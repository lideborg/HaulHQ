// Pure filter / sort logic, used by client + server.

import type { Item, Owner } from "@/types/catalog";
import { categoryLabel, priceCny } from "./items";

export type SortMode = "default" | "price-desc" | "price-asc";
export type OwnerFilter = "all" | "hampus" | "jan" | "shared";
export type ViewMode = "grid" | "list" | "compact";

export interface FilterState {
  category: string; // category key OR "all"
  owner: OwnerFilter;
  sort: SortMode;
  showOos: boolean;
  view: ViewMode;
}

export const DEFAULT_FILTERS: FilterState = {
  category: "all",
  owner: "all",
  sort: "default",
  showOos: false,
  view: "grid",
};

export function passesCategory(item: Item, category: string): boolean {
  if (category === "all") return true;
  return categoryLabel(item.category) === categoryLabel(category);
}

export function passesOwner(item: Item, owner: OwnerFilter): boolean {
  const owners = (item.owners ?? []) as Owner[];
  if (owner === "all") return true;
  if (owner === "hampus") return owners.includes("hampus");
  if (owner === "jan") return owners.includes("jan");
  if (owner === "shared") return owners.length > 1;
  return true;
}

export function passesVisibility(
  item: Item,
  showOos: boolean,
  alwaysVisible = false
): boolean {
  if (alwaysVisible) return true;
  if (showOos) return true;
  return !item.out_of_stock && !item.skipped;
}

export function applySort(items: Item[], sort: SortMode): Item[] {
  if (sort === "default") return items;
  const arr = [...items];
  if (sort === "price-desc") {
    arr.sort((a, b) => priceCny(b) - priceCny(a));
  } else if (sort === "price-asc") {
    arr.sort((a, b) => {
      const pa = priceCny(a);
      const pb = priceCny(b);
      // Items with no price sink to the bottom on ascending sort.
      if (pa === 0 && pb === 0) return 0;
      if (pa === 0) return 1;
      if (pb === 0) return -1;
      return pa - pb;
    });
  }
  return arr;
}

export function applyFilters(items: Item[], state: FilterState): Item[] {
  return applySort(
    items.filter(
      (it) =>
        passesVisibility(it, state.showOos) &&
        passesCategory(it, state.category) &&
        passesOwner(it, state.owner)
    ),
    state.sort
  );
}

// Distinct labels (so apparel-top + apparel-bottom collapse to one "Apparel"
// chip). The filter still uses categoryLabel match against raw item.category,
// so a single chip activates all sub-categories that share the label.
export function distinctCategories(items: Item[]): string[] {
  const labelToKey = new Map<string, string>();
  for (const it of items) {
    if (!it.category) continue;
    const label = categoryLabel(it.category);
    // Keep the first key seen for that label — used as the chip's value.
    if (!labelToKey.has(label)) labelToKey.set(label, it.category);
  }
  return [...labelToKey.values()].sort((a, b) =>
    categoryLabel(a).localeCompare(categoryLabel(b))
  );
}
