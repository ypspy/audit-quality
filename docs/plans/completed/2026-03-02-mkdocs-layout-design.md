# MkDocs Material Layout 재현 설계

**상태:** ✅ 완료
**날짜:** 2026-03-02
**목표:** `/policy`, `/updates` 문서 섹션에 MkDocs Material 스타일 레이아웃 적용
**범위:** 3-panel 레이아웃, 사이드바 nav, 오른쪽 TOC, footer 이전/다음, Noto Sans KR, 코드 복사, 맨 위로 버튼 (검색 제외)

---

## 아키텍처

### 데이터 흐름

```
mkdocs.yml (파일시스템)
  → lib/mkdocs-nav.ts (빌드 타임, 서버)
  → NavItem[] JSON → DocSidebar (클라이언트)
  → flatList → prev/next 계산 → page footer

markdown content
  → extractHeadings() (서버, regex 기반)
  → Heading[] JSON → DocToc (클라이언트, IntersectionObserver)
```

### 파일 구성

```
apps/web/src/
  lib/
    mkdocs-nav.ts          ← mkdocs.yml 파싱 → NavItem[]
  components/
    DocLayout.tsx           ← 3-panel wrapper (서버)
    DocSidebar.tsx          ← 왼쪽 사이드바 트리 (클라이언트)
    DocToc.tsx              ← 오른쪽 TOC + active 추적 (클라이언트)
    DocBackToTop.tsx        ← 맨 위로 버튼 (클라이언트)
    DocRenderer.tsx         ← 기존 + heading ID + 코드 복사 버튼
  app/
    updates/layout.tsx      ← DocLayout + parsed nav 주입
    policy/layout.tsx       ← DocLayout + parsed nav 주입
    updates/[[...slug]]/page.tsx  ← heading 추출 → DocToc, prev/next
    policy/[[...slug]]/page.tsx   ← 동일
```

---

## 컴포넌트 설계

### `lib/mkdocs-nav.ts`

**타입:**
```typescript
type NavLeaf = { type: "leaf"; label: string; path: string }
type NavSection = { type: "section"; label: string; children: NavItem[] }
type NavItem = NavLeaf | NavSection

type ParsedNav = {
  items: NavItem[]
  flatList: NavLeaf[]   // prev/next 계산용 (index 제외)
}
```

**함수:**
- `parseNav(section: "updates" | "policy"): ParsedNav`
  - `mkdocs.yml` 위치: 빌드 환경에서 `process.cwd()` 기준 경로 (또는 환경변수)
  - `yaml` 패키지로 파싱
  - 경로 변환: `quality-updates/2025/foo.md` → `/updates/quality-updates/2025/foo`
  - `index.md` → 섹션 base path (e.g., `/updates`)
  - flat list 생성 시 index 항목 제외

**의존성:** `yaml` 패키지 추가 (`npm install yaml`)

---

### `components/DocLayout.tsx` (서버 컴포넌트)

```tsx
type Props = {
  nav: NavItem[]
  children: React.ReactNode
}
```

**레이아웃:**
```
[md 이상]
┌─────────────────────────────────────────────────────────────┐
│  사이드바(240px, sticky)  │  콘텐츠(flex-1)  │  TOC(200px)  │
└─────────────────────────────────────────────────────────────┘

[md 미만 - 모바일]
┌───────────────────────┐
│  콘텐츠(풀폭)          │
└───────────────────────┘
```

- `DocSidebar`는 nav props 수신
- `DocToc`와 `DocBackToTop`은 children(page)에서 올라오는 컨텍스트로 headings 수신
- 실제로는 page.tsx에서 `headings`를 DocLayout에 prop으로 전달하거나, context 활용

---

### `components/DocSidebar.tsx` (클라이언트)

- `usePathname()`으로 현재 경로 파악
- 재귀 렌더링: Section → `<details>` / Leaf → `<Link>`
- `<details open>` 조건: children 중 active 경로 포함 시
- 활성 leaf 스타일: `bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-medium`
- 비활성: `text-gray-600 hover:text-gray-900`
- 인덴트: depth당 `pl-4` 추가

---

### `components/DocToc.tsx` (클라이언트)

**Props:**
```typescript
type Heading = { id: string; level: 2 | 3; text: string }
type Props = { headings: Heading[] }
```

- `IntersectionObserver`로 화면 상단에 가장 가까운 heading 추적
- active heading: `text-indigo-700 dark:text-indigo-300 font-medium`
- h2: 일반 폰트, h3: `pl-3` 인덴트
- 레이블: "이 페이지 내용"

---

### `components/DocBackToTop.tsx` (클라이언트)

- `scroll` 이벤트 리스너, 200px 이상 스크롤 시 버튼 표시
- `window.scrollTo({ top: 0, behavior: 'smooth' })`
- 우하단 fixed 위치 (사이드바와 겹치지 않도록 right offset)

---

### `DocRenderer.tsx` — 강화 사항

**Heading ID:**
```typescript
// MD_COMPONENTS에 추가
h2: ({ children }) => {
  const id = slugify(String(children))
  return <h2 id={id}>{children}</h2>
},
h3: ({ children }) => {
  const id = slugify(String(children))
  return <h3 id={id}>{children}</h3>
},
```

`slugify`: 한국어 포함 텍스트 → URL-safe id (공백 → `-`, 특수문자 제거)

**코드 복사 버튼:**
```typescript
pre: ({ children }) => (
  <div className="relative group">
    <pre>{children}</pre>
    <CopyButton />  // 클라이언트 서브컴포넌트
  </div>
)
```

---

### 폰트

`updates/layout.tsx`와 `policy/layout.tsx`에서:
```typescript
import { Noto_Sans_KR } from "next/font/google"
const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700"] })

// DocLayout wrapper div에 className={notoSansKr.className} 추가
```

글로벌 layout의 Geist는 유지 (문서 섹션에만 Noto Sans KR 적용)

---

### Footer nav (prev/next)

`page.tsx`에서:
```typescript
const { flatList } = parseNav(section)
const currentIdx = flatList.findIndex(l => l.path === currentPath)
const prev = flatList[currentIdx - 1] ?? null
const next = flatList[currentIdx + 1] ?? null
```

페이지 하단:
```
← [이전 페이지 제목]        [다음 페이지 제목] →
```

---

## mkdocs.yml 파일 위치 (Docker 환경)

Docker standalone 빌드에서 `mkdocs.yml`은 빌드 결과에 포함되지 않음.
**해결책:** `nav` 데이터를 빌드 타임에 JSON으로 직렬화해 `public/` 또는 `src/content/` 에 저장하거나, Dockerfile에서 `mkdocs.yml`을 `src/nav/` 경로로 복사.

권장: Dockerfile에 다음 추가:
```dockerfile
COPY quality-updates/mkdocs.yml ./src/nav/updates-mkdocs.yml
COPY policy/my-project/mkdocs.yml ./src/nav/policy-mkdocs.yml
```

그 후 `mkdocs-nav.ts`에서 `src/nav/` 경로를 읽음.

---

## 구현 우선순위

1. `mkdocs-nav.ts` + Dockerfile nav 파일 복사
2. `DocSidebar.tsx` + `DocLayout.tsx` (사이드바 레이아웃)
3. `updates/layout.tsx` + `policy/layout.tsx` 업데이트
4. `DocToc.tsx` + heading 추출
5. `DocRenderer.tsx` heading ID + 코드 복사
6. `DocBackToTop.tsx`
7. Noto Sans KR 폰트
8. Footer prev/next nav
