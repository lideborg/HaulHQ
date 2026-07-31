"use client";

import { useTransition } from "react";
import { setQuantity } from "@/app/[handle]/haul-actions";

export function QuantityStepper({
  handle,
  itemId,
  quantity,
}: {
  handle: string;
  itemId: string;
  quantity: number;
}) {
  const [pending, start] = useTransition();
  const step = (next: number) =>
    start(async () => {
      await setQuantity(handle, itemId, next);
    });
  return (
    <span className="inline-flex items-center border border-neutral-200 text-xs">
      <button
        type="button"
        disabled={pending || quantity <= 1}
        onClick={() => step(quantity - 1)}
        className="px-2 py-0.5 text-neutral-500 transition hover:text-black disabled:opacity-30"
        aria-label="Fewer"
      >
        −
      </button>
      <span className="min-w-5 text-center tabular-nums">{quantity}</span>
      <button
        type="button"
        disabled={pending || quantity >= 9}
        onClick={() => step(quantity + 1)}
        className="px-2 py-0.5 text-neutral-500 transition hover:text-black disabled:opacity-30"
        aria-label="More"
      >
        +
      </button>
    </span>
  );
}
