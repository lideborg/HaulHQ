"use client";

// React hook around wishlistStore. useSyncExternalStore so renders stay
// consistent across components that share the wishlist.

import { useCallback, useSyncExternalStore } from "react";
import { wishlistStore } from "./wishlistStore";
import { itemKey } from "./items";
import type { Item } from "@/types/catalog";

export function useWishlist() {
  const set = useSyncExternalStore(
    wishlistStore.subscribe,
    wishlistStore.getSnapshot,
    wishlistStore.getServerSnapshot
  );

  const isWished = useCallback((item: Item) => set.has(itemKey(item)), [set]);
  const toggle = useCallback((item: Item) => wishlistStore.toggle(itemKey(item)), []);
  const clear = useCallback(() => wishlistStore.clear(), []);

  return { wishlist: set, count: set.size, isWished, toggle, clear };
}
