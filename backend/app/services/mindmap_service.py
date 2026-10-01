"""Background job logic for curriculum-wide concept-link discovery (Build 10 —
"Constellation" mind map).

Mirrors quiz_service's pattern: a plain function run in a background thread,
its own short-lived DB connections, and status/error written to a small
status row (mindmap_meta, one per account) so the frontend can poll
GET /mindmap/status. Unlike quiz_service (which works one concept at a time),
this job is a single text-only AI call over the WHOLE curriculum's concept
list — no attachments, no per-concept looping.
"""
import hashlib
from . import gemini
from .. import db


def concept_signature(conn, user_id: int) -> str:
    """A stable fingerprint of this account's current concept set (id + name,
    sorted by id) — used to detect when a previously-generated mind map has
    gone stale (a concept was added/renamed/removed since the last discovery
    run). Spans ALL of the user's semesters, archived included, joined
    courses -> semesters WHERE s.user_id = ?.
    """
    rows = conn.execute(
        """
        SELECT c.id, c.name
        FROM concepts c
        JOIN courses co ON co.id = c.course_id
        JOIN semesters s ON s.id = co.semester_id
        WHERE s.user_id = ?
        ORDER BY c.id
        """,
        (user_id,),
    ).fetchall()
    raw = "|".join(f"{r['id']}:{r['name']}" for r in rows)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()


def _set_meta(user_id: int, **fields) -> None:
    """Upsert into mindmap_meta, overwriting ONLY the given fields — e.g.
    calling with just status/message never clobbers a previously-stored
    concept_sig."""
    cols = list(fields.keys())
    col_list = ", ".join(["user_id"] + cols + ["updated_at"])
    placeholders = ", ".join(["?"] * (1 + len(cols)) + ["datetime('now')"])
    vals = [user_id] + [fields[k] for k in cols]
    update_set = ", ".join(f"{k} = excluded.{k}" for k in cols)
    update_set = (update_set + ", " if update_set else "") + "updated_at = datetime('now')"
    conn = db.get_connection()
    try:
        conn.execute(
            f"INSERT INTO mindmap_meta ({col_list}) VALUES ({placeholders}) "
            f"ON CONFLICT(user_id) DO UPDATE SET {update_set}",
            vals,
        )
        conn.commit()
    finally:
        conn.close()


MAX_CONCEPTS = 400


def run_discover_job(user_id: int) -> None:
    """Link-discovery job body for one account (runs in a background thread)."""
    try:
        _set_meta(user_id, status="running", message=None)

        conn = db.get_connection()
        try:
            rows = conn.execute(
                """
                SELECT c.id, c.name, c.summary, co.name AS course_name
                FROM concepts c
                JOIN courses co ON co.id = c.course_id
                JOIN semesters s ON s.id = co.semester_id
                WHERE s.user_id = ?
                ORDER BY c.id
                """,
                (user_id,),
            ).fetchall()
            sig = concept_signature(conn, user_id)
        finally:
            conn.close()

        if not rows:
            _set_meta(user_id, status="failed", message="No concepts to map yet.")
            return
        if len(rows) > MAX_CONCEPTS:
            _set_meta(
                user_id, status="failed",
                message=f"Too many concepts for one discovery pass ({len(rows)} > {MAX_CONCEPTS}).",
            )
            return

        ids = {r["id"] for r in rows}
        lines = "\n".join(
            f"{r['id']} | {r['course_name']} | {r['name']} — {(r['summary'] or '')[:200]}"
            for r in rows
        )

        links = gemini.discover_links(lines)

        conn = db.get_connection()
        try:
            # Only clear the visible AI-discovered links (manual=0, hidden=0).
            # Manual links (user-added) and hidden rows (AI links the user
            # dismissed, or manual links they've hidden) survive a re-discover
            # untouched — this is what makes user intent durable.
            conn.execute(
                "DELETE FROM concept_links WHERE user_id = ? AND manual = 0 AND hidden = 0",
                (user_id,),
            )
            existing_pairs = {
                frozenset((r["a_concept_id"], r["b_concept_id"]))
                for r in conn.execute(
                    "SELECT a_concept_id, b_concept_id FROM concept_links WHERE user_id = ?",
                    (user_id,),
                ).fetchall()
            }

            seen_pairs = set()
            valid = []
            for link in links:
                a, b = link.a, link.b
                if a == b or a not in ids or b not in ids:
                    continue
                pair = frozenset((a, b))
                if pair in seen_pairs or pair in existing_pairs:
                    # Already seen in this batch, or already present as a
                    # surviving manual link / hidden pair — never duplicate
                    # a manual link or re-suggest a hidden one.
                    continue
                seen_pairs.add(pair)
                strength = max(0.0, min(1.0, float(link.strength)))
                label = (link.label or "").strip()[:80]
                valid.append((a, b, label, strength))

            conn.executemany(
                "INSERT INTO concept_links (user_id, a_concept_id, b_concept_id, label, strength, "
                "manual, hidden) VALUES (?, ?, ?, ?, ?, 0, 0)",
                [(user_id, a, b, label, strength) for a, b, label, strength in valid],
            )
            conn.commit()
        finally:
            conn.close()

        _set_meta(
            user_id, status="done",
            message=f"Found {len(valid)} connections across {len(ids)} concepts.",
            concept_sig=sig,
        )
    except Exception as e:
        _set_meta(user_id, status="failed", message=f"{type(e).__name__}: {e}")
