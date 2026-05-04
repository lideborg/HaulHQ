"use client";

// Catalog search box — debounced text filter over title / brand / label /
// description / item code. URL-bound via the same useFilterState hook.
//
// We're uncontrolled internally (own `local` state) and controlled
// externally via a `key` on the parent that resets when the URL changes.
// That avoids the setState-in-effect antipattern needed to sync prop→state.

import { useEffect, useRef, useState } from "react";

export interface SearchBoxProps {
  initialValue: string;
  onChange: (next: string) => void;
}

export function SearchBox({ initialValue, onChange }: SearchBoxProps) {
  const [local, setLocal] = useState(initialValue);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounce: only push to URL ~200ms after the user stops typing.
  useEffect(() => {
    if (local === initialValue) return;
    const t = setTimeout(() => onChangeRef.current(local), 200);
    return () => clearTimeout(t);
  }, [local, initialValue]);

  return (
    <div className="relative">
      <svg
        viewBox="0 0 16 16"
        width={14}
        height={14}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-muted)"
      >
        <path
          fill="currentColor"
          d="M11.5 10.3a4.5 4.5 0 1 0-1.2 1.2L13.6 14.8l1.1-1.1zM3 7a4 4 0 1 1 8 0a4 4 0 0 1-8 0"
        />
      </svg>
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Search items, brands, codes…"
        className="w-72 max-w-full rounded-full border border-(--color-border) bg-white py-1.5 pl-9 pr-3 text-[13px] focus:border-(--color-fg) focus:outline-none"
      />
    </div>
  );
}
