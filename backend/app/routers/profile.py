"""User profile: name/contact/study-preference fields + avatar upload/serve
(Build 5, Step 5).

Operates on the CURRENT logged-in account (Build 8 — multi-account:
`user["id"]` from `auth.require_auth`), not a hardcoded id. Study preferences
here (daily_capacity, study_off_days) feed the scheduler (see
routers/schedule.py's _profile_schedule_prefs()).
"""
import os
from pathlib import Path
from typing import Optional
import json as json_mod

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from .. import auth, db
from ..services import storage

router = APIRouter()

# Extension -> mime, mirroring materials.py's pattern (validation by extension).
ALLOWED_EXT = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
MAX_BYTES = 5 * 1024 * 1024  # 5 MB per avatar

# Columns returned to the client — avatar_disk_uuid is a raw filesystem detail
# and must NEVER be exposed; has_avatar/avatar_url are derived instead.
_PUBLIC_COLS = (
    "id, name, email, institution, program, academic_year, "
    "daily_capacity, study_off_days, created_at, updated_at"
)


def _parse_off_days(raw) -> list[int]:
    if not raw:
        return []
    try:
        data = json_mod.loads(raw)
        if isinstance(data, list):
            return [int(x) for x in data]
    except Exception:
        pass
    return []


def _row_to_profile(conn, row, profile_id: int) -> dict:
    d = dict(row)
    d["study_off_days"] = _parse_off_days(row["study_off_days"])
    avatar_row = conn.execute(
        "SELECT avatar_disk_uuid FROM user_profile WHERE id = ?", (profile_id,)
    ).fetchone()
    has_avatar = bool(avatar_row and avatar_row["avatar_disk_uuid"])
    d["has_avatar"] = has_avatar
    d["avatar_url"] = f"/api/profile/avatar?v={d['updated_at']}" if has_avatar else None
    return d


def _get_profile_dict(profile_id: int) -> dict:
    conn = db.get_connection()
    try:
        row = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM user_profile WHERE id = ?", (profile_id,)
        ).fetchone()
        if not row:
            # Should never happen (every account row is created by signup /
            # seeded at init_db()) but stay defensive.
            conn.execute(
                "INSERT OR IGNORE INTO user_profile (id, daily_capacity, study_off_days) "
                "VALUES (?, 2, '[]')",
                (profile_id,),
            )
            conn.commit()
            row = conn.execute(
                f"SELECT {_PUBLIC_COLS} FROM user_profile WHERE id = ?", (profile_id,)
            ).fetchone()
        return _row_to_profile(conn, row, profile_id)
    finally:
        conn.close()


@router.get("/profile")
def get_profile(user: dict = Depends(auth.require_auth)):
    return _get_profile_dict(user["id"])


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    email: Optional[str] = Field(default=None, max_length=320)
    institution: Optional[str] = Field(default=None, max_length=200)
    program: Optional[str] = Field(default=None, max_length=200)
    academic_year: Optional[str] = Field(default=None, max_length=200)
    daily_capacity: Optional[int] = None
    study_off_days: Optional[list[int]] = None


@router.put("/profile")
def update_profile(payload: ProfileUpdate, user: dict = Depends(auth.require_auth)):
    profile_id = user["id"]
    fields = {}
    for key in ("name", "email", "institution", "program", "academic_year"):
        val = getattr(payload, key)
        if val is not None:
            fields[key] = val

    if payload.daily_capacity is not None:
        cap = payload.daily_capacity
        if not isinstance(cap, int) or cap < 1 or cap > 8:
            raise HTTPException(status_code=422, detail="daily_capacity must be an integer 1..8")
        fields["daily_capacity"] = cap

    if payload.study_off_days is not None:
        for w in payload.study_off_days:
            if not isinstance(w, int) or w < 0 or w > 6:
                raise HTTPException(
                    status_code=422,
                    detail="study_off_days entries must be integers 0..6 (0=Mon..6=Sun)",
                )
        fields["study_off_days"] = json_mod.dumps(sorted(set(payload.study_off_days)))

    conn = db.get_connection()
    try:
        # Ensure the row exists before updating (defensive — every account
        # row is created by signup, but a fresh/odd DB state should never
        # 404 here).
        conn.execute(
            "INSERT OR IGNORE INTO user_profile (id, daily_capacity, study_off_days) "
            "VALUES (?, 2, '[]')",
            (profile_id,),
        )
        if fields:
            set_clause = ", ".join(f"{k} = ?" for k in fields)
            params = list(fields.values()) + [profile_id]
            conn.execute(
                f"UPDATE user_profile SET {set_clause}, updated_at = datetime('now') WHERE id = ?",
                params,
            )
        else:
            conn.execute(
                "UPDATE user_profile SET updated_at = datetime('now') WHERE id = ?",
                (profile_id,),
            )
        conn.commit()
        row = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM user_profile WHERE id = ?", (profile_id,)
        ).fetchone()
        return _row_to_profile(conn, row, profile_id)
    finally:
        conn.close()


@router.post("/profile/avatar")
async def upload_avatar(file: UploadFile = File(...), user: dict = Depends(auth.require_auth)):
    profile_id = user["id"]
    display_name = os.path.basename(file.filename or "").strip() or "avatar"
    ext = Path(display_name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: PNG, JPG, WEBP.",
        )

    disk_uuid = storage.new_uuid() + ext
    dest = storage.avatar_dir() / disk_uuid
    size = 0
    try:
        with open(dest, "wb") as out:
            while True:
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {MAX_BYTES // (1024 * 1024)} MB).",
                    )
                out.write(chunk)
    except HTTPException:
        Path(dest).unlink(missing_ok=True)
        raise
    except Exception as e:
        Path(dest).unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")
    finally:
        await file.close()

    conn = db.get_connection()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO user_profile (id, daily_capacity, study_off_days) "
            "VALUES (?, 2, '[]')",
            (profile_id,),
        )
        old_row = conn.execute(
            "SELECT avatar_disk_uuid FROM user_profile WHERE id = ?", (profile_id,)
        ).fetchone()
        old_uuid = old_row["avatar_disk_uuid"] if old_row else None

        conn.execute(
            "UPDATE user_profile SET avatar_disk_uuid = ?, updated_at = datetime('now') WHERE id = ?",
            (disk_uuid, profile_id),
        )
        conn.commit()
        updated_at = conn.execute(
            "SELECT updated_at FROM user_profile WHERE id = ?", (profile_id,)
        ).fetchone()["updated_at"]
    finally:
        conn.close()

    # Delete the OLD avatar file only after the new one is safely committed.
    if old_uuid:
        try:
            (storage.avatar_dir() / old_uuid).unlink(missing_ok=True)
        except Exception:
            pass

    return {"avatar_url": f"/api/profile/avatar?v={updated_at}"}


@router.get("/profile/avatar")
def get_avatar(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT avatar_disk_uuid FROM user_profile WHERE id = ?", (user["id"],)
        ).fetchone()
    finally:
        conn.close()
    if not row or not row["avatar_disk_uuid"]:
        raise HTTPException(status_code=404, detail="No avatar set.")
    disk_uuid = row["avatar_disk_uuid"]
    path = storage.avatar_dir() / disk_uuid
    if not path.exists():
        raise HTTPException(status_code=404, detail="Avatar missing on disk.")
    ext = Path(disk_uuid).suffix.lower()
    media_type = ALLOWED_EXT.get(ext, "application/octet-stream")
    return FileResponse(str(path), media_type=media_type)


@router.delete("/profile/avatar")
def delete_avatar(user: dict = Depends(auth.require_auth)):
    profile_id = user["id"]
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT avatar_disk_uuid FROM user_profile WHERE id = ?", (profile_id,)
        ).fetchone()
        old_uuid = row["avatar_disk_uuid"] if row else None
        conn.execute(
            "UPDATE user_profile SET avatar_disk_uuid = NULL, updated_at = datetime('now') WHERE id = ?",
            (profile_id,),
        )
        conn.commit()
    finally:
        conn.close()
    if old_uuid:
        try:
            (storage.avatar_dir() / old_uuid).unlink(missing_ok=True)
        except Exception:
            pass
    return {"ok": True}
