"""Semester CRUD.

Semesters are the top-level grouping; courses live under them. Deleting a
semester cascades to its courses (and their children) in the DB, and we also
clean up each course's files on disk.

Scoped per account (Build 8 — multi-account): every semester carries a
`user_id`, and list/create are filtered/stamped by the logged-in account
(`user["id"]` from `auth.require_auth`). Archive/unarchive/delete verify
ownership too (`WHERE id = ? AND user_id = ?`) — this app doesn't otherwise
enforce per-row ownership (see auth.py's docstring), but semesters are cheap
to guard directly since they're looked up by id here anyway.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from .. import auth, db
from ..services import storage

router = APIRouter()


class SemesterCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


@router.get("/semesters")
def list_semesters(include_archived: bool = False, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        where = "WHERE s.user_id = ?" if include_archived else "WHERE s.user_id = ? AND s.archived = 0"
        rows = conn.execute(
            f"""
            SELECT s.*,
              (SELECT COUNT(*) FROM courses c WHERE c.semester_id = s.id) AS course_count
            FROM semesters s
            {where}
            ORDER BY s.created_at DESC, s.id DESC
            """,
            (user["id"],),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/semesters", status_code=201)
def create_semester(payload: SemesterCreate, user: dict = Depends(auth.require_auth)):
    name = payload.name.strip()
    conn = db.get_connection()
    try:
        dup = conn.execute(
            "SELECT 1 FROM semesters WHERE user_id = ? AND lower(trim(name)) = lower(trim(?))",
            (user["id"], name),
        ).fetchone()
        if dup:
            raise HTTPException(
                status_code=409, detail=f"A semester named '{name}' already exists."
            )
        cur = conn.execute(
            "INSERT INTO semesters (name, user_id) VALUES (?, ?)", (name, user["id"])
        )
        conn.commit()
        row = conn.execute(
            "SELECT s.*, 0 AS course_count FROM semesters s WHERE s.id = ?", (cur.lastrowid,)
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.post("/semesters/{semester_id}/archive")
def archive_semester(semester_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        cur = conn.execute(
            "UPDATE semesters SET archived = 1 WHERE id = ? AND user_id = ?",
            (semester_id, user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Semester not found")
    finally:
        conn.close()
    return {"ok": True}


@router.post("/semesters/{semester_id}/unarchive")
def unarchive_semester(semester_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        cur = conn.execute(
            "UPDATE semesters SET archived = 0 WHERE id = ? AND user_id = ?",
            (semester_id, user["id"]),
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Semester not found")
    finally:
        conn.close()
    return {"ok": True}


@router.delete("/semesters/{semester_id}")
def delete_semester(semester_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        course_ids = [
            r[0] for r in conn.execute(
                "SELECT id FROM courses WHERE semester_id = ?", (semester_id,)
            ).fetchall()
        ]
        cur = conn.execute(
            "DELETE FROM semesters WHERE id = ? AND user_id = ?", (semester_id, user["id"])
        )
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Semester not found")
    finally:
        conn.close()
    for cid in course_ids:
        storage.remove_course_files(cid)
    return {"ok": True}
