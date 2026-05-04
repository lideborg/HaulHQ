"use client";

// Category filter chips. Generated from the items currently in the catalog
// (so the chip list stays in sync without a hardcoded enum).

import { categoryLabel } from "@/lib/items";

export interface CategoryFilterProps {
  categories: string[]; // raw category keys, sorted
  active: string;       // "all" or a category key
  onChange: (next: string) => void;
}

export function CategoryFilter({ categories, active, onChange }: CategoryFilterProps) {
  const all = ["all", ...categories];
  return (
    <nav className="mt-4 flex flex-wrap justify-center gap-1.5">
      {all.map((c) => {
        const isActive = active === c;
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={[
              "border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.12em] transition-colors",
              isActive
                ? "bg-(--color-fg) text-white border-(--color-fg)"
                : "bg-transparent text-(--color-muted) border-(--color-border) hover:text-(--color-fg) hover:border-(--color-fg)",
            ].join(" ")}
          >
            {categoryLabel(c)}
          </button>
        );
      })}
    </nav>
  );
}
