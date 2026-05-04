import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { marked } from "marked";
import type {
  GlossaryFile,
  NotesIndex,
  RenderedGuide,
  SellerMessagesFile,
  SellersFile,
} from "@/types/notes";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const NOTES_DIR = path.join(REPO_ROOT, "data", "notes");

async function readJSON<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(p, "utf8")) as T;
}

export async function loadSellers(): Promise<SellersFile> {
  return readJSON<SellersFile>(path.join(NOTES_DIR, "sellers.json"));
}

export async function loadGlossary(): Promise<GlossaryFile> {
  return readJSON<GlossaryFile>(path.join(NOTES_DIR, "glossary.json"));
}

export async function loadSellerMessages(): Promise<SellerMessagesFile> {
  return readJSON<SellerMessagesFile>(path.join(NOTES_DIR, "seller-messages.json"));
}

export async function loadGuides(): Promise<RenderedGuide[]> {
  const idx = await readJSON<NotesIndex>(path.join(NOTES_DIR, "_index.json"));
  return Promise.all(
    idx.guides.map(async (g) => {
      const filePath = path.resolve(NOTES_DIR, g.file);
      const text = await fs.readFile(filePath, "utf8");
      const html = await marked.parse(text);
      return { slug: g.slug, title: g.title, html };
    })
  );
}
