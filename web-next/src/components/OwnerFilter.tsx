"use client";

// Owner pill filter — Hampus / Jan / Shared / All.

import type { OwnerFilter } from "@/lib/filters";

const OPTIONS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hampus", label: "Hampus" },
  { id: "jan", label: "Jan" },
  { id: "shared", label: "Shared" },
];

export interface OwnerFilterProps {
  active: OwnerFilter;
  onChange: (next: OwnerFilter) => void;
}

export function OwnerFilterBar({ active, onChange }: OwnerFilterProps) {
  return (
    <nav className="mt-3 flex flex-wrap justify-center gap-1.5">
      {OPTIONS.map((o) => {
        const isActive = active === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={[
              "rounded-md border px-3 py-1 text-[11px] font-medium transition-colors",
              isActive
                ? "bg-(--color-fg) text-white border-(--color-fg)"
                : "bg-neutral-100 text-(--color-muted) border-transparent hover:bg-neutral-200 hover:text-(--color-fg)",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </nav>
  );
}
