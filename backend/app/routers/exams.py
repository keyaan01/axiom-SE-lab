"""Exam CRUD + concept ticking (Build 2, Step 1).

An exam belongs to a course and marks a study window (study_start_date ->
exam_date). Which concepts it covers is a many-to-many tick set stored in
exam_concepts, edited wholesale via PUT /exams/{id}/concepts (delete-then-
insert, same pattern as replacing concepts on re-analysis). Schedule
generation from this data is a later step — this step is just the model,
CRUD, and the concept checklist.
"""
import re
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .. import db

router = APIRouter()

DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")

# Shared projection: an exam row plus a live count of ticked concepts.
EXAM_SELECT = """
    SELECT e.*,
      (SELECT COUNT(*) FROM exam_concepts ec WHERE ec.exam_id = e.id) AS concept_count
    FROM exams e
"""


class ExamCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    study_start_date: str
    exam_date: str


class ExamUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    study_start_date: Optional[str] = None
    exam_date: Optional[str] = None


class ExamConceptsUpdate(BaseModel):
    concept_ids: List[int] = Field(default_factory=list)


def _require_course(conn, course_id: int) -> None:
    if not conn.execute("SELECT 1 FROM courses WHERE id = ?", (course_id,)).fetchone():
        raise HTTPException(status_code=404, detail="Course not found")


def _require_exam(conn, exam_id: int):
    row = conn.execute(EXAM_SELECT + " WHERE e.id = ?", (exam_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Exam not found")
    return row


def _parse_date(label: str, value: str) -> date:
    if not DATE_RE.match(value or ""):
        raise HTTPException(status_code=400, detail=f"{label} must be in YYYY-MM-DD format")
    try:
        return date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"{label} is not a valid calendar date")


def _validate_dates(study_start_date: str, exam_date: str) -> None:
    start = _parse_date("Study start date", study_start_date)
    end = _parse_date("Exam date", exam_date)
    if end < start:
        raise HTTPException(status_code=400, detail="Exam date must be on or after study start date")


@router.post("/courses/{course_id}/exams", status_code=201)
def create_exam(course_id: int, payload: ExamCreate):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name cannot be empty")
    _validate_dates(payload.study_start_date, payload.exam_date)
    conn = db.get_connection()
    try:
        _require_course(conn, course_id)
        cur = conn.execute(
            "INSERT INTO exams (course_id, name, study_start_date, exam_date) VALUES (?, ?, ?, ?)",
            (course_id, name, payload.study_start_date, payload.exam_date),
        )
        conn.commit()
        row = _require_exam(conn, cur.lastrowid)
        return dict(row)
    finally:
        conn.close()


@router.get("/courses/{course_id}/exams")
def list_exams(course_id: int):
    conn = db.get_connection()
    try:
        _require_course(conn, course_id)
        rows = conn.execute(
            EXAM_SELECT + " WHERE e.course_id = ? ORDER BY e.exam_date ASC, e.id ASC",
            (course_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.get("/exams/{exam_id}")
def get_exam(exam_id: int):
    conn = db.get_connection()
    try:
        row = _require_exam(conn, exam_id)
        concept_ids = [
            r[0] for r in conn.execute(
                "SELECT concept_id FROM exam_concepts WHERE exam_id = ? ORDER BY concept_id ASC",
                (exam_id,),
            ).fetchall()
        ]
        out = dict(row)
        out["concept_ids"] = concept_ids
        return out
    finally:
        conn.close()


@router.patch("/exams/{exam_id}")
def update_exam(exam_id: int, payload: ExamUpdate):
    conn = db.get_connection()
    try:
        row = _require_exam(conn, exam_id)

        name = row["name"]
        if payload.name is not None:
            name = payload.name.strip()
            if not name:
                raise HTTPException(status_code=400, detail="Name cannot be empty")

        study_start_date = payload.study_start_date if payload.study_start_date is not None else row["study_start_date"]
        exam_date = payload.exam_date if payload.exam_date is not None else row["exam_date"]
        if payload.study_start_date is not None or payload.exam_date is not None:
            _validate_dates(study_start_date, exam_date)

        conn.execute(
            "UPDATE exams SET name = ?, study_start_date = ?, exam_date = ? WHERE id = ?",
            (name, study_start_date, exam_date, exam_id),
        )
        conn.commit()
        return dict(_require_exam(conn, exam_id))
    finally:
        conn.close()


@router.delete("/exams/{exam_id}")
def delete_exam(exam_id: int):
    conn = db.get_connection()
    try:
        cur = conn.execute("DELETE FROM exams WHERE id = ?", (exam_id,))
        conn.commit()
        if cur.rowcount == 0:
            raise HTTPException(status_code=404, detail="Exam not found")
    finally:
        conn.close()
    return {"ok": True}


@router.put("/exams/{exam_id}/concepts")
def set_exam_concepts(exam_id: int, payload: ExamConceptsUpdate):
    conn = db.get_connection()
    try:
        exam = _require_exam(conn, exam_id)
        concept_ids = sorted(set(payload.concept_ids))
        if concept_ids:
            placeholders = ",".join("?" for _ in concept_ids)
            rows = conn.execute(
                f"SELECT id FROM concepts WHERE course_id = ? AND id IN ({placeholders})",
                (exam["course_id"], *concept_ids),
            ).fetchall()
            found = {r[0] for r in rows}
            missing = [cid for cid in concept_ids if cid not in found]
            if missing:
                raise HTTPException(
                    status_code=400,
                    detail=f"concept_ids {missing} do not belong to this exam's course",
                )
        conn.execute("DELETE FROM exam_concepts WHERE exam_id = ?", (exam_id,))
        conn.executemany(
            "INSERT INTO exam_concepts (exam_id, concept_id) VALUES (?, ?)",
            [(exam_id, cid) for cid in concept_ids],
        )
        conn.commit()
        return {"concept_ids": concept_ids}
    finally:
        conn.close()
