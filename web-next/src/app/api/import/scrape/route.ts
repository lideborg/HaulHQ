import { NextRequest } from "next/server";
import { scrapeYupooAlbum } from "@/lib/yupoo";

export async function POST(request: NextRequest) {
  const { urls } = (await request.json()) as { urls: string[] };

  if (!urls?.length || urls.length > 30) {
    return Response.json(
      { error: "Provide 1-30 URLs" },
      { status: 400 },
    );
  }

  const batchSize = 5;
  const results: Array<
    | { ok: true; album: Awaited<ReturnType<typeof scrapeYupooAlbum>> }
    | { ok: false; url: string; error: string }
  > = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map((url) => scrapeYupooAlbum(url)),
    );
    for (let j = 0; j < settled.length; j++) {
      const r = settled[j];
      if (r.status === "fulfilled") {
        results.push({ ok: true, album: r.value });
      } else {
        results.push({
          ok: false,
          url: batch[j],
          error: r.reason?.message ?? "Unknown error",
        });
      }
    }
  }

  return Response.json({ results });
}
