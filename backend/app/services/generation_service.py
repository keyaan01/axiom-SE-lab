"""Background job logic for the generation pipeline.

Step 3 implements the concept-extraction phase: gather every material as a
provider-agnostic Attachment, ask the active AI provider for the concept
list, and store it. Job status/message are written to the `jobs` table so the
frontend can poll. Runs in a plain background thread (the AI SDK call is
blocking).
"""
import json
import time
from . import gemini, storage, latex
from .ai import Attachment
from .. import db


def _set_job(job_id: int, **fields) -> None:
    cols = ", ".join(f"{k} = ?" for k in fields)
    vals = list(fields.values()) + [job_id]
    conn = db.get_connection()
    try:
        conn.execute(f"UPDATE jobs SET {cols}, updated_at = datetime('now') WHERE id = ?", vals)
        conn.commit()
    finally:
        conn.close()


def _course_note_prefs(course_id: int):
    """Return (instructions:str, enhancement_keys:list[str]) for a course; safe
    defaults on missing/invalid data (Build 4, Step 1 per-course customization).
    """
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT note_instructions, note_enhancements FROM courses WHERE id = ?",
            (course_id,),
        ).fetchone()
    finally:
        conn.close()
    if not row:
        return "", []
    instr = row["note_instructions"] or ""
    keys = []
    raw = row["note_enhancements"]
    if raw:
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                keys = [str(k) for k in parsed]
        except Exception:
            keys = []
    return instr, keys


def _effective_note_prefs(course_id: int):
    """Return (instructions:str, enhancement_keys:list[str]) merging the
    course's own saved prefs (_course_note_prefs) with the global "apply to
    all notes" Saved Prompt, if one is currently marked active (Build 6,
    Step 6 — backend half of the Saved Prompts library).

    The active prompt is a pointer stored in settings.active_prompt_id
    (saved_prompts.id as text; see routers/prompts.py). When set, its
    instruction text is combined with the course's own note_instructions:
    both present and different -> "<global>\n\n<course>"; identical
    (case-insensitive, whitespace-trimmed) -> just one copy; only one present
    -> that one; neither -> "". Enhancement keys are unaffected — those stay
    a purely per-course setting.
    """
    course_instr, keys = _course_note_prefs(course_id)

    global_instr = ""
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = 'active_prompt_id'"
        ).fetchone()
        if row and row["value"]:
            try:
                active_id = int(row["value"])
            except (TypeError, ValueError):
                active_id = None
            if active_id is not None:
                prow = conn.execute(
                    "SELECT instruction FROM saved_prompts WHERE id = ?", (active_id,)
                ).fetchone()
                if prow and prow["instruction"]:
                    global_instr = prow["instruction"]
    finally:
        conn.close()

    course_instr = course_instr or ""
    global_instr = global_instr or ""

    if global_instr and course_instr:
        if global_instr.strip().lower() == course_instr.strip().lower():
            merged = course_instr
        else:
            merged = f"{global_instr}\n\n{course_instr}"
    else:
        merged = global_instr or course_instr

    return merged, keys


def _is_cancelled(job_id: int) -> bool:
    """True if the user has requested cancellation of this job (cooperative —
    callers must check this at safe points and stop early)."""
    conn = db.get_connection()
    try:
        row = conn.execute("SELECT cancel_requested FROM jobs WHERE id = ?", (job_id,)).fetchone()
    finally:
        conn.close()
    return bool(row and row["cancel_requested"])


def gather_course_attachments(course_id: int, only_material_ids: set[int] | None = None) -> dict:
    """Return this course's materials as provider-agnostic Attachments, partitioned by kind.

    No upload happens here — the active AI provider's adapter uploads/caches
    files lazily on first use (see services/ai/gemini_provider._ensure_uploaded,
    which reuses gemini_file_name if the cached Gemini file is still ACTIVE,
    else re-uploads and persists the new name). This function only builds the
    Attachment list from the `materials` table rows.

    Returns {"material": [Attachment...], "pyq": [Attachment...]} — callers
    must keep these two groups separate: study materials are the only source
    of teaching content (and of concepts), while PYQs may only inform
    practice-problem style.

    only_material_ids (Build 6, Step 5 — incremental note generation), when
    given, restricts the returned "material" group to just those material
    rows' ids (PYQ rows are never filtered — note generation still cites all
    of a course's PYQs regardless of which study materials are "new"). When
    only_material_ids is provided, the "no materials at all" RuntimeError is
    skipped — an empty set (or a course with zero matching materials) simply
    yields an empty "material" list; callers of the filtered form are
    expected to pre-check for that emptiness themselves.
    """
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT id, kind, display_name, disk_uuid, mime_type, gemini_file_name, "
            "pdf_disk_uuid, status FROM materials WHERE course_id = ? ORDER BY id",
            (course_id,),
        ).fetchall()
    finally:
        conn.close()

    if only_material_ids is not None:
        rows = [r for r in rows if r["kind"] != "material" or r["id"] in only_material_ids]
    elif not rows:
        raise RuntimeError("This course has no materials to analyze.")

    upload_dir = storage.course_upload_dir(course_id)
    atts = {"material": [], "pyq": []}
    for r in rows:
        # A material still converting (office->PDF) or that failed conversion
        # has no usable bytes yet — never feed a half-converted file to
        # extraction/note-gen. Legacy rows predate this column (status IS
        # NULL) and are treated as ready, same as a plain PDF/image upload.
        if r["status"] in ("converting", "failed"):
            continue
        if r["pdf_disk_uuid"]:
            # Office document that's been converted to PDF (or a plain PDF
            # upload, which stores its own disk_uuid here too) — extraction
            # always sees the PDF bytes, never the original office file.
            disk_path = str(upload_dir / r["pdf_disk_uuid"])
            mime = "application/pdf"
        else:
            disk_path = str(upload_dir / r["disk_uuid"])
            mime = r["mime_type"]
        att = Attachment(
            display_name=r["display_name"],
            disk_path=disk_path,
            mime=mime,
            kind=r["kind"],
            material_id=r["id"],
            gemini_file_name=r["gemini_file_name"],
        )
        atts[r["kind"]].append(att)
    return atts


def _resolve_material_id(source_file: str, materials: list[tuple[int, str]]) -> int | None:
    """Match a model-reported source_file name to a course material's id.

    Tries, in order: exact case-insensitive match, then a substring match in
    either direction (case-insensitive, first hit wins). Returns None if
    source_file is empty or nothing matches.
    """
    if not source_file:
        return None
    needle = source_file.lower()
    for mid, display_name in materials:
        if display_name.lower() == needle:
            return mid
    for mid, display_name in materials:
        dn = display_name.lower()
        if needle in dn or dn in needle:
            return mid
    return None


def run_extract_job(course_id: int, job_id: int, mode: str = "new") -> None:
    """Concept-extraction job body (runs in a background thread).

    mode='all' reproduces the original behavior exactly (used by an explicit
    "Regenerate all" / "Re-analyze"): wipe the course's concepts and
    re-extract from EVERY study material, then mark all of them analyzed.

    mode='new' (default, Build 6 Step 5 — incremental generation): only look
    at study materials not yet analyzed (materials.analyzed = 0). Newly-found
    concepts are APPENDED (never wipes existing concepts), deduped by exact
    case-insensitive name against the course's current concepts, with
    order_index continuing on from the current max. Only the materials that
    were actually processed this run are marked analyzed = 1.
    """
    try:
        _set_job(job_id, status="running", message="Preparing materials…")

        if mode == "all":
            atts = gather_course_attachments(course_id)
            materials = atts["material"]
            if not materials:
                raise RuntimeError("Upload at least one study material.")

            if _is_cancelled(job_id):
                _set_job(job_id, status="done", message="Cancelled.")
                return

            _set_job(job_id, message="Analyzing materials and extracting concepts…")
            concepts = gemini.extract_concepts(
                materials, should_cancel=lambda: _is_cancelled(job_id)
            )

            if _is_cancelled(job_id):
                _set_job(job_id, status="done", message="Cancelled.")
                return

            conn = db.get_connection()
            try:
                materials = [
                    (row["id"], row["display_name"])
                    for row in conn.execute(
                        "SELECT id, display_name FROM materials WHERE course_id = ? AND kind = 'material'",
                        (course_id,),
                    ).fetchall()
                ]
                # Re-generation replaces the previous concept set for this course.
                # notes.concept_id is ON DELETE SET NULL (not CASCADE), so a blind
                # concept wipe would ORPHAN every note (concept_id -> NULL) rather
                # than remove it — leaving stale notes in the Notes grid, still
                # served by /courses/:id/notes and reachable only via the legacy
                # study view. "Re-analyze all" promises the notes are removed, so
                # delete them (and their pdf/thumb files; note_annotations cascade)
                # explicitly BEFORE wiping the concepts.
                for note_row in conn.execute(
                    "SELECT id, pdf_disk_uuid, thumb_disk_uuid FROM notes WHERE course_id = ?",
                    (course_id,),
                ).fetchall():
                    _remove_note_files(course_id, note_row)
                conn.execute("DELETE FROM notes WHERE course_id = ?", (course_id,))
                conn.execute("DELETE FROM concepts WHERE course_id = ?", (course_id,))
                for idx, cpt in enumerate(concepts):
                    material_id = _resolve_material_id(cpt.source_file, materials)
                    conn.execute(
                        "INSERT INTO concepts (course_id, name, summary, source_locations, material_id, order_index) "
                        "VALUES (?, ?, ?, ?, ?, ?)",
                        (course_id, cpt.name, cpt.summary, json.dumps({"source": cpt.source}), material_id, idx),
                    )
                # Ensure the single lesson exists (all notes live here for now).
                if not conn.execute("SELECT 1 FROM lessons WHERE course_id = ?", (course_id,)).fetchone():
                    conn.execute(
                        "INSERT INTO lessons (course_id, title, order_index) VALUES (?, 'All notes', 0)",
                        (course_id,),
                    )
                # Every study material has now been folded into the concept set.
                conn.execute(
                    "UPDATE materials SET analyzed = 1 WHERE course_id = ? AND kind = 'material'",
                    (course_id,),
                )
                conn.commit()
            finally:
                conn.close()

            n = len(concepts)
            _set_job(job_id, status="done", progress=n, total=n,
                     message=f"Found {n} concept{'s' if n != 1 else ''}.")
            return

        # mode == "new" (default).
        conn = db.get_connection()
        try:
            new_material_ids = [
                row["id"] for row in conn.execute(
                    "SELECT id FROM materials WHERE course_id = ? AND kind = 'material' AND analyzed = 0",
                    (course_id,),
                ).fetchall()
            ]
        finally:
            conn.close()

        if not new_material_ids:
            _set_job(job_id, status="done", message="No new materials to analyze.")
            return

        atts = gather_course_attachments(course_id, only_material_ids=set(new_material_ids))
        materials = atts["material"]
        if not materials:
            # Defensive only — we just found unanalyzed material ids above, so
            # this shouldn't normally trigger.
            _set_job(job_id, status="done", message="No new materials to analyze.")
            return

        if _is_cancelled(job_id):
            _set_job(job_id, status="done", message="Cancelled.")
            return

        _set_job(job_id, message="Analyzing new materials and extracting concepts…")
        concepts = gemini.extract_concepts(
            materials, should_cancel=lambda: _is_cancelled(job_id)
        )

        if _is_cancelled(job_id):
            _set_job(job_id, status="done", message="Cancelled.")
            return

        conn = db.get_connection()
        try:
            materials = [
                (row["id"], row["display_name"])
                for row in conn.execute(
                    "SELECT id, display_name FROM materials WHERE course_id = ? AND kind = 'material'",
                    (course_id,),
                ).fetchall()
            ]
            existing_names = {
                (row["name"] or "").strip().lower()
                for row in conn.execute(
                    "SELECT name FROM concepts WHERE course_id = ?", (course_id,)
                ).fetchall()
            }
            next_idx = conn.execute(
                "SELECT COALESCE(MAX(order_index), -1) + 1 AS n FROM concepts WHERE course_id = ?",
                (course_id,),
            ).fetchone()["n"]

            inserted = 0
            for cpt in concepts:
                key = (cpt.name or "").strip().lower()
                if key and key in existing_names:
                    continue  # dedupe: a concept with this exact name already exists
                material_id = _resolve_material_id(cpt.source_file, materials)
                conn.execute(
                    "INSERT INTO concepts (course_id, name, summary, source_locations, material_id, order_index) "
                    "VALUES (?, ?, ?, ?, ?, ?)",
                    (course_id, cpt.name, cpt.summary, json.dumps({"source": cpt.source}), material_id, next_idx),
                )
                existing_names.add(key)
                next_idx += 1
                inserted += 1

            # Ensure the single lesson exists (all notes live here for now).
            if not conn.execute("SELECT 1 FROM lessons WHERE course_id = ?", (course_id,)).fetchone():
                conn.execute(
                    "INSERT INTO lessons (course_id, title, order_index) VALUES (?, 'All notes', 0)",
                    (course_id,),
                )

            qmarks = ",".join("?" * len(new_material_ids))
            conn.execute(
                f"UPDATE materials SET analyzed = 1 WHERE id IN ({qmarks})",
                new_material_ids,
            )
            conn.commit()
        finally:
            conn.close()

        if inserted:
            _set_job(job_id, status="done", progress=inserted, total=inserted,
                     message=f"Added {inserted} new concept{'s' if inserted != 1 else ''}.")
        else:
            _set_job(job_id, status="done", message="No new concepts found.")
    except Exception as e:
        if isinstance(e, gemini.GeminiCancelled) or _is_cancelled(job_id):
            _set_job(job_id, status="done", message="Cancelled.")
        else:
            _set_job(job_id, status="failed", message=f"{type(e).__name__}: {e}")


def _remove_note_files(course_id: int, note_row) -> None:
    if note_row["pdf_disk_uuid"]:
        (storage.course_notes_dir(course_id) / note_row["pdf_disk_uuid"]).unlink(missing_ok=True)
    if note_row["thumb_disk_uuid"]:
        (storage.course_thumbs_dir(course_id) / note_row["thumb_disk_uuid"]).unlink(missing_ok=True)


def _compile_one_note(course_id: int, note_id: int, concept_name: str, concept_summary: str,
                       materials, pyqs, sibling_names,
                       extra_instructions: str = "", enhancement_keys=None,
                       job_id: int | None = None,
                       progress_label: str = "") -> bool:
    """Generate + compile + thumbnail ONE note, updating its row in place.

    Shared by run_generate_job (per-concept loop) and run_note_retry (single
    note), so both paths run the exact same pipeline: generate_note_latex ->
    sanitize_body -> build_document -> compile_to (with ONE self-repair pass
    on a LatexError) -> render_thumbnail -> update the note row to 'compiled'
    (pdf/thumb/latex, error cleared) or 'failed' (latex_source + error_message).

    extra_instructions/enhancement_keys are the course's saved note-customization
    prefs (Build 4, Step 1; see _course_note_prefs) forwarded straight into
    gemini.generate_note_latex — both run_generate_job and run_note_retry look
    them up and pass them here so a batch run and a single-note retry apply the
    same customization.

    should_cancel is wired to job_id when given (run_generate_job's batch job);
    a bare retry (job_id=None) has nothing to cancel against, so should_cancel
    always reports False in that case. Beyond the mid-stream checks inside
    generate_note_latex/repair_note_latex, should_cancel is also checked here
    right after generation returns and again before a repair pass, so a
    cancellation lands before the (comparatively slow) compile/repair step
    instead of only between Gemini calls.

    Returns True on success, False on failure. Raises gemini.GeminiCancelled
    only in the job_id path (run_generate_job handles that specially); a retry
    has no job to cancel, so this never raises it when job_id is None.
    """
    should_cancel = (lambda: _is_cancelled(job_id)) if job_id is not None else (lambda: False)
    doc = None
    try:
        body = gemini.generate_note_latex(
            concept_name, concept_summary, materials, pyqs, sibling_names,
            extra_instructions=extra_instructions, enhancement_keys=enhancement_keys,
            should_cancel=should_cancel,
        )
        if should_cancel():
            # Cancelled right after generation returned: don't waste a compile
            # (or a repair pass) on a note whose row the caller is about to
            # throw away.
            raise gemini.GeminiCancelled()
        clean = latex.sanitize_body(body)
        doc = latex.build_document(concept_name, clean)
        pdf_uuid = storage.new_uuid() + ".pdf"
        pdf_path = storage.course_notes_dir(course_id) / pdf_uuid
        try:
            latex.compile_to(doc, pdf_path)
        except latex.LatexError as compile_err:
            if should_cancel():
                raise gemini.GeminiCancelled()
            # One self-repair pass: hand the broken LaTeX + error back to the
            # model and recompile the corrected version.
            if job_id is not None:
                _set_job(job_id, message=f"Fixing LaTeX for “{concept_name}”{progress_label}…")
            fixed = gemini.repair_note_latex(concept_name, clean, str(compile_err), should_cancel=should_cancel)
            doc = latex.build_document(concept_name, latex.sanitize_body(fixed))
            latex.compile_to(doc, pdf_path)
        thumb_uuid = storage.new_uuid() + ".png"
        try:
            latex.render_thumbnail(
                storage.course_notes_dir(course_id) / pdf_uuid,
                storage.course_thumbs_dir(course_id) / thumb_uuid,
            )
        except Exception:
            thumb_uuid = None  # thumbnail is optional; PDF still valid
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE notes SET latex_source = ?, pdf_disk_uuid = ?, thumb_disk_uuid = ?, "
                "status = 'compiled', error_message = NULL WHERE id = ?",
                (doc, pdf_uuid, thumb_uuid, note_id),
            )
            conn.commit()
        finally:
            conn.close()
        return True
    except gemini.GeminiCancelled:
        raise
    except Exception as e:
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE notes SET latex_source = ?, status = 'failed', error_message = ? WHERE id = ?",
                (doc, f"{type(e).__name__}: {e}", note_id),
            )
            conn.commit()
        finally:
            conn.close()
        return False


def run_note_retry(note_id: int, job_id: int | None = None) -> None:
    """Retry ONE failed (or stuck) note: same pipeline as run_generate_job's
    per-concept step, but scoped to a single existing note row. The caller
    (the /notes/{id}/retry endpoint) has already flipped the note to
    'generating' before starting this in a background thread.
    """
    conn = db.get_connection()
    try:
        note = conn.execute(
            "SELECT id, course_id, lesson_id, concept_id, title, pdf_disk_uuid, thumb_disk_uuid "
            "FROM notes WHERE id = ?",
            (note_id,),
        ).fetchone()
        if note is None:
            return
        concept = None
        if note["concept_id"] is not None:
            concept = conn.execute(
                "SELECT id, name, summary FROM concepts WHERE id = ?", (note["concept_id"],)
            ).fetchone()
        sibling_names = [
            r["name"] for r in conn.execute(
                "SELECT name FROM concepts WHERE course_id = ? AND id != ?",
                (note["course_id"], note["concept_id"]),
            ).fetchall()
        ] if note["concept_id"] is not None else []
    finally:
        conn.close()

    concept_name = concept["name"] if concept is not None else note["title"]
    concept_summary = concept["summary"] if concept is not None else ""

    try:
        # Clear old compiled output (files + row state) before regenerating.
        _remove_note_files(note["course_id"], note)
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE notes SET status = 'generating', error_message = NULL, "
                "pdf_disk_uuid = NULL, thumb_disk_uuid = NULL WHERE id = ?",
                (note_id,),
            )
            conn.commit()
        finally:
            conn.close()

        atts = gather_course_attachments(note["course_id"])
        materials = atts["material"]
        pyqs = atts["pyq"]
        instr, keys = _effective_note_prefs(note["course_id"])

        _compile_one_note(
            note["course_id"], note_id, concept_name, concept_summary,
            materials, pyqs, sibling_names,
            extra_instructions=instr, enhancement_keys=keys, job_id=job_id,
        )
    except gemini.GeminiCancelled:
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE notes SET status = 'failed', error_message = 'Cancelled.' WHERE id = ?",
                (note_id,),
            )
            conn.commit()
        finally:
            conn.close()
    except Exception as e:
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE notes SET status = 'failed', error_message = ? WHERE id = ?",
                (f"{type(e).__name__}: {e}", note_id),
            )
            conn.commit()
        finally:
            conn.close()
    finally:
        # Close out the 1-note job so the progress card + Cancel button clear
        # (and _active_job stops blocking the next retry for this course).
        if job_id is not None:
            _set_job(job_id, status="done", progress=1, message="Done.")


def run_generate_job(course_id: int, job_id: int, mode: str = "new", concept_ids=None) -> None:
    """Note-generation job body: one compiled PDF per concept (runs in a thread).

    Each concept is generated, compiled, and thumbnailed independently — a single
    failure is recorded on that note (status='failed' + error_message) and the
    loop continues, so one bad concept never sinks the whole batch.

    mode='all' reproduces the original behavior exactly (used by an explicit
    "Regenerate all"): remove every existing note (files + rows) and generate
    one fresh note per concept.

    mode='new' (default, Build 6 Step 5 — incremental generation): generate
    notes ONLY for concepts that don't already have a note row — existing
    notes are left completely untouched (no file/row deletion at all).
    """
    try:
        _set_job(job_id, status="running", message="Preparing materials…")
        atts = gather_course_attachments(course_id)
        materials = atts["material"]
        pyqs = atts["pyq"]
        instr, keys = _effective_note_prefs(course_id)

        conn = db.get_connection()
        try:
            if mode == "all":
                concepts = conn.execute(
                    "SELECT id, name, summary FROM concepts WHERE course_id = ? ORDER BY order_index, id",
                    (course_id,),
                ).fetchall()
            elif mode == "selected":
                sel = [int(x) for x in (concept_ids or [])]
                qs = ",".join("?" * len(sel)) if sel else "NULL"
                concepts = conn.execute(
                    f"SELECT id, name, summary FROM concepts WHERE course_id = ? AND id IN ({qs}) ORDER BY order_index, id",
                    (course_id, *sel),
                ).fetchall() if sel else []
            else:
                concepts = conn.execute(
                    "SELECT id, name, summary FROM concepts WHERE course_id = ? "
                    "AND id NOT IN (SELECT concept_id FROM notes WHERE course_id = ? AND concept_id IS NOT NULL) "
                    "ORDER BY order_index, id",
                    (course_id, course_id),
                ).fetchall()
            # Full course concept-name list (regardless of mode/selection),
            # fetched once, so each note's prompt can list the OTHER concepts
            # as siblings (keeps sibling notes from a single source PDF from
            # re-teaching the same background / near-cloning) — new notes
            # must stay consistent with concepts that already have notes too.
            all_names = [
                r["name"] for r in conn.execute(
                    "SELECT name FROM concepts WHERE course_id = ? ORDER BY order_index, id",
                    (course_id,),
                ).fetchall()
            ]
            lesson = conn.execute(
                "SELECT id FROM lessons WHERE course_id = ? ORDER BY id LIMIT 1", (course_id,)
            ).fetchone()
            if lesson is None:
                cur = conn.execute(
                    "INSERT INTO lessons (course_id, title, order_index) VALUES (?, 'All notes', 0)",
                    (course_id,),
                )
                conn.commit()
                lesson_id = cur.lastrowid
            else:
                lesson_id = lesson["id"]
            old_notes = conn.execute(
                "SELECT id, pdf_disk_uuid, thumb_disk_uuid FROM notes WHERE course_id = ?",
                (course_id,),
            ).fetchall()
        finally:
            conn.close()

        if mode == "all":
            if not concepts:
                raise RuntimeError("No concepts yet — analyze the materials first.")
            # Regeneration replaces prior notes (files + rows).
            for r in old_notes:
                _remove_note_files(course_id, r)
            conn = db.get_connection()
            try:
                conn.execute("DELETE FROM notes WHERE course_id = ?", (course_id,))
                conn.commit()
            finally:
                conn.close()
        elif mode == "selected":
            if not concepts:
                _set_job(job_id, status="done", message="No concepts selected.")
                return
            # Replace any existing notes for exactly the chosen concepts.
            sel = [c["id"] for c in concepts]
            qs = ",".join("?" * len(sel))
            conn = db.get_connection()
            try:
                for r in conn.execute(
                    f"SELECT id, pdf_disk_uuid, thumb_disk_uuid FROM notes WHERE course_id = ? AND concept_id IN ({qs})",
                    (course_id, *sel),
                ).fetchall():
                    _remove_note_files(course_id, r)
                conn.execute(f"DELETE FROM notes WHERE course_id = ? AND concept_id IN ({qs})", (course_id, *sel))
                conn.commit()
            finally:
                conn.close()
        else:
            if not concepts:
                _set_job(job_id, status="done", message="No new concepts to generate.")
                return

        total = len(concepts)
        _set_job(job_id, total=total, progress=0, message=f"Generating notes (0/{total})…")
        compiled = failed = 0
        cancelled = False

        for i, cpt in enumerate(concepts):
            if _is_cancelled(job_id):
                cancelled = True
                break
            conn = db.get_connection()
            try:
                cur = conn.execute(
                    "INSERT INTO notes (course_id, lesson_id, concept_id, title, status) "
                    "VALUES (?, ?, ?, ?, 'generating')",
                    (course_id, lesson_id, cpt["id"], cpt["name"]),
                )
                conn.commit()
                note_id = cur.lastrowid
            finally:
                conn.close()

            sibling_names = [n for n in all_names if n != cpt["name"]]
            try:
                ok = _compile_one_note(
                    course_id, note_id, cpt["name"], cpt["summary"],
                    materials, pyqs, sibling_names,
                    extra_instructions=instr, enhancement_keys=keys,
                    job_id=job_id, progress_label=f" ({i + 1}/{total})",
                )
                if ok:
                    compiled += 1
                else:
                    failed += 1
            except gemini.GeminiCancelled:
                # Cancelled mid-call: this note never finished, so it's not
                # "kept" — remove the placeholder row rather than leaving it
                # stuck showing a "Generating…" spinner forever, and don't
                # count it as failed.
                conn = db.get_connection()
                try:
                    conn.execute("DELETE FROM notes WHERE id = ?", (note_id,))
                    conn.commit()
                finally:
                    conn.close()
                cancelled = True
                break

            _set_job(job_id, progress=i + 1, message=f"Generating notes ({i + 1}/{total})…")
            time.sleep(2)  # gentle on free-tier rate limits between calls

        if cancelled:
            msg = f"Cancelled — kept {compiled} note{'s' if compiled != 1 else ''}."
        else:
            msg = f"{compiled} note{'s' if compiled != 1 else ''} ready"
        if failed:
            msg += f", {failed} failed"
        _set_job(job_id, status="done", progress=compiled + failed, total=total, message=msg)
    except Exception as e:
        _set_job(job_id, status="failed", message=f"{type(e).__name__}: {e}")
