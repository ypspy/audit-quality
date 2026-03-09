"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Fuse from "fuse.js";
import type { UpdatesIndexEntry } from "@/lib/updates-index";

const SOURCE_COLORS: Record<string, string> = {
  "금융감독원": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "금융위원회": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "회계기준원": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "공인회계사회": "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
};

function Badge({ label }: { label: string }) {
  const cls = SOURCE_COLORS[label] ?? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

export function UpdatesSearch({
  entries,
  allSources,
}: {
  entries: UpdatesIndexEntry[];
  allSources: string[];
}) {
  const [query, setQuery] = useState("");
  const [activeSource, setActiveSource] = useState<string | null>(null);

  const fuse = useMemo(
    () =>
      new Fuse(entries, {
        keys: ["title", "summary", "source", "periodLabel"],
        threshold: 0.35,
      }),
    [entries]
  );

  const filtered = useMemo(() => {
    let result = query
      ? fuse.search(query).map((r) => r.item)
      : entries;

    if (activeSource) {
      result = result.filter((e) => e.source === activeSource);
    }
    return result;
  }, [query, activeSource, entries, fuse]);

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="규제 제목, 기관, 키워드 검색..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 pl-10 pr-4 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Source filter */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveSource(null)}
          className={[
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            activeSource === null
              ? "bg-indigo-600 text-white"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
          ].join(" ")}
        >
          전체
        </button>
        {allSources.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setActiveSource(src === activeSource ? null : src)}
            className={[
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              activeSource === src
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700",
            ].join(" ")}
          >
            {src}
          </button>
        ))}
      </div>

      {/* Results count */}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {filtered.length}건
      </p>

      {/* Card list */}
      <ul className="space-y-3">
        {filtered.map((entry) => (
          <li key={entry.url}>
            <div className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    <Badge label={entry.source} />
                    {entry.periodLabel && (
                      <Link
                        href={entry.path}
                        className="inline-block rounded px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {entry.periodLabel}
                      </Link>
                    )}
                  </div>
                  <a
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2"
                  >
                    {entry.title}
                  </a>
                  {entry.summary && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                      {entry.summary}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-gray-400">{entry.date}</span>
                  <div className="mt-2">
                    <a
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 text-xs hover:underline"
                      aria-label="원문 보기"
                    >
                      →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="py-12 text-center text-sm text-gray-400">
            검색 결과가 없습니다.
          </li>
        )}
      </ul>
    </div>
  );
}
