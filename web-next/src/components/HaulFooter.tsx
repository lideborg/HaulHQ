"use client";

// Aggregated totals + Copy-haul-as-text button. Mounted at the bottom of the
// Haul tab. Always reflects the FULL wishlist regardless of any filter the
// user applied in the grid above.

import { useMemo, useState } from "react";
import { priceCny } from "@/lib/items";
import { useWishlist } from "@/lib/useWishlist";
import type { Item } from "@/types/catalog";

const CNY_PER_USD = 6.83;
const fmt = (cny: number) => `¥${cny.toFixed(2)}  ($${Math.round(cny / CNY_PER_USD)})`;

interface OwnerBuckets {
  hampus: Item[];
  jan: Item[];
  shared: Item[];
  unknown: Item[];
}

function bucket(items: Item[]): OwnerBuckets {
  const out: OwnerBuckets = { hampus: [], jan: [], shared: [], unknown: [] };
  for (const it of items) {
    const o = it.owners ?? [];
    if (o.length > 1) out.shared.push(it);
    else if (o.includes("hampus")) out.hampus.push(it);
    else if (o.includes("jan")) out.jan.push(it);
    else out.unknown.push(it);
  }
  return out;
}

const sumOf = (arr: Item[]) => arr.reduce((s, it) => s + priceCny(it), 0);

export function HaulFooter({ items }: { items: Item[] }) {
  const totalCny = useMemo(() => sumOf(items), [items]);
  const buckets = useMemo(() => bucket(items), [items]);
  const [toast, setToast] = useState<"ok" | "err" | null>(null);
  const { clear } = useWishlist();

  if (items.length === 0) return null;

  const copy = async () => {
    const text = renderHaulSnippet(items, buckets, totalCny);
    try {
      await navigator.clipboard.writeText(text);
      setToast("ok");
    } catch {
      console.warn("clipboard write failed; snippet:\n", text);
      setToast("err");
    }
    setTimeout(() => setToast(null), 1800);
  };

  return (
    <div className="mx-auto mt-12 max-w-[800px] border-t border-(--color-border) px-2 pt-8">
      <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-[13px]">
        <Row label={`Hampus  ·  ${buckets.hampus.length} items`} value={fmt(sumOf(buckets.hampus))} hide={!buckets.hampus.length} />
        <Row label={`Jan  ·  ${buckets.jan.length} items`} value={fmt(sumOf(buckets.jan))} hide={!buckets.jan.length} />
        <Row label={`Shared (Hampus + Jan)  ·  ${buckets.shared.length} items`} value={fmt(sumOf(buckets.shared))} hide={!buckets.shared.length} />
        <Row label={`Unassigned  ·  ${buckets.unknown.length} items`} value={fmt(sumOf(buckets.unknown))} hide={!buckets.unknown.length} />
      </dl>

      <div className="mt-4 flex items-baseline justify-between border-t border-(--color-border) pt-3">
        <span className="text-[14px] text-neutral-700">Total  ·  {items.length} items</span>
        <span className="text-[20px] font-semibold">{fmt(totalCny)}</span>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-full bg-(--color-fg) px-4 py-2 text-[12px] font-medium text-white hover:bg-neutral-800"
        >
          <svg viewBox="0 0 16 16" width={14} height={14} fill="currentColor" aria-hidden="true">
            <path d="M11 1H4a2 2 0 0 0-2 2v8h2V3h7zm3 3H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 10H7V6h7z" />
          </svg>
          Copy haul as text
        </button>
        {toast === "ok" ? <span className="text-[12px] text-emerald-700">Copied ✓</span> : null}
        {toast === "err" ? <span className="text-[12px] text-red-700">Copy failed — see console</span> : null}
        <span className="ml-auto">
          <button
            onClick={() => {
              if (window.confirm(`Clear all ${items.length} items from your haul?`)) clear();
            }}
            className="text-[11px] text-(--color-muted) hover:text-red-700 hover:underline"
          >
            Clear haul
          </button>
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, hide }: { label: string; value: string; hide?: boolean }) {
  if (hide) return null;
  return (
    <>
      <dt className="text-neutral-600">{label}</dt>
      <dd className="m-0 font-medium tabular-nums">{value}</dd>
    </>
  );
}

function renderHaulSnippet(items: Item[], buckets: OwnerBuckets, totalCny: number): string {
  const lineFor = (it: Item) => {
    const code = it.item_code ? `#${it.item_code}` : "";
    const variant = it.target_variant ? ` (${it.target_variant})` : "";
    const price = it.price ? `  —  ${it.price}` : "";
    const seller = it.seller ? `  ·  ${it.seller}` : "";
    const oos = it.out_of_stock ? "  [OUT OF STOCK]" : "";
    return `- ${it.user_label}${variant} ${code}${price}${seller}${oos}\n  ${it.url ?? ""}`;
  };
  const date = new Date().toISOString().slice(0, 10);
  const sections: string[] = [`# HAUL — ${date}`, ""];
  const block = (label: string, arr: Item[]) => {
    if (!arr.length) return;
    sections.push(`## ${label}  ·  ${arr.length} items  ·  ${fmt(sumOf(arr))}`, "");
    for (const it of arr) sections.push(lineFor(it));
    sections.push("");
  };
  block("Hampus", buckets.hampus);
  block("Jan", buckets.jan);
  block("Shared", buckets.shared);
  block("Unassigned", buckets.unknown);
  sections.push(`## Total  ·  ${items.length} items  ·  ${fmt(totalCny)}`);
  return sections.join("\n");
}
