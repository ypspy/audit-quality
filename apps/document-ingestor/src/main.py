from fastapi import FastAPI, UploadFile, File, HTTPException
from pydantic import BaseModel
import src.ingest_url as _ingest_url_mod
import src.ingest_file as _ingest_file_mod

app = FastAPI(title="document-ingestor")

@app.get("/health")
def health():
    return {"ok": True}

class UrlRequest(BaseModel):
    url: str

@app.post("/ingest/url")
async def ingest_url(req: UrlRequest):
    try:
        text = await _ingest_url_mod.fetch_url_text(req.url)
        return {"text": text}
    except Exception as e:
        return {"text": "", "error": str(e)}

@app.post("/ingest/file")
async def ingest_file(file: UploadFile = File(...)):
    content = await file.read()
    name = file.filename or "doc"

    if name.endswith(".pdf"):
        file_id = await _ingest_file_mod.upload_pdf_to_anthropic(content, name)
        return {"file_id": file_id, "type": "pdf"}

    if name.endswith(".hwp") or name.endswith(".hwpx"):
        pdf_bytes = await _ingest_file_mod.convert_hwp_to_pdf(content, name)
        file_id = await _ingest_file_mod.upload_pdf_to_anthropic(pdf_bytes, name + ".pdf")
        return {"file_id": file_id, "type": "pdf"}

    raise HTTPException(status_code=400, detail=f"지원하지 않는 형식: {name}")

from pydantic import BaseModel as _BaseModel
import src.summarize as _summarize_mod
from src.drd import build_item_markdown, append_to_quarterly_file
from src.config import QUALITY_UPDATES_PATH

class SummarizeRequest(_BaseModel):
    text: str | None = None
    file_id: str | None = None
    source: str
    category: str

class DrdSaveRequest(_BaseModel):
    title: str
    url: str
    date: str
    source: str
    year: str
    quarter_filename: str
    summary: str

@app.post("/summarize")
async def summarize(req: SummarizeRequest):
    if req.file_id:
        result = await _summarize_mod.call_claude_with_file(req.file_id, req.source, req.category)
    else:
        result = await _summarize_mod.call_claude(req.text or "", req.source, req.category)
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
    return {"ok": True}
