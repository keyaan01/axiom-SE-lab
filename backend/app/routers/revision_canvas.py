"""Per-revision infinite canvas + revision-scoped Ask-AI.

Additive companion to routers/canvas.py's per-concept canvas: the same
drop-files-anywhere / whiteboard workspace, but attached to a revisions(id)
row instead of a concepts(id) row, so a student can build a study canvas
directly around their exam revision PDF. Every endpoint body is copied from
canvas.py almost verbatim; the only structural difference is that revisions
are account-scoped (multiple accounts can own courses/exams/revisions), so
every lookup here is an OWNERSHIP-checked join (revisions -> courses ->
semesters WHERE semesters.user_id = ?), mirroring routers/analysis.py's
_require_revision/_require_exam pattern, instead of canvas.py's plain
existence check (concepts have no direct account scoping column).

Also carries POST /revisions/{revision_id}/ask — the revision-scoped sibling
of routers/ai.py's POST /concepts/{concept_id}/ask (Build 9 Phase A "ask AI"
study assistant). Reuses ai.ASK_MODES / ai.stream_answer unchanged; only the
prompt-assembly differs (ai.build_revision_ask_messages instead of
ai.build_ask_messages), since a revision has an exam name instead of a
concept name+summary.
"""
import base64
import json
import logging
import os
import shutil
import threading
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from .. import auth, config, db
from ..services import ai, latex, office, storage
from ..services.ai.base import parse_data_url

router = APIRouter()
log = logging.getLogger(__name__)

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

# Same shape as canvas.py's _PUBLIC_COLS, keyed on revision_id instead of
# concept_id, so the frontend's existing canvas rendering code can be reused
# unchanged against this response shape.
_PUBLIC_COLS = ("id, revision_id, kind, display_name, mime_type, size_bytes, "
                "status, error_message, created_at, disk_uuid")

# Ask endpoint caps — identical to routers/ai.py's (defense in depth; the
# frontend should also cap these client-side).
_MAX_TEXT_CHARS = 4000
_MAX_IMAGE_BYTES = 4 * 1024 * 1024


class CanvasLayoutIn(BaseModel):
    data: dict


class RenameIn(BaseModel):
    display_name: str


class CanvasAnnotationsIn(BaseModel):
    data: list


class RevisionAskIn(BaseModel):
    mode: str | None = "explain"
    question: str | None = None
    selection: str = ""
    context: str = ""
    image: str | None = None  # base64 data: URL, e.g. "data:image/png;base64,...."


def _require_revision(conn, revision_id: int, user_id: int) -> dict:
    """Ownership-checked revision lookup (copied from routers/analysis.py) —
    404s both when the revision doesn't exist and when it belongs to a
    different account, so existence is never leaked cross-account."""
    row = conn.execute(
        """
        SELECT r.* FROM revisions r
        JOIN courses c ON c.id = r.course_id
        JOIN semesters s ON s.id = c.semester_id
        WHERE r.id = ? AND s.user_id = ?
        """,
        (revision_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Revision not found")
    return row


def _file_row(conn, file_id: int, user_id: int):
    """Ownership-checked canvas-file lookup: joins all the way through to
    semesters.user_id in one query (mirrors _require_revision), so a
    file-id-keyed endpoint (raw/pdf/thumb/patch/delete/annotations) can't be
    used to read or mutate another account's revision canvas file."""
    row = conn.execute(
        """
        SELECT rcf.* FROM revision_canvas_files rcf
        JOIN revisions r ON r.id = rcf.revision_id
        JOIN courses c ON c.id = r.course_id
        JOIN semesters s ON s.id = c.semester_id
        WHERE rcf.id = ? AND s.user_id = ?
        """,
        (file_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Canvas file not found")
    return row


@router.get("/revisions/{revision_id}/canvas")
def get_revision_canvas(revision_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_revision(conn, revision_id, user["id"])
        layout_row = conn.execute(
            "SELECT data_json FROM revision_canvas_layout WHERE revision_id = ?", (revision_id,)
        ).fetchone()
        layout = json.loads(layout_row["data_json"]) if layout_row else None
        files = conn.execute(
            f"SELECT {_PUBLIC_COLS} FROM revision_canvas_files WHERE revision_id = ? "
            "ORDER BY created_at ASC, id ASC",
            (revision_id,),
        ).fetchall()
        return {"layout": layout, "files": [dict(r) for r in files]}
    finally:
        conn.close()


@router.put("/revisions/{revision_id}/canvas")
def put_revision_canvas_layout(revision_id: int, payload: CanvasLayoutIn,
                                user: dict = Depends(auth.require_auth)):
    blob = json.dumps(payload.data)
    if len(blob.encode("utf-8")) > _MAX_LAYOUT_BYTES:
        raise HTTPException(status_code=413, detail="Canvas layout payload too large.")
    conn = db.get_connection()
    try:
        _require_revision(conn, revision_id, user["id"])
        conn.execute(
            "INSERT INTO revision_canvas_layout (revision_id, data_json, updated_at) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(revision_id) DO UPDATE SET "
            "data_json = excluded.data_json, updated_at = excluded.updated_at",
            (revision_id, blob),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


def _mark_failed(file_id: int, message: str) -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE revision_canvas_files SET status='failed', error_message=? WHERE id=?",
            (message, file_id),
        )
        conn.commit()
    finally:
        conn.close()


def _convert_canvas_file(file_id: int, revision_id: int, src_path: Path) -> None:
    """Background: convert a docx/pptx revision-canvas file to PDF + thumbnail.

    Runs in its own thread with its own DB connection — copied from
    routers/canvas.py's _convert_canvas_file, swapping concept_id for
    revision_id and storage.concept_canvas_dir for storage.revision_canvas_dir.
    """
    work_dir = config.WORK_DIR / storage.new_uuid()
    try:
        converted = office.convert_to_pdf(src_path, work_dir)
        canvas_dir = storage.revision_canvas_dir(revision_id)
        pdf_uuid = storage.new_uuid() + ".pdf"
        pdf_dest = canvas_dir / pdf_uuid
        shutil.move(str(converted), str(pdf_dest))
        thumb_uuid = storage.new_uuid() + ".png"
        thumb_dest = canvas_dir / thumb_uuid
        latex.render_thumbnail(pdf_dest, thumb_dest)

        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE revision_canvas_files SET status='ready', pdf_disk_uuid=?, "
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


@router.post("/revisions/{revision_id}/canvas/files", status_code=201)
async def upload_revision_canvas_file(revision_id: int, file: UploadFile = File(...),
                                       user: dict = Depends(auth.require_auth)):
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
        _require_revision(conn, revision_id, user["id"])
    finally:
        conn.close()

    disk_uuid = storage.new_uuid() + ext
    canvas_dir = storage.revision_canvas_dir(revision_id)
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
            "INSERT INTO revision_canvas_files (revision_id, kind, display_name, disk_uuid, "
            "pdf_disk_uuid, thumb_disk_uuid, mime_type, size_bytes, status) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (revision_id, kind, display_name, disk_uuid, pdf_disk_uuid, thumb_uuid,
             mime_type, size, status),
        )
        conn.commit()
        file_id = cur.lastrowid
        row = conn.execute(f"SELECT {_PUBLIC_COLS} FROM revision_canvas_files WHERE id = ?", (file_id,)).fetchone()
        result = dict(row)
    finally:
        conn.close()

    if kind in ("docx", "pptx"):
        threading.Thread(target=_convert_canvas_file, args=(file_id, revision_id, dest), daemon=True).start()

    return result


@router.get("/revision-canvas-files/{file_id}/raw")
def revision_canvas_file_raw(file_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id, user["id"])
    finally:
        conn.close()
    path = storage.revision_canvas_dir(row["revision_id"]) / row["disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="File missing on disk.")
    return FileResponse(str(path), media_type=row["mime_type"] or "application/octet-stream")


@router.get("/revision-canvas-files/{file_id}/pdf")
def revision_canvas_file_pdf(file_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id, user["id"])
    finally:
        conn.close()
    if row["status"] == "converting":
        raise HTTPException(status_code=409, detail="File is still converting.")
    if row["status"] == "failed" or not row["pdf_disk_uuid"]:
        raise HTTPException(status_code=404, detail=row["error_message"] or "No PDF available for this file.")
    path = storage.revision_canvas_dir(row["revision_id"]) / row["pdf_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF missing on disk.")
    return FileResponse(str(path), media_type="application/pdf",
                         headers={"Content-Disposition": 'inline; filename="file.pdf"'})


@router.get("/revision-canvas-files/{file_id}/thumb")
def revision_canvas_file_thumb(file_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id, user["id"])
    finally:
        conn.close()
    if not row["thumb_disk_uuid"]:
        raise HTTPException(status_code=404, detail="No thumbnail.")
    path = storage.revision_canvas_dir(row["revision_id"]) / row["thumb_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail missing on disk.")
    return FileResponse(str(path), media_type="image/png")


@router.patch("/revision-canvas-files/{file_id}")
def rename_revision_canvas_file(file_id: int, payload: RenameIn, user: dict = Depends(auth.require_auth)):
    name = (payload.display_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="display_name cannot be blank")
    conn = db.get_connection()
    try:
        _file_row(conn, file_id, user["id"])
        conn.execute("UPDATE revision_canvas_files SET display_name = ? WHERE id = ?", (name, file_id))
        conn.commit()
        row = conn.execute(f"SELECT {_PUBLIC_COLS} FROM revision_canvas_files WHERE id = ?", (file_id,)).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.delete("/revision-canvas-files/{file_id}")
def delete_revision_canvas_file(file_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _file_row(conn, file_id, user["id"])
        revision_id = row["revision_id"]
        disk_uuid, pdf_disk_uuid, thumb_disk_uuid = row["disk_uuid"], row["pdf_disk_uuid"], row["thumb_disk_uuid"]
        conn.execute("DELETE FROM revision_canvas_files WHERE id = ?", (file_id,))
        conn.commit()
    finally:
        conn.close()
    canvas_dir = storage.revision_canvas_dir(revision_id)
    for uuid_name in (disk_uuid, pdf_disk_uuid, thumb_disk_uuid):
        if uuid_name:
            try:
                (canvas_dir / uuid_name).unlink(missing_ok=True)
            except Exception:
                pass
    return {"ok": True}


# ---------- reader annotations for a dropped revision-canvas file ----------
# Mirrors canvas.py's canvas_file_annotations endpoints.

@router.get("/revision-canvas-files/{file_id}/annotations")
def get_revision_canvas_file_annotations(file_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _file_row(conn, file_id, user["id"])  # 404 if missing/not owned
        row = conn.execute(
            "SELECT data_json FROM revision_canvas_file_annotations WHERE revision_canvas_file_id = ?",
            (file_id,),
        ).fetchone()
        return {"data": json.loads(row["data_json"]) if row else []}
    finally:
        conn.close()


@router.put("/revision-canvas-files/{file_id}/annotations")
def put_revision_canvas_file_annotations(file_id: int, payload: CanvasAnnotationsIn,
                                          user: dict = Depends(auth.require_auth)):
    blob = json.dumps(payload.data)
    if len(blob.encode("utf-8")) > _MAX_LAYOUT_BYTES:
        raise HTTPException(status_code=413, detail="Annotations payload too large.")
    conn = db.get_connection()
    try:
        _file_row(conn, file_id, user["id"])
        conn.execute(
            "INSERT INTO revision_canvas_file_annotations (revision_canvas_file_id, data_json, updated_at) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(revision_canvas_file_id) DO UPDATE SET "
            "data_json = excluded.data_json, updated_at = excluded.updated_at",
            (file_id, blob),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


# ---------- revision-scoped "ask AI" (sibling of routers/ai.py's per-concept ask) ----------

@router.post("/revisions/{revision_id}/ask")
def ask_revision(revision_id: int, payload: RevisionAskIn, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        rev = _require_revision(conn, revision_id, user["id"])
        exam = conn.execute("SELECT name FROM exams WHERE id = ?", (rev["exam_id"],)).fetchone()
    finally:
        conn.close()
    exam_name = exam["name"] if exam else "this exam"

    selection = payload.selection or ""
    context = payload.context or ""
    question = (payload.question or "").strip()
    image = payload.image or None

    if len(selection) > _MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400, detail=f"selection too long (max {_MAX_TEXT_CHARS} chars)."
        )
    if len(context) > _MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400, detail=f"context too long (max {_MAX_TEXT_CHARS} chars)."
        )

    if image:
        try:
            _mime, b64 = parse_data_url(image)
            raw = base64.b64decode(b64, validate=False)
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed image data.")
        if len(raw) > _MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large (max {_MAX_IMAGE_BYTES // (1024 * 1024)} MB).",
            )

    if not selection.strip() and not image and not question:
        raise HTTPException(status_code=400, detail="Nothing to ask.")

    instruction = question if question else ai.ASK_MODES.get(
        payload.mode or "explain", ai.ASK_MODES["explain"]
    )
    system, user_msg = ai.build_revision_ask_messages(
        exam_name, instruction,
        selection=selection, context=context, has_image=bool(image),
    )

    def gen():
        try:
            for chunk in ai.stream_answer(system, user_msg, image=image):
                if chunk:
                    yield chunk
        except ai.AICancelled:
            return  # client disconnected / cancelled mid-stream — just stop
        except Exception as e:
            log.exception("ask_revision stream failed (revision_id=%s)", revision_id)
            yield f"\n\n[Error generating answer: {e}]"

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
