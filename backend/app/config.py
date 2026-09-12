"""Central configuration: paths, environment, and runtime settings.

All filesystem paths are absolute and derived from this file's location so the
app runs identically no matter the current working directory. User-uploaded and
generated files live under DATA_DIR; the frontend is served from FRONTEND_DIR.
"""
from pathlib import Path
import os
from dotenv import load_dotenv

# .../Axiom/backend/app/config.py  ->  .../Axiom
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = PROJECT_ROOT / "backend"
FRONTEND_DIR = PROJECT_ROOT / "frontend"

# Load .env from the backend folder (if present) before reading env vars.
load_dotenv(BACKEND_DIR / ".env")

# Runtime data (gitignored). Never store originals under their raw filenames;
# everything on disk is keyed by UUID, display names live in the database.
# AXIOM_DATA_DIR lets tests point at a throwaway store, isolated from real data.
DATA_DIR = Path(os.environ.get("AXIOM_DATA_DIR") or (PROJECT_ROOT / "data"))
DB_PATH = DATA_DIR / "axiom.db"
UPLOADS_DIR = DATA_DIR / "uploads"   # original uploaded files, per course
NOTES_DIR = DATA_DIR / "notes"       # compiled note PDFs, per course
THUMBS_DIR = DATA_DIR / "thumbs"     # page-1 preview PNGs, per course
WORK_DIR = DATA_DIR / "work"         # transient LaTeX build dirs
AVATARS_DIR = DATA_DIR / "avatars"   # user profile avatar images (Build 5, Step 5)
CANVAS_DIR = DATA_DIR / "canvas"     # dropped canvas files (images/pdf/docx/pptx), per concept

# Secrets / external tools.
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
# Overridable so a rate-limited/retired model can be swapped without touching
# code. Free-tier quota is per-model, so switching models gives a fresh bucket.
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash").strip() or "gemini-3.5-flash"
TECTONIC_PATH = os.environ.get("TECTONIC_PATH", "tectonic").strip() or "tectonic"
# LibreOffice (soffice), used to convert dropped docx/pptx canvas files to PDF.
# External binary like Tectonic — not a pip dependency; install separately.
SOFFICE_PATH = os.environ.get("LIBREOFFICE_PATH", "soffice").strip() or "soffice"

# Optional env fallbacks for the other AI providers (Phase A2). Each is used
# only if no runtime override is stored in the settings table (see
# services/ai/__init__.py's current_key()/base_url()) — same pattern as
# GEMINI_API_KEY above. OPENAI_BASE_URL is the 'custom' provider's default
# OpenAI-compatible endpoint (OpenRouter/DeepSeek/Qwen/local/etc.) when the
# user hasn't set one from Settings.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "").strip()
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "").strip()
OPENAI_BASE_URL = os.environ.get("OPENAI_BASE_URL", "").strip()


def ensure_dirs() -> None:
    """Create the data directory tree if it does not exist yet."""
    for d in (DATA_DIR, UPLOADS_DIR, NOTES_DIR, THUMBS_DIR, WORK_DIR, AVATARS_DIR, CANVAS_DIR):
        d.mkdir(parents=True, exist_ok=True)
