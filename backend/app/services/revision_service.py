"""Background job logic for per-exam revision PDF generation (Build 12 —
"Question Analysis", Phase 3).

Mirrors generation_service._compile_one_note's pipeline (generate ->
latex.sanitize_body -> latex.build_document -> latex.compile_to (+1 self-repair
on a LatexError) -> latex.render_thumbnail -> update the row), but the AI call
is generate_revision_latex over the exam's ranked topics instead of one
concept's note, and the row lives in `revisions` (one per exam) instead of
`notes`.

Grounding rule preserved: revision *teaching* comes from study materials only
(gather_course_attachments' "material" group); PYQs drive the practice +
importance signal only, exactly like the note pipeline.
"""
import hashlib
import json
from . import gemini, storage, latex, analysis_service
from .generation_service import gather_course_attachments
from .. import db


def _exam_concept_ids(conn, exam_id: int, course_id: int) -> list[int]:
    """The exam's ticked concept ids (exam_concepts), or — when none are
    ticked — every concept in the course (ANALYSIS.md §1/§8: "falls back to
    ALL the course's concepts if none ticked")."""
    ticked = [
        r["concept_id"] for r in conn.execute(
            "SELECT concept_id FROM exam_concepts WHERE exam_id = ? ORDER BY concept_id",
            (exam_id,),
        ).fetchall()
    ]
    if ticked:
        return ticked
    return [
        r["id"] for r in conn.execute(
            "SELECT id FROM concepts WHERE course_id = ? ORDER BY order_index, id",
            (course_id,),
        ).fetchall()
    ]


def revision_source_sig(exam_id: int) -> str:
    """A stable fingerprint of what this exam's revision was/would be built
    from: the course's analysis freshness (status + pyq_sig) plus the exam's
    resolved concept-id set (ticked, or all — see _exam_concept_ids). Used to
    flag a stale revision (the analysis was re-run, or the exam's ticked
    concepts changed) — mirrors pyq_signature/concept_signature elsewhere.
    Returns "" if the exam doesn't exist (defensive; callers treat "" as
    always-stale-or-N/A).
    """
    conn = db.get_connection()
    try:
        exam = conn.execute("SELECT course_id FROM exams WHERE id = ?", (exam_id,)).fetchone()
        if not exam:
            return ""
        course_id = exam["course_id"]
        analysis = conn.execute(
            "SELECT status, pyq_sig FROM question_analysis WHERE course_id = ?", (course_id,)
        ).fetchone()
        analysis_sig = f"{analysis['status']}:{analysis['pyq_sig'] or ''}" if analysis else "none"
        concept_ids = _exam_concept_ids(conn, exam_id, course_id)
    finally:
        conn.close()
    raw = f"{analysis_sig}|{','.join(str(c) for c in concept_ids)}"
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _set_revision(exam_id: int, **fields) -> None:
    cols = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [exam_id]
    conn = db.get_connection()
    try:
        conn.execute(
            f"UPDATE revisions SET {cols}, updated_at = datetime('now') WHERE exam_id = ?",
            vals,
        )
        conn.commit()
    finally:
        conn.close()


def _remove_revision_file(course_id: int, disk_uuid: str | None) -> None:
    if disk_uuid:
        (storage.revision_dir(course_id) / disk_uuid).unlink(missing_ok=True)


def run_revision_job(exam_id: int) -> None:
    """Revision-generation job body for one exam (runs in a background thread).

    Callers (routers/analysis.py) are expected to have already INSERTed/
    UPDATEd the revisions row to status='generating' synchronously before
    spawning this thread (mirrors run_analysis_job / routers/mindmap.py's
    discover_links endpoint) — this function re-asserts 'generating'
    defensively and always ends in 'compiled' or 'failed' with a visible
    message. Silently returns if the exam has vanished (deleted mid-flight).
    """
    conn = db.get_connection()
    try:
        exam = conn.execute(
            "SELECT id, course_id, name FROM exams WHERE id = ?", (exam_id,)
        ).fetchone()
    finally:
        conn.close()
    if exam is None:
        return
    course_id = exam["course_id"]
    exam_name = exam["name"]

    try:
        _set_revision(exam_id, status="generating", error_message=None)

        # Ensure the course's question analysis is ready — run it inline
        # first if it's missing/stale/failed (ANALYSIS.md §4/§8: "a single
        # click for the user"). This is a real, synchronous AI call made from
        # inside this background thread — fine, since run_revision_job itself
        # already runs in one.
        conn = db.get_connection()
        try:
            analysis = conn.execute(
                "SELECT status, data_json, error_message FROM question_analysis WHERE course_id = ?",
                (course_id,),
            ).fetchone()
        finally:
            conn.close()

        if analysis is None or analysis["status"] != "ready":
            analysis_service.run_analysis_job(course_id)
            conn = db.get_connection()
            try:
                analysis = conn.execute(
                    "SELECT status, data_json, error_message FROM question_analysis WHERE course_id = ?",
                    (course_id,),
                ).fetchone()
            finally:
                conn.close()

        if analysis is None or analysis["status"] != "ready":
            msg = (
                analysis["error_message"]
                if analysis and analysis["error_message"]
                else "No past questions uploaded — add PYQs to analyze this course"
            )
            _set_revision(exam_id, status="failed", error_message=msg)
            return

        data = json.loads(analysis["data_json"]) if analysis["data_json"] else {}
        topics = data.get("topics") or []

        conn = db.get_connection()
        try:
            concept_ids = _exam_concept_ids(conn, exam_id, course_id)
            concepts_rows = []
            if concept_ids:
                qmarks = ",".join("?" * len(concept_ids))
                concepts_rows = conn.execute(
                    f"SELECT id, name, summary FROM concepts WHERE course_id = ? AND id IN ({qmarks}) "
                    "ORDER BY order_index, id",
                    (course_id, *concept_ids),
                ).fetchall()
        finally:
            conn.close()
        concepts = [{"id": r["id"], "name": r["name"], "summary": r["summary"]} for r in concepts_rows]
        concept_names = {(c["name"] or "").strip().lower() for c in concepts if c["name"]}

        # Rank topics by importance, restricted to those whose concept_name
        # maps onto one of the exam's concepts (case-insensitive). If nothing
        # matches (e.g. the analysis clustered its own topic names before
        # concepts existed, or this course has no concepts yet), fall back to
        # ranking every analyzed topic rather than producing an empty revision.
        relevant = [
            t for t in topics
            if (t.get("concept_name") or "").strip().lower() in concept_names
        ] if concept_names else []
        ranked_source = relevant if relevant else topics
        ranked_topics = sorted(ranked_source, key=lambda t: t.get("importance", 0), reverse=True)

        atts = gather_course_attachments(course_id)
        materials = atts["material"]
        pyqs = atts["pyq"]

        title = f"Revision — {exam_name}"
        body = gemini.generate_revision_latex(exam_name, ranked_topics, materials, pyqs, concepts)
        clean = latex.sanitize_body(body)
        doc = latex.build_document(title, clean)

        rev_dir = storage.revision_dir(course_id)
        pdf_uuid = storage.new_uuid() + ".pdf"
        pdf_path = rev_dir / pdf_uuid
        try:
            latex.compile_to(doc, pdf_path)
        except latex.LatexError as compile_err:
            # One self-repair pass, same as the note pipeline.
            fixed = gemini.repair_note_latex(title, clean, str(compile_err))
            doc = latex.build_document(title, latex.sanitize_body(fixed))
            latex.compile_to(doc, pdf_path)

        thumb_uuid = storage.new_uuid() + ".png"
        try:
            latex.render_thumbnail(pdf_path, rev_dir / thumb_uuid)
        except Exception:
            thumb_uuid = None  # thumbnail is optional; PDF still valid

        # Unlink any prior compiled files (this is a regenerate) before
        # writing the new ones into the row.
        conn = db.get_connection()
        try:
            old = conn.execute(
                "SELECT pdf_disk_uuid, thumb_disk_uuid FROM revisions WHERE exam_id = ?",
                (exam_id,),
            ).fetchone()
        finally:
            conn.close()
        if old:
            if old["pdf_disk_uuid"] and old["pdf_disk_uuid"] != pdf_uuid:
                _remove_revision_file(course_id, old["pdf_disk_uuid"])
            if old["thumb_disk_uuid"] and old["thumb_disk_uuid"] != thumb_uuid:
                _remove_revision_file(course_id, old["thumb_disk_uuid"])

        sig = revision_source_sig(exam_id)
        _set_revision(
            exam_id, status="compiled", latex_source=doc,
            pdf_disk_uuid=pdf_uuid, thumb_disk_uuid=thumb_uuid,
            error_message=None, source_sig=sig,
        )
    except Exception as e:
        _set_revision(exam_id, status="failed", error_message=f"{type(e).__name__}: {e}")
