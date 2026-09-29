"""Schedule generation + read endpoints (Build 2, Step 2).

The scheduler (services/scheduler.py) is a pure function that computes items
from exams/concepts; this router owns persistence (replace-all per semester,
inside one transaction) and the read/join endpoints used by the UI later.

Scoped per account (Build 8 — multi-account): the aggregate endpoints
(`/schedule/upcoming`, `/schedule/overdue`, `/schedule/generate-all`) only
ever consider semesters owned by the logged-in account (`user["id"]` from
`auth.require_auth`), and per-semester generate/read also verify the semester
belongs to that account. The scheduler's daily_capacity/study_off_days prefs
now come from THIS account's profile row, not a hardcoded id=1.
"""
from datetime import date, datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from .. import auth, db
from ..services import scheduler

router = APIRouter()


class ScheduleMoveIn(BaseModel):
    exam_id: int
    concept_id: int
    study_date: str


class ScheduleOverrideIn(BaseModel):
    exam_id: int
    concept_id: int

# Shared projection: a schedule item plus everything the UI needs to render it
# without extra round-trips — course/exam/concept names, and the resolved
# compiled note (most recent compiled note for that concept, if any).
SCHEDULE_SELECT = """
    SELECT si.id, si.semester_id, si.course_id, si.exam_id, si.concept_id,
           si.study_date, si.order_index, si.created_at,
           c.name AS course_name, c.code AS course_code,
           e.name AS exam_name, e.exam_date AS exam_date,
           cpt.name AS concept_name,
           n.id AS note_id,
           (n.thumb_disk_uuid IS NOT NULL) AS note_has_thumb,
           n.status AS note_status,
           COALESCE(lp.done, 0) AS done,
           lp.best_score AS best_score, lp.best_total AS best_total,
           (so.id IS NOT NULL) AS moved
    FROM schedule_items si
    JOIN courses c ON c.id = si.course_id
    JOIN exams e ON e.id = si.exam_id
    JOIN concepts cpt ON cpt.id = si.concept_id
    LEFT JOIN (
        SELECT concept_id, MAX(id) AS note_id
        FROM notes
        WHERE status = 'compiled'
        GROUP BY concept_id
    ) latest ON latest.concept_id = si.concept_id
    LEFT JOIN notes n ON n.id = latest.note_id
    LEFT JOIN lesson_progress lp ON lp.concept_id = si.concept_id
    LEFT JOIN schedule_overrides so ON so.exam_id = si.exam_id AND so.concept_id = si.concept_id
"""


def _require_semester(conn, semester_id: int, user_id: int) -> None:
    if not conn.execute(
        "SELECT 1 FROM semesters WHERE id = ? AND user_id = ?", (semester_id, user_id)
    ).fetchone():
        raise HTTPException(status_code=404, detail="Semester not found")


def _require_course(conn, course_id: int) -> None:
    if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
        raise HTTPException(status_code=404, detail="Course not found")


def _profile_schedule_prefs(user_id: int) -> tuple[int, set[int]]:
    """Read THIS account's study preferences (daily_capacity, study_off_days)
    from its user_profile row for the scheduler to honor (Build 5, Step 5;
    scoped per account in Build 8). Safe defaults (2, no off-days) on any
    miss — a missing/corrupt profile must never break schedule generation."""
    try:
        conn = db.get_connection()
        try:
            row = conn.execute(
                "SELECT daily_capacity, study_off_days FROM user_profile WHERE id = ?",
                (user_id,),
            ).fetchone()
        finally:
            conn.close()
        if not row:
            return 2, set()
        cap = row["daily_capacity"] if row["daily_capacity"] else 2
        off_days: set[int] = set()
        if row["study_off_days"]:
            import json
            try:
                off_days = {int(x) for x in json.loads(row["study_off_days"])}
            except Exception:
                off_days = set()
        return int(cap), off_days
    except Exception:
        return 2, set()


def _ics_escape(text: str) -> str:
    """RFC 5545 text escaping: backslash-escape \\, ; , and newlines."""
    text = text or ""
    text = text.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
    text = text.replace("\r\n", "\\n").replace("\n", "\\n")
    return text


def _build_ics(rows) -> str:
    """Render schedule rows (from SCHEDULE_SELECT) as an iCalendar feed, one
    all-day VEVENT per schedule item."""
    now = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Axiom//Study Schedule//EN",
        "CALSCALE:GREGORIAN",
    ]
    for r in rows:
        study_date = date.fromisoformat(r["study_date"])
        dtstart = study_date.strftime("%Y%m%d")
        dtend = (study_date + timedelta(days=1)).strftime("%Y%m%d")
        summary = _ics_escape(f"Study: {r['concept_name']} \u2014 {r['course_name']}")
        description = _ics_escape(f"for {r['exam_name']}")
        lines += [
            "BEGIN:VEVENT",
            f"UID:axiom-{r['id']}@axiom",
            f"DTSTAMP:{now}",
            f"DTSTART;VALUE=DATE:{dtstart}",
            f"DTEND;VALUE=DATE:{dtend}",
            f"SUMMARY:{summary}",
            f"DESCRIPTION:{description}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def _replace_schedule(conn, semester_id: int, items: list[dict]) -> None:
    """Delete-then-insert the full schedule for a semester in one transaction."""
    conn.execute("DELETE FROM schedule_items WHERE semester_id = ?", (semester_id,))
    if items:
        conn.executemany(
            "INSERT INTO schedule_items "
            "(semester_id, course_id, exam_id, concept_id, study_date, order_index) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            [
                (it["semester_id"], it["course_id"], it["exam_id"], it["concept_id"],
                 it["study_date"], it["order_index"])
                for it in items
            ],
        )
    conn.commit()


# ---------- synthetic revision rows (Build 12 "Question Analysis", Phase 4) ----------
#
# A revision PDF covers a whole exam (many concepts, or none ticked at all),
# so it can never be a `schedule_items` row: that table's `concept_id` is
# NOT NULL and SCHEDULE_SELECT inner-joins concepts. Instead we synthesize
# one dict per upcoming exam here and splice it into the same list the
# frontend already renders — scheduler.py/schedule_items are never touched.
# See frontend/ANALYSIS.md §6.
def _revision_rows(
    conn, user_id: int, start: str, to: Optional[str] = None, semester_id: Optional[int] = None,
) -> list[dict]:
    """One synthetic row per upcoming exam (`exam_date >= start`) in scope,
    LEFT JOINed to its `revisions` row (if any has been generated yet).
    `study_date` is clamped to `max(exam_date - 1 day, start)` — a past exam
    (exam_date < start) is excluded outright by the WHERE clause, and any
    exam whose clamped study_date falls outside [start, to] is dropped too.

    Scoping mirrors the two call sites: pass `semester_id` for the single-
    semester endpoint (already ownership-checked by the caller, same as its
    schedule_items query — no separate archived filter, matching that
    endpoint's existing behavior); leave it None for the account-wide
    `/schedule/upcoming` endpoint, which instead filters to THIS account's
    non-archived semesters (mirrors SCHEDULE_SELECT's own scoping there).
    """
    sql = """
        SELECT e.id AS exam_id, e.name AS exam_name, e.exam_date AS exam_date,
               c.id AS course_id, c.name AS course_name, c.code AS course_code,
               c.semester_id AS semester_id,
               r.id AS revision_id, r.status AS revision_status
        FROM exams e
        JOIN courses c ON c.id = e.course_id
        JOIN semesters s ON s.id = c.semester_id
        LEFT JOIN revisions r ON r.exam_id = e.id
        WHERE e.exam_date >= ?
    """
    params: list = [start]
    if semester_id is not None:
        sql += " AND c.semester_id = ?"
        params.append(semester_id)
    else:
        sql += " AND s.user_id = ? AND s.archived = 0"
        params.append(user_id)
    rows = conn.execute(sql, params).fetchall()

    start_day = date.fromisoformat(start)
    out: list[dict] = []
    for r in rows:
        try:
            exam_day = date.fromisoformat(r["exam_date"])
        except (ValueError, TypeError):
            continue
        study_day = exam_day - timedelta(days=1)
        if study_day < start_day:
            study_day = start_day
        study_date = study_day.isoformat()
        if to and study_date > to:
            continue
        out.append({
            "id": f"rev-{r['exam_id']}",
            "kind": "revision",
            "exam_id": r["exam_id"],
            "course_id": r["course_id"],
            "semester_id": r["semester_id"],
            "course_name": r["course_name"],
            "course_code": r["course_code"],
            "exam_name": r["exam_name"],
            "exam_date": r["exam_date"],
            "study_date": study_date,
            "revision_id": r["revision_id"],
            "revision_status": r["revision_status"],
            "done": 0,
        })
    return out


def _merge_schedule_rows(lesson_rows: list[dict], revision_rows: list[dict]) -> list[dict]:
    """Combine real (schedule_items-backed) lesson rows with synthetic
    revision rows and re-sort by study_date (then course, then order —
    revision rows carry no order_index of their own, so they sort first
    within their day/course)."""
    for r in lesson_rows:
        r["kind"] = "lesson"
    combined = lesson_rows + revision_rows
    combined.sort(key=lambda r: (r["study_date"], r["course_id"], r.get("order_index", -1)))
    return combined


@router.post("/semesters/{semester_id}/schedule/generate")
def generate_schedule(semester_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_semester(conn, semester_id, user["id"])
        cap, skip = _profile_schedule_prefs(user["id"])
        items = scheduler.build_schedule(semester_id, cap=cap, skip_weekdays=skip)
        _replace_schedule(conn, semester_id, items)
        days = len({it["study_date"] for it in items})
        return {"generated": len(items), "days": days}
    finally:
        conn.close()


@router.post("/schedule/generate-all")
def generate_all_schedules(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        semester_ids = [
            r[0] for r in conn.execute(
                "SELECT DISTINCT c.semester_id FROM exams e "
                "JOIN courses c ON c.id = e.course_id "
                "JOIN semesters s ON s.id = c.semester_id "
                "WHERE s.archived = 0 AND s.user_id = ?",
                (user["id"],),
            ).fetchall()
        ]
        cap, skip = _profile_schedule_prefs(user["id"])
        total = 0
        for sid in semester_ids:
            items = scheduler.build_schedule(sid, cap=cap, skip_weekdays=skip)
            _replace_schedule(conn, sid, items)
            total += len(items)
        return {"semesters": len(semester_ids), "generated": total}
    finally:
        conn.close()


def _resolve_semester_for_exam(conn, exam_id: int, user_id: int) -> int:
    """Resolve exam -> course -> semester and verify it belongs to THIS
    account (mirrors _require_semester's ownership check, but starting from
    an exam id). 404 if the exam doesn't exist or belongs to another
    account's semester."""
    row = conn.execute(
        "SELECT co.semester_id AS semester_id FROM exams e "
        "JOIN courses co ON co.id = e.course_id "
        "JOIN semesters s ON s.id = co.semester_id "
        "WHERE e.id = ? AND s.user_id = ?",
        (exam_id, user_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    return row["semester_id"]


@router.patch("/schedule/move")
def move_schedule_item(body: ScheduleMoveIn, user: dict = Depends(auth.require_auth)):
    """Pin a lesson (exam_id, concept_id) to a manually-chosen study_date —
    the durable form of a dashboard drag-to-a-different-day move. Stored in
    schedule_overrides (upsert on the (exam_id, concept_id) unique key) so it
    survives _replace_schedule's delete-and-reinsert on the next automatic
    regenerate (scheduler.build_schedule reads this table and honors it)."""
    try:
        parsed_date = date.fromisoformat(body.study_date)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Invalid study_date")

    conn = db.get_connection()
    try:
        semester_id = _resolve_semester_for_exam(conn, body.exam_id, user["id"])
        if not conn.execute(
            "SELECT 1 FROM exam_concepts WHERE exam_id = ? AND concept_id = ?",
            (body.exam_id, body.concept_id),
        ).fetchone():
            raise HTTPException(status_code=400, detail="Concept is not part of this exam")

        conn.execute(
            "INSERT INTO schedule_overrides (user_id, semester_id, exam_id, concept_id, study_date) "
            "VALUES (?, ?, ?, ?, ?) "
            "ON CONFLICT(exam_id, concept_id) DO UPDATE SET "
            "study_date = excluded.study_date, user_id = excluded.user_id, "
            "semester_id = excluded.semester_id",
            (user["id"], semester_id, body.exam_id, body.concept_id, parsed_date.isoformat()),
        )
        conn.commit()

        cap, skip = _profile_schedule_prefs(user["id"])
        items = scheduler.build_schedule(semester_id, cap=cap, skip_weekdays=skip)
        _replace_schedule(conn, semester_id, items)
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/schedule/override")
def delete_schedule_override(body: ScheduleOverrideIn, user: dict = Depends(auth.require_auth)):
    """Remove a manual pin, returning the lesson to automatic placement on the
    next regenerate (performed here immediately, same as move_schedule_item)."""
    conn = db.get_connection()
    try:
        semester_id = _resolve_semester_for_exam(conn, body.exam_id, user["id"])
        conn.execute(
            "DELETE FROM schedule_overrides WHERE exam_id = ? AND concept_id = ?",
            (body.exam_id, body.concept_id),
        )
        conn.commit()

        cap, skip = _profile_schedule_prefs(user["id"])
        items = scheduler.build_schedule(semester_id, cap=cap, skip_weekdays=skip)
        _replace_schedule(conn, semester_id, items)
        return {"ok": True}
    finally:
        conn.close()


@router.get("/semesters/{semester_id}/schedule")
def get_semester_schedule(
    semester_id: int,
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    user: dict = Depends(auth.require_auth),
):
    conn = db.get_connection()
    try:
        _require_semester(conn, semester_id, user["id"])
        sql = SCHEDULE_SELECT + " WHERE si.semester_id = ?"
        params: list = [semester_id]
        if from_:
            sql += " AND si.study_date >= ?"
            params.append(from_)
        if to:
            sql += " AND si.study_date <= ?"
            params.append(to)
        sql += " ORDER BY si.study_date ASC, si.course_id ASC, si.order_index ASC"
        rows = conn.execute(sql, params).fetchall()
        lesson_rows = [dict(r) for r in rows]
        rev_start = from_ or date.today().isoformat()
        rev_rows = _revision_rows(conn, user["id"], rev_start, to, semester_id=semester_id)
        return _merge_schedule_rows(lesson_rows, rev_rows)
    finally:
        conn.close()


@router.get("/schedule/upcoming")
def upcoming_schedule(
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    user: dict = Depends(auth.require_auth),
):
    conn = db.get_connection()
    try:
        start = from_ or date.today().isoformat()
        sql = (
            SCHEDULE_SELECT
            + " WHERE si.study_date >= ?"
            + " AND si.semester_id IN (SELECT id FROM semesters WHERE user_id = ? AND archived = 0)"
        )
        params: list = [start, user["id"]]
        if to:
            sql += " AND si.study_date <= ?"
            params.append(to)
        sql += " ORDER BY si.study_date ASC, si.course_id ASC, si.order_index ASC"
        rows = conn.execute(sql, params).fetchall()
        lesson_rows = [dict(r) for r in rows]
        rev_rows = _revision_rows(conn, user["id"], start, to)
        return _merge_schedule_rows(lesson_rows, rev_rows)
    finally:
        conn.close()


@router.get("/schedule/overdue")
def overdue(today: Optional[str] = Query(default=None), user: dict = Depends(auth.require_auth)):
    """Count schedule items strictly before `today` (default: real today) that
    are still not done, for THIS account's non-archived semesters. Polled by
    the dashboard to decide whether a catch-up regenerate is needed
    (Build 5, Step 1; scoped per account in Build 8)."""
    day = today or date.today().isoformat()
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT COUNT(*) AS n FROM schedule_items si "
            "LEFT JOIN lesson_progress lp ON lp.concept_id = si.concept_id "
            "WHERE si.study_date < ? AND COALESCE(lp.done, 0) = 0 "
            "AND si.semester_id IN (SELECT id FROM semesters WHERE user_id = ? AND archived = 0)",
            (day, user["id"]),
        ).fetchone()
        return {"count": row["n"]}
    finally:
        conn.close()


@router.get("/semesters/{semester_id}/schedule.ics")
def semester_schedule_ics(semester_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        _require_semester(conn, semester_id, user["id"])
        sql = SCHEDULE_SELECT + " WHERE si.semester_id = ? ORDER BY si.study_date ASC, si.course_id ASC, si.order_index ASC"
        rows = conn.execute(sql, (semester_id,)).fetchall()
    finally:
        conn.close()
    ics = _build_ics(rows)
    return Response(
        content=ics, media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="axiom-schedule.ics"'},
    )


@router.get("/schedule/upcoming.ics")
def upcoming_schedule_ics(
    from_: Optional[str] = Query(default=None, alias="from"),
    to: Optional[str] = Query(default=None),
    user: dict = Depends(auth.require_auth),
):
    conn = db.get_connection()
    try:
        start = from_ or date.today().isoformat()
        sql = (
            SCHEDULE_SELECT
            + " WHERE si.study_date >= ?"
            + " AND si.semester_id IN (SELECT id FROM semesters WHERE user_id = ? AND archived = 0)"
        )
        params: list = [start, user["id"]]
        if to:
            sql += " AND si.study_date <= ?"
            params.append(to)
        sql += " ORDER BY si.study_date ASC, si.course_id ASC, si.order_index ASC"
        rows = conn.execute(sql, params).fetchall()
    finally:
        conn.close()
    ics = _build_ics(rows)
    return Response(
        content=ics, media_type="text/calendar",
        headers={"Content-Disposition": 'attachment; filename="axiom-schedule.ics"'},
    )


@router.get("/courses/{course_id}/schedule")
def course_schedule(course_id: int):
    conn = db.get_connection()
    try:
        _require_course(conn, course_id)
        sql = SCHEDULE_SELECT + " WHERE si.course_id = ? ORDER BY si.study_date ASC, si.order_index ASC"
        rows = conn.execute(sql, (course_id,)).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()
