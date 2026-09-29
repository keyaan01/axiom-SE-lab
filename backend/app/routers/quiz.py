"""Per-concept quiz generation + lesson-done/progress tracking (Build 3, Step 2).

Additive: a quiz belongs 1:1 to a concept (quizzes.concept_id UNIQUE) and is
generated in a background thread the same way concept extraction / note
generation are (services/quiz_service.run_quiz_job). lesson_progress tracks,
per concept, whether the student has marked the lesson done and their best
quiz score — both are surfaced back onto the notes list and schedule rows.
"""
import json
import threading
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .. import db
from ..services import quiz_service

router = APIRouter()


class QuizResult(BaseModel):
    score: int
    total: int


def _require_concept(conn, concept_id: int):
    row = conn.execute(
        "SELECT id, course_id, name, summary FROM concepts WHERE id = ?", (concept_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Concept not found")
    return row


def _get_progress(conn, concept_id: int):
    return conn.execute(
        "SELECT * FROM lesson_progress WHERE concept_id = ?", (concept_id,)
    ).fetchone()


def _ensure_progress_row(conn, course_id: int, concept_id: int):
    """INSERT a lesson_progress row for this concept if one doesn't exist yet."""
    conn.execute(
        "INSERT INTO lesson_progress (course_id, concept_id) "
        "SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM lesson_progress WHERE concept_id = ?)",
        (course_id, concept_id, concept_id),
    )


@router.get("/concepts/{concept_id}/quiz")
def get_quiz(concept_id: int):
    conn = db.get_connection()
    try:
        concept = _require_concept(conn, concept_id)
        base = {"concept_name": concept["name"], "course_id": concept["course_id"]}
        row = conn.execute(
            "SELECT status, questions_json, error_message FROM quizzes WHERE concept_id = ?",
            (concept_id,),
        ).fetchone()
        if not row:
            return {**base, "status": "none", "questions": []}
        questions = json.loads(row["questions_json"]) if row["questions_json"] else []
        out = {**base, "status": row["status"], "questions": questions}
        if row["error_message"]:
            out["error_message"] = row["error_message"]
        return out
    finally:
        conn.close()


@router.post("/concepts/{concept_id}/quiz/generate", status_code=202)
def generate_quiz(concept_id: int, regenerate: bool = False):
    conn = db.get_connection()
    try:
        concept = _require_concept(conn, concept_id)
        existing = conn.execute(
            "SELECT status FROM quizzes WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        if existing:
            if existing["status"] == "generating":
                return {"status": "generating"}
            if existing["status"] == "ready" and not regenerate:
                return {"status": "ready"}
            conn.execute(
                "UPDATE quizzes SET status = 'generating', error_message = NULL, "
                "updated_at = datetime('now') WHERE concept_id = ?",
                (concept_id,),
            )
        else:
            conn.execute(
                "INSERT INTO quizzes (course_id, concept_id, status) VALUES (?, ?, 'generating')",
                (concept["course_id"], concept_id),
            )
        conn.commit()
    finally:
        conn.close()

    threading.Thread(
        target=quiz_service.run_quiz_job, args=(concept_id,), daemon=True
    ).start()
    return {"status": "generating"}


@router.post("/concepts/{concept_id}/quiz/cancel")
def cancel_quiz(concept_id: int):
    """Cancel an in-progress quiz generation. Flips the row out of 'generating'
    (→ 'failed' + 'Cancelled.'); run_quiz_job's should_cancel check sees the
    status change and aborts at its next checkpoint (best-effort — an already
    in-flight single AI call can't be force-killed, same as note generation)."""
    conn = db.get_connection()
    try:
        cur = conn.execute(
            "UPDATE quizzes SET status = 'failed', error_message = 'Cancelled.', "
            "updated_at = datetime('now') WHERE concept_id = ? AND status = 'generating'",
            (concept_id,),
        )
        conn.commit()
        return {"ok": True, "cancelled": cur.rowcount > 0}
    finally:
        conn.close()


@router.post("/concepts/{concept_id}/quiz/result")
def submit_quiz_result(concept_id: int, payload: QuizResult):
    conn = db.get_connection()
    try:
        concept = _require_concept(conn, concept_id)
        _ensure_progress_row(conn, concept["course_id"], concept_id)
        existing = _get_progress(conn, concept_id)

        best_score = existing["best_score"]
        best_total = existing["best_total"]
        if best_score is None or payload.score > best_score:
            best_score, best_total = payload.score, payload.total

        newly_done = bool(payload.total > 0 and payload.score >= payload.total and not existing["done"])
        if newly_done:
            conn.execute(
                "UPDATE lesson_progress SET best_score = ?, best_total = ?, done = 1, "
                "done_at = datetime('now'), updated_at = datetime('now') WHERE concept_id = ?",
                (best_score, best_total, concept_id),
            )
        else:
            conn.execute(
                "UPDATE lesson_progress SET best_score = ?, best_total = ?, "
                "updated_at = datetime('now') WHERE concept_id = ?",
                (best_score, best_total, concept_id),
            )
        # Record every attempt (not just the best-of kept on lesson_progress) —
        # feeds the scheduler's weak-concept reordering (services/scheduler.py).
        conn.execute(
            "INSERT INTO quiz_attempts (course_id, concept_id, score, total) VALUES (?, ?, ?, ?)",
            (concept["course_id"], concept_id, payload.score, payload.total),
        )
        conn.commit()
        return dict(_get_progress(conn, concept_id))
    finally:
        conn.close()


@router.get("/concepts/{concept_id}/attempts")
def list_quiz_attempts(concept_id: int):
    conn = db.get_connection()
    try:
        _require_concept(conn, concept_id)
        rows = conn.execute(
            "SELECT score, total, created_at FROM quiz_attempts "
            "WHERE concept_id = ? ORDER BY created_at DESC, id DESC LIMIT 20",
            (concept_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/concepts/{concept_id}/done")
def mark_done(concept_id: int):
    conn = db.get_connection()
    try:
        concept = _require_concept(conn, concept_id)
        _ensure_progress_row(conn, concept["course_id"], concept_id)
        conn.execute(
            "UPDATE lesson_progress SET done = 1, done_at = datetime('now'), "
            "updated_at = datetime('now') WHERE concept_id = ?",
            (concept_id,),
        )
        conn.commit()
        return {"done": True}
    finally:
        conn.close()


@router.post("/concepts/{concept_id}/undone")
def mark_undone(concept_id: int):
    conn = db.get_connection()
    try:
        concept = _require_concept(conn, concept_id)
        _ensure_progress_row(conn, concept["course_id"], concept_id)
        conn.execute(
            "UPDATE lesson_progress SET done = 0, done_at = NULL, "
            "updated_at = datetime('now') WHERE concept_id = ?",
            (concept_id,),
        )
        conn.commit()
        return {"done": False}
    finally:
        conn.close()


@router.get("/courses/{course_id}/progress")
def course_progress(course_id: int):
    conn = db.get_connection()
    try:
        if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        rows = conn.execute(
            "SELECT concept_id, done, best_score, best_total FROM lesson_progress WHERE course_id = ?",
            (course_id,),
        ).fetchall()
        return {
            str(r["concept_id"]): {
                "done": bool(r["done"]),
                "best_score": r["best_score"],
                "best_total": r["best_total"],
            }
            for r in rows
        }
    finally:
        conn.close()
