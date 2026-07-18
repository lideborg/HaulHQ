import { createAdminClient } from "@/lib/supabase/admin";
import { setBrand, setTitle } from "./actions";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

// Temporary cleanup page — delete this folder when Hampus is done.
const JUNK_BRANDS = ["i795", "Unbranded", "VC (archive-style rep)"];
const LONG_TITLE = 60;

export default async function CleanupPage() {
  const sb = createAdminClient();
  const { data } = await sb.from("products").select("*").order("title");
  const products = (data ?? []) as Product[];

  const noBrand = products.filter(
    (p) => !p.brand || JUNK_BRANDS.includes(p.brand),
  );
  const longTitle = products.filter(
    (p) => p.title.length > LONG_TITLE && !noBrand.includes(p),
  );

  return (
    <main className="mx-auto max-w-[1100px] px-6 py-10">
      <h1 className="mb-2 text-sm font-semibold uppercase tracking-[0.25em]">
        Cleanup — brands & titles
      </h1>
      <p className="mb-10 text-xs text-neutral-500">
        Temporary page. {noBrand.length} without a brand · {longTitle.length}{" "}
        with long titles. Type and hit Save; changes go live instantly.
      </p>

      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
        1 · Missing / junk brand ({noBrand.length})
      </h2>
      <div className="mb-12 space-y-3">
        {noBrand.map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-neutral-100 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-24 w-24 shrink-0 bg-neutral-100 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs">{p.title}</p>
              <p className="text-[10px] text-neutral-400">
                {p.seller ?? "no seller"} · current brand: {p.brand ?? "—"}
              </p>
              <form action={setBrand} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="brand"
                  placeholder="Brand…"
                  className="w-64 border border-neutral-300 px-2 py-1.5 text-xs"
                />
                <button className="bg-black px-4 py-1.5 text-[10px] uppercase tracking-widest text-white">
                  Save
                </button>
              </form>
            </div>
          </div>
        ))}
        {noBrand.length === 0 && (
          <p className="text-xs text-neutral-400">All done 🎉</p>
        )}
      </div>

      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
        2 · Long titles ({longTitle.length}) — shorten to the essentials
      </h2>
      <div className="space-y-3">
        {longTitle.map((p) => (
          <div key={p.id} className="flex items-center gap-4 border-b border-neutral-100 pb-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-24 w-24 shrink-0 bg-neutral-100 object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-neutral-400">
                {p.brand ?? "no brand"} · {p.title.length} chars
              </p>
              <form action={setTitle} className="mt-2 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="title"
                  defaultValue={p.title}
                  className="flex-1 border border-neutral-300 px-2 py-1.5 text-xs"
                />
                <button className="bg-black px-4 py-1.5 text-[10px] uppercase tracking-widest text-white">
                  Save
                </button>
              </form>
            </div>
          </div>
        ))}
        {longTitle.length === 0 && (
          <p className="text-xs text-neutral-400">All done 🎉</p>
        )}
      </div>
    </main>
  );
}
