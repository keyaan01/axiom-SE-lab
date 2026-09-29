"""Background job logic for per-course past-exam-question (PYQ) analysis
(Build 12 — "Question Analysis", Phase 1).

Mirrors quiz_service.py's pattern: a plain function run in a background
thread, its own short-lived DB connections, and status/error written to the
`question_analysis` row (one per course) so the frontend can poll
GET /courses/{id}/analysis. Unlike quiz_service (which works one concept at a
time), this is a single AI call over a course's WHOLE PYQ set.

Grounding rule preserved: this reads ONLY materials.kind='pyq' — never study
materials — exactly like the note pipeline's PYQ-for-practice-only rule.
"""
import hashlib
import json
from . import gemini
from .generation_service import gather_course_attachments
from .. import db


def pyq_signature(course_id: int) -> str:
    """A stable fingerprint of this course's current PYQ material set (id +
    display_name, sorted by id) — mirrors mindmap_service.concept_signature.
    Used to detect a stale analysis (a PYQ was added/removed/renamed since
    the last completed run).
    """
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT id, display_name FROM materials WHERE course_id = ? AND kind = 'pyq' ORDER BY id",
            (course_id,),
        ).fetchall()
    finally:
        conn.close()
    raw = "|".join(f"{r['id']}:{r['display_name']}" for r in rows)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _set_analysis(course_id: int, **fields) -> None:
    cols = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [course_id]
    conn = db.get_connection()
    try:
        conn.execute(
            f"UPDATE question_analysis SET {cols}, updated_at = datetime('now') WHERE course_id = ?",
            vals,
        )
        conn.commit()
    finally:
        conn.close()


def run_analysis_job(course_id: int) -> None:
    """Question-analysis job body for one course (runs in a background thread).

    Callers (routers/analysis.py) are expected to have already INSERTed/
    UPDATEd the question_analysis row to status='generating' synchronously
    before spawning this thread (mirrors routers/mindmap.py's discover_links
    endpoint) — this function re-asserts 'generating' defensively and always
    ends in 'ready' or 'failed' with a visible message.
    """
    try:
        _set_analysis(course_id, status="generating", error_message=None)

        try:
            atts = gather_course_attachments(course_id)
        except RuntimeError:
            # Course has no materials at all (gather_course_attachments raises
            # in that case) — falls through to the "no PYQs" guard below.
            atts = {"material": [], "pyq": []}
        pyqs = atts["pyq"]
        if not pyqs:
            _set_analysis(
                course_id, status="failed",
                error_message="No past questions uploaded — add PYQs to analyze this course",
            )
            return

        conn = db.get_connection()
        try:
            concept_rows = conn.execute(
                "SELECT id, name, summary FROM concepts WHERE course_id = ? ORDER BY order_index, id",
                (course_id,),
            ).fetchall()
        finally:
            conn.close()
        concepts = [{"id": r["id"], "name": r["name"], "summary": r["summary"]} for r in concept_rows]

        result = gemini.analyze_questions(pyqs, concepts)

        _set_analysis(
            course_id, status="ready",
            data_json=json.dumps(result.model_dump()),
            pyq_sig=pyq_signature(course_id),
            error_message=None,
        )
    except Exception as e:
        _set_analysis(course_id, status="failed", error_message=f"{type(e).__name__}: {e}")
