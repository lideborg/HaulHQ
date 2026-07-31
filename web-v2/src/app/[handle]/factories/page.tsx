import { getFactories } from "@/lib/data";
import { FactorySearch, AddLinkForm } from "@/components/FactoriesControls";

export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function FactoriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { handle } = await params;
  const sp = await searchParams;
  const q = one(sp.q) ?? "";
  const added = one(sp.added) === "1";
  const error = one(sp.error);
  const cards = await getFactories(q);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Factories</h1>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-500">
        These factories and sellers have been curated. Most we have researched
        or ordered from. Looking for a brand that is not in the shop? Search it
        here and we will show you which factories carry it. They open in a
        separate site. Browse, and when you find something you like, paste the
        link below and it is added to your haul. You can remove it any time.
      </p>

      <FactorySearch handle={handle} initial={q} />

      <div className="mt-4 border border-neutral-200 p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest">
          Found something? Add it to your haul
        </p>
        <AddLinkForm handle={handle} />
        {added && (
          <p className="mt-2 text-xs text-neutral-600">
            Added to your haul. We are finding the details in the background.
          </p>
        )}
        {error === "link" && (
          <p className="mt-2 text-xs text-red-600">
            That does not look like a product link from one of our sellers.
            Paste the product page link.
          </p>
        )}
        {error === "save" && (
          <p className="mt-2 text-xs text-red-600">
            Could not save that just now. Try again in a moment.
          </p>
        )}
      </div>

      <p className="mt-8 text-[11px] uppercase tracking-widest text-neutral-500">
        {q ? `“${q}” · ${cards.length} factories` : `${cards.length} factories`}
      </p>
      {cards.length === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          No factory matches that brand yet. Paste a link above and Admin will
          source it anyway.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((c) => (
            <div key={c.displayName} className="border border-neutral-200 p-4">
              <p className="text-sm font-semibold">{c.displayName}</p>
              {c.brands.length > 0 && (
                <p className="mt-1 text-xs text-neutral-500">
                  {c.brands.slice(0, 6).join(" · ")}
                  {c.brands.length > 6 ? ` · +${c.brands.length - 6} more` : ""}
                </p>
              )}
              <div className="mt-3 space-y-1">
                {c.links.map((l) => (
                  <a
                    key={l.url}
                    href={l.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs underline hover:text-neutral-500"
                  >
                    {l.brand} at {c.displayName} →
                  </a>
                ))}
                {c.links.length === 0 && c.yupooUrl && (
                  <a
                    href={c.yupooUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block text-xs underline hover:text-neutral-500"
                  >
                    Visit their shop →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
