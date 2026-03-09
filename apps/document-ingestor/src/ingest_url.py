from playwright.async_api import async_playwright
import re

async def fetch_url_text(url: str) -> str:
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox"])
        page = await browser.new_page()
        await page.goto(url, timeout=30000, wait_until="domcontentloaded")
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
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()
