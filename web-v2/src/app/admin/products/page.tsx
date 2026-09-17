import { createAdminClient } from "@/lib/supabase/admin";
import { updateProduct, togglePublished, toggleSoldOut } from "./actions";
import { fetchAllRows } from "@/lib/paginate";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

function superbuyLink(source: string | null) {
  if (!source) return null;
  if (source.includes("superbuy.com")) return source;
  return `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(source)}`;
}

const ERRORS: Record<string, string> = {
  price: "Price wasn't a number — use plain digits like 89 or 89.5. Nothing saved.",
  save: "Save failed — try again.",
};

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const sb = createAdminClient();
  // Page past PostgREST's 1000-row cap — the catalog is >1000 products, and a
  // single .select() silently truncates. `id` tie-breaks so no row is skipped
  // or duplicated across page boundaries.
  const products = await fetchAllRows<Product>((from, to) =>
    sb
      .from("products")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, to),
  );
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-tight">
        Products ({products.length})
      </h1>
      {error && (
        <p className="mb-6 border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          {ERRORS[error] ?? "Something went wrong — nothing saved."}
        </p>
      )}
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="border-b border-neutral-100 py-2">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image_urls?.[0]} alt="" className="h-12 w-12 bg-neutral-100 object-cover" />
              <form action={updateProduct} className="flex flex-1 items-center gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="display_title"
                  defaultValue={p.display_title ?? ""}
                  placeholder="Card name (e.g. White Tee)"
                  className="w-44 border border-neutral-200 px-2 py-1 text-xs"
                />
                <input name="title" defaultValue={p.title} className="flex-1 border border-neutral-200 px-2 py-1 text-xs" />
                <span className="text-[10px] uppercase text-neutral-400">{p.brand}</span>
                <input name="price_usd" defaultValue={p.price_usd ?? ""} className="w-20 border border-neutral-200 px-2 py-1 text-right text-xs" />
                <button className="border border-neutral-300 px-2 py-1 text-[10px] uppercase">Save</button>
              </form>
              <form action={toggleSoldOut}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="sold_out" value={String(p.sold_out)} />
                <button
                  className={`px-2 py-1 text-[10px] uppercase ${
                    p.sold_out ? "bg-red-600 text-white" : "border border-neutral-300 text-neutral-400"
                  }`}
                >
                  {p.sold_out ? "Sold out" : "In stock"}
                </button>
              </form>
              <form action={togglePublished}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="published" value={String(p.published)} />
                <button
                  className={`px-2 py-1 text-[10px] uppercase ${
                    p.published ? "bg-black text-white" : "border border-neutral-300 text-neutral-400"
                  }`}
                >
                  {p.published ? "Visible" : "Hidden"}
                </button>
              </form>
            </div>
            <div className="ml-[60px] mt-1 flex gap-4 text-[10px] uppercase tracking-wide">
              {p.source_link && (
                <a href={p.source_link} target="_blank" rel="noreferrer" className="text-neutral-400 underline hover:text-black">
                  {p.source_platform ?? "source"}
                </a>
              )}
              {p.yupoo_url && (
                <a href={p.yupoo_url} target="_blank" rel="noreferrer" className="text-neutral-400 underline hover:text-black">
                  yupoo
                </a>
              )}
              {superbuyLink(p.source_link) && (
                <a href={superbuyLink(p.source_link)!} target="_blank" rel="noreferrer" className="text-neutral-400 underline hover:text-black">
                  superbuy
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
