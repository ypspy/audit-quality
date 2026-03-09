import os, tempfile
from src.drd import build_item_markdown, append_to_quarterly_file

def test_build_item_markdown_with_summary():
    md = build_item_markdown(
        date="2026-03-08",
        title="IPO 법인 재무제표 심사 강화",
        url="https://fss.or.kr/example",
        summary="주요 내용 1 주요 내용 2",
    )
    assert "(26-03-08)" in md
    assert "[IPO 법인 재무제표 심사 강화]" in md
    assert "!!! note" in md

def test_build_item_markdown_without_summary():
    md = build_item_markdown(
        date="2026-03-08",
        title="제목만 있는 항목",
        url="https://fss.or.kr/example",
        summary="",
    )
    assert "!!! note" not in md

def test_append_to_quarterly_file():
    with tempfile.TemporaryDirectory() as tmpdir:
        year_dir = os.path.join(tmpdir, "2026")
        os.makedirs(year_dir)
        q_path = os.path.join(year_dir, "2026-01-01_to_2026-03-31.md")
        with open(q_path, "w", encoding="utf-8") as f:
            f.write("---\nperiod_label: 2026-Q1\n---\n\n### 금융감독원\n\n")

        append_to_quarterly_file(
            updates_root=tmpdir,
            year="2026",
            quarter_filename="2026-01-01_to_2026-03-31.md",
            source="금융감독원",
            item_md="- (26-03-08) [제목](https://example.com)\n",
        )

        content = open(q_path, encoding="utf-8").read()
        assert "제목" in content
