"use client";

// URL-backed filter/sort state. Mounting this hook reads ?category, ?owner,
// ?sort, ?show_oos and exposes a setter that updates the URL via the App
// Router. State persists across navigations and is shareable.

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import type { FilterState, OwnerFilter, SortMode, ViewMode } from "./filters";
import { DEFAULT_FILTERS } from "./filters";

const VALID_SORT: SortMode[] = ["default", "price-desc", "price-asc"];
const VALID_OWNER: OwnerFilter[] = ["all", "hampus", "jan", "shared"];
const VALID_VIEW: ViewMode[] = ["grid", "list", "compact"];

function readState(sp: URLSearchParams): FilterState {
  const sort = sp.get("sort") as SortMode | null;
  const owner = sp.get("owner") as OwnerFilter | null;
  const view = sp.get("view") as ViewMode | null;
  return {
    category: sp.get("category") ?? DEFAULT_FILTERS.category,
    owner: VALID_OWNER.includes(owner!) ? owner! : DEFAULT_FILTERS.owner,
    sort: VALID_SORT.includes(sort!) ? sort! : DEFAULT_FILTERS.sort,
    showOos: sp.get("show_oos") === "1",
    view: VALID_VIEW.includes(view!) ? view! : DEFAULT_FILTERS.view,
  };
}

function writeState(state: FilterState): URLSearchParams {
  const sp = new URLSearchParams();
  if (state.category !== "all") sp.set("category", state.category);
  if (state.owner !== "all") sp.set("owner", state.owner);
  if (state.sort !== "default") sp.set("sort", state.sort);
  if (state.showOos) sp.set("show_oos", "1");
  if (state.view !== "grid") sp.set("view", state.view);
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
