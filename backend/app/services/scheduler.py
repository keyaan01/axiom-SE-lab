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
    against the same course/day bucket. A concept is never placed on the
    SAME day twice, though: if its ideal day already holds this concept (from
    another exam), it moves to the nearest day that doesn't, so the two
    reviews land on different days.
  - Everything is processed in stable, deterministic order (exams sorted by
    exam_date then id; concepts sorted by order_index then id; fixed offset
    search order), so calling this twice with the same `today` yields
    identical output.
"""
from datetime import date, timedelta
from .. import db

CAP = 2  # max concepts per (course_id, study_date)
WEAK_THRESHOLD = 0.6  # best_score/best_total below this -> scheduled earlier (weak-first)


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

    Override-aware: a concept with a row in `schedule_overrides` (a manual
    drag-to-a-different-day move, keyed by the stable (exam_id, concept_id)
    pair) is pinned to that date — clamped into [today, exam_date-1] — instead
    of being placed by the outward-search algorithm, so a manual move survives
    the next automatic regenerate (schedule.py deletes+reinserts all
    schedule_items every time). The function remains pure and deterministic
    for a fixed override set.

    Weak-first (quiz-adaptive): within each exam's remaining (undone) concept
    list, concepts whose `lesson_progress.best_score/best_total` is below
    WEAK_THRESHOLD are stably moved ahead of the rest (order within each group
    is otherwise unchanged — still order_index/id order), so they land on
    earlier "ideal" days in the even spread. This never bypasses the
    per-course/day cap (unlike a manual override) — it only changes ranking
    among concepts competing for the same window, keeping the function pure
    and deterministic for a fixed lesson_progress snapshot.
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

        # Quiz-adaptive: concepts with a below-threshold best quiz score (and
        # not yet done) are scheduled earlier within their exam group.
        weak_ids = {
            r["concept_id"] for r in conn.execute(
                "SELECT lp.concept_id FROM lesson_progress lp "
                "JOIN concepts c ON c.id = lp.concept_id "
                "JOIN courses co ON co.id = c.course_id "
                "WHERE co.semester_id = ? AND lp.done = 0 "
                "AND lp.best_total > 0 AND (lp.best_score * 1.0 / lp.best_total) < ?",
                (semester_id, WEAK_THRESHOLD),
            ).fetchall()
        }

        # Manual moves (drag-to-a-different-day on the dashboard) — keyed by
        # the stable (exam_id, concept_id) pair since schedule_items.id is
        # ephemeral (recreated on every regenerate). See schedule_overrides in
        # db.py.
        overrides = {
            (r["exam_id"], r["concept_id"]): r["study_date"]
            for r in conn.execute(
                "SELECT exam_id, concept_id, study_date FROM schedule_overrides "
                "WHERE semester_id = ?",
                (semester_id,),
            ).fetchall()
        }
    finally:
        conn.close()

    load: dict[tuple[int, str], int] = {}  # (course_id, 'YYYY-MM-DD') -> count
    # Same-concept/same-day guard: a concept ticked in >=2 exams is scheduled
    # once per exam (spaced review), but must never land on the SAME day twice.
    placed_concept_days: set[tuple[int, str]] = set()  # (concept_id, 'YYYY-MM-DD')
    items: list[dict] = []

    for exam in exams:
        # Drop completed concepts right away: an exam with no remaining
        # undone concepts contributes nothing to the schedule.
        cids = [c for c in exam["concept_ids"] if c not in done_ids]
        if not cids:
            continue
        # Weak-first, stable: preserves the existing order_index/id order
        # within each group (weak, then the rest), so a weak concept gets an
        # earlier "ideal" day in the even spread below.
        cids = sorted(cids, key=lambda c: 0 if c in weak_ids else 1)

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
            ov = overrides.get((exam["id"], concept_id))
            if ov:
                # Manually pinned: honor the override date instead of the
                # outward-search placement, clamped to [today, exam_date-1] so
                # a moved lesson always stays before its exam. Bypasses the
                # per-course/day cap (a manual move may legitimately exceed
                # it) but still counts toward `load` so non-pinned siblings
                # spread around it.
                try:
                    ovd = date.fromisoformat(ov)
                except ValueError:
                    ovd = None
                if ovd is not None:
                    latest = date.fromisoformat(exam["exam_date"]) - timedelta(days=1)
                    if latest < today:
                        latest = today
                    pinned = min(max(ovd, today), latest)
                    d = pinned.isoformat()
                    load[(exam["course_id"], d)] = load.get((exam["course_id"], d), 0) + 1
                    placed_concept_days.add((concept_id, d))
                    items.append({
                        "semester_id": semester_id,
                        "course_id": exam["course_id"],
                        "exam_id": exam["id"],
                        "concept_id": concept_id,
                        "study_date": d,
                        "order_index": ci,
                    })
                    continue

            ideal = (ci * n) // max(1, len(cids))  # spread across the whole window
            if ideal >= n:
                ideal = n - 1
            # Search outward from `ideal` (deterministic offset order
            # 0, +1, -1, +2, -2, ...) in tiers:
            #   1) nearest day under cap AND not already holding this concept —
            #      for a concept in a single exam this always matches first, so
            #      single-exam scheduling is unchanged;
            #   2) if none (a repeat of this concept from another exam), the
            #      nearest day that just isn't already holding this concept
            #      (relax the cap before ever duplicating a concept on a day);
            #   3) degenerate fallback (window smaller than the concept count):
            #      the ideal day.
            course_id = exam["course_id"]
            chosen_idx = None
            for off in _outward(n):
                idx = ideal + off
                if 0 <= idx < n:
                    di = window[idx].isoformat()
                    if load.get((course_id, di), 0) < cap and (concept_id, di) not in placed_concept_days:
                        chosen_idx = idx
                        break
            if chosen_idx is None:
                for off in _outward(n):
                    idx = ideal + off
                    if 0 <= idx < n and (concept_id, window[idx].isoformat()) not in placed_concept_days:
                        chosen_idx = idx
                        break
            if chosen_idx is None:
                chosen_idx = ideal
            d = window[chosen_idx].isoformat()
            load[(course_id, d)] = load.get((course_id, d), 0) + 1
            placed_concept_days.add((concept_id, d))
            items.append({
                "semester_id": semester_id,
                "course_id": exam["course_id"],
                "exam_id": exam["id"],
                "concept_id": concept_id,
                "study_date": d,
                "order_index": ci,
            })

    return items
