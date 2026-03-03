# MkDocs Renderer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** DocRenderer가 MkDocs 전용 문법(어드모니션 `!!!`/`???`, 콘텐츠 탭 `===`)을 React 컴포넌트로 렌더링하고, 백슬래시 링크 경로를 정규화한다.

**Architecture:** `parseSegments()` 파서가 마크다운 문자열을 세 가지 Segment(markdown/admonition/tabs)로 분리한다. `MkDocsContent` 컴포넌트가 이를 재귀적으로 렌더링하며, 어드모니션과 탭 내부의 마크다운도 동일한 파이프라인을 통해 처리된다. DocRenderer는 `'use client'`로 전환해 탭의 `useState` 인터랙션을 지원한다.

**Tech Stack:** TypeScript, React (useState), react-markdown, remark-gfm, Tailwind CSS (@tailwindcss/typography)

---

## 처리해야 할 MkDocs 문법 목록

| 문법 | 예시 |
|------|------|
| 열린 어드모니션 | `!!! note "Title"` |
| 접히는 어드모니션 | `??? note "Title"` |
| 콘텐츠 탭 | `=== "Tab 1"` |
| 탭 중첩 | 어드모니션/탭 내부의 탭 |
| 백슬래시 링크 | `.\policy\file.md` → `./policy/file.md` |

---

### Task 1: mkdocs-parser.ts 작성

**Files:**
- Create: `apps/web/src/lib/mkdocs-parser.ts`

**Step 1: 파일 생성**

```typescript
// apps/web/src/lib/mkdocs-parser.ts

export type MarkdownSegment = { type: "markdown"; text: string };
export type AdmonitionSegment = {
  type: "admonition";
  admonType: string;   // 'note', 'success', 'warning', 'failure' 등 (소문자)
  title: string;
  collapsible: boolean; // !!! → false, ??? → true
  body: string;         // de-indented 본문 (재귀적으로 parseSegments 처리됨)
};
export type TabsSegment = {
  type: "tabs";
  tabs: Array<{ name: string; body: string }>;
};
export type Segment = MarkdownSegment | AdmonitionSegment | TabsSegment;

// !!! note "Title"  또는  ??? warning ""
const ADMONITION_RE = /^(!{3}|\?{3})\s+(\w+)\s*(?:"([^"]*)")?$/;
// === "Tab Name"
const TAB_RE = /^===\s+"([^"]+)"\s*$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * startIndex 이후 bodyIndent 이상으로 들여쓰인 라인을 수집해 de-indent 후 반환.
 * 빈 라인은 포함하되, 끝의 빈 라인은 제거한다.
 * @returns [de-indented body string, next line index]
 */
function collectIndentedBody(
  lines: string[],
  startIndex: number,
  bodyIndent: number
): [string, number] {
  const body: string[] = [];
  let i = startIndex;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      body.push("");
      i++;
    } else if (indentOf(line) >= bodyIndent) {
      body.push(line.substring(bodyIndent));
      i++;
    } else {
      break;
    }
  }
  // 끝의 빈 라인 제거
  while (body.length > 0 && body[body.length - 1] === "") body.pop();
  return [body.join("\n"), i];
}

/**
 * MkDocs 문법이 포함된 마크다운 문자열을 Segment 배열로 파싱한다.
 * 항상 indent=0 기준으로 동작한다 (body는 호출 전에 de-indent됨).
 */
export function parseSegments(content: string): Segment[] {
  const lines = content.split("\n");
  const segments: Segment[] = [];
  const mdBuffer: string[] = [];

  const flushMarkdown = () => {
    const text = mdBuffer.join("\n").trim();
    if (text) segments.push({ type: "markdown", text });
    mdBuffer.length = 0;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const indent = indentOf(line);
    const trimmed = line.trimStart();

    // 어드모니션 감지 (indent=0)
    const admonMatch = trimmed.match(ADMONITION_RE);
    if (admonMatch && indent === 0) {
      flushMarkdown();
      const collapsible = admonMatch[1] === "???";
      const admonType = admonMatch[2].toLowerCase();
      const title = admonMatch[3] ?? "";
      const [body, next] = collectIndentedBody(lines, i + 1, 4);
      i = next;
      segments.push({ type: "admonition", admonType, title, collapsible, body });
      continue;
    }

    // 탭 그룹 감지 (indent=0의 === "..." 로 시작하는 연속 블록)
    const tabMatch = trimmed.match(TAB_RE);
    if (tabMatch && indent === 0) {
      flushMarkdown();
      const tabs: Array<{ name: string; body: string }> = [];
      while (i < lines.length) {
        const tl = lines[i];
        const tm = tl.trimStart().match(TAB_RE);
        if (!tm || indentOf(tl) !== 0) break;
        const [body, next] = collectIndentedBody(lines, i + 1, 4);
        tabs.push({ name: tm[1], body });
        i = next;
      }
      if (tabs.length > 0) segments.push({ type: "tabs", tabs });
      continue;
    }

    mdBuffer.push(line);
    i++;
  }

  flushMarkdown();
  return segments;
}
```

**Step 2: TypeScript 타입 확인**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

예상: 오류 없음

**Step 3: 동작 확인 (Node.js REPL)**

```bash
cd apps/web && node -e "
const { parseSegments } = require('./src/lib/mkdocs-parser.ts');
" 2>&1 | head -5
# ts-node 없으면 tsc 컴파일 후 확인 or 다음 Task에서 통합 테스트
```

---

### Task 2: docs.ts 백슬래시 링크 정규화

**Files:**
- Modify: `apps/web/src/lib/docs.ts:51-57`

**Step 1: normalizeLinks 첫 줄에 백슬래시 정규화 추가**

기존 `normalizeLinks` 함수 내부 맨 앞에 한 줄 추가:

```typescript
function normalizeLinks(content: string, section: DocSection): string {
  const base = BASE_PATHS[section];
  // 백슬래시 경로를 포워드 슬래시로 정규화 (Windows 스타일 링크 처리)
  content = content.replace(/\]\(([^)]*)\)/g, (_, href) =>
    `](${href.replace(/\\/g, "/")})`
  );
  return content
    .replace(/\]\((\.\/)([^)]+\.md)\)/g, (_, __, p) => `](${base}/${p.replace(/\.md$/, "")})`)
    .replace(/\]\((\.\.\/)+([^)]+)(\.md)?\)/g, (_, __, p) => `](${base}/${p.replace(/\.md$/, "")})`)
    .replace(/\]\(([^#)/][^)]*\.md)\)/g, (_, p) => `](${base}/${p.replace(/\.md$/, "")})`);
}
```

**Step 2: TypeScript 타입 확인**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -20
```

예상: 오류 없음

---

### Task 3: DocRenderer 전면 재작성 (클라이언트 컴포넌트 + MkDocs 렌더링)

**Files:**
- Modify: `apps/web/src/components/DocRenderer.tsx`

**Step 1: DocRenderer 전체 교체**

아래 코드로 `DocRenderer.tsx`를 완전히 대체한다.

```typescript
"use client";

import { useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseSegments, type Segment } from "@/lib/mkdocs-parser";

// --- 링크 컴포넌트 (내부 링크는 Next.js Link) ---
function MdLink({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  if (href?.startsWith("/")) return <Link href={href}>{children}</Link>;
  return (
    <a href={href ?? "#"} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const MD_COMPONENTS = { a: MdLink } as const;

// --- 어드모니션 타입별 스타일 ---
type AdmonitionStyle = {
  border: string;
  bg: string;
  titleBg: string;
  titleColor: string;
  label: string;
};

const ADMONITION_STYLES: Record<string, AdmonitionStyle> = {
  note: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "📝",
  },
  info: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "ℹ️",
  },
  abstract: {
    border: "border-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    titleBg: "bg-blue-100 dark:bg-blue-900/50",
    titleColor: "text-blue-800 dark:text-blue-200",
    label: "📋",
  },
  success: {
    border: "border-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    titleBg: "bg-green-100 dark:bg-green-900/50",
    titleColor: "text-green-800 dark:text-green-200",
    label: "✅",
  },
  tip: {
    border: "border-green-400",
    bg: "bg-green-50 dark:bg-green-950/40",
    titleBg: "bg-green-100 dark:bg-green-900/50",
    titleColor: "text-green-800 dark:text-green-200",
    label: "💡",
  },
  warning: {
    border: "border-yellow-400",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    titleBg: "bg-yellow-100 dark:bg-yellow-900/50",
    titleColor: "text-yellow-800 dark:text-yellow-200",
    label: "⚠️",
  },
  danger: {
    border: "border-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "🚨",
  },
  failure: {
    border: "border-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "❌",
  },
  bug: {
    border: "border-red-400",
    bg: "bg-red-50 dark:bg-red-950/40",
    titleBg: "bg-red-100 dark:bg-red-900/50",
    titleColor: "text-red-800 dark:text-red-200",
    label: "🐛",
  },
  example: {
    border: "border-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    titleBg: "bg-purple-100 dark:bg-purple-900/50",
    titleColor: "text-purple-800 dark:text-purple-200",
    label: "📌",
  },
  quote: {
    border: "border-gray-400",
    bg: "bg-gray-50 dark:bg-gray-900/40",
    titleBg: "bg-gray-100 dark:bg-gray-800/50",
    titleColor: "text-gray-700 dark:text-gray-300",
    label: "💬",
  },
};

const DEFAULT_STYLE: AdmonitionStyle = ADMONITION_STYLES.note;

// --- 어드모니션 컴포넌트 ---
function AdmonitionBlock({
  admonType,
  title,
  collapsible,
  body,
}: {
  admonType: string;
  title: string;
  collapsible: boolean;
  body: string;
}) {
  const style = ADMONITION_STYLES[admonType] ?? DEFAULT_STYLE;
  const displayTitle = title || admonType.charAt(0).toUpperCase() + admonType.slice(1);

  const inner = (
    <div className={`border-l-4 rounded-r-md my-4 overflow-hidden ${style.border} ${style.bg}`}>
      {(title !== "" || !collapsible) && (
        <div className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm ${style.titleBg} ${style.titleColor}`}>
          <span>{style.label}</span>
          <span>{displayTitle}</span>
        </div>
      )}
      <div className="px-4 py-3">
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MkDocsContent content={body} />
        </div>
      </div>
    </div>
  );

  if (collapsible) {
    return (
      <details className={`border-l-4 rounded-r-md my-4 overflow-hidden ${style.border} ${style.bg}`}>
        <summary
          className={`flex items-center gap-2 px-4 py-2 font-semibold text-sm cursor-pointer select-none ${style.titleBg} ${style.titleColor}`}
        >
          <span>{style.label}</span>
          <span>{displayTitle}</span>
        </summary>
        <div className="px-4 py-3">
          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
            <MkDocsContent content={body} />
          </div>
        </div>
      </details>
    );
  }

  return inner;
}

// --- 탭 컴포넌트 ---
function TabsBlock({
  tabs,
}: {
  tabs: Array<{ name: string; body: string }>;
}) {
  const [active, setActive] = useState(0);

  return (
    <div className="my-4 not-prose">
      {/* 탭 헤더 */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {tabs.map((tab, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActive(i)}
            className={[
              "px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors",
              i === active
                ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200",
            ].join(" ")}
          >
            {tab.name}
          </button>
        ))}
      </div>
      {/* 탭 패널 */}
      <div className="border border-t-0 border-gray-200 dark:border-gray-700 rounded-b-md p-4">
        <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
          <MkDocsContent content={tabs[active].body} />
        </div>
      </div>
    </div>
  );
}

// --- 재귀 렌더러 ---
function MkDocsContent({ content }: { content: string }) {
  const segments = parseSegments(content);

  return (
    <>
      {segments.map((seg: Segment, i: number) => {
        if (seg.type === "markdown") {
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkGfm]}
              components={MD_COMPONENTS}
            >
              {seg.text}
            </ReactMarkdown>
          );
        }
        if (seg.type === "admonition") {
          return (
            <AdmonitionBlock
              key={i}
              admonType={seg.admonType}
              title={seg.title}
              collapsible={seg.collapsible}
              body={seg.body}
            />
          );
        }
        if (seg.type === "tabs") {
          return <TabsBlock key={i} tabs={seg.tabs} />;
        }
        return null;
      })}
    </>
  );
}

// --- 외부에 노출되는 컴포넌트 ---
export function DocRenderer({ source }: { source: string }) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <MkDocsContent content={source} />
    </article>
  );
}
```

**Step 2: TypeScript 타입 확인**

```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -30
```

예상: 오류 없음 (또는 `props` unused warning만 있을 수 있음)

---

### Task 4: Docker 이미지 재빌드 및 확인

**Step 1: 재빌드**

```bash
cd C:/Users/yoont/source/03_Development/audit-quality
docker compose build web 2>&1 | tail -20
```

예상: `✓ Compiled successfully` + `/policy/[[...slug]]` → `●` (SSG)

**Step 2: 컨테이너 재시작**

```bash
docker compose up -d web
```

**Step 3: 브라우저 확인 체크리스트**

- `http://localhost/policy` — 정책 목록 표시, 링크 클릭 동작
- `http://localhost/updates` — 어드모니션 박스로 렌더링 (기존 `!!! info` 텍스트 사라짐)
- `http://localhost/updates/quality-updates/2025/2025-10-01_to_2025-12-31` — 상단 기관별 요약에 탭 UI 표시, 탭 클릭 시 내용 전환
- `http://localhost/updates/fss-review/fr2022` — 중첩 탭(탭 안에 탭) 정상 동작
- `http://localhost/policy/policy/90-품질관리규정` — 표준 마크다운 렌더링 정상

---

## 참고: 파서 동작 예시

입력:
```
!!! note "주요 내용"
    - 항목1
    - 항목2

    === "기업"
        내용1
    === "감사인"
        내용2
```

`parseSegments()` 출력:
```json
[
  {
    "type": "admonition",
    "admonType": "note",
    "title": "주요 내용",
    "collapsible": false,
    "body": "- 항목1\n- 항목2\n\n=== \"기업\"\n    내용1\n=== \"감사인\"\n    내용2"
  }
]
```

`body` 재귀 처리 시:
```json
[
  { "type": "markdown", "text": "- 항목1\n- 항목2" },
  { "type": "tabs", "tabs": [
    { "name": "기업", "body": "내용1" },
    { "name": "감사인", "body": "내용2" }
  ]}
]
```
