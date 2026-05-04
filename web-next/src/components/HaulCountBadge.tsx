"use client";

// Reads the live wishlist count from localStorage and renders a small badge.
// Used inside the Haul tab link in the (server) Header.

import { useWishlist } from "@/lib/useWishlist";

export function HaulCountBadge() {
  const { count } = useWishlist();
  if (!count) return null;
  return (
    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-(--color-fg) px-2 py-0.5 text-[10px] text-white">
      {count}
    </span>
  );
}
