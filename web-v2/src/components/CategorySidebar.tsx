"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORY_LABEL } from "@/lib/categories";

// Builds a shop URL keeping the current brand while changing the category.
function href(brand?: string, category?: string) {
  const p = new URLSearchParams();
  if (brand) p.set("brand", brand);
  if (category) p.set("category", category);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

export function CategorySidebar({
  categories,
  activeBrand,
  active,
}: {
  categories: string[];
  activeBrand?: string;
  active?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mt-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-widest"
      >
        Category <span className="text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <nav className="mt-3 flex flex-col gap-1.5">
          <Link
            href={href(activeBrand, undefined)}
            className={`text-[11px] uppercase tracking-wide ${
              !active ? "font-semibold" : "text-neutral-500 hover:text-black"
            }`}
          >
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={href(activeBrand, c)}
              className={`text-[11px] uppercase tracking-wide ${
                active === c ? "font-semibold" : "text-neutral-500 hover:text-black"
              }`}
            >
              {CATEGORY_LABEL[c] ?? c}
            </Link>
          ))}
        </nav>
      )}
    </div>
  );
}
