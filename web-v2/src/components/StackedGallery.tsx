"use client";

import { useEffect, useState } from "react";

// Approach A: every image stacked full-width, in order. Click any image to open
// it full-screen (so measurement shots can be read at full size). Esc / click
// closes.
export function StackedGallery({ images, alt }: { images: string[]; alt: string }) {
  const [zoom, setZoom] = useState<number | null>(null);

  useEffect(() => {
    if (zoom === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(null);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoom]);

  if (!images?.length) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center bg-neutral-100 text-[10px] uppercase tracking-widest text-neutral-300">
        No image
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {images.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={i === 0 ? alt : `${alt} — ${i + 1}`}
          onClick={() => setZoom(i)}
          loading={i === 0 ? "eager" : "lazy"}
          className="w-full cursor-zoom-in bg-neutral-100 object-cover"
        />
      ))}

      {zoom !== null && (
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[zoom]}
            alt={alt}
            className="max-h-full max-w-full cursor-zoom-out object-contain"
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setZoom(null);
            }}
            aria-label="Close"
            className="absolute right-4 top-3 text-3xl leading-none text-white/70 hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
