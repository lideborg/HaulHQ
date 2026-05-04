// Sellers reference grid — verdict + contact + notes per seller.
// Server component; data is read at build time.

import type { Seller, SellersFile } from "@/types/notes";

const verdictClass: Record<string, string> = {
  trusted: "bg-neutral-900 text-white border-neutral-900",
  "use-via-agent": "bg-amber-50 text-amber-900 border-amber-700",
  avoid: "bg-red-50 text-red-900 border-red-700",
  unknown: "bg-neutral-100 text-neutral-700 border-neutral-500",
};

export function SellersList({ data }: { data: SellersFile }) {
  return (
    <section>
      <h2 className="m-0 mb-6 border-b border-(--color-fg) pb-3 text-[14px] font-medium uppercase tracking-[0.16em]">
        Sellers · {data.sellers.length}
      </h2>
      <div className="grid grid-cols-1 gap-px bg-(--color-border) border border-(--color-border) sm:grid-cols-2 lg:grid-cols-3">
        {data.sellers.map((s) => (
          <SellerCard key={s.name} seller={s} />
        ))}
      </div>
    </section>
  );
}

function SellerCard({ seller }: { seller: Seller }) {
  const verdict = seller.verdict ?? "unknown";
  return (
    <div className="bg-(--color-bg) px-5 py-4">
      <h3 className="m-0 mb-1 text-[14px] font-medium tracking-tight">{seller.name}</h3>
      <span
        className={[
          "mb-3 inline-block border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em]",
          verdictClass[verdict],
        ].join(" ")}
      >
        {verdict.replace(/-/g, " ")}
      </span>
      {seller.specialty ? (
        <p className="mb-3 text-[11px] uppercase tracking-[0.06em] text-(--color-muted)">
          {seller.specialty}
        </p>
      ) : null}
      {seller.notes ? (
        <p className="m-0 mb-3 whitespace-pre-line text-[12px] leading-relaxed text-neutral-700">
          {seller.notes}
        </p>
      ) : null}
      <ContactList seller={seller} />
    </div>
  );
}

function ContactList({ seller }: { seller: Seller }) {
  const rows: Array<[string, React.ReactNode]> = [];
  if (seller.yupoo)
    rows.push([
      "yupoo",
      <a key="y" href={seller.yupoo} target="_blank" rel="noopener noreferrer">
        {seller.yupoo}
      </a>,
    ]);
  if (seller.yupoo_password) rows.push(["password", seller.yupoo_password]);
  for (const [k, v] of Object.entries(seller.contact ?? {})) {
    if (!v) continue;
    if (Array.isArray(v)) {
      rows.push([k, <span key={k}>{v.join("; ")}</span>]);
    } else if (typeof v === "object") {
      rows.push([k, <span key={k}>{Object.values(v as Record<string, unknown>).filter(Boolean).join("; ")}</span>]);
    } else {
      rows.push([k, String(v)]);
    }
  }
  if (rows.length === 0) return null;
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-[11px] text-(--color-muted)">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="uppercase tracking-[0.06em]">{k}</dt>
          <dd className="m-0 break-all text-neutral-700">{v}</dd>
        </div>
      ))}
    </dl>
  );
}
