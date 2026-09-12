"""In-reader "highlight/snip -> ask AI" study assistant — BACKEND ONLY
(Phase A). A student selects a passage (or crops a region as an image) from
a lesson's note/canvas-file reader and asks a quick question about it; this
streams a provider-agnostic answer back as plain text.

Mirrors routers/canvas.py's structure (a plain APIRouter mounted under /api
with the auth dependency applied in main.py, not here) and the "errors must
be visible" house rule: a mid-stream failure is appended to the response
body as a visible trailing line rather than silently truncating the answer.

This endpoint owns no database rows (no jobs table, no cancel flag) —
cancellation is just the client disconnecting, which naturally stops the
generator (FastAPI/Starlette stop pulling chunks and the generator is
garbage-collected / closed).
"""
import base64
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .. import db
from ..services import ai
from ..services.ai.base import parse_data_url

router = APIRouter()
log = logging.getLogger(__name__)

# Server-side caps (defense in depth — the frontend phase should also cap
# these client-side, but the API must not trust it).
_MAX_TEXT_CHARS = 4000
_MAX_IMAGE_BYTES = 4 * 1024 * 1024


class AskIn(BaseModel):
    mode: str | None = "explain"
    question: str | None = None
    selection: str = ""
    context: str = ""
    image: str | None = None  # base64 data: URL, e.g. "data:image/png;base64,...."


def _require_concept(conn, concept_id: int):
    row = conn.execute(
        "SELECT name, summary FROM concepts WHERE id = ?", (concept_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Concept not found")
    return row


@router.post("/concepts/{concept_id}/ask")
def ask_concept(concept_id: int, payload: AskIn):
    conn = db.get_connection()
    try:
        row = _require_concept(conn, concept_id)
        name, summary = row["name"], row["summary"]
    finally:
        conn.close()

    selection = payload.selection or ""
    context = payload.context or ""
    question = (payload.question or "").strip()
    image = payload.image or None

    if len(selection) > _MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400, detail=f"selection too long (max {_MAX_TEXT_CHARS} chars)."
        )
    if len(context) > _MAX_TEXT_CHARS:
        raise HTTPException(
            status_code=400, detail=f"context too long (max {_MAX_TEXT_CHARS} chars)."
        )

    if image:
        try:
            _mime, b64 = parse_data_url(image)
            raw = base64.b64decode(b64, validate=False)
        except Exception:
            raise HTTPException(status_code=400, detail="Malformed image data.")
        if len(raw) > _MAX_IMAGE_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"Image too large (max {_MAX_IMAGE_BYTES // (1024 * 1024)} MB).",
            )

    if not selection.strip() and not image and not question:
        raise HTTPException(status_code=400, detail="Nothing to ask.")

    instruction = question if question else ai.ASK_MODES.get(
        payload.mode or "explain", ai.ASK_MODES["explain"]
    )
    system, user = ai.build_ask_messages(
        name, summary, instruction,
        selection=selection, context=context, has_image=bool(image),
    )

    def gen():
        try:
            for chunk in ai.stream_answer(system, user, image=image):
                if chunk:
                    yield chunk
        except ai.AICancelled:
            return  # client disconnected / cancelled mid-stream — just stop
        except Exception as e:
            # Errors must be visible (project house rule): append a short
            # trailing line instead of silently truncating the answer.
            log.exception("ask_concept stream failed (concept_id=%s)", concept_id)
            yield f"\n\n[Error generating answer: {e}]"

    return StreamingResponse(
        gen(),
        media_type="text/plain; charset=utf-8",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
