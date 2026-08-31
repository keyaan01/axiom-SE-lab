"""Study-material and past-question (PYQ) uploads.

This build accepts only Gemini-native formats: PDF and common images. Files are
streamed to disk under a UUID name (never the user's filename) with a size cap;
the display name and metadata live in the database. PPTX/DOCX conversion is a
later build.
"""
import os
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from .. import db
from ..services import storage

router = APIRouter()

# Extension -> mime. Validation is by extension (reliable) rather than the
# browser-supplied content type. These are all readable by the Gemini File API.
ALLOWED_EXT = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}
MAX_BYTES = 50 * 1024 * 1024  # 50 MB per file

# Columns returned to the client (never expose disk_uuid / gemini internals).
_PUBLIC_COLS = "id, course_id, kind, display_name, mime_type, size_bytes, created_at"


def _require_course(conn, course_id: int) -> None:
    if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
        raise HTTPException(status_code=404, detail="Course not found")


@router.get("/courses/{course_id}/materials")
def list_materials(course_id: int):
    conn = db.get_connection()
    try:
        _require_course(conn, course_id)
        rows = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM materials WHERE course_id = ? "
            "ORDER BY created_at ASC, id ASC",
            (course_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/courses/{course_id}/materials", status_code=201)
async def upload_material(
    course_id: int,
    kind: str = Form(...),
    file: UploadFile = File(...),
):
    if kind not in ("material", "pyq"):
        raise HTTPException(status_code=400, detail="kind must be 'material' or 'pyq'")

    display_name = os.path.basename(file.filename or "").strip() or "untitled"
    ext = Path(display_name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: PDF, PNG, JPG, WEBP.",
        )

    conn = db.get_connection()
    try:
        _require_course(conn, course_id)
    finally:
        conn.close()

    # Stream to disk under a UUID name, enforcing the size cap as we go so a huge
    # upload never fills memory or disk unchecked.
    disk_uuid = storage.new_uuid() + ext
    dest = storage.course_upload_dir(course_id) / disk_uuid
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
        cur = conn.execute(
            "INSERT INTO materials (course_id, kind, display_name, disk_uuid, mime_type, size_bytes) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (course_id, kind, display_name, disk_uuid, ALLOWED_EXT[ext], size),
        )
        conn.commit()
        row = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM materials WHERE id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.delete("/materials/{material_id}")
def delete_material(material_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT course_id, disk_uuid FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Material not found")
        conn.execute("DELETE FROM materials WHERE id = ?", (material_id,))
        conn.commit()
    finally:
        conn.close()
    # Best-effort file removal (DB row is already gone).
    try:
        (storage.course_upload_dir(row["course_id"]) / row["disk_uuid"]).unlink(missing_ok=True)
    except Exception:
        pass
    return {"ok": True}
