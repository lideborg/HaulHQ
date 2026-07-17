import { createAdminClient } from "@/lib/supabase/admin";
import { updateProduct, togglePublished } from "./actions";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProducts() {
  const sb = createAdminClient();
  const { data } = await sb
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];
  return (
    <main className="mx-auto max-w-[1200px] px-6 py-10">
      <h1 className="mb-8 text-sm font-semibold uppercase tracking-[0.25em]">
        Products ({products.length})
      </h1>
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="flex items-center gap-3 border-b border-neutral-100 py-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-12 w-12 bg-neutral-100 object-cover" />
            <form action={updateProduct} className="flex flex-1 items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="title" defaultValue={p.title} className="flex-1 border border-neutral-200 px-2 py-1 text-xs" />
              <span className="text-[10px] uppercase text-neutral-400">{p.brand}</span>
              <input name="price_usd" defaultValue={p.price_usd ?? ""} className="w-20 border border-neutral-200 px-2 py-1 text-right text-xs" />
              <button className="border border-neutral-300 px-2 py-1 text-[10px] uppercase">Save</button>
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
        ))}
      </div>
    </main>
  );
}
