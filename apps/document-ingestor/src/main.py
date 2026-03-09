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
