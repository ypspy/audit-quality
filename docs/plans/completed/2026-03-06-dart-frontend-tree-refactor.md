# dart 프론트엔드 3-레벨 계층 트리 리팩토링 계획

**상태:** ✅ 완료

> **For Claude/Cursor:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**작성일**: 2026-03-06
**전제**: `docs/plans/2026-03-05-dart-link-ingestion-refactor.md` (Tasks 1–8) 및
`docs/plans/2026-03-06-dart-tree-api.md` 완료

**Goal:** 현재 Level 1(공시 메타) 테이블 + iframe만 있는 `/dart` 페이지를
3-패널 레이아웃으로 전환한다.
- **Panel 1** (공시 목록): Level 1 — 검색·페이지네이션 포함 공시 행 목록
- **Panel 2** (문서·목차 트리): Level 2(문서 목록) + Level 3(목차 트리) — 선택된 공시의 계층 구조
- **Panel 3** (뷰어): 목차 노드 클릭 시 DART iframe

---

## 현황 분석 (Gap Analysis)

| 항목 | 현재 상태 | 필요 작업 |
|------|-----------|-----------|
| `GET /api/v1/dart/tree` (백엔드) | 완료 | — |
| BFF `/api/web/dart/tree` 라우트 | 없음 | 신규 생성 |
| `DartPageClient.tsx` 레이아웃 | 2-패널 (목록 + iframe) | 3-패널로 교체 |
| 공시 행 클릭 동작 | `d.url` → iframe 바로 로드 | `rcpNo` → tree API 호출 후 Panel 2 표시 |
| Level 2/3 트리 컴포넌트 | 없음 | `DisclosureTree` 신규 생성 |
| 뷰어 Panel 3 | `html_proxy` iframe | 유지 (목차 노드 URL로 로드) |
| TypeScript 타입 | `Disclosure` 타입만 존재 | `TreeData` / `TocNode` 타입 추가 |

---

## Task 1: BFF 라우트 — `/api/web/dart/tree/route.ts` 신규 생성

**신규 파일:** `apps/web/src/app/api/web/dart/tree/route.ts`

**패턴:** `apps/web/src/app/api/web/dart/disclosures/route.ts` 와 동일한 구조 사용.
`rcpNo` 쿼리 파라미터를 검증 후 `${DART_BASE}/api/v1/dart/tree?rcpNo=...` 로 프록시.

### Step 1-1: route.ts 생성

```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const DART_BASE =
  process.env.DART_INTERNAL_URL ?? "http://localhost:4000";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session.user as { access_token?: string }).access_token;
  if (!accessToken) {
    return NextResponse.json(
      { error: "토큰을 찾을 수 없습니다. 다시 로그인해 주세요." },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rcpNo = searchParams.get("rcpNo");
  if (!rcpNo) {
    return NextResponse.json({ error: "rcpNo required" }, { status: 400 });
  }

  const url = `${DART_BASE}/api/v1/dart/tree?rcpNo=${encodeURIComponent(rcpNo)}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "트리 조회 실패", detail: text },
        { status: res.status }
      );
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch (err) {
    console.error("dart tree proxy error:", err);
    return NextResponse.json(
      { error: "DART 공시 서버에 연결할 수 없습니다." },
      { status: 502 }
    );
  }
}
```

### Step 1-2: 검증

```bash
# apps/web 컨테이너 / 로컬 dev 서버 기준
curl -b "cookies=..." "http://localhost:3000/api/web/dart/tree?rcpNo=<적재된_rcpNo>"
# Expected: { disclosure: {...}, documents: [...] }

curl "http://localhost:3000/api/web/dart/tree"
# Expected: 400 { error: "rcpNo required" }
```

---

## Task 2: TypeScript 타입 추가 — `DartPageClient.tsx` 상단

**파일:** `apps/web/src/app/dart/DartPageClient.tsx`

기존 `Disclosure` 타입 아래에 추가:

```typescript
type TocNode = {
  eleId: string;
  text: string;
  viewerUrl: string;
  depth: number;
  parent_eleId: string | null;
  children: TocNode[];
};

type DocumentEntry = {
  dcmNo: string | null;
  docKind: string;
  title: string;
  documentUrl: string;
  tocNodes: TocNode[];
};

type TreeData = {
  disclosure: {
    rcpNo: string;
    corpName: string;
    reportNm: string;
    bsnsYear: string;
    yearEnd: string;
    rcptDt: string;
    correctionType: string;
    url: string;
  } | null;
  documents: DocumentEntry[];
};
```

---

## Task 3: `DartPageClient` 상태·데이터 패칭 리팩토링

**파일:** `apps/web/src/app/dart/DartPageClient.tsx`

### Step 3-1: 상태 추가

기존 `selectedUrl` state 아래에 추가:

```typescript
const [selectedRcpNo, setSelectedRcpNo] = useState<string | null>(null);
const [treeData, setTreeData] = useState<TreeData | null>(null);
const [treeLoading, setTreeLoading] = useState(false);
const [treeError, setTreeError] = useState<string | null>(null);
```

### Step 3-2: tree 패칭 함수 추가

`fetchDisclosures` 함수 아래에 추가:

```typescript
const fetchTree = useCallback(async (rcpNo: string) => {
  try {
    setTreeLoading(true);
    setTreeError(null);
    setTreeData(null);
    const res = await fetch(`/api/web/dart/tree?rcpNo=${encodeURIComponent(rcpNo)}`, {
      credentials: "include",
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error ?? "트리 데이터를 불러오지 못했습니다.");
    }
    const json: TreeData = await res.json();
    setTreeData(json);
  } catch (err) {
    setTreeError(err instanceof Error ? err.message : "알 수 없는 오류");
  } finally {
    setTreeLoading(false);
  }
}, []);
```

### Step 3-3: `handleRowClick` 변경

```typescript
// 변경 전
const handleRowClick = (url: string | undefined) => {
  if (url && /^https?:\/\/dart\.fss\.or\.kr\//.test(url)) {
    setSelectedUrl(url);
  }
};

// 변경 후
const handleRowClick = (d: Disclosure) => {
  const rcpNo = d._id; // Disclosure._id = rcpNo (MongoDB _id가 아닌 rcept_no 사용)
  // 주의: Disclosure 타입에 rcept_no 필드가 있으면 d.rcept_no 사용
  // 없으면 url에서 파싱: new URLSearchParams(d.url?.split('?')[1]).get('rcpNo')
  if (!rcpNo) return;
  setSelectedRcpNo(rcpNo);
  setSelectedUrl(null); // 이전 뷰어 초기화
  void fetchTree(rcpNo);
};
```

> **주의:** `Disclosure` 타입에 `rcept_no` 필드가 없다. `_id`가 MongoDB ObjectId이므로
> `d.url`에서 `rcpNo`를 파싱하거나, `Disclosure` 타입에 `rcept_no: string` 필드를 추가해야 한다.
> `/api/web/dart/disclosures` 응답 구조 확인 후 아래 중 택1:
>
> **Option A**: `Disclosure` 타입에 `rcept_no: string` 추가 (권장)
> **Option B**: `new URLSearchParams(d.url?.split('?')[1]).get('rcpNo') ?? ''`

---

## Task 4: 3-패널 레이아웃으로 JSX 교체

**파일:** `apps/web/src/app/dart/DartPageClient.tsx`

### Step 4-1: 레이아웃 변경

기존 `return (...)` 전체를 아래 구조로 교체한다.

**레이아웃 구조:**
```
[Panel 1: 280px] [Panel 2: 300px] [Panel 3: flex-1]
 공시 목록         문서·목차 트리    DART 뷰어
```

```tsx
return (
  <div className="flex h-[calc(100vh-8rem)] gap-3">
    {/* Panel 1: 공시 목록 */}
    <div className="flex w-[280px] shrink-0 flex-col gap-2 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* 기존 검색 폼 그대로 유지 */}
      <form onSubmit={handleSearch} className="flex flex-col gap-2 p-3">
        {/* ... 기존 필터 input들 유지 ... */}
      </form>

      <div className="min-h-0 flex-1 overflow-auto">
        {/* 기존 loading/error/table 구조 유지 */}
        {/* handleRowClick 시그니처만 변경: onClick={() => handleRowClick(d)} */}
        {/* 선택된 행 하이라이트 추가: selectedRcpNo를 사용 */}
      </div>
    </div>

    {/* Panel 2: 문서·목차 트리 */}
    <div className="flex w-[300px] shrink-0 flex-col overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      <DisclosureTree
        treeData={treeData}
        loading={treeLoading}
        error={treeError}
        onSelectUrl={setSelectedUrl}
        selectedUrl={selectedUrl}
      />
    </div>

    {/* Panel 3: DART 뷰어 */}
    <div className="min-w-0 flex-1 overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
      {/* 기존 iframeSrc/iframe 로직 그대로 유지 */}
    </div>
  </div>
);
```

---

## Task 5: `DisclosureTree` 컴포넌트 신규 생성

**신규 파일:** `apps/web/src/app/dart/DisclosureTree.tsx`

**역할:** Panel 2. `TreeData`를 받아 문서별로 그룹화, 각 문서 하위에 TOC 노드를 재귀 트리로 렌더링.

```tsx
"use client";

// DisclosureTree: Level 2 + Level 3 계층 트리 패널
// - 선택된 공시 없으면 안내 메시지
// - 로딩/에러 상태 표시
// - 문서(Level 2) 아코디언 → 목차(Level 3) 재귀 트리

type TocNode = { ... }; // Task 2의 타입 import 또는 재정의
type DocumentEntry = { ... };
type TreeData = { ... };

type Props = {
  treeData: TreeData | null;
  loading: boolean;
  error: string | null;
  selectedUrl: string | null;
  onSelectUrl: (url: string) => void;
};

export function DisclosureTree({ treeData, loading, error, selectedUrl, onSelectUrl }: Props) {
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());

  // 새 treeData 로드 시 첫 번째 문서 자동 펼침
  useEffect(() => {
    if (treeData?.documents?.length) {
      const firstKey = treeData.documents[0].dcmNo ?? 'main';
      setExpandedDocs(new Set([firstKey]));
    }
  }, [treeData]);

  if (loading) return <p className="p-4 text-sm text-gray-500">불러오는 중...</p>;
  if (error) return <p className="p-4 text-sm text-red-500">{error}</p>;
  if (!treeData) return (
    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-gray-500 dark:text-gray-400">
      왼쪽에서 공시를 선택하면<br />문서 목차가 표시됩니다.
    </div>
  );

  const toggleDoc = (key: string) => {
    setExpandedDocs(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 헤더: 공시 제목 */}
      {treeData.disclosure && (
        <div className="shrink-0 border-b border-gray-200 p-3 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
            {treeData.disclosure.corpName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {treeData.disclosure.reportNm}
          </p>
        </div>
      )}

      {/* 문서·목차 트리 */}
      <div className="min-h-0 flex-1 overflow-auto py-1">
        {treeData.documents.map(doc => {
          const key = doc.dcmNo ?? 'main';
          const isExpanded = expandedDocs.has(key);
          return (
            <div key={key}>
              {/* Level 2: 문서 행 (클릭 → 문서 URL로 뷰어 + 토글) */}
              <button
                type="button"
                onClick={() => {
                  toggleDoc(key);
                  onSelectUrl(doc.documentUrl);
                }}
                className="flex w-full items-center gap-1 px-3 py-1.5 text-left text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800/60"
              >
                <span className="shrink-0 text-gray-400">
                  {isExpanded ? '▾' : '▸'}
                </span>
                <span className="flex-1 truncate">
                  [{doc.docKind}] {doc.title}
                </span>
              </button>

              {/* Level 3: TOC 노드 트리 */}
              {isExpanded && doc.tocNodes.length > 0 && (
                <div className="border-l border-gray-100 ml-3 dark:border-gray-800">
                  {doc.tocNodes.map(node => (
                    <TocNodeItem
                      key={node.eleId}
                      node={node}
                      selectedUrl={selectedUrl}
                      onSelectUrl={onSelectUrl}
                    />
                  ))}
                </div>
              )}
              {isExpanded && doc.tocNodes.length === 0 && (
                <p className="px-5 py-1 text-xs text-gray-400">목차 없음</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 재귀 TOC 노드 렌더링
function TocNodeItem({
  node,
  selectedUrl,
  onSelectUrl,
}: {
  node: TocNode;
  selectedUrl: string | null;
  onSelectUrl: (url: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const isSelected = selectedUrl === node.viewerUrl;
  const hasChildren = node.children.length > 0;
  const indent = `${(node.depth + 1) * 12}px`;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          onSelectUrl(node.viewerUrl);
          if (hasChildren) setOpen(o => !o);
        }}
        style={{ paddingLeft: indent }}
        className={[
          "flex w-full items-center gap-1 py-1 pr-2 text-left text-xs",
          "hover:bg-gray-50 dark:hover:bg-gray-800/60",
          isSelected ? "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" : "text-gray-700 dark:text-gray-300",
        ].join(" ")}
      >
        {hasChildren && (
          <span className="shrink-0 text-gray-400 text-[10px]">
            {open ? '▾' : '▸'}
          </span>
        )}
        {!hasChildren && <span className="shrink-0 w-3" />}
        <span className="truncate">{node.text}</span>
      </button>

      {open && hasChildren && (
        <div>
          {node.children.map(child => (
            <TocNodeItem
              key={child.eleId}
              node={child}
              selectedUrl={selectedUrl}
              onSelectUrl={onSelectUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Task 6: `DartPageClient.tsx` 전체 조립 + 선택 행 하이라이트

**파일:** `apps/web/src/app/dart/DartPageClient.tsx`

### 변경 포인트

1. **`DisclosureTree` import 추가**
   ```typescript
   import { DisclosureTree } from "./DisclosureTree";
   ```

2. **`Disclosure` 타입에 `rcept_no` 필드 추가**
   ```typescript
   type Disclosure = {
     _id: string;
     rcept_no?: string;     // ← 추가
     corp_name?: string;
     // ... 기존 필드들 유지
   };
   ```
   > `/api/v1/disclosures` 응답 JSON에 `rcept_no`가 있으면 사용, 없으면 `url` 파싱 방식 사용

3. **`handleRowClick` 교체** (Task 3-3 참조)

4. **테이블 행 선택 하이라이트 추가**
   ```tsx
   // className 조건부 추가
   className={[
     "cursor-pointer border-b border-gray-100 dark:border-gray-800",
     "hover:bg-gray-50 dark:hover:bg-gray-800/60",
     selectedRcpNo === (d.rcept_no ?? extractRcpNo(d.url))
       ? "bg-blue-50 dark:bg-blue-900/20"
       : "",
   ].join(" ")}
   ```

5. **iframe src 변경**: 뷰어 Panel 3는 `selectedUrl`을 그대로 사용하되,
   `selectedUrl`이 `dart.fss.or.kr/report/viewer.do` 형식이면
   → `html_proxy` 경유 / 직접 뷰어 URL 둘 다 허용.
   ```typescript
   const normalizedSelectedUrl = selectedUrl?.replace(/^http:\/\//, "https://");
   const iframeSrc = normalizedSelectedUrl
     ? `/api/web/dart/html_proxy?url=${encodeURIComponent(normalizedSelectedUrl)}`
     : null;
   ```
   (기존 로직과 동일 — 변경 없음)

---

## Task 7: 검증

### Step 7-1: 타입·빌드 확인

```bash
cd apps/web
npx tsc --noEmit
# Expected: 에러 없음
```

### Step 7-2: 동작 확인 (브라우저)

1. `/dart` 접속 → 3-패널 레이아웃 표시 확인
2. Panel 1에서 공시 행 클릭
   - Panel 2: 로딩 → 문서 목록(Level 2) + TOC 노드(Level 3) 표시
   - Panel 3: 빈 상태 (URL 미선택)
3. Panel 2에서 문서 행(Level 2) 클릭
   - Panel 3: 해당 `documentUrl`이 iframe에 로드
4. Panel 2에서 TOC 노드(Level 3) 클릭
   - Panel 3: 해당 `viewerUrl`이 iframe에 로드
   - 선택된 노드 파란색 하이라이트 확인
5. TOC DB 미수집 공시 클릭
   - Panel 2: 문서 없음 또는 404 에러 메시지 표시 (graceful)
6. Panel 1 다른 행 선택 시 Panel 2·3 초기화 확인

---

## 파일 목록

| 파일 | 변경 |
|------|------|
| `apps/web/src/app/api/web/dart/tree/route.ts` | **신규 생성** |
| `apps/web/src/app/dart/DisclosureTree.tsx` | **신규 생성** |
| `apps/web/src/app/dart/DartPageClient.tsx` | **전체 리팩토링** |

---

## 진행 상태

| Task | 항목 | 상태 |
|------|------|------|
| 1 | BFF `/api/web/dart/tree` 라우트 생성 | ✅ 완료 |
| 2 | TypeScript 타입 추가 | ✅ 완료 |
| 3 | 상태·fetchTree 패칭 로직 추가 | ✅ 완료 |
| 4 | 3-패널 JSX 레이아웃 교체 | ✅ 완료 |
| 5 | `DisclosureTree` 컴포넌트 신규 생성 | ✅ 완료 |
| 6 | `DartPageClient` 전체 조립 | ✅ 완료 |
| 7 | 타입·빌드·동작 검증 | ✅ 완료 |
