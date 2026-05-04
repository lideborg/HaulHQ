"use client";

// Minimal external store for the wishlist. Backed by localStorage so picks
// survive refresh; multi-tab sync via the native "storage" event.
//
// Phase 2 will replace this with a Supabase-backed user wishlist; the hook
// API (see useWishlist.ts) stays stable.

const KEY = "haul.wishlist";
const EMPTY_SET: ReadonlySet<string> = new Set();

let cached: Set<string> | null = null;
const listeners = new Set<() => void>();

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

function ensureLoaded() {
  if (cached) return;
  cached = read();
}

function write(next: Set<string>) {
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify([...next]));
  } catch {
    // localStorage quota / disabled — silently degrade. Phase 2 will surface
    // an error toast when the auth-backed store is in place.
  }
  for (const fn of listeners) fn();
}

export const wishlistStore = {
  subscribe(cb: () => void): () => void {
    ensureLoaded();
    listeners.add(cb);
    // Reflect cross-tab updates.
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        cached = read();
        cb();
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(cb);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  },
  getSnapshot(): ReadonlySet<string> {
    ensureLoaded();
    return cached!;
  },
  // SSR snapshot — empty wishlist on the server, hydrated on the client.
  // Must return the same reference on every call to satisfy React's
  // useSyncExternalStore invariant ("avoid an infinite loop").
  getServerSnapshot(): ReadonlySet<string> {
    return EMPTY_SET;
  },
  toggle(key: string): void {
    ensureLoaded();
    const next = new Set(cached!);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    write(next);
  },
  clear(): void {
    write(new Set());
  },
  setAll(keys: string[]): void {
    write(new Set(keys));
  },
};
