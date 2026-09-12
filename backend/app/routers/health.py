"""Health endpoint.

Surfaces the three things that can silently block the pipeline so the frontend
can show them plainly: the database opens, the Tectonic LaTeX compiler is
present, and the active AI provider has an API key configured. This never
raises — each check degrades to ok:false with a human-readable detail.
"""
import shutil
import subprocess
from fastapi import APIRouter
from .. import config, db
from ..services import ai, office

router = APIRouter()

_PROVIDER_LABELS = {
    "gemini": "Gemini",
    "openai": "OpenAI",
    "anthropic": "Anthropic",
    "custom": "Custom",
}


def _check_db() -> dict:
    try:
        conn = db.get_connection()
        try:
            conn.execute("SELECT 1;").fetchone()
        finally:
            conn.close()
        return {"ok": True, "detail": "connected"}
    except Exception as e:  # pragma: no cover - defensive
        return {"ok": False, "detail": f"{type(e).__name__}: {e}"}


def _check_tectonic() -> dict:
    path = shutil.which(config.TECTONIC_PATH)
    if not path:
        return {"ok": False, "detail": f"'{config.TECTONIC_PATH}' not found on PATH"}
    try:
        out = subprocess.run(
            [path, "--version"], capture_output=True, text=True, timeout=10
        )
        version = (out.stdout or out.stderr).strip().splitlines()[0] if (out.stdout or out.stderr) else "installed"
        return {"ok": True, "detail": version}
    except Exception as e:
        return {"ok": True, "detail": f"found at {path} (version check failed: {e})"}


def _check_ai() -> dict:
    # Reads the effective runtime key for the ACTIVE provider (user-set
    # override in Settings, else backend/.env) so a key the user stores at
    # runtime shows healthy without a restart (Build 5, Step 5; generalized
    # to any provider in the multi-provider build).
    label = _PROVIDER_LABELS.get(ai.current_provider(), "AI")
    if ai.current_key():
        return {"ok": True, "detail": f"{label} API key is set"}
    return {"ok": False, "detail": f"No API key set for {label} (add one in Settings)"}


def _check_office() -> dict:
    ok, detail = office.office_available()
    return {"ok": ok, "detail": detail}


@router.get("/health")
def health() -> dict:
    return {
        "db": _check_db(),
        "tectonic": _check_tectonic(),
        "ai_key": _check_ai(),
        "office": _check_office(),
    }
