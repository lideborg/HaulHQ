import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SaveAlbum } from "@/types/import";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const FAV_DIR = path.join(REPO_ROOT, "data", "favorites");
const INDEX_PATH = path.join(FAV_DIR, "_index.json");
const MIN_SIZE = 15_000;

async function downloadImage(
  url: string,
  dest: string,
  referer: string,
): Promise<boolean> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        Referer: referer,
      },
    });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < MIN_SIZE) return false;
    await fs.writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const { albums } = (await request.json()) as { albums: SaveAlbum[] };

  if (!albums?.length) {
    return Response.json({ error: "No albums" }, { status: 400 });
  }

  const created: string[] = [];

  for (const album of albums) {
    const slug = album.slug;
    const imgDir = path.join(FAV_DIR, "images", slug);
    await fs.mkdir(imgDir, { recursive: true });

    const sellerMatch = album.sourceUrl.match(
      /\/\/([^.]+)\.x\.yupoo\.com/,
    );
    const referer = sellerMatch
      ? `https://${sellerMatch[1]}.x.yupoo.com/`
      : album.sourceUrl;

    const kept = album.images.filter((img) => img.tag !== "skip");
    if (kept.length === 0) continue;
    const thumbnailImg = kept.find((img) => img.tag === "thumbnail");
    const orderedImages = thumbnailImg
      ? [thumbnailImg, ...kept.filter((img) => img !== thumbnailImg)]
      : kept;

    const localPaths: string[] = [];
    const imageUrls: string[] = [];
    let idx = 0;

    for (const img of orderedImages) {
      const filename = `${String(idx).padStart(3, "0")}.jpg`;
      const destPath = path.join(imgDir, filename);
      const ok = await downloadImage(img.url, destPath, referer);
      if (ok) {
        localPaths.push(`images/${slug}/${filename}`);
        imageUrls.push(img.url);
        idx++;
      }
    }

    let superbuyUrl: string | null = null;
    if (album.weidianUrl) {
      superbuyUrl = `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(album.weidianUrl)}`;
    } else if (album.taobaoUrl) {
      superbuyUrl = `https://www.superbuy.com/en/page/buy/?url=${encodeURIComponent(album.taobaoUrl)}`;
    }

    const itemJson = {
      user_label: album.userLabel,
      ...(superbuyUrl && { url: superbuyUrl }),
      ...(album.weidianUrl && { source_url: album.weidianUrl }),
      ...(album.taobaoUrl && !album.weidianUrl && { source_url: album.taobaoUrl }),
      yupoo_url: album.sourceUrl,
      title: album.userLabel,
      brand: album.brand || null,
      category: album.category || null,
      source: "yupoo",
      seller: null as string | null,
      price: album.price || null,
      status: "favorite",
      ...(album.description && { notes: album.description }),
      owners: ["hampus"],
      image_urls: imageUrls,
      local_image_paths: localPaths,
    };

    const sellerName = album.sourceUrl.match(
      /\/\/([^.]+)\.x\.yupoo\.com/,
    );
    if (sellerName) itemJson.seller = sellerName[1];

    const jsonPath = path.join(FAV_DIR, `${slug}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(itemJson, null, 2));

    const indexRaw = await fs.readFile(INDEX_PATH, "utf8");
    const index = JSON.parse(indexRaw) as {
      entries: Array<{ file: string }>;
    };
    const filename = `${slug}.json`;
    if (!index.entries.some((e) => e.file === filename)) {
      index.entries.push({ file: filename });
      await fs.writeFile(INDEX_PATH, JSON.stringify(index, null, 2) + "\n");
    }

    created.push(slug);
  }

  return Response.json({ created, count: created.length });
}
