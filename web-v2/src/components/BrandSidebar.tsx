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

export function BrandSidebar({
  handle,
  brands,
  active,
  activeCategory,
}: {
  handle: string;
  brands: string[];
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
          <Link
            href={href(handle, undefined, activeCategory)}
            className={`text-[11px] uppercase tracking-wide ${
              !active ? "font-semibold" : "text-neutral-500 hover:text-black"
            }`}
          >
            All
          </Link>
          {brands.map((b) => (
            <Link
              key={b}
              href={href(handle, b, activeCategory)}
              className={`text-[11px] uppercase tracking-wide ${
                active === b ? "font-semibold" : "text-neutral-500 hover:text-black"
              }`}
            >
              {b}
            </Link>
          ))}
      </nav>
    </div>
  );
}
