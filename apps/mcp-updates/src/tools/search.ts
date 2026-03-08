import Fuse from "fuse.js";
import { loadIndex, type IndexEntry } from "../lib/loader.js";

export function searchRegulations(params: {
  query: string;
  source?: string;
  category?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
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
  if (params.date_from) {
    entries = entries.filter((e) => e.date >= params.date_from!);
  }
  if (params.date_to) {
    entries = entries.filter((e) => e.date <= params.date_to!);
  }

  if (params.query) {
    const fuse = new Fuse(entries, {
      keys: ["title", "summary", "tags", "periodLabel"],
      threshold: 0.35,
    });
    entries = fuse.search(params.query).map((r) => r.item);
  }

  return entries.slice(0, params.limit ?? 5);
}
