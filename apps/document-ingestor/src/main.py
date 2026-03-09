from fastapi import FastAPI

app = FastAPI(title="document-ingestor")

@app.get("/health")
def health():
    return {"ok": True}
