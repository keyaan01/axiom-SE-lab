"""Deterministic study-schedule builder (Build 2, Step 2).

Pure function: reads exams + their ticked concepts for a semester and RETURNS
a list of schedule-item dicts. It does not write to the DB — the caller
(the schedule router) is responsible for persisting the result, typically by
replacing all schedule_items for the semester in one transaction.

Algorithm, per exam (nearest exam_date first):
  - The study window is every day from max(study_start_date, today) up to
    (exam_date - 1) inclusive — concepts are always studied BEFORE the exam.
    If that window is empty (exam is today/very soon), fall back to a single
    day (today) so concepts still get scheduled rather than dropped.
  - Concepts are spread evenly across the window: concept i (of len(cids))
    gets an "ideal" day at (i * n) // len(cids).
  - A per (course, day) cap (CAP=2) keeps any single course from dumping too
    many concepts on one day, so multi-course days aren't overloaded. Around
    the ideal day we search outward in a fixed, deterministic order —
    0, +1, -1, +2, -2, ... — for the nearest day still under the cap for that
    course. If every day in the window is already at/over the cap for that
    course (window too small for the concept count), we fall back to the
    ideal day anyway rather than dropping the concept.
  - The cap is enforced per (course_id, day) ACROSS all of that course's
    exams being scheduled together — a concept ticked in two exams is
    scheduled once per exam (spaced review), and both placements count
    against the same course/day bucket.
  - Everything is processed in stable, deterministic order (exams sorted by
    exam_date then id; concepts sorted by order_index then id; fixed offset
    search order), so calling this twice with the same `today` yields
    identical output.
"""
from datetime import date, timedelta
from .. import db

CAP = 2  # max concepts per (course_id, study_date)


def _outward(n: int):
    """Yield 0, +1, -1, +2, -2, ... — the deterministic search order used to
    find the nearest under-cap day around an "ideal" index within a window of
    size n."""
    yield 0
    off = 1
    while off <= n:
        yield off
        yield -off
        off += 1


def build_schedule(semester_id: int, today: date | None = None, cap: int = CAP,
                    skip_weekdays: set[int] | None = None) -> list[dict]:
    """Return the schedule items for `semester_id` as of `today` (does not write).

    `today` is a datetime.date; the parameter exists so tests can pass a fixed
    date for deterministic assertions. Defaults to date.today().

    Done-aware: any concept already marked done in `lesson_progress` is
    dropped from its exam's concept list before placement, so completed
    lessons are never (re)scheduled. Only undone concepts get placed across
    today..exam-1 — this is how a missed-but-undone lesson rolls forward and
    the remaining load rebalances on the next generate.

    `cap` overrides the default per-(course, day) cap (CAP) when provided.
    `skip_weekdays` is an optional set of `date.weekday()` values (0=Mon..
    6=Sun) to exclude from the study window; if excluding them would leave no
    candidate day at all for an exam, the exclusion is dropped for that exam
    (falls back to the unfiltered range) so a plan is always produced.
    """
    today = today or date.today()
    skip = skip_weekdays or set()

    conn = db.get_connection()
    try:
        exam_rows = conn.execute(
            """
            SELECT e.id, e.course_id, e.study_start_date, e.exam_date
            FROM exams e
            JOIN courses c ON c.id = e.course_id
            WHERE c.semester_id = ? AND e.exam_date >= ?
            ORDER BY e.exam_date ASC, e.id ASC
            """,
            (semester_id, today.isoformat()),
        ).fetchall()

        exams = []
        for er in exam_rows:
            concept_ids = [
                r[0] for r in conn.execute(
                    """
                    SELECT ec.concept_id
                    FROM exam_concepts ec
                    JOIN concepts cpt ON cpt.id = ec.concept_id
                    WHERE ec.exam_id = ?
                    ORDER BY cpt.order_index ASC, cpt.id ASC
                    """,
                    (er["id"],),
                ).fetchall()
            ]
            exams.append({
                "id": er["id"],
                "course_id": er["course_id"],
                "study_start_date": er["study_start_date"],
                "exam_date": er["exam_date"],
                "concept_ids": concept_ids,
            })

        done_ids = {
            r["concept_id"] for r in conn.execute(
                "SELECT lp.concept_id FROM lesson_progress lp "
                "JOIN concepts c ON c.id = lp.concept_id "
                "JOIN courses co ON co.id = c.course_id "
                "WHERE co.semester_id = ? AND lp.done = 1",
                (semester_id,),
            ).fetchall()
        }
    finally:
        conn.close()

    load: dict[tuple[int, str], int] = {}  # (course_id, 'YYYY-MM-DD') -> count
    items: list[dict] = []

    for exam in exams:
        # Drop completed concepts right away: an exam with no remaining
        # undone concepts contributes nothing to the schedule.
        cids = [c for c in exam["concept_ids"] if c not in done_ids]
        if not cids:
            continue

        start = max(date.fromisoformat(exam["study_start_date"]), today)
        end = date.fromisoformat(exam["exam_date"]) - timedelta(days=1)  # study BEFORE the exam
        if end >= start:
            full_range = [start + timedelta(days=k) for k in range((end - start).days + 1)]
        else:
            full_range = [start]
        if skip:
            window = [d for d in full_range if d.weekday() not in skip]
            if not window:
                # Every candidate day was an off-day (or the range was a
                # single off-day) — fall back to the unfiltered range so a
                # plan is still produced.
                window = full_range
        else:
            window = full_range
        n = len(window)

        for ci, concept_id in enumerate(cids):
            ideal = (ci * n) // max(1, len(cids))  # spread across the whole window
            if ideal >= n:
                ideal = n - 1
            # search outward from `ideal` for a day with load < cap; deterministic
            # offset order 0, +1, -1, +2, -2, ...; falls back to `ideal` if every
            # day in the window is already at/over cap (window too small).
            chosen_idx = ideal
            for off in _outward(n):
                idx = ideal + off
                if 0 <= idx < n and load.get((exam["course_id"], window[idx].isoformat()), 0) < cap:
                    chosen_idx = idx
                    break
            d = window[chosen_idx].isoformat()
            load[(exam["course_id"], d)] = load.get((exam["course_id"], d), 0) + 1
            items.append({
                "semester_id": semester_id,
                "course_id": exam["course_id"],
                "exam_id": exam["id"],
                "concept_id": concept_id,
                "study_date": d,
                "order_index": ci,
            })

    return items
