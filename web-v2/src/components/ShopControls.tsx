import Link from "next/link";
import { LiveSearch } from "./LiveSearch";

function shopHref(
  handle: string,
  params: Record<string, string | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) p.set(k, v);
  const s = p.toString();
  return `/${handle}/shop${s ? `?${s}` : ""}`;
}

// SSENSE-style checkbox at the top of the sidebar. Checked (default) = sold-out
// items hidden; unchecking adds ?all=1 to show everything. URL-driven.
export function SoldOutToggle({
  handle,
  brand,
  category,
  q,
  showAll,
}: {
  handle: string;
  brand?: string;
  category?: string;
  q?: string;
  showAll: boolean;
}) {
  const hiding = !showAll;
  return (
    <Link
      href={shopHref(handle, { brand, category, q, all: hiding ? "1" : undefined })}
      className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-neutral-700 hover:text-black"
    >
      <span
        className={`flex h-3 w-3 items-center justify-center border text-[9px] leading-none ${
          hiding ? "border-black bg-black text-white" : "border-neutral-400 bg-white"
        }`}
      >
        {hiding ? "✓" : ""}
      </span>
      Hide sold out
    </Link>
  );
}

// Search box for the shop header (upper right). Results populate as you type
// (LiveSearch rewrites ?q= debounced); the active filters survive the rewrite.
export function SearchBox({
  handle,
  brand,
  category,
  q,
  showAll,
}: {
  handle: string;
  brand?: string;
  category?: string;
  q?: string;
  showAll: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      {q && (
        <Link
          href={shopHref(handle, { brand, category, all: showAll ? "1" : undefined })}
          className="text-[11px] uppercase tracking-widest text-neutral-400 underline hover:text-black"
        >
          Clear
        </Link>
      )}
      <LiveSearch
        basePath={`/${handle}/shop`}
        params={{ brand, category, all: showAll ? "1" : undefined }}
        initial={q ?? ""}
        placeholder="Search any item or brand…"
        className="w-56 border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-black"
      />
    </div>
  );
}
