"""LaTeX assembly and Tectonic compilation.

The backend owns a fixed preamble (this file). Gemini only ever produces the
*body* of a note; we sanitize it, wrap it in the preamble, compile with
Tectonic, and render a page-1 thumbnail. Compilation failures are captured with
a trimmed error log so they can be shown to the user (never swallowed).
"""
import shutil
import subprocess
from pathlib import Path
from .. import config
from . import storage

# Tectonic is XeTeX-based (UTF-8 native), so no inputenc/fontenc. This exact
# preamble is smoke-tested; Gemini must never emit the document class or
# package imports itself.
PREAMBLE = r"""\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{amsmath,amssymb}
\usepackage{graphicx}
\usepackage[most]{tcolorbox}
\usepackage{enumitem}
\usepackage{xcolor}
\usepackage{microtype}
\usepackage{hyperref}
\hypersetup{colorlinks=true,linkcolor=black,citecolor=black,urlcolor=blue,breaklinks=true}
\usepackage{parskip}
\setlength{\parindent}{0pt}
\sloppy
\setlength{\emergencystretch}{3em}
\definecolor{axiomaccent}{HTML}{2563EB}
\newtcolorbox{practice}[1][]{breakable,colback=blue!3,colframe=axiomaccent,fonttitle=\bfseries,coltitle=white,title=Practice,#1}
\newcommand{\notetitle}[1]{{\LARGE\bfseries #1}\par\vspace{0.4em}\textcolor{axiomaccent}{\hrule height 1.5pt}\vspace{1.2em}}
"""


class LatexError(RuntimeError):
    """Raised when Tectonic fails to produce a PDF; message holds the log tail."""


def _escape_title(s: str) -> str:
    """Escape LaTeX specials in the plain-text concept title we inject."""
    repl = {
        "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$",
        "#": r"\#", "_": r"\_", "{": r"\{", "}": r"\}",
        "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
    }
    return "".join(repl.get(c, c) for c in s)


def sanitize_body(body: str) -> str:
    """Strip anything preamble-like from the model output (defense in depth).

    The prompt already forbids these, but a stray code fence or package line
    would break compilation, so we remove them rather than trust the model.
    Line-based (no regex) to keep backslash handling unambiguous.
    """
    b = body.strip()
    if b.startswith("```"):
        b = b.split("\n", 1)[1] if "\n" in b else ""
    if b.rstrip().endswith("```"):
        b = b.rstrip()[:-3]

    out = []
    for line in b.splitlines():
        s = line.lstrip()
        if s.startswith(r"\documentclass") or s.startswith(r"\usepackage") or s.startswith(r"\title"):
            continue
        line = (line.replace(r"\begin{document}", "")
                    .replace(r"\end{document}", "")
                    .replace(r"\maketitle", ""))
        out.append(line)
    return "\n".join(out).strip()


def build_document(title: str, body: str) -> str:
    """Assemble the full .tex: locked preamble + title + sanitized body."""
    return (
        PREAMBLE
        + "\n" + r"\begin{document}" + "\n"
        + r"\notetitle{" + _escape_title(title) + "}\n\n"
        + body
        + "\n\n" + r"\end{document}" + "\n"
    )


def _trim_error(log: str, limit: int = 1800) -> str:
    """Pull the meaningful error lines out of a Tectonic/TeX log.

    Drops the benign 'Fontconfig error: Cannot load default config file' warning
    Tectonic prints on Windows — it does not affect compilation.
    """
    lines = log.splitlines()
    interesting = []
    for ln in lines:
        low = ln.lower()
        if "fontconfig" in low:
            continue
        if ln.lstrip().startswith("!") or "error:" in low or ln.startswith("l."):
            interesting.append(ln)
    text = "\n".join(interesting).strip() or log.strip()
    return text[-limit:]


def compile_to(tex_source: str, out_pdf_path: Path, timeout: int = 180) -> None:
    """Compile tex_source to out_pdf_path via Tectonic. Raises LatexError on failure."""
    work = config.WORK_DIR / storage.new_uuid()
    work.mkdir(parents=True, exist_ok=True)
    tex = work / "note.tex"
    tex.write_text(tex_source, encoding="utf-8")
    try:
        proc = subprocess.run(
            [config.TECTONIC_PATH, "--outdir", str(work), str(tex)],
            capture_output=True, text=True, timeout=timeout,
        )
        pdf = work / "note.pdf"
        if proc.returncode != 0 or not pdf.exists():
            raise LatexError(_trim_error((proc.stderr or "") + "\n" + (proc.stdout or "")))
        out_pdf_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(pdf), str(out_pdf_path))
    except subprocess.TimeoutExpired:
        raise LatexError(f"Tectonic timed out after {timeout}s.")
    finally:
        shutil.rmtree(work, ignore_errors=True)


def render_thumbnail(pdf_path: Path, out_png_path: Path, scale: float = 1.6) -> None:
    """Render page 1 of a PDF to a PNG thumbnail (best-effort)."""
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(pdf_path))
    try:
        out_png_path.parent.mkdir(parents=True, exist_ok=True)
        doc[0].render(scale=scale).to_pil().save(str(out_png_path))
    finally:
        doc.close()
