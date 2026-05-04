"use client";

// Grid / List / Compact toggle. URL-driven via ?view=.

import type { ViewMode } from "@/lib/filters";

const OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "grid", label: "Grid" },
  { id: "list", label: "List" },
  { id: "compact", label: "Compact" },
];

export interface ViewModeToggleProps {
  active: ViewMode;
  onChange: (next: ViewMode) => void;
}

export function ViewModeToggle({ active, onChange }: ViewModeToggleProps) {
  return (
    <nav className="mt-3 inline-flex overflow-hidden rounded-2xl border border-(--color-border) bg-neutral-50">
      {OPTIONS.map((o) => {
        const isActive = active === o.id;
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={[
              "px-3.5 py-1.5 text-[13px] font-medium transition-colors",
              isActive
                ? "bg-(--color-fg) text-white"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-(--color-fg)",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </nav>
  );
}
