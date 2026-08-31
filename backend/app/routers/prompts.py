"""Saved Prompts library (Build 6, Step 6 — backend half).

A Saved Prompt is a named, reusable custom note instruction, owned by an
account (scoped by `user_id`, Build 8 — multi-account). Any one of them can be
marked "apply to all notes" — a single active prompt, pointed to by a row in
the existing `settings` key/value table (key='active_prompt_id'). This
pointer is kept GLOBAL (shared across all accounts) rather than per-account —
simplest option for a local single-person app demoing a few accounts; two
accounts fighting over it is an acceptable rough edge. When set, its
instruction text is merged into EVERY note generation on top of whatever
per-course instruction (Build 4, Step 1) that course already has — see
generation_service._effective_note_prefs.

Mirrors routers/settings.py's structure: a plain APIRouter (auth dependency is
added where it's included, in main.py), db.get_connection() per request,
HTTPException for errors, parameterized SQL throughout.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from .. import auth, db

router = APIRouter()

MAX_INSTRUCTION_LEN = 2000


class PromptIn(BaseModel):
    name: str
    instruction: str


class ActiveIn(BaseModel):
    id: Optional[int] = None


def _row_to_dict(row) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "instruction": row["instruction"],
        "created_at": row["created_at"],
    }


def _active_prompt_id(conn) -> Optional[int]:
    """Read+validate the global active-prompt pointer: None if unset, blank,
    non-numeric, or pointing at a since-deleted saved_prompts row."""
    row = conn.execute("SELECT value FROM settings WHERE key = 'active_prompt_id'").fetchone()
    if not row or not row["value"]:
        return None
    try:
        pid = int(row["value"])
    except (TypeError, ValueError):
        return None
    exists = conn.execute("SELECT 1 FROM saved_prompts WHERE id = ?", (pid,)).fetchone()
    return pid if exists else None


@router.get("/saved-prompts")
def list_saved_prompts(user: dict = Depends(auth.require_auth)):
    conn = db.get_connection()
    try:
        rows = conn.execute(
            "SELECT id, name, instruction, created_at FROM saved_prompts "
            "WHERE user_id = ? ORDER BY id",
            (user["id"],),
        ).fetchall()
        active_id = _active_prompt_id(conn)
    finally:
        conn.close()
    return {"prompts": [_row_to_dict(r) for r in rows], "active_prompt_id": active_id}


def _validate(payload: PromptIn) -> tuple[str, str]:
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required.")
    instruction = (payload.instruction or "").strip()
    if not instruction:
        raise HTTPException(status_code=400, detail="Instruction is required.")
    if len(instruction) > MAX_INSTRUCTION_LEN:
        instruction = instruction[:MAX_INSTRUCTION_LEN]
    return name, instruction


@router.post("/saved-prompts")
def create_saved_prompt(payload: PromptIn, user: dict = Depends(auth.require_auth)):
    name, instruction = _validate(payload)
    conn = db.get_connection()
    try:
        cur = conn.execute(
            "INSERT INTO saved_prompts (name, instruction, user_id) VALUES (?, ?, ?)",
            (name, instruction, user["id"]),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, instruction, created_at FROM saved_prompts WHERE id = ?",
            (cur.lastrowid,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_dict(row)


@router.put("/saved-prompts/active")
def set_active_prompt(payload: ActiveIn):
    conn = db.get_connection()
    try:
        if payload.id is None:
            conn.execute("DELETE FROM settings WHERE key = 'active_prompt_id'")
            conn.commit()
            return {"active_prompt_id": None}

        exists = conn.execute("SELECT 1 FROM saved_prompts WHERE id = ?", (payload.id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Saved prompt not found.")
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES ('active_prompt_id', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (str(payload.id),),
        )
        conn.commit()
    finally:
        conn.close()
    return {"active_prompt_id": payload.id}


# NOTE: this route MUST be registered after /saved-prompts/active above —
# FastAPI/Starlette matches routes in registration order, and this
# {prompt_id}: int path would otherwise swallow "active" as a path param
# first (and fail trying to int()-parse it) before the literal route below
# ever got a chance to match.
@router.put("/saved-prompts/{prompt_id}")
def update_saved_prompt(prompt_id: int, payload: PromptIn):
    name, instruction = _validate(payload)
    conn = db.get_connection()
    try:
        existing = conn.execute("SELECT id FROM saved_prompts WHERE id = ?", (prompt_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Saved prompt not found.")
        conn.execute(
            "UPDATE saved_prompts SET name = ?, instruction = ? WHERE id = ?",
            (name, instruction, prompt_id),
        )
        conn.commit()
        row = conn.execute(
            "SELECT id, name, instruction, created_at FROM saved_prompts WHERE id = ?",
            (prompt_id,),
        ).fetchone()
    finally:
        conn.close()
    return _row_to_dict(row)


@router.delete("/saved-prompts/{prompt_id}")
def delete_saved_prompt(prompt_id: int):
    conn = db.get_connection()
    try:
        existing = conn.execute("SELECT id FROM saved_prompts WHERE id = ?", (prompt_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Saved prompt not found.")
        active_id = _active_prompt_id(conn)
        conn.execute("DELETE FROM saved_prompts WHERE id = ?", (prompt_id,))
        if active_id == prompt_id:
            conn.execute("DELETE FROM settings WHERE key = 'active_prompt_id'")
        conn.commit()
    finally:
        conn.close()
    return {"ok": True}
