"use client";

// URL-backed filter state. Reads ?q, ?category, ?owner, ?sort, ?show_oos
// from the URL and exposes a setter that updates the URL via the App Router.
// State persists across navigations and is shareable.

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { FilterState, OwnerFilter, SortMode } from "./filters";
import { DEFAULT_FILTERS } from "./filters";

const VALID_SORT: SortMode[] = ["default", "price-desc", "price-asc"];
const VALID_OWNER: OwnerFilter[] = ["all", "hampus", "jan", "shared"];

function readState(sp: URLSearchParams): FilterState {
  const sort = sp.get("sort") as SortMode | null;
  const owner = sp.get("owner") as OwnerFilter | null;
  return {
    q: sp.get("q") ?? DEFAULT_FILTERS.q,
    category: sp.get("category") ?? DEFAULT_FILTERS.category,
    owner: VALID_OWNER.includes(owner!) ? owner! : DEFAULT_FILTERS.owner,
    sort: VALID_SORT.includes(sort!) ? sort! : DEFAULT_FILTERS.sort,
    showOos: sp.get("show_oos") === "1",
  };
}

function writeState(state: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.q) sp.set("q", state.q);
  if (state.category !== "all") sp.set("category", state.category);
  if (state.owner !== "all") sp.set("owner", state.owner);
  if (state.sort !== "default") sp.set("sort", state.sort);
  if (state.showOos) sp.set("show_oos", "1");
  return sp;
}

export function useFilterState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const state = useMemo(
    () => readState(new URLSearchParams(searchParams.toString())),
    [searchParams]
  );

  const set = useCallback(
    (patch: Partial<FilterState>) => {
      const next = { ...state, ...patch };
      const qs = writeState(next).toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [state, router, pathname]
  );

  return { state, set };
}
