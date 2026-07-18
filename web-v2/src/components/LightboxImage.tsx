"use client";

import { useState } from "react";

// Click a thumbnail to view the full image in an overlay; click anywhere to close.
export function LightboxImage({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return <div className={className} />;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        className={`${className ?? ""} cursor-zoom-in`}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/80 p-8"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="max-h-full max-w-full object-contain"
          />
        </div>
      )}
    </>
  );
}
