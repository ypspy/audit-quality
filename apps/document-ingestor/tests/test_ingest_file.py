from unittest.mock import AsyncMock, patch
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
