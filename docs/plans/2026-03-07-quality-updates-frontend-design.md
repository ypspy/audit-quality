# 규제 업데이트 서비스 프론트엔드 개선 설계

**작성일:** 2026-03-07
**범위:** `apps/web` `/updates` 라우트 + `apps/mcp-updates` 신규 서비스 + RAG 채팅 파이프라인
**관련 Phase:** Phase 3-1 후속 고도화 (Phase 3-2 백로그 연계)

---

## 배경 및 목표

현재 `/updates`는 `quality-updates` 서비스의 Markdown 문서를 3-panel(사이드바+본문+TOC)로 렌더링하는 정적 문서 뷰어다. 주요 문제:

- 검색·필터 없이 사이드바 탐색만 가능 → 문서 찾기 어려움
- 모바일에서 사이드바 숨겨져 탐색 불가
- 조서 작성·리뷰 시 규제 인용을 위한 참조 지원 없음
- 수집된 규제 데이터가 LLM context로 활용되지 않음

**목표:** 프론트엔드 UX 개선 + MCP 서버 + RAG 채팅 UI를 3단계로 구축하여, 감사 업무에서 규제 정보를 탐색·인용·질의할 수 있는 통합 환경을 제공한다.

---

## 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    quality-updates (git repo)            │
│  Markdown + frontmatter (표준화)                         │
│  source | date | category | tags | summary               │
└────────────┬────────────────────────────────────────────┘
             │ 크롤러 수집 (분기별 cron)
             ▼
┌─────────────────────────────────────────────────────────┐
│                   apps/web (Next.js 15)                  │
│                                                          │
│  /updates           ← P1: 인덱스 카드 뷰 + 클라이언트 검색│
│  /updates/[...slug] ← P1: 문서 뷰 + 인용 복사 버튼       │
│  /api/web/updates/chat ← P3: RAG 채팅 BFF (스트리밍)     │
│                                                          │
│  src/content/updates/   (Markdown 파일)                  │
│  src/content/updates-index.json  (빌드타임 생성)         │
└──────────────┬──────────────────────────────────────────┘
               │
       ┌───────┴──────────┐
       ▼                  ▼
┌─────────────┐    ┌──────────────────────────┐
│  MCP 서버    │    │  pgvector (PostgreSQL)    │
│  apps/mcp-  │    │  ← P3: 문서 embedding     │
│  updates/   │    │  스키마: regulations       │
│  P2         │    └──────────────────────────┘
│             │
│  tools:     │    외부 LLM 도구
│  - search   │◄── Claude Code / Cursor / claude.ai
│  - get_doc  │
│  - list     │
└─────────────┘
```

**핵심 원칙:**
- `quality-updates` repo는 현재와 동일하게 Markdown 원본 유지, frontmatter만 표준화
- Next.js 빌드타임에 `updates-index.json` 생성 → P1 검색 + P2 MCP 서버가 공통 참조
- pgvector는 기존 PostgreSQL과 별도 스키마(`regulations`)로 운용
- MCP 서버는 `apps/mcp-updates/`에 독립 Node.js 프로세스로 분리

---

## Frontmatter 표준화

`quality-updates` 모든 문서에 아래 frontmatter를 적용한다.

```yaml
---
title: 외부감사법 시행령 개정안 입법예고
date: 2026-02-15
source: 금융위원회        # 금융위원회 | 금감원 | 회계기준원 | 공인회계사회 | 기타
category: 규제             # 규제 | 징계 | 해석 | 유권해석 | 공지
tags: [외부감사, 지정감사, 시행령]
summary: 외부감사인 지정제도 관련 주요 변경사항을 담은 시행령 개정안이 입법예고 되었습니다.
---
```

`summary`가 없으면 빌드 스크립트가 본문 첫 150자로 자동 생성한다.

---

## P1: 프론트엔드 UX 개선

### 빌드타임 인덱스

`scripts/build-updates-index.ts`를 `prebuild` npm script로 실행한다.

```ts
type UpdatesIndexEntry = {
  slug: string;       // "2026/02-fsc-amendment"
  path: string;       // "/updates/2026/02-fsc-amendment"
  title: string;
  date: string;       // "2026-02-15"
  source: string;     // "금융위원회" | "금감원" | "회계기준원" | "공인회계사회"
  category: string;   // "규제" | "징계" | "해석" | "유권해석" | "공지"
  tags: string[];
  summary: string;
};
// 출력: src/content/updates-index.json
```

### 인덱스 페이지 (`/updates`)

현재 `index.md` 기반 문서 뷰를 카드 목록 + 검색 페이지로 교체한다.

- **검색:** `fuse.js` 클라이언트 퍼지 검색 (title + summary + tags 대상)
- **필터:** source 탭 (기관별) + category 탭 (유형별)
- **정렬:** 날짜 내림차순 (최신순)
- **카드:** 날짜·기관·카테고리 뱃지 + summary + "자세히 보기" 링크

### 문서 페이지 (`/updates/[...slug]`)

기존 3-panel 유지 + 아래 요소 추가:

| 요소 | 위치 | 동작 |
|------|------|------|
| permalink 복사 | 제목 옆 아이콘 | 현재 URL → 클립보드 |
| 헤딩 앵커 복사 | `##` 헤딩 hover 시 `#` 아이콘 | `URL#heading-id` → 클립보드 |
| 섹션 인용 복사 | 헤딩 hover 시 `"` 아이콘 | `> 인용문\n출처: [제목](URL#id)` 형식 → 클립보드 |
| 모바일 드로어 | 상단 햄버거 버튼 | `<details>` 사이드바 → shadcn/ui `Sheet` 컴포넌트 |

### 신규·변경 파일 (P1)

```
apps/web/
├── scripts/build-updates-index.ts        # 신규
├── src/
│   ├── app/updates/
│   │   ├── layout.tsx                    # 변경 (모바일 드로어 버튼 추가)
│   │   └── [[...slug]]/page.tsx          # 변경 (인덱스 페이지 분리, 인용 버튼)
│   ├── components/
│   │   ├── UpdatesIndex.tsx              # 신규 (카드 목록 + 검색 + 필터)
│   │   ├── UpdatesSearch.tsx             # 신규 (fuse.js client component)
│   │   ├── DocHeadingCopy.tsx            # 신규 (헤딩 앵커·인용 복사)
│   │   └── DocSidebar.tsx               # 변경 (모바일 Sheet 분기)
│   └── content/
│       └── updates-index.json           # 빌드타임 생성
└── package.json                         # prebuild script 추가
```

**외부 의존성:** `fuse.js`, `@radix-ui/react-dialog` (shadcn Sheet)

---

## P2: MCP 서버

### 위치 및 구조

```
apps/mcp-updates/
├── src/
│   ├── index.ts              # MCP 서버 진입점 (stdio transport)
│   ├── tools/
│   │   ├── search.ts         # search_regulations tool
│   │   ├── get-doc.ts        # get_regulation tool
│   │   └── list.ts           # list_regulations tool
│   └── lib/
│       └── index-loader.ts   # updates-index.json 로드 + fuse.js
├── package.json
└── mcp.config.json           # Claude Code / Cursor 등록 예시
```

P1의 `updates-index.json`을 read-only 마운트로 참조한다. 별도 DB 불필요.

### 노출 Tools

```ts
// 규제 검색
search_regulations({
  query: string,
  source?: string,
  category?: string,
  date_from?: string,   // "2025-01-01"
  date_to?: string,
  limit?: number        // default 5
}) → UpdatesIndexEntry[]

// 문서 전문 조회
get_regulation({
  slug: string
}) → { title, date, source, category, content: string, path }

// 최신 목록
list_regulations({
  limit?: number,       // default 10
  source?: string,
  category?: string,
}) → UpdatesIndexEntry[]
```

### Claude Code 등록

```json
// .claude/mcp.json
{
  "mcpServers": {
    "audit-regulations": {
      "command": "node",
      "args": ["apps/mcp-updates/dist/index.js"],
      "description": "회계·감사 규제 업데이트 검색 및 조회"
    }
  }
}
```

### Docker Compose 통합

```yaml
mcp-updates:
  build: ./apps/mcp-updates
  volumes:
    - ./apps/web/src/content/updates-index.json:/app/updates-index.json:ro
  stdin_open: true
  tty: true
```

**외부 의존성:** `@modelcontextprotocol/sdk`

---

## P3: RAG + 채팅 UI

### RAG 파이프라인

```
Markdown 문서
    │
    ▼
청크 분할 (헤딩 기준, max 500 tokens)
각 청크 메타데이터: { slug, title, source, category, date, heading, url }
    │
    ▼
Embedding (Anthropic voyage-3 또는 OpenAI text-embedding-3-small)
    │
    ▼
pgvector — 스키마: regulations
  테이블: regulation_chunks
  컬럼: id, slug, heading, content, metadata(jsonb), embedding(vector)
```

**인덱싱 스크립트:** `scripts/index-regulations.ts`
실행: `quality-updates` 크롤러 완료 후 기존 cron(2-8 배치) 확장 연동.

### BFF 채팅 API

```
POST /api/web/updates/chat
Body: { message: string, history?: {role, content}[] }

처리 흐름:
1. message → embedding → pgvector 유사도 검색 (top-k 5)
2. 검색된 청크 → system prompt context 삽입
3. claude-sonnet-4-6 streaming 호출
4. SSE 스트림 반환

SSE 이벤트:
data: {"type":"delta","content":"..."}
data: {"type":"sources","items":[{title,url,source,date},...]}
data: {"type":"done"}
```

System prompt:
```
당신은 회계·감사 규제 전문 어시스턴트입니다.
아래 규제 문서를 참조하여 답변하고, 반드시 출처를 명시하세요.
조서 작성·리뷰 시 인용 가능한 형태로 답변합니다.

[CONTEXT]
{검색된 청크 5개}
```

### 채팅 위젯 UI

`/updates` 페이지 우하단 플로팅 버튼 `[💬 규제 질의]`를 누르면 슬라이드업 패널이 열린다.

- 스트리밍 응답 표시
- 응답 완료 후 출처 카드 표시 (제목·기관·날짜·[복사][열기] 버튼)
- [복사] 버튼은 P1 인용 스니펫과 동일 포맷 (`> 인용\n출처: [제목](URL)`)

### 신규·변경 파일 (P3)

```
apps/web/
├── scripts/index-regulations.ts              # 신규 (RAG 인덱싱)
└── src/app/api/web/updates/chat/
    └── route.ts                              # 신규 (BFF 스트리밍 API)

apps/web/src/components/
└── UpdatesChat.tsx                           # 신규 (채팅 위젯)
```

**외부 의존성:** `@anthropic-ai/sdk`, `pgvector`, embedding API

---

## Phase 요약

| Phase | 주요 산출물 | 선행 조건 | 외부 의존성 |
|-------|------------|----------|------------|
| **P1** | 카드 인덱스, 검색, 모바일 드로어, 인용 복사 | frontmatter 표준화 | fuse.js, shadcn Sheet |
| **P2** | MCP 서버 (3 tools), Claude Code 등록 | P1 완료 (index.json) | @modelcontextprotocol/sdk |
| **P3** | RAG 파이프라인, 채팅 BFF, 채팅 위젯 | P1 완료, pgvector DB | @anthropic-ai/sdk, embedding API |

각 Phase는 독립 배포 가능하며, P1만 완료해도 즉시 UX 개선 효과가 있다.
