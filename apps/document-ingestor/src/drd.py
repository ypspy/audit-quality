import os, re
from pathlib import Path

def build_item_markdown(date: str, title: str, url: str, summary: str) -> str:
    short_date = date[2:]  # "2026-03-08" → "26-03-08"
    lines = [f"- ({short_date}) [{title}]({url})"]
    if summary.strip():
        lines.append("")
        lines.append('    !!! note "주요 내용"')
        lines.append("")
        for part in summary.split(" | "):
            part = part.strip()
            if part:
                lines.append(f"        - {part}")
        lines.append("")
    return "\n".join(lines) + "\n"

def append_to_quarterly_file(
    updates_root: str,
    year: str,
    quarter_filename: str,
    source: str,
    item_md: str,
) -> None:
    q_path = Path(updates_root) / year / quarter_filename
    if not q_path.exists():
        raise FileNotFoundError(f"분기 파일 없음: {q_path}")

    content = q_path.read_text(encoding="utf-8")
    pattern = rf"(### {re.escape(source)}[^\n]*\n)"
    match = re.search(pattern, content)
    if match:
        insert_pos = match.end()
        content = content[:insert_pos] + "\n" + item_md + content[insert_pos:]
    else:
        content += f"\n### {source}\n\n{item_md}"

    q_path.write_text(content, encoding="utf-8")
