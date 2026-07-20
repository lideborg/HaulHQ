"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/categories";

// Builds a shop URL keeping the current brand while changing the category.
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

export function CategorySidebar({
  handle,
  categories,
  total,
  activeBrand,
  active,
}: {
  handle: string;
  categories: Array<{ slug: string; count: number }>;
  total: number;
  activeBrand?: string;
  active?: string;
}) {
  // Collapsed by default on mobile (tap to expand); always open on desktop (md+).
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-widest md:cursor-default"
      >
        Category{" "}
        <span className="text-neutral-400 md:hidden">{open ? "−" : "+"}</span>
      </button>
      <nav
        className={`mt-3 flex-col gap-1.5 ${open ? "flex" : "hidden"} md:flex`}
      >
        <Row
          href={href(handle, activeBrand, undefined)}
          label="All"
          count={total}
          isActive={!active}
        />
        {categories.map((c) => (
          <Row
            key={c.slug}
            href={href(handle, activeBrand, c.slug)}
            label={CATEGORY_LABEL[c.slug] ?? c.slug}
            count={c.count}
            isActive={active === c.slug}
          />
        ))}
      </nav>
    </div>
  );
}
