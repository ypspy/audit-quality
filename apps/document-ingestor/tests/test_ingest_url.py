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
