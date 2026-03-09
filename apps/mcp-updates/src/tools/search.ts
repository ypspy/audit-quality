import Fuse from "fuse.js";
import { loadIndex, type IndexEntry } from "../lib/loader.js";

export function searchRegulations(params: {
  query: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): IndexEntry[] {
  let entries = loadIndex();

  if (params.source) {
    entries = entries.filter((e) => e.source === params.source);
  }
  if (params.date_from) {
    entries = entries.filter((e) => e.date >= params.date_from!);
  }
  if (params.date_to) {
    entries = entries.filter((e) => e.date <= params.date_to!);
  }

  if (params.query) {
    const fuse = new Fuse(entries, {
      keys: ["title", "summary", "source", "periodLabel"],
      threshold: 0.35,
    });
    entries = fuse.search(params.query).map((r) => r.item);
  }

  return entries.slice(0, params.limit ?? 5);
}
