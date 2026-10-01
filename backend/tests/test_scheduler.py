"""Unit tests for the deterministic schedule builder (services/scheduler.py).

build_schedule() is a pure function over the DB, so these seed a tiny semester
directly (throwaway DB from conftest) and assert its invariants — no HTTP, no
AI. The headline case is the real bug we fixed: a concept ticked in two exams
must be reviewed once per exam but never land on the SAME day twice.
"""
from datetime import date

from app import db
from app.services import scheduler

TODAY = date(2025, 12, 20)  # before both seeded exams
EXAM1_DATE = "2026-01-10"   # Midterm (nearer)
EXAM2_DATE = "2026-01-20"   # Final (later)


def _seed_two_exams_sharing_a_concept():
    """semester -> course -> 3 concepts; two exams that BOTH tick the shared
    concept (order_index 0), plus one unique concept each. Returns ids."""
    conn = db.get_connection()
    try:
        sem_id = conn.execute(
            "INSERT INTO semesters (name) VALUES ('SchedTest')"
        ).lastrowid
        course_id = conn.execute(
            "INSERT INTO courses (semester_id, name) VALUES (?, 'C')", (sem_id,)
        ).lastrowid
        cids = [
            conn.execute(
                "INSERT INTO concepts (course_id, name, order_index) VALUES (?,?,?)",
                (course_id, nm, i),
            ).lastrowid
            for i, nm in enumerate(["Shared", "OnlyMidterm", "OnlyFinal"])
        ]
        exam1 = conn.execute(
            "INSERT INTO exams (course_id, name, study_start_date, exam_date) "
            "VALUES (?,?,?,?)",
            (course_id, "Midterm", "2026-01-01", EXAM1_DATE),
        ).lastrowid
        exam2 = conn.execute(
            "INSERT INTO exams (course_id, name, study_start_date, exam_date) "
            "VALUES (?,?,?,?)",
            (course_id, "Final", "2026-01-01", EXAM2_DATE),
        ).lastrowid
        # Both exams tick the shared concept; each also has one unique concept.
        for eid in (exam1, exam2):
            conn.execute(
                "INSERT INTO exam_concepts (exam_id, concept_id) VALUES (?,?)",
                (eid, cids[0]),
            )
        conn.execute(
            "INSERT INTO exam_concepts (exam_id, concept_id) VALUES (?,?)",
            (exam1, cids[1]),
        )
        conn.execute(
            "INSERT INTO exam_concepts (exam_id, concept_id) VALUES (?,?)",
            (exam2, cids[2]),
        )
        conn.commit()
        return sem_id, course_id, cids, (exam1, exam2)
    finally:
        conn.close()


def test_same_concept_never_twice_on_one_day():
    sem_id, _course_id, cids, _exams = _seed_two_exams_sharing_a_concept()
    items = scheduler.build_schedule(sem_id, today=TODAY)

    shared = [it for it in items if it["concept_id"] == cids[0]]
    # Reviewed once per exam...
    assert len(shared) == 2
    # ...but on DIFFERENT days (this is the fix).
    assert shared[0]["study_date"] != shared[1]["study_date"]

    # Globally: no (concept, day) pair is ever duplicated.
    pairs = [(it["concept_id"], it["study_date"]) for it in items]
    assert len(pairs) == len(set(pairs))


def test_everything_scheduled_before_its_exam():
    sem_id, _course_id, _cids, exams = _seed_two_exams_sharing_a_concept()
    exam_dates = {exams[0]: EXAM1_DATE, exams[1]: EXAM2_DATE}
    items = scheduler.build_schedule(sem_id, today=TODAY)
    assert items  # something got scheduled
    for it in items:
        assert it["study_date"] < exam_dates[it["exam_id"]]   # study BEFORE the exam
        assert it["study_date"] >= TODAY.isoformat()          # never in the past


def test_schedule_is_deterministic():
    sem_id, _course_id, _cids, _exams = _seed_two_exams_sharing_a_concept()
    a = scheduler.build_schedule(sem_id, today=TODAY)
    b = scheduler.build_schedule(sem_id, today=TODAY)
    assert a == b
