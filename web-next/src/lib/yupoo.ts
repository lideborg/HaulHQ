import "server-only";
import type { ScrapedAlbum, ScrapedImage } from "@/types/import";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

function toHighRes(url: string): string {
  return url
    .replace(/\/small\.(jpg|jpeg|png)/, "/big.$1")
    .replace(/\/medium\.(jpg|jpeg|png)/, "/big.$1");
}

function toThumb(url: string): string {
  return url
    .replace(/\/big\.(jpg|jpeg|png)/, "/medium.$1")
    .replace(/\/small\.(jpg|jpeg|png)/, "/medium.$1");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function isSizeChartUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    lower.includes("size") ||
    lower.includes("chart") ||
    lower.includes("尺码") ||
    lower.includes("尺寸") ||
    lower.includes("translated_size")
  );
}

export async function scrapeYupooAlbum(albumUrl: string): Promise<ScrapedAlbum> {
  const sellerMatch = albumUrl.match(/\/\/([^.]+)\.x\.yupoo\.com/);
  const seller = sellerMatch?.[1] ?? null;

  const res = await fetch(albumUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: seller ? `https://${seller}.x.yupoo.com/` : albumUrl,
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch ${albumUrl}: ${res.status}`);
  const html = await res.text();

  let title: string | null = null;
  let description: string | null = null;
  let weidianUrl: string | null = null;
  let taobaoUrl: string | null = null;
  let price: string | null = null;

  // Yupoo album name lives in the gallery header / og:title; the <title> tag is
  // often empty on i795-style "Supplier Product Catalog" pages.
  const galleryTitle = html.match(/showalbumheader__gallerytitle[^>]*>([^<]+)</i);
  const ogTitle = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  const rawTitle =
    galleryTitle?.[1]?.trim() ||
    ogTitle?.[1]?.split("|")[0].trim() ||
    titleTag?.[1]?.replace(/ - .*$/, "").trim() ||
    null;
  if (rawTitle) title = decodeEntities(rawTitle);

  const weidianMatch = html.match(/https?:\/\/(?:www\.)?weidian\.com\/item\.html\?[^"'\s<]+/i);
  if (weidianMatch) weidianUrl = decodeEntities(weidianMatch[0]);

  const taobaoMatch = html.match(/https?:\/\/(?:item\.)?taobao\.com\/item\.htm\?[^"'\s<]+/i);
  if (taobaoMatch) taobaoUrl = decodeEntities(taobaoMatch[0]);

  const priceMatch = title?.match(/[￥¥]\s*(\d+(?:\.\d+)?)/);
  if (priceMatch) {
    price = `¥${priceMatch[1]}`;
    // strip the trailing price from the display title so the label stays clean
    title = title!.replace(/[￥¥]\s*\d+(?:\.\d+)?\s*$/, "").trim();
  }

  const descMatch = html.match(/"album_description"\s*:\s*"([^"]*)"/);
  if (descMatch) description = descMatch[1];

  const imageUrls: string[] = [];

  const photoRegex = /https?:\/\/photo\.yupoo\.com\/[^"'\s<>]+?\/(?:big|medium|small)\.(jpg|jpeg|png)/gi;
  let match;
  while ((match = photoRegex.exec(html)) !== null) {
    const bigUrl = toHighRes(match[0]);
    if (!imageUrls.includes(bigUrl)) {
      imageUrls.push(bigUrl);
    }
  }

  if (imageUrls.length === 0) {
    const altRegex = /https?:\/\/photo\.yupoo\.com\/[^"'\s<>]+?\.(jpg|jpeg|png)/gi;
    while ((match = altRegex.exec(html)) !== null) {
      if (!imageUrls.includes(match[0])) {
        imageUrls.push(match[0]);
      }
    }
  }

  const images: ScrapedImage[] = imageUrls.map((url, i) => {
    const isLastTwo = i >= imageUrls.length - 2;
    const looksLikeSizeChart = isSizeChartUrl(url) || isLastTwo;

    return {
      url,
      thumbUrl: toThumb(url),
      // Default every image to "keep" — with large galleries it's far less
      // clicking to uncheck a few than to check many. User then marks the
      // thumbnail + size chart and unchecks anything unwanted.
      tag: "keep" as const,
      autoDetected: looksLikeSizeChart ? "size-chart" : undefined,
    };
  });

  const suggestedSlug = title
    ? slugify(title.replace(/[￥¥]\s*\d+/, "").trim())
    : `album-${Date.now()}`;

  return {
    sourceUrl: albumUrl,
    title,
    description,
    seller,
    weidianUrl,
    taobaoUrl,
    price,
    suggestedSlug,
    images,
  };
}
