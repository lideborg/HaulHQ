"use client";

import { useState, useTransition } from "react";
import { addToHaul } from "@/app/[handle]/haul-actions";
import type { SizeRec } from "@/lib/sizing";

export function AddToHaul({
  handle,
  productId,
  sizes,
  recommended = null,
  profileHref = null,
}: {
  handle: string;
  productId: string;
  sizes: string[];
  recommended?: SizeRec | null;
  profileHref?: string | null;
}) {
  const [size, setSize] = useState<string | null>(
    recommended && sizes.includes(recommended.size)
      ? recommended.size
      : (sizes[0] ?? null),
  );
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await addToHaul(handle, productId, size);
      if (res.ok) setAdded(true);
      else setError(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-3">
      {sizes.length > 0 && (
        <div>
          <p className="mb-1.5 text-[9px] uppercase tracking-widest text-neutral-400">
            Size
          </p>
          <div className="flex flex-wrap justify-start gap-1.5">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`border px-2 py-1 text-[10px] ${
                  size === s
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 text-neutral-600 hover:border-black hover:text-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          {recommended ? (
            <p className="mt-1.5 text-[10px] leading-relaxed text-neutral-500">
              Recommended: {recommended.reason}
            </p>
          ) : profileHref ? (
            <a href={profileHref} className="mt-1.5 block text-[10px] text-neutral-400 underline hover:text-black">
              Add your sizes for a recommendation →
            </a>
          ) : null}
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending || added}
        className="w-full bg-black py-2 text-[10px] uppercase tracking-widest text-white disabled:opacity-50"
      >
        {added ? "In your haul ✓" : pending ? "Adding…" : "+ Add to haul"}
      </button>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
      {added && (
        <a
          href={`/${handle}/haul`}
          className="block text-center text-[10px] uppercase tracking-widest text-neutral-500 underline"
        >
          View your haul
        </a>
      )}
    </div>
  );
}
