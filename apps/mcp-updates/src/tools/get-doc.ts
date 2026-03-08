import fs from "fs";
import path from "path";
import { loadIndex } from "../lib/loader.js";

const CONTENT_BASE =
  process.env.UPDATES_CONTENT_PATH ??
  path.resolve(process.cwd(), "../../apps/web/src/content/updates");

export function getRegulation(slug: string): {
  title: string;
  date: string;
  sources: string[];
  category: string;
  content: string;
  path: string;
} | null {
  const index = loadIndex();
  const entry = index.find((e) => e.slug === slug);
  if (!entry) return null;

  const filePath = path.join(CONTENT_BASE, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  // Strip frontmatter
  const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");

  return {
    title: entry.title,
    date: entry.date,
    sources: entry.sources,
    category: entry.category,
    content,
    path: entry.path,
  };
}
