"""Multi-account authentication (Build 6, Step 1; multi-account in Build 8).

Each `user_profile` row is a separate account. A session (opaque cookie
token, stored in the `sessions` table) maps to one account via
`sessions.user_id`. This is still a LOCAL single-person app used to demo
multiple accounts — there is no per-row ownership enforcement on courses,
notes, etc.; only the top-level list/aggregate endpoints and creation are
scoped by account (see routers/semesters.py, schedule.py, prompts.py,
profile.py). Password hashing is stdlib-only (pbkdf2_hmac), no external deps.
"""
import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import Depends, HTTPException, Request

from . import db

COOKIE_NAME = "axiom_session"
PROFILE_ID = 1

_PBKDF2_ALGO = "pbkdf2_sha256"
_PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    """Return a self-describing hash string: algo$iterations$salt_hex$dk_hex."""
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"{_PBKDF2_ALGO}${_PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Recompute the hash from `stored`'s embedded params and compare in
    constant time. Any parse failure (malformed/missing hash) -> False."""
    if not stored:
        return False
    try:
        algo, iterations_s, salt_hex, dk_hex = stored.split("$", 3)
        if algo != _PBKDF2_ALGO:
            return False
        iterations = int(iterations_s)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(dk_hex)
    except (ValueError, AttributeError):
        return False
    actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, iterations)
    return hmac.compare_digest(actual, expected)


def create_session(user_id: int) -> str:
    """Create a new session row (30-day expiry) for `user_id` and return its
    opaque token."""
    token = secrets.token_urlsafe(32)
    conn = db.get_connection()
    try:
        conn.execute(
            "INSERT INTO sessions (token, user_id, expires_at) "
            "VALUES (?, ?, datetime('now', '+30 days'))",
            (token, user_id),
        )
        conn.commit()
    finally:
        conn.close()
    return token


def session_user(token: Optional[str]) -> Optional[dict]:
    """Return the user_profile row for the account this session belongs to,
    as a dict, if `token` maps to a non-expired session — else None. Sessions
    with no user_id (pre-migration legacy rows, shouldn't occur after the
    backfill) fall back to account id=1."""
    if not token:
        return None
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT user_id FROM sessions WHERE token = ? AND expires_at > datetime('now')",
            (token,),
        ).fetchone()
        if not row:
            return None
        user_id = row["user_id"] if row["user_id"] is not None else PROFILE_ID
        user_row = conn.execute(
            "SELECT * FROM user_profile WHERE id = ?", (user_id,)
        ).fetchone()
        return dict(user_row) if user_row else None
    finally:
        conn.close()


def delete_session(token: Optional[str]) -> None:
    """Best-effort delete of a session row; a no-op if token is falsy/unknown."""
    if not token:
        return
    conn = db.get_connection()
    try:
        conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
        conn.commit()
    finally:
        conn.close()


def require_auth(request: Request) -> dict:
    """FastAPI dependency: 401s unless the request carries a valid session
    cookie. Returned value is the user_profile dict for the session's
    account — endpoints that need to scope data by account read `user["id"]`
    from it."""
    token = request.cookies.get(COOKIE_NAME)
    user = session_user(token)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user
