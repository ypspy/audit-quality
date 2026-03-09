# Quality Update Pipeline 미수행 작업 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** quality-update.txt의 미구현 요구사항(리팩터링 제안 1·2, Quarterly 자동 생성, DRD 대기 큐)을 순차적으로 완성한다.

**Architecture:** 기존 document-ingestor(FastAPI) + Next.js BFF + admin UI 구조를 확장한다. 각 Task는 독립적으로 배포 가능하며, 앞 Task가 뒤 Task의 전제가 되는 순서로 배열했다.

**Tech Stack:** Python FastAPI, pytest, Next.js 15 App Router, React (TypeScript), Tailwind CSS, git

---

## 배경: 구현 완료 항목

- **Step 3-4**: URL/PDF/HWP 본문 추출 → Claude 요약 → MDX append (`apps/document-ingestor/`)
- **Step 4**: `/updates` 카드 인덱스 자동 반영 (`build-updates-index.mjs` + `revalidatePath`)
- **어드민 UI**: `/admin/ingest` — 입수→추출→요약→저장 흐름

---

## Task 1: 카드 공유·참조 기능 (리팩터링 제안 2)

**배경:** 현재 `/updates` 카드는 외부 링크와 분기 태그만 있다. 업무에서 규제 항목을 조서·메모에 인용할 때 "링크 복사"와 "마크다운 인용 복사" 버튼이 필요하다.

**Files:**
- Modify: `apps/web/src/components/UpdatesSearch.tsx`

### Step 1-1: 복사 유틸 함수 추가

`UpdatesSearch.tsx` 컴포넌트 내부 최상단(훅 선언 위)에 추가:

```tsx
async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}
```

### Step 1-2: 카드 하단에 복사 버튼 2개 추가

기존 카드 `<div className="block rounded-lg ...">` 내부, summary `<p>` 아래에 추가:

```tsx
{/* 복사 버튼 */}
<div className="mt-2 flex gap-2">
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      copyToClipboard(entry.url);
    }}
    className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
    title="원문 링크 복사"
  >
    🔗 링크 복사
  </button>
  <button
    type="button"
    onClick={(e) => {
      e.preventDefault();
      copyToClipboard(
        `[${entry.title}](${entry.url}) (출처: ${entry.source}, ${entry.date})`
      );
    }}
    className="text-xs text-gray-400 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors"
    title="마크다운 인용 복사"
  >
    📋 인용 복사
  </button>
</div>
```

### Step 1-3: 빌드 확인

```bash
cd apps/web
node_modules/.bin/next build 2>&1 | tail -5
```
Expected: `✓ Compiled successfully`

### Step 1-4: 커밋

```bash
git add apps/web/src/components/UpdatesSearch.tsx
git commit -m "feat(web): /updates 카드 링크·마크다운 인용 복사 버튼 추가"
```

---

## Task 2: Entry 수정·삭제 (리팩터링 제안 1)

**배경:** 현재 MDX 파일에 append만 가능하다. 오탈자·오류 항목을 수정하거나 불필요 항목을 삭제하는 기능이 없다.

**Files:**
- Modify: `apps/document-ingestor/src/drd.py`
- Modify: `apps/document-ingestor/src/main.py`
- Modify: `apps/web/src/lib/ingestor-client.ts`
- Create: `apps/web/src/app/api/web/ingest/drd/[url]/route.ts`  ← URL 인코딩 기반 식별
- Create: `apps/web/src/app/admin/entries/page.tsx`
- Create: `apps/web/src/app/admin/entries/EntriesClient.tsx`
- Modify: `apps/document-ingestor/tests/test_drd.py`

### Step 2-1: 테스트 작성

`apps/document-ingestor/tests/test_drd.py`에 추가:

```python
def test_delete_item_from_quarterly_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        year_dir = os.path.join(tmpdir, "2026")
        os.makedirs(year_dir)
        q_path = os.path.join(year_dir, "2026-01-01_to_2026-03-31.md")
        original = (
            "---\nperiod_label: 2026-Q1\n---\n\n"
            "### 금융감독원\n\n"
            "- (26-03-08) [삭제할 항목](https://example.com/del)\n\n"
            "- (26-03-07) [유지할 항목](https://example.com/keep)\n\n"
        )
        with open(q_path, "w", encoding="utf-8") as f:
            f.write(original)

        from src.drd import delete_item_from_quarterly_file
        delete_item_from_quarterly_file(
            updates_root=tmpdir,
            year="2026",
            quarter_filename="2026-01-01_to_2026-03-31.md",
            item_url="https://example.com/del",
        )

        content = open(q_path, encoding="utf-8").read()
        assert "삭제할 항목" not in content
        assert "유지할 항목" in content

def test_update_item_in_quarterly_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        year_dir = os.path.join(tmpdir, "2026")
        os.makedirs(year_dir)
        q_path = os.path.join(year_dir, "2026-01-01_to_2026-03-31.md")
        original = (
            "---\nperiod_label: 2026-Q1\n---\n\n"
            "### 금융감독원\n\n"
            "- (26-03-08) [기존 제목](https://example.com/item)\n\n"
            "    !!! note \"주요 내용\"\n\n"
            "        - 기존 요약\n\n"
        )
        with open(q_path, "w", encoding="utf-8") as f:
            f.write(original)

        from src.drd import update_item_in_quarterly_file, build_item_markdown
        new_md = build_item_markdown(
            date="2026-03-08",
            title="수정된 제목",
            url="https://example.com/item",
            summary="수정된 요약",
        )
        update_item_in_quarterly_file(
            updates_root=tmpdir,
            year="2026",
            quarter_filename="2026-01-01_to_2026-03-31.md",
            item_url="https://example.com/item",
            new_item_md=new_md,
        )

        content = open(q_path, encoding="utf-8").read()
        assert "수정된 제목" in content
        assert "기존 제목" not in content
```

### Step 2-2: 테스트 실패 확인

```bash
cd apps/document-ingestor
uv run pytest tests/test_drd.py::test_delete_item_from_quarterly_file tests/test_drd.py::test_update_item_in_quarterly_file -v
```
Expected: `FAILED` (함수 미존재)

### Step 2-3: `drd.py`에 함수 2개 추가

```python
def delete_item_from_quarterly_file(
    updates_root: str,
    year: str,
    quarter_filename: str,
    item_url: str,
) -> None:
    root = Path(updates_root).resolve()
    q_path = (root / year / quarter_filename).resolve()
    if not str(q_path).startswith(str(root)):
        raise ValueError(f"경로 탐색 시도 차단: {q_path}")
    if not q_path.exists():
        raise FileNotFoundError(f"분기 파일 없음: {q_path}")

    content = q_path.read_text(encoding="utf-8")
    lines = content.split("\n")
    result = []
    skip = False

    for i, line in enumerate(lines):
        # 항목 시작 라인 감지
        item_match = re.match(r"^- \(\d{2}-\d{2}-\d{2}\) \[([^\]]+)\]\(([^)]+)\)", line)
        if item_match and item_match.group(2) == item_url:
            skip = True
            continue
        # 다음 항목 또는 비들여쓰기 라인이 나오면 skip 종료
        if skip:
            next_item = re.match(r"^- \(", line)
            h_line = re.match(r"^#{1,4} ", line)
            if next_item or h_line:
                skip = False
            else:
                continue
        result.append(line)

    q_path.write_text("\n".join(result), encoding="utf-8")


def update_item_in_quarterly_file(
    updates_root: str,
    year: str,
    quarter_filename: str,
    item_url: str,
    new_item_md: str,
) -> None:
    """기존 항목(item_url 기준)을 삭제하고 같은 위치에 new_item_md를 삽입."""
    root = Path(updates_root).resolve()
    q_path = (root / year / quarter_filename).resolve()
    if not str(q_path).startswith(str(root)):
        raise ValueError(f"경로 탐색 시도 차단: {q_path}")
    if not q_path.exists():
        raise FileNotFoundError(f"분기 파일 없음: {q_path}")

    content = q_path.read_text(encoding="utf-8")
    lines = content.split("\n")
    result = []
    inserted = False
    skip = False

    for line in lines:
        item_match = re.match(r"^- \(\d{2}-\d{2}-\d{2}\) \[([^\]]+)\]\(([^)]+)\)", line)
        if item_match and item_match.group(2) == item_url and not inserted:
            # 기존 항목 건너뛰기 시작, 새 항목 삽입
            result.extend(new_item_md.rstrip("\n").split("\n"))
            inserted = True
            skip = True
            continue
        if skip:
            next_item = re.match(r"^- \(", line)
            h_line = re.match(r"^#{1,4} ", line)
            if next_item or h_line:
                skip = False
            else:
                continue
        result.append(line)

    q_path.write_text("\n".join(result), encoding="utf-8")
```

### Step 2-4: 테스트 통과 확인

```bash
uv run pytest tests/test_drd.py -v
```
Expected: 전체 PASSED

### Step 2-5: `main.py`에 PUT/DELETE 엔드포인트 추가

```python
class DrdUpdateRequest(BaseModel):
    title: str
    url: str        # 식별자 (변경 불가)
    date: str
    source: str
    year: str
    quarter_filename: str
    summary: str

class DrdDeleteRequest(BaseModel):
    url: str
    year: str
    quarter_filename: str

@app.put("/drd/update")
async def drd_update(req: DrdUpdateRequest):
    new_md = build_item_markdown(req.date, req.title, req.url, req.summary)
    try:
        update_item_in_quarterly_file(
            QUALITY_UPDATES_PATH, req.year, req.quarter_filename, req.url, new_md
        )
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"ok": True}

@app.delete("/drd/delete")
async def drd_delete(req: DrdDeleteRequest):
    try:
        delete_item_from_quarterly_file(
            QUALITY_UPDATES_PATH, req.year, req.quarter_filename, req.url
        )
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"ok": True}
```

### Step 2-6: `ingestor-client.ts`에 함수 2개 추가

```typescript
export async function drdUpdate(payload: {
  title: string;
  url: string;
  date: string;
  source: string;
  year: string;
  quarter_filename: string;
  summary: string;
}): Promise<{ ok: boolean }> {
  return fetchJson(`${BASE}/drd/update`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function drdDelete(payload: {
  url: string;
  year: string;
  quarter_filename: string;
}): Promise<{ ok: boolean }> {
  return fetchJson(`${BASE}/drd/delete`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

### Step 2-7: BFF 라우트 추가

`apps/web/src/app/api/web/ingest/drd/update/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { drdUpdate } from "@/lib/ingestor-client";
import { revalidatePath } from "next/cache";

export async function PUT(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  try {
    const result = await drdUpdate(body);
    if (result.ok) revalidatePath("/updates");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

`apps/web/src/app/api/web/ingest/drd/delete/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { drdDelete } from "@/lib/ingestor-client";
import { revalidatePath } from "next/cache";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  try {
    const result = await drdDelete(body);
    if (result.ok) revalidatePath("/updates");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

### Step 2-8: `/admin/entries` 페이지 생성

`apps/web/src/app/admin/entries/page.tsx`:
```tsx
import { loadUpdatesIndex } from "@/lib/updates-index";
import { EntriesClient } from "./EntriesClient";

export default function EntriesPage() {
  const entries = loadUpdatesIndex();
  return (
    <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-3xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          입수 데이터 관리
        </h1>
        <EntriesClient initialEntries={entries} />
      </div>
    </div>
  );
}
```

`apps/web/src/app/admin/entries/EntriesClient.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { UpdatesIndexEntry } from "@/lib/updates-index";

// quarterlySlug → { year, filename } 파싱 헬퍼
function parseSlug(slug: string): { year: string; filename: string } {
  const parts = slug.split("/");
  const year = parts[parts.length - 2] ?? "";
  const filename = (parts[parts.length - 1] ?? "") + ".md";
  return { year, filename };
}

export function EntriesClient({ initialEntries }: { initialEntries: UpdatesIndexEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [editTarget, setEditTarget] = useState<UpdatesIndexEntry | null>(null);
  const [editSummary, setEditSummary] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [status, setStatus] = useState("");

  async function handleDelete(entry: UpdatesIndexEntry) {
    if (!confirm(`삭제: ${entry.title}`)) return;
    const { year, filename } = parseSlug(entry.quarterlySlug);
    const res = await fetch("/api/web/ingest/drd/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: entry.url, year, quarter_filename: filename }),
    });
    if (res.ok) {
      setEntries((prev) => prev.filter((e) => e.url !== entry.url));
      setStatus("삭제 완료");
    } else {
      setStatus("삭제 실패");
    }
  }

  async function handleUpdate() {
    if (!editTarget) return;
    const { year, filename } = parseSlug(editTarget.quarterlySlug);
    const res = await fetch("/api/web/ingest/drd/update", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle,
        url: editTarget.url,
        date: editTarget.date,
        source: editTarget.source,
        year,
        quarter_filename: filename,
        summary: editSummary,
      }),
    });
    if (res.ok) {
      setEntries((prev) =>
        prev.map((e) =>
          e.url === editTarget.url ? { ...e, title: editTitle, summary: editSummary } : e
        )
      );
      setEditTarget(null);
      setStatus("수정 완료");
    } else {
      setStatus("수정 실패");
    }
  }

  return (
    <div className="space-y-4">
      {status && <p className="text-sm text-indigo-600">{status}</p>}

      {editTarget && (
        <div className="border rounded-lg p-4 bg-yellow-50 dark:bg-yellow-900/20 space-y-3">
          <p className="text-sm font-medium">수정 중: {editTarget.url}</p>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full border rounded px-3 py-1.5 text-sm"
            placeholder="제목"
          />
          <textarea
            value={editSummary}
            onChange={(e) => setEditSummary(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-1.5 text-sm"
            placeholder="요약 (항목 구분: ' | ')"
          />
          <div className="flex gap-2">
            <button onClick={handleUpdate} className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm">저장</button>
            <button onClick={() => setEditTarget(null)} className="px-4 py-1.5 bg-gray-200 rounded text-sm">취소</button>
          </div>
        </div>
      )}

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {entries.map((entry) => (
          <li key={entry.url} className="py-3 flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{entry.source} · {entry.date} · {entry.periodLabel}</p>
              <a href={entry.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 line-clamp-1">
                {entry.title}
              </a>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => { setEditTarget(entry); setEditTitle(entry.title); setEditSummary(entry.summary); }}
                className="text-xs text-gray-500 hover:text-indigo-600">수정</button>
              <button
                onClick={() => handleDelete(entry)}
                className="text-xs text-gray-500 hover:text-red-600">삭제</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Step 2-9: 빌드 확인

```bash
cd apps/web
node_modules/.bin/next build 2>&1 | tail -5
```

### Step 2-10: 커밋

```bash
git add apps/document-ingestor/src/drd.py \
        apps/document-ingestor/src/main.py \
        apps/document-ingestor/tests/test_drd.py \
        apps/web/src/lib/ingestor-client.ts \
        apps/web/src/app/api/web/ingest/drd/ \
        apps/web/src/app/admin/entries/
git commit -m "feat: Entry 수정·삭제 (drd.py + BFF + /admin/entries)"
```

---

## Task 3: Quarterly Update 자동 생성

**배경:** 매분기 업데이트 내용을 Agent가 취합해서 Executive Summary + 기관별 요약 + 시사점을 작성해야 한다. 현재 분기 파일에는 개별 항목만 있고, Executive Summary 섹션은 비어 있거나 수동 작성이다.

**Files:**
- Create: `apps/document-ingestor/src/quarterly.py`
- Modify: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/tests/test_quarterly.py`
- Create: `apps/web/src/app/api/web/ingest/quarterly/route.ts`
- Modify: `apps/web/src/lib/ingestor-client.ts`
- Create: `apps/web/src/app/admin/quarterly/page.tsx`

### Step 3-1: 테스트 작성

`apps/document-ingestor/tests/test_quarterly.py`:
```python
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.main import app
import tempfile, os

client = TestClient(app)

def test_generate_quarterly_summary():
    with patch("src.quarterly.call_claude_quarterly", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "executive_summary": "테스트 요약",
            "agency_summaries": {"금융감독원": "기관 요약"},
            "implications": "시사점 내용",
        }
        res = client.post("/quarterly/generate", json={
            "year": "2025",
            "quarter_filename": "2025-01-01_to_2025-03-31.md",
        })
    assert res.status_code == 200
    data = res.json()
    assert "executive_summary" in data
    assert data["executive_summary"] == "테스트 요약"
```

### Step 3-2: 테스트 실패 확인

```bash
cd apps/document-ingestor
uv run pytest tests/test_quarterly.py -v
```
Expected: `FAILED`

### Step 3-3: `src/quarterly.py` 작성

```python
import json
from pathlib import Path
import anthropic
from src.config import ANTHROPIC_API_KEY, QUALITY_UPDATES_PATH

_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

QUARTERLY_SYSTEM_PROMPT = """당신은 회계·감사 규제 전문가입니다.
주어진 분기 규제 업데이트 항목들을 분석하여 다음을 JSON으로 반환하세요:

1. executive_summary: 해당 분기의 핵심 규제 동향 요약 (3~5문장, 굵은 키워드 포함)
2. agency_summaries: 기관별 주요 사항 ({"금융감독원": "...", "금융위원회": "...", ...})
3. implications: 회계·감사 실무에 대한 시사점 (3~5가지 bullet 형태, " | " 구분)

반드시 JSON으로만 응답:
{"executive_summary": "...", "agency_summaries": {...}, "implications": "..."}"""


def read_quarterly_items(year: str, quarter_filename: str) -> str:
    """분기 파일에서 개별 항목(- (YY-MM-DD) [Title](URL) + note) 텍스트 추출."""
    root = Path(QUALITY_UPDATES_PATH).resolve()
    q_path = (root / year / quarter_filename).resolve()
    if not str(q_path).startswith(str(root)):
        raise ValueError(f"경로 탐색 시도 차단: {q_path}")
    if not q_path.exists():
        raise FileNotFoundError(f"분기 파일 없음: {q_path}")
    content = q_path.read_text(encoding="utf-8")
    # frontmatter 제거
    if content.startswith("---"):
        parts = content.split("---", 2)
        content = parts[2] if len(parts) > 2 else content
    return content[:12000]  # 토큰 절약


async def call_claude_quarterly(items_text: str) -> dict:
    msg = await _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=QUARTERLY_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": items_text}],
    )
    try:
        return json.loads(msg.content[0].text)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude 응답 JSON 파싱 실패: {e}") from e


def update_quarterly_summary(
    year: str,
    quarter_filename: str,
    executive_summary: str,
    agency_summaries: dict,
    implications: str,
) -> None:
    """분기 파일의 Executive Summary 섹션을 생성된 내용으로 교체."""
    root = Path(QUALITY_UPDATES_PATH).resolve()
    q_path = (root / year / quarter_filename).resolve()
    content = q_path.read_text(encoding="utf-8")

    # 기관별 요약 마크다운 생성
    agency_md = "\n".join(f"    - **{k}**: {v}" for k, v in agency_summaries.items())

    # 시사점 불릿 생성
    impl_bullets = "\n".join(
        f"- {p.strip()}" for p in implications.split(" | ") if p.strip()
    )

    new_summary_block = f"""## Executive Summary

{executive_summary}

---

#### 기관별 요약

{agency_md}

---

#### 시사점

{impl_bullets}

---
"""

    # 기존 Executive Summary 섹션 교체 또는 frontmatter 직후에 삽입
    import re
    if "## Executive Summary" in content:
        content = re.sub(
            r"## Executive Summary.*?(?=\n## |\Z)",
            new_summary_block,
            content,
            flags=re.DOTALL,
        )
    else:
        # frontmatter 이후 첫 번째 위치에 삽입
        content = re.sub(r"(---\n)", r"\1\n" + new_summary_block, content, count=1)

    q_path.write_text(content, encoding="utf-8")
```

### Step 3-4: `main.py`에 엔드포인트 추가

```python
import src.quarterly as _quarterly_mod

class QuarterlyGenerateRequest(BaseModel):
    year: str
    quarter_filename: str
    save: bool = False   # True면 분기 파일 업데이트까지

@app.post("/quarterly/generate")
async def quarterly_generate(req: QuarterlyGenerateRequest):
    try:
        items_text = _quarterly_mod.read_quarterly_items(req.year, req.quarter_filename)
        result = await _quarterly_mod.call_claude_quarterly(items_text)
        if req.save:
            _quarterly_mod.update_quarterly_summary(
                req.year,
                req.quarter_filename,
                result["executive_summary"],
                result.get("agency_summaries", {}),
                result.get("implications", ""),
            )
        return result
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=422, detail=str(e))
```

### Step 3-5: 테스트 통과 확인

```bash
uv run pytest tests/test_quarterly.py -v
```

### Step 3-6: `ingestor-client.ts`에 함수 추가

```typescript
export async function quarterlyGenerate(payload: {
  year: string;
  quarter_filename: string;
  save?: boolean;
}): Promise<{
  executive_summary: string;
  agency_summaries: Record<string, string>;
  implications: string;
}> {
  return fetchJson(`${BASE}/quarterly/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
```

### Step 3-7: BFF 라우트 생성

`apps/web/src/app/api/web/ingest/quarterly/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { quarterlyGenerate } from "@/lib/ingestor-client";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  try {
    const result = await quarterlyGenerate(body);
    if (body.save) revalidatePath("/updates");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
```

### Step 3-8: `/admin/quarterly` UI 생성

`apps/web/src/app/admin/quarterly/page.tsx`:
```tsx
import { QuarterlyClient } from "./QuarterlyClient";

export default function QuarterlyPage() {
  return (
    <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-2xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Quarterly Update 생성
        </h1>
        <QuarterlyClient />
      </div>
    </div>
  );
}
```

`apps/web/src/app/admin/quarterly/QuarterlyClient.tsx`:
```tsx
"use client";
import { useState } from "react";

function currentQuarterInfo() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const [qs, qe] =
    m <= 3 ? [`${y}-01-01`, `${y}-03-31`] :
    m <= 6 ? [`${y}-04-01`, `${y}-06-30`] :
    m <= 9 ? [`${y}-07-01`, `${y}-09-30`] :
             [`${y}-10-01`, `${y}-12-31`];
  return { year: String(y), filename: `${qs}_to_${qe}.md` };
}

export function QuarterlyClient() {
  const { year: defaultYear, filename: defaultFilename } = currentQuarterInfo();
  const [year, setYear] = useState(defaultYear);
  const [filename, setFilename] = useState(defaultFilename);
  const [result, setResult] = useState<{
    executive_summary: string;
    agency_summaries: Record<string, string>;
    implications: string;
  } | null>(null);
  const [status, setStatus] = useState<"idle" | "generating" | "saving">("idle");
  const [error, setError] = useState("");

  async function handleGenerate() {
    setStatus("generating"); setError("");
    try {
      const res = await fetch("/api/web/ingest/quarterly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, quarter_filename: filename, save: false }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "생성 실패");
      setResult(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSave() {
    setStatus("saving"); setError("");
    try {
      const res = await fetch("/api/web/ingest/quarterly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, quarter_filename: filename, save: true }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "저장 실패");
      }
      setError(""); setResult(null);
      alert("분기 파일에 저장 완료. /updates에서 확인하세요.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-3">
        <input value={year} onChange={e => setYear(e.target.value)}
          placeholder="연도 (예: 2025)"
          className="w-28 border rounded px-3 py-2 text-sm" />
        <input value={filename} onChange={e => setFilename(e.target.value)}
          placeholder="파일명 (예: 2025-01-01_to_2025-03-31.md)"
          className="flex-1 border rounded px-3 py-2 text-sm" />
        <button onClick={handleGenerate} disabled={status !== "idle"}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">
          {status === "generating" ? "생성 중..." : "요약 생성"}
        </button>
      </div>

      {result && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Executive Summary</label>
            <textarea value={result.executive_summary}
              onChange={e => setResult({ ...result, executive_summary: e.target.value })}
              rows={4} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">시사점</label>
            <textarea value={result.implications}
              onChange={e => setResult({ ...result, implications: e.target.value })}
              rows={3} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={handleSave} disabled={status !== "idle"}
            className="px-6 py-2 bg-green-600 text-white rounded font-medium disabled:opacity-50">
            {status === "saving" ? "저장 중..." : "분기 파일에 저장"}
          </button>
        </div>
      )}
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
```

### Step 3-9: 빌드 확인 + 커밋

```bash
cd apps/web && node_modules/.bin/next build 2>&1 | tail -5
cd ../..
git add apps/document-ingestor/src/quarterly.py \
        apps/document-ingestor/src/main.py \
        apps/document-ingestor/tests/test_quarterly.py \
        apps/web/src/lib/ingestor-client.ts \
        apps/web/src/app/api/web/ingest/quarterly/ \
        apps/web/src/app/admin/quarterly/
git commit -m "feat: Quarterly Update 자동 생성 (Claude + /admin/quarterly)"
```

---

## Task 4: DRD 대기 큐 + 전문가 선별 UI (Step 2, 3-1, 3-2)

**배경:** 크롤러가 수집한 항목을 "추가 가공 대기" 상태로 관리하고, 전문가가 Complete List를 보면서 회계·감사 목적에 필요한 항목을 선별하는 흐름이 필요하다. 선별된 항목은 기존 `/admin/ingest`로 이어진다.

**설계:** JSON 파일(`quality-updates/drd-queue.json`)을 간이 큐 스토어로 사용한다. 크롤러 또는 수동 등록으로 항목을 추가하고, 전문가가 UI에서 선별·처리한다.

**Files:**
- Create: `apps/document-ingestor/src/queue.py`
- Modify: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/tests/test_queue.py`
- Create: `apps/web/src/app/api/web/ingest/queue/route.ts`
- Create: `apps/web/src/app/admin/queue/page.tsx`
- Create: `apps/web/src/app/admin/queue/QueueClient.tsx`

### Step 4-1: 테스트 작성

`apps/document-ingestor/tests/test_queue.py`:
```python
import os, json, tempfile
from unittest.mock import patch

def test_add_and_list_queue_items():
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("src.queue.QUEUE_PATH", os.path.join(tmpdir, "drd-queue.json")):
            from src.queue import add_queue_item, list_queue_items
            import importlib, src.queue
            importlib.reload(src.queue)

            src.queue.add_queue_item({
                "title": "테스트 항목",
                "url": "https://fss.or.kr/test",
                "source": "금융감독원",
                "date": "2026-03-08",
                "raw_text": "원문 내용",
            })
            items = src.queue.list_queue_items()
            assert len(items) == 1
            assert items[0]["title"] == "테스트 항목"
            assert items[0]["status"] == "pending"

def test_remove_queue_item():
    with tempfile.TemporaryDirectory() as tmpdir:
        with patch("src.queue.QUEUE_PATH", os.path.join(tmpdir, "drd-queue.json")):
            import importlib, src.queue
            importlib.reload(src.queue)

            src.queue.add_queue_item({
                "title": "삭제할 항목",
                "url": "https://fss.or.kr/del",
                "source": "금융감독원",
                "date": "2026-03-08",
                "raw_text": "",
            })
            items = src.queue.list_queue_items()
            item_id = items[0]["id"]
            src.queue.remove_queue_item(item_id)
            assert len(src.queue.list_queue_items()) == 0
```

### Step 4-2: 테스트 실패 확인

```bash
uv run pytest tests/test_queue.py -v
```
Expected: `FAILED`

### Step 4-3: `src/queue.py` 작성

```python
import json, uuid, os
from pathlib import Path
from src.config import QUALITY_UPDATES_PATH

QUEUE_PATH = os.path.join(QUALITY_UPDATES_PATH, "drd-queue.json")

def _load() -> list:
    if not os.path.exists(QUEUE_PATH):
        return []
    with open(QUEUE_PATH, encoding="utf-8") as f:
        return json.load(f)

def _save(items: list) -> None:
    os.makedirs(os.path.dirname(QUEUE_PATH), exist_ok=True)
    with open(QUEUE_PATH, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)

def add_queue_item(item: dict) -> dict:
    items = _load()
    entry = {
        "id": str(uuid.uuid4()),
        "status": "pending",   # pending | selected | processed
        **item,
    }
    items.append(entry)
    _save(items)
    return entry

def list_queue_items(status: str | None = None) -> list:
    items = _load()
    if status:
        items = [i for i in items if i.get("status") == status]
    return items

def update_queue_item_status(item_id: str, status: str) -> None:
    items = _load()
    for item in items:
        if item["id"] == item_id:
            item["status"] = status
    _save(items)

def remove_queue_item(item_id: str) -> None:
    items = _load()
    items = [i for i in items if i["id"] != item_id]
    _save(items)
```

### Step 4-4: `main.py`에 큐 엔드포인트 추가

```python
import src.queue as _queue_mod

class QueueAddRequest(BaseModel):
    title: str
    url: str
    source: str
    date: str
    raw_text: str = ""

class QueueStatusRequest(BaseModel):
    item_id: str
    status: str  # "pending" | "selected" | "processed"

@app.get("/queue")
def queue_list(status: str | None = None):
    return _queue_mod.list_queue_items(status)

@app.post("/queue")
def queue_add(req: QueueAddRequest):
    return _queue_mod.add_queue_item(req.model_dump())

@app.patch("/queue/{item_id}")
def queue_update_status(item_id: str, req: QueueStatusRequest):
    _queue_mod.update_queue_item_status(item_id, req.status)
    return {"ok": True}

@app.delete("/queue/{item_id}")
def queue_remove(item_id: str):
    _queue_mod.remove_queue_item(item_id)
    return {"ok": True}
```

### Step 4-5: 테스트 통과 확인

```bash
uv run pytest tests/test_queue.py tests/ -v
```
Expected: 전체 PASSED

### Step 4-6: BFF 라우트 생성

`apps/web/src/app/api/web/ingest/queue/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.DOCUMENT_INGESTOR_URL ?? "http://document-ingestor:8010";

async function requireAdmin() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  return roles.includes("admin");
}

export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const res = await fetch(`${BASE}/queue`);
  return NextResponse.json(await res.json());
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const res = await fetch(`${BASE}/queue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return NextResponse.json(await res.json());
}
```

`apps/web/src/app/api/web/ingest/queue/[id]/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.DOCUMENT_INGESTOR_URL ?? "http://document-ingestor:8010";

async function requireAdmin() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  return roles.includes("admin");
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const body = await req.json();
  const res = await fetch(`${BASE}/queue/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item_id: id, ...body }),
  });
  return NextResponse.json(await res.json());
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const res = await fetch(`${BASE}/queue/${id}`, { method: "DELETE" });
  return NextResponse.json(await res.json());
}
```

### Step 4-7: `/admin/queue` UI 생성

`apps/web/src/app/admin/queue/page.tsx`:
```tsx
import { QueueClient } from "./QueueClient";

export default function QueuePage() {
  return (
    <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-3xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          DRD 대기 큐
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          크롤러가 수집한 항목 전체 목록. 필요한 항목을 선별 후 입수 페이지로 이동하세요.
        </p>
        <QueueClient />
      </div>
    </div>
  );
}
```

`apps/web/src/app/admin/queue/QueueClient.tsx`:
```tsx
"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

type QueueItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  date: string;
  raw_text: string;
  status: "pending" | "selected" | "processed";
};

export function QueueClient() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "selected">("pending");
  const [loading, setLoading] = useState(true);

  async function loadItems() {
    setLoading(true);
    const res = await fetch("/api/web/ingest/queue");
    const data = await res.json() as QueueItem[];
    setItems(data);
    setLoading(false);
  }

  useEffect(() => { loadItems(); }, []);

  async function handleSelect(item: QueueItem) {
    await fetch(`/api/web/ingest/queue/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "selected" }),
    });
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: "selected" } : i));
  }

  async function handleDiscard(item: QueueItem) {
    if (!confirm(`제외: ${item.title}`)) return;
    await fetch(`/api/web/ingest/queue/${item.id}`, { method: "DELETE" });
    setItems(prev => prev.filter(i => i.id !== item.id));
  }

  const filtered = items.filter(i => filter === "all" ? true : i.status === filter);

  return (
    <div className="space-y-4">
      {/* 필터 탭 */}
      <div className="flex gap-2">
        {(["pending", "selected", "all"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === f ? "bg-indigo-600 text-white" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
            {f === "pending" ? "대기" : f === "selected" ? "선별됨" : "전체"}
            {" "}({items.filter(i => f === "all" ? true : i.status === f).length})
          </button>
        ))}
        <button onClick={loadItems} className="ml-auto text-xs text-gray-400 hover:text-gray-600">새로고침</button>
      </div>

      {loading && <p className="text-sm text-gray-400">로딩 중...</p>}

      <ul className="divide-y divide-gray-200 dark:divide-gray-800">
        {filtered.map(item => (
          <li key={item.id} className="py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400">{item.source} · {item.date}</p>
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-sm font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 line-clamp-2">
                {item.title}
              </a>
            </div>
            <div className="flex gap-2 shrink-0 items-center">
              {item.status === "pending" && (
                <button onClick={() => handleSelect(item)}
                  className="text-xs px-2 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100">
                  선별
                </button>
              )}
              {item.status === "selected" && (
                <Link href={`/admin/ingest?url=${encodeURIComponent(item.url)}`}
                  className="text-xs px-2 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded hover:bg-green-100">
                  입수 →
                </Link>
              )}
              <button onClick={() => handleDiscard(item)}
                className="text-xs text-gray-400 hover:text-red-500">제외</button>
            </div>
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="py-8 text-center text-sm text-gray-400">항목 없음</li>
        )}
      </ul>
    </div>
  );
}
```

### Step 4-8: 빌드 확인 + 커밋

```bash
cd apps/web && node_modules/.bin/next build 2>&1 | tail -5
cd ../..
git add apps/document-ingestor/src/queue.py \
        apps/document-ingestor/src/main.py \
        apps/document-ingestor/tests/test_queue.py \
        apps/web/src/app/api/web/ingest/queue/ \
        apps/web/src/app/admin/queue/
git commit -m "feat: DRD 대기 큐 + /admin/queue 선별 UI (Step 2, 3-1, 3-2)"
```

---

## 완료 기준

| Task | 검증 방법 |
|------|---------|
| 1. 카드 복사 버튼 | `/updates`에서 버튼 클릭 → 클립보드 확인 |
| 2. Entry 수정·삭제 | `/admin/entries`에서 수정/삭제 → `/updates` 카드 반영 확인 |
| 3. Quarterly 생성 | `/admin/quarterly`에서 분기 파일 선택 → 요약 생성 → 저장 → 분기 MDX 파일 확인 |
| 4. DRD 대기 큐 | `/admin/queue`에서 항목 선별 → `/admin/ingest`로 이동 |
| Python 테스트 | `uv run pytest tests/ -v` → 전체 PASSED |
| Next.js 빌드 | `next build` → 오류 없음 |
