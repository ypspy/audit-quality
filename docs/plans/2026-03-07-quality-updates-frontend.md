# 규제 업데이트 서비스 프론트엔드 개선 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/updates` 규제 업데이트 서비스에 카드 인덱스·검색·필터·모바일 드로어·인용 복사(P1), MCP 서버(P2), RAG 채팅 UI(P3)를 추가한다.

**Architecture:** 빌드타임에 `updates-index.json`을 생성해 클라이언트 검색과 MCP 서버가 공유 참조한다. P3는 pgvector + Anthropic SDK 스트리밍 BFF로 구성한다.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind CSS v4, fuse.js, @modelcontextprotocol/sdk, @anthropic-ai/sdk, pgvector

---

## 현재 파일 구조 (참고)

```
apps/web/
├── scripts/sync-docs.mjs            # quality-updates/docs/ → src/content/updates/ 복사
├── src/
│   ├── app/updates/
│   │   ├── layout.tsx               # Noto Sans KR + DocLayout
│   │   ├── [[...slug]]/page.tsx     # 문서 렌더링 + prev/next
│   │   └── error.tsx
│   ├── components/
│   │   ├── DocLayout.tsx            # DocSidebar + children + DocBackToTop
│   │   ├── DocSidebar.tsx           # <details> 트리 네비게이션
│   │   ├── DocRenderer.tsx          # ReactMarkdown + admonitions + tabs
│   │   ├── DocToc.tsx
│   │   └── DocBackToTop.tsx
│   ├── lib/
│   │   ├── docs.ts                  # getDocBySlug, getDocSlugs, extractHeadings
│   │   ├── mkdocs-nav.ts            # parseNav (mkdocs.yml → NavItem[])
│   │   ├── mkdocs-parser.ts         # admonition/tabs 파싱
│   │   └── slugify.ts
│   └── content/updates/             # sync-docs.mjs가 복사한 Markdown 파일
│       ├── index.md
│       ├── quality-updates/
│       │   ├── 2025/2025-10-01_to_2025-12-31.md  # frontmatter: period, agencies[]
│       │   └── ...
│       └── fss-review/
│           └── ...
└── package.json
```

기존 문서 frontmatter 형식:
```yaml
title: 2025-10-01 ~ 2025-12-31 Regulatory Updates
period_label: 2025-Q4
period:
  start: 2025-10-01
  end: 2025-12-31
category: Quality Updates
agencies: [FSS, FSC, KICPA, KASB]
generated_at: 2025-12-31
```

---

## Phase 1: 프론트엔드 UX 개선

### Task 1: 의존성 설치

**Files:**
- Modify: `apps/web/package.json`

**Step 1: fuse.js 설치**

```bash
cd apps/web && npm install fuse.js
```

Expected: `package.json`에 `"fuse.js"` 추가됨.

**Step 2: 설치 확인**

```bash
node -e "require('fuse.js'); console.log('ok')"
```

Expected: `ok`

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/package-lock.json
git commit -m "chore(web): add fuse.js for client-side search"
```

---

### Task 2: 빌드타임 인덱스 생성 스크립트

**Files:**
- Create: `apps/web/scripts/build-updates-index.mjs`
- Modify: `apps/web/package.json` (prebuild script 확장)

**Step 1: 스크립트 작성**

`apps/web/scripts/build-updates-index.mjs`:
```js
#!/usr/bin/env node
/**
 * Reads all Markdown files in src/content/updates/,
 * extracts frontmatter + first 150 chars of body as summary,
 * writes src/content/updates-index.json.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const outputFile = path.resolve(__dirname, "../src/content/updates-index.json");

const AGENCY_MAP = {
  FSS: "금융감독원",
  FSC: "금융위원회",
  KICPA: "공인회계사회",
  KASB: "회계기준원",
};

function parseFrontmatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  // Simple YAML key-value parser (no nested objects needed here)
  const data = {};
  let body = match[2];
  const yaml = match[1];
  for (const line of yaml.split("\n")) {
    const kv = line.match(/^(\w[\w_]*)\s*:\s*(.+)$/);
    if (kv) data[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, "");
    const listKey = line.match(/^(\w[\w_]*)\s*:\s*$/);
    if (listKey) data[listKey[1]] = [];
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem) {
      const lastKey = Object.keys(data).at(-1);
      if (Array.isArray(data[lastKey])) data[lastKey].push(listItem[1].trim());
    }
  }
  return { data, body };
}

function extractSummary(body) {
  // Strip markdown syntax, take first 150 chars
  return body
    .replace(/^#{1,6}\s+.+$/gm, "")
    .replace(/[*_`>![\]()]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 150);
}

function walk(dir, prefix = "") {
  const entries = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = prefix ? `${prefix}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      entries.push(...walk(full, rel));
    } else if (name.endsWith(".md") && name !== "index.md") {
      entries.push({ full, slug: rel.replace(/\.md$/, "") });
    }
  }
  return entries;
}

if (!fs.existsSync(contentDir)) {
  console.warn("build-updates-index: content dir missing, skipping");
  process.exit(0);
}

const files = walk(contentDir);
const index = [];

for (const { full, slug } of files) {
  const raw = fs.readFileSync(full, "utf-8");
  const { data, body } = parseFrontmatter(raw);

  const date =
    (data.period_end) ||
    (data.generated_at) ||
    slug.match(/(\d{4}-\d{2}-\d{2})(?:_to_(\d{4}-\d{2}-\d{2}))?/)?.[2] ||
    slug.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ||
    "";

  const rawAgencies = Array.isArray(data.agencies) ? data.agencies : [];
  const sources = rawAgencies.map((a) => AGENCY_MAP[a] ?? a);

  const summary = data.summary || extractSummary(body);

  index.push({
    slug,
    path: `/updates/${slug}`,
    title: data.title || slug,
    date,
    periodLabel: data.period_label || "",
    sources,                           // string[] e.g. ["금융감독원", "금융위원회"]
    category: data.category || "기타",
    tags: Array.isArray(data.tags) ? data.tags : [],
    summary,
  });
}

// Sort by date descending
index.sort((a, b) => (b.date > a.date ? 1 : -1));

fs.writeFileSync(outputFile, JSON.stringify(index, null, 2), "utf-8");
console.log(`build-updates-index: wrote ${index.length} entries → ${outputFile}`);
```

**Step 2: prebuild script 확장**

`package.json`의 `scripts` 수정:
```json
"prebuild": "npm run sync-docs && node scripts/build-updates-index.mjs",
"sync-docs": "node scripts/sync-docs.mjs",
"build-index": "node scripts/build-updates-index.mjs"
```

**Step 3: 수동 실행으로 확인**

```bash
cd apps/web && node scripts/build-updates-index.mjs
```

Expected: `build-updates-index: wrote N entries → .../updates-index.json`
`src/content/updates-index.json` 파일 생성, 배열 형태 JSON 확인.

**Step 4: Commit**

```bash
git add apps/web/scripts/build-updates-index.mjs apps/web/package.json
git commit -m "feat(web): add build-updates-index script for client search"
```

---

### Task 3: 인덱스 타입 정의 및 공유 모듈

**Files:**
- Create: `apps/web/src/lib/updates-index.ts`

**Step 1: 타입 + 로더 작성**

`apps/web/src/lib/updates-index.ts`:
```ts
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
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/updates-index.ts
git commit -m "feat(web): add UpdatesIndexEntry type and loader"
```

---

### Task 4: 인덱스 페이지 교체 (카드 목록 + 검색 + 필터)

현재 `/updates` 진입점은 `index.md` 기반 문서 뷰다. 이를 카드 목록 페이지로 교체한다.

**Files:**
- Create: `apps/web/src/components/UpdatesSearch.tsx`
- Modify: `apps/web/src/app/updates/[[...slug]]/page.tsx`

**Step 1: UpdatesSearch 클라이언트 컴포넌트 작성**

`apps/web/src/components/UpdatesSearch.tsx`:
```tsx
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
        keys: ["title", "summary", "tags", "periodLabel"],
        threshold: 0.35,
      }),
    [entries]
  );

  const filtered = useMemo(() => {
    let result = query
      ? fuse.search(query).map((r) => r.item)
      : entries;

    if (activeSource) {
      result = result.filter((e) => e.sources.includes(activeSource));
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
          placeholder="규제 제목, 기간, 키워드 검색..."
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
          <li key={entry.slug}>
            <Link
              href={entry.path}
              className="block rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {entry.periodLabel && (
                      <span className="inline-block rounded px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                        {entry.periodLabel}
                      </span>
                    )}
                    {entry.sources.map((src) => (
                      <Badge key={src} label={src} />
                    ))}
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {entry.title}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                    {entry.summary}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-xs text-gray-400">{entry.date}</span>
                  <div className="mt-2 text-indigo-600 dark:text-indigo-400 text-xs">→</div>
                </div>
              </div>
            </Link>
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
```

**Step 2: page.tsx 수정 — slug가 없을 때 카드 인덱스 렌더링**

`apps/web/src/app/updates/[[...slug]]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { DocRenderer } from "@/components/DocRenderer";
import { DocToc } from "@/components/DocToc";
import { UpdatesSearch } from "@/components/UpdatesSearch";
import { getDocBySlug, getDocSlugs, extractHeadings } from "@/lib/docs";
import { parseNav } from "@/lib/mkdocs-nav";
import { loadUpdatesIndex, uniqueSources } from "@/lib/updates-index";

type UpdatesPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  const slugs = getDocSlugs("updates");
  const params: { slug?: string[] }[] = [];
  params.push({});
  for (const s of slugs) {
    if (s === "index") continue;
    params.push({ slug: s.split("/") });
  }
  return params;
}

export default async function UpdatesPage({ params }: UpdatesPageProps) {
  const { slug } = await params;
  const segments = slug ?? [];

  // Root path → index card view
  if (segments.length === 0) {
    const entries = loadUpdatesIndex();
    const allSources = uniqueSources(entries);
    return (
      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-3xl px-6 py-8">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            규제 업데이트
          </h1>
          <UpdatesSearch entries={entries} allSources={allSources} />
        </div>
      </div>
    );
  }

  const doc = getDocBySlug("updates", segments);
  if (!doc) notFound();

  const headings = extractHeadings(doc.content);
  const currentPath = `/updates/${segments.join("/")}`;
  const { flatList } = parseNav("updates");
  const currentIdx = flatList.findIndex((l) => l.path === currentPath);
  const prev = currentIdx > 0 ? flatList[currentIdx - 1] : null;
  const next =
    currentIdx !== -1 && currentIdx < flatList.length - 1
      ? flatList[currentIdx + 1]
      : null;

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0 flex justify-center">
        <div className="w-full max-w-3xl px-6 py-8">
          <DocRenderer source={doc.content} />
          {(prev || next) && (
            <nav className="mt-12 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-between gap-4">
              {prev ? (
                <Link
                  href={prev.path}
                  className="flex flex-col text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span className="text-xs text-gray-400 mb-1">이전</span>
                  <span>← {prev.label}</span>
                </Link>
              ) : (
                <div />
              )}
              {next ? (
                <Link
                  href={next.path}
                  className="flex flex-col text-right text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-300"
                >
                  <span className="text-xs text-gray-400 mb-1">다음</span>
                  <span>{next.label} →</span>
                </Link>
              ) : (
                <div />
              )}
            </nav>
          )}
        </div>
      </div>
      <DocToc headings={headings} />
    </div>
  );
}
```

**Step 3: 수동 확인**

```bash
cd apps/web && npm run dev
```

브라우저에서 `http://localhost:3000/updates` 접속.
Expected: 카드 목록 렌더링, 검색창, 기관 필터 탭 표시.
기관 탭 클릭 시 필터링, 검색어 입력 시 fuse.js 퍼지 검색 동작.

**Step 4: Commit**

```bash
git add apps/web/src/components/UpdatesSearch.tsx apps/web/src/app/updates/[[...slug]]/page.tsx
git commit -m "feat(web): replace /updates index with card list + fuse.js search"
```

---

### Task 5: 모바일 사이드바 드로어

현재 `DocSidebar`는 `hidden md:block`으로 모바일에서 숨겨진다. 모바일에서 햄버거 버튼으로 열리는 오버레이 드로어를 추가한다.

**Files:**
- Create: `apps/web/src/components/DocSidebarMobile.tsx`
- Modify: `apps/web/src/components/DocLayout.tsx`
- Modify: `apps/web/src/app/updates/layout.tsx`

**Step 1: 모바일 드로어 컴포넌트 작성**

`apps/web/src/components/DocSidebarMobile.tsx`:
```tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/mkdocs-nav";

function NavTree({ items, depth, pathname, onClose }: {
  items: NavItem[];
  depth: number;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <ul className={depth > 0 ? "pl-3 border-l border-gray-200 dark:border-gray-700 ml-2" : ""}>
      {items.map((item) => {
        if (item.type === "leaf") {
          const active = item.path === pathname;
          return (
            <li key={item.label}>
              <Link
                href={item.path}
                onClick={onClose}
                className={[
                  "block px-3 py-1.5 text-sm rounded-md transition-colors",
                  active
                    ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-medium"
                    : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                ].join(" ")}
              >
                {item.label}
              </Link>
            </li>
          );
        }
        const open = item.children.some(
          (c) => c.type === "leaf" && c.path === pathname
        );
        return (
          <li key={item.label}>
            <details open={open} className="group">
              <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 list-none">
                <svg className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </summary>
              <NavTree items={item.children} depth={depth + 1} pathname={pathname} onClose={onClose} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function DocSidebarMobile({ nav }: { nav: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "";

  // Close on route change
  useEffect(() => { setOpen(false); }, [pathname]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Hamburger button (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-3.5 left-4 z-40 rounded-md p-1.5 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
        aria-label="목차 열기"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Drawer */}
      <div
        className={[
          "md:hidden fixed top-0 left-0 z-50 h-full w-72 bg-white dark:bg-gray-950 shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
        role="dialog"
        aria-label="문서 내비게이션"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">목차</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="닫기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="overflow-y-auto h-[calc(100%-3rem)] py-4">
          <NavTree items={nav} depth={0} pathname={pathname} onClose={() => setOpen(false)} />
        </nav>
      </div>
    </>
  );
}
```

**Step 2: DocLayout에 DocSidebarMobile 추가**

`apps/web/src/components/DocLayout.tsx`:
```tsx
import type { NavItem } from "@/lib/mkdocs-nav";
import { DocSidebar } from "./DocSidebar";
import { DocSidebarMobile } from "./DocSidebarMobile";
import { DocBackToTop } from "./DocBackToTop";

export function DocLayout({
  nav,
  children,
}: {
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-1">
      <DocSidebarMobile nav={nav} />
      <DocSidebar nav={nav} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <DocBackToTop />
    </div>
  );
}
```

**Step 3: 수동 확인**

브라우저 DevTools에서 모바일 뷰포트(375px)로 전환.
Expected: 햄버거 아이콘 표시, 클릭 시 드로어 슬라이드인, 문서 링크 클릭 시 자동 닫힘.

**Step 4: Commit**

```bash
git add apps/web/src/components/DocSidebarMobile.tsx apps/web/src/components/DocLayout.tsx
git commit -m "feat(web): add mobile sidebar drawer for /updates"
```

---

### Task 6: 문서 페이지 — 헤딩 인용 복사 버튼

감사 조서 작성 시 특정 섹션을 인용할 수 있도록 헤딩마다 복사 버튼을 추가한다.

**Files:**
- Modify: `apps/web/src/components/DocRenderer.tsx`

**Step 1: MdHeading에 인용 복사 버튼 추가**

`DocRenderer.tsx`의 `MdHeading` 함수를 아래로 교체한다:

```tsx
function MdHeading({
  level,
  children,
}: {
  level: 2 | 3 | 4;
  children?: React.ReactNode;
}) {
  const id = slugify(childrenToText(children));
  const Tag = `h${level}` as "h2" | "h3" | "h4";

  function copyAnchor() {
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    navigator.clipboard.writeText(url);
  }

  function copyQuote() {
    const text = childrenToText(children);
    const url = `${window.location.origin}${window.location.pathname}#${id}`;
    const snippet = `> ${text}\n> \n> 출처: [규제 업데이트](${url})`;
    navigator.clipboard.writeText(snippet);
  }

  return (
    <Tag id={id} className="group relative flex items-center gap-2">
      <span>{children}</span>
      {id && (
        <span className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
          <button
            type="button"
            onClick={copyAnchor}
            title="링크 복사"
            className="text-gray-400 hover:text-indigo-500 text-sm leading-none"
            aria-label="섹션 링크 복사"
          >
            #
          </button>
          <button
            type="button"
            onClick={copyQuote}
            title="인용 스니펫 복사"
            className="text-gray-400 hover:text-indigo-500 text-xs leading-none"
            aria-label="인용 스니펫 복사"
          >
            &quot;
          </button>
        </span>
      )}
    </Tag>
  );
}
```

**Step 2: 수동 확인**

문서 페이지 `/updates/quality-updates/2025/2025-10-01_to_2025-12-31` 접속.
헤딩에 마우스 호버 시 `#` `"` 버튼 표시 확인.
`#` 클릭 → 클립보드에 `http://localhost:3000/updates/.../2025-10-01_to_2025-12-31#...` 복사됨.
`"` 클릭 → 클립보드에 `> 섹션제목\n> \n> 출처: [규제 업데이트](URL)` 복사됨.

**Step 3: Commit**

```bash
git add apps/web/src/components/DocRenderer.tsx
git commit -m "feat(web): add heading anchor and quote copy buttons to DocRenderer"
```

---

### Task 7: 문서 페이지 — 페이지 permalink 복사 버튼

**Files:**
- Create: `apps/web/src/components/DocPermalink.tsx`
- Modify: `apps/web/src/app/updates/[[...slug]]/page.tsx`

**Step 1: DocPermalink 컴포넌트 작성**

`apps/web/src/components/DocPermalink.tsx`:
```tsx
"use client";

import { useState } from "react";

export function DocPermalink({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}${path}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="페이지 링크 복사"
      className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
      aria-label="페이지 링크 복사"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 0 0-5.656 0l-4 4a4 4 0 1 0 5.656 5.656l1.102-1.1m-.758-4.9a4 4 0 0 0 5.656 0l4-4a4 4 0 0 0-5.656-5.656l-1.1 1.1" />
      </svg>
      {copied ? "복사됨" : "링크 복사"}
    </button>
  );
}
```

**Step 2: page.tsx에 DocPermalink 추가**

`page.tsx`의 `<DocRenderer source={doc.content} />` 위에 삽입:

```tsx
import { DocPermalink } from "@/components/DocPermalink";

// DocRenderer 위에 추가:
<div className="mb-4 flex justify-end">
  <DocPermalink path={currentPath} />
</div>
<DocRenderer source={doc.content} />
```

**Step 3: 수동 확인**

문서 페이지 우상단에 "링크 복사" 버튼 표시 확인. 클릭 시 "복사됨"으로 변경 후 원복.

**Step 4: Commit**

```bash
git add apps/web/src/components/DocPermalink.tsx apps/web/src/app/updates/[[...slug]]/page.tsx
git commit -m "feat(web): add permalink copy button to updates document page"
```

---

## Phase 2: MCP 서버

### Task 8: MCP 서버 프로젝트 초기화

**Files:**
- Create: `apps/mcp-updates/package.json`
- Create: `apps/mcp-updates/tsconfig.json`
- Create: `apps/mcp-updates/src/index.ts`

**Step 1: 디렉토리 생성 및 package.json 작성**

```bash
mkdir -p apps/mcp-updates/src/tools apps/mcp-updates/src/lib
```

`apps/mcp-updates/package.json`:
```json
{
  "name": "mcp-updates",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "fuse.js": "^7.0.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "tsx": "^4.0.0",
    "typescript": "^5"
  }
}
```

`apps/mcp-updates/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

**Step 2: 의존성 설치**

```bash
cd apps/mcp-updates && npm install
```

**Step 3: Commit**

```bash
git add apps/mcp-updates/package.json apps/mcp-updates/tsconfig.json
git commit -m "chore(mcp-updates): initialize MCP server project"
```

---

### Task 9: MCP 서버 — 인덱스 로더 및 tools 구현

**Files:**
- Create: `apps/mcp-updates/src/lib/loader.ts`
- Create: `apps/mcp-updates/src/tools/search.ts`
- Create: `apps/mcp-updates/src/tools/get-doc.ts`
- Create: `apps/mcp-updates/src/tools/list.ts`
- Create: `apps/mcp-updates/src/index.ts`

**Step 1: 인덱스 로더**

`apps/mcp-updates/src/lib/loader.ts`:
```ts
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
```

**Step 2: search tool**

`apps/mcp-updates/src/tools/search.ts`:
```ts
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
```

**Step 3: get-doc tool**

`apps/mcp-updates/src/tools/get-doc.ts`:
```ts
import fs from "fs";
import path from "path";
import { loadIndex } from "../lib/loader.js";

const CONTENT_BASE =
  process.env.UPDATES_CONTENT_PATH ??
  path.resolve(process.cwd(), "../../apps/web/src/content/updates");

export function getRegulation(slug: string): {
  title: string;
  date: string;
  sources: string[];
  category: string;
  content: string;
  path: string;
} | null {
  const index = loadIndex();
  const entry = index.find((e) => e.slug === slug);
  if (!entry) return null;

  const filePath = path.join(CONTENT_BASE, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf-8");
  // Strip frontmatter
  const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");

  return {
    title: entry.title,
    date: entry.date,
    sources: entry.sources,
    category: entry.category,
    content,
    path: entry.path,
  };
}
```

**Step 4: list tool**

`apps/mcp-updates/src/tools/list.ts`:
```ts
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
```

**Step 5: MCP 서버 진입점**

`apps/mcp-updates/src/index.ts`:
```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchRegulations } from "./tools/search.js";
import { getRegulation } from "./tools/get-doc.js";
import { listRegulations } from "./tools/list.js";

const server = new McpServer({
  name: "audit-regulations",
  version: "0.1.0",
});

server.tool(
  "search_regulations",
  "회계·감사 규제 업데이트 문서를 검색합니다.",
  {
    query: z.string().describe("검색어"),
    source: z.string().optional().describe("기관명 (금융감독원|금융위원회|회계기준원|공인회계사회)"),
    category: z.string().optional().describe("카테고리"),
    date_from: z.string().optional().describe("시작일 (YYYY-MM-DD)"),
    date_to: z.string().optional().describe("종료일 (YYYY-MM-DD)"),
    limit: z.number().optional().describe("최대 결과 수 (기본 5)"),
  },
  async (params) => {
    const results = searchRegulations(params);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

server.tool(
  "get_regulation",
  "특정 규제 문서의 전문을 조회합니다.",
  { slug: z.string().describe("문서 slug (예: quality-updates/2025/2025-10-01_to_2025-12-31)") },
  async ({ slug }) => {
    const doc = getRegulation(slug);
    if (!doc) {
      return { content: [{ type: "text", text: "문서를 찾을 수 없습니다." }] };
    }
    return { content: [{ type: "text", text: JSON.stringify(doc, null, 2) }] };
  }
);

server.tool(
  "list_regulations",
  "최신 규제 업데이트 목록을 반환합니다.",
  {
    limit: z.number().optional().describe("최대 수 (기본 10)"),
    source: z.string().optional(),
    category: z.string().optional(),
  },
  async (params) => {
    const results = listRegulations(params);
    return {
      content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
    };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
```

**Step 6: 빌드 확인**

```bash
cd apps/mcp-updates && npm run build
```

Expected: `dist/index.js` 생성, 에러 없음.

**Step 7: Commit**

```bash
git add apps/mcp-updates/src/
git commit -m "feat(mcp-updates): implement search/get/list tools with stdio transport"
```

---

### Task 10: Claude Code MCP 등록

**Files:**
- Create: `.claude/mcp.json`

**Step 1: mcp.json 작성**

`.claude/mcp.json`:
```json
{
  "mcpServers": {
    "audit-regulations": {
      "command": "node",
      "args": ["apps/mcp-updates/dist/index.js"],
      "env": {
        "UPDATES_INDEX_PATH": "apps/web/src/content/updates-index.json",
        "UPDATES_CONTENT_PATH": "apps/web/src/content/updates"
      },
      "description": "회계·감사 규제 업데이트 검색 및 조회 (MCP)"
    }
  }
}
```

**Step 2: Commit**

```bash
git add .claude/mcp.json apps/mcp-updates/
git commit -m "feat(mcp-updates): register MCP server in .claude/mcp.json"
```

---

## Phase 3: RAG + 채팅 UI

> **선행 조건:** pgvector PostgreSQL DB 준비, `ANTHROPIC_API_KEY` 환경변수 설정, embedding API 키 설정.

### Task 11: pgvector 스키마 설정

**Files:**
- Create: `scripts/setup-pgvector.sql`

**Step 1: SQL 스크립트 작성**

`scripts/setup-pgvector.sql`:
```sql
-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- regulations 스키마
CREATE SCHEMA IF NOT EXISTS regulations;

-- 문서 청크 테이블
CREATE TABLE IF NOT EXISTS regulations.chunks (
  id          BIGSERIAL PRIMARY KEY,
  slug        TEXT NOT NULL,
  heading     TEXT,
  content     TEXT NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  -- voyage-3: 1024 dims / text-embedding-3-small: 1536 dims
  embedding   vector(1024),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 유사도 검색용 인덱스 (IVFFlat, 문서 수 적어 정확도 우선)
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
  ON regulations.chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 10);

-- slug 조회용 인덱스
CREATE INDEX IF NOT EXISTS chunks_slug_idx ON regulations.chunks (slug);
```

**Step 2: DB에 적용**

```bash
psql "$DATABASE_URL" -f scripts/setup-pgvector.sql
```

Expected: `CREATE EXTENSION`, `CREATE SCHEMA`, `CREATE TABLE`, `CREATE INDEX` 메시지.

**Step 3: Commit**

```bash
git add scripts/setup-pgvector.sql
git commit -m "feat: add pgvector schema for regulation RAG chunks"
```

---

### Task 12: RAG 인덱싱 스크립트

**Files:**
- Create: `apps/web/scripts/index-regulations.mjs`

**Step 1: 스크립트 작성**

`apps/web/scripts/index-regulations.mjs`:
```js
#!/usr/bin/env node
/**
 * Chunks all updates markdown files and upserts embeddings into pgvector.
 * Requires:
 *   DATABASE_URL=postgres://...
 *   ANTHROPIC_API_KEY=...  (for voyage-3 embeddings via Anthropic)
 * Usage: node scripts/index-regulations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.resolve(__dirname, "../src/content/updates");
const indexFile = path.resolve(__dirname, "../src/content/updates-index.json");

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const anthropic = new Anthropic();

function chunkByHeadings(content, maxTokens = 500) {
  const lines = content.split("\n");
  const chunks = [];
  let currentHeading = "";
  let currentLines = [];

  function flush() {
    const text = currentLines.join("\n").trim();
    if (text.length > 50) {
      chunks.push({ heading: currentHeading, content: text });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const headingMatch = line.match(/^#{2,3}\s+(.+)/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
    } else {
      currentLines.push(line);
      // Rough token estimate: 1 token ≈ 2 chars (Korean)
      if (currentLines.join("\n").length > maxTokens * 2) {
        flush();
      }
    }
  }
  flush();
  return chunks;
}

async function embedTexts(texts) {
  const response = await anthropic.embeddings.create({
    model: "voyage-3",
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

async function main() {
  await client.connect();

  const index = JSON.parse(fs.readFileSync(indexFile, "utf-8"));

  for (const entry of index) {
    const filePath = path.join(contentDir, `${entry.slug}.md`);
    if (!fs.existsSync(filePath)) continue;

    const raw = fs.readFileSync(filePath, "utf-8");
    const content = raw.replace(/^---\n[\s\S]*?\n---\n/, "");
    const chunks = chunkByHeadings(content);

    if (chunks.length === 0) continue;

    // Delete existing chunks for this slug
    await client.query("DELETE FROM regulations.chunks WHERE slug = $1", [entry.slug]);

    // Embed in batches of 10
    for (let i = 0; i < chunks.length; i += 10) {
      const batch = chunks.slice(i, i + 10);
      const texts = batch.map((c) => `${entry.title}\n${c.heading}\n${c.content}`);
      const embeddings = await embedTexts(texts);

      for (let j = 0; j < batch.length; j++) {
        const metadata = {
          title: entry.title,
          date: entry.date,
          sources: entry.sources,
          category: entry.category,
          path: entry.path,
          url: `https://your-domain.com${entry.path}#${entry.slug}`,
        };
        await client.query(
          `INSERT INTO regulations.chunks (slug, heading, content, metadata, embedding)
           VALUES ($1, $2, $3, $4, $5)`,
          [entry.slug, batch[j].heading, batch[j].content, JSON.stringify(metadata), JSON.stringify(embeddings[j])]
        );
      }
      console.log(`indexed ${entry.slug}: chunks ${i}–${i + batch.length - 1}`);
    }
  }

  await client.end();
  console.log("indexing complete");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

**Step 2: package.json에 스크립트 추가**

```json
"index-regulations": "node scripts/index-regulations.mjs"
```

**Step 3: 테스트 실행**

```bash
DATABASE_URL=postgres://... ANTHROPIC_API_KEY=... cd apps/web && npm run index-regulations
```

Expected: 각 문서 slug별 청크 인덱싱 로그 출력.

```bash
psql "$DATABASE_URL" -c "SELECT slug, count(*) FROM regulations.chunks GROUP BY slug;"
```

Expected: 각 문서의 청크 수 표시.

**Step 4: Commit**

```bash
git add apps/web/scripts/index-regulations.mjs apps/web/package.json
git commit -m "feat(web): add regulation RAG indexing script with voyage-3 embeddings"
```

---

### Task 13: 채팅 BFF API 라우트

**Files:**
- Create: `apps/web/src/app/api/web/updates/chat/route.ts`

**Step 1: route.ts 작성**

```ts
import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import pg from "pg";

const anthropic = new Anthropic();

const pgPool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function embedQuery(text: string): Promise<number[]> {
  const res = await anthropic.embeddings.create({
    model: "voyage-3",
    input: [text],
  });
  return res.data[0].embedding;
}

async function retrieveChunks(embedding: number[], topK = 5) {
  const embeddingStr = `[${embedding.join(",")}]`;
  const result = await pgPool.query(
    `SELECT slug, heading, content, metadata
     FROM regulations.chunks
     ORDER BY embedding <=> $1::vector
     LIMIT $2`,
    [embeddingStr, topK]
  );
  return result.rows as {
    slug: string;
    heading: string;
    content: string;
    metadata: Record<string, unknown>;
  }[];
}

export async function POST(req: NextRequest) {
  const { message, history = [] } = await req.json() as {
    message: string;
    history?: { role: "user" | "assistant"; content: string }[];
  };

  // 1. Embed query
  const embedding = await embedQuery(message);

  // 2. Retrieve relevant chunks
  const chunks = await retrieveChunks(embedding);

  // 3. Build context
  const context = chunks
    .map((c, i) => {
      const meta = c.metadata;
      return `[${i + 1}] ${meta.title} — ${c.heading || "본문"}\n${c.content}`;
    })
    .join("\n\n---\n\n");

  const sources = chunks.map((c) => ({
    title: (c.metadata.title as string) || c.slug,
    url: (c.metadata.path as string) || `/updates/${c.slug}`,
    source: (c.metadata.sources as string[])?.[0] || "",
    date: (c.metadata.date as string) || "",
  }));

  // 4. Stream response
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const systemPrompt = `당신은 회계·감사 규제 전문 어시스턴트입니다.
아래 규제 문서를 참조하여 답변하고, 반드시 출처 번호([1], [2] 등)를 명시하세요.
조서 작성·리뷰 시 인용 가능한 형태로 명확하게 답변합니다.

[참조 문서]
${context}`;

      const claudeStream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
          ...history,
          { role: "user", content: message },
        ],
      });

      for await (const chunk of claudeStream) {
        if (
          chunk.type === "content_block_delta" &&
          chunk.delta.type === "text_delta"
        ) {
          send({ type: "delta", content: chunk.delta.text });
        }
      }

      send({ type: "sources", items: sources });
      send({ type: "done" });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

**Step 2: .env.local에 환경변수 확인**

```
DATABASE_URL=postgres://...
ANTHROPIC_API_KEY=...
```

**Step 3: curl로 테스트**

```bash
curl -X POST http://localhost:3000/api/web/updates/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"내부회계관리제도 최근 동향이 뭐야?"}' \
  --no-buffer
```

Expected: SSE 스트림으로 `data: {"type":"delta",...}` 이벤트들, 마지막에 `sources`와 `done`.

**Step 4: Commit**

```bash
git add apps/web/src/app/api/web/updates/chat/
git commit -m "feat(web): add streaming RAG chat BFF for /updates"
```

---

### Task 14: 채팅 위젯 UI

**Files:**
- Create: `apps/web/src/components/UpdatesChat.tsx`
- Modify: `apps/web/src/app/updates/layout.tsx`

**Step 1: 채팅 위젯 컴포넌트 작성**

`apps/web/src/components/UpdatesChat.tsx`:
```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Source = {
  title: string;
  url: string;
  source: string;
  date: string;
};

function CopyCitation({ title, url }: { title: string; url: string }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    const snippet = `> 관련 규제 참조\n> \n> 출처: [${title}](${window.location.origin}${url})`;
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      type="button"
      onClick={handle}
      className="text-xs text-gray-400 hover:text-indigo-500 transition-colors"
    >
      {copied ? "복사됨" : "인용 복사"}
    </button>
  );
}

export function UpdatesChat() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sources]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setSources([]);
    setLoading(true);

    const history = messages.map((m) => ({ role: m.role, content: m.content }));

    const res = await fetch("/api/web/updates/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMsg, history }),
    });

    if (!res.body) { setLoading(false); return; }

    let assistantContent = "";
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          const evt = JSON.parse(line.slice(6)) as { type: string; content?: string; items?: Source[] };
          if (evt.type === "delta" && evt.content) {
            assistantContent += evt.content;
            setMessages((prev) => {
              const next = [...prev];
              next[next.length - 1] = { role: "assistant", content: assistantContent };
              return next;
            });
          } else if (evt.type === "sources" && evt.items) {
            setSources(evt.items);
          }
        } catch { /* skip malformed */ }
      }
    }
    setLoading(false);
  }

  return (
    <>
      {/* Float button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-indigo-700 transition-colors"
        aria-label="규제 질의 채팅 열기"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M21 16c0 1.1-.9 2-2 2H7l-4 4V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" />
        </svg>
        규제 질의
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-96 max-h-[70vh] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">규제 질의</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              aria-label="닫기"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center mt-8">
                규제·해석·징계 관련 내용을 질문해보세요.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={[
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    m.role === "user"
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100",
                  ].join(" ")}
                >
                  {m.content}
                  {loading && i === messages.length - 1 && m.role === "assistant" && (
                    <span className="inline-block w-1 h-4 bg-gray-400 animate-pulse ml-0.5" />
                  )}
                </div>
              </div>
            ))}
            {/* Sources */}
            {sources.length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">참조 문서</p>
                {sources.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 rounded-md border border-gray-200 dark:border-gray-700 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{s.title}</p>
                      <p className="text-xs text-gray-400">{s.source} · {s.date}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <CopyCitation title={s.title} url={s.url} />
                      <Link href={s.url} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                        열기
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 dark:border-gray-800 px-3 py-2 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="질문을 입력하세요..."
              disabled={loading}
              className="flex-1 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-1.5 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              전송
            </button>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 2: layout.tsx에 UpdatesChat 추가**

`apps/web/src/app/updates/layout.tsx`:
```tsx
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocLayout } from "@/components/DocLayout";
import { UpdatesChat } from "@/components/UpdatesChat";
import { parseNav } from "@/lib/mkdocs-nav";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "규제 업데이트",
  description: "회계·감사 규제 모니터링 — 금융위·금감원·회계기준원 시기별 업데이트",
};

export default function UpdatesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("updates");
  return (
    <div className={`${notoSansKr.variable} font-[family-name:var(--font-noto-sans-kr)]`}>
      <DocLayout nav={items}>{children}</DocLayout>
      <UpdatesChat />
    </div>
  );
}
```

**Step 3: 수동 확인**

`http://localhost:3000/updates` 접속.
우하단 "규제 질의" 버튼 클릭 → 채팅 패널 열림.
질문 입력 → 스트리밍 응답 확인 → 참조 문서 카드 표시 → "인용 복사" 버튼 동작 확인.

**Step 4: Commit**

```bash
git add apps/web/src/components/UpdatesChat.tsx apps/web/src/app/updates/layout.tsx
git commit -m "feat(web): add RAG chat widget to /updates page"
```

---

## 완료 기준 체크리스트

### P1
- [ ] `/updates` 진입 시 카드 목록 렌더링
- [ ] 검색창에서 퍼지 검색 동작
- [ ] 기관 필터 탭 동작
- [ ] 모바일(375px)에서 햄버거 → 드로어 동작
- [ ] 문서 페이지 헤딩 hover 시 `#` `"` 버튼 표시
- [ ] `#` 클릭 → 앵커 URL 클립보드 복사
- [ ] `"` 클릭 → 인용 스니펫 클립보드 복사
- [ ] 페이지 상단 "링크 복사" 버튼 동작

### P2
- [ ] `npm run build` in `apps/mcp-updates` 성공
- [ ] Claude Code에서 `search_regulations`, `get_regulation`, `list_regulations` tool 사용 가능

### P3
- [ ] `index-regulations.mjs` 실행 후 pgvector에 청크 삽입 확인
- [ ] `/api/web/updates/chat` SSE 스트리밍 응답 확인
- [ ] 채팅 위젯 UI 동작, 출처 카드 인용 복사 동작
