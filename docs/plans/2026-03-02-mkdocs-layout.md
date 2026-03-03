# MkDocs Material Layout Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/policy`와 `/updates` 문서 섹션에 MkDocs Material 스타일의 3-panel 레이아웃(왼쪽 사이드바 + 콘텐츠 + 오른쪽 TOC) 적용

**Architecture:** `mkdocs.yml`의 `nav:` 섹션을 빌드 타임에 파싱해 사이드바 트리를 생성. 콘텐츠의 heading을 추출해 오른쪽 TOC에 전달. `DocLayout`이 공통 래퍼 역할.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4, `yaml` npm package (신규), `next/font/google` (Noto Sans KR)

---

## 현재 파일 구조 참고

```
apps/web/
  src/
    lib/
      docs.ts             ← getDocBySlug, getDocSlugs
      mkdocs-parser.ts    ← parseSegments (MkDocs 블록 파서)
    components/
      DocRenderer.tsx     ← 'use client', ReactMarkdown 기반
      Navigation.tsx      ← 상단 nav bar (py-3, 약 56px)
    app/
      layout.tsx          ← 전체 레이아웃 (Navigation + <main>)
      updates/
        layout.tsx        ← max-w-4xl 단순 래퍼 (교체 대상)
        [[...slug]]/page.tsx  ← doc 렌더링 (수정 대상)
      policy/
        layout.tsx        ← 동일 (교체 대상)
        [[...slug]]/page.tsx  ← 동일 (수정 대상)
  Dockerfile              ← 수정 대상 (nav YAML COPY 추가)
  package.json            ← yaml 패키지 추가 필요

docs 소스 위치:
  quality-updates/mkdocs.yml  ← nav 구조 정의 (CRLF 줄바꿈 파일)
  policy/my-project/mkdocs.yml
```

---

## Task 1: yaml 패키지 설치 + Dockerfile에 nav YAML 복사 추가

**Files:**
- Modify: `apps/web/package.json` (자동, npm install)
- Modify: `apps/web/Dockerfile`

**Step 1: yaml 패키지 설치**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality/apps/web
npm install yaml
```

Expected: `package.json`에 `"yaml": "^2.x.x"` 추가됨

**Step 2: Dockerfile에 nav YAML 복사 추가**

`apps/web/Dockerfile`의 builder 스테이지에서 content COPY 바로 아래에 추가:
```dockerfile
# builder 스테이지 - 기존 content COPY 이후
COPY quality-updates/mkdocs.yml ./src/nav/updates.yml
COPY policy/my-project/mkdocs.yml ./src/nav/policy.yml
```

runner 스테이지에서 content COPY 이후에 추가:
```dockerfile
COPY --from=builder --chown=nextjs:nodejs /app/src/nav ./src/nav
ENV NAV_BASE=/app/src/nav
```

최종 Dockerfile 전체 (수정 후):
```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY apps/web .
COPY policy/my-project/docs ./src/content/policy
COPY quality-updates/docs ./src/content/updates
COPY quality-updates/mkdocs.yml ./src/nav/updates.yml
COPY policy/my-project/mkdocs.yml ./src/nav/policy.yml
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/src/content ./src/content
COPY --from=builder --chown=nextjs:nodejs /app/src/nav ./src/nav
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV CONTENT_BASE=/app/src/content
ENV NAV_BASE=/app/src/nav
CMD ["node", "server.js"]
```

**Step 3: 로컬 nav 폴더 생성 (개발용)**

```bash
mkdir -p /c/Users/yoont/source/03_Development/audit-quality/apps/web/src/nav
cp /c/Users/yoont/source/03_Development/audit-quality/quality-updates/mkdocs.yml \
   /c/Users/yoont/source/03_Development/audit-quality/apps/web/src/nav/updates.yml
cp /c/Users/yoont/source/03_Development/audit-quality/policy/my-project/mkdocs.yml \
   /c/Users/yoont/source/03_Development/audit-quality/apps/web/src/nav/policy.yml
```

**Step 4: Commit**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality
git -C apps/web add package.json package-lock.json Dockerfile src/nav/
git -C apps/web commit -m "feat: add yaml dep, copy mkdocs nav YAML in Dockerfile"
```

---

## Task 2: `lib/mkdocs-nav.ts` — nav 파서

**Files:**
- Create: `apps/web/src/lib/mkdocs-nav.ts`

**mkdocs.yml nav 구조 참고:**

`quality-updates/mkdocs.yml`:
```yaml
nav:
  - 홈: index.md
  - 규제 업데이트:
      - 규제 업데이트 개요: quality-updates/index.md
      - 2025년:
          - 4분기 (10–12월): quality-updates/2025/2025-10-01_to_2025-12-31.md
```

`policy/my-project/mkdocs.yml`:
```yaml
nav:
    - 내규:
      - 90 품질관리규정: ./policy/90-품질관리규정.md
    - 품질관리절차:
      - 계약: 'index.md'
```

yaml 패키지로 파싱하면 각 nav 항목은 단일 키 객체:
- leaf: `{ "홈": "index.md" }` → 값이 string
- section: `{ "규제 업데이트": [...] }` → 값이 array

**Step 1: `apps/web/src/lib/mkdocs-nav.ts` 작성**

```typescript
import fs from "fs";
import path from "path";
import { parse as parseYaml } from "yaml";

export type NavLeaf = { type: "leaf"; label: string; path: string };
export type NavSection = { type: "section"; label: string; children: NavItem[] };
export type NavItem = NavLeaf | NavSection;

export type ParsedNav = {
  items: NavItem[];
  flatList: NavLeaf[]; // prev/next 계산용, 모든 leaf 포함
};

const NAV_BASE =
  process.env.NAV_BASE ?? path.join(process.cwd(), "src", "nav");

const BASE_URLS: Record<string, string> = {
  updates: "/updates",
  policy: "/policy",
};

function mkdocsPathToUrl(filePath: string, baseUrl: string): string {
  // 앞의 ./ 제거
  let p = filePath.startsWith("./") ? filePath.slice(2) : filePath;
  // .md 제거
  p = p.replace(/\.md$/, "");
  // 루트 index → baseUrl
  if (p === "index") return baseUrl;
  return `${baseUrl}/${p}`;
}

function parseNavItem(
  raw: Record<string, unknown>,
  baseUrl: string
): NavItem {
  const [label, value] = Object.entries(raw)[0];
  if (typeof value === "string") {
    return {
      type: "leaf",
      label,
      path: mkdocsPathToUrl(value, baseUrl),
    };
  }
  // section — value는 array
  const children = (value as Array<Record<string, unknown>>).map((child) =>
    parseNavItem(child, baseUrl)
  );
  return { type: "section", label, children };
}

function flattenLeaves(items: NavItem[]): NavLeaf[] {
  const result: NavLeaf[] = [];
  for (const item of items) {
    if (item.type === "leaf") result.push(item);
    else result.push(...flattenLeaves(item.children));
  }
  return result;
}

export function parseNav(section: "updates" | "policy"): ParsedNav {
  const filePath = path.join(
    NAV_BASE,
    section === "updates" ? "updates.yml" : "policy.yml"
  );
  if (!fs.existsSync(filePath)) {
    return { items: [], flatList: [] };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  const parsed = parseYaml(raw) as { nav?: Array<Record<string, unknown>> };
  const navRaw = parsed?.nav ?? [];
  const baseUrl = BASE_URLS[section];
  const items = navRaw.map((item) => parseNavItem(item, baseUrl));
  return { items, flatList: flattenLeaves(items) };
}
```

**Step 2: 파서 검증 (로컬 Node.js 스크립트)**

`apps/web/src/nav/` 폴더에 yml 파일이 있는 상태에서:

```bash
cd /c/Users/yoont/source/03_Development/audit-quality/apps/web
node -e "
const path = require('path');
process.env.NAV_BASE = path.join(process.cwd(), 'src/nav');
// ts-node 없이 검증: 파일 읽기 + yaml 파싱만 테스트
const { parse } = require('yaml');
const fs = require('fs');
const raw = fs.readFileSync('src/nav/updates.yml', 'utf-8');
const parsed = parse(raw);
console.log('nav items count:', parsed.nav.length);
console.log('first item:', JSON.stringify(parsed.nav[0]));
console.log('second item keys:', Object.keys(parsed.nav[1]));
"
```

Expected: `nav items count: 3` (홈, 규제 업데이트, 품질관리감리), first item `{ "홈": "index.md" }`

**Step 3: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/lib/mkdocs-nav.ts
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add mkdocs-nav parser"
```

---

## Task 3: `components/DocSidebar.tsx` — 사이드바 트리

**Files:**
- Create: `apps/web/src/components/DocSidebar.tsx`

**Step 1: `DocSidebar.tsx` 작성**

```typescript
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/lib/mkdocs-nav";

function isActiveSection(item: NavItem, pathname: string): boolean {
  if (item.type === "leaf") return item.path === pathname;
  return item.children.some((child) => isActiveSection(child, pathname));
}

function NavTree({
  items,
  depth,
  pathname,
}: {
  items: NavItem[];
  depth: number;
  pathname: string;
}) {
  return (
    <ul className={depth > 0 ? "pl-3 border-l border-gray-200 dark:border-gray-700 ml-2" : ""}>
      {items.map((item, i) => {
        if (item.type === "leaf") {
          const active = item.path === pathname;
          return (
            <li key={i}>
              <Link
                href={item.path}
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
        // section
        const open = isActiveSection(item, pathname);
        return (
          <li key={i}>
            <details open={open} className="group">
              <summary className="flex cursor-pointer select-none items-center gap-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 list-none">
                <svg
                  className="h-3 w-3 shrink-0 transition-transform group-open:rotate-90"
                  viewBox="0 0 12 12"
                  fill="currentColor"
                >
                  <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {item.label}
              </summary>
              <NavTree items={item.children} depth={depth + 1} pathname={pathname} />
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function DocSidebar({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname() ?? "";

  return (
    <aside className="hidden md:block w-56 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 py-6">
      <nav aria-label="문서 내비게이션">
        <NavTree items={nav} depth={0} pathname={pathname} />
      </nav>
    </aside>
  );
}
```

> **참고:** `top-14` = 56px (상단 nav bar 높이 근사치). Navigation 컴포넌트의 실제 높이에 따라 조정 필요.

**Step 2: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/components/DocSidebar.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add DocSidebar component"
```

---

## Task 4: `components/DocLayout.tsx` — 3-panel 래퍼

**Files:**
- Create: `apps/web/src/components/DocLayout.tsx`

**Step 1: `DocLayout.tsx` 작성**

```typescript
import type { NavItem } from "@/lib/mkdocs-nav";
import { DocSidebar } from "./DocSidebar";
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
      <DocSidebar nav={nav} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <DocBackToTop />
    </div>
  );
}
```

> **참고:** `DocBackToTop`은 Task 9에서 생성. Task 4 작업 시에는 `DocBackToTop` import와 사용 부분을 주석처리하고, Task 9 완료 후 주석 해제.

**Step 2: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/components/DocLayout.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add DocLayout 3-panel wrapper"
```

---

## Task 5: layout.tsx 파일 업데이트 — 사이드바 레이아웃 활성화

**Files:**
- Modify: `apps/web/src/app/updates/layout.tsx`
- Modify: `apps/web/src/app/policy/layout.tsx`

**Step 1: `updates/layout.tsx` 교체**

```typescript
import type { Metadata } from "next";
import { DocLayout } from "@/components/DocLayout";
import { parseNav } from "@/lib/mkdocs-nav";

export const metadata: Metadata = {
  title: "규제 업데이트",
  description: "회계·감사 규제 모니터링 — 금융위·금감원·회계기준원 시기별 업데이트",
};

export default function UpdatesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("updates");
  return <DocLayout nav={items}>{children}</DocLayout>;
}
```

**Step 2: `policy/layout.tsx` 교체**

```typescript
import type { Metadata } from "next";
import { DocLayout } from "@/components/DocLayout";
import { parseNav } from "@/lib/mkdocs-nav";

export const metadata: Metadata = {
  title: "정책과 절차",
  description: "선진회계법인 정책·내규·품질관리절차",
};

export default function PolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("policy");
  return <DocLayout nav={items}>{children}</DocLayout>;
}
```

**Step 3: 빌드 확인**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality/apps/web
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`. 오류 없이 빌드 완료.

**Step 4: 시각적 확인**

`npm run dev` 후 `http://localhost:3000/updates` 접속 → 왼쪽 사이드바가 표시되어야 함.

**Step 5: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/app/updates/layout.tsx src/app/policy/layout.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: use DocLayout with sidebar in updates and policy layouts"
```

---

## Task 6: `extractHeadings` + `DocToc.tsx` — 오른쪽 TOC

**Files:**
- Modify: `apps/web/src/lib/docs.ts` (extractHeadings 추가)
- Create: `apps/web/src/components/DocToc.tsx`

**Step 1: `docs.ts`에 `extractHeadings` 추가**

`docs.ts` 파일 끝에 다음 추가 (기존 코드 수정 없이 export 추가):

```typescript
export type Heading = { id: string; level: 2 | 3; text: string };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\uAC00-\uD7A3\u3131-\u318E-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function extractHeadings(content: string): Heading[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const headings: Heading[] = [];
  for (const line of normalized.split("\n")) {
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    const level = m[1].length as 2 | 3;
    const text = m[2].trim();
    const id = slugify(text);
    if (id) headings.push({ id, level, text });
  }
  return headings;
}
```

**Step 2: `DocToc.tsx` 작성**

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import type { Heading } from "@/lib/docs";

export function DocToc({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState<string>("");
  const observer = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (headings.length === 0) return;
    observer.current?.disconnect();

    // 화면 상단 근처 heading 추적
    observer.current = new IntersectionObserver(
      (entries) => {
        // 화면에 보이는 것 중 가장 위에 있는 것
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-10% 0% -60% 0%", threshold: 0 }
    );

    for (const h of headings) {
      const el = document.getElementById(h.id);
      if (el) observer.current.observe(el);
    }

    return () => observer.current?.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-52 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto py-6 pl-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        이 페이지 내용
      </p>
      <nav>
        <ul className="space-y-1">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? "pl-3" : ""}>
              <a
                href={`#${h.id}`}
                className={[
                  "block text-sm py-0.5 transition-colors",
                  activeId === h.id
                    ? "text-indigo-700 dark:text-indigo-300 font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200",
                ].join(" ")}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
```

**Step 3: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/lib/docs.ts src/components/DocToc.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add extractHeadings to docs.ts and DocToc component"
```

---

## Task 7: `page.tsx` 업데이트 — TOC + footer prev/next

**Files:**
- Modify: `apps/web/src/app/updates/[[...slug]]/page.tsx`
- Modify: `apps/web/src/app/policy/[[...slug]]/page.tsx`

**Step 1: `updates/[[...slug]]/page.tsx` 교체**

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { DocRenderer } from "@/components/DocRenderer";
import { DocToc } from "@/components/DocToc";
import { getDocBySlug, getDocSlugs, extractHeadings } from "@/lib/docs";
import { parseNav } from "@/lib/mkdocs-nav";

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
  const doc = getDocBySlug("updates", segments);
  if (!doc) notFound();

  const headings = extractHeadings(doc.content);
  const currentPath = segments.length === 0 ? "/updates" : `/updates/${segments.join("/")}`;
  const { flatList } = parseNav("updates");
  const currentIdx = flatList.findIndex((l) => l.path === currentPath);
  const prev = currentIdx > 0 ? flatList[currentIdx - 1] : null;
  const next = currentIdx < flatList.length - 1 ? flatList[currentIdx + 1] : null;

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0 px-6 py-8 max-w-3xl">
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
      <DocToc headings={headings} />
    </div>
  );
}
```

**Step 2: `policy/[[...slug]]/page.tsx` 교체**

기존 코드와 동일한 패턴으로 작성. `"updates"` → `"policy"`, `/updates` → `/policy`로 교체:

```typescript
import { notFound } from "next/navigation";
import Link from "next/link";
import { DocRenderer } from "@/components/DocRenderer";
import { DocToc } from "@/components/DocToc";
import { getDocBySlug, getDocSlugs, extractHeadings } from "@/lib/docs";
import { parseNav } from "@/lib/mkdocs-nav";

type PolicyPageProps = {
  params: Promise<{ slug?: string[] }>;
};

export async function generateStaticParams() {
  const slugs = getDocSlugs("policy");
  const params: { slug?: string[] }[] = [];
  params.push({});
  for (const s of slugs) {
    if (s === "index") continue;
    params.push({ slug: s.split("/") });
  }
  return params;
}

export default async function PolicyPage({ params }: PolicyPageProps) {
  const { slug } = await params;
  const segments = slug ?? [];
  const doc = getDocBySlug("policy", segments);
  if (!doc) notFound();

  const headings = extractHeadings(doc.content);
  const currentPath = segments.length === 0 ? "/policy" : `/policy/${segments.join("/")}`;
  const { flatList } = parseNav("policy");
  const currentIdx = flatList.findIndex((l) => l.path === currentPath);
  const prev = currentIdx > 0 ? flatList[currentIdx - 1] : null;
  const next = currentIdx < flatList.length - 1 ? flatList[currentIdx + 1] : null;

  return (
    <div className="flex min-h-full">
      <div className="flex-1 min-w-0 px-6 py-8 max-w-3xl">
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
      <DocToc headings={headings} />
    </div>
  );
}
```

**Step 3: 빌드 확인**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality/apps/web
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

**Step 4: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/app/updates/[[...slug]]/page.tsx src/app/policy/[[...slug]]/page.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add TOC and prev/next nav to doc pages"
```

---

## Task 8: `DocRenderer.tsx` 강화 — heading ID + 코드 복사

**Files:**
- Modify: `apps/web/src/components/DocRenderer.tsx`

**Context:** 현재 `DocRenderer.tsx`는 `"use client"` 컴포넌트. `MD_COMPONENTS`에 `a: MdLink`만 있음.

**Step 1: heading ID용 slugify 함수 추가**

`DocRenderer.tsx`의 `MdLink` 정의 바로 위에 추가:

```typescript
function slugify(text: string): string {
  return String(text)
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\uAC00-\uD7A3\u3131-\u318E-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

**Step 2: heading 컴포넌트 추가**

`MdLink` 아래, `MD_COMPONENTS` 정의 위에 추가:

```typescript
function MdHeading({
  level,
  children,
}: {
  level: 2 | 3 | 4;
  children?: React.ReactNode;
}) {
  const id = slugify(String(children ?? ""));
  const Tag = `h${level}` as "h2" | "h3" | "h4";
  return (
    <Tag id={id} className="group relative">
      {children}
      {id && (
        <a
          href={`#${id}`}
          className="ml-2 opacity-0 group-hover:opacity-50 text-gray-400 hover:text-gray-600 no-underline text-sm"
          aria-hidden="true"
        >
          #
        </a>
      )}
    </Tag>
  );
}
```

**Step 3: CopyButton 컴포넌트 추가**

```typescript
function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute right-2 top-2 rounded px-2 py-1 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
      aria-label="코드 복사"
    >
      {copied ? "복사됨" : "복사"}
    </button>
  );
}
```

**Step 4: Pre 컴포넌트 추가**

```typescript
function MdPre({
  children,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const codeRef = useRef<HTMLPreElement>(null);
  return (
    <div className="relative group">
      <pre ref={codeRef} {...props}>
        {children}
      </pre>
      <CopyButton
        getText={() => codeRef.current?.textContent ?? ""}
      />
    </div>
  );
}
```

> `useRef` import가 이미 있음 (useState와 함께 import 되어 있음).

**Step 5: `MD_COMPONENTS` 업데이트**

기존:
```typescript
const MD_COMPONENTS = { a: MdLink } as const;
```

교체:
```typescript
const MD_COMPONENTS = {
  a: MdLink,
  h2: ({ children }: { children?: React.ReactNode }) => (
    <MdHeading level={2}>{children}</MdHeading>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <MdHeading level={3}>{children}</MdHeading>
  ),
  pre: MdPre,
} as const;
```

**Step 6: useRef import 확인**

파일 상단 `import { useState } from "react";` → `import { useState, useRef } from "react";`로 수정

**Step 7: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/components/DocRenderer.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add heading IDs and code copy button to DocRenderer"
```

---

## Task 9: `DocBackToTop.tsx` + DocLayout에서 주석 해제

**Files:**
- Create: `apps/web/src/components/DocBackToTop.tsx`
- Modify: `apps/web/src/components/DocLayout.tsx` (주석 해제)

**Step 1: `DocBackToTop.tsx` 작성**

```typescript
"use client";

import { useEffect, useState } from "react";

export function DocBackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 200);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-8 right-8 z-40 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-colors"
      aria-label="맨 위로"
    >
      <svg
        className="h-5 w-5"
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}
```

**Step 2: `DocLayout.tsx`에서 DocBackToTop 주석 해제**

Task 4에서 주석처리했던 import와 사용 코드를 활성화:

```typescript
import type { NavItem } from "@/lib/mkdocs-nav";
import { DocSidebar } from "./DocSidebar";
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
      <DocSidebar nav={nav} />
      <div className="flex-1 min-w-0">
        {children}
      </div>
      <DocBackToTop />
    </div>
  );
}
```

**Step 3: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/components/DocBackToTop.tsx src/components/DocLayout.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: add back-to-top button"
```

---

## Task 10: Noto Sans KR 폰트 + Docker 빌드 + 최종 확인

**Files:**
- Modify: `apps/web/src/app/updates/layout.tsx`
- Modify: `apps/web/src/app/policy/layout.tsx`

**Step 1: updates/layout.tsx에 Noto Sans KR 적용**

```typescript
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocLayout } from "@/components/DocLayout";
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
    </div>
  );
}
```

**Step 2: policy/layout.tsx에 동일하게 적용**

```typescript
import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import { DocLayout } from "@/components/DocLayout";
import { parseNav } from "@/lib/mkdocs-nav";

const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-kr",
});

export const metadata: Metadata = {
  title: "정책과 절차",
  description: "선진회계법인 정책·내규·품질관리절차",
};

export default function PolicyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { items } = parseNav("policy");
  return (
    <div className={`${notoSansKr.variable} font-[family-name:var(--font-noto-sans-kr)]`}>
      <DocLayout nav={items}>{children}</DocLayout>
    </div>
  );
}
```

**Step 3: 로컬 빌드 최종 확인**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality/apps/web
npm run build 2>&1 | grep -E "✓|error|Error"
```

Expected: `✓ Compiled successfully`

**Step 4: Docker 빌드 + 재시작**

```bash
cd /c/Users/yoont/source/03_Development/audit-quality
docker compose build web 2>&1 | tail -5
docker compose up -d web
```

Expected: 빌드 성공 후 컨테이너 재시작

**Step 5: 시각적 최종 확인 체크리스트**

`http://localhost/updates` 접속 후:
- [ ] 왼쪽 사이드바 표시 (연도/분기 계층 구조)
- [ ] 현재 페이지 사이드바에서 indigo 색상으로 하이라이트
- [ ] 오른쪽 TOC 표시 (xl 브레이크포인트 이상, 1280px+)
- [ ] 페이지 하단 prev/next 링크 표시
- [ ] Noto Sans KR 폰트 적용 (크롬 DevTools → 요소 선택 → computed font-family 확인)
- [ ] 코드 블록 hover 시 복사 버튼 표시
- [ ] 스크롤 후 맨 위로 버튼 표시
- [ ] heading에 앵커 링크 표시 (hover 시 `#`)

**Step 6: Commit**

```bash
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  add src/app/updates/layout.tsx src/app/policy/layout.tsx
git -C /c/Users/yoont/source/03_Development/audit-quality/apps/web \
  commit -m "feat: apply Noto Sans KR font to doc sections"
```
