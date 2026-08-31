"""Filesystem helpers.

All on-disk files are named by UUID (never by user-supplied names) to avoid
shell/compiler crashes on spaces and special characters. Original display names
are kept only in the database.
"""
import uuid
from pathlib import Path
from .. import config


def new_uuid() -> str:
    return uuid.uuid4().hex


def course_upload_dir(course_id: int) -> Path:
    d = config.UPLOADS_DIR / str(course_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def course_notes_dir(course_id: int) -> Path:
    d = config.NOTES_DIR / str(course_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def course_thumbs_dir(course_id: int) -> Path:
    d = config.THUMBS_DIR / str(course_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def avatar_dir() -> Path:
    config.AVATARS_DIR.mkdir(parents=True, exist_ok=True)
    return config.AVATARS_DIR


def remove_course_files(course_id: int) -> None:
    """Best-effort removal of a course's on-disk files (uploads/notes/thumbs).

    DB rows are removed by cascade; this cleans the filesystem side. Never
    raises — deletion should succeed even if a folder is already gone.
    """
    import shutil
    for base in (config.UPLOADS_DIR, config.NOTES_DIR, config.THUMBS_DIR):
        d = base / str(course_id)
        if d.exists():
            shutil.rmtree(d, ignore_errors=True)
