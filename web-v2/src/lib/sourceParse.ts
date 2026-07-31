// Best-effort extraction from fetched store pages. Pure string parsing —
// regex over HTML is deliberate (no DOM dependency, page shapes are simple
// meta tags / embedded JSON). Every field is nullable; callers treat null
// as "leave it for the admin".
export interface ParsedSource {
  title: string | null;
  imageUrl: string | null;
  priceCny: number | null;
}

function metaContent(html: string, prop: string): string | null {
  const a = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "i",
  ).exec(html);
  if (a) return a[1] || null;
  const b = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    "i",
  ).exec(html);
  return b ? b[1] || null : null;
}

function absolutize(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("//") ? `https:${url}` : url;
}

function priceFromText(text: string): number | null {
  const m = text.match(/[¥￥]\s*(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

export function parseYupooAlbum(html: string): ParsedSource {
  let title = metaContent(html, "og:title") ?? /<title>([^<]*)<\/title>/i.exec(html)?.[1] ?? null;
  if (title) title = title.replace(/\s*\|[^|]*$/, "").trim() || null;
  let imageUrl = metaContent(html, "og:image");
  if (!imageUrl) {
    imageUrl = /(?:https?:)?\/\/photo\.yupoo\.com\/[^"'\s]+/i.exec(html)?.[0] ?? null;
  }
  return {
    title,
    imageUrl: absolutize(imageUrl),
    priceCny: title ? priceFromText(title) : null,
  };
}

export function parseWeidianItem(html: string): ParsedSource {
  const title =
    metaContent(html, "og:title") ??
    /"itemName"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
    null;
  const imageUrl =
    metaContent(html, "og:image") ??
    /"itemMainPic"\s*:\s*"([^"]+)"/.exec(html)?.[1] ??
    null;
  const price = /"price"\s*:\s*"?(\d+(?:\.\d+)?)"?/.exec(html);
  return {
    title: title?.trim() || null,
    imageUrl: absolutize(imageUrl),
    priceCny: price ? parseFloat(price[1]) : null,
  };
}
