"use client";

import { useMemo, useState } from "react";
import { CardGrid } from "./CardGrid";
import { SearchBox } from "./SearchBox";
import { categoryLabel } from "@/lib/items";
import { passesQuery, passesCategory, distinctCategories } from "@/lib/filters";
import type { Item } from "@/types/catalog";

type SortMode = "newest" | "oldest" | "price-asc" | "price-desc";

function parsePrice(it: Item): number {
  const raw = it.price_rmb ?? it.price;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const m = raw.replace(/[^0-9.]/g, "");
    return m ? parseFloat(m) : 0;
  }
  return 0;
}

export function BrowseClient({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const categories = useMemo(() => distinctCategories(items), [items]);

  const filtered = useMemo(() => {
    const base = items.filter(
      (it) => passesQuery(it, q) && passesCategory(it, category)
    );
    switch (sort) {
      case "newest":
        return [...base].reverse();
      case "oldest":
        return base;
      case "price-asc":
        return [...base].sort((a, b) => parsePrice(a) - parsePrice(b));
      case "price-desc":
        return [...base].sort((a, b) => parsePrice(b) - parsePrice(a));
    }
  }, [items, q, category, sort]);

  return (
    <>
      <div className="mt-5 flex flex-col items-center gap-3 px-4">
        <SearchBox initialValue={q} onChange={setQ} />
        <div className="flex flex-wrap items-center justify-center gap-1 text-[12px]">
          {["all", ...categories].map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={[
                "border px-2.5 py-1 uppercase tracking-[0.1em] text-[10px] transition-colors",
                category === c
                  ? "bg-(--color-fg) text-white border-(--color-fg)"
                  : "bg-transparent text-(--color-muted) border-(--color-border) hover:text-(--color-fg) hover:border-(--color-fg)",
              ].join(" ")}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          {(
            [
              ["newest", "Latest"],
              ["oldest", "Oldest"],
              ["price-asc", "Price ↑"],
              ["price-desc", "Price ↓"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={[
                "border px-2 py-0.5 tracking-[0.05em] transition-colors",
                sort === key
                  ? "bg-(--color-fg) text-white border-(--color-fg)"
                  : "bg-transparent text-(--color-muted) border-(--color-border) hover:text-(--color-fg) hover:border-(--color-fg)",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <main className="mx-auto max-w-[1180px] px-8 pb-24 pt-10">
        <CardGrid items={filtered} />
      </main>
    </>
  );
}
