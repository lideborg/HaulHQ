// PostgREST caps a single request at 1000 rows, so any unbounded .select()
// silently truncates once a table passes 1000 (e.g. products stop showing in
// the shop, facet counts freeze at 1000). Page through in 1000-row windows
// until a short page. `makePage(from,to)` MUST rebuild the same filtered +
// ORDERED query each call (a Supabase builder is single-use after await), and
// the order() is what makes the ranges stable across pages.
export const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  makePage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await makePage(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < PAGE_SIZE) break;
  }
  return all;
}
