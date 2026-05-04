"use client";

// Detail modal — hero, meta dl, size chart, thumbs, source link. Uses the
// HTML <dialog> element for built-in focus trap + Escape-to-close.
//
// State that should reset when `item` changes (e.g. activeIdx) lives in
// <ModalContent> with a `key` prop; that's React's idiomatic way to reset
// component state on a prop change without a setState-in-effect.

import { useEffect, useRef, useState } from "react";
import type { Item } from "@/types/catalog";
import { imagesOf, formatPrice, itemKey, cleanDescription } from "@/lib/items";

export interface ItemModalProps {
  item: Item | null;
  onClose: () => void;
}

export function ItemModal({ item, onClose }: ItemModalProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (item) {
      if (!dlg.open) dlg.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dlg.open) dlg.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [item]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-0 max-h-[100dvh] max-w-none w-full h-full bg-(--color-bg) text-(--color-fg) backdrop:bg-black/60"
    >
      {item ? (
        <ModalContent key={itemKey(item)} item={item} onClose={onClose} dialogRef={ref} />
      ) : null}
    </dialog>
  );
}

function ModalContent({
  item,
  onClose,
  dialogRef,
}: {
  item: Item;
  onClose: () => void;
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const images = imagesOf(item);
  const hero = images[activeIdx] ?? images[0];
  const dlRows: Array<[string, string | null | undefined]> = [
    ["Item code", item.item_code],
    ["Target size", item.target_size],
    ["Target variant", item.target_variant],
    ["Sizing", item.sizing],
    ["Variants", item.variants?.join(", ")],
    ["Source", item.source],
    ["Seller", item.seller],
    ["Notes", item.notes],
  ];

  return (
    <>
      <button
        onClick={onClose}
        aria-label="Close"
        className="fixed right-6 top-6 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-2xl text-neutral-700 shadow hover:text-(--color-fg)"
      >
        ×
      </button>
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-6 py-12 lg:grid-cols-[3fr_2fr]">
        <section className="bg-[#f0efed]">
          {hero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hero}
              alt={item.user_label}
              className="block h-auto max-h-[80vh] w-full object-contain"
            />
          ) : null}
        </section>
        <aside className="flex flex-col gap-4">
          {item.brand ? (
            <p className="m-0 text-[10px] uppercase tracking-[0.14em] text-(--color-muted)">
              {item.brand}
            </p>
          ) : null}
          <h2 className="m-0 text-2xl font-medium tracking-tight">
            {item.user_label}
          </h2>
          {item.title_translated ? (
            <p className="m-0 text-[13px] text-(--color-muted)">{item.title_translated}</p>
          ) : null}
          <p className="m-0 text-[14px] font-medium tracking-[0.02em]">
            {formatPrice(item)}
          </p>
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[12px]">
            {dlRows
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-(--color-muted) uppercase tracking-[0.06em]">
                    {k}
                  </dt>
                  <dd className="m-0">{v}</dd>
                </div>
              ))}
          </dl>
          <SizeChart item={item} />
          {cleanDescription(item.description) ? (
            <p className="m-0 text-[13px] leading-relaxed text-neutral-700">
              {cleanDescription(item.description)}
            </p>
          ) : null}
          {item.url ? (
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] uppercase tracking-[0.12em] text-(--color-muted) hover:text-(--color-fg)"
            >
              View on source ↗
            </a>
          ) : null}
        </aside>
        <section className="lg:col-span-2">
          {images.length > 1 ? (
            <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10">
              {images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={src + i}
                  src={src}
                  alt=""
                  loading="lazy"
                  onClick={() => {
                    setActiveIdx(i);
                    dialogRef.current?.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={[
                    "block aspect-[3/4] w-full cursor-pointer object-cover transition-opacity",
                    i === activeIdx ? "opacity-100" : "opacity-55 hover:opacity-100",
                  ].join(" ")}
                />
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function SizeChart({ item }: { item: Item }) {
  const sc = item.size_chart;
  if (!sc || !sc.sizes?.length || !sc.measurements) return null;
  const fields = Object.keys(sc.measurements);
  return (
    <div className="mt-2">
      <p className="m-0 mb-1.5 text-[10px] uppercase tracking-[0.12em] text-(--color-muted)">
        Measurements ({sc.unit || "cm"})
      </p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr>
              <th className="border-b border-(--color-border) bg-neutral-50 p-1.5 text-left font-normal text-(--color-muted)" />
              {sc.sizes.map((s) => (
                <th
                  key={s}
                  className="border-b border-(--color-border) bg-neutral-50 p-1.5 text-center font-medium"
                >
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f}>
                <th className="border-b border-(--color-border) p-1.5 text-left font-normal text-(--color-muted)">
                  {f.replace(/_/g, " ")}
                </th>
                {sc.measurements[f].map((v, i) => (
                  <td
                    key={i}
                    className="border-b border-(--color-border) p-1.5 text-center tabular-nums"
                  >
                    {v ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
