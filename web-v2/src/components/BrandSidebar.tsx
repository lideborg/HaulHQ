"use client";

import { useState } from "react";
import Link from "next/link";

// Builds a shop URL keeping the current category while changing the brand.
function href(handle: string, brand?: string, category?: string) {
  const p = new URLSearchParams();
  if (brand) p.set("brand", brand);
  if (category) p.set("category", category);
  const s = p.toString();
  return s ? `/${handle}/shop?${s}` : `/${handle}/shop`;
}

// One sidebar row: label left, item count right-aligned in muted figures.
function Row({
  href: to,
  label,
  count,
  isActive,
}: {
  href: string;
  label: string;
  count: number;
  isActive: boolean;
}) {
  return (
    <Link
      href={to}
      className={`flex items-baseline justify-between gap-2 text-[11px] uppercase tracking-wide ${
        isActive ? "font-semibold" : "text-neutral-500 hover:text-black"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-[10px] text-neutral-400">{count}</span>
    </Link>
  );
}

export function BrandSidebar({
  handle,
  brands,
  total,
  active,
  activeCategory,
}: {
  handle: string;
  brands: Array<{ name: string; count: number }>;
  total: number;
  active?: string;
  activeCategory?: string;
}) {
  // Collapsed by default on mobile (tap to expand); always open on desktop (md+).
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-widest md:cursor-default"
      >
        Designers{" "}
        <span className="text-neutral-400 md:hidden">{open ? "−" : "+"}</span>
      </button>
      <nav
        className={`mt-3 flex-col gap-1.5 ${open ? "flex" : "hidden"} md:flex`}
      >
        <Row
          href={href(handle, undefined, activeCategory)}
          label="All"
          count={total}
          isActive={!active}
        />
        {brands.map((b) => (
          <Row
            key={b.name}
            href={href(handle, b.name, activeCategory)}
            label={b.name}
            count={b.count}
            isActive={active === b.name}
          />
        ))}
      </nav>
    </div>
  );
}
