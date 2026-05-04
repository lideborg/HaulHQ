import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { GlossaryFile, SellersFile } from "@/types/notes";

const REPO_ROOT = path.resolve(process.cwd(), "..");

async function readJSON<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, "utf8")) as T;
}

export async function loadSellers(): Promise<SellersFile> {
  return readJSON<SellersFile>(path.join(REPO_ROOT, "data", "notes", "sellers.json"));
}

export async function loadGlossary(): Promise<GlossaryFile> {
  return readJSON<GlossaryFile>(path.join(REPO_ROOT, "data", "notes", "glossary.json"));
}
