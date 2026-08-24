// Background enrichment for friend-pasted links. Best-effort by design: any
// failure (blocked fetch, weird markup, storage error) must still land the
// item as a plain "requested" link — the admin inbox is the guarantee.
import { createAdminClient } from "@/lib/supabase/admin";
import { classifySourceLink, yupooAlbumUrl } from "./sourceLink";
import {
  parseYupooAlbum,
  parseWeidianItem,
  yupooParentAlbum,
  type ParsedSource,
} from "./sourceParse";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const CNY_PER_USD = 7.2;
// Only fetch images from the stores' own hosts/CDNs - og:image is
// attacker-controllable content, and redirects are refused below (SSRF).
const IMAGE_HOSTS = /(^|\.)(yupoo\.com|weidian\.com|geilicdn\.com|alicdn\.com)$/i;

export async function resolveSourcingItem(itemId: string): Promise<void> {
  const sb = createAdminClient();
  const patch: Record<string, unknown> = {};
  try {
    const { data: item } = await sb
      .from("items")
      .select("id, source_link")
      .eq("id", itemId)
      .single();
    let src = item?.source_link ? classifySourceLink(item.source_link) : null;
    // A single-photo permalink (friend clicked INTO a photo before copying)
    // has no price or buy link — its page names the parent album, so upgrade
    // to that and persist the album as the item's canonical source. If the
    // album can't be resolved, fall through and parse the photo page itself
    // (already fetched — don't burn a second request on the same URL).
    let prefetched: string | null = null;
    if (src?.kind === "yupoo_photo" && src.shop) {
      const photoHtml = await fetchSource(src.url, true);
      const albumId = photoHtml ? yupooParentAlbum(photoHtml) : null;
      if (albumId) {
        const albumUrl = yupooAlbumUrl(src.shop, albumId);
        src = { kind: "yupoo_album", url: albumUrl, itemId: albumId, shop: src.shop };
        patch.source_link = albumUrl;
      } else {
        prefetched = photoHtml;
      }
    }
    // "other" hosts (Goofish, 1688) and idless short links have nothing we can
    // parse — skip straight to filing the plain request.
    if (src && src.kind !== "other") {
      const html =
        prefetched ?? (await fetchSource(src.url, src.kind.startsWith("yupoo")));
      if (html != null) {
        const parsed: ParsedSource =
          src.kind === "weidian" || src.kind === "taobao"
            ? parseWeidianItem(html)
            : parseYupooAlbum(html);
        if (parsed.title) patch.title = parsed.title.slice(0, 200);
        if (parsed.imageUrl) {
          const stored = await mirrorItemImage(
            sb,
            itemId,
            parsed.imageUrl,
            src.kind.startsWith("yupoo"),
          );
          if (stored) patch.image_urls = [stored];
        }
        if (parsed.priceCny != null) {
          patch.sourcing_note = `listed ¥${parsed.priceCny} ≈ $${Math.round(parsed.priceCny / CNY_PER_USD)}`;
        }
      }
    }
  } catch (err) {
    // Best-effort, but not silent: this is the only signal in the Vercel
    // function logs when sourcing breaks (blocked host, markup change).
    console.error(`sourcing failed for item ${itemId}:`, err);
  } finally {
    // .eq status guard: never clobber an item the admin already moved on.
    await sb
      .from("items")
      .update({ ...patch, status: "requested" })
      .eq("id", itemId)
      .eq("status", "sourcing");
  }
}

// One fetch for store pages. Yupoo 404s without a uid param — force uid=1
// when missing. Refuse redirects on purpose: the host is only validated on
// the initial URL, so a 30x could bounce to an internal address (SSRF); a
// 3xx has res.ok === false and returns null like any other failure.
async function fetchSource(url: string, isYupoo: boolean): Promise<string | null> {
  const fetchUrl = new URL(url);
  if (isYupoo && !fetchUrl.searchParams.has("uid"))
    fetchUrl.searchParams.set("uid", "1");
  const res = await fetch(fetchUrl.toString(), {
    headers: { "user-agent": UA },
    signal: AbortSignal.timeout(15000),
    redirect: "manual",
  });
  return res.ok ? await res.text() : null;
}

async function mirrorItemImage(
  sb: ReturnType<typeof createAdminClient>,
  itemId: string,
  imageUrl: string,
  isYupoo: boolean,
): Promise<string | null> {
  try {
    if (!IMAGE_HOSTS.test(new URL(imageUrl).hostname)) return null;
    const headers: Record<string, string> = { "user-agent": UA };
    if (isYupoo) headers.referer = "https://x.yupoo.com/";
    const res = await fetch(imageUrl, {
      headers,
      signal: AbortSignal.timeout(15000),
      redirect: "manual", // refuse redirects: allowlist only checks the initial host (SSRF)
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 5_000) return null; // anti-hotlink placeholder, not a photo
    const key = `items/${itemId}/000.jpg`;
    const { error } = await sb.storage.from("product-images").upload(key, buf, {
      // Key is always 000.jpg; don't trust the source's content-type header
      // (a hostile source could claim text/html).
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) return null;
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${key}`;
  } catch {
    return null;
  }
}
