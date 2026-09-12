"""Generation endpoints: kick off concept extraction, poll the job, list concepts."""
import io
import json
import re
import threading
import zipfile
from fastapi import APIRouter, Body, HTTPException
from fastapi.responses import FileResponse, PlainTextResponse, Response
from pydantic import BaseModel
from .. import db
from ..services import generation_service, storage

router = APIRouter()

# Guard against a runaway annotations payload (resolution-independent JSON —
# a heavily-annotated note should still be a few KB; 2 MB is a generous cap).
_MAX_ANNOTATIONS_BYTES = 2_000_000


class AnnotationsIn(BaseModel):
    data: list


def _safe_filename(name: str, fallback: str = "note") -> str:
    """Keep alnum/space/dash/underscore; collapse any run of other chars to one '_'."""
    safe = re.sub(r"[^A-Za-z0-9 _-]+", "_", (name or "")).strip()
    return safe or fallback


def _active_job(conn, course_id: int):
    return conn.execute(
        "SELECT id FROM jobs WHERE course_id = ? AND status IN ('queued','running') "
        "ORDER BY id DESC LIMIT 1",
        (course_id,),
    ).fetchone()


@router.post("/courses/{course_id}/generate", status_code=202)
def start_generation(course_id: int, mode: str = "new"):
    """Kick off concept extraction. mode='new' (default, Build 6 Step 5) only
    analyzes study materials not yet processed and APPENDS newly-found
    concepts; anything other than the literal 'all' is treated as 'new'.
    mode='all' is the explicit "Regenerate all"/"Re-analyze" opt-in and
    reproduces the original wipe-and-rebuild-from-everything behavior.
    """
    mode = "all" if mode == "all" else "new"
    conn = db.get_connection()
    try:
        if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        if mode == "all":
            n = conn.execute(
                "SELECT COUNT(*) FROM materials WHERE course_id = ? AND kind = 'material'",
                (course_id,),
            ).fetchone()[0]
            if n == 0:
                raise HTTPException(status_code=400, detail="Upload at least one study material first.")
        else:
            n_new = conn.execute(
                "SELECT COUNT(*) FROM materials WHERE course_id = ? AND kind = 'material' AND analyzed = 0",
                (course_id,),
            ).fetchone()[0]
            if n_new == 0:
                raise HTTPException(status_code=400, detail="No new materials to analyze.")
        active = conn.execute(
            "SELECT id FROM jobs WHERE course_id = ? AND status IN ('queued','running') "
            "ORDER BY id DESC LIMIT 1",
            (course_id,),
        ).fetchone()
        if active:
            raise HTTPException(status_code=409, detail="A generation job is already running for this course.")
        cur = conn.execute(
            "INSERT INTO jobs (course_id, type, status, message) VALUES (?, 'extract', 'queued', 'Queued…')",
            (course_id,),
        )
        conn.commit()
        job_id = cur.lastrowid
    finally:
        conn.close()

    threading.Thread(
        target=generation_service.run_extract_job,
        args=(course_id, job_id, mode),
        daemon=True,
    ).start()
    return {"job_id": job_id, "status": "queued"}


@router.post("/courses/{course_id}/job/cancel")
def cancel_job(course_id: int):
    conn = db.get_connection()
    try:
        job = _active_job(conn, course_id)
        if not job:
            raise HTTPException(status_code=404, detail="No active job to cancel.")
        conn.execute("UPDATE jobs SET cancel_requested = 1 WHERE id = ?", (job["id"],))
        conn.commit()
        return {"ok": True, "job_id": job["id"]}
    finally:
        conn.close()


@router.get("/courses/{course_id}/job")
def latest_job(course_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM jobs WHERE course_id = ? ORDER BY id DESC LIMIT 1", (course_id,)
        ).fetchone()
        return dict(row) if row else None
    finally:
        conn.close()


@router.get("/courses/{course_id}/concepts")
def list_concepts(course_id: int):
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT id, course_id, name, summary, source_locations, material_id, order_index "
            "FROM concepts WHERE course_id = ? ORDER BY order_index ASC, id ASC",
            (course_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


class ConceptRenameIn(BaseModel):
    display_name: str


@router.patch("/concepts/{concept_id}")
def rename_concept(concept_id: int, payload: ConceptRenameIn):
    """Rename a lesson/concept. Updates concepts.name AND the title of any note
    generated for it (notes.title), so the lesson list, schedule, quizzes and the
    note card/reader all show one consistent name (Build 9 canvas round 4)."""
    name = (payload.display_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be blank")
    conn = db.get_connection()
    try:
        if not conn.execute("SELECT 1 FROM concepts WHERE id = ?", (concept_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Concept not found")
        conn.execute("UPDATE concepts SET name = ? WHERE id = ?", (name, concept_id))
        conn.execute("UPDATE notes SET title = ? WHERE concept_id = ?", (name, concept_id))
        conn.commit()
        return {"id": concept_id, "name": name, "display_name": name}
    finally:
        conn.close()


# ---------- note PDF generation (step 4/5) ----------

@router.post("/courses/{course_id}/notes/generate", status_code=202)
def start_note_generation(course_id: int, mode: str = "new", payload: dict | None = Body(None)):
    """Kick off note generation. mode='new' (default) only generates notes for
    concepts without one; mode='all' wipes + regenerates every concept;
    mode='selected' (re)generates notes for exactly the concept_ids in the body.
    """
    mode = mode if mode in ("all", "selected") else "new"
    concept_ids = None
    if mode == "selected":
        concept_ids = [int(x) for x in ((payload or {}).get("concept_ids") or [])]
        if not concept_ids:
            raise HTTPException(status_code=400, detail="Select at least one concept to generate.")
    conn = db.get_connection()
    try:
        if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        if conn.execute("SELECT COUNT(*) FROM concepts WHERE course_id = ?", (course_id,)).fetchone()[0] == 0:
            raise HTTPException(status_code=400, detail="Analyze the materials first (no concepts yet).")
        if mode == "new":
            n_new = conn.execute(
                "SELECT COUNT(*) FROM concepts WHERE course_id = ? "
                "AND id NOT IN (SELECT concept_id FROM notes WHERE course_id = ? AND concept_id IS NOT NULL)",
                (course_id, course_id),
            ).fetchone()[0]
            if n_new == 0:
                raise HTTPException(
                    status_code=400,
                    detail="No new concepts to generate — use Regenerate all to rebuild.",
                )
        if _active_job(conn, course_id):
            raise HTTPException(status_code=409, detail="A job is already running for this course.")
        cur = conn.execute(
            "INSERT INTO jobs (course_id, type, status, message) VALUES (?, 'generate', 'queued', 'Queued…')",
            (course_id,),
        )
        conn.commit()
        job_id = cur.lastrowid
    finally:
        conn.close()
    threading.Thread(
        target=generation_service.run_generate_job, args=(course_id, job_id, mode, concept_ids), daemon=True
    ).start()
    return {"job_id": job_id, "status": "queued"}


@router.get("/courses/{course_id}/notes")
def list_notes(course_id: int):
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT notes.id, notes.course_id, notes.concept_id, notes.title, notes.status, "
            "notes.error_message, (notes.pdf_disk_uuid IS NOT NULL) AS has_pdf, "
            "(notes.thumb_disk_uuid IS NOT NULL) AS has_thumb, notes.created_at, "
            "COALESCE(lp.done, 0) AS done "
            "FROM notes "
            "LEFT JOIN lesson_progress lp ON lp.concept_id = notes.concept_id "
            "WHERE notes.course_id = ? ORDER BY notes.id ASC",
            (course_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def _note_row(note_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT id, course_id, title, latex_source, pdf_disk_uuid, thumb_disk_uuid, status, error_message "
            "FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Note not found")
    return row


@router.get("/notes/{note_id}/pdf")
def note_pdf(note_id: int, download: bool = False):
    row = _note_row(note_id)
    if not row["pdf_disk_uuid"]:
        raise HTTPException(status_code=404, detail=f"No PDF for this note (status={row['status']}).")
    path = storage.course_notes_dir(row["course_id"]) / row["pdf_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF file missing on disk.")
    if download:
        # attachment so the browser downloads it with a friendly filename
        safe_title = _safe_filename(row["title"])
        disposition = f'attachment; filename="{safe_title}.pdf"'
    else:
        # inline so the browser renders it in place instead of downloading
        disposition = 'inline; filename="note.pdf"'
    return FileResponse(str(path), media_type="application/pdf",
                        headers={"Content-Disposition": disposition})


@router.get("/courses/{course_id}/notes.zip")
def notes_zip(course_id: int):
    conn = db.get_connection()
    try:
        course = conn.execute("SELECT id, name FROM courses WHERE id = ?", (course_id,)).fetchone()
        if not course:
            raise HTTPException(status_code=404, detail="Course not found")
        rows = conn.execute(
            "SELECT id, title, pdf_disk_uuid FROM notes "
            "WHERE course_id = ? AND status = 'compiled' AND pdf_disk_uuid IS NOT NULL "
            "ORDER BY id ASC",
            (course_id,),
        ).fetchall()
    finally:
        conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="No compiled notes to download.")

    notes_dir = storage.course_notes_dir(course_id)
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for i, row in enumerate(rows, start=1):
            path = notes_dir / row["pdf_disk_uuid"]
            if not path.exists():
                continue
            safe_title = _safe_filename(row["title"])
            zf.write(str(path), arcname=f"{i:02d} {safe_title}.pdf")
    buf.seek(0)

    safe_course = _safe_filename(course["name"], fallback="course")
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_course} notes.zip"'},
    )


@router.get("/notes/{note_id}/thumb")
def note_thumb(note_id: int):
    row = _note_row(note_id)
    if not row["thumb_disk_uuid"]:
        raise HTTPException(status_code=404, detail="No thumbnail.")
    path = storage.course_thumbs_dir(row["course_id"]) / row["thumb_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail missing on disk.")
    return FileResponse(str(path), media_type="image/png")


@router.post("/notes/{note_id}/retry")
def retry_note(note_id: int):
    """Retry ONE failed (or stuck) note without regenerating the whole course.

    409 if an extract/generate batch job is active for the note's course (the
    batch pipeline already owns note rows for that course), or if this note is
    already mid-generation. Otherwise flips the note to 'generating' and runs
    the same per-note pipeline run_generate_job uses (via run_note_retry) in a
    background thread.
    """
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT id, course_id, status FROM notes WHERE id = ?", (note_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Note not found")
        if row["status"] == "generating":
            raise HTTPException(status_code=409, detail="This note is already generating.")
        if _active_job(conn, row["course_id"]):
            raise HTTPException(status_code=409, detail="A job is already running for this course.")
        conn.execute(
            "UPDATE notes SET status = 'generating', error_message = NULL WHERE id = ?",
            (note_id,),
        )
        conn.commit()
    finally:
        conn.close()

    threading.Thread(
        target=generation_service.run_note_retry, args=(note_id,), daemon=True
    ).start()
    return {"status": "generating"}


@router.get("/notes/{note_id}/latex", response_class=PlainTextResponse)
def note_latex(note_id: int):
    row = _note_row(note_id)
    parts = []
    if row["error_message"]:
        parts.append("% COMPILE ERROR:\n% " + row["error_message"].replace("\n", "\n% ") + "\n")
    parts.append(row["latex_source"] or "% (no LaTeX captured)")
    return "\n".join(parts)


# ---------- reader annotations (Build 4, Step 4) ----------

def _require_note_exists(conn, note_id: int) -> None:
    if not conn.execute("SELECT 1 FROM notes WHERE id = ?", (note_id,)).fetchone():
        raise HTTPException(status_code=404, detail="Note not found")


@router.get("/notes/{note_id}/annotations")
def get_annotations(note_id: int):
    conn = db.get_connection()
    try:
        _require_note_exists(conn, note_id)
        row = conn.execute(
            "SELECT data_json FROM note_annotations WHERE note_id = ?", (note_id,)
        ).fetchone()
        return {"data": json.loads(row["data_json"]) if row else []}
    finally:
        conn.close()


@router.put("/notes/{note_id}/annotations")
def put_annotations(note_id: int, payload: AnnotationsIn):
    blob = json.dumps(payload.data)
    if len(blob.encode("utf-8")) > _MAX_ANNOTATIONS_BYTES:
        raise HTTPException(status_code=413, detail="Annotations payload too large.")
    conn = db.get_connection()
    try:
        _require_note_exists(conn, note_id)
        conn.execute(
            "INSERT INTO note_annotations (note_id, data_json, updated_at) "
            "VALUES (?, ?, datetime('now')) "
            "ON CONFLICT(note_id) DO UPDATE SET "
            "data_json = excluded.data_json, updated_at = excluded.updated_at",
            (note_id, blob),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
