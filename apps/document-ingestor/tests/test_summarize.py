from unittest.mock import AsyncMock, patch
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
