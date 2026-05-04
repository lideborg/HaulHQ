"use client";

// Single combined toolbar — replaces the previous five stacked nav strips
// (categories, owners, sort, OOS toggle, view-mode, bulk actions). Layout:
//   row 1: search, centered
//   row 2: owner pills · category pills · sort dropdown · show-oos checkbox
// All controls wrap on small screens.

import { SearchBox } from "./SearchBox";
import { categoryLabel } from "@/lib/items";
import type { FilterState, OwnerFilter, SortMode } from "@/lib/filters";

const OWNER_OPTIONS: { id: OwnerFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "hampus", label: "Hampus" },
  { id: "jan", label: "Jan" },
  { id: "shared", label: "Shared" },
];

export interface FilterBarProps {
  state: FilterState;
  categories: string[];
  hiddenCount: number;
  onChange: (patch: Partial<FilterState>) => void;
}

export function FilterBar({ state, categories, hiddenCount, onChange }: FilterBarProps) {
  return (
    <div className="mt-5 flex flex-col items-center gap-3 px-4">
      <SearchBox initialValue={state.q} onChange={(q) => onChange({ q })} />

      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12px]">
        {/* Owner pills */}
        <span className="inline-flex flex-wrap gap-1">
          {OWNER_OPTIONS.map((o) => (
            <Pill
              key={o.id}
              active={state.owner === o.id}
              onClick={() => onChange({ owner: o.id })}
            >
              {o.label}
            </Pill>
          ))}
        </span>

        <span className="hidden h-4 w-px bg-(--color-border) sm:inline-block" />

        {/* Category chips */}
        <span className="inline-flex flex-wrap gap-1">
          {["all", ...categories].map((c) => (
            <Chip
              key={c}
              active={state.category === c}
              onClick={() => onChange({ category: c })}
            >
              {categoryLabel(c)}
            </Chip>
          ))}
        </span>

        <span className="hidden h-4 w-px bg-(--color-border) sm:inline-block" />

        {/* Sort dropdown */}
        <select
          value={state.sort}
          onChange={(e) => onChange({ sort: e.target.value as SortMode })}
          className="cursor-pointer rounded-full border border-(--color-border) bg-neutral-50 px-3 py-1 text-[12px] font-medium hover:bg-neutral-100 focus:border-(--color-fg) focus:outline-none"
        >
          <option value="default">Sort: Default</option>
          <option value="price-desc">Price ↓</option>
          <option value="price-asc">Price ↑</option>
        </select>

        {/* Show out-of-stock / skipped */}
        <label
          className="inline-flex cursor-pointer items-center gap-1.5 text-(--color-muted) hover:text-(--color-fg)"
          title="Hidden by default. Items in your Haul stay visible."
        >
          <input
            type="checkbox"
            checked={state.showOos}
            onChange={(e) => onChange({ showOos: e.target.checked })}
            className="cursor-pointer"
          />
          <span>Show hidden{hiddenCount ? ` (${hiddenCount})` : ""}</span>
        </label>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-md px-2.5 py-1 font-medium transition-colors",
        active
          ? "bg-(--color-fg) text-white"
          : "bg-neutral-100 text-(--color-muted) hover:bg-neutral-200 hover:text-(--color-fg)",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "border px-2.5 py-1 uppercase tracking-[0.1em] text-[10px] transition-colors",
        active
          ? "bg-(--color-fg) text-white border-(--color-fg)"
          : "bg-transparent text-(--color-muted) border-(--color-border) hover:text-(--color-fg) hover:border-(--color-fg)",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
