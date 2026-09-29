"""Multi-account login/signup (Build 6, Step 1; security-question reset added
in Build 7, Phase 2; multi-account support added in Build 8).

Each `user_profile` row is a separate account. Signup creates a genuinely
SEPARATE account rather than overwriting a shared identity:
  - If NO account is registered yet (the seeded id=1 row has no
    password_hash), signup claims that row — this is the first-ever
    registration, i.e. the pre-multi-account upgrade path, and it keeps
    whatever study data id=1 already had.
  - Otherwise, signup INSERTs a brand-new user_profile row: a fresh, empty
    account. No other account's data (or sessions) is touched or deleted.
Either way the email must be unique across ALL accounts (case-insensitive) —
409 if taken. Login/security-question/reset all resolve the target account by
email across every user_profile row (never a hardcoded id).

This router is mounted WITHOUT the require_auth dependency so
status/signup/login/security-question/reset always work; /auth/me is the one
endpoint here that does require a valid session.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from pydantic import BaseModel, Field

from .. import auth, db

router = APIRouter()

SEED_PROFILE_ID = 1
MIN_PASSWORD_LENGTH = 6

_COOKIE_MAX_AGE = 60 * 60 * 24 * 30  # 30 days, matches auth.create_session()


def _set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        auth.COOKIE_NAME,
        token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=_COOKIE_MAX_AGE,
    )


def _find_registered_by_email(conn, email: str):
    """Case-insensitive lookup of a REGISTERED (password_hash set) account by
    email, across every account."""
    email = (email or "").strip().lower()
    if not email:
        return None
    return conn.execute(
        "SELECT * FROM user_profile WHERE password_hash IS NOT NULL "
        "AND lower(trim(email)) = ?",
        (email,),
    ).fetchone()


def _email_taken(conn, email: str) -> bool:
    email = (email or "").strip().lower()
    if not email:
        return False
    row = conn.execute(
        "SELECT 1 FROM user_profile WHERE lower(trim(email)) = ?", (email,)
    ).fetchone()
    return row is not None


def _any_registered(conn) -> bool:
    return conn.execute(
        "SELECT 1 FROM user_profile WHERE password_hash IS NOT NULL LIMIT 1"
    ).fetchone() is not None


def _is_registered() -> bool:
    conn = db.get_connection()
    try:
        return _any_registered(conn)
    finally:
        conn.close()


class SignupIn(BaseModel):
    name: str = Field(default="")
    email: str
    password: str
    security_question: str = Field(default="")
    security_answer: str = Field(default="")


class LoginIn(BaseModel):
    email: str
    password: str


class SecurityQuestionIn(BaseModel):
    email: str


class ResetIn(BaseModel):
    email: str
    security_answer: str
    new_password: str


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str
    security_question: Optional[str] = None
    security_answer: Optional[str] = None


@router.get("/auth/status")
def auth_status(request: Request):
    token = request.cookies.get(auth.COOKIE_NAME)
    return {
        "registered": _is_registered(),
        "authenticated": auth.session_user(token) is not None,
    }


@router.post("/auth/signup")
def signup(payload: SignupIn, response: Response):
    if len(payload.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    password_hash = auth.hash_password(payload.password)
    security_question = payload.security_question.strip()
    ans = (payload.security_answer or "").strip().lower()
    security_answer_hash = auth.hash_password(ans) if ans else None

    conn = db.get_connection()
    try:
        if _email_taken(conn, payload.email):
            raise HTTPException(
                status_code=409, detail="An account with that email already exists."
            )

        if not _any_registered(conn):
            # First-ever registration: claim the seeded single-user row
            # (id=1) so its existing study data carries over.
            conn.execute(
                "INSERT OR IGNORE INTO user_profile (id, daily_capacity, study_off_days) "
                "VALUES (?, 2, '[]')",
                (SEED_PROFILE_ID,),
            )
            conn.execute(
                "UPDATE user_profile SET name = ?, email = ?, password_hash = ?, "
                "security_question = ?, security_answer_hash = ?, "
                "updated_at = datetime('now') WHERE id = ?",
                (
                    payload.name,
                    payload.email,
                    password_hash,
                    security_question,
                    security_answer_hash,
                    SEED_PROFILE_ID,
                ),
            )
            user_id = SEED_PROFILE_ID
        else:
            # A brand-new, empty account. Nothing about any other account
            # (its data or its sessions) is touched.
            cur = conn.execute(
                "INSERT INTO user_profile "
                "(name, email, password_hash, security_question, security_answer_hash, "
                "daily_capacity, study_off_days) VALUES (?, ?, ?, ?, ?, 2, '[]')",
                (
                    payload.name,
                    payload.email,
                    password_hash,
                    security_question,
                    security_answer_hash,
                ),
            )
            user_id = cur.lastrowid
        conn.commit()
    finally:
        conn.close()

    token = auth.create_session(user_id)
    _set_session_cookie(response, token)
    return {"ok": True}


@router.post("/auth/login")
def login(payload: LoginIn, response: Response):
    conn = db.get_connection()
    try:
        row = _find_registered_by_email(conn, payload.email)
    finally:
        conn.close()

    stored_hash = (row["password_hash"] or "") if row else ""
    if not row or not auth.verify_password(payload.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = auth.create_session(row["id"])
    _set_session_cookie(response, token)
    return {"ok": True}


@router.post("/auth/security-question")
def security_question(payload: SecurityQuestionIn):
    conn = db.get_connection()
    try:
        row = _find_registered_by_email(conn, payload.email)
    finally:
        conn.close()

    question = (row["security_question"] or "") if row else ""
    if not row or not question:
        raise HTTPException(
            status_code=404,
            detail="No security question is set for that account.",
        )
    return {"question": question}


@router.post("/auth/reset")
def reset_password(payload: ResetIn, response: Response):
    conn = db.get_connection()
    try:
        row = _find_registered_by_email(conn, payload.email)
    finally:
        conn.close()

    stored_answer_hash = (row["security_answer_hash"] or "") if row else ""
    if not row or not stored_answer_hash:
        raise HTTPException(
            status_code=400,
            detail="Password reset isn't available for this account.",
        )

    if len(payload.new_password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )

    ans = (payload.security_answer or "").strip().lower()
    if not auth.verify_password(ans, stored_answer_hash):
        raise HTTPException(
            status_code=401,
            detail="Incorrect answer to the security question.",
        )

    account_id = row["id"]
    new_hash = auth.hash_password(payload.new_password)
    conn = db.get_connection()
    try:
        conn.execute(
            "UPDATE user_profile SET password_hash = ?, updated_at = datetime('now') "
            "WHERE id = ?",
            (new_hash, account_id),
        )
        # Only THIS account's sessions are invalidated — other accounts stay
        # logged in.
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (account_id,))
        conn.commit()
    finally:
        conn.close()

    token = auth.create_session(account_id)
    _set_session_cookie(response, token)
    return {"ok": True}


@router.post("/auth/logout")
def logout(request: Request, response: Response):
    token = request.cookies.get(auth.COOKIE_NAME)
    auth.delete_session(token)
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return {"ok": True}


@router.get("/auth/me")
def me(user: dict = Depends(auth.require_auth)):
    return {"id": user["id"], "name": user["name"], "email": user["email"]}


@router.post("/auth/change-password")
def change_password(
    payload: ChangePasswordIn,
    response: Response,
    user: dict = Depends(auth.require_auth),
):
    """Change the CURRENT account's password while logged in (verifies the
    current password first), optionally also updating the security
    question/answer used for forgot-password reset. Invalidates every
    session for this account (including the one making this request) and
    issues a fresh session cookie so the caller stays logged in."""
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT * FROM user_profile WHERE id = ?", (user["id"],)
        ).fetchone()
        stored_hash = (row["password_hash"] or "") if row else ""
        if not row or not auth.verify_password(payload.current_password, stored_hash):
            # 400 (not 401) on purpose: the caller IS authenticated (require_auth
            # passed) — this is a wrong VALUE in the current-password FIELD, not a
            # session-auth failure. The frontend's api.js dispatches a global
            # `axiom:unauthorized` (→ logout to the auth gate) on ANY 401, so a 401
            # here would kick the user out instead of just showing the field error.
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if len(payload.new_password) < MIN_PASSWORD_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
            )

        account_id = row["id"]
        new_hash = auth.hash_password(payload.new_password)

        question = (payload.security_question or "").strip()
        answer = (payload.security_answer or "").strip().lower()
        if question and answer:
            answer_hash = auth.hash_password(answer)
            conn.execute(
                "UPDATE user_profile SET password_hash = ?, security_question = ?, "
                "security_answer_hash = ?, updated_at = datetime('now') WHERE id = ?",
                (new_hash, question, answer_hash, account_id),
            )
        else:
            conn.execute(
                "UPDATE user_profile SET password_hash = ?, updated_at = datetime('now') "
                "WHERE id = ?",
                (new_hash, account_id),
            )

        # Invalidate every session for this account (including the caller's
        # current one) — a fresh session/cookie is issued below.
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (account_id,))
        conn.commit()
    finally:
        conn.close()

    token = auth.create_session(account_id)
    _set_session_cookie(response, token)
    return {"ok": True}


@router.post("/auth/delete-account")
def delete_account(response: Response, user: dict = Depends(auth.require_auth)):
    """Permanently delete the CURRENT account and all its data. Only this
    account is affected — other accounts (their data + sessions) are untouched.
    Global settings (AI keys) are shared, so they are left alone."""
    uid = user["id"]
    conn = db.get_connection()
    try:
        conn.execute("DELETE FROM semesters WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM saved_prompts WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM sessions WHERE user_id = ?", (uid,))
        conn.execute("DELETE FROM user_profile WHERE id = ?", (uid,))
        conn.commit()
    finally:
        conn.close()
    response.delete_cookie(auth.COOKIE_NAME, path="/")
    return {"ok": True}
