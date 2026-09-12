"""Canvas files + layout for the infinite-canvas feature (Build 9, Phase 1).

A "lesson" is keyed by concept_id. Canvas files are separate from course
materials — dropped study aids, NEVER fed to AI extraction/note-gen. Mirrors
materials.py's streaming upload and generation.py's FileResponse serving.
"""
import json
import os
import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

from .. import config, db
from ..services import latex, office, storage

router = APIRouter()

ALLOWED_EXT = {
    ".pdf":  ("pdf",  "application/pdf"),
    ".png":  ("image", "image/png"),
    ".jpg":  ("image", "image/jpeg"),
    ".jpeg": ("image", "image/jpeg"),
    ".webp": ("image", "image/webp"),
    ".docx": ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ".pptx": ("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
}
MAX_BYTES = 50 * 1024 * 1024
_MAX_LAYOUT_BYTES = 2_000_000

_PUBLIC_COLS = ("id, concept_id, kind, display_name, mime_type, size_bytes, "
                "status, error_message, created_at")


class CanvasLayoutIn(BaseModel):
    data: dict


class RenameIn(BaseModel):
    display_name: str


class CanvasAnnotationsIn(BaseModel):
    data: list


def _require_concept(conn, concept_id: int) -> None:
    if not conn.execute("SELECT 1 FROM concepts WHERE id = ?", (concept_id,)).fetchone():
        raise HTTPException(status_code=404, detail="Concept not found")


def _file_row(conn, file_id: int):
    row = conn.execute("SELECT * FROM canvas_files WHERE id = ?", (file_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Canvas file not found")
    return row


@router.get("/concepts/{concept_id}/canvas")
def get_canvas(concept_id: int):
    conn = db.get_connection()
    try:
        _require_concept(conn, concept_id)
        layout_row = conn.execute(
            "SELECT data_json FROM canvas_layout WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        layout = json.loads(layout_row["data_json"]) if layout_row else None
        files = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM canvas_files WHERE concept_id = ? "
            "ORDER BY created_at ASC, id ASC",
            (concept_id,),
        ).fetchall()
        return {"layout": layout, "files": [dict(r) for r in files]}
    finally:
        conn.close()


@router.put("/concepts/{concept_id}/canvas")
def put_canvas_layout(concept_id: int, payload: CanvasLayoutIn):
    blob = json.dumps(payload.data)
    if len(blob.encode("utf-8")) > _MAX_LAYOUT_BYTES:
        raise HTTPException(status_code=413, detail="Canvas layout payload too large.")
    conn = db.get_connection()
    try:
        _require_concept(conn, concept_id)
        conn.execute(
            "INSERT INTO canvas_layout (concept_id, data_json, updated_at) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(concept_id) DO UPDATE SET "
            "data_json = excluded.data_json, updated_at = excluded.updated_at",
            (concept_id, blob),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _mark_failed(file_id: int, message: str) -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE canvas_files SET status='failed', error_message=? WHERE id=?",
            (message, file_id),
        )
        conn.commit()
    finally:
        conn.close()


def _convert_canvas_file(file_id: int, concept_id: int, src_path: Path) -> None:
    """Background: convert a docx/pptx canvas file to PDF + thumbnail.

    Runs in its own thread with its own DB connection (mirrors the pattern
    used by run_generate_job / run_quiz_job for background work).
    """
    work_dir = config.WORK_DIR / storage.new_uuid()
    try:
        converted = office.convert_to_pdf(src_path, work_dir)
        canvas_dir = storage.concept_canvas_dir(concept_id)
        pdf_uuid = storage.new_uuid() + ".pdf"
        pdf_dest = canvas_dir / pdf_uuid
        shutil.move(str(converted), str(pdf_dest))
        thumb_uuid = storage.new_uuid() + ".png"
        thumb_dest = canvas_dir / thumb_uuid
        latex.render_thumbnail(pdf_dest, thumb_dest)

        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE canvas_files SET status='ready', pdf_disk_uuid=?, "
                "thumb_disk_uuid=?, error_message=NULL WHERE id=?",
                (pdf_uuid, thumb_uuid, file_id),
            )
            conn.commit()
        finally:
            conn.close()
    except office.OfficeError as e:
        _mark_failed(file_id, str(e))
    except Exception as e:
        _mark_failed(file_id, f"{type(e).__name__}: {e}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


@router.post("/concepts/{concept_id}/canvas/files", status_code=201)
async def upload_canvas_file(concept_id: int, file: UploadFile = File(...)):
    display_name = os.path.basename(file.filename or "").strip() or "untitled"
    ext = Path(display_name).suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: PDF, PNG, JPG, WEBP, DOCX, PPTX.",
        )
    kind, mime_type = ALLOWED_EXT[ext]

    conn = db.get_connection()
    try:
        _require_concept(conn, concept_id)
    finally:
        conn.close()

    disk_uuid = storage.new_uuid() + ext
    canvas_dir = storage.concept_canvas_dir(concept_id)
    dest = canvas_dir / disk_uuid
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

    thumb_uuid = None
    pdf_disk_uuid = None
    status = "ready"

    if kind == "image":
        try:
            from PIL import Image
            img = Image.open(dest)
            img.thumbnail((480, 480))
            thumb_uuid = storage.new_uuid() + ".png"
            img.save(canvas_dir / thumb_uuid, "PNG")
        except Exception:
            thumb_uuid = None  # non-fatal — the card can render the raw image directly
    elif kind == "pdf":
        pdf_disk_uuid = disk_uuid
        try:
            thumb_uuid = storage.new_uuid() + ".png"
            latex.render_thumbnail(dest, canvas_dir / thumb_uuid)
        except Exception:
            thumb_uuid = None
    else:  # docx / pptx
        status = "converting"

    conn = db.get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO canvas_files (concept_id, kind, display_name, disk_uuid, pdf_disk_uuid, "
            "thumb_disk_uuid, mime_type, size_bytes, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (concept_id, kind, display_name, disk_uuid, pdf_disk_uuid, thumb_uuid,
             mime_type, size, status),
        )
        conn.commit()
        file_id = cur.lastrowid
        row = conn.execute(f"SELECT {_PUBLIC_COLS} FROM canvas_files WHERE id = ?", (file_id,)).fetchone()
        result = dict(row)
    finally:
        conn.close()

    if kind in ("docx", "pptx"):
        threading.Thread(target=_convert_canvas_file, args=(file_id, concept_id, dest), daemon=True).start()

    return result


@router.get("/canvas-files/{file_id}/raw")
def canvas_file_raw(file_id: int):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id)
    finally:
        conn.close()
    path = storage.concept_canvas_dir(row["concept_id"]) / row["disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk.")
    return FileResponse(str(path), media_type=row["mime_type"] or "application/octet-stream")


@router.get("/canvas-files/{file_id}/pdf")
def canvas_file_pdf(file_id: int):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id)
    finally:
        conn.close()
    if row["status"] == "converting":
        raise HTTPException(status_code=409, detail="File is still converting.")
    if row["status"] == "failed" or not row["pdf_disk_uuid"]:
        raise HTTPException(status_code=404, detail=row["error_message"] or "No PDF available for this file.")
    path = storage.concept_canvas_dir(row["concept_id"]) / row["pdf_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF missing on disk.")
    return FileResponse(str(path), media_type="application/pdf",
                         headers={"Content-Disposition": 'inline; filename="file.pdf"'})


@router.get("/canvas-files/{file_id}/thumb")
def canvas_file_thumb(file_id: int):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id)
    finally:
        conn.close()
    if not row["thumb_disk_uuid"]:
        raise HTTPException(status_code=404, detail="No thumbnail.")
    path = storage.concept_canvas_dir(row["concept_id"]) / row["thumb_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail missing on disk.")
    return FileResponse(str(path), media_type="image/png")


@router.patch("/canvas-files/{file_id}")
def rename_canvas_file(file_id: int, payload: RenameIn):
    name = (payload.display_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="display_name cannot be blank")
    conn = db.get_connection()
    try:
        _file_row(conn, file_id)
        conn.execute("UPDATE canvas_files SET display_name = ? WHERE id = ?", (name, file_id))
        conn.commit()
        row = conn.execute(f"SELECT {_PUBLIC_COLS} FROM canvas_files WHERE id = ?", (file_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.delete("/canvas-files/{file_id}")
def delete_canvas_file(file_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT concept_id, disk_uuid, pdf_disk_uuid, thumb_disk_uuid FROM canvas_files WHERE id = ?",
            (file_id,),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Canvas file not found")
        conn.execute("DELETE FROM canvas_files WHERE id = ?", (file_id,))
        conn.commit()
    finally:
        conn.close()
    canvas_dir = storage.concept_canvas_dir(row["concept_id"])
    for uuid_name in (row["disk_uuid"], row["pdf_disk_uuid"], row["thumb_disk_uuid"]):
        if uuid_name:
            try:
                (canvas_dir / uuid_name).unlink(missing_ok=True)
            except Exception:
                pass
    return {"ok": True}


# ---------- reader annotations for a dropped canvas file ----------
# Mirrors the note_annotations endpoints (routers/generation.py). The reader,
# when opened on a canvas file, saves/loads its highlight/pen/text annotations
# here (the URLs the canvas passes to openReader). Empty array when none; the
# note itself 404s only if the file is missing (FK cascade cleans these rows).

@router.get("/canvas-files/{file_id}/annotations")
def get_canvas_file_annotations(file_id: int):
    conn = db.get_connection()
    try:
        _file_row(conn, file_id)  # 404 if the canvas file is missing
        row = conn.execute(
            "SELECT data_json FROM canvas_file_annotations WHERE canvas_file_id = ?",
            (file_id,),
        ).fetchone()
        return {"data": json.loads(row["data_json"]) if row else []}
    finally:
        conn.close()


@router.put("/canvas-files/{file_id}/annotations")
def put_canvas_file_annotations(file_id: int, payload: CanvasAnnotationsIn):
    blob = json.dumps(payload.data)
    if len(blob.encode("utf-8")) > _MAX_LAYOUT_BYTES:
        raise HTTPException(status_code=413, detail="Annotations payload too large.")
    conn = db.get_connection()
    try:
        _file_row(conn, file_id)
        conn.execute(
            "INSERT INTO canvas_file_annotations (canvas_file_id, data_json, updated_at) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(canvas_file_id) DO UPDATE SET "
            "data_json = excluded.data_json, updated_at = excluded.updated_at",
            (file_id, blob),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
