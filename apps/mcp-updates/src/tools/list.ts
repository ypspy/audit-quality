import { loadIndex, type IndexEntry } from "../lib/loader.js";

export function listRegulations(params: {
  limit?: number;
  source?: string;
}): IndexEntry[] {
  let entries = loadIndex();

  if (params.source) {
    entries = entries.filter((e) => e.source === params.source);
  }

  return entries.slice(0, params.limit ?? 10);
}
