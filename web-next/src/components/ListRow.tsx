"use client";

// Single-row list item: thumb + brand/title/sub + status badges + price + star.
// Clicking the row opens the detail modal; clicking the star toggles wishlist.

import type { Item } from "@/types/catalog";
import { imagesOf, formatPrice } from "@/lib/items";
import { useWishlist } from "@/lib/useWishlist";
import { useModal } from "./ModalProvider";

export function ListRow({ item }: { item: Item }) {
  const { isWished, toggle } = useWishlist();
  const { open } = useModal();
  const images = imagesOf(item);
  const wished = isWished(item);
  const owners = (item.owners ?? []).join(", ");
  const variant = item.target_variant ? ` · ${item.target_variant}` : "";
  const sub = `${(item.title_translated ?? item.title ?? "").slice(0, 110)}${
    item.sizing ? ` · ${item.sizing}` : ""
  }`;

  return (
    <div
      onClick={() => open(item)}
      className="group flex cursor-pointer items-stretch gap-4 border-b border-(--color-border) py-3.5 hover:bg-neutral-50"
    >
      {images[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={images[0]}
          alt={item.user_label}
          loading="lazy"
          className="h-24 w-20 flex-shrink-0 bg-[#f0efed] object-cover"
        />
      ) : (
        <div className="h-24 w-20 flex-shrink-0 bg-[#f0efed]" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[10px] uppercase tracking-[0.1em] text-(--color-muted)">
            {item.brand}
          </span>
          {owners ? (
            <span className="text-[10px] uppercase tracking-[0.06em] text-(--color-muted)">
              {owners}
            </span>
          ) : null}
        </div>
        <div className="text-[14px] font-medium tracking-tight">
          {item.user_label}
          {variant}
        </div>
        <div className="line-clamp-1 text-[12px] text-(--color-muted)">{sub}</div>
        <StatusBadges item={item} />
      </div>
      <div className="flex flex-shrink-0 flex-col items-end justify-between">
        <span className="text-[13px] font-medium tabular-nums">
          {formatPrice(item.price)}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggle(item);
          }}
          aria-label={wished ? "Remove from haul" : "Add to haul"}
          aria-pressed={wished}
          className={[
            "inline-flex h-7 w-7 items-center justify-center rounded-full text-[14px]",
            wished
              ? "bg-(--color-fg) text-amber-300"
              : "bg-neutral-100 text-neutral-400 hover:text-(--color-fg)",
          ].join(" ")}
        >
          {wished ? "★" : "☆"}
        </button>
      </div>
    </div>
  );
}

function StatusBadges({ item }: { item: Item }) {
  const badges: { label: string; tone: string }[] = [];
  if (item.out_of_stock) badges.push({ label: "Out of stock", tone: "bad" });
  if (item.skipped) badges.push({ label: "Skipped", tone: "skipped" });
  if (item.target_size) badges.push({ label: `Size ${item.target_size}`, tone: "good" });
  if (item.requires_contact) badges.push({ label: "Contact seller", tone: "info" });
  if (item.size_chart) badges.push({ label: "Size chart", tone: "good" });
  if (badges.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.label}
          className={[
            "inline-block rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em]",
            b.tone === "good" && "bg-emerald-700 text-white",
            b.tone === "bad" && "bg-red-700 text-white",
            b.tone === "skipped" && "bg-neutral-200 text-neutral-700 line-through",
            b.tone === "info" && "bg-amber-50 text-amber-900 border border-amber-700",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}
