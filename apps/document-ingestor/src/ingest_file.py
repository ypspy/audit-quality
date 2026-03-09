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
