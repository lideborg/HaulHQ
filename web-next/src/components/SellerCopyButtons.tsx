"use client";

// Per-seller "Copy message for X (N items)" buttons. Drops in below the
// HaulFooter. Each button copies a tailored message containing only the
// items currently in your wishlist that match that seller's template.

import { useMemo, useState } from "react";
import type { Item } from "@/types/catalog";
import type { SellerMessagesFile } from "@/types/notes";
import { bucketBySeller, renderMessage } from "@/lib/sellerMessages";

export interface SellerCopyButtonsProps {
  items: Item[];
  data: SellerMessagesFile;
}

export function SellerCopyButtons({ items, data }: SellerCopyButtonsProps) {
  const buckets = useMemo(() => bucketBySeller(items, data), [items, data]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (buckets.length === 0) return null;

  const onCopy = async (key: string) => {
    const bucket = buckets.find((b) => b.template.key === key);
    if (!bucket) return;
    const text = renderMessage(bucket);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      console.warn("clipboard write failed; message:\n", text);
    }
  };

  return (
    <section className="mx-auto mt-6 max-w-[800px] border-t border-(--color-border) pt-5">
      <h3 className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-neutral-700">
        Copy message per seller
      </h3>
      <div className="flex flex-wrap gap-2">
        {buckets.map((b) => (
          <button
            key={b.template.key}
            onClick={() => onCopy(b.template.key)}
            className="inline-flex items-center gap-2 rounded-full border border-(--color-border) bg-white px-3.5 py-1.5 text-[12px] font-medium text-neutral-700 hover:border-(--color-fg) hover:text-(--color-fg)"
            title={`Copy a message tailored to ${b.template.label}`}
          >
            <svg viewBox="0 0 16 16" width={13} height={13} fill="currentColor" aria-hidden="true">
              <path d="M11 1H4a2 2 0 0 0-2 2v8h2V3h7zm3 3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 10H7V6h7z" />
            </svg>
            {copiedKey === b.template.key ? "Copied ✓" : b.template.label}
            <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-500">
              {b.items.length}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
