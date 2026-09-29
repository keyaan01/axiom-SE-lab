"""Background job logic for per-concept quiz generation (Build 3, Step 2).

Mirrors generation_service's pattern: a plain function run in a background
thread, its own short-lived DB connections, and status/error written to the
`quizzes` row so the frontend can poll GET /concepts/{id}/quiz.
"""
import json
from . import gemini
from .generation_service import gather_course_attachments
from .. import db


def _set_quiz(concept_id: int, **fields) -> None:
    cols = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [concept_id]
    conn = db.get_connection()
    try:
        conn.execute(
            f"UPDATE quizzes SET {cols}, updated_at = datetime('now') WHERE concept_id = ?",
            vals,
        )
        conn.commit()
    finally:
        conn.close()


def _is_quiz_cancelled(concept_id: int) -> bool:
    """True once the quiz row is no longer 'generating' — the /quiz/cancel
    endpoint flips it to 'failed', which this reports as a cancel request."""
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT status FROM quizzes WHERE concept_id = ?", (concept_id,)
        ).fetchone()
        return bool(row) and row["status"] != "generating"
    finally:
        conn.close()


def run_quiz_job(concept_id: int) -> None:
    """Quiz-generation job body for one concept (runs in a background thread)."""
    try:
        _set_quiz(concept_id, status="generating", error_message=None)

        conn = db.get_connection()
        try:
            concept = conn.execute(
                "SELECT id, course_id, name, summary FROM concepts WHERE id = ?",
                (concept_id,),
            ).fetchone()
            sibling_names = []
            if concept is not None:
                sibling_names = [
                    row["name"]
                    for row in conn.execute(
                        "SELECT name FROM concepts WHERE course_id = ? AND id != ?",
                        (concept["course_id"], concept_id),
                    ).fetchall()
                ]
        finally:
            conn.close()
        if concept is None:
            raise RuntimeError("Concept not found.")

        atts = gather_course_attachments(concept["course_id"])
        questions = gemini.generate_quiz(
            concept["name"], concept["summary"], atts["material"], atts["pyq"], sibling_names,
            should_cancel=lambda: _is_quiz_cancelled(concept_id),
        )

        questions_json = json.dumps([q.model_dump() for q in questions])
        _set_quiz(concept_id, status="ready", questions_json=questions_json, error_message=None)
    except gemini.GeminiCancelled:
        # The /quiz/cancel endpoint already set status='failed' + 'Cancelled.';
        # leave that in place rather than overwriting with the exception text.
        pass
    except Exception as e:
        _set_quiz(concept_id, status="failed", error_message=f"{type(e).__name__}: {e}")
