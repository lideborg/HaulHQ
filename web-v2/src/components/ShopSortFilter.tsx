"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { COLOR_FAMILIES } from "@/lib/colors";

const SORTS = [
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "new", label: "Recently added" },
  { key: "brand", label: "Brand: A to Z" },
  { key: "popular", label: "Most popular" },
] as const;

function buildHref(
  base: Record<string, string | undefined>,
  over: Record<string, string | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return `/shop${s ? `?${s}` : ""}`;
}

export function ShopSortFilter({
  brand,
  category,
  q,
  showAll,
  sort,
  color,
  min,
  max,
}: {
  brand?: string;
  category?: string;
  q?: string;
  showAll: boolean;
  sort?: string;
  color?: string;
  min?: string;
  max?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lo, setLo] = useState(min ?? "");
  const [hi, setHi] = useState(max ?? "");
  const base = { brand, category, q, all: showAll ? "1" : undefined, sort, color, min, max };
  const go = (over: Record<string, string | undefined>) =>
    router.replace(buildHref(base, over));
  const activeSort = sort ?? "new";
  const dirty = Boolean(sort || color || min || max);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Sort and filter"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-7 w-7 items-center justify-center border ${
          open || dirty ? "border-black" : "border-neutral-300"
        } hover:border-black`}
      >
        <span className="grid grid-cols-2 gap-[2px]">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="h-[5px] w-[5px] bg-black" />
          ))}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-2 w-64 border border-black bg-white p-4 shadow-lg">
          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Sort</p>
          <ul className="space-y-1.5">
            {SORTS.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => go({ sort: s.key === "new" ? undefined : s.key })}
                  className={`text-xs ${
                    activeSort === s.key
                      ? "font-semibold text-black"
                      : "text-neutral-600 hover:text-black"
                  }`}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="my-3 border-t border-neutral-200" />

          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">Color</p>
          <div className="grid grid-cols-6 gap-1.5">
            <button
              type="button"
              aria-label="All colors"
              onClick={() => go({ color: undefined })}
              className={`flex h-6 w-6 items-center justify-center border text-[8px] leading-none ${
                !color ? "ring-2 ring-black ring-offset-1" : "border-neutral-300"
              }`}
            >
              All
            </button>
            {COLOR_FAMILIES.map((f) => (
              <button
                key={f.slug}
                type="button"
                aria-label={f.label}
                title={f.label}
                onClick={() => go({ color: color === f.slug ? undefined : f.slug })}
                className={`h-6 w-6 border border-neutral-300 ${
                  color === f.slug ? "ring-2 ring-black ring-offset-1" : ""
                }`}
                style={
                  f.swatch === "conic"
                    ? {
                        background:
                          "conic-gradient(#e5484d,#f5a623,#f7e017,#4caf50,#3a5a95,#8a4a8a,#e5484d)",
                      }
                    : { backgroundColor: f.swatch }
                }
              />
            ))}
          </div>

          <div className="my-3 border-t border-neutral-200" />

          <p className="mb-2 text-[10px] uppercase tracking-widest text-neutral-500">
            Price (USD)
          </p>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              go({ min: lo || undefined, max: hi || undefined });
            }}
          >
            <input
              inputMode="numeric"
              value={lo}
              onChange={(e) => setLo(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="w-16 border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-black"
            />
            <span className="text-neutral-400">to</span>
            <input
              inputMode="numeric"
              value={hi}
              onChange={(e) => setHi(e.target.value.replace(/\D/g, ""))}
              placeholder="670"
              className="w-16 border border-neutral-300 px-2 py-1 text-xs outline-none focus:border-black"
            />
            <button
              type="submit"
              className="border border-black px-2 py-1 text-[10px] uppercase tracking-widest hover:bg-black hover:text-white"
            >
              Go
            </button>
          </form>

          {dirty && (
            <button
              type="button"
              onClick={() => {
                setLo("");
                setHi("");
                go({ sort: undefined, color: undefined, min: undefined, max: undefined });
              }}
              className="mt-3 text-[10px] uppercase tracking-widest text-neutral-400 underline hover:text-black"
            >
              Reset
            </button>
          )}
        </div>
      )}
    </div>
  );
}
