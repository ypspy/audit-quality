export type UpdatesIndexEntry = {
  slug: string;
  path: string;
  title: string;
  date: string;          // "2025-12-31"
  periodLabel: string;   // "2025-Q4"
  sources: string[];     // ["금융감독원", "금융위원회"]
  category: string;
  tags: string[];
  summary: string;
};

// Server-side: reads from filesystem (Node.js only)
export function loadUpdatesIndex(): UpdatesIndexEntry[] {
  // Dynamic require to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = require("../../src/content/updates-index.json");
  return data as UpdatesIndexEntry[];
}

// Unique values helpers
export function uniqueSources(index: UpdatesIndexEntry[]): string[] {
  return [...new Set(index.flatMap((e) => e.sources))].sort();
}

export function uniqueCategories(index: UpdatesIndexEntry[]): string[] {
  return [...new Set(index.map((e) => e.category))].sort();
}
