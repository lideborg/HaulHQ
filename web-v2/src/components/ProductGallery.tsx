"use client";

import { useState } from "react";

export function ProductGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [active, setActive] = useState(0);
  if (!images?.length) return <div className="aspect-[3/4] bg-neutral-100" />;

  return (
    <div>
      <div className="aspect-[3/4] overflow-hidden bg-neutral-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[active]}
          alt={alt}
          className="h-full w-full object-cover"
        />
      </div>
      {images.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {images.map((u, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-16 w-16 overflow-hidden border ${
                i === active ? "border-black" : "border-neutral-200 hover:border-neutral-400"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
