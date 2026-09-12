"""LibreOffice (soffice) document-to-PDF conversion.

Mirrors latex.py's subprocess pattern: run the external binary, raise a clear,
user-visible error if it's missing/times out/fails, and locate the produced
file by its predictable name. LibreOffice is an external binary (like
Tectonic) — not a pip dependency; document install separately.
"""
import os
import shutil
import subprocess
from pathlib import Path
from .. import config


class OfficeError(Exception):
    """Raised when soffice is missing, times out, exits non-zero, or produces no PDF."""


def convert_to_pdf(src_path: Path, out_dir: Path, timeout: int = 180) -> Path:
    """Convert src_path (docx/pptx/etc.) to a PDF written into out_dir.

    LibreOffice names the output '<src stem>.pdf' inside out_dir. Returns the
    resulting Path. Raises OfficeError with a clear message on any failure.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    try:
        proc = subprocess.run(
            [config.SOFFICE_PATH, "--headless", "--convert-to", "pdf",
             "--outdir", str(out_dir), str(src_path)],
            capture_output=True, text=True, timeout=timeout,
        )
    except FileNotFoundError:
        raise OfficeError(
            f"LibreOffice ('{config.SOFFICE_PATH}') is not installed or not on PATH."
        )
    except subprocess.TimeoutExpired:
        raise OfficeError(f"LibreOffice conversion timed out after {timeout}s.")

    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise OfficeError(f"LibreOffice conversion failed: {detail or 'unknown error'}")

    out_pdf = out_dir / (src_path.stem + ".pdf")
    if not out_pdf.exists():
        raise OfficeError("LibreOffice reported success but produced no PDF.")
    return out_pdf


def office_available() -> tuple:
    """Best-effort check for the health endpoint: is soffice present? -> (ok, detail).

    This is a fast FILE-EXISTENCE check, NOT `soffice --version`: on Windows
    `soffice --version` reliably hangs/times out (it wants a GUI profile) even
    though the `--headless --convert-to pdf` path used by convert_to_pdf works
    fine — so probing the version wrongly reported the converter as down. An
    absolute LIBREOFFICE_PATH just has to exist on disk; a bare name (default
    "soffice") is resolved on PATH. Real conversion failures still surface
    visibly at upload time (a `failed` file card + the error)."""
    path = config.SOFFICE_PATH
    resolved = path if os.path.isabs(path) else shutil.which(path)
    if resolved and os.path.isfile(resolved):
        return True, f"installed ({resolved})"
    return False, f"'{path}' not found (set LIBREOFFICE_PATH to soffice.exe)"
