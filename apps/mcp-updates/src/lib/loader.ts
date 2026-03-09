import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type IndexEntry = {
  quarterlySlug: string;
  path: string;
  url: string;
  title: string;
  date: string;
  source: string;
  periodLabel: string;
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
