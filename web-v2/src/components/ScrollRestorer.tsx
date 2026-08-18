"use client";
import { useEffect } from "react";

// Remembers the shop's scroll position per URL (path + query) in sessionStorage
// and restores it when the friend returns — e.g. taps into a product and presses
// back. `force-dynamic` pages don't reliably keep scroll on back in production
// (the grid refetches and is briefly empty), so this is an explicit backstop that
// works regardless of Next's own restoration.
export function ScrollRestorer() {
  useEffect(() => {
    const key = () => `scroll:${window.location.pathname}${window.location.search}`;
    const saved = sessionStorage.getItem(key());
    if (saved != null) {
      const y = parseInt(saved, 10) || 0;
      // Wait for the grid to lay out before jumping.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)));
    }
    let t: number | undefined;
    const onScroll = () => {
      if (t) return;
      t = window.setTimeout(() => {
        sessionStorage.setItem(key(), String(window.scrollY));
        t = undefined;
      }, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (t) clearTimeout(t);
      // Capture the final position when navigating away (into a product).
      sessionStorage.setItem(key(), String(window.scrollY));
    };
  }, []);
  return null;
}
