// Pure haul-batch helpers — no framework imports, unit-tested with node --test.
import type { Haul, HaulItem } from "./types";

// Statuses a friend may still edit; anything else is locked (approved by
// them, or already in the admin's order flow). Single source of truth for
// actions, pages, and the nav badge.
export const UNLOCKED_STATUSES = ["saved", "requested", "sourcing", "quoted"];
export const LOCKED_STATUSES = ["confirmed", "ordered", "shipped", "arrived"];

// Admin reached out and the seller doesn't have it. The item stays in the haul
// as a record for the friend, but greyed out, excluded from every total, and
// never sent for ordering. A terminal state outside the unlocked/locked axis.
export const UNAVAILABLE_STATUS = "unavailable";

// Statuses a friend may delete from their haul: the editable ones, plus an
// unavailable item they want to tidy away.
export const REMOVABLE_STATUSES = [...UNLOCKED_STATUSES, UNAVAILABLE_STATUS];

// Items written before the status column settled may carry null; treat those
// as editable rather than silently locking them away from the friend.
export function isUnlocked(status: string | null | undefined): boolean {
  return status == null || UNLOCKED_STATUSES.includes(status);
}

export function isUnavailable(status: string | null | undefined): boolean {
  return status === UNAVAILABLE_STATUS;
}

// "Haul 01" — zero-padded to two digits so the list reads like a ledger.
export function haulLabel(number: number): string {
  return `Haul ${String(number).padStart(2, "0")}`;
}

export interface HaulGroup {
  haul: Haul;
  items: HaulItem[];
}

// Split a friend's hauls + items into the one being built and the archive.
// Past hauls newest-first; items within a haul newest-first. Items whose
// haul_id matches nothing (mid-deploy writes) are ignored here — the data
// layer adopts them before calling this.
export function groupItemsByHaul(
  hauls: Haul[],
  items: HaulItem[],
): { open: HaulGroup | null; past: HaulGroup[] } {
  const byHaul = new Map<string, HaulItem[]>();
  for (const item of items) {
    if (!item.haul_id) continue;
    const list = byHaul.get(item.haul_id) ?? [];
    list.push(item);
    byHaul.set(item.haul_id, list);
  }
  const groups = hauls.map((haul) => ({
    haul,
    items: (byHaul.get(haul.id) ?? []).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  }));
  const open = groups.find((g) => g.haul.status === "open") ?? null;
  const past = groups
    .filter((g) => g.haul.status === "approved")
    .sort((a, b) => b.haul.number - a.haul.number);
  return { open, past };
}
