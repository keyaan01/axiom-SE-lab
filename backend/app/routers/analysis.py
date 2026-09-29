"""Per-course past-exam-question (PYQ) analysis (Build 12 — "Question
Analysis", Phase 1 — backend only, no frontend/revision yet).

One `question_analysis` row per course, run on demand + cached + stale-aware
(mirrors quizzes / mind-map discovery). Scoped course->semester->user like
routers/schedule.py's per-semester endpoints and routers/prompts.py: every
endpoint verifies the course belongs to a semester owned by the logged-in
account before touching it.
"""
import json
import re
import threading
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from .. import auth, db
from ..services import analysis_service, revision_service, storage

router = APIRouter()


def _safe_filename(name: str, fallback: str = "revision") -> str:
    """Keep alnum/space/dash/underscore; collapse any run of other chars to
    one '_' (mirrors routers/generation.py's helper of the same name)."""
    safe = re.sub(r"[^A-Za-z0-9 _-]+", "_", (name or "")).strip()
    return safe or fallback


def _require_course(conn, course_id: int, user_id: int) -> dict:
    row = conn.execute(
        """
        SELECT c.* FROM courses c
        JOIN semesters s ON s.id = c.semester_id
        WHERE c.id = ? AND s.user_id = ?
        """,
        (course_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Course not found")
    return row


def _counts(conn, course_id: int) -> tuple[int, int]:
    pyq_count = conn.execute(
        "SELECT COUNT(*) AS n FROM materials WHERE course_id = ? AND kind = 'pyq'",
        (course_id,),
    ).fetchone()["n"]
    concept_count = conn.execute(
        "SELECT COUNT(*) AS n FROM concepts WHERE course_id = ?",
        (course_id,),
    ).fetchone()["n"]
    return pyq_count, concept_count


@router.get("/courses/{course_id}/analysis")
def get_analysis(course_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_course(conn, course_id, user["id"])
        row = conn.execute(
            "SELECT status, data_json, pyq_sig, error_message FROM question_analysis WHERE course_id = ?",
            (course_id,),
        ).fetchone()
        pyq_count, concept_count = _counts(conn, course_id)
    finally:
        conn.close()

    if not row:
        return {
            "status": "pending",
            "data": None,
            "stale": False,
            "pyq_count": pyq_count,
            "concept_count": concept_count,
        }

    data = json.loads(row["data_json"]) if row["data_json"] else None
    stale = False
    if row["status"] == "ready":
        stale = (row["pyq_sig"] or "") != analysis_service.pyq_signature(course_id)
    out = {
        "status": row["status"],
        "data": data,
        "stale": stale,
        "pyq_count": pyq_count,
        "concept_count": concept_count,
    }
    if row["error_message"]:
        out["error_message"] = row["error_message"]
    return out


@router.post("/courses/{course_id}/analysis/generate", status_code=202)
def generate_analysis(course_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_course(conn, course_id, user["id"])
        pyq_count, _concept_count = _counts(conn, course_id)
        if pyq_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No past questions uploaded — add PYQs to analyze this course",
            )

        existing = conn.execute(
            "SELECT status FROM question_analysis WHERE course_id = ?", (course_id,)
        ).fetchone()
        if existing and existing["status"] == "generating":
            raise HTTPException(status_code=409, detail="Analysis is already running.")

        # Set status='generating' SYNCHRONOUSLY (before returning) so an
        # immediate status poll right after this response sees 'generating',
        # not a stale value from before the thread has had a chance to run
        # (mirrors routers/mindmap.py's discover_links endpoint).
        if existing:
            conn.execute(
                "UPDATE question_analysis SET status = 'generating', error_message = NULL, "
                "updated_at = datetime('now') WHERE course_id = ?",
                (course_id,),
            )
        else:
            conn.execute(
                "INSERT INTO question_analysis (course_id, status) VALUES (?, 'generating')",
                (course_id,),
            )
        conn.commit()
    finally:
        conn.close()

    threading.Thread(
        target=analysis_service.run_analysis_job, args=(course_id,), daemon=True
    ).start()
    return {"status": "generating"}


# ---------- per-exam revision PDF (Build 12, Phase 3) ----------

def _require_exam(conn, exam_id: int, user_id: int) -> dict:
    row = conn.execute(
        """
        SELECT e.* FROM exams e
        JOIN courses c ON c.id = e.course_id
        JOIN semesters s ON s.id = c.semester_id
        WHERE e.id = ? AND s.user_id = ?
        """,
        (exam_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    return row


def _require_revision(conn, revision_id: int, user_id: int) -> dict:
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


@router.get("/exams/{exam_id}/revision")
def get_revision(exam_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_exam(conn, exam_id, user["id"])
        row = conn.execute(
            "SELECT id, status, pdf_disk_uuid, source_sig, error_message FROM revisions WHERE exam_id = ?",
            (exam_id,),
        ).fetchone()
    finally:
        conn.close()

    if not row:
        return {"status": "pending", "revision_id": None, "has_pdf": False, "stale": False}

    stale = False
    if row["status"] == "compiled":
        stale = (row["source_sig"] or "") != revision_service.revision_source_sig(exam_id)
    out = {
        "status": row["status"],
        "revision_id": row["id"],
        "has_pdf": bool(row["pdf_disk_uuid"]),
        "stale": stale,
    }
    if row["error_message"]:
        out["error_message"] = row["error_message"]
    return out


@router.post("/exams/{exam_id}/revision/generate", status_code=202)
def generate_revision(exam_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        exam = _require_exam(conn, exam_id, user["id"])
        pyq_count = conn.execute(
            "SELECT COUNT(*) AS n FROM materials WHERE course_id = ? AND kind = 'pyq'",
            (exam["course_id"],),
        ).fetchone()["n"]
        if pyq_count == 0:
            raise HTTPException(
                status_code=400,
                detail="No past questions uploaded — add PYQs to analyze this course",
            )

        existing = conn.execute(
            "SELECT status FROM revisions WHERE exam_id = ?", (exam_id,)
        ).fetchone()
        if existing and existing["status"] == "generating":
            raise HTTPException(status_code=409, detail="Revision is already generating.")

        # Set status='generating' SYNCHRONOUSLY (before returning) so an
        # immediate status poll right after this response sees 'generating'
        # (mirrors generate_analysis above / routers/mindmap.py's discover_links).
        if existing:
            conn.execute(
                "UPDATE revisions SET status = 'generating', error_message = NULL, "
                "updated_at = datetime('now') WHERE exam_id = ?",
                (exam_id,),
            )
        else:
            conn.execute(
                "INSERT INTO revisions (course_id, exam_id, status) VALUES (?, ?, 'generating')",
                (exam["course_id"], exam_id),
            )
        conn.commit()
    finally:
        conn.close()

    threading.Thread(
        target=revision_service.run_revision_job, args=(exam_id,), daemon=True
    ).start()
    return {"status": "generating"}


@router.get("/revisions/{revision_id}/pdf")
def revision_pdf(revision_id: int, download: bool = False, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _require_revision(conn, revision_id, user["id"])
        exam = conn.execute("SELECT name FROM exams WHERE id = ?", (row["exam_id"],)).fetchone()
    finally:
        conn.close()

    if not row["pdf_disk_uuid"]:
        raise HTTPException(status_code=404, detail=f"No PDF for this revision (status={row['status']}).")
    path = storage.revision_dir(row["course_id"]) / row["pdf_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF file missing on disk.")

    if download:
        safe_title = _safe_filename(exam["name"] if exam else "revision")
        disposition = f'attachment; filename="{safe_title} revision.pdf"'
    else:
        disposition = 'inline; filename="revision.pdf"'
    return FileResponse(str(path), media_type="application/pdf",
                        headers={"Content-Disposition": disposition})


@router.get("/revisions/{revision_id}/thumb")
def revision_thumb(revision_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        row = _require_revision(conn, revision_id, user["id"])
    finally:
        conn.close()

    if not row["thumb_disk_uuid"]:
        raise HTTPException(status_code=404, detail="No thumbnail.")
    path = storage.revision_dir(row["course_id"]) / row["thumb_disk_uuid"]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail missing on disk.")
    return FileResponse(str(path), media_type="image/png")
