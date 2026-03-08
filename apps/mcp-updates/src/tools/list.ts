import { loadIndex, type IndexEntry } from "../lib/loader.js";

export function listRegulations(params: {
  limit?: number;
  source?: string;
  category?: string;
}): IndexEntry[] {
  let entries = loadIndex();

  if (params.source) {
    entries = entries.filter((e) => e.sources.includes(params.source!));
  }
  if (params.category) {
    entries = entries.filter((e) =>
      e.category.toLowerCase().includes(params.category!.toLowerCase())
    );
  }

  return entries.slice(0, params.limit ?? 10);
}
