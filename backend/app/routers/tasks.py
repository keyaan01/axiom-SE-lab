"""Global background-task tray: a single read endpoint aggregating every
active background task across the whole app (jobs + in-flight quiz
generation), so the frontend can show one always-on tray regardless of which
course/view is on screen. Read-only — no writes here.
"""
from fastapi import APIRouter
from .. import db

router = APIRouter()

_JOB_LABELS = {
    "extract": "Analyzing materials",
    "generate": "Generating notes",
}


@router.get("/tasks/active")
def active_tasks():
    conn = db.get_connection()
    try:
        job_rows = conn.execute(
            "SELECT jobs.id AS job_id, jobs.course_id AS course_id, jobs.type AS type, "
            "jobs.message AS message, courses.name AS course_name "
            "FROM jobs JOIN courses ON courses.id = jobs.course_id "
            "WHERE jobs.status IN ('queued','running') "
            "ORDER BY jobs.id ASC",
        ).fetchall()
        quiz_rows = conn.execute(
            "SELECT quizzes.course_id AS course_id, courses.name AS course_name, "
            "COUNT(*) AS count "
            "FROM quizzes JOIN courses ON courses.id = quizzes.course_id "
            "WHERE quizzes.status = 'generating' "
            "GROUP BY quizzes.course_id, courses.name "
            "ORDER BY quizzes.course_id ASC",
        ).fetchall()
    finally:
        conn.close()

    tasks = []
    for row in job_rows:
        base_label = _JOB_LABELS.get(row["type"], row["type"])
        tasks.append({
            "kind": row["type"],
            "course_id": row["course_id"],
            "course_name": row["course_name"],
            "label": f"{base_label} — {row['course_name']}",
            "message": row["message"],
            "cancelable": True,
            "job_id": row["job_id"],
        })
    for row in quiz_rows:
        count = row["count"]
        verb = "Generating quiz" if count == 1 else "Generating quizzes"
        tasks.append({
            "kind": "quiz",
            "course_id": row["course_id"],
            "course_name": row["course_name"],
            "label": f"{verb} — {row['course_name']}",
            "count": count,
            "cancelable": False,
        })

    return {"tasks": tasks, "count": len(tasks)}
