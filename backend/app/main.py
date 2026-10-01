"""Axiom FastAPI application entry point.

Responsibilities:
  * initialise the SQLite schema on startup,
  * expose the JSON API under /api,
  * serve the static frontend (Tailwind + vanilla JS) at /.

Feature routers are added here step by step; today only /api/health exists.
"""
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import config, db
from .auth import require_auth
from .routers import auth, health, semesters, courses, materials, generation, exams, schedule, settings, quiz, tasks, profile, prompts, canvas, ai, mindmap, analysis, revision_canvas


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure data dirs + schema exist before the first request.
    config.ensure_dirs()
    db.init_db()
    yield


app = FastAPI(title="Axiom", version="0.1.0", lifespan=lifespan)

# Permissive CORS for local development (single-origin in practice).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# JSON API lives under /api. auth + health are open (no session required —
# the login page itself needs /auth/*, and health checks must work pre-login);
# every other data router requires a valid session cookie (Build 6, Step 1).
app.include_router(auth.router, prefix="/api")
app.include_router(health.router, prefix="/api")

_auth_dep = [Depends(require_auth)]
app.include_router(semesters.router, prefix="/api", dependencies=_auth_dep)
app.include_router(courses.router, prefix="/api", dependencies=_auth_dep)
app.include_router(materials.router, prefix="/api", dependencies=_auth_dep)
app.include_router(generation.router, prefix="/api", dependencies=_auth_dep)
app.include_router(exams.router, prefix="/api", dependencies=_auth_dep)
app.include_router(schedule.router, prefix="/api", dependencies=_auth_dep)
app.include_router(settings.router, prefix="/api", dependencies=_auth_dep)
app.include_router(quiz.router, prefix="/api", dependencies=_auth_dep)
app.include_router(tasks.router, prefix="/api", dependencies=_auth_dep)
app.include_router(profile.router, prefix="/api", dependencies=_auth_dep)
app.include_router(prompts.router, prefix="/api", dependencies=_auth_dep)
app.include_router(canvas.router, prefix="/api", dependencies=_auth_dep)
app.include_router(ai.router, prefix="/api", dependencies=_auth_dep)
app.include_router(mindmap.router, prefix="/api", dependencies=_auth_dep)
app.include_router(analysis.router, prefix="/api", dependencies=_auth_dep)
app.include_router(revision_canvas.router, prefix="/api", dependencies=_auth_dep)

# Serve the frontend last so it doesn't shadow /api routes. html=True makes
# "/" resolve to index.html.
app.mount("/", StaticFiles(directory=str(config.FRONTEND_DIR), html=True), name="frontend")
