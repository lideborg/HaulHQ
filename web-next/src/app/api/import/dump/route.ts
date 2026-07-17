import { NextRequest } from "next/server";
import { promises as fs } from "node:fs";
import path from "node:path";

const DUMP_PATH = path.join(process.cwd(), ".next", "fav-dump.json");

export async function POST(request: NextRequest) {
  const body = await request.json();
  await fs.writeFile(DUMP_PATH, JSON.stringify(body, null, 2));
  return Response.json({ ok: true, count: Object.keys(body).length });
}
