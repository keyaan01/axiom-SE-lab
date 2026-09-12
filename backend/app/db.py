"""SQLite access layer.

A single database file (config.DB_PATH) holds all app state. Every connection
enables foreign keys so cascade deletes and course scoping are enforced by the
DB itself. Rows come back as sqlite3.Row (dict-like) for convenient access.
"""
import sqlite3
from . import config

SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS semesters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  note_instructions TEXT,
  note_enhancements TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('material','pyq')),
  display_name TEXT NOT NULL,
  disk_uuid TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  gemini_file_uri TEXT,
  gemini_file_name TEXT,
  gemini_expiry TEXT,
  analyzed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS concepts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  summary TEXT,
  source_locations TEXT,
  material_id INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  concept_id INTEGER REFERENCES concepts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  latex_source TEXT,
  pdf_disk_uuid TEXT,
  thumb_disk_uuid TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','compiled','failed')),
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('extract','generate')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  progress INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  message TEXT,
  cancel_requested INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  study_start_date TEXT NOT NULL,
  exam_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exam_concepts (
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  PRIMARY KEY (exam_id, concept_id)
);

CREATE TABLE IF NOT EXISTS schedule_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  semester_id INTEGER NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  study_date TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL UNIQUE REFERENCES concepts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','failed')),
  questions_json TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  concept_id INTEGER NOT NULL UNIQUE REFERENCES concepts(id) ON DELETE CASCADE,
  done INTEGER NOT NULL DEFAULT 0,
  done_at TEXT,
  best_score INTEGER,
  best_total INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_annotations (
  note_id INTEGER PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
  data_json TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_profile (
  id INTEGER PRIMARY KEY,
  name TEXT, email TEXT, avatar_disk_uuid TEXT,
  institution TEXT, program TEXT, academic_year TEXT,
  daily_capacity INTEGER NOT NULL DEFAULT 2,
  study_off_days TEXT,               -- JSON array of weekday ints 0(Mon)-6(Sun)
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  instruction TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS canvas_files (
  id              INTEGER PRIMARY KEY,
  concept_id      INTEGER NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
  kind            TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  disk_uuid       TEXT NOT NULL,
  pdf_disk_uuid   TEXT,
  thumb_disk_uuid TEXT,
  mime_type       TEXT,
  size_bytes      INTEGER,
  status          TEXT NOT NULL DEFAULT 'ready',
  error_message   TEXT,
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS canvas_layout (
  concept_id  INTEGER PRIMARY KEY REFERENCES concepts(id) ON DELETE CASCADE,
  data_json   TEXT NOT NULL,
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS canvas_file_annotations (
  canvas_file_id INTEGER PRIMARY KEY REFERENCES canvas_files(id) ON DELETE CASCADE,
  data_json      TEXT NOT NULL,
  updated_at     TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_courses_semester ON courses(semester_id);
CREATE INDEX IF NOT EXISTS idx_materials_course ON materials(course_id);
CREATE INDEX IF NOT EXISTS idx_concepts_course ON concepts(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_notes_lesson ON notes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_jobs_course ON jobs(course_id);
CREATE INDEX IF NOT EXISTS idx_exams_course ON exams(course_id);
CREATE INDEX IF NOT EXISTS idx_schedule_sem_date ON schedule_items(semester_id, study_date);
CREATE INDEX IF NOT EXISTS idx_schedule_course ON schedule_items(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_concept ON quizzes(concept_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_concept ON lesson_progress(concept_id);
CREATE INDEX IF NOT EXISTS idx_canvas_files_concept ON canvas_files(concept_id);
"""


# (table, column, decl) columns added after initial release. Applied by
# _ensure_columns() on every startup so existing DBs pick them up without a
# manual migration step; brand-new DBs already get them from SCHEMA_SQL above.
_ADDED_COLUMNS = [
    ("concepts", "material_id", "INTEGER"),
    ("jobs", "cancel_requested", "INTEGER NOT NULL DEFAULT 0"),
    ("semesters", "archived", "INTEGER NOT NULL DEFAULT 0"),
    ("courses", "note_instructions", "TEXT"),
    ("courses", "note_enhancements", "TEXT"),
    ("user_profile", "password_hash", "TEXT"),
    ("materials", "analyzed", "INTEGER NOT NULL DEFAULT 0"),
    ("user_profile", "security_question", "TEXT"),
    ("user_profile", "security_answer_hash", "TEXT"),
    ("sessions", "user_id", "INTEGER"),
    ("semesters", "user_id", "INTEGER"),
    ("saved_prompts", "user_id", "INTEGER"),
]


def _ensure_columns(conn: sqlite3.Connection) -> None:
    """Idempotently ALTER TABLE ... ADD COLUMN for any column missing from an
    existing (pre-upgrade) database. Safe to call on every startup."""
    for table, column, decl in _ADDED_COLUMNS:
        cols = {row[1] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in cols:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {decl}")
            if table == "materials" and column == "analyzed":
                # One-time backfill (Build 6, Step 5 — incremental note
                # generation). Before this column existed, extraction always
                # wiped + rebuilt a course's ENTIRE concept set from ALL of
                # its materials every run, so any course that already has
                # concepts necessarily already had all of its materials
                # processed. Mark them analyzed=1 so the new "only new
                # materials" extraction mode doesn't re-process everything
                # the user already has concepts for. Runs ONLY here, in the
                # branch that fires the first time this column is added to a
                # pre-existing DB — a brand-new DB gets the column straight
                # from SCHEMA_SQL (this ALTER branch never runs for it), and
                # it has no concepts yet anyway.
                conn.execute(
                    "UPDATE materials SET analyzed = 1 WHERE course_id IN "
                    "(SELECT DISTINCT course_id FROM concepts)"
                )
            if table in ("sessions", "semesters", "saved_prompts") and column == "user_id":
                # One-time backfill (Build 8 — multi-account). These rows
                # predate accounts entirely, so they belong to the original
                # single-user account (id=1, seeded by _seed_user_profile).
                # Runs only in this ALTER branch, the first time the column
                # is added to a pre-existing DB.
                conn.execute(f"UPDATE {table} SET user_id = 1 WHERE user_id IS NULL")


def _reconcile_orphans(conn: sqlite3.Connection) -> None:
    """Clean up rows left mid-flight by a server crash/restart.

    Background generation runs in in-process threads (generation_service.py),
    so any note stuck at status='generating' or job stuck at 'running'/'queued'
    when init_db() runs again is necessarily orphaned — the thread that would
    have finished it no longer exists (this only runs at process startup,
    before any worker thread is created, so there is no race with a live job).
    Without this, such a note's spinner would spin forever (Build 5, Step 4).

    Both UPDATEs use only CHECK-allowed values, and are safe to run on every
    startup (a clean DB with no such rows is a no-op).
    """
    conn.execute(
        "UPDATE notes SET status = 'failed', "
        "error_message = 'Generation was interrupted (server restarted). Retry to regenerate.' "
        "WHERE status = 'generating'"
    )
    conn.execute(
        "UPDATE jobs SET status = 'done', message = 'Interrupted (server restarted).' "
        "WHERE status IN ('running', 'queued')"
    )


def _seed_user_profile(conn: sqlite3.Connection) -> None:
    """Seed the single local-user profile row (id=1) if it doesn't exist yet
    (Build 5, Step 5). Groundwork for a future login system — for now there is
    exactly one user, always id=1."""
    conn.execute(
        "INSERT OR IGNORE INTO user_profile (id, daily_capacity, study_off_days) "
        "VALUES (1, 2, '[]')"
    )


def get_connection() -> sqlite3.Connection:
    """Open a new connection with foreign keys on and Row access."""
    config.ensure_dirs()
    conn = sqlite3.connect(config.DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    # Background jobs write while the UI polls; wait out brief write locks
    # instead of failing with "database is locked".
    conn.execute("PRAGMA busy_timeout = 5000;")
    return conn


def init_db() -> None:
    """Create all tables and indexes if they do not already exist."""
    config.ensure_dirs()
    conn = get_connection()
    try:
        conn.executescript(SCHEMA_SQL)
        _ensure_columns(conn)
        _reconcile_orphans(conn)
        _seed_user_profile(conn)
        conn.commit()
    finally:
        conn.close()
