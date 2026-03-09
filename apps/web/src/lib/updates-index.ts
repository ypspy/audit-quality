export type UpdatesIndexEntry = {
  quarterlySlug: string;  // "quality-updates/2025/2025-01-01_to_2025-03-31"
  path: string;           // "/updates/quality-updates/2025/2025-01-01_to_2025-03-31"
  url: string;            // 외부 원문 링크
  title: string;          // 공시·보도자료 제목
  date: string;           // "2025-03-27" (항목 개별 날짜)
  source: string;         // "금융감독원" (단일)
  periodLabel: string;    // "2025-Q1"
  summary: string;        // !!! note 블록 plain text (없으면 "")
};

// Server-side: reads from filesystem (Node.js only)
export function loadUpdatesIndex(): UpdatesIndexEntry[] {
  // Dynamic require to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const data = require("../../src/content/updates-index.json");
  return data as UpdatesIndexEntry[];
}

// Unique source values for filter UI
export function uniqueSources(index: UpdatesIndexEntry[]): string[] {
  return [...new Set(index.map((e) => e.source))].sort();
}
