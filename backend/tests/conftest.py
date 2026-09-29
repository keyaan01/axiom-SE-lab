"""Pytest fixtures for Axiom's API + scheduler tests.

Everything here runs against a THROWAWAY database: ``AXIOM_DATA_DIR`` is pointed
at a fresh temp dir *before* the ``app`` package is imported (``app.config`` /
``app.db`` read it at import time), so the real ``data/axiom.db`` is never
touched. No test in this suite makes a real Gemini/OpenAI/Anthropic call.

Run from the project root:
    backend/.venv/Scripts/python.exe -m pytest backend/tests -v
"""
import os
import sys
import tempfile
import uuid
from pathlib import Path

# 1) Isolated data dir FIRST — before importing app.config/app.db, which read
#    AXIOM_DATA_DIR at import time. `setdefault` lets a caller override it, but
#    it is never the user's real data/ folder.
os.environ.setdefault("AXIOM_DATA_DIR", tempfile.mkdtemp(prefix="axiom_tests_"))

# 2) Put backend/ on sys.path so `import app.*` resolves (mirrors how uvicorn is
#    launched with `--app-dir backend`).
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import pytest
from fastapi.testclient import TestClient

from app import config, db
from app.main import app

# Make sure the throwaway schema exists for tests that talk to the DB directly
# (the scheduler tests) as well as for the HTTP tests.
config.ensure_dirs()
db.init_db()


def unique_email(prefix: str = "user") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}@axiom.test"


@pytest.fixture
def client():
    """A fresh TestClient with an empty cookie jar. Cookies persist across
    requests on one client, so a signup within a test authenticates that
    client's later requests."""
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_client(client):
    """A TestClient already signed up (and thus logged in) as a brand-new,
    unique account. Its email is stashed on ``client.axiom_email``."""
    email = unique_email("auth")
    r = client.post(
        "/api/auth/signup",
        json={"name": "Test User", "email": email, "password": "pw123456"},
    )
    assert r.status_code == 200, r.text
    client.axiom_email = email
    return client
