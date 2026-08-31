"""Course CRUD.

Every course belongs to a semester. Listing includes material/note counts so
the dashboard cards can show progress at a glance. Deleting a course cascades
its DB children and removes its files on disk.
"""
import json
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from .. import db
from ..services import storage, gemini

router = APIRouter()

# Shared projection: a course row plus live counts of its materials and notes.
COURSE_SELECT = """
    SELECT c.*,
      (SELECT COUNT(*) FROM materials m WHERE m.course_id = c.id) AS material_count,
      (SELECT COUNT(*) FROM notes n WHERE n.course_id = c.id) AS note_count
    FROM courses c
"""


class CourseCreate(BaseModel):
    semester_id: int
    name: str = Field(min_length=1, max_length=200)
    code: Optional[str] = Field(default=None, max_length=50)
    description: Optional[str] = Field(default=None, max_length=2000)


def _clean(s: Optional[str]) -> Optional[str]:
    if s is None:
        return None
    s = s.strip()
    return s or None


@router.get("/courses")
def list_courses(semester_id: Optional[int] = Query(default=None)):
    conn = db.get_connection()
    try:
        if semester_id is not None:
            rows = conn.execute(
                COURSE_SELECT + " WHERE c.semester_id = ? ORDER BY c.created_at DESC, c.id DESC",
                (semester_id,),
            ).fetchall()
        else:
            rows = conn.execute(
                COURSE_SELECT + " ORDER BY c.created_at DESC, c.id DESC"
            ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/courses/{course_id}")
def get_course(course_id: int):
    conn = db.get_connection()
    try:
        row = conn.execute(COURSE_SELECT + " WHERE c.id = ?", (course_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Course not found")
        return dict(row)
    finally:
        conn.close()


@router.post("/courses", status_code=201)
def create_course(payload: CourseCreate):
    name = payload.name.strip()
    code = _clean(payload.code)
    conn = db.get_connection()
    try:
        sem = conn.execute("SELECT id FROM semesters WHERE id = ?", (payload.semester_id,)).fetchone()
        if not sem:
            raise HTTPException(status_code=400, detail="Semester does not exist")
        dup_name = conn.execute(
            "SELECT 1 FROM courses WHERE semester_id = ? AND lower(trim(name)) = lower(trim(?))",
            (payload.semester_id, name),
        ).fetchone()
        if dup_name:
            raise HTTPException(
                status_code=409,
                detail=f"A course named '{name}' already exists in this semester.",
            )
        if code:
            dup_code = conn.execute(
                "SELECT 1 FROM courses WHERE semester_id = ? AND lower(trim(code)) = lower(trim(?))",
                (payload.semester_id, code),
            ).fetchone()
            if dup_code:
                raise HTTPException(
                    status_code=409,
                    detail=f"A course with code '{code}' already exists in this semester.",
                )
        cur = conn.execute(
            "INSERT INTO courses (semester_id, name, code, description) VALUES (?, ?, ?, ?)",
            (payload.semester_id, name, code, _clean(payload.description)),
        )
        conn.commit()
        row = conn.execute(COURSE_SELECT + " WHERE c.id = ?", (cur.lastrowid,)).fetchone()
        return dict(row)
    finally:
        conn.close()


class NotePrefs(BaseModel):
    """Per-course note-generation customization (Build 4, Step 1): optional
    free-text instructions plus a set of enhancement (memory-technique) keys,
    applied to the whole generation batch and to single-note retries."""
    instructions: Optional[str] = Field(default="", max_length=2000)
    enhancements: list[str] = Field(default_factory=list)


@router.put("/courses/{course_id}/note-prefs")
def set_note_prefs(course_id: int, payload: NotePrefs):
    conn = db.get_connection()
    try:
        if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
            raise HTTPException(status_code=404, detail="Course not found")
        instr = (payload.instructions or "").strip()
        keys = gemini.valid_enhancement_keys(payload.enhancements)  # drops unknown keys
        conn.execute(
            "UPDATE courses SET note_instructions = ?, note_enhancements = ? WHERE id = ?",
            (instr or None, json.dumps(keys), course_id),
        )
        conn.commit()
    finally:
        conn.close()
    return {"instructions": instr, "enhancements": keys}


@router.get("/note-enhancements")
def note_enhancements():
    return gemini.enhancement_catalog()


@router.delete("/courses/{course_id}")
def delete_course(course_id: int):
    conn = db.get_connection()
    try:
        cur = conn.execute("DELETE FROM courses WHERE id = ?", (course_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Course not found")
    finally:
        conn.close()
    storage.remove_course_files(course_id)
    return {"ok": True}
