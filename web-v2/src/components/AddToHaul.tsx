"use client";

import { useState, useTransition } from "react";
import { addToHaul } from "@/app/[handle]/haul-actions";

export function AddToHaul({
  handle,
  productId,
  sizes,
}: {
  handle: string;
  productId: string;
  sizes: string[];
}) {
  const [size, setSize] = useState<string | null>(sizes[0] ?? null);
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
    <div className="space-y-4">
      {sizes.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
            Size
          </p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                onClick={() => setSize(s)}
                className={`min-w-[3rem] border px-3 py-2 text-xs ${
                  size === s
                    ? "border-black bg-black text-white"
                    : "border-neutral-300 hover:border-black"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={submit}
        disabled={pending || added}
        className="w-full bg-black py-3 text-xs uppercase tracking-widest text-white disabled:opacity-50"
      >
        {added ? "In your haul ✓" : pending ? "Adding…" : "+ Add to haul"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {added && (
        <a
          href={`/${handle}/haul`}
          className="block text-center text-[11px] uppercase tracking-widest text-neutral-500 underline"
        >
          View your haul
        </a>
      )}
    </div>
  );
}
