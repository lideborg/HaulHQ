// Classify a pasted product link. Pure — no framework imports, unit-tested.
// Superbuy "buy page" wrappers are unwrapped to the underlying store link so
// we always persist the canonical source (spec §4.1).
export type SourceKind = "yupoo_album" | "yupoo_shop" | "weidian" | "taobao";

export interface SourceLink {
  kind: SourceKind;
  url: string; // canonical (unwrapped) link
  itemId: string | null;
  shop: string | null; // yupoo subdomain, when applicable
}

export function classifySourceLink(raw: string): SourceLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  if (/(^|\.)superbuy\.com$/i.test(u.hostname)) {
    const inner = u.searchParams.get("url");
    return inner ? classifySourceLink(inner) : null;
  }

  const yupoo = u.hostname.match(/^([a-z0-9-]+)\.x\.yupoo\.com$/i);
  if (yupoo) {
    const shop = yupoo[1].toLowerCase();
    const album = u.pathname.match(/^\/albums\/(\d+)/);
    if (album)
      return { kind: "yupoo_album", url: u.toString(), itemId: album[1], shop };
    return { kind: "yupoo_shop", url: u.toString(), itemId: null, shop };
  }

  if (/(^|\.)weidian\.com$/i.test(u.hostname)) {
    const itemId =
      u.searchParams.get("itemID") ??
      u.searchParams.get("itemId") ??
      u.searchParams.get("id");
    return { kind: "weidian", url: u.toString(), itemId, shop: null };
  }

  if (/(^|\.)(taobao|tmall)\.com$/i.test(u.hostname)) {
    return { kind: "taobao", url: u.toString(), itemId: u.searchParams.get("id"), shop: null };
  }

  return null;
}

// Admin builds this on the fly for weidian/taobao sources — never stored.
export function superbuyWrap(url: string): string {
  return `https://www.superbuy.com/en/page/buy/?from=search-input&url=${encodeURIComponent(url)}`;
}

export function yupooSubdomain(url: string | null): string | null {
  if (!url) return null;
  try {
    const m = new URL(url).hostname.match(/^([a-z0-9-]+)\.x\.yupoo\.com$/i);
    return m ? m[1].toLowerCase() : null;
  } catch {
    return null;
  }
}
