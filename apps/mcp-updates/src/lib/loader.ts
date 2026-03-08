import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type IndexEntry = {
  slug: string;
  path: string;
  title: string;
  date: string;
  periodLabel: string;
  sources: string[];
  category: string;
  tags: string[];
  summary: string;
};

const INDEX_PATH =
  process.env.UPDATES_INDEX_PATH ??
  path.resolve(__dirname, "../../updates-index.json");

let _cache: IndexEntry[] | null = null;

export function loadIndex(): IndexEntry[] {
  if (_cache) return _cache;
  const raw = fs.readFileSync(INDEX_PATH, "utf-8");
  _cache = JSON.parse(raw) as IndexEntry[];
  return _cache;
}
