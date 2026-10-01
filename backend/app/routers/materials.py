"""Study-material and past-question (PYQ) uploads.

Accepts Gemini-native formats (PDF, common images) directly, plus Office
documents (docx/pptx/doc/ppt) which are converted to PDF in the background via
LibreOffice (mirrors routers/canvas.py's proven docx/pptx-> PDF pipeline) so
extraction always sees a PDF/image, never an office file. Files are streamed to
disk under a UUID name (never the user's filename) with a size cap; the
display name and metadata live in the database.
"""
import os
import shutil
import threading
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from .. import config, db
from ..services import office, storage

router = APIRouter()

# Extension -> mime. Validation is by extension (reliable) rather than the
# browser-supplied content type. PDF/image are readable by the Gemini File API
# directly; office formats are converted to PDF before extraction ever sees
# them (see _convert_office_material below).
ALLOWED_EXT = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}
_OFFICE_EXT = {".doc", ".docx", ".ppt", ".pptx"}
MAX_BYTES = 50 * 1024 * 1024  # 50 MB per file

# Columns returned to the client (never expose disk_uuid / pdf_disk_uuid).
_PUBLIC_COLS = ("id, course_id, kind, display_name, mime_type, size_bytes, "
                "status, error_message, created_at")


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
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: PDF, PNG, JPG, WEBP, Word, PowerPoint.",
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

    is_office = ext in _OFFICE_EXT
    # image/pdf are usable immediately; office files need a background
    # conversion pass before extraction can see them as a PDF.
    status = "converting" if is_office else "ready"
    pdf_disk_uuid = disk_uuid if ext == ".pdf" else None

    conn = db.get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO materials (course_id, kind, display_name, disk_uuid, mime_type, "
            "size_bytes, status, pdf_disk_uuid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (course_id, kind, display_name, disk_uuid, ALLOWED_EXT[ext], size, status, pdf_disk_uuid),
        )
        conn.commit()
        material_id = cur.lastrowid
        row = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        result = dict(row)
    finally:
        conn.close()

    if is_office:
        threading.Thread(
            target=_convert_office_material, args=(material_id, course_id, dest), daemon=True
        ).start()

    return result


def _convert_office_material(material_id: int, course_id: int, src_path: Path) -> None:
    """Background: convert a docx/pptx/doc/ppt material to PDF.

    Runs in its own thread with its own DB connection (mirrors
    routers/canvas.py's _convert_canvas_file). On success the material's
    pdf_disk_uuid points at the converted PDF (mime stays the original office
    type; gather_course_attachments is the one place that decides which bytes
    extraction actually sees). On failure the row is marked 'failed' with a
    visible error_message — never fed to extraction.
    """
    work_dir = config.WORK_DIR / storage.new_uuid()
    try:
        converted = office.convert_to_pdf(src_path, work_dir)
        upload_dir = storage.course_upload_dir(course_id)
        pdf_uuid = storage.new_uuid() + ".pdf"
        pdf_dest = upload_dir / pdf_uuid
        shutil.move(str(converted), str(pdf_dest))

        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE materials SET status='ready', pdf_disk_uuid=?, error_message=NULL WHERE id=?",
                (pdf_uuid, material_id),
            )
            conn.commit()
        finally:
            conn.close()
    except office.OfficeError as e:
        _mark_material_failed(material_id, str(e))
    except Exception as e:
        _mark_material_failed(material_id, f"{type(e).__name__}: {e}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


def _mark_material_failed(material_id: int, message: str) -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE materials SET status='failed', error_message=? WHERE id=?",
            (message, material_id),
        )
        conn.commit()
    finally:
        conn.close()


@router.delete("/materials/{material_id}")
def delete_material(material_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT course_id, disk_uuid, pdf_disk_uuid FROM materials WHERE id = ?", (material_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Material not found")
        conn.execute("DELETE FROM materials WHERE id = ?", (material_id,))
        conn.commit()
    finally:
        conn.close()
    # Best-effort file removal (DB row is already gone).
    upload_dir = storage.course_upload_dir(row["course_id"])
    for uuid_name in (row["disk_uuid"], row["pdf_disk_uuid"]):
        if uuid_name:
            try:
                (upload_dir / uuid_name).unlink(missing_ok=True)
            except Exception:
                pass
    return {"ok": True}
