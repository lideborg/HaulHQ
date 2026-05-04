// Server-only: read JSON catalog files at request/build time.
// Phase 1 keeps the JSON-on-disk source of truth; Phase 2 swaps this for DB queries.

import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CatalogIndex,
  DataSource,
  IndexEntry,
  Item,
} from "@/types/catalog";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const SOURCES: DataSource[] = ["yupoo", "superbuy"];

async function readJSON<T>(p: string): Promise<T> {
  const buf = await fs.readFile(p, "utf8");
  return JSON.parse(buf) as T;
}

async function loadFromSource(source: DataSource): Promise<Item[]> {
  const dir = path.join(REPO_ROOT, "data", source);
  let idx: CatalogIndex;
  try {
    idx = await readJSON<CatalogIndex>(path.join(dir, "_index.json"));
  } catch {
    return [];
  }
  return Promise.all(
    idx.entries.map(async (entry: IndexEntry) => {
      const raw = await readJSON<Omit<Item, "_slug" | "_dir">>(
        path.join(dir, entry.file)
      );
      return {
        ...raw,
        _slug: entry.file.replace(/\.json$/, ""),
        _dir: source,
      } as Item;
    })
  );
}

export async function loadAllItems(): Promise<Item[]> {
  const groups = await Promise.all(SOURCES.map(loadFromSource));
  return groups.flat();
}
