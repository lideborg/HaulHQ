"use client";

// localStorage-backed prefs for the shipping panel: line, weight profile,
// declared value %.
//
// Same external-store pattern as wishlistStore — single source of truth
// across components, SSR-safe, no setState-in-effect antipattern.

import { useCallback, useSyncExternalStore } from "react";
import type { WeightProfile } from "@/types/shipping";

export interface ShipPrefs {
  lineId: string;
  weightProfile: WeightProfile;
  declaredPct: number;
}

const KEY = "haul.shipPrefs";

const DEFAULTS: ShipPrefs = {
  lineId: "us-ocean-brands",
  weightProfile: "typical",
  declaredPct: 0.1,
};

let cached: ShipPrefs | null = null;
const listeners = new Set<() => void>();

function read(): ShipPrefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<ShipPrefs>;
    return {
      lineId: parsed.lineId ?? DEFAULTS.lineId,
      weightProfile: (parsed.weightProfile ?? DEFAULTS.weightProfile) as WeightProfile,
      declaredPct:
        typeof parsed.declaredPct === "number" ? parsed.declaredPct : DEFAULTS.declaredPct,
    };
  } catch {
    return DEFAULTS;
  }
}

function ensureLoaded() {
  if (cached) return;
  cached = read();
}

function write(next: ShipPrefs) {
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignored
  }
  for (const fn of listeners) fn();
}

const shipPrefsStore = {
  subscribe(cb: () => void): () => void {
    ensureLoaded();
    listeners.add(cb);
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
  getSnapshot(): ShipPrefs {
    ensureLoaded();
    return cached!;
  },
  getServerSnapshot(): ShipPrefs {
    return DEFAULTS;
  },
};

export function useShipPrefs() {
  const prefs = useSyncExternalStore(
    shipPrefsStore.subscribe,
    shipPrefsStore.getSnapshot,
    shipPrefsStore.getServerSnapshot
  );

  const update = useCallback(
    (patch: Partial<ShipPrefs>) => {
      write({ ...shipPrefsStore.getSnapshot(), ...patch });
    },
    []
  );

  return { prefs, update };
}
