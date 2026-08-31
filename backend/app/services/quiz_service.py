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
            concept["name"], concept["summary"], atts["material"], atts["pyq"], sibling_names
        )

        questions_json = json.dumps([q.model_dump() for q in questions])
        _set_quiz(concept_id, status="ready", questions_json=questions_json, error_message=None)
    except Exception as e:
        _set_quiz(concept_id, status="failed", error_message=f"{type(e).__name__}: {e}")
