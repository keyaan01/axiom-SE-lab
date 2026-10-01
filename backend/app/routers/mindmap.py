"""Curriculum-wide mind map (Build 10 — "Constellation"): a read-only graph
view over an account's whole curriculum (all semesters, archived included)
plus AI-discovered relationships between concepts (concept_links), refreshed
on demand by a background discovery job (services/mindmap_service.py).

Scoped per account like semesters.py/schedule.py/prompts.py — every query is
filtered by the logged-in user's `user_id` via the semesters they own.
"""
import threading
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from .. import auth, db
from ..services import mindmap_service

router = APIRouter()


def _concept_owned(conn, user_id: int, concept_id: int) -> bool:
    """True iff `concept_id` belongs to a course/semester owned by `user_id`."""
    row = conn.execute(
        """
        SELECT 1
        FROM concepts c
        JOIN courses co ON co.id = c.course_id
        JOIN semesters s ON s.id = co.semester_id
        WHERE c.id = ? AND s.user_id = ?
        """,
        (concept_id, user_id),
    ).fetchone()
    return row is not None


class LinkCreateIn(BaseModel):
    a_concept_id: int
    b_concept_id: int
    label: Optional[str] = ""
    strength: Optional[float] = 0.5


class LinkUpdateIn(BaseModel):
    label: Optional[str] = None
    strength: Optional[float] = None
    hidden: Optional[bool] = None


def _meta_payload(conn, user_id: int) -> dict:
    """{"status","message","stale"} for this account — "stale" means the last
    completed discovery run's concept set no longer matches the current one
    (a concept was added/renamed/removed since)."""
    row = conn.execute(
        "SELECT status, message, concept_sig FROM mindmap_meta WHERE user_id = ?",
        (user_id,),
    ).fetchone()
    if not row:
        return {"status": "idle", "message": None, "stale": False}
    stale = False
    if row["status"] == "done":
        stale = (row["concept_sig"] or "") != mindmap_service.concept_signature(conn, user_id)
    return {"status": row["status"], "message": row["message"], "stale": stale}


@router.get("/mindmap/graph")
def get_graph(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        semesters = conn.execute(
            "SELECT id, name, archived FROM semesters WHERE user_id = ? ORDER BY created_at, id",
            (user["id"],),
        ).fetchall()
        courses = conn.execute(
            """
            SELECT co.id, co.semester_id, co.name, co.code
            FROM courses co
            JOIN semesters s ON s.id = co.semester_id
            WHERE s.user_id = ?
            ORDER BY co.id
            """,
            (user["id"],),
        ).fetchall()
        concepts = conn.execute(
            """
            SELECT
              c.id, c.course_id, c.name, c.summary,
              n.id AS note_id, n.status AS note_status,
              COALESCE(lp.done, 0) AS done,
              lp.best_score AS best_score, lp.best_total AS best_total,
              q.status AS quiz_status,
              (SELECT MIN(si.study_date) FROM schedule_items si
               WHERE si.concept_id = c.id AND si.study_date >= date('now', 'localtime')) AS next_study_date
            FROM concepts c
            JOIN courses co ON co.id = c.course_id
            JOIN semesters s ON s.id = co.semester_id
            LEFT JOIN notes n ON n.id = (SELECT MAX(id) FROM notes WHERE concept_id = c.id)
            LEFT JOIN lesson_progress lp ON lp.concept_id = c.id
            LEFT JOIN quizzes q ON q.concept_id = c.id
            WHERE s.user_id = ?
            ORDER BY c.id
            """,
            (user["id"],),
        ).fetchall()
        links = conn.execute(
            "SELECT id, a_concept_id AS a, b_concept_id AS b, label, strength, manual "
            "FROM concept_links WHERE user_id = ? AND hidden = 0",
            (user["id"],),
        ).fetchall()
        meta = _meta_payload(conn, user["id"])
    finally:
        conn.close()
    return {
        "semesters": [dict(r) for r in semesters],
        "courses": [dict(r) for r in courses],
        "concepts": [dict(r) for r in concepts],
        "links": [dict(r) for r in links],
        "meta": meta,
    }


@router.post("/mindmap/links/discover", status_code=202)
def discover_links(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        meta_row = conn.execute(
            "SELECT status FROM mindmap_meta WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if meta_row and meta_row["status"] == "running":
            raise HTTPException(
                status_code=409, detail="Connection discovery is already running."
            )
        count = conn.execute(
            """
            SELECT COUNT(*) AS n
            FROM concepts c
            JOIN courses co ON co.id = c.course_id
            JOIN semesters s ON s.id = co.semester_id
            WHERE s.user_id = ?
            """,
            (user["id"],),
        ).fetchone()["n"]
        if count == 0:
            raise HTTPException(
                status_code=400,
                detail="No concepts to map yet — analyze a course's materials first.",
            )
        # Set status='running' SYNCHRONOUSLY (before returning) so an
        # immediate status poll right after this response sees 'running',
        # not a stale 'idle'/'done' from before the thread has had a chance
        # to run.
        conn.execute(
            """
            INSERT INTO mindmap_meta (user_id, status, message, updated_at)
            VALUES (?, 'running', NULL, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              status = 'running', message = NULL, updated_at = datetime('now')
            """,
            (user["id"],),
        )
        conn.commit()
    finally:
        conn.close()

    threading.Thread(
        target=mindmap_service.run_discover_job, args=(user["id"],), daemon=True
    ).start()
    return {"ok": True}


@router.get("/mindmap/status")
def get_status(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        return _meta_payload(conn, user["id"])
    finally:
        conn.close()


@router.get("/mindmap/links")
def list_links(concept_id: int, user: dict = Depends(auth.require_auth)):
    """All links (including hidden) touching `concept_id`, for this account —
    powers the detail-card link manager. Each row names the OTHER endpoint's
    concept id/name relative to `concept_id`."""
    conn = db.get_connection()
    try:
        if not _concept_owned(conn, user["id"], concept_id):
            raise HTTPException(status_code=404, detail="Concept not found")
        rows = conn.execute(
            """
            SELECT
              cl.id, cl.a_concept_id AS a, cl.b_concept_id AS b,
              cl.label, cl.strength, cl.manual, cl.hidden,
              CASE WHEN cl.a_concept_id = ? THEN cl.b_concept_id ELSE cl.a_concept_id END
                AS other_concept_id,
              CASE WHEN cl.a_concept_id = ? THEN cb.name ELSE ca.name END
                AS other_concept_name
            FROM concept_links cl
            JOIN concepts ca ON ca.id = cl.a_concept_id
            JOIN concepts cb ON cb.id = cl.b_concept_id
            WHERE cl.user_id = ? AND (cl.a_concept_id = ? OR cl.b_concept_id = ?)
            ORDER BY cl.id
            """,
            (concept_id, concept_id, user["id"], concept_id, concept_id),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


@router.post("/mindmap/links")
def create_link(payload: LinkCreateIn, user: dict = Depends(auth.require_auth)):
    if payload.a_concept_id == payload.b_concept_id:
        raise HTTPException(status_code=400, detail="A concept can't link to itself")
    conn = db.get_connection()
    try:
        if not _concept_owned(conn, user["id"], payload.a_concept_id) or not _concept_owned(
            conn, user["id"], payload.b_concept_id
        ):
            raise HTTPException(status_code=404, detail="Concept not found")
        label = (payload.label or "").strip()[:80]
        strength = max(0.0, min(1.0, float(payload.strength if payload.strength is not None else 0.5)))
        cur = conn.execute(
            "INSERT INTO concept_links (user_id, a_concept_id, b_concept_id, label, strength, "
            "manual, hidden) VALUES (?, ?, ?, ?, ?, 1, 0)",
            (user["id"], payload.a_concept_id, payload.b_concept_id, label, strength),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, a_concept_id AS a, b_concept_id AS b, label, strength, manual, hidden "
            "FROM concept_links WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.patch("/mindmap/links/{link_id}")
def update_link(link_id: int, payload: LinkUpdateIn, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        existing = conn.execute(
            "SELECT * FROM concept_links WHERE id = ? AND user_id = ?",
            (link_id, user["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Link not found")

        fields = []
        vals = []
        if payload.label is not None:
            fields.append("label = ?")
            vals.append(payload.label.strip()[:80])
        if payload.strength is not None:
            fields.append("strength = ?")
            vals.append(max(0.0, min(1.0, float(payload.strength))))
        if payload.hidden is not None:
            fields.append("hidden = ?")
            vals.append(1 if payload.hidden else 0)

        if fields:
            vals.append(link_id)
            conn.execute(f"UPDATE concept_links SET {', '.join(fields)} WHERE id = ?", vals)
            conn.commit()

        row = conn.execute(
            "SELECT id, a_concept_id AS a, b_concept_id AS b, label, strength, manual, hidden "
            "FROM concept_links WHERE id = ?",
            (link_id,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()


@router.delete("/mindmap/links/{link_id}")
def delete_link(link_id: int, user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        existing = conn.execute(
            "SELECT 1 FROM concept_links WHERE id = ? AND user_id = ?",
            (link_id, user["id"]),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Link not found")
        conn.execute("DELETE FROM concept_links WHERE id = ?", (link_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
