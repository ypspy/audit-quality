# updates-index 단위 재정의 — 분기 문서 → 개별 항목

**상태:** ✅ 완료

> **For Claude/Cursor:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**작성일**: 2026-03-08

---

## 배경 및 목적

현재 `build-updates-index.mjs`는 분기 `.md` 파일 1개를 index entry 1건으로 만든다.
사용자 의도는 **"분기 문서 안의 개별 공시·보도자료 링크+요약을 1 entry"** 로 취급하는 것이다.

### 현재 구조 (Before)

```
quality-updates/2025/2025-01-01_to_2025-03-31.md  →  index entry 1건
  (FSS·FSC·KICPA·KASB 수십 개 항목 포함)
```

### 목표 구조 (After)

```
quality-updates/2025/2025-01-01_to_2025-03-31.md  →  항목 수만큼 index entries
  └─ (25-03-27) [금감원 심사·감리 운영계획](URL) + !!! note  →  entry 1
  └─ (25-03-27) [IPO 법인 재무제표 심사 강화](URL)           →  entry 2
  └─ (25-01-30) [내부회계관리제도 의무 확인](URL) + !!! note  →  entry 3
  ...
```

예상 index 규모: 분기당 30–80 항목 × 약 15개 분기 = **약 500–1,200 entries**

---

## 분기 문서 마크다운 패턴

```markdown
### 금융감독원          ← source 추출 기준 (H3 heading)

#### 보도자료

- (25-03-27) [Title](URL)    ← 항목 시작. date + title + url 추출

    !!! note "주요 내용"    ← 있는 경우에만 → summary 추출

        - bullet 1
        - bullet 2

- (25-03-21) [Title2](URL2)  ← 다음 항목 (note 없음)
```

---

## 새 타입 정의

```typescript
// src/lib/updates-index.ts
export type UpdatesIndexEntry = {
  quarterlySlug: string;   // "quality-updates/2025/2025-01-01_to_2025-03-31"
  path: string;            // "/updates/quality-updates/2025/2025-01-01_to_2025-03-31"
  url: string;             // 외부 원문 링크
  title: string;           // 공시·보도자료 제목
  date: string;            // "2025-03-27"  (항목 개별 날짜)
  source: string;          // "금융감독원"  (단일)
  periodLabel: string;     // "2025-Q1"    (부모 분기 레이블)
  summary: string;         // !!! note 블록 plain text (없으면 "")
};
```

**제거 필드**: `slug`, `sources` (→ `source`), `category`, `tags`

---

## Gap Analysis

| 파일 | 현재 | 변경 |
|------|------|------|
| `scripts/build-updates-index.mjs` | 파일 단위 루프 | 파일 내 항목 파싱 루프 추가 |
| `src/lib/updates-index.ts` | 기존 타입 | 위 새 타입으로 교체 |
| `src/components/UpdatesSearch.tsx` | 카드에 `periodLabel`+`sources` | `source` 1개 배지 + `periodLabel` 분기 태그 + 외부링크 |
| `apps/mcp-updates/src/tools/search.ts` | 기존 필드 참조 | `source`, `url` 등 새 필드로 수정 |
| `apps/mcp-updates/src/tools/list.ts` | 기존 필드 참조 | 동일 |
| `apps/mcp-updates/src/tools/get-doc.ts` | `slug`로 파일 경로 | `quarterlySlug`로 변경 |
| `src/app/updates/[[...slug]]/page.tsx` | index 렌더링 | UpdatesSearch props 타입 자동 연동 |

---

## Task 1: 빌드 스크립트 수정

**파일:** `apps/web/scripts/build-updates-index.mjs`

### Step 1-1: 항목 파서 함수 추가

`parseItemsFromBody(body, frontmatter)` 함수:

1. `body`를 라인 단위로 순회
2. `### <기관명>` 패턴 → `currentSource` 갱신 (AGENCY_MAP 적용)
3. `- (YY-MM-DD) [Title](URL)` 패턴 발견 시:
   - `date`: `YY-MM-DD` → `YYYY-MM-DD` (연도는 `period.end` 기준 연도 사용)
   - `title`: 마크다운 링크 텍스트
   - `url`: 마크다운 링크 URL
4. 이후 라인에서 `!!! note` 블록 수집 (들여쓰기 4칸 이상 라인, 다음 비들여쓰기 라인 전까지):
   - 불릿 마커 제거, 마크다운 강조 제거, 공백 정리 → `summary`
5. 항목 객체 push, 다음 항목 시작 시 새 객체

```
연도 추론 규칙:
- period.end 날짜(YYYY-MM-DD)의 연도를 기본값으로 사용
- 항목 날짜(MM-DD)가 period.start의 MM-DD보다 앞서면 period.start 연도 사용
  예) 2025-01-01~2025-03-31 기간에서 (25-01-15) → 2025년 확정
  예) 2024-10-01~2024-12-31 기간에서 (24-10-05) → 2024년
```

### Step 1-2: 메인 루프 변경

```js
// Before
for (const { full, slug } of files) {
  const { data, body } = parseFrontmatter(raw);
  index.push({ slug, path, title, date, ... });
}

// After
for (const { full, quarterlySlug } of files) {
  const { data, body } = parseFrontmatter(raw);
  const items = parseItemsFromBody(body, data);
  for (const item of items) {
    index.push({
      quarterlySlug,
      path: `/updates/${quarterlySlug}`,
      url: item.url,
      title: item.title,
      date: item.date,
      source: item.source,
      periodLabel: data.period_label || "",
      summary: item.summary,
    });
  }
}
```

**검증:** `node scripts/build-updates-index.mjs` 실행 후 `updates-index.json` entry 수 확인
(기존 16개 → 수백 개)

---

## Task 2: 타입 정의 수정

**파일:** `src/lib/updates-index.ts`

- `UpdatesIndexEntry` 타입 위 새 정의로 교체
- `uniqueSources()` → `uniqueSource()` (단일 source 기준 unique 목록)
  ```typescript
  export function uniqueSources(index: UpdatesIndexEntry[]): string[] {
    return [...new Set(index.map((e) => e.source))].sort();
  }
  ```
- `uniqueCategories()` — 제거 (category 필드 삭제)

---

## Task 3: UpdatesSearch 카드 UI 수정

**파일:** `src/components/UpdatesSearch.tsx`

### 카드 구조 변경

```
[제목 (클릭 → 외부 URL 새 탭)]          [source 배지: 금융감독원]
[날짜: 2025-03-27]  [분기: 2025-Q1 (클릭 → /updates/quarterly-slug)]
[summary 2줄]
```

- 기관 필터 탭: `entry.source` 기준 (기존과 동일, 단수로 변경)
- 제목 링크: `href={entry.url}` + `target="_blank" rel="noopener noreferrer"`
- 분기 태그: `href={entry.path}` (부모 분기 문서 이동)
- 검색 대상 필드: `title`, `summary`, `source`, `periodLabel`

---

## Task 4: MCP 서버 툴 수정

**파일:** `apps/mcp-updates/src/tools/search.ts`, `list.ts`, `get-doc.ts`

- `entry.slug` → `entry.quarterlySlug`
- `entry.sources` → `entry.source`
- `search` 결과 반환 시 `url` 필드 포함 (원문 링크 노출)

---

## ⚠️ 팔로업 필요: .env 환경 변수 미설정

Phase 3-2 P3(RAG 채팅) 구현 시 추가된 환경 변수가 아직 `.env`에 설정되지 않음.
실제 동작을 위해 아래 값 추가 필요:

```dotenv
# apps/web/.env.local (또는 docker-compose .env)

# P3 — RAG 채팅 (VoyageAI 임베딩)
VOYAGE_API_KEY=your_voyage_api_key_here

# P3 — RAG 채팅 (Claude 스트리밍)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# P3 — pgvector RAG DB
PGVECTOR_DATABASE_URL=postgresql://user:password@host:5432/dbname

# P2 — MCP 서버 (updates-index.json 경로, 컨테이너 내 경로)
UPDATES_INDEX_PATH=/app/src/content/updates-index.json
```

**추가로 필요한 작업:**
1. pgvector DB 준비 (`scripts/setup-pgvector.sql` 실행)
2. 임베딩 인덱싱 (`node apps/web/scripts/index-regulations.mjs` 실행)
3. `.env.example` (루트 및 `apps/web/`) 업데이트

---

## 완료 기준

- `node scripts/build-updates-index.mjs` 실행 시 500+ entries 생성
- 각 entry에 `url`, `source`(단수), `date`(항목 날짜) 포함
- `/updates` 카드 인덱스에서 개별 항목 검색 가능 (예: "IPO 재무제표" 검색 시 해당 보도자료 카드 노출)
- 기관 필터 탭 정상 동작
- MCP `search_regulations` 툴이 개별 항목 반환 + 외부 URL 포함
