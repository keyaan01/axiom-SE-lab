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
from .. import auth, db
from ..services import scheduler

router = APIRouter()

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
           COALESCE(lp.done, 0) AS done
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
        return [dict(r) for r in rows]
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
        return [dict(r) for r in rows]
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
