from fastapi import FastAPI
from pydantic import BaseModel
import src.ingest_url as _ingest_url_mod

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
