#!/usr/bin/env python3
"""Generate PDF from command-multi-tenant-subscription-outline.md"""

from pathlib import Path
import re
import sys

from fpdf import FPDF

ROOT = Path(__file__).resolve().parents[1]
MD_PATH = ROOT / "docs" / "architecture" / "command-multi-tenant-subscription-outline.md"
PDF_PATH = ROOT / "docs" / "architecture" / "command-multi-tenant-subscription-outline.pdf"


class OutlinePDF(FPDF):
    def header(self):
        if self.page_no() > 1:
            self.set_font("Helvetica", "I", 8)
            self.set_text_color(100, 100, 100)
            self.cell(0, 8, "Circadia Command - Multi-Tenant Project Outline", align="R", new_x="LMARGIN", new_y="NEXT")
            self.ln(2)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(100, 100, 100)
        self.cell(0, 8, f"Page {self.page_no()}", align="C")


def sanitize(text: str) -> str:
    replacements = {
        "\u2014": "-",
        "\u2013": "-",
        "\u2192": "->",
        "\u2190": "<-",
        "\u2022": "-",
        "\u00b7": "-",
        "\u2018": "'",
        "\u2019": "'",
        "\u201c": '"',
        "\u201d": '"',
    }
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    text = re.sub(r"\*\*(.+?)\*\*", r"\1", text)
    text = re.sub(r"`(.+?)`", r"\1", text)
    return text.encode("latin-1", "replace").decode("latin-1")


def write_line(pdf: OutlinePDF, text: str, size: int = 10, style: str = "", color=(20, 20, 20), lh: float = 5.5):
    pdf.set_font("Helvetica", style, size)
    pdf.set_text_color(*color)
    pdf.multi_cell(0, lh, sanitize(text))
    pdf.ln(1)


def render_markdown(pdf: OutlinePDF, md: str) -> None:
    in_code = False
    for raw in md.splitlines():
        line = raw.rstrip()

        if line.strip().startswith("```"):
            in_code = not in_code
            continue

        if in_code:
            write_line(pdf, "  " + line, size=8, style="", color=(60, 60, 60), lh=4.5)
            continue

        if not line.strip():
            pdf.ln(2)
            continue

        if line.startswith("# "):
            pdf.ln(4)
            write_line(pdf, line[2:], size=18, style="B", lh=8)
            pdf.ln(2)
        elif line.startswith("## "):
            pdf.ln(3)
            write_line(pdf, line[3:], size=14, style="B", lh=7)
            pdf.ln(1)
        elif line.startswith("### "):
            pdf.ln(2)
            write_line(pdf, line[4:], size=11, style="B", lh=6)
        elif line.startswith("---"):
            pdf.ln(2)
            pdf.set_draw_color(200, 200, 200)
            pdf.line(pdf.l_margin, pdf.get_y(), pdf.w - pdf.r_margin, pdf.get_y())
            pdf.ln(4)
        elif line.startswith("|") and "---" not in line:
            cells = [c.strip() for c in line.strip("|").split("|")]
            write_line(pdf, "  |  ".join(cells), size=9, lh=5)
        elif line.startswith("- "):
            write_line(pdf, "  - " + line[2:], size=10, lh=5.5)
        else:
            write_line(pdf, line, size=10, lh=5.5)


def main() -> int:
    if not MD_PATH.exists():
        print(f"Missing source: {MD_PATH}", file=sys.stderr)
        return 1

    md = MD_PATH.read_text(encoding="utf-8")
    pdf = OutlinePDF()
    pdf.set_auto_page_break(auto=True, margin=18)
    pdf.set_margins(18, 18, 18)
    pdf.add_page()
    render_markdown(pdf, md)
    PDF_PATH.parent.mkdir(parents=True, exist_ok=True)
    pdf.output(str(PDF_PATH))
    print(f"Wrote {PDF_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
