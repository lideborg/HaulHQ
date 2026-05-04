import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { ShippingData } from "@/types/shipping";

const REPO_ROOT = path.resolve(process.cwd(), "..");

let cache: ShippingData | null = null;

export async function loadShippingData(): Promise<ShippingData> {
  if (cache) return cache;
  const buf = await fs.readFile(
    path.join(REPO_ROOT, "web", "shipping-data.json"),
    "utf8"
  );
  cache = JSON.parse(buf) as ShippingData;
  return cache;
}
