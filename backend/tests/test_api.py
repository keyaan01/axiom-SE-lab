"""API-level tests via FastAPI's TestClient (no real AI calls).

Covers the health check, the auth flow (signup/login + the error cases), and
course/semester creation with its duplicate/not-found guards. All against the
isolated throwaway DB from conftest.
"""
from tests.conftest import unique_email


# ---- health ---------------------------------------------------------------

def test_health_ok(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    for key in ("db", "tectonic", "ai_key", "office"):
        assert key in body and "ok" in body[key]
    # The throwaway database must open cleanly.
    assert body["db"]["ok"] is True


# ---- auth -----------------------------------------------------------------

def test_data_endpoint_requires_auth(client):
    # No session cookie -> the guarded data API rejects the request.
    r = client.get("/api/semesters")
    assert r.status_code == 401


def test_signup_then_me(client):
    email = unique_email("signup")
    r = client.post(
        "/api/auth/signup",
        json={"name": "Ada", "email": email, "password": "pw123456"},
    )
    assert r.status_code == 200, r.text
    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_signup_short_password_400(client):
    r = client.post(
        "/api/auth/signup",
        json={"email": unique_email("short"), "password": "123"},
    )
    assert r.status_code == 400


def test_duplicate_email_409(client):
    email = unique_email("dup")
    assert client.post(
        "/api/auth/signup", json={"email": email, "password": "pw123456"}
    ).status_code == 200
    # Same email again -> conflict (case-insensitive uniqueness across accounts).
    r = client.post(
        "/api/auth/signup", json={"email": email.upper(), "password": "pw123456"}
    )
    assert r.status_code == 409


def test_wrong_password_401(client):
    email = unique_email("login")
    assert client.post(
        "/api/auth/signup", json={"email": email, "password": "pw123456"}
    ).status_code == 200
    r = client.post(
        "/api/auth/login", json={"email": email, "password": "not-the-password"}
    )
    assert r.status_code == 401


# ---- semesters / courses --------------------------------------------------

def _new_semester(c, name=None):
    r = c.post("/api/semesters", json={"name": name or ("Sem " + unique_email()[:6])})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_create_semester_and_course(auth_client):
    c = auth_client
    sem_id = _new_semester(c)
    r = c.post(
        "/api/courses",
        json={"semester_id": sem_id, "name": "Machine Learning", "code": "CSE4889"},
    )
    assert r.status_code == 201, r.text
    course = r.json()
    assert course["name"] == "Machine Learning"
    # The shared course projection reports live child counts.
    got = c.get(f"/api/courses/{course['id']}")
    assert got.status_code == 200
    assert got.json()["concept_count"] == 0


def test_duplicate_course_409(auth_client):
    c = auth_client
    sem_id = _new_semester(c)
    body = {"semester_id": sem_id, "name": "Algorithms"}
    assert c.post("/api/courses", json=body).status_code == 201
    # Same name in the same semester -> conflict.
    assert c.post("/api/courses", json=body).status_code == 409


def test_missing_course_404(auth_client):
    r = auth_client.get("/api/courses/999999")
    assert r.status_code == 404


def test_course_bad_semester_400(auth_client):
    r = auth_client.post(
        "/api/courses", json={"semester_id": 999999, "name": "Orphan"}
    )
    assert r.status_code == 400
