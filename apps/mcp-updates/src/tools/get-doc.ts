import fs from "fs";
import path from "path";
import { loadIndex } from "../lib/loader.js";

const CONTENT_BASE =
  process.env.UPDATES_CONTENT_PATH ??
  path.resolve(process.cwd(), "../../apps/web/src/content/updates");

export function getRegulation(quarterlySlug: string): {
  title: string;
  date: string;
  source: string;
  periodLabel: string;
  content: string;
  path: string;
} | null {
  const index = loadIndex();
  // Use the first entry matching quarterlySlug to get metadata
  const entry = index.find((e) => e.quarterlySlug === quarterlySlug);
  if (!entry) return null;

  const filePath = path.join(CONTENT_BASE, `${quarterlySlug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  // Strip frontmatter
  const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");

  return {
    title: entry.title,
    date: entry.date,
    source: entry.source,
    periodLabel: entry.periodLabel,
    content,
    path: entry.path,
  };
}
