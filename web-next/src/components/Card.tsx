"use client";

// Catalog card — hero image, brand/label, price.
// Client component because it'll later own hover state, wishlist toggle, and modal-open click.
//
// Why <img> instead of next/image:
//   Catalog photos live under /data/<source>/images/<slug>/ via a symlink
//   from public/data → ../../data. next/image needs explicit remotePatterns
//   config and runs an optimization pipeline we don't need for this many
//   small local files yet. Phase 2 (when images move to Supabase storage)
//   will switch to next/image.

import { useState } from "react";
import type { Item } from "@/types/catalog";
import { imagesOf, formatPrice } from "@/lib/items";
import { useWishlist } from "@/lib/useWishlist";
import { useModal } from "./ModalProvider";
import { WishStar } from "./WishStar";

export interface CardProps {
  item: Item;
}

export function Card({ item }: CardProps) {
  const images = imagesOf(item);
  const [activeIdx, setActiveIdx] = useState(0);
  const hero = images[activeIdx] ?? images[0];
  const { isWished, toggle } = useWishlist();
  const { open } = useModal();

  return (
    <article className="flex flex-col">
      <div className="relative aspect-[3/4] overflow-hidden bg-[#f0efed] group">
        <button
          type="button"
          onClick={() => open(item)}
          aria-label={`Open ${item.user_label}`}
          className="block h-full w-full cursor-pointer p-0 m-0 border-0 bg-transparent"
        >
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt={item.user_label}
              loading="lazy"
              className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.015]"
            />
          ) : null}
        </button>
        <StatusBadges item={item} />
        <WishStar active={isWished(item)} onToggle={() => toggle(item)} />
      </div>

      <ThumbStrip
        images={images.slice(0, 9)}
        activeIdx={activeIdx}
        onChange={setActiveIdx}
      />

      <div className="px-0.5 pt-3.5">
        {item.brand ? (
          <p className="m-0 mb-1 text-[10px] uppercase tracking-[0.1em] text-(--color-muted)">
            {item.brand}
          </p>
        ) : null}
        <p className="m-0 mb-1 text-[13px] font-medium tracking-[-0.005em]">
          {item.user_label}
        </p>
        {item.title_translated ? (
          <p className="m-0 mb-2 line-clamp-2 min-h-8 text-[12px] text-(--color-muted)">
            {item.title_translated}
          </p>
        ) : null}
        <p className="m-0 text-[12px] font-medium tracking-[0.02em]">
          {formatPrice(item)}
        </p>
      </div>
    </article>
  );
}

function StatusBadges({ item }: { item: Item }) {
  type Tone = "good" | "bad" | "neutral" | "skipped" | "warn" | "purchased" | "warehouse" | "shipped";
  const badges: { label: string; tone: Tone }[] = [];
  if (item.status === "purchased") badges.push({ label: "Purchased", tone: "purchased" });
  if (item.status === "warehouse") badges.push({ label: "In Warehouse", tone: "warehouse" });
  if (item.status === "shipped") badges.push({ label: "Shipped", tone: "shipped" });
  if (item.target_size) badges.push({ label: `Size ${item.target_size}`, tone: "good" });
  if (item.target_variant) badges.push({ label: item.target_variant, tone: "neutral" });
  if (item.requires_contact) badges.push({ label: "Contact seller", tone: "warn" });
  if (item.out_of_stock) badges.push({ label: "Out of stock", tone: "bad" });
  if (item.skipped) badges.push({ label: "Skipped", tone: "skipped" });
  if (badges.length === 0) return null;

  const toneClass: Record<Tone, string> = {
    good: "bg-emerald-700 text-white",
    bad: "bg-red-700 text-white",
    neutral: "bg-neutral-900/70 text-white",
    skipped: "bg-neutral-200 text-neutral-700 line-through",
    warn: "bg-amber-100 text-amber-900 border border-amber-700",
    purchased: "bg-blue-600 text-white",
    warehouse: "bg-emerald-600 text-white",
    shipped: "bg-purple-600 text-white",
  };
  return (
    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`inline-block rounded-sm px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] ${toneClass[b.tone]}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

function ThumbStrip({
  images,
  activeIdx,
  onChange,
}: {
  images: string[];
  activeIdx: number;
  onChange: (i: number) => void;
}) {
  if (images.length <= 1) return null;
  return (
    <div className="mt-2 grid grid-cols-9 gap-1">
      {images.map((src, i) => (
        <button
          key={src + i}
          type="button"
          onClick={() => onChange(i)}
          aria-label={`Show image ${i + 1}`}
          aria-pressed={i === activeIdx}
          className="block p-0 m-0 border-0 bg-transparent"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            loading="lazy"
            className={[
              "block aspect-[3/4] w-full cursor-pointer object-cover transition-opacity",
              i === activeIdx ? "opacity-100" : "opacity-55 hover:opacity-100",
            ].join(" ")}
          />
        </button>
      ))}
    </div>
  );
}
