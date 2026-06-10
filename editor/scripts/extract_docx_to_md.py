"""Extract .docx paragraphs to Markdown (heading styles + fenced code for trees)."""
from __future__ import annotations

import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def para_style(p: ET.Element) -> str | None:
    p_pr = p.find("w:pPr", NS)
    if p_pr is None:
        return None
    ps = p_pr.find("w:pStyle", NS)
    if ps is None:
        return None
    return ps.get(W + "val")


def para_text(p: ET.Element) -> str:
    parts: list[str] = []
    for node in p.iter():
        tag = node.tag.split("}")[-1]
        if tag == "t" and node.text:
            parts.append(node.text)
        elif tag == "tab":
            parts.append("\t")
        elif tag == "br":
            parts.append("\n")
        if tag == "t" and node.tail:
            parts.append(node.tail)
    return "".join(parts).rstrip()


def is_tree_block(text: str) -> bool:
    s = text.strip()
    return ("├" in s or "└" in s or "│" in s) and s.count("\n") >= 2


def is_ascii_table_block(text: str) -> bool:
    return "┌" in text or ("─" * 10 in text and "│" in text)


def heading_level(style: str | None) -> int:
    if not style:
        return 0
    m = re.match(r"(?i)heading(\d+)", style)
    if m:
        return min(6, int(m.group(1)))
    if style.lower() in ("title", "titolo"):
        return 1
    return 0


def table_rows(tbl: ET.Element) -> list[list[str]]:
    rows: list[list[str]] = []
    for tr in tbl.findall("w:tr", NS):
        cells: list[str] = []
        for tc in tr.findall("w:tc", NS):
            parts = [para_text(p) for p in tc.findall(".//w:p", NS)]
            cell = " ".join(p.strip() for p in parts if p.strip()).replace("\n", " ")
            cells.append(cell)
        if any(cells):
            rows.append(cells)
    return rows


def table_to_markdown(rows: list[list[str]]) -> list[str]:
    if not rows:
        return []
    width = max(len(r) for r in rows)
    norm = [r + [""] * (width - len(r)) for r in rows]
    esc = lambda s: s.replace("|", "\\|")
    header = norm[0]
    sep = ["---"] * width
    body_rows = norm[1:] if len(norm) > 1 else []
    out = [
        "| " + " | ".join(esc(c) for c in header) + " |",
        "| " + " | ".join(sep) + " |",
    ]
    for row in body_rows:
        out.append("| " + " | ".join(esc(c) for c in row) + " |")
    return out


def emit_paragraph(lines: list[str], code_buf: list[str], p: ET.Element) -> list[str]:
    text = para_text(p)
    if not text.strip():
        return code_buf
    if is_tree_block(text) or is_ascii_table_block(text):
        code_buf.extend(text.splitlines())
        return code_buf
    if code_buf:
        lines.append("```text")
        lines.extend(code_buf)
        lines.append("```")
        lines.append("")
        code_buf = []
    lvl = heading_level(para_style(p))
    if lvl:
        lines.append("#" * (lvl + 1) + " " + text.strip())
        lines.append("")
        return code_buf
    t = text.strip()
    if t.startswith("•"):
        lines.append("- " + t.lstrip("•").strip())
    else:
        lines.append(t)
    lines.append("")
    return code_buf


def convert(docx_path: Path, out_path: Path, title: str, source_name: str) -> None:
    root = ET.fromstring(zipfile.ZipFile(docx_path).read("word/document.xml"))
    body = root.find("w:body", NS)
    if body is None:
        raise RuntimeError("document.xml has no body")

    lines: list[str] = [
        f"# {title}",
        "",
        f"> Estratto da `{source_name}` (cartella `Desktop/New_UI_artCade`).",
        "",
    ]
    code_buf: list[str] = []

    for child in list(body):
        tag = child.tag.split("}")[-1]
        if tag == "p":
            code_buf = emit_paragraph(lines, code_buf, child)
        elif tag == "tbl":
            if code_buf:
                lines.append("```text")
                lines.extend(code_buf)
                lines.append("```")
                lines.append("")
                code_buf = []
            md_table = table_to_markdown(table_rows(child))
            if md_table:
                lines.extend(md_table)
                lines.append("")

    if code_buf:
        lines.append("```text")
        lines.extend(code_buf)
        lines.append("```")
        lines.append("")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = "\n".join(lines).rstrip() + "\n"
    # Mockup docx used "PixelForge 2D" as a graphic placeholder — product name is ArtCade Studio.
    text = text.replace("PixelForge 2D", "ArtCade Studio")
    text = text.replace("PixelForge", "ArtCade Studio")
    out_path.write_text(text, encoding="utf-8")
    print(f"wrote {out_path} ({len(lines)} lines)")


def main() -> None:
    # The docs/new-ui/ markdown pack was retired (superseded by LOGIC_BOARD_UX_CHARTER.md
    # and LOGIC_BOARD_SPEC.md). Do not regenerate obsolete specs into the repo.
    print(
        "docs/new-ui/*.md pack retired. Canonical Logic Board UI docs: "
        "docs/LOGIC_BOARD_UX_CHARTER.md, docs/LOGIC_BOARD_SPEC.md",
        file=sys.stderr,
    )
    raise SystemExit(1)


if __name__ == "__main__":
    main()
