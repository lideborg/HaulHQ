"use client";

// Star toggle for the wishlist. Drops onto the hero corner of any Card.

export interface WishStarProps {
  active: boolean;
  onToggle: () => void;
}

export function WishStar({ active, onToggle }: WishStarProps) {
  return (
    <button
      type="button"
      aria-label={active ? "Remove from haul" : "Add to haul"}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={[
        "absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors",
        active
          ? "bg-(--color-fg) text-amber-300"
          : "bg-white/80 text-neutral-400 hover:text-(--color-fg)",
      ].join(" ")}
    >
      <svg viewBox="0 0 16 16" width={16} height={16} fill="currentColor" aria-hidden="true">
        <path d="M8 1.4l1.95 4.27L14.5 6.4l-3.5 3.04 1.05 4.66L8 11.7l-4.05 2.4L5 9.44 1.5 6.4l4.55-.73Z" />
      </svg>
    </button>
  );
}
