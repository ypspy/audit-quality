# document-ingestor 구현 계획

**상태:** ✅ 완료

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 전문가가 URL/PDF/HWP를 제공하면 본문 추출 → Claude 요약 → DRD 저장까지 자동화하여 Step 3-4 병목을 제거한다.

**Architecture:** Python FastAPI 서비스(`apps/document-ingestor`)가 URL fetch(Playwright), PDF(Anthropic Files API), HWP(Gotenberg→PDF→Files API)를 처리한다. Next.js BFF API 라우트가 인증(Keycloak admin 역할) 후 ingestor로 프록시한다. 어드민 UI(`/admin/ingest`)에서 전문가가 입력→추출 확인→요약 확인→저장 흐름을 수행한다.

**Tech Stack:** Python 3.12, FastAPI, Playwright (Python), Anthropic SDK (Python), Gotenberg REST API, Next.js App Router API Routes, React (TypeScript), Keycloak JWT roles

---

## Task 1: Python FastAPI 서비스 뼈대

**Files:**
- Create: `apps/document-ingestor/pyproject.toml`
- Create: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/src/config.py`
- Create: `apps/document-ingestor/tests/test_health.py`
- Create: `apps/document-ingestor/Dockerfile`

**Step 1-1: 테스트 작성**

`apps/document-ingestor/tests/test_health.py`:
```python
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"ok": True}
```

**Step 1-2: 테스트 실패 확인**

```bash
cd apps/document-ingestor
uv run pytest tests/test_health.py -v
```
Expected: `ModuleNotFoundError` 또는 `ImportError`

**Step 1-3: `pyproject.toml` 작성**

```toml
[project]
name = "document-ingestor"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.30",
  "anthropic>=0.40",
  "playwright>=1.49",
  "httpx>=0.27",
  "python-multipart>=0.0.12",
]

[project.optional-dependencies]
dev = ["pytest>=8", "httpx>=0.27"]

[tool.pytest.ini_options]
testpaths = ["tests"]
```

**Step 1-4: `src/config.py` 작성**

```python
import os

ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
GOTENBERG_URL = os.getenv("GOTENBERG_URL", "http://gotenberg:3000")
QUALITY_UPDATES_PATH = os.getenv("QUALITY_UPDATES_PATH", "/workspace/quality-updates")
```

**Step 1-5: `src/main.py` 작성**

```python
from fastapi import FastAPI

app = FastAPI(title="document-ingestor")

@app.get("/health")
def health():
    return {"ok": True}
```

**Step 1-6: 테스트 통과 확인**

```bash
uv run pytest tests/test_health.py -v
```
Expected: `PASSED`

**Step 1-7: Dockerfile 작성**

```dockerfile
FROM python:3.12-slim

WORKDIR /app
RUN pip install uv

COPY pyproject.toml .
RUN uv sync --no-dev

# Playwright 브라우저 설치
RUN uv run playwright install chromium --with-deps

COPY src/ ./src/

CMD ["uv", "run", "uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8010"]
```

**Step 1-8: 커밋**

```bash
git add apps/document-ingestor/
git commit -m "feat(document-ingestor): FastAPI 서비스 뼈대"
```

---

## Task 2: URL 본문 추출 엔드포인트

**Files:**
- Create: `apps/document-ingestor/src/ingest_url.py`
- Modify: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/tests/test_ingest_url.py`

**Step 2-1: 테스트 작성**

`tests/test_ingest_url.py`:
```python
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_ingest_url_returns_text():
    with patch("src.ingest_url.fetch_url_text", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.return_value = "본문 텍스트 예시"
        res = client.post("/ingest/url", json={"url": "https://example.com"})
    assert res.status_code == 200
    assert "text" in res.json()
    assert res.json()["text"] == "본문 텍스트 예시"

def test_ingest_url_fetch_failure_returns_empty():
    with patch("src.ingest_url.fetch_url_text", new_callable=AsyncMock) as mock_fetch:
        mock_fetch.side_effect = Exception("fetch failed")
        res = client.post("/ingest/url", json={"url": "https://example.com"})
    assert res.status_code == 200
    assert res.json()["text"] == ""
    assert "error" in res.json()
```

**Step 2-2: 테스트 실패 확인**

```bash
uv run pytest tests/test_ingest_url.py -v
```
Expected: `FAILED` - 라우트 미존재

**Step 2-3: `src/ingest_url.py` 작성**

```python
from playwright.async_api import async_playwright
import re

async def fetch_url_text(url: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
        # 본문 텍스트 추출: <article>, <main>, <body> 순으로 시도
        for selector in ["article", "main", "body"]:
            el = await page.query_selector(selector)
            if el:
                text = await el.inner_text()
                if len(text.strip()) > 100:
                    await browser.close()
                    return _clean(text)
        text = await page.inner_text("body")
        await browser.close()
        return _clean(text)

def _clean(text: str) -> str:
    # 연속 공백/개행 정리
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()
```

**Step 2-4: `src/main.py` 라우트 추가**

```python
from fastapi import FastAPI
from pydantic import BaseModel
from src.ingest_url import fetch_url_text

app = FastAPI(title="document-ingestor")

@app.get("/health")
def health():
    return {"ok": True}

class UrlRequest(BaseModel):
    url: str

@app.post("/ingest/url")
async def ingest_url(req: UrlRequest):
    try:
        text = await fetch_url_text(req.url)
        return {"text": text}
    except Exception as e:
        return {"text": "", "error": str(e)}
```

**Step 2-5: 테스트 통과 확인**

```bash
uv run pytest tests/test_ingest_url.py -v
```
Expected: `PASSED`

**Step 2-6: 커밋**

```bash
git add apps/document-ingestor/src/ apps/document-ingestor/tests/test_ingest_url.py
git commit -m "feat(document-ingestor): URL 본문 추출 (Playwright)"
```

---

## Task 3: PDF/HWP 파일 추출 엔드포인트

**Files:**
- Create: `apps/document-ingestor/src/ingest_file.py`
- Modify: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/tests/test_ingest_file.py`

**Step 3-1: 테스트 작성**

`tests/test_ingest_file.py`:
```python
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
import io
from src.main import app

client = TestClient(app)

def _upload(filename: str, content: bytes, content_type: str):
    return client.post(
        "/ingest/file",
        files={"file": (filename, io.BytesIO(content), content_type)},
    )

def test_pdf_returns_file_id():
    with patch("src.ingest_file.upload_pdf_to_anthropic", new_callable=AsyncMock) as mock:
        mock.return_value = "file-abc123"
        res = _upload("test.pdf", b"%PDF-1.4 test", "application/pdf")
    assert res.status_code == 200
    data = res.json()
    assert data["file_id"] == "file-abc123"
    assert data["type"] == "pdf"

def test_hwp_converts_and_returns_file_id():
    with patch("src.ingest_file.convert_hwp_to_pdf", new_callable=AsyncMock) as mock_conv, \
         patch("src.ingest_file.upload_pdf_to_anthropic", new_callable=AsyncMock) as mock_up:
        mock_conv.return_value = b"%PDF converted"
        mock_up.return_value = "file-hwp123"
        res = _upload("test.hwp", b"HWP data", "application/octet-stream")
    assert res.status_code == 200
    assert res.json()["file_id"] == "file-hwp123"
    assert res.json()["type"] == "pdf"

def test_unsupported_format_returns_error():
    res = _upload("test.xlsx", b"data", "application/vnd.ms-excel")
    assert res.status_code == 400
```

**Step 3-2: 테스트 실패 확인**

```bash
uv run pytest tests/test_ingest_file.py -v
```
Expected: `FAILED`

**Step 3-3: `src/ingest_file.py` 작성**

```python
import anthropic
import httpx
from src.config import ANTHROPIC_API_KEY, GOTENBERG_URL

_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

async def upload_pdf_to_anthropic(pdf_bytes: bytes, filename: str = "doc.pdf") -> str:
    """PDF를 Anthropic Files API에 업로드하고 file_id 반환."""
    response = await _client.beta.files.upload(
        file=(filename, pdf_bytes, "application/pdf"),
    )
    return response.id

async def convert_hwp_to_pdf(hwp_bytes: bytes, filename: str = "doc.hwp") -> bytes:
    """Gotenberg REST API로 HWP → PDF 변환."""
    async with httpx.AsyncClient(timeout=60) as http:
        res = await http.post(
            f"{GOTENBERG_URL}/forms/libreoffice/convert",
            files={"files": (filename, hwp_bytes, "application/octet-stream")},
        )
        res.raise_for_status()
        return res.content
```

**Step 3-4: `src/main.py` 파일 라우트 추가**

기존 main.py에 다음 추가:
```python
from fastapi import UploadFile, File, HTTPException
from src.ingest_file import upload_pdf_to_anthropic, convert_hwp_to_pdf

@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    content = await file.read()
    name = file.filename or "doc"

    if name.endswith(".pdf"):
        file_id = await upload_pdf_to_anthropic(content, name)
        return {"file_id": file_id, "type": "pdf"}

    if name.endswith(".hwp") or name.endswith(".hwpx"):
        pdf_bytes = await convert_hwp_to_pdf(content, name)
        file_id = await upload_pdf_to_anthropic(pdf_bytes, name + ".pdf")
        return {"file_id": file_id, "type": "pdf"}

    raise HTTPException(status_code=400, detail=f"지원하지 않는 형식: {name}")
```

**Step 3-5: 테스트 통과 확인**

```bash
uv run pytest tests/test_ingest_file.py -v
```
Expected: `PASSED`

**Step 3-6: 커밋**

```bash
git add apps/document-ingestor/src/ingest_file.py apps/document-ingestor/tests/test_ingest_file.py apps/document-ingestor/src/main.py
git commit -m "feat(document-ingestor): PDF/HWP 업로드 (Anthropic Files API + Gotenberg)"
```

---

## Task 4: 요약 생성 + DRD 저장 엔드포인트

**Files:**
- Create: `apps/document-ingestor/src/summarize.py`
- Create: `apps/document-ingestor/src/drd.py`
- Modify: `apps/document-ingestor/src/main.py`
- Create: `apps/document-ingestor/tests/test_summarize.py`
- Create: `apps/document-ingestor/tests/test_drd.py`

**Step 4-1: 요약 테스트 작성**

`tests/test_summarize.py`:
```python
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi.testclient import TestClient
from src.main import app

client = TestClient(app)

def test_summarize_text_input():
    with patch("src.summarize.call_claude", new_callable=AsyncMock) as mock:
        mock.return_value = {"title": "테스트 제목", "summary": "요약 내용"}
        res = client.post("/summarize", json={
            "text": "긴 규제 본문...",
            "source": "금융감독원",
            "category": "보도자료",
        })
    assert res.status_code == 200
    assert res.json()["title"] == "테스트 제목"
    assert res.json()["summary"] == "요약 내용"

def test_summarize_file_id_input():
    with patch("src.summarize.call_claude_with_file", new_callable=AsyncMock) as mock:
        mock.return_value = {"title": "PDF 제목", "summary": "PDF 요약"}
        res = client.post("/summarize", json={
            "file_id": "file-abc123",
            "source": "금융위원회",
            "category": "규정",
        })
    assert res.status_code == 200
    assert res.json()["title"] == "PDF 제목"
```

**Step 4-2: DRD 저장 테스트 작성**

`tests/test_drd.py`:
```python
import os, tempfile, textwrap
from src.drd import append_to_quarterly_file, build_item_markdown

def test_build_item_markdown_with_summary():
    md = build_item_markdown(
        date="2026-03-08",
        title="IPO 법인 재무제표 심사 강화",
        url="https://fss.or.kr/example",
        summary="주요 내용 1 주요 내용 2",
    )
    assert "(26-03-08)" in md
    assert "[IPO 법인 재무제표 심사 강화]" in md
    assert "!!! note" in md

def test_build_item_markdown_without_summary():
    md = build_item_markdown(
        date="2026-03-08",
        title="제목만 있는 항목",
        url="https://fss.or.kr/example",
        summary="",
    )
    assert "!!! note" not in md

def test_append_to_quarterly_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        # 분기 파일 미리 생성
        q_path = os.path.join(tmpdir, "2026-01-01_to_2026-03-31.md")
        with open(q_path, "w") as f:
            f.write("---\nperiod_label: 2026-Q1\n---\n\n### 금융감독원\n\n")

        append_to_quarterly_file(
            updates_root=tmpdir,
            year="2026",
            quarter_filename="2026-01-01_to_2026-03-31.md",
            source="금융감독원",
            item_md="- (26-03-08) [제목](https://example.com)\n",
        )

        content = open(q_path).read()
        assert "제목" in content
```

**Step 4-3: 테스트 실패 확인**

```bash
uv run pytest tests/test_summarize.py tests/test_drd.py -v
```
Expected: `FAILED`

**Step 4-4: `src/summarize.py` 작성**

```python
import json
import anthropic
from src.config import ANTHROPIC_API_KEY

_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """당신은 회계·감사 규제 전문가입니다.
주어진 규제 문서에서 다음을 추출하세요:
1. title: 문서의 핵심 제목 (30자 이내)
2. summary: 회계·감사 실무에서 중요한 변경사항 3~5가지 (각 항목 1~2문장)

반드시 JSON으로만 응답:
{"title": "...", "summary": "항목1 항목2 항목3"}"""

async def call_claude(text: str, source: str, category: str) -> dict:
    msg = await _client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": f"기관: {source}\n분류: {category}\n\n{text[:8000]}"}],
    )
    return json.loads(msg.content[0].text)

async def call_claude_with_file(file_id: str, source: str, category: str) -> dict:
    msg = await _client.beta.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=512,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": [
                {"type": "document", "source": {"type": "file", "file_id": file_id}},
                {"type": "text", "text": f"기관: {source}\n분류: {category}\n위 문서를 요약하세요."},
            ],
        }],
        betas=["files-api-2025-04-14"],
    )
    return json.loads(msg.content[0].text)
```

**Step 4-5: `src/drd.py` 작성**

```python
import os, re, subprocess
from pathlib import Path

def build_item_markdown(date: str, title: str, url: str, summary: str) -> str:
    # date: "2026-03-08" → "26-03-08"
    short_date = date[2:]
    lines = [f"- ({short_date}) [{title}]({url})"]
    if summary.strip():
        lines.append("")
        lines.append('    !!! note "주요 내용"')
        lines.append("")
        for part in summary.split("  "):
            part = part.strip()
            if part:
                lines.append(f"        - {part}")
        lines.append("")
    return "\n".join(lines) + "\n"

def append_to_quarterly_file(
    updates_root: str,
    year: str,
    quarter_filename: str,
    source: str,
    item_md: str,
) -> None:
    q_path = Path(updates_root) / year / quarter_filename
    if not q_path.exists():
        raise FileNotFoundError(f"분기 파일 없음: {q_path}")

    content = q_path.read_text(encoding="utf-8")
    # source 섹션 찾아서 그 아래에 삽입
    pattern = rf"(### {re.escape(source)}[^\n]*\n)"
    match = re.search(pattern, content)
    if match:
        insert_pos = match.end()
        content = content[:insert_pos] + "\n" + item_md + content[insert_pos:]
    else:
        # source 섹션 없으면 파일 끝에 추가
        content += f"\n### {source}\n\n{item_md}"

    q_path.write_text(content, encoding="utf-8")
```

**Step 4-6: `src/main.py` 라우트 추가**

```python
from src.summarize import call_claude, call_claude_with_file
from src.drd import build_item_markdown, append_to_quarterly_file
from src.config import QUALITY_UPDATES_PATH
import subprocess, os

class SummarizeRequest(BaseModel):
    text: str | None = None
    file_id: str | None = None
    source: str
    category: str

class DrdSaveRequest(BaseModel):
    title: str
    url: str
    date: str          # "2026-03-08"
    source: str
    year: str          # "2026"
    quarter_filename: str   # "2026-01-01_to_2026-03-31.md"
    summary: str

@app.post("/summarize")
async def summarize(req: SummarizeRequest):
    if req.file_id:
        result = await call_claude_with_file(req.file_id, req.source, req.category)
    else:
        result = await call_claude(req.text or "", req.source, req.category)
    return result

@app.post("/drd/save")
async def drd_save(req: DrdSaveRequest):
    item_md = build_item_markdown(req.date, req.title, req.url, req.summary)
    append_to_quarterly_file(
        QUALITY_UPDATES_PATH,
        req.year,
        req.quarter_filename,
        req.source,
        item_md,
    )
    # index 재빌드 트리거 (웹 컨테이너에서 실행)
    # 실제 환경에서는 웹 서비스 API 호출로 대체 가능
    return {"ok": True}
```

**Step 4-7: 테스트 통과 확인**

```bash
uv run pytest tests/ -v
```
Expected: 전체 `PASSED`

**Step 4-8: 커밋**

```bash
git add apps/document-ingestor/src/ apps/document-ingestor/tests/
git commit -m "feat(document-ingestor): 요약 생성 + DRD 저장 엔드포인트"
```

---

## Task 5: Docker Compose 서비스 추가

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.example`

**Step 5-1: `docker-compose.yml` 서비스 추가**

기존 `services:` 블록에 추가:
```yaml
  document-ingestor:
    build: ./apps/document-ingestor
    restart: unless-stopped
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOTENBERG_URL=http://gotenberg:3000
      - QUALITY_UPDATES_PATH=/workspace/quality-updates
    volumes:
      - ${QUALITY_UPDATES_HOST_PATH:-../quality-updates}:/workspace/quality-updates
    ports: []  # 내부망 전용, traefik을 통해 노출 안 함
    networks:
      - internal

  gotenberg:
    image: gotenberg/gotenberg:8
    restart: unless-stopped
    networks:
      - internal
```

**Step 5-2: `.env.example` 업데이트**

```dotenv
# document-ingestor
ANTHROPIC_API_KEY=your_anthropic_api_key_here
QUALITY_UPDATES_HOST_PATH=../quality-updates
```

**Step 5-3: `docker-compose.prod.yml` 이미지 항목 추가**

```yaml
  document-ingestor:
    image: ${GHCR_IMAGE_PREFIX}/audit-quality-document-ingestor:${IMAGE_TAG:-latest}
    build: ~
```

**Step 5-4: 커밋**

```bash
git add docker-compose.yml docker-compose.prod.yml .env.example
git commit -m "feat(docker): document-ingestor + gotenberg 서비스 추가"
```

---

## Task 6: Next.js BFF API 라우트

**Files:**
- Create: `apps/web/src/app/api/web/ingest/url/route.ts`
- Create: `apps/web/src/app/api/web/ingest/file/route.ts`
- Create: `apps/web/src/app/api/web/ingest/summarize/route.ts`
- Create: `apps/web/src/app/api/web/ingest/drd/route.ts`
- Create: `apps/web/src/lib/ingestor-client.ts`

**배경:**
- 인증은 Keycloak JWT에서 `roles` 배열 확인 (`admin` 역할 필요)
- 역할 확인 패턴: `apps/web/src/auth.ts` 참고 — `session.user.roles` 배열
- `DOCUMENT_INGESTOR_URL` 환경변수로 FastAPI URL 지정

**Step 6-1: `src/lib/ingestor-client.ts` 작성**

```typescript
const BASE = process.env.DOCUMENT_INGESTOR_URL ?? "http://document-ingestor:8010";

export async function ingestUrl(url: string): Promise<{ text: string; error?: string }> {
  const res = await fetch(`${BASE}/ingest/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return res.json();
}

export async function ingestFile(
  file: File
): Promise<{ file_id: string; type: string } | { error: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${BASE}/ingest/file`, { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: (err as { detail?: string }).detail ?? "파일 처리 실패" };
  }
  return res.json();
}

export async function summarize(payload: {
  text?: string;
  file_id?: string;
  source: string;
  category: string;
}): Promise<{ title: string; summary: string }> {
  const res = await fetch(`${BASE}/summarize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function drdSave(payload: {
  title: string;
  url: string;
  date: string;
  source: string;
  year: string;
  quarter_filename: string;
  summary: string;
}): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/drd/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}
```

**Step 6-2: admin 역할 확인 헬퍼 작성**

`apps/web/src/lib/ingestor-client.ts` 상단에 추가하지 말고, 각 route.ts에서 직접 확인:

```typescript
// 각 route.ts에서 사용할 패턴
import { auth } from "@/auth";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
```

**Step 6-3: `api/web/ingest/url/route.ts` 작성**

```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { ingestUrl } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { url } = await req.json() as { url: string };
  const result = await ingestUrl(url);
  return NextResponse.json(result);
}
```

**Step 6-4: 나머지 라우트 3개 작성**

같은 패턴으로:

`api/web/ingest/file/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { ingestFile } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const file = form.get("file") as File;
  if (!file) return NextResponse.json({ error: "파일 없음" }, { status: 400 });
  const result = await ingestFile(file);
  return NextResponse.json(result);
}
```

`api/web/ingest/summarize/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { summarize } from "@/lib/ingestor-client";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const result = await summarize(body);
  return NextResponse.json(result);
}
```

`api/web/ingest/drd/route.ts`:
```typescript
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { drdSave } from "@/lib/ingestor-client";
import { revalidatePath } from "next/cache";

export async function POST(req: NextRequest) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json();
  const result = await drdSave(body);
  if (result.ok) {
    revalidatePath("/updates");
  }
  return NextResponse.json(result);
}
```

**Step 6-5: `apps/web/.env.example` 업데이트**

```dotenv
# document-ingestor BFF
DOCUMENT_INGESTOR_URL=http://document-ingestor:8010
```

**Step 6-6: 커밋**

```bash
git add apps/web/src/app/api/web/ingest/ apps/web/src/lib/ingestor-client.ts
git commit -m "feat(web): ingest BFF API 라우트 (admin 인증)"
```

---

## Task 7: 어드민 UI 페이지

**Files:**
- Create: `apps/web/src/app/admin/ingest/page.tsx`
- Create: `apps/web/src/app/admin/ingest/IngestClient.tsx`
- Create: `apps/web/src/app/admin/layout.tsx`

**Step 7-1: admin layout (서버 컴포넌트, 역할 확인)**

`apps/web/src/app/admin/layout.tsx`:
```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const roles = (session?.user as { roles?: string[] })?.roles ?? [];
  if (!roles.includes("admin")) redirect("/");
  return <>{children}</>;
}
```

**Step 7-2: 페이지 서버 컴포넌트**

`apps/web/src/app/admin/ingest/page.tsx`:
```tsx
import { IngestClient } from "./IngestClient";

export default function IngestPage() {
  return (
    <div className="flex-1 min-w-0 flex justify-center">
      <div className="w-full max-w-2xl px-6 py-8">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          규제 업데이트 입수
        </h1>
        <IngestClient />
      </div>
    </div>
  );
}
```

**Step 7-3: `IngestClient.tsx` 작성**

```tsx
"use client";
import { useState } from "react";

const SOURCES = ["금융감독원", "금융위원회", "공인회계사회", "회계기준원"];
const CATEGORIES = ["보도자료", "공시", "규정·예규", "기타"];

// 현재 분기 filename 계산 헬퍼
function currentQuarterFilename(): { year: string; filename: string } {
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

export function IngestClient() {
  const [source, setSource] = useState(SOURCES[0]);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [url, setUrl] = useState("");
  const [extractedText, setExtractedText] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [status, setStatus] = useState<"idle" | "fetching" | "summarizing" | "saving" | "done">("idle");
  const [error, setError] = useState("");

  async function handleFetch() {
    setStatus("fetching"); setError("");
    try {
      const res = await fetch("/api/web/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json() as { text?: string; error?: string };
      if (data.error && !data.text) throw new Error(data.error);
      setExtractedText(data.text ?? "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("fetching"); setError("");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/web/ingest/file", { method: "POST", body: form });
      const data = await res.json() as { file_id?: string; error?: string };
      if (data.error) throw new Error(data.error);
      setFileId(data.file_id ?? null);
      setExtractedText("[PDF/HWP 파일 업로드 완료 — Claude가 직접 읽음]");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSummarize() {
    setStatus("summarizing"); setError("");
    try {
      const payload = fileId
        ? { file_id: fileId, source, category }
        : { text: extractedText, source, category };
      const res = await fetch("/api/web/ingest/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { title: string; summary: string };
      setTitle(data.title);
      setSummary(data.summary);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStatus("idle");
    }
  }

  async function handleSave() {
    setStatus("saving"); setError("");
    const { year, filename } = currentQuarterFilename();
    try {
      const res = await fetch("/api/web/ingest/drd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, url, summary, source,
          date: new Date().toISOString().slice(0, 10),
          year,
          quarter_filename: filename,
        }),
      });
      const data = await res.json() as { ok: boolean };
      if (data.ok) setStatus("done");
      else throw new Error("저장 실패");
    } catch (e) {
      setError((e as Error).message);
      setStatus("idle");
    }
  }

  if (status === "done") return (
    <div className="text-green-600 font-medium py-8 text-center">
      저장 완료. <button className="underline" onClick={() => { setStatus("idle"); setUrl(""); setExtractedText(""); setTitle(""); setSummary(""); setFileId(null); }}>새 항목 입력</button>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 기관·분류 */}
      <div className="flex gap-4">
        <select value={source} onChange={e => setSource(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          {SOURCES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={category} onChange={e => setCategory(e.target.value)}
          className="border rounded px-3 py-2 text-sm">
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
      </div>

      {/* URL */}
      <div className="flex gap-2">
        <input
          type="url" value={url} onChange={e => setUrl(e.target.value)}
          placeholder="https://fss.or.kr/..."
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <button onClick={handleFetch} disabled={!url || status !== "idle"}
          className="px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">
          {status === "fetching" ? "가져오는 중..." : "내용 가져오기"}
        </button>
      </div>

      {/* 파일 업로드 */}
      <div>
        <label className="text-sm text-gray-500">또는 PDF/HWP 파일</label>
        <input type="file" accept=".pdf,.hwp,.hwpx" onChange={handleFileUpload}
          className="ml-3 text-sm" />
      </div>

      {/* 추출 본문 */}
      {extractedText && (
        <div>
          <label className="block text-sm font-medium mb-1">추출된 본문 (편집 가능)</label>
          <textarea value={extractedText} onChange={e => setExtractedText(e.target.value)}
            rows={8} className="w-full border rounded px-3 py-2 text-sm font-mono" />
          <button onClick={handleSummarize} disabled={status !== "idle"}
            className="mt-2 px-4 py-2 bg-indigo-600 text-white rounded text-sm disabled:opacity-50">
            {status === "summarizing" ? "요약 중..." : "요약 생성"}
          </button>
        </div>
      )}

      {/* 요약 결과 */}
      {title && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">제목</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">요약 (편집 가능)</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)}
              rows={5} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <button onClick={handleSave} disabled={status !== "idle"}
            className="px-6 py-2 bg-green-600 text-white rounded font-medium disabled:opacity-50">
            {status === "saving" ? "저장 중..." : "DRD에 저장"}
          </button>
        </div>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}
    </div>
  );
}
```

**Step 7-4: 빌드 확인**

```bash
cd apps/web
npm run build 2>&1 | tail -20
```
Expected: 오류 없음

**Step 7-5: 커밋**

```bash
git add apps/web/src/app/admin/
git commit -m "feat(web): /admin/ingest 어드민 UI (URL/파일 입수 → 요약 → DRD 저장)"
```

---

## 완료 기준 확인

- `uv run pytest apps/document-ingestor/tests/ -v` → 전체 PASSED
- `npm run build` (apps/web) → 오류 없음
- `docker compose up document-ingestor gotenberg` → 컨테이너 정상 기동
- `/admin/ingest` 페이지 접근 시 admin 역할 없으면 리다이렉트
- URL 입력 → 본문 추출 → 요약 생성 → 저장 → `/updates` 카드 즉시 반영
