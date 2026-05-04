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

  // Wishlist all of the given items (idempotent — already-wished stay wished).
  const addAll = useCallback((items: Item[]) => {
    const next = new Set(set);
    for (const it of items) next.add(itemKey(it));
    wishlistStore.setAll([...next]);
  }, [set]);

  // Un-wish all of the given items (leaves anything else alone).
  const removeAll = useCallback((items: Item[]) => {
    const next = new Set(set);
    for (const it of items) next.delete(itemKey(it));
    wishlistStore.setAll([...next]);
  }, [set]);

  // Replace the entire wishlist with raw keys (used by Import).
  const setAll = useCallback((keys: string[]) => wishlistStore.setAll(keys), []);

  return { wishlist: set, count: set.size, isWished, toggle, clear, addAll, removeAll, setAll };
}
