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
