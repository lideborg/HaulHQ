// Research notes rendered from research/*.md, listed via data/notes/_index.json.
// Each guide collapses into a <details> so the Notes tab doesn't fire a
// massive wall of text on first paint.
//
// Server component — markdown is parsed at build time.

import type { RenderedGuide } from "@/types/notes";

export function Guides({ guides }: { guides: RenderedGuide[] }) {
  if (guides.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="m-0 mb-4 border-b border-(--color-fg) pb-3 text-[14px] font-medium uppercase tracking-[0.16em]">
        Guides
      </h2>
      <div className="flex flex-col gap-2">
        {guides.map((g) => (
          <details
            key={g.slug}
            className="group border border-(--color-border) bg-(--color-bg) px-4 py-3 hover:border-neutral-400"
          >
            <summary className="cursor-pointer list-none text-[13px] font-medium tracking-tight">
              <span className="mr-2 inline-block transition-transform group-open:rotate-90">▸</span>
              {g.title}
            </summary>
            <article
              className="guide-md mt-4"
              dangerouslySetInnerHTML={{ __html: g.html }}
            />
          </details>
        ))}
      </div>
    </section>
  );
}
