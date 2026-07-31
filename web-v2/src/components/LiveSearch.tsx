"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Debounced search-as-you-type over a server-rendered page: typing rewrites
// the URL (?q=...) and the server component re-renders with the new query.
// Extra params (brand/category filters etc.) survive the rewrite.
export function LiveSearch({
  basePath,
  params = {},
  initial,
  placeholder,
  className,
}: {
  basePath: string;
  params?: Record<string, string | undefined>;
  initial: string;
  placeholder: string;
  className: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // External navigation (a Clear link, back button) changes ?q= without
  // typing - resync then, but never while the user is mid-keystroke.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(initial);
  }, [initial]);

  function go(next: string) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
    const q = next.trim();
    if (q) p.set("q", q);
    const s = p.toString();
    router.replace(`${basePath}${s ? `?${s}` : ""}`, { scroll: false });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        go(value);
      }}
    >
      <input
        ref={inputRef}
        type="search"
        name="q"
        value={value}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => go(next), 250);
        }}
        placeholder={placeholder}
        spellCheck={false}
        className={className}
      />
    </form>
  );
}
