import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";
import { scrapeYupooAlbum } from "@/lib/yupoo";

const PRELOAD_PATH = path.join(process.cwd(), ".next", "import-preload.json");

export async function POST(request: NextRequest) {
  const { urls } = (await request.json()) as { urls: string[] };

  if (!urls?.length || urls.length > 30) {
    return Response.json({ error: "Provide 1-30 URLs" }, { status: 400 });
  }

  const albums = [];
  const errors = [];
  const batchSize = 5;

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((url) => scrapeYupooAlbum(url)),
    );
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled") {
        albums.push(r.value);
      } else {
        errors.push({ url: batch[j], error: r.reason?.message ?? "Unknown" });
      }
    }
  }

  await fs.writeFile(
    PRELOAD_PATH,
    JSON.stringify({ albums, errors, ts: Date.now() }),
  );

  return Response.json({ ok: true, count: albums.length, errors: errors.length });
}

export async function GET() {
  try {
    const raw = await fs.readFile(PRELOAD_PATH, "utf8");
    return Response.json(JSON.parse(raw));
  } catch {
    return Response.json({ albums: [], errors: [] });
  }
}
