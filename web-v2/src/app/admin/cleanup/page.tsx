import { createAdminClient } from "@/lib/supabase/admin";
import { setBrand, setTitle } from "./actions";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

// Temporary cleanup page — delete this folder when Hampus is done.
// Numbering is continuous across both sections so "number 7" is unambiguous.
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
        with long titles. Numbers are unique across both sections — tell Claude
        &ldquo;3 = Prada, 17 = shorter title&rdquo; or type + Save yourself.
      </p>

      <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest">
        1 · Missing / junk brand ({noBrand.length})
      </h2>
      <div className="mb-12 space-y-4">
        {noBrand.map((p, i) => (
          <div key={p.id} className="flex items-center gap-5 border-b border-neutral-100 pb-4">
            <span className="w-12 shrink-0 text-2xl font-semibold tabular-nums text-neutral-300">
              {i + 1}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-56 w-56 shrink-0 bg-neutral-100 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">{p.title}</p>
              <p className="mt-1 text-[11px] text-neutral-400">
                {p.seller ?? "no seller"} · current brand: {p.brand ?? "—"}
              </p>
              <form action={setBrand} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="brand"
                  placeholder="Brand…"
                  className="w-72 border border-neutral-300 px-3 py-2 text-sm"
                />
                <button className="bg-black px-5 py-2 text-[11px] uppercase tracking-widest text-white">
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
      <div className="space-y-4">
        {longTitle.map((p, i) => (
          <div key={p.id} className="flex items-center gap-5 border-b border-neutral-100 pb-4">
            <span className="w-12 shrink-0 text-2xl font-semibold tabular-nums text-neutral-300">
              {noBrand.length + i + 1}
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image_urls?.[0]} alt="" className="h-56 w-56 shrink-0 bg-neutral-100 object-contain" />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-neutral-400">
                {p.brand ?? "no brand"} · {p.title.length} chars
              </p>
              <form action={setTitle} className="mt-3 flex gap-2">
                <input type="hidden" name="id" value={p.id} />
                <input
                  name="title"
                  defaultValue={p.title}
                  className="flex-1 border border-neutral-300 px-3 py-2 text-sm"
                />
                <button className="bg-black px-5 py-2 text-[11px] uppercase tracking-widest text-white">
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
