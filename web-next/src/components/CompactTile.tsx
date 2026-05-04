"use client";

// Compact tile: small thumb + 1-line label + price. Plain click toggles
// wishlist (so picking is fast); the small ⓘ button opens the detail modal.

import type { Item } from "@/types/catalog";
import { imagesOf, formatPrice } from "@/lib/items";
import { useWishlist } from "@/lib/useWishlist";
import { useModal } from "./ModalProvider";

export function CompactTile({ item }: { item: Item }) {
  const { isWished, toggle } = useWishlist();
  const { open } = useModal();
  const images = imagesOf(item);
  const wished = isWished(item);

  return (
    <div
      onClick={() => toggle(item)}
      title={`${item.user_label} — ${formatPrice(item.price)}`}
      className={[
        "group relative flex cursor-pointer flex-col overflow-hidden border bg-(--color-bg) transition-colors",
        wished
          ? "border-(--color-fg)"
          : "border-(--color-border) hover:border-neutral-400",
      ].join(" ")}
    >
      <div className="relative aspect-[3/4] bg-[#f0efed]">
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[0]}
            alt={item.user_label}
            loading="lazy"
            className={[
              "block h-full w-full object-cover",
              wished ? "" : "opacity-95",
            ].join(" ")}
          />
        ) : null}
        {wished ? (
          <div className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-(--color-fg) text-[10px] text-amber-300">
            ✓
          </div>
        ) : null}
        <button
          onClick={(e) => {
            e.stopPropagation();
            open(item);
          }}
          aria-label="Open detail"
          className="absolute bottom-1 right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/90 text-[11px] text-neutral-600 opacity-0 shadow transition-opacity group-hover:opacity-100"
        >
          ⓘ
        </button>
      </div>
      <div className="p-1.5">
        <div className="line-clamp-1 text-[11px] font-medium">{item.user_label}</div>
        <div className="text-[10px] tabular-nums text-(--color-muted)">
          {formatPrice(item.price)}
        </div>
      </div>
    </div>
  );
}
