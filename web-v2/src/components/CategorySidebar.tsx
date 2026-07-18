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

export function CategorySidebar({
  handle,
  categories,
  activeBrand,
  active,
}: {
  handle: string;
  categories: string[];
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
          <Link
            href={href(handle, activeBrand, undefined)}
            className={`text-[11px] uppercase tracking-wide ${
              !active ? "font-semibold" : "text-neutral-500 hover:text-black"
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={href(handle, activeBrand, c)}
              className={`text-[11px] uppercase tracking-wide ${
                active === c ? "font-semibold" : "text-neutral-500 hover:text-black"
              }`}
            >
              {CATEGORY_LABEL[c] ?? c}
            </Link>
          ))}
      </nav>
    </div>
  );
}
