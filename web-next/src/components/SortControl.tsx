"use client";

// Sort dropdown + "show out-of-stock / skipped" toggle.

import type { SortMode } from "@/lib/filters";

export interface SortControlProps {
  sort: SortMode;
  showOos: boolean;
  hiddenCount: number;
  onSortChange: (next: SortMode) => void;
  onShowOosChange: (next: boolean) => void;
}

export function SortControl({
  sort,
  showOos,
  hiddenCount,
  onSortChange,
  onShowOosChange,
}: SortControlProps) {
  return (
    <nav className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[12px] text-(--color-muted)">
      <label className="inline-flex items-center gap-2">
        <span className="font-medium">Sort:</span>
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortMode)}
          className="cursor-pointer rounded-2xl border border-(--color-border) bg-neutral-50 px-3 py-1.5 pr-7 text-[13px] font-medium text-(--color-fg) hover:bg-neutral-100 focus:border-(--color-fg) focus:outline-none"
        >
          <option value="default">Default</option>
          <option value="price-desc">Price ↓ (high → low)</option>
          <option value="price-asc">Price ↑ (low → high)</option>
        </select>
      </label>
      <label
        className="inline-flex cursor-pointer select-none items-center gap-1.5 hover:text-(--color-fg)"
        title="Hidden by default. Items in your Haul stay visible regardless."
      >
        <input
          type="checkbox"
          checked={showOos}
          onChange={(e) => onShowOosChange(e.target.checked)}
          className="cursor-pointer"
        />
        <span>Show out-of-stock / skipped</span>
        {hiddenCount > 0 ? (
          <span className="text-neutral-400">({hiddenCount})</span>
        ) : null}
      </label>
    </nav>
  );
}
