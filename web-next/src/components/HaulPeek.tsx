"use client";

// Persistent floating chip showing live haul totals while browsing the
// Catalog. Reads from the wishlist store; renders nothing if empty.

import { useMemo } from "react";
import Link from "next/link";
import { useWishlist } from "@/lib/useWishlist";
import { itemKey, priceUsd } from "@/lib/items";
import type { Item } from "@/types/catalog";

export function HaulPeek({ items }: { items: Item[] }) {
  const { wishlist } = useWishlist();

  const buckets = useMemo(() => {
    const out = { hampus: 0, jan: 0, sharedUsd: 0, total: 0, count: 0 };
    for (const it of items) {
      if (!wishlist.has(itemKey(it))) continue;
      const usd = priceUsd(it);
      const owners = it.owners ?? [];
      out.count += 1;
      out.total += usd;
      if (owners.length > 1) out.sharedUsd += usd;
      else if (owners.includes("hampus")) out.hampus += usd;
      else if (owners.includes("jan")) out.jan += usd;
    }
    // Allocate shared 50/50.
    out.hampus += out.sharedUsd / 2;
    out.jan += out.sharedUsd / 2;
    return out;
  }, [items, wishlist]);

  if (buckets.count === 0) return null;

  return (
    <Link
      href="/haul"
      className="fixed bottom-5 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-3 rounded-full border border-(--color-border) bg-white px-4 py-2 text-[12px] font-medium shadow-lg ring-1 ring-black/5 hover:border-(--color-fg)"
    >
      <span className="rounded-full bg-(--color-fg) px-2 py-0.5 text-[10px] text-white">
        {buckets.count}
      </span>
      <span className="text-(--color-muted)">
        Hampus <strong className="text-(--color-fg) tabular-nums">${Math.round(buckets.hampus)}</strong>
      </span>
      <span className="text-(--color-muted)">
        Jan <strong className="text-(--color-fg) tabular-nums">${Math.round(buckets.jan)}</strong>
      </span>
      <span className="text-(--color-muted)">
        ·
      </span>
      <span className="text-(--color-fg)">
        Total <strong className="tabular-nums">${Math.round(buckets.total)}</strong>
      </span>
      <span className="text-(--color-muted)">→ Haul</span>
    </Link>
  );
}

