"use client";

import { useState } from "react";
import Link from "next/link";

export function BrandSidebar({
  brands,
  active,
}: {
  brands: string[];
  active?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <aside className="w-full shrink-0 md:w-52 md:pr-6">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b border-neutral-200 pb-2 text-[11px] font-semibold uppercase tracking-widest"
      >
        Designers <span className="text-neutral-400">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <nav className="mt-3 flex flex-col gap-1.5">
          <Link
            href="/"
            className={`text-[11px] uppercase tracking-wide ${
              !active ? "font-semibold" : "text-neutral-500 hover:text-black"
            }`}
          >
            All
          </Link>
          {brands.map((b) => (
            <Link
              key={b}
              href={`/?brand=${encodeURIComponent(b)}`}
              className={`text-[11px] uppercase tracking-wide ${
                active === b ? "font-semibold" : "text-neutral-500 hover:text-black"
              }`}
            >
              {b}
            </Link>
          ))}
        </nav>
      )}
    </aside>
  );
}
