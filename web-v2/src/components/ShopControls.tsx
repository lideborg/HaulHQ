import Link from "next/link";

// Search box + "hide sold out" toggle for the shop grid. Entirely URL-driven:
// the form GETs ?q=…, the toggle links to ?instock=1 — no client JS.
export function ShopControls({
  handle,
  brand,
  category,
  q,
  instock,
}: {
  handle: string;
  brand?: string;
  category?: string;
  q?: string;
  instock?: string;
}) {
  const href = (over: Record<string, string | undefined>) => {
    const merged: Record<string, string | undefined> = { brand, category, q, instock, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return `/${handle}/shop${s ? `?${s}` : ""}`;
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3">
      <form action={`/${handle}/shop`} method="get" className="flex">
        {brand && <input type="hidden" name="brand" value={brand} />}
        {category && <input type="hidden" name="category" value={category} />}
        {instock && <input type="hidden" name="instock" value={instock} />}
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search brand or item…"
          className="w-56 border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-black"
        />
        <button className="border border-l-0 border-neutral-300 px-3 py-1.5 text-[11px] uppercase tracking-widest hover:border-black">
          Search
        </button>
      </form>
      <Link
        href={href({ instock: instock ? undefined : "1" })}
        className={`border px-3 py-1.5 text-[11px] uppercase tracking-widest ${
          instock
            ? "border-black bg-black text-white"
            : "border-neutral-300 text-neutral-500 hover:border-black hover:text-black"
        }`}
      >
        {instock ? "✓ Hiding sold out" : "Hide sold out"}
      </Link>
      {q && (
        <Link
          href={href({ q: undefined })}
          className="text-[11px] uppercase tracking-widest text-neutral-400 underline hover:text-black"
        >
          Clear &ldquo;{q}&rdquo;
        </Link>
      )}
    </div>
  );
}
