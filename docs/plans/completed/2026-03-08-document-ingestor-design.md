# document-ingestor 설계 — Step 3-4 자동화

**상태:** ✅ 완료
**작성일**: 2026-03-08
**배경**: quality-update.txt Step 3-4 (PDF/HWP/URL 본문 입수)가 전문가 수작업으로 처리되어 병목 발생.
**목표**: 전문가가 URL/파일만 제공하면 본문 추출 → Claude 요약 → DRD 저장까지 자동화.

---

## 아키텍처 개요

```
[전문가]
   │
   ├─ URL 붙여넣기
   ├─ PDF 드롭
   └─ HWP 드롭
          │
          ▼
┌─────────────────────────────┐
│  document-ingestor 서비스   │  (새 Docker 서비스, Python FastAPI)
│                             │
│  URL  → Playwright fetch    │
│         → Readability.js    │──→ plain text
│                             │
│  PDF  → Anthropic Files API │──→ Claude 직접 읽음
│                             │
│  HWP  → Gotenberg(LibreOffice) PDF 변환
│         → Anthropic Files API──→ Claude 직접 읽음
└─────────────┬───────────────┘
              │
              ▼
       Claude API 호출 (요약 인스트럭션)
              │
              ▼
     DRD 항목 생성 (JSON)
              │
              ▼
  quality-updates MDX 파일에 append
              │
              ▼
  build-updates-index.mjs 재실행
              │
              ▼
    /updates 카드 자동 반영
```

---

## 전문가 인터페이스

**위치**: `apps/web/src/app/admin/ingest/page.tsx`
**인증**: 기존 Keycloak SSO (어드민 역할 필요)

### 화면 흐름

```
[기관 선택] [분류 선택]

[원문 URL 입력]  또는  [PDF/HWP 파일 드롭]

[내용 가져오기 버튼]
  → 추출된 본문 표시 (편집 가능)
  → 실패 시: 수동 텍스트 입력 fallback

[요약 생성 버튼]
  → Claude 요약 결과 표시 (편집 가능)

[DRD에 저장 버튼]
  → MDX append + index 재빌드 + 카드 즉시 반영
```

### 단계별 HITL 포인트

| 단계 | 자동 | 전문가 확인 |
|------|------|------------|
| 본문 추출 | Playwright / Files API | 추출 결과 검토·수정 |
| 요약 생성 | Claude API | 요약 검토·수정 |
| 저장 | MDX append + revalidate | 저장 버튼 클릭 |

---

## document-ingestor API

**스택**: Python 3.12, FastAPI, Playwright, Anthropic SDK

### 엔드포인트

```
POST /ingest/url    { url: string }
  → { text: string }

POST /ingest/file   multipart/form-data (file: PDF | HWP)
  → { text: string }

POST /summarize     { text: string, source: string, category: string }
  → { title: string, summary: string }

POST /drd/save      { title, url, date, source, category, summary, quarterlySlug }
  → { ok: boolean }
```

### 형식별 처리 전략

| 형식 | 1차 처리 | 실패 시 fallback |
|------|----------|-----------------|
| URL | Playwright fetch → Readability.js 본문 추출 | 수동 텍스트 입력 |
| PDF | Anthropic Files API 업로드 → Claude 직접 읽음 | pdfplumber 텍스트 추출 |
| HWP | Gotenberg REST API → PDF 변환 → PDF 경로와 동일 | 수동 텍스트 입력 |

### Gotenberg 선택 이유

- `gotenberg/gotenberg` Docker 이미지로 LibreOffice를 REST API화
- HWP → PDF 변환: `POST /forms/libreoffice/convert` 한 번 호출
- LibreOffice 직접 운영 대비 관리 부담 없음

---

## DRD 저장 방식

`POST /drd/save` 처리 순서:

1. `quality-updates` 레포의 해당 분기 `.md` 파일에 항목 형식으로 append
   ```markdown
   - (YY-MM-DD) [Title](URL)

       !!! note "주요 내용"

           - summary line 1
           - summary line 2
   ```
2. `apps/web/scripts/build-updates-index.mjs` 실행 → `updates-index.json` 갱신
3. Next.js `revalidatePath('/updates')` 호출 → 카드 즉시 반영

---

## Docker Compose 추가

```yaml
services:
  document-ingestor:
    build: ./apps/document-ingestor
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOTENBERG_URL=http://gotenberg:3000
      - QUALITY_UPDATES_PATH=/workspace/quality-updates
    volumes:
      - ../quality-updates:/workspace/quality-updates

  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
```

---

## 완료 기준

- URL 입력 시 본문 자동 추출 (로그인 불필요 페이지 기준 90%+ 성공률)
- PDF 업로드 시 Claude가 직접 읽어 요약 생성
- HWP 업로드 시 Gotenberg 변환 후 요약 생성
- 전문가가 저장 버튼 클릭 시 `/updates` 카드에 즉시 반영
- 수동 입력 fallback으로 모든 실패 케이스 처리 가능
