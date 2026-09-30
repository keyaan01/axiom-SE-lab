// Axiom dashboard: hash-routed views for the semester/course list and a
// per-course detail shell (materials & note generation land here in Step 2).

const inputCls = 'field-input';

const trashIcon =
  '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7"/></svg>';

// Small pencil icon for inline "rename" affordances (canvas file rows, Build 9 Phase 2b).
const renameIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

// Archive-box icon (Courses page redesign — semester "Archive" control).
const archiveIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4">' +
  '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8"/><path d="M10 13h4"/></svg>';

// Friendly open-book glyph for Courses-page empty states.
const emptyCourseIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="h-8 w-8 text-subtle">' +
  '<path d="M12 5c-1.7-1.2-4-1.7-6.5-1.7S1 3.9 1 5.6v12.8c0 .3.3.5.6.4C3.7 18 5.9 18 8 18.7c1.5.5 2.9 1.2 4 2.1"/>' +
  '<path d="M12 5c1.7-1.2 4-1.7 6.5-1.7S23 3.9 23 5.6v12.8c0 .3-.3.5-.6.4-2.1-.9-4.3-.9-6.4-.2-1.5.5-2.9 1.2-4 2.1"/>' +
  '<path d="M12 5v14.8"/></svg>';

const esc = ui.escapeHtml;

// Tiny 14px stroke icons for the course-card stat chips (Build 13 FF2, Fix 1):
// a document (materials), a small connected-nodes/graph glyph (concepts), and
// a pencil (notes) — consistent stroke-width/linecap with the app's other
// inline icons (trashIcon, archiveIcon, etc.) at a smaller scale.
const statMaterialIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M14 3v5h5"/></svg>';
const statConceptIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<circle cx="5" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="12" cy="18" r="1.6"/>' +
  '<path d="M6.4 7.1L11 16M17.6 7.1L13 16"/></svg>';
const statNoteIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';

// One small icon+label pill for the course-card stat row. `label` is the
// full singular/plural text (e.g. "2 materials") and is shown directly in
// the chip; it also stays on the tooltip for accessibility/hover clarity.
function courseStatChip(icon, count, label) {
  return `<span class="course-stat" title="${esc(label)}">${icon}<span>${esc(label)}</span></span>`;
}

/* ---------- accent signifiers (DESIGN.md §2 + §8 Priority 2) ----------
   Cycle the 5 candy accents (mint/peach/sky/lilac/lemon) as category
   signifiers. accentKey(id) is id-keyed (stable per-course everywhere a
   course is the category, e.g. lesson rows/calendar chips across many
   lists); accentKeyByIndex(i) is position-keyed (simple visual variety
   within one flat list, e.g. course/concept cards on their own page). */
const ACCENT_KEYS = ['mint', 'peach', 'sky', 'lilac', 'lemon'];
function accentKey(id) {
  const n = Math.abs(Number(id)) || 0;
  return ACCENT_KEYS[n % ACCENT_KEYS.length];
}
function accentKeyByIndex(i) {
  const n = Math.abs(Number(i)) || 0;
  return ACCENT_KEYS[n % ACCENT_KEYS.length];
}
const accentDotCls = (id) => `dot dot-${accentKey(id)}`;
const accentDotClsByIndex = (i) => `dot dot-${accentKeyByIndex(i)}`;
const accentChipCls = (id) => `chip-${accentKey(id)}`;
const accentEdgeStyle = (id) => `border-left:3px solid var(--${accentKey(id)})`;
const accentContainerStyle = (id) => `background:var(--${accentKey(id)}-c);color:var(--on-${accentKey(id)}-c)`;
// Rich "app-icon" tile: accent gradient + inset ring + soft colored glow.
const accentTileStyle = (id) => { const k = accentKey(id); return `background:linear-gradient(140deg, var(--${k}-c), color-mix(in srgb, var(--${k}) 26%, var(--${k}-c)));color:var(--on-${k}-c);box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--${k}) 32%, transparent), 0 6px 16px -6px var(--${k})`; };

// Entrance-stagger helper (Priority 2, optional): inline animation-delay
// capped ~240ms, used on first-render grids/lists via the .rise-in class.
const riseDelayStyle = (i) => `animation-delay:${Math.min(i * 40, 240)}ms`;

function field(label, inner, hint) {
  return `<label class="block">
    <span class="text-sm font-medium text-neutral-700">${label}</span>
    ${inner}
    ${hint ? `<span class="mt-1 block text-xs text-neutral-400">${hint}</span>` : ''}
  </label>`;
}

/* ---------- rendering ---------- */

// First letters of the first two words (uppercased); a single-word name falls
// back to its first 1-2 characters. Used for the course "app-icon" tile.
function courseInitials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function courseCard(c, i = 0) {
  const code = c.code
    ? `<div class="mt-1"><span class="chip ${accentChipCls(c.id)}">${esc(c.code)}</span></div>`
    : '';
  const desc = c.description
    ? `<p class="mt-3 text-sm text-muted line-clamp-2">${esc(c.description)}</p>`
    : `<p class="mt-3 text-sm italic text-subtle">No description</p>`;
  const materials = c.material_count || 0;
  const concepts = c.concept_count || 0;
  const notes = c.note_count || 0;
  return `
    <div data-action="open-course" data-id="${c.id}" style="${riseDelayStyle(i)}"
      class="card card-interactive rise-in group relative cursor-pointer p-5">
      <button data-action="del-course" data-id="${c.id}" data-name="${esc(c.name)}" title="Delete course" aria-label="Delete course ${esc(c.name)}"
        class="icon-btn icon-btn-danger absolute right-3 top-3 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100">
        ${trashIcon}
      </button>
      <div class="flex items-start gap-3 pr-9">
        <span class="course-tile" style="${accentTileStyle(c.id)}">${esc(courseInitials(c.name))}</span>
        <div class="min-w-0 pt-0.5">
          <h4 class="min-w-0 truncate text-base font-semibold leading-snug">${esc(c.name)}</h4>
          ${code}
        </div>
      </div>
      ${desc}
      <div class="mt-4 flex flex-wrap items-center gap-2">
        ${courseStatChip(statMaterialIcon, materials, `${materials} material${materials === 1 ? '' : 's'}`)}
        ${courseStatChip(statConceptIcon, concepts, `${concepts} concept${concepts === 1 ? '' : 's'}`)}
        ${courseStatChip(statNoteIcon, notes, `${notes} note${notes === 1 ? '' : 's'}`)}
      </div>
    </div>`;
}

function semesterBlock(sem, courses) {
  const body = courses.length
    ? `<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${courses.map((c, i) => courseCard(c, i)).join('')}</div>`
    : `<div class="dashed mt-5 flex flex-col items-center gap-3 p-8 text-center">
        ${emptyCourseIcon}
        <p class="text-sm text-muted">No courses yet in this semester.</p>
        <button data-action="new-course" data-semester-id="${sem.id}" class="btn btn-secondary">+ New course</button>
      </div>`;
  return `
    <section class="mb-10">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <h3 class="text-lg font-semibold">${esc(sem.name)}</h3>
          <span class="chip chip-neutral">${sem.course_count} course${sem.course_count === 1 ? '' : 's'}</span>
          <button data-action="archive-semester" data-id="${sem.id}" data-name="${esc(sem.name)}" title="Archive semester" class="icon-btn">${archiveIcon}</button>
          <button data-action="del-semester" data-id="${sem.id}" data-name="${esc(sem.name)}" title="Delete semester" class="icon-btn icon-btn-danger">${trashIcon}</button>
        </div>
        <button data-action="new-course" data-semester-id="${sem.id}" class="btn btn-secondary">+ New course</button>
      </div>
      ${body}
    </section>`;
}

function archivedSemesterRow(sem) {
  return `
    <div class="flex items-center justify-between rounded-xl px-4 py-2.5" style="background:var(--surface-2)">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-muted">${esc(sem.name)}</span>
        <span class="text-xs text-subtle">${sem.course_count} course${sem.course_count === 1 ? '' : 's'}</span>
      </div>
      <button data-action="unarchive-semester" data-id="${sem.id}" data-name="${esc(sem.name)}" class="btn btn-secondary">Unarchive</button>
    </div>`;
}

function archivedSection(archived) {
  return `
    <details class="mt-2 pt-6" style="border-top:1px solid var(--border)">
      <summary class="cursor-pointer text-sm font-medium text-muted">Archived <span class="chip chip-neutral ml-1">${archived.length}</span></summary>
      <div class="mt-3 space-y-2">${archived.map(archivedSemesterRow).join('')}</div>
    </details>`;
}

/* ---------- schedule (Build 2, Step 4): dashboard day-by-day agenda ---------- */

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function daysBetween(fromIso, toIso) {
  const from = new Date(`${fromIso}T00:00:00`);
  const to = new Date(`${toIso}T00:00:00`);
  return Math.round((to - from) / 86400000);
}

function fmtDayHeader(iso) {
  const days = daysBetween(todayISO(), iso);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const chevronIcon =
  '<svg class="h-4 w-4 shrink-0 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>';

// Small "lesson done" indicator used across note cards, schedule rows, and
// calendar chips (Build 3, Step 4). Emerald = done, consistently.
const doneCheckIcon =
  '<svg class="h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';

// Drag-to-reschedule affordances (Build 12 Further Fixes): a small pin glyph
// marks a lesson row/chip that carries a manual day override, and a
// counter-clockwise "reset" arrow undoes it (DELETE /schedule/override).
const movedPinIcon =
  '<svg class="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0112 3.5a6.5 6.5 0 016.5 6.5c0 5.4-6.5 11-6.5 11z"/>' +
  '<circle cx="12" cy="10" r="2" fill="currentColor" stroke="none"/></svg>';
const resetMoveIcon =
  '<svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>';

// Quiz-performance "weak" indicator (Feature 2): matches the backend
// scheduler's WEAK_THRESHOLD (services/scheduler.py) — a concept whose best
// quiz score falls below this is scheduled earlier AND surfaces a small
// amber "Review" pill here so it's visible why. Never shown once done.
const LESSON_WEAK_THRESHOLD = 0.6;

function lessonRow(item, i = 0) {
  const code = item.course_code
    ? `<span class="chip ${accentChipCls(item.course_id)} ml-1.5 shrink-0 !px-1.5 !py-0.5 align-middle" style="font-size:10px">${esc(item.course_code)}</span>`
    : '';
  const days = daysBetween(todayISO(), item.exam_date);
  const daysText = days === 0 ? 'today' : days === 1 ? 'in 1 day' : days > 1 ? `in ${days} days` : 'past';
  const dotCls = item.note_id ? 'bg-emerald-500' : 'bg-amber-400';
  const doneMark = item.done ? doneCheckIcon : '';
  // Build 12 FF: a lesson with a manual day override (drag-to-reschedule, or
  // still pinned after a regenerate) shows a "Moved" pill + a reset control
  // that clears the override (DELETE /schedule/override) and snaps it back to
  // its automatic day. Root element is a <div> (not <button>) so the reset
  // control can be a real nested <button> — a nested <button> inside a
  // <button> is invalid HTML (bit us before with note cards).
  const movedMark = item.moved
    ? `<span class="lesson-moved-pill" title="Moved — click reset to restore automatic day">${movedPinIcon}<span>Moved</span></span>`
    : '';
  const resetBtn = item.moved
    ? `<button data-action="reset-schedule-move" data-exam-id="${item.exam_id != null ? item.exam_id : ''}" data-concept-id="${item.concept_id != null ? item.concept_id : ''}"
        title="Reset to automatic day" class="lesson-reset-btn shrink-0">${resetMoveIcon}</button>`
    : '';
  // F5: compute weak WITHOUT the done gate for display purposes so a lesson
  // marked done doesn't just lose its review cue outright — it's muted instead
  // (still below the weak threshold, just no longer the active focus).
  const weak = item.best_total > 0 && (item.best_score / item.best_total) < LESSON_WEAK_THRESHOLD;
  const reviewMark = weak
    ? `<span class="lesson-review-pill${item.done ? ' lesson-review-pill-done' : ''}" title="Best quiz score so far: ${item.best_score}/${item.best_total}">Review &middot; ${item.best_score}/${item.best_total}</span>`
    : '';
  return `
    <div data-action="open-schedule-lesson" data-item-id="${item.id}" data-course-id="${item.course_id}" data-concept-id="${item.concept_id != null ? item.concept_id : ''}" data-exam-id="${item.exam_id != null ? item.exam_id : ''}"
      style="${riseDelayStyle(i)}"
      class="card card-interactive dash-float rise-in flex w-full items-center gap-3 px-4 py-3 text-left">
      <span class="h-3 w-3 shrink-0 rounded-full ${dotCls}" style="box-shadow:0 0 9px 1px ${item.note_id ? 'var(--success)' : 'var(--warning)'}"></span>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center">
          <span class="truncate text-sm text-neutral-500">${esc(item.course_name)}</span>${code}${movedMark}
        </div>
        <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
          <p class="min-w-0 truncate text-sm font-medium ${item.done ? 'text-neutral-400 line-through' : ''}">${esc(item.concept_name)}</p>
          ${doneMark}${reviewMark}
        </div>
      </div>
      <div class="hidden shrink-0 text-right sm:block">
        <p class="truncate text-xs text-neutral-500">for ${esc(item.exam_name)}</p>
        <p class="mt-0.5 text-xs text-neutral-400">${daysText}</p>
      </div>
      ${resetBtn}
      ${chevronIcon}
    </div>`;
}

// Small document icon distinguishing an "exam revision" row from a normal
// lesson row everywhere schedule rows render (Build 12 Phase 4).
const revisionDocIcon =
  '<svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M7 3h7l5 5v12a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/>' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M14 3v5h5"/></svg>';

// A synthetic schedule row for an upcoming exam's revision PDF (kind ===
// 'revision' — see routers/schedule.py's _revision_rows). Deliberately styled
// distinctly from lessonRow (dashed lilac border/icon, no concept dot) so it
// reads as "exam revision", not a normal lesson; click opens the same
// open-revision flow used by the analysis view.
function revisionRow(item, i = 0) {
  const code = item.course_code
    ? `<span class="ml-1.5 shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 align-middle">${esc(item.course_code)}</span>`
    : '';
  const ready = item.revision_status === 'compiled';
  const generating = item.revision_status === 'generating';
  const stateLabel = ready ? 'Ready ✓' : generating ? 'Preparing…' : 'Prepare';
  const stateCls = ready ? 'text-emerald-600' : generating ? 'text-sky-600' : 'text-amber-600';
  return `
    <button data-action="open-revision" data-exam-id="${item.exam_id}" data-course-name="${esc(item.course_name)}" data-exam-name="${esc(item.exam_name)}"
      style="${riseDelayStyle(i)};border:1px dashed color-mix(in srgb, var(--lilac) 50%, transparent)"
      class="card card-interactive rise-in qa-revision-row flex w-full items-center gap-3 px-4 py-3 text-left">
      <span class="shrink-0" style="color:var(--lilac)">${revisionDocIcon}</span>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center">
          <span class="truncate text-sm text-neutral-500">${esc(item.course_name)}</span>${code}
        </div>
        <p class="mt-0.5 truncate text-sm font-medium">📄 Exam revision — ${esc(item.course_code || item.course_name)}</p>
      </div>
      <div class="hidden shrink-0 text-right sm:block">
        <p class="truncate text-xs text-neutral-500">for ${esc(item.exam_name)} · ${fmtDate(item.study_date)}</p>
        <p class="mt-0.5 text-xs font-semibold ${stateCls}">${stateLabel}</p>
      </div>
      ${chevronIcon}
    </button>`;
}

function lessonList(items) {
  return `<div class="flex w-full flex-col gap-3">${items.map((it, i) => (it.kind === 'revision' ? revisionRow(it, i) : lessonRow(it, i))).join('')}</div>`;
}

function daySectionHtml(iso, items) {
  const body = items.length
    ? `<div class="mt-2">${lessonList(items)}</div>`
    : `<p class="mt-2 text-sm text-neutral-400">Nothing scheduled today.</p>`;
  // data-day-drop (Build 12 FF): a drag-to-reschedule drop target — see
  // dashDragPointerDown, which resolves the hovered target via
  // document.elementFromPoint(...).closest('[data-day-drop]').
  return `
    <section class="mt-6 first:mt-0" data-day-drop="${iso}">
      <h3 class="text-sm font-semibold text-neutral-700">${fmtDayHeader(iso)}</h3>
      ${body}
    </section>`;
}

async function regenSchedule() {
  try {
    await api.post('/schedule/generate-all', {});
    ui.toast('Schedule updated');
    await renderDashContent(); // patch in place — no header/scroll jump
  } catch (e) { ui.toast(e.message, 'error'); }
}

/* ---------- dashboard calendar (Build 2 Further-Fixes, Step 5) ---------- */

function firstOfMonthISO(iso) {
  const d = new Date(`${iso}T00:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function addMonthsISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-01`;
}

function monthLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function daysInMonth(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function monthEndISO(iso) {
  const n = daysInMonth(iso);
  const d = new Date(`${iso}T00:00:00`);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}-${String(n).padStart(2, '0')}`;
}

function dashboardViewToggleHtml() {
  const cls = (v) => v === dashboardView
    ? 'rounded-md bg-white px-3 py-1 text-sm font-medium text-ink shadow-sm'
    : 'rounded-md px-3 py-1 text-sm font-medium text-neutral-500 hover:text-neutral-700';
  return `
    <div class="inline-flex rounded-lg bg-neutral-100 p-0.5">
      <button type="button" data-action="dash-view-list" class="${cls('list')}">List</button>
      <button type="button" data-action="dash-view-calendar" class="${cls('calendar')}">Calendar</button>
    </div>`;
}

function calendarHeaderHtml(monthStart) {
  return `
    <div class="mt-4 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-neutral-700">${monthLabel(monthStart)}</h3>
      <div class="flex items-center gap-1">
        <button data-action="cal-prev" title="Previous month"
          class="rounded-lg border border-neutral-200 px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-50">&lsaquo;</button>
        <button data-action="cal-next" title="Next month"
          class="rounded-lg border border-neutral-200 px-2.5 py-1 text-sm text-neutral-600 hover:bg-neutral-50">&rsaquo;</button>
      </div>
    </div>`;
}

function calendarWeekdayHeaderHtml() {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<div class="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-400">${labels.map((l) => `<div class="py-1">${l}</div>`).join('')}</div>`;
}

const CAL_MAX_CHIPS = 3;

function calendarChip(item) {
  const dotCls = item.note_id ? 'bg-emerald-500' : 'bg-amber-400';
  const code = item.course_code
    ? `<span class="shrink-0 opacity-70">${esc(item.course_code)}</span>`
    : '';
  const doneMark = item.done ? `<span class="shrink-0 text-emerald-500" title="Done">${doneCheckIcon}</span>` : '';
  // A tiny "moved" dot (no reset control here — too cramped; reset from the
  // list view). Chip stays draggable (Build 12 FF: drag onto another day cell).
  const movedMark = item.moved
    ? `<span class="calendar-chip-moved-dot" title="Moved — manually rescheduled"></span>`
    : '';
  return `
    <button data-action="open-schedule-lesson" data-item-id="${item.id}" data-course-id="${item.course_id}" data-concept-id="${item.concept_id != null ? item.concept_id : ''}" data-exam-id="${item.exam_id != null ? item.exam_id : ''}" style="${accentContainerStyle(item.course_id)}"
      class="card-interactive flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}"></span>
      <span class="min-w-0 flex-1 truncate ${item.done ? 'line-through opacity-60' : ''}">${esc(item.concept_name)}</span>
      ${movedMark}
      ${doneMark}
      ${code}
    </button>`;
}

// Calendar-month equivalent of revisionRow: a compact, visually distinct chip
// (dashed lilac border + doc glyph, no lesson dot) for a 'revision' row.
function revisionChip(item) {
  const ready = item.revision_status === 'compiled';
  return `
    <button data-action="open-revision" data-exam-id="${item.exam_id}" data-course-name="${esc(item.course_name)}" data-exam-name="${esc(item.exam_name)}"
      style="background:var(--lilac-c);color:var(--on-lilac-c);border:1px dashed color-mix(in srgb, var(--lilac) 55%, transparent)"
      class="card-interactive flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight">
      <span class="shrink-0">📄</span>
      <span class="min-w-0 flex-1 truncate">Revision · ${esc(item.course_code || item.course_name)}</span>
      ${ready ? `<span class="shrink-0 text-emerald-600" title="Ready">${doneCheckIcon}</span>` : ''}
    </button>`;
}

function calendarDayCell(iso, items, isCurrentMonth, isToday) {
  const dayNum = Number(iso.slice(-2));
  const visible = items.slice(0, CAL_MAX_CHIPS);
  const extra = items.length - visible.length;
  // Visual fixes round: these used to be hardcoded Tailwind grays
  // (border-neutral-100/50, bg-white/neutral-50, ring-neutral-800), which
  // stayed light regardless of theme. Migrated to CSS-var arbitrary values so
  // the calendar follows the same light/dark tokens as the rest of the app.
  const cellCls = [
    'flex min-h-[6.5rem] flex-col gap-1 rounded-lg border p-1.5',
    isCurrentMonth ? 'bg-[var(--surface)] border-[var(--border)]' : 'bg-[var(--surface-2)] border-[var(--border)]',
    isToday ? 'ring-2 ring-inset ring-[var(--primary)]' : '',
  ].join(' ');
  const numCls = isToday
    ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-semibold text-[var(--on-primary)]'
    : isCurrentMonth ? 'text-xs font-medium text-[var(--text-muted)]' : 'text-xs font-medium text-[var(--text-subtle)]';
  // data-day-drop (Build 12 FF): same drop-target contract as daySectionHtml.
  return `
    <div class="${cellCls}" data-day-drop="${iso}">
      <span class="${numCls}">${dayNum}</span>
      <div class="flex flex-col gap-1">
        ${visible.map((it) => (it.kind === 'revision' ? revisionChip(it) : calendarChip(it))).join('')}
        ${extra > 0 ? `<span class="px-1 text-[10px] text-[var(--text-subtle)]">+${extra} more</span>` : ''}
      </div>
    </div>`;
}

function calendarGridHtml(monthStart, byDate) {
  const today = todayISO();
  const firstWeekday = new Date(`${monthStart}T00:00:00`).getDay(); // 0=Sun..6=Sat
  const totalDays = daysInMonth(monthStart);
  const cells = [];
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const iso = addDaysISO(monthStart, -(i + 1));
    cells.push(calendarDayCell(iso, byDate[iso] || [], false, iso === today));
  }
  for (let d = 0; d < totalDays; d++) {
    const iso = addDaysISO(monthStart, d);
    cells.push(calendarDayCell(iso, byDate[iso] || [], true, iso === today));
  }
  const trailing = (7 - (cells.length % 7)) % 7;
  for (let i = 0; i < trailing; i++) {
    const iso = addDaysISO(monthStart, totalDays + i);
    cells.push(calendarDayCell(iso, byDate[iso] || [], false, iso === today));
  }
  return `
    <div class="mt-3 overflow-x-auto">
      <div class="min-w-[640px] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] p-3">
        ${calendarWeekdayHeaderHtml()}
        <div class="mt-1 grid grid-cols-7 gap-1">${cells.join('')}</div>
      </div>
    </div>`;
}

/* ---------- dashboard ---------- */

let scheduleHorizon = null; // module-level: preserved across re-renders (e.g. after regenerate)
let dashboardView = 'list'; // 'list' | 'calendar' — module-level: preserved across re-renders
let calendarMonth = null;   // ISO first-of-month string — module-level: preserved across re-renders

// Build 12 FF: set true the instant a lesson-row/chip drag crosses the
// threshold, consumed (and reset) by the document click handler so the
// native click that follows a real drag+drop doesn't ALSO re-open the
// lesson. Reset defensively at the start of every new drag gesture too, in
// case a browser ever skips synthesizing that trailing click.
let dashJustDragged = false;

// Build 5, Step 2: one-time overdue catch-up. `dashCatchupChecked` is reset to
// false only by route() right before it dispatches to a *fresh* dashboard entry
// (see route()); the view toggle, horizon picker, calendar nav, and Regenerate
// button (Build 7 Phase 4, Fix A) all patch #dash-content in place via
// renderDashContent() and never call renderDashboard() again, so they leave
// the flag alone and never re-trigger the check. `catchupBanner` holds the
// message to show (or '' for none) and survives those same internal
// re-renders so the banner stays put until dismissed or the next fresh entry
// recomputes it.
let dashCatchupChecked = false;
let catchupBanner = '';

const catchupBannerHtml = (msg) => `
  <div class="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    <span>${esc(msg)}</span>
    <button data-action="dismiss-catchup" title="Dismiss"
      class="shrink-0 rounded-md p-1 text-amber-500 hover:bg-amber-100 hover:text-amber-700">✕</button>
  </div>`;

// The "Show through" date-picker + Download .ics + Regenerate schedule row.
// Lives in its own #dash-actions slot (separate from #dash-content) because
// the date picker's visibility depends on dashboardView but must NOT trigger
// a #dash-content refetch-and-swap by itself — setDashboardView() repaints
// this slot in place alongside the toggle, and wireDashActions() re-binds the
// (possibly just-recreated) date input each time.
function dashActionsHtml() {
  const today = todayISO();
  return `
    ${dashboardView === 'list' ? `
    <label class="flex items-center gap-2 text-sm text-neutral-500">
      Show through
      <input id="schedule-horizon" type="date" value="${scheduleHorizon}" min="${today}"
        class="${inputCls}" style="margin-top:0;width:auto" />
    </label>` : ''}
    <a href="/api/schedule/upcoming.ics" class="${btnSecondary}">Download .ics</a>
    <button data-action="regen-schedule" class="${btnSecondary}">Regenerate schedule</button>`;
}

function wireDashActions() {
  const horizonInput = document.getElementById('schedule-horizon');
  if (horizonInput) {
    horizonInput.addEventListener('change', () => {
      const today = todayISO();
      const v = horizonInput.value;
      scheduleHorizon = v && v >= today ? v : today;
      renderDashContent();
    });
  }
}

// Replays the fadeSwap entrance on a content container that was just given
// fresh innerHTML — remove-reflow-readd so the CSS animation restarts every
// time (a plain classList.add on an element that already has the class is a
// no-op and would only play once).
function playFadeSwap(el) {
  if (!el) return;
  el.classList.remove('fade-swap');
  void el.offsetWidth; // force reflow
  el.classList.add('fade-swap');
}

// G6: hides the List/Calendar toggle + the Show-through/.ics/Regenerate
// controls when the list view's "nothing scheduled" empty state is showing
// (so the empty card + its "Go to courses" CTA are the only things left);
// shows them again once there's anything to manage. Calendar view has no
// equivalent empty state — a single visible month being empty doesn't mean
// the whole schedule is empty, and hiding the toggle there would strand the
// user in an empty month with no way back to List — so the toolbar always
// shows while in calendar view. Plain inline `style.display` (not a `hidden`
// class) so it can't lose a specificity fight with `#dash-actions`' own
// `flex` utility class.
function setDashToolbarVisible(visible) {
  const toggleHost = document.getElementById('dash-view-toggle');
  const actionsHost = document.getElementById('dash-actions');
  if (toggleHost) toggleHost.style.display = visible ? '' : 'none';
  if (actionsHost) actionsHost.style.display = visible ? '' : 'none';
}

// Fills #dash-content ONLY (list agenda or calendar month grid, whichever
// dashboardView currently is) — never touches the greeting/toggle/actions
// header above it, so switching views or paging the calendar never scrolls
// the page or nudges any other element (Build 7 Phase 4, Fix A).
async function renderDashContent() {
  const host = document.getElementById('dash-content');
  if (!host) return;
  const today = todayISO();
  let bodyHtml;
  let isEmpty = false; // list view's "nothing scheduled" state — see setDashToolbarVisible

  if (dashboardView === 'calendar') {
    const monthStart = calendarMonth;
    const monthEnd = monthEndISO(monthStart);
    let items;
    try {
      items = await api.get(`/schedule/upcoming?from=${monthStart}&to=${monthEnd}`);
    } catch (e) {
      host.innerHTML = errorBox(`Could not load schedule: ${esc(e.message)}`);
      return;
    }
    const byDate = {};
    items.forEach((it) => { (byDate[it.study_date] = byDate[it.study_date] || []).push(it); });
    bodyHtml = calendarHeaderHtml(monthStart) + calendarGridHtml(monthStart, byDate);
  } else {
    let upcoming;
    try {
      upcoming = await api.get(`/schedule/upcoming?from=${today}&to=${scheduleHorizon}`);
    } catch (e) {
      host.innerHTML = errorBox(`Could not load schedule: ${esc(e.message)}`);
      return;
    }
    const byDate = {};
    upcoming.forEach((it) => { (byDate[it.study_date] = byDate[it.study_date] || []).push(it); });

    if (!upcoming.length) {
      isEmpty = true;
      bodyHtml = `
        <div class="mt-4 dashed p-8 text-center text-sm">
          No study plan yet. Add exams to your courses, then click Regenerate schedule.
          <div class="mt-3"><a href="#/courses" class="link text-sm font-medium">Go to courses &rarr;</a></div>
        </div>`;
    } else {
      bodyHtml = daySectionHtml(today, byDate[today] || []);
      const totalDays = daysBetween(today, scheduleHorizon);
      for (let i = 1; i <= totalDays; i++) {
        const d = addDaysISO(today, i);
        const items = byDate[d] || [];
        if (!items.length) continue;
        bodyHtml += daySectionHtml(d, items);
      }
    }
  }

  host.innerHTML = bodyHtml;
  playFadeSwap(host);
  setDashToolbarVisible(dashboardView === 'list' ? !isEmpty : true);
}

// Switches list<->calendar in place: repaints the toggle + actions slots
// (small, static-position elements) and re-fetches only #dash-content — the
// greeting, catch-up banner, and page scroll position never move.
function setDashboardView(v) {
  if (dashboardView === v) return;
  dashboardView = v;
  const toggleHost = document.getElementById('dash-view-toggle');
  if (toggleHost) toggleHost.innerHTML = dashboardViewToggleHtml();
  const actionsHost = document.getElementById('dash-actions');
  if (actionsHost) { actionsHost.innerHTML = dashActionsHtml(); wireDashActions(); }
  renderDashContent();
}

async function renderDashboard() {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  const today = todayISO();
  if (!scheduleHorizon || scheduleHorizon < today) scheduleHorizon = addDaysISO(today, 6);
  if (!calendarMonth) calendarMonth = firstOfMonthISO(today);

  // One-time auto catch-up: only runs on a fresh dashboard entry (flag reset
  // by route()). The view toggle, horizon change, cal-prev/next, and
  // regen-schedule all patch #dash-content in place now (see above) and never
  // call renderDashboard() again, so they never re-trigger this check either.
  if (!dashCatchupChecked) {
    dashCatchupChecked = true;
    try {
      const { count } = await api.get('/schedule/overdue');
      if (count > 0) {
        await api.post('/schedule/generate-all', {});
        catchupBanner = `Caught you up — ${count} missed lesson${count === 1 ? '' : 's'} rescheduled.`;
      } else {
        catchupBanner = '';
      }
    } catch (e) {
      catchupBanner = '';
      console.error('overdue catch-up check failed:', e);
    }
  }

  view.innerHTML = `
    <h1 class="mb-5 text-2xl font-semibold tracking-tight">${greetingText()}</h1>
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold tracking-tight text-neutral-800">Study plan</h2>
        <div id="dash-view-toggle">${dashboardViewToggleHtml()}</div>
      </div>
      <div id="dash-actions" class="flex flex-wrap items-center gap-3">${dashActionsHtml()}</div>
    </div>
    <div id="dash-catchup">${catchupBanner ? catchupBannerHtml(catchupBanner) : ''}</div>
    <div id="dash-content"></div>`;

  wireDashActions();
  wireDashDrag();
  await renderDashContent();
}

/* ---------- dashboard drag-to-reschedule (Build 12 Further Fixes) ----------
   Grab a lesson row (list view) or chip (calendar view) and drop it on a
   different day to pin it there — PATCH /schedule/move {exam_id, concept_id,
   study_date} (durable; survives the next regenerate); a "Moved" pill +
   reset control (see lessonRow) undoes it via DELETE /schedule/override.
   Modeled on canvasWireItemInteraction's pointerdown → threshold → ghost
   pattern, but listens on `document` for move/up (not the row itself) so a
   fast drag that leaves the row's bounds before the threshold is crossed is
   never lost, and deliberately never calls setPointerCapture/preventDefault
   on pointerdown — a plain click (no threshold crossed) is left completely
   alone so the existing 'open-schedule-lesson' click handler still opens the
   lesson. Wired once per fresh #dash-content mount: renderDashboard() always
   recreates that host div (view.innerHTML = ...), so the old element (and
   its listener) is garbage-collected — no listener pile-up across renders. */
const DASH_DRAG_THRESHOLD = 4;

function wireDashDrag() {
  const host = document.getElementById('dash-content');
  if (!host) return;
  host.addEventListener('pointerdown', dashDragPointerDown);
}

function dashDragPointerDown(e) {
  if (e.button !== 0) return;
  // Never start a drag from the reset control — let its own click fire.
  if (e.target.closest('[data-action="reset-schedule-move"]')) return;
  const row = e.target.closest('[data-action="open-schedule-lesson"]');
  if (!row) return; // not a lesson row/chip (e.g. a revision row/chip — never draggable)
  const examId = row.dataset.examId;
  const conceptId = row.dataset.conceptId;
  if (!examId || !conceptId) return; // no stable (exam_id, concept_id) move identity

  dashJustDragged = false; // defensive reset in case a prior drag's click never fired

  const fromCell = row.closest('[data-day-drop]');
  const fromIso = fromCell ? fromCell.dataset.dayDrop : null;
  const startX = e.clientX, startY = e.clientY;
  const rect = row.getBoundingClientRect();
  const offsetX = startX - rect.left, offsetY = startY - rect.top;

  let dragging = false;
  let ghost = null;
  let hoverTarget = null;

  const setHover = (target) => {
    if (target === hoverTarget) return;
    if (hoverTarget) hoverTarget.classList.remove('drop-target-active');
    if (target) target.classList.add('drop-target-active');
    hoverTarget = target;
  };

  const onMove = (ev) => {
    const dx = ev.clientX - startX, dy = ev.clientY - startY;
    if (!dragging) {
      if (Math.abs(dx) < DASH_DRAG_THRESHOLD && Math.abs(dy) < DASH_DRAG_THRESHOLD) return;
      dragging = true;
      dashJustDragged = true;
      ghost = document.createElement('div');
      ghost.className = 'dash-drag-ghost';
      ghost.style.width = rect.width + 'px';
      ghost.style.height = rect.height + 'px';
      ghost.innerHTML = row.innerHTML;
      document.body.appendChild(ghost);
      row.classList.add('dash-row-source-dragging');
      document.body.classList.add('dash-dragging-active');
    }
    ev.preventDefault();
    ghost.style.left = (ev.clientX - offsetX) + 'px';
    ghost.style.top = (ev.clientY - offsetY) + 'px';
    const el = document.elementFromPoint(ev.clientX, ev.clientY);
    setHover(el ? el.closest('[data-day-drop]') : null);
  };

  const finish = async () => {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    const target = hoverTarget;
    const wasDragging = dragging;
    setHover(null);
    if (ghost) { ghost.remove(); ghost = null; }
    row.classList.remove('dash-row-source-dragging');
    document.body.classList.remove('dash-dragging-active');
    if (!wasDragging) return; // plain click — the native click event opens the lesson as usual
    const toIso = target ? target.dataset.dayDrop : null;
    if (!toIso || toIso === fromIso) return; // dropped outside any day, or back onto the same day — no-op
    try {
      await api.patch('/schedule/move', { exam_id: +examId, concept_id: +conceptId, study_date: toIso });
      ui.toast('Moved to ' + fmtDate(toIso));
      // Optimistic single-row relocation (Further Fixes): the PATCH already
      // persisted the move server-side, so the old `await renderDashContent()`
      // here was a full re-fetch + #dash-content rebuild just to move ONE row
      // — every other row lost DOM identity and fade-replayed for no reason.
      // Re-parent just the dragged node instead; fall back to a full render
      // only if the target day isn't currently rendered in the DOM at all
      // (e.g. a future empty day renderDashContent() skips entirely) so a
      // move never silently no-ops.
      // Trade-off (intentional): the backend regenerates the WHOLE semester's
      // schedule on a move, so other rows could in theory shift slightly too
      // — we deliberately relocate only the dragged row, per the user's
      // request; any drift reconciles on the next natural full render (view
      // toggle, horizon change, calendar nav, or reload).
      const moved = dashRelocateRow(row, toIso, fromIso);
      if (!moved) await renderDashContent();
    } catch (err) { ui.toast(err.message, 'error'); }
  };

  const onUp = () => { finish(); };
  const onCancel = () => { dragging = false; finish(); };

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
}

// Relocates ONE dragged lesson row (list view) or chip (calendar view) to its
// new day in the live DOM, instead of re-fetching + rebuilding #dash-content.
// Returns true on success; false means the caller should fall back to a full
// renderDashContent() (target day not currently rendered).
function dashRelocateRow(row, toIso, fromIso) {
  return dashboardView === 'calendar'
    ? dashRelocateChip(row, toIso, fromIso)
    : dashRelocateListRow(row, toIso, fromIso);
}

function dashRelocateListRow(row, toIso, fromIso) {
  const host = document.getElementById('dash-content');
  if (!host) return false;
  const targetSection = host.querySelector(`[data-day-drop="${toIso}"]`);
  if (!targetSection) return false; // e.g. a future day with nothing scheduled isn't rendered at all

  let targetList = targetSection.querySelector('.flex.w-full.flex-col.gap-3');
  if (!targetList) {
    // Target day currently shows the "Nothing scheduled" placeholder — swap
    // it for a real list wrapper (mirrors daySectionHtml's non-empty branch).
    const placeholder = targetSection.querySelector(':scope > p');
    const wrap = document.createElement('div');
    wrap.className = 'mt-2';
    targetList = document.createElement('div');
    targetList.className = 'flex w-full flex-col gap-3';
    wrap.appendChild(targetList);
    if (placeholder) placeholder.replaceWith(wrap);
    else targetSection.appendChild(wrap);
  }

  dashMarkRowMoved(row);
  targetList.appendChild(row); // re-parents the existing node (removes it from its old parent)
  row.style.animationDelay = '0ms'; // ignore its original entrance stagger index
  playRiseIn(row);

  const fromSection = fromIso ? host.querySelector(`[data-day-drop="${fromIso}"]`) : null;
  if (fromSection) {
    const fromList = fromSection.querySelector('.flex.w-full.flex-col.gap-3');
    if (fromList && !fromList.children.length) {
      if (fromIso === todayISO()) {
        // Today's section always renders (even empty) — swap back to the
        // placeholder text instead of removing the section.
        const wrap = fromList.closest('.mt-2') || fromList;
        const placeholder = document.createElement('p');
        placeholder.className = 'mt-2 text-sm text-neutral-400';
        placeholder.textContent = 'Nothing scheduled today.';
        wrap.replaceWith(placeholder);
      } else {
        fromSection.remove(); // renderDashContent() never renders an empty non-today section either
      }
    }
  }
  return true;
}

// Adds the "Moved" pill + reset control to a lesson row that doesn't have
// them yet (first time this row is dragged) — exact markup from lessonRow().
function dashMarkRowMoved(row) {
  if (row.querySelector('.lesson-moved-pill')) return; // already marked (e.g. a second drag)
  const examId = row.dataset.examId || '';
  const conceptId = row.dataset.conceptId || '';
  const headerLine = row.querySelector('.flex.min-w-0.items-center');
  if (headerLine) {
    headerLine.insertAdjacentHTML('beforeend',
      `<span class="lesson-moved-pill" title="Moved — click reset to restore automatic day">${movedPinIcon}<span>Moved</span></span>`);
  }
  const chevron = row.lastElementChild; // chevronIcon <svg>, always the final child (see lessonRow)
  const resetHtml = `<button data-action="reset-schedule-move" data-exam-id="${examId}" data-concept-id="${conceptId}"
        title="Reset to automatic day" class="lesson-reset-btn shrink-0">${resetMoveIcon}</button>`;
  if (chevron) chevron.insertAdjacentHTML('beforebegin', resetHtml);
  else row.insertAdjacentHTML('beforeend', resetHtml);
}

function dashRelocateChip(chip, toIso, fromIso) {
  const host = document.getElementById('dash-content');
  if (!host) return false;
  const targetCell = host.querySelector(`[data-day-drop="${toIso}"]`);
  const targetList = targetCell ? targetCell.querySelector('.flex.flex-col.gap-1') : null;
  if (!targetList) return false;

  if (!chip.querySelector('.calendar-chip-moved-dot')) {
    const dot = document.createElement('span');
    dot.className = 'calendar-chip-moved-dot';
    dot.title = 'Moved — manually rescheduled';
    const nameSpan = chip.children[1]; // [dot, name, ...] — see calendarChip()
    if (nameSpan) nameSpan.insertAdjacentElement('afterend', dot);
    else chip.appendChild(dot);
  }

  targetList.appendChild(chip); // re-parents the existing node
  playRiseIn(chip);
  dashRecomputeCellOverflow(targetCell);

  const fromCell = fromIso ? host.querySelector(`[data-day-drop="${fromIso}"]`) : null;
  if (fromCell) dashRecomputeCellOverflow(fromCell);
  return true;
}

// Calendar cells cap visible chips at CAL_MAX_CHIPS + a "+N more" label
// (calendarDayCell) — re-derive both after moving a chip in or out of a cell.
// Chips are always <button>s and the overflow label the only <span>, so
// they're easy to tell apart without re-fetching the day's full item list.
function dashRecomputeCellOverflow(cell) {
  const list = cell.querySelector('.flex.flex-col.gap-1');
  if (!list) return;
  const chips = Array.from(list.children).filter((el) => el.tagName === 'BUTTON');
  chips.forEach((el, i) => { el.style.display = i < CAL_MAX_CHIPS ? '' : 'none'; });
  const extra = chips.length - CAL_MAX_CHIPS;
  let overflow = list.querySelector(':scope > span');
  if (extra > 0) {
    if (!overflow) {
      overflow = document.createElement('span');
      overflow.className = 'px-1 text-[10px] text-[var(--text-subtle)]';
      list.appendChild(overflow);
    }
    overflow.textContent = `+${extra} more`;
  } else if (overflow) {
    overflow.remove();
  }
}

// Replays the `rise-in` entrance keyframe on a single just-relocated element
// (a plain classList.add would be a no-op if the class is already present) —
// gives the moved row/chip a brief settle animation without touching or
// fading anything else in the list.
function playRiseIn(el) {
  if (!el) return;
  el.classList.remove('rise-in');
  void el.offsetWidth; // force reflow so the animation restarts
  el.classList.add('rise-in');
}

async function resetScheduleMove(examId, conceptId) {
  try {
    await api.del('/schedule/override', { exam_id: +examId, concept_id: +conceptId });
    ui.toast('Reset to automatic day');
    await renderDashContent();
  } catch (e) { ui.toast(e.message, 'error'); }
}

/* ---------- courses view (Build 2, Step 4): semester/course management ---------- */

async function renderCourses() {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-subtle">Loading…</p>';
  const [allSemesters, courses] = await Promise.all([
    api.get('/semesters?include_archived=1'),
    api.get('/courses'),
  ]);
  const semesters = allSemesters.filter((s) => !s.archived);
  const archived = allSemesters.filter((s) => s.archived);

  let html = `
    <div class="mb-8 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Courses</h2>
        <p class="mt-1 text-sm text-muted">Your term, in one place.</p>
      </div>
      <button data-action="new-semester" class="btn btn-primary">+ New semester</button>
    </div>`;

  if (!semesters.length) {
    html += `
      <div class="dashed flex flex-col items-center gap-3 p-12 text-center">
        ${emptyCourseIcon}
        <p class="text-sm text-muted">No semesters yet.</p>
        <button data-action="new-semester" class="btn btn-primary">Create your first semester</button>
      </div>`;
  } else {
    const byId = {};
    semesters.forEach((s) => { byId[s.id] = []; });
    courses.forEach((c) => { (byId[c.semester_id] = byId[c.semester_id] || []).push(c); });
    html += semesters.map((s) => semesterBlock(s, byId[s.id] || [])).join('');
  }

  if (archived.length) html += archivedSection(archived);

  view.innerHTML = html;
}

/* ---------- course detail: materials & PYQ uploads ---------- */

const docIcon =
  '<svg class="h-4 w-4 shrink-0 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z"/>' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M14 3v5h5"/></svg>';

function fmtSize(b) {
  if (b == null) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

function emptyList(msg) {
  return `<p class="px-1 py-2 text-xs text-neutral-400">${msg}</p>`;
}

// Office (docx/pptx/doc/ppt) uploads convert to PDF in the background
// (Feature 3) — status is 'converting' while that's in flight, 'failed' with
// a visible reason if it errors, 'ready'/legacy-null otherwise (no badge).
function materialStatusBadge(m) {
  if (m.status === 'converting') {
    return `<span class="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium" style="background:var(--surface-2);color:var(--text-muted)">
      <span class="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"></span>Converting&hellip;</span>`;
  }
  if (m.status === 'failed') {
    return `<span class="shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium" style="background:var(--danger-c);color:var(--danger)" title="${esc(m.error_message || 'Conversion failed')}">Failed</span>`;
  }
  return '';
}

function materialRow(m) {
  return `
    <div class="group flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        ${docIcon}
        <span class="truncate text-sm">${esc(m.display_name)}</span>
        ${materialStatusBadge(m)}
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="text-xs text-neutral-400">${fmtSize(m.size_bytes)}</span>
        <button data-action="del-material" data-id="${m.id}" title="Remove" aria-label="Remove ${esc(m.display_name)}"
          class="rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100">${trashIcon}</button>
      </div>
    </div>`;
}

function uploadPanel(kind, title, subtitle) {
  return `
    <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 class="font-semibold">${title}</h3>
      <p class="text-xs text-neutral-500">${subtitle}</p>
      <div id="drop-${kind}" tabindex="0" role="button" aria-label="Upload files: drag and drop, or press Enter to browse"
        class="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center transition hover:border-neutral-300">
        <p class="text-sm text-neutral-500">Drop PDFs or images here, or <span class="font-medium text-neutral-700">browse</span></p>
        <p class="mt-1 text-xs text-neutral-400">PDF, PNG, JPG, WEBP, Word, PowerPoint &middot; up to 50 MB</p>
        <input id="input-${kind}" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx" multiple class="hidden" />
      </div>
      <div id="up-status-${kind}" class="mt-3 space-y-1"></div>
      <div id="list-${kind}" class="mt-3 space-y-1"></div>
    </div>`;
}

// Timer polling the materials list every ~2s while any material is still
// 'converting' (office docx/pptx uploads convert in the background) — mirrors
// the canvas view's converting-poll pattern. courseId is threaded through so
// the poll can refresh the right course even if the user is mid-navigation;
// stopped whenever nothing is converting or the course view is left (route()).
let materialsPollTimer = null;
function stopMaterialsPolling() {
  if (materialsPollTimer) { clearTimeout(materialsPollTimer); materialsPollTimer = null; }
}

function fillMaterialLists(materials, courseId) {
  const mats = materials.filter((m) => m.kind === 'material');
  const pyqs = materials.filter((m) => m.kind === 'pyq');
  const lm = document.getElementById('list-material');
  const lp = document.getElementById('list-pyq');
  if (lm) lm.innerHTML = mats.length ? mats.map(materialRow).join('') : emptyList('No study materials yet.');
  if (lp) lp.innerHTML = pyqs.length ? pyqs.map(materialRow).join('') : emptyList('No past questions yet.');

  stopMaterialsPolling();
  const anyConverting = materials.some((m) => m.status === 'converting');
  if (anyConverting && courseId) {
    materialsPollTimer = setTimeout(async () => {
      try { await refreshMaterials(courseId); } catch (_) { /* course likely left — just stop */ }
    }, 2000);
  }
}

async function renderCourse(id) {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  let c, materials;
  try {
    [c, materials] = await Promise.all([api.get(`/courses/${id}`), api.get(`/courses/${id}/materials`)]);
  } catch (e) {
    view.innerHTML = `
      <button data-action="go-courses" class="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; All courses</button>
      <div class="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">Course not found.</div>`;
    return;
  }
  const code = c.code
    ? `<span class="ml-2 rounded-md bg-neutral-100 px-2 py-0.5 text-sm font-medium text-neutral-600 align-middle">${esc(c.code)}</span>`
    : '';
  const desc = c.description
    ? `<p class="mt-2 max-w-2xl text-neutral-600">${esc(c.description)}</p>` : '';
  view.innerHTML = `
    <button data-action="go-courses" class="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; All courses</button>
    <div class="flex items-start justify-between">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">${esc(c.name)}${code}</h2>
        ${desc}
        <p id="course-counts" class="mt-3 text-xs text-neutral-400">${materials.length} materials · ${c.note_count} notes</p>
      </div>
      <button data-action="del-course" data-id="${c.id}" data-name="${esc(c.name)}"
        class="inline-flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600">
        ${trashIcon}<span>Delete</span></button>
    </div>
    <div class="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
      ${uploadPanel('material', 'Study materials', 'Lecture notes, slides, textbooks')}
      ${uploadPanel('pyq', 'Past questions', 'Previous exams &amp; question papers')}
    </div>
    <div id="concepts-section" class="mt-4"></div>
    <div id="exams-section" class="mt-10"></div>
    <div id="course-plan-section" class="mt-10"></div>`;
  fillMaterialLists(materials, id);
  wireUploads(id);
  loadStudyArea(id);
  loadExamsSection(id);
  loadCoursePlan(id);
}

/* ---------- study area: concepts + generated notes ---------- */

const btnPrimary = 'btn btn-primary';
const btnSecondary = 'btn btn-secondary';

let jobPollTimer = null;
function stopJobPolling() {
  if (jobPollTimer) { clearTimeout(jobPollTimer); jobPollTimer = null; }
}

// Course id currently awaiting a job-cancel to take effect (Build 5, Step 4).
// Set by cancelJob, read by progressCard to show a persistent "Cancelling…"
// state instead of a one-shot toast, and cleared by loadStudyArea once that
// course's job reaches a terminal status.
let cancelingCourseId = null;

// Cached catalog of available note-enhancement techniques (rarely changes —
// fetched once and reused across course visits / modal opens).
let noteEnhCatalog = null;
async function loadEnhCatalog() {
  if (!noteEnhCatalog) {
    try { noteEnhCatalog = await api.get('/note-enhancements'); }
    catch (_) { noteEnhCatalog = []; }
  }
  return noteEnhCatalog;
}
function enhLabel(key) {
  const item = (noteEnhCatalog || []).find((e) => e.key === key);
  return item ? item.label : key;
}
function parseEnhancements(raw) {
  // note_enhancements comes back as a JSON string (or null) from GET /courses/{id}
  if (!raw) return [];
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; }
  catch (_) { return []; }
}

function sectionHeader(title, sub, buttonHtml, marginCls = 'mt-10') {
  return `
    <div class="${marginCls} flex items-center justify-between">
      <div><h3 class="text-lg font-semibold">${title}</h3><p class="text-sm text-neutral-500">${sub}</p></div>
      ${buttonHtml}
    </div>`;
}

const dashed = (msg) => `<div class="mt-4 rounded-2xl border border-dashed border-neutral-200 p-8 text-center text-sm text-neutral-400">${msg}</div>`;
const errorBox = (msg) => `<div class="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">${msg}</div>`;

function conceptCard(c, i = 0) {
  // Source line = the file the concept came from + the page/location string.
  // The file name comes from source_file (joined from the material via
  // material_id in list_concepts); the pages come from source_locations.source.
  // Depending on the extraction, the model sometimes ALREADY names the file
  // inside the source string ("lecture.pdf, Pages 8-10") and sometimes gives
  // pages only ("Pages 14-17"). Show the file once: prepend it only when the
  // pages string doesn't already contain it. Result e.g. "lecture.pdf — Pages 8-10".
  let pages = '';
  try { pages = (JSON.parse(c.source_locations || '{}').source) || ''; } catch (_) { /* ignore */ }
  const file = (c.source_file || '').trim();
  const srcLine = (file && pages && pages.toLowerCase().includes(file.toLowerCase()))
    ? esc(pages)
    : [file, pages].filter(Boolean).map(esc).join(' — ');
  // F4: per-concept rename/delete — hidden until hover/keyboard-focus, mirrors
  // courseCard's group-hover/group-focus-within/focus-visible reveal pattern.
  return `
    <div class="card group relative p-4">
      <div class="absolute right-2 top-2 flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100">
        <button data-action="rename-concept" data-id="${c.id}" data-name="${esc(c.name)}" title="Rename concept" aria-label="Rename concept ${esc(c.name)}" class="icon-btn">${renameIcon}</button>
        <button data-action="del-concept" data-id="${c.id}" data-name="${esc(c.name)}" title="Delete concept" aria-label="Delete concept ${esc(c.name)}" class="icon-btn icon-btn-danger">${trashIcon}</button>
      </div>
      <div class="flex items-start gap-2 pr-20">
        <span class="mt-1.5 ${accentDotClsByIndex(i)}"></span>
        <h4 class="min-w-0 font-semibold leading-tight">${esc(c.name)}</h4>
      </div>
      <p class="mt-1 text-sm text-neutral-600">${esc(c.summary || '')}</p>
      ${srcLine ? `<p class="mt-2 text-xs text-neutral-400">${srcLine}</p>` : ''}
    </div>`;
}

function conceptsGrid(concepts) {
  return `<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">${concepts.map((c, i) => conceptCard(c, i)).join('')}</div>`;
}

function progressCard(job, courseId) {
  const pct = job.total ? Math.round((job.progress / job.total) * 100) : null;
  const canceling = String(cancelingCourseId) === String(courseId);
  const message = canceling ? 'Cancelling…' : (job.message || 'Working…');
  const cancelBtn = canceling
    ? `<button data-action="cancel-job" data-id="${courseId}" disabled class="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 disabled:opacity-50">Cancelling…</button>`
    : `<button data-action="cancel-job" data-id="${courseId}" class="shrink-0 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500 hover:border-neutral-300 hover:text-neutral-800">Cancel</button>`;
  return `
    <div class="mt-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm${canceling ? ' opacity-75' : ''}">
      <div class="flex items-center gap-3">
        <span class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"></span>
        <p class="flex-1 text-sm text-neutral-700">${esc(message)}</p>
        ${cancelBtn}
      </div>
      ${pct != null ? `<div class="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100"><div class="h-full bg-neutral-700 transition-all" style="width:${pct}%"></div></div>` : ''}
    </div>`;
}

function noteCard(n, courseId) {
  if (n.status === 'compiled') {
    const thumb = n.has_thumb
      ? `<img src="/api/notes/${n.id}/thumb" alt="" loading="lazy" class="h-44 w-full border-b border-neutral-100 object-cover object-top">`
      : `<div class="flex h-44 items-center justify-center border-b border-neutral-100 bg-neutral-50 text-xs text-neutral-300">PDF</div>`;
    const quizChip = n.concept_id != null
      ? `<button data-action="start-quiz-stop" data-concept-id="${n.concept_id}" title="Start quiz"
          class="absolute right-2 top-2 z-10 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow transition hover:bg-white hover:text-ink">Quiz</button>`
      : '';
    const doneBadge = n.done
      ? `<span title="Done" class="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-[11px] font-semibold text-white shadow">&#10003; Done</span>`
      : '';
    const toggleBtn = n.concept_id != null ? doneToggleBtn(n.concept_id, n.done, 'badge') : '';
    const statusLine = n.done
      ? `<p class="mt-0.5 text-xs font-medium text-emerald-600">Done &#10003;</p>`
      : `<p class="mt-0.5 text-xs text-emerald-600">Ready</p>`;
    // A plain div (not a nested <button>) — a <button> inside a <button> is
    // invalid HTML and gets hoisted out of the DOM by the parser, breaking
    // the click target. The delegated handler works the same via closest().
    return `
      <div data-action="open-note" data-note-id="${n.id}" data-course-id="${courseId}" data-concept-id="${n.concept_id != null ? n.concept_id : ''}" data-title="${esc(n.title)}"
        class="card card-interactive group relative overflow-hidden text-left">
        ${doneBadge}
        ${quizChip}
        ${thumb}
        <div class="flex items-center justify-between gap-2 p-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">${esc(n.title)}</p>
            ${statusLine}
          </div>
          ${toggleBtn}
        </div>
      </div>`;
  }
  if (n.status === 'failed') {
    // A div (not a <button>) so it can hold two independent actions: the card
    // body opens the error/LaTeX modal, while the Retry button below stops
    // propagation so clicking it doesn't also open that modal.
    return `
      <div data-action="note-error" data-note-id="${n.id}" data-title="${esc(n.title)}"
        class="card-interactive cursor-pointer overflow-hidden rounded-xl border border-red-200 bg-red-50 text-left transition hover:bg-red-100">
        <div class="flex h-44 items-center justify-center text-xs text-red-300">compile failed</div>
        <div class="flex items-center justify-between gap-2 p-3">
          <div class="min-w-0">
            <p class="truncate text-sm font-medium">${esc(n.title)}</p>
            <p class="mt-0.5 text-xs text-red-600">Failed — tap for details</p>
          </div>
          <button data-action="retry-note" data-note-id="${n.id}"
            class="shrink-0 rounded-md border border-red-200 bg-white px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-50">Retry</button>
        </div>
      </div>`;
  }
  return `
    <div class="overflow-hidden rounded-xl border border-neutral-200 bg-white">
      <div class="flex h-44 items-center justify-center"><span class="h-5 w-5 animate-spin rounded-full border-2 border-neutral-200 border-t-neutral-500"></span></div>
      <div class="p-3"><p class="truncate text-sm font-medium">${esc(n.title)}</p><p class="mt-0.5 text-xs text-neutral-400">Generating…</p></div>
    </div>`;
}

function notesGrid(notes, courseId) {
  return `<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">${notes.map((n) => noteCard(n, courseId)).join('')}</div>`;
}

async function loadStudyArea(courseId) {
  stopJobPolling();
  const host = document.getElementById('concepts-section');
  if (!host) return;
  let job = null, concepts = [], notes = [], materials = [], course = null, sp = { prompts: [], active_prompt_id: null };
  try {
    [job, concepts, notes, materials] = await Promise.all([
      api.get(`/courses/${courseId}/job`),
      api.get(`/courses/${courseId}/concepts`),
      api.get(`/courses/${courseId}/notes`),
      api.get(`/courses/${courseId}/materials`),
    ]);
  } catch (_) { /* render what we have */ }
  try {
    [course, , sp] = await Promise.all([
      api.get(`/courses/${courseId}`),
      loadEnhCatalog(),
      api.get('/saved-prompts').catch(() => ({ prompts: [], active_prompt_id: null })),
    ]);
  } catch (_) { /* customization header just won't show prefs */ }
  const activePromptName = (() => {
    const p = (sp.prompts || []).find((x) => x.id === sp.active_prompt_id);
    return p ? p.name : null;
  })();

  const running = job && (job.status === 'running' || job.status === 'queued');
  const failed = job && job.status === 'failed';
  // The job for this course has reached a terminal status (done/failed/gone)
  // — if we were waiting on a cancel here, it has now taken effect.
  if (!running && String(cancelingCourseId) === String(courseId)) cancelingCourseId = null;
  const canceling = String(cancelingCourseId) === String(courseId);

  // Concepts
  // F6: with zero study materials uploaded (PYQs don't count — they never
  // feed extraction), "Analyze materials" would just 400 from the backend
  // ("Upload materials first") — disable it up front with a clear tooltip
  // instead of letting the user hit that error. Only gates the EMPTY-state
  // button; "Analyze new materials" (concepts already exist) is untouched.
  const noStudyMaterials = materials.filter((m) => m.kind === 'material').length === 0;
  const conceptsHeaderAction = concepts.length
    ? `<div class="flex items-center gap-2">
        <button data-action="reanalyze-all" data-id="${courseId}" ${running ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Re-analyze all</button>
        <button data-action="generate" data-id="${courseId}" ${running ? 'disabled' : ''} class="${btnSecondary}">Analyze new materials</button>
      </div>`
    : `<button data-action="generate" data-id="${courseId}" ${running || noStudyMaterials ? 'disabled' : ''} class="${btnSecondary}"${noStudyMaterials ? ' title="Upload study materials first"' : ''}>Analyze materials</button>`;
  let html = sectionHeader('Concepts', 'What Axiom will turn into notes.', conceptsHeaderAction);
  if (running && job.type === 'extract') html += progressCard(job, courseId);
  else if (failed && job.type === 'extract') html += errorBox(`Analysis failed: ${esc(job.message || 'unknown error')}`) + (concepts.length ? conceptsGrid(concepts) : '');
  else if (concepts.length) html += conceptsGrid(concepts);
  else html += dashed('No concepts yet. Upload materials, then click Analyze.');

  // Notes (only once concepts exist)
  if (concepts.length) {
    const hasCompiled = notes.some((n) => n.status === 'compiled');
    const studyBtn = hasCompiled
      ? `<button data-action="open-study" data-id="${courseId}" class="${btnSecondary}">Study</button>`
      : '';
    const downloadAllBtn = hasCompiled
      ? `<a href="/api/courses/${courseId}/notes.zip" class="${btnSecondary}">Download all</a>`
      : '';
    const enhKeys = parseEnhancements(course && course.note_enhancements);
    const hasInstr = !!(course && (course.note_instructions || '').trim());
    const customized = hasInstr || enhKeys.length > 0;
    const chooseBtn = `<button data-action="choose-notes" data-id="${courseId}" ${running ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Select concepts…</button>`;
    // B5: "Regenerate all" was fully wired (confirmRegenAll + the regen-all
    // dispatcher branch) but no button ever rendered it — mirrors how the
    // Concepts header pairs its muted "Re-analyze all" next to the primary
    // action, so the reset-and-rebuild path is reachable without deleting the
    // course.
    const regenAllBtn = notes.length
      ? `<button data-action="regen-all" data-id="${courseId}" ${running ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Regenerate all</button>`
      : '';
    const genNotesBtn = `<button data-action="gen-notes" data-id="${courseId}" ${running ? 'disabled' : ''} class="${btnPrimary}">${notes.length ? 'Generate new notes' : 'Generate notes'}</button>`;
    html += sectionHeader('Notes', 'One compiled PDF per concept.',
      `<div class="flex items-center gap-2">${studyBtn}${downloadAllBtn}<button data-action="note-customize" data-id="${courseId}" class="${btnSecondary}">Customize${customized ? ' ✓' : ''}</button>${regenAllBtn}${chooseBtn}${genNotesBtn}</div>`, 'mt-12');
    if (customized) {
      const parts = enhKeys.map(enhLabel).map(esc);
      if (hasInstr) parts.push('custom instruction');
      html += `<p class="mt-1 text-xs text-neutral-400">Customized: ${parts.join(', ')}</p>`;
    }
    if (activePromptName) {
      html += `<p class="mt-1 text-xs text-neutral-500">Instruction applied to all notes: <span class="font-medium">${esc(activePromptName)}</span></p>`;
    }
    if (running && job.type === 'generate') {
      const notesHtml = notes.length ? notesGrid(notes, courseId) : '';
      html += progressCard(job, courseId) + (canceling && notesHtml ? `<div class="opacity-60 transition-opacity">${notesHtml}</div>` : notesHtml);
    }
    else if (failed && job.type === 'generate') html += errorBox(`Note generation failed: ${esc(job.message || 'unknown error')}`) + (notes.length ? notesGrid(notes, courseId) : '');
    else if (notes.length) html += notesGrid(notes, courseId);
    else html += dashed('No notes yet. Click "Generate notes" to build a PDF for each concept.');
  }

  host.innerHTML = html;
  // Keep polling while a batch job is active OR any individual note is mid-
  // generation (e.g. a single note retried via retryNote below) — otherwise a
  // retried note's spinner would never flip to compiled/failed on its own.
  const anyNoteGenerating = notes.some((n) => n.status === 'generating');
  if (running || anyNoteGenerating) jobPollTimer = setTimeout(() => loadStudyArea(courseId), 2000);
}

// F4: per-concept rename — same endpoint/field the canvas's lesson-rename
// pencil already uses (PATCH /concepts/:id, {display_name}), which also
// updates the note's title server-side. Refreshes the concepts/notes area in
// place; the course id comes from the hash since conceptCard only ever
// renders on the course page.
function renameConcept(id, name) {
  ui.formModal({
    title: 'Rename concept',
    submitLabel: 'Save',
    bodyHtml: field('Name', `<input id="f-concept-rename" class="${inputCls}" value="${esc(name || '')}" />`),
    onSubmit: async (root) => {
      const newName = root.querySelector('#f-concept-rename').value.trim();
      if (!newName) throw new Error('Please enter a name.');
      await api.patch(`/concepts/${id}`, { display_name: newName });
      ui.toast('Renamed');
      const courseId = currentCourseIdFromHash();
      if (courseId) await loadStudyArea(courseId);
    },
  });
}

// F4: per-concept delete — DANGER-toned confirm (deletes only this concept's
// own note/quiz/progress/links/canvas rows server-side; siblings untouched).
function delConcept(id, name) {
  ui.confirmModal({
    title: 'Delete concept?',
    message: `"${name}" and its note, quiz, and progress will be permanently removed. Other concepts in this course are not affected.`,
    onConfirm: async () => {
      await api.del(`/concepts/${id}`);
      ui.toast('Concept deleted');
      const courseId = currentCourseIdFromHash();
      if (courseId) await loadStudyArea(courseId);
    },
  });
}

async function retryNote(noteId) {
  try {
    await api.post(`/notes/${noteId}/retry`, {});
    ui.toast('Retrying…');
    const courseId = currentCourseIdFromHash();
    if (courseId) await loadStudyArea(courseId);
  } catch (e) { ui.toast(e.message, 'error'); }
}

async function noteCustomizeModal(courseId) {
  let catalog = [], course = null, sp = { prompts: [], active_prompt_id: null };
  try {
    [catalog, course, sp] = await Promise.all([
      loadEnhCatalog(),
      api.get(`/courses/${courseId}`),
      api.get('/saved-prompts').catch(() => ({ prompts: [], active_prompt_id: null })),
    ]);
  }
  catch (e) { ui.toast(e.message, 'error'); return; }
  const currentKeys = new Set(parseEnhancements(course && course.note_enhancements));
  const currentInstr = (course && course.note_instructions) || '';
  const checks = catalog.map((e) => `
    <label class="flex items-start gap-2 rounded-lg border border-neutral-200 p-2 text-sm hover:bg-neutral-50 cursor-pointer">
      <input type="checkbox" data-enh="${esc(e.key)}" ${currentKeys.has(e.key) ? 'checked' : ''} class="mt-0.5">
      <span>${esc(e.label)}</span>
    </label>`).join('');

  // Global saved-prompt banner + picker (Build 6, Step 6 frontend). The
  // banner only informs — it doesn't change anything here. The picker just
  // fills #f-instr with a saved instruction's text; saving still PUTs only
  // this course's per-course instruction/enhancements, unchanged.
  const activePrompt = (sp.prompts || []).find((p) => p.id === sp.active_prompt_id);
  const banner = activePrompt
    ? `<div class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">A saved instruction "${esc(activePrompt.name)}" is applied to all notes (Settings &rarr; Saved Prompts). It's combined with anything you add here.</div>`
    : '';
  const picker = (sp.prompts || []).length
    ? field('Insert a saved prompt', `<select id="sp-pick" class="${inputCls}">
        <option value="">&mdash; Insert a saved prompt &mdash;</option>
        ${sp.prompts.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
      </select>`)
    : '';

  ui.formModal({
    title: 'Customize note generation',
    submitLabel: 'Save',
    bodyHtml: [
      banner,
      picker,
      field('Extra instruction (optional)', `<textarea id="f-instr" rows="4" class="${inputCls}" placeholder="e.g. Keep it concise and use a friendly tone.">${esc(currentInstr)}</textarea>`, 'Applies to every note generated for this course (and to single-note retries). Style/format/memory-technique guidance only — it will not invent facts beyond your study materials.'),
      field('Memory & engagement techniques', `<div class="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2">${checks}</div>`, 'Applied only to genuinely memorizable parts of each note.'),
    ].join(''),
    onSubmit: async (root) => {
      const instructions = root.querySelector('#f-instr').value.trim();
      const enhancements = Array.from(root.querySelectorAll('input[data-enh]:checked')).map((el) => el.dataset.enh);
      await api.put(`/courses/${courseId}/note-prefs`, { instructions, enhancements });
      ui.toast('Customization saved');
      await loadStudyArea(courseId); // refresh header indicator
    },
  });

  if (sp.prompts && sp.prompts.length) {
    // ui.formModal gives no post-mount hook — the overlay is appended to
    // document.body synchronously inside the call above, so a 0ms defer is
    // enough to safely grab the picker + textarea and wire the fill-in.
    setTimeout(() => {
      const sel = document.getElementById('sp-pick');
      const instr = document.getElementById('f-instr');
      if (!sel || !instr) return;
      sel.addEventListener('change', () => {
        const id = Number(sel.value);
        const picked = sp.prompts.find((x) => x.id === id);
        if (picked) instr.value = picked.instruction;
      });
    }, 0);
  }
}

// Create/edit modal for one Saved Prompt (Build 6, Step 6 frontend). Reused
// by the Settings "Saved Prompts" section's Add/Edit buttons.
function savedPromptModal(existing) {
  ui.formModal({
    title: existing ? 'Edit saved prompt' : 'New saved prompt',
    submitLabel: 'Save',
    bodyHtml: [
      field('Name', `<input id="sp-name" class="${inputCls}" value="${esc(existing?.name || '')}" placeholder="e.g. Concise + exam-focused">`),
      field('Instruction', `<textarea id="sp-instr" rows="5" class="${inputCls}" placeholder="Style/technique guidance applied to note generation.">${esc(existing?.instruction || '')}</textarea>`, 'Reusable custom instruction. Style/format/technique only — it will not invent facts beyond the study materials.'),
    ].join(''),
    onSubmit: async (root) => {
      const name = root.querySelector('#sp-name').value.trim();
      const instruction = root.querySelector('#sp-instr').value.trim();
      if (!name) throw new Error('Name is required.');
      if (!instruction) throw new Error('Instruction is required.');
      if (existing) await api.put('/saved-prompts/' + existing.id, { name, instruction });
      else await api.post('/saved-prompts', { name, instruction });
      ui.toast('Saved');
      await renderSavedPromptsSection();
    },
  });
}

async function startGeneration(courseId, mode = 'new') {
  cancelingCourseId = null; // a fresh generation is not a cancel-in-progress
  try {
    await api.post(`/courses/${courseId}/generate?mode=${mode}`, {});
    ui.toast(mode === 'all' ? 'Re-analyzing all materials…' : 'Analyzing new materials…');
    await loadStudyArea(courseId);
  } catch (e) { ui.toast(e.message, 'error'); }
}

async function startNoteGeneration(courseId, mode = 'new', conceptIds = null) {
  cancelingCourseId = null; // a fresh generation is not a cancel-in-progress
  try {
    await api.post(`/courses/${courseId}/notes/generate?mode=${mode}`, conceptIds ? { concept_ids: conceptIds } : {});
    ui.toast(mode === 'all' ? 'Regenerating all notes…' : mode === 'selected' ? 'Generating selected notes…' : 'Generating new notes…');
    await loadStudyArea(courseId);
  } catch (e) { ui.toast(e.message, 'error'); }
}

// Pick exactly which concepts to (re)generate notes for. Concepts that already
// have a note show a "note" tag; missing ones are pre-ticked so the common case
// (fill in the gaps) is one click, while any can be ticked to regenerate.
async function noteConceptPicker(courseId) {
  let concepts = [], notes = [];
  try { [concepts, notes] = await Promise.all([api.get(`/courses/${courseId}/concepts`), api.get(`/courses/${courseId}/notes`)]); }
  catch (e) { ui.toast(e.message, 'error'); return; }
  if (!concepts.length) { ui.toast('Analyze the materials first.', 'error'); return; }
  const noteByConcept = new Set(notes.filter((n) => n.concept_id != null).map((n) => n.concept_id));
  const rows = concepts.map((c) => `
    <label class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-100">
      <input type="checkbox" data-cid="${c.id}" ${noteByConcept.has(c.id) ? '' : 'checked'}>
      <span class="min-w-0 flex-1 truncate text-sm">${esc(c.name)}</span>
      ${noteByConcept.has(c.id) ? '<span class="chip chip-mint shrink-0 text-[11px]">note</span>' : '<span class="shrink-0 text-[11px] text-muted">no note</span>'}
    </label>`).join('');
  const { card, close } = ui.mountOverlay(`
    <div class="p-5">
      <h3 class="text-lg font-semibold text-ink">Generate notes</h3>
      <p class="mt-1 text-sm text-muted">Tick the concepts to generate (or regenerate) notes for.</p>
      <div class="mt-3 flex gap-3 text-xs">
        <button data-sel="all" class="link">Select all</button>
        <button data-sel="missing" class="link">Only missing</button>
        <button data-sel="none" class="link">Clear</button>
      </div>
      <div class="mt-3 max-h-72 space-y-0.5 overflow-y-auto">${rows}</div>
      <p id="np-warn" class="mt-2 hidden text-xs font-medium" style="color:var(--warning, #b45309)"></p>
      <div class="mt-4 flex justify-end gap-2">
        <button data-cancel class="btn btn-ghost">Cancel</button>
        <button data-gen class="btn btn-primary">Generate selected</button>
      </div>
    </div>`);
  const boxes = () => Array.from(card.querySelectorAll('input[data-cid]'));
  // B10: warn (inline, live) when the current selection would REGENERATE
  // concepts that already have a compiled note — "Select all" is easy to hit
  // expecting it only fills gaps.
  const warnEl = card.querySelector('#np-warn');
  const updateWarn = () => {
    const replacing = boxes().filter((x) => x.checked && noteByConcept.has(Number(x.dataset.cid))).length;
    if (replacing > 0) {
      warnEl.textContent = `${replacing} existing note${replacing === 1 ? '' : 's'} will be regenerated (replaced).`;
      warnEl.classList.remove('hidden');
    } else {
      warnEl.classList.add('hidden');
    }
  };
  card.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => {
    const mode = b.dataset.sel;
    boxes().forEach((x) => { x.checked = mode === 'all' ? true : mode === 'none' ? false : !noteByConcept.has(Number(x.dataset.cid)); });
    updateWarn();
  }));
  boxes().forEach((x) => x.addEventListener('change', updateWarn));
  updateWarn();
  card.querySelector('[data-cancel]').addEventListener('click', close);
  card.querySelector('[data-gen]').addEventListener('click', () => {
    const ids = boxes().filter((x) => x.checked).map((x) => Number(x.dataset.cid));
    if (!ids.length) { ui.toast('Select at least one concept.', 'error'); return; }
    close();
    startNoteGeneration(courseId, 'selected', ids);
  });
}

function confirmReanalyzeAll(courseId) {
  ui.confirmModal({
    title: 'Re-analyze all materials?',
    message: 'This rebuilds the concept list from scratch and removes the existing notes, quizzes, and progress for this course. Use "Analyze new materials" to keep them and only add concepts for newly-uploaded files.',
    confirmLabel: 'Re-analyze all',
    onConfirm: () => startGeneration(courseId, 'all'),
  });
}
function confirmRegenAll(courseId) {
  ui.confirmModal({
    title: 'Regenerate all notes?',
    message: 'This deletes every existing note for this course and regenerates all of them. Use "Generate new notes" to keep existing notes and only create notes for new concepts.',
    confirmLabel: 'Regenerate all',
    onConfirm: () => startNoteGeneration(courseId, 'all'),
  });
}

async function cancelJob(courseId) {
  try {
    await api.post(`/courses/${courseId}/job/cancel`, {});
    cancelingCourseId = courseId;
    ui.toast('Cancelling…');
    // Reflect the "cancelling" state immediately instead of waiting for the
    // next 2s poll tick — progressCard reads cancelingCourseId to show a
    // persistent state (message + disabled button) until the job resolves.
    await loadStudyArea(courseId);
  } catch (e) { ui.toast(e.message, 'error'); }
}

// Manual "lesson done" toggle (Build 3, Step 4). `wasDone` is the state
// *before* this click — we flip to the opposite backend endpoint, then
// re-run the current route so every done indicator on screen (note cards,
// study views, schedule rows, calendar chips) picks up the fresh value.
// A done/not-done toggle button, regenerable so toggleDone() can swap it in
// place (no full-view re-render). Variants match the three places it appears:
// 'badge' (study-view note list), 'card' (note grid), 'row' (schedule reader).
function doneToggleBtn(conceptId, done, variant) {
  done = !!done;
  if (variant === 'badge') {
    const cls = done ? 'text-emerald-600 hover:bg-emerald-50' : 'text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700';
    return `<button data-action="toggle-done-stop" data-concept-id="${conceptId}" data-done="${done ? 1 : 0}" data-done-variant="badge"
        class="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition ${cls}">${done ? 'Done ✓' : 'Mark done'}</button>`;
  }
  const doneCls = 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100';
  if (variant === 'card') {
    const cls = done ? doneCls : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50';
    return `<button data-action="toggle-done" data-concept-id="${conceptId}" data-done="${done ? 1 : 0}" data-done-variant="card"
        class="mt-2 w-full rounded-lg border px-3 py-1.5 text-sm font-medium transition ${cls}">${done ? 'Mark not done' : 'Mark done'}</button>`;
  }
  const cls = done ? doneCls : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50';
  return `<button data-action="toggle-done" data-concept-id="${conceptId}" data-done="${done ? 1 : 0}" data-done-variant="row"
        class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${cls}">${done ? 'Mark not done' : 'Mark done'}</button>`;
}

async function toggleDone(conceptId, wasDone) {
  try {
    await api.post(`/concepts/${conceptId}/${wasDone ? 'undone' : 'done'}`, {});
    const nowDone = !wasDone;
    ui.toast(nowDone ? 'Marked done' : 'Marked not done');
    // Flip every done-toggle for this concept in place — no full-window re-render.
    document.querySelectorAll(`[data-done-variant][data-concept-id="${conceptId}"]`).forEach((btn) => {
      btn.outerHTML = doneToggleBtn(conceptId, nowDone, btn.dataset.doneVariant);
    });
    // B1: also patch the in-memory caches these three views read from, so
    // switching lessons/notes and back can't show a reverted `done` — before
    // this fix only the DOM was patched, and every view rebuilds its markup
    // from these cached objects on the next render (e.g. canvasSwitchLesson /
    // studySelectNote / schedSelect), which would silently undo the toggle.
    // `conceptId` arrives as a string (data-concept-id) — compare numerically.
    const cid = Number(conceptId);
    if (canvasState && canvasState.notesByConceptId) {
      const n = canvasState.notesByConceptId.get(cid);
      if (n) n.done = nowDone;
      if (canvasState.concept && Number(canvasState.concept.id) === cid && canvasState.note) {
        canvasState.note.done = nowDone;
      }
    }
    if (studyState && Array.isArray(studyState.notes)) {
      const n = studyState.notes.find((x) => x.concept_id === cid);
      if (n) n.done = nowDone;
    }
    if (schedStudy && Array.isArray(schedStudy.items)) {
      schedStudy.items.forEach((it) => { if (it.concept_id === cid) it.done = nowDone; });
    }
  } catch (e) { ui.toast(e.message, 'error'); }
}

/* ---------- exams (Build 2, Step 1): CRUD + concept ticking ---------- */

function currentCourseIdFromHash() {
  const m = (location.hash || '').match(/^#\/course\/(\d+)/);
  return m ? m[1] : null;
}

function examDaysBadge(examDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(`${examDate}T00:00:00`);
  const diffDays = Math.round((d - today) / 86400000);
  let text, cls;
  if (diffDays < 0) { text = 'Past'; cls = 'bg-neutral-100 text-neutral-500'; }
  else if (diffDays === 0) { text = 'Today'; cls = 'bg-red-100 text-red-700'; }
  else {
    text = `${diffDays} day${diffDays === 1 ? '' : 's'} left`;
    cls = diffDays <= 7 ? 'bg-red-100 text-red-700' : diffDays <= 21 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700';
  }
  return `<span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${cls}">${text}</span>`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function examCard(e, i = 0) {
  return `
    <div class="card card-interactive rise-in p-4" style="${riseDelayStyle(i)}">
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-center gap-2">
          <span class="${accentDotClsByIndex(i)}"></span>
          <h4 class="min-w-0 truncate font-semibold leading-tight">${esc(e.name)}</h4>
        </div>
        ${examDaysBadge(e.exam_date)}
      </div>
      <p class="mt-1 text-sm text-neutral-500">${esc(fmtDate(e.study_start_date))} &rarr; ${esc(fmtDate(e.exam_date))}</p>
      <p class="mt-2 text-xs text-neutral-400">${e.concept_count} concept${e.concept_count === 1 ? '' : 's'} covered</p>
      <div class="mt-3 flex items-center gap-2">
        <button data-action="exam-concepts" data-exam-id="${e.id}" data-name="${esc(e.name)}"
          class="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Edit concepts</button>
        <button data-action="edit-exam" data-exam-id="${e.id}"
          class="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50">Edit</button>
        <button data-action="del-exam" data-exam-id="${e.id}" data-name="${esc(e.name)}" title="Delete exam"
          class="ml-auto rounded-md p-1 text-neutral-300 hover:bg-red-50 hover:text-red-600">${trashIcon}</button>
      </div>
    </div>`;
}

function examsSectionHtml(courseId, exams) {
  const body = exams.length
    ? `<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${exams.map((e, i) => examCard(e, i)).join('')}</div>`
    : dashed('No exams yet.');
  return sectionHeader('Exams', 'Tell Axiom when your exams are and which concepts they cover.',
    `<button data-action="new-exam" data-id="${courseId}" class="${btnPrimary}">+ New exam</button>`) + body;
}

async function loadExamsSection(courseId) {
  const host = document.getElementById('exams-section');
  if (!host) return;
  let exams = [];
  try {
    exams = await api.get(`/courses/${courseId}/exams`);
  } catch (e) {
    host.innerHTML = errorBox(`Could not load exams: ${esc(e.message)}`);
    return;
  }
  host.innerHTML = examsSectionHtml(courseId, exams);
}

// Regenerate the deterministic schedule after any exam mutation so the
// dashboard + course study plan reflect it immediately, without the user
// having to visit the dashboard and click "Regenerate schedule" by hand.
// Best-effort: a failure here shouldn't undo the exam mutation feedback.
async function regenScheduleQuiet() {
  try { await api.post('/schedule/generate-all', {}); } catch (_) { /* ignore */ }
}

function newExam(courseId) {
  ui.formModal({
    title: 'New exam',
    bodyHtml: [
      field('Name', `<input id="f-name" class="${inputCls}" placeholder="e.g. Midterm 1" />`),
      field('Study start date', `<input id="f-start" type="date" class="${inputCls}" />`),
      field('Exam date', `<input id="f-exam" type="date" class="${inputCls}" />`),
    ].join(''),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-name').value.trim();
      const study_start_date = root.querySelector('#f-start').value;
      const exam_date = root.querySelector('#f-exam').value;
      if (!name) throw new Error('Please enter a name.');
      if (!study_start_date || !exam_date) throw new Error('Please pick both dates.');
      if (exam_date < study_start_date) throw new Error('Exam date must be on or after the study start date.');
      const created = await api.post(`/courses/${courseId}/exams`, { name, study_start_date, exam_date });
      ui.toast('Exam created');
      await regenScheduleQuiet();
      await loadExamsSection(courseId);
      await loadCoursePlan(courseId);
      // Immediately prompt the student to tick which concepts this exam covers.
      examConceptsModal(created.id, created.name);
    },
  });
}

async function editExam(examId) {
  const courseId = currentCourseIdFromHash();
  if (!courseId) return;
  let exam;
  try {
    exam = await api.get(`/exams/${examId}`);
  } catch (e) {
    ui.toast(e.message, 'error');
    return;
  }
  ui.formModal({
    title: 'Edit exam',
    submitLabel: 'Save',
    bodyHtml: [
      field('Name', `<input id="f-name" class="${inputCls}" value="${esc(exam.name)}" />`),
      field('Study start date', `<input id="f-start" type="date" class="${inputCls}" value="${esc(exam.study_start_date)}" />`),
      field('Exam date', `<input id="f-exam" type="date" class="${inputCls}" value="${esc(exam.exam_date)}" />`),
    ].join(''),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-name').value.trim();
      const study_start_date = root.querySelector('#f-start').value;
      const exam_date = root.querySelector('#f-exam').value;
      if (!name) throw new Error('Please enter a name.');
      if (!study_start_date || !exam_date) throw new Error('Please pick both dates.');
      if (exam_date < study_start_date) throw new Error('Exam date must be on or after the study start date.');
      await api.patch(`/exams/${examId}`, { name, study_start_date, exam_date });
      ui.toast('Exam updated');
      await regenScheduleQuiet();
      await loadExamsSection(courseId);
      await loadCoursePlan(courseId);
    },
  });
}

function delExam(examId, name) {
  ui.confirmModal({
    title: 'Delete exam?',
    message: `"${name}" will be permanently removed.`,
    onConfirm: async () => {
      await api.del(`/exams/${examId}`);
      ui.toast('Exam deleted');
      const courseId = currentCourseIdFromHash();
      await regenScheduleQuiet();
      if (courseId) {
        await loadExamsSection(courseId);
        await loadCoursePlan(courseId);
      }
    },
  });
}

// Concept-list tab content: a checklist bound to the shared `ticked` Set.
function examConceptsTabHtml(concepts, ticked) {
  return `<div class="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-100 p-2">
      ${concepts.map((c) => `
        <label class="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-neutral-50">
          <input type="checkbox" data-concept-id="${c.id}" ${ticked.has(c.id) ? 'checked' : ''} class="mt-1 shrink-0" />
          <span class="min-w-0">
            <span class="block text-sm font-medium">${esc(c.name)}</span>
            <span class="block text-xs text-neutral-500">${esc(c.summary || '')}</span>
          </span>
        </label>`).join('')}
    </div>`;
}

// Materials tab content: one row per STUDY MATERIAL (never PYQs — PYQs only
// shape practice-problem style/difficulty and are never a source of concepts,
// so they must not appear here or contribute to the bulk-tick mapping).
// Checkbox bulk-ticks/-unticks every concept id mapped to it (materialMap). A
// material with no mapped concepts is shown disabled with a hint to re-analyze.
function examMaterialsTabHtml(materials, materialMap, ticked) {
  if (!materials.length) {
    return `<p class="text-sm text-neutral-500">No study materials uploaded yet.</p>`;
  }
  return `<div class="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-100 p-2">
      ${materials.map((m) => {
        const ids = materialMap.get(m.id) || [];
        const allTicked = ids.length > 0 && ids.every((id) => ticked.has(id));
        const countText = ids.length
          ? `covers ${ids.length} concept${ids.length === 1 ? '' : 's'}`
          : `<span class="italic">Re-analyze to link</span>`;
        return `
          <label class="flex items-start gap-2 rounded-lg px-2 py-1.5 ${ids.length ? 'hover:bg-neutral-50' : 'opacity-60'}">
            <input type="checkbox" data-material-id="${m.id}" ${allTicked ? 'checked' : ''} ${ids.length ? '' : 'disabled'}
              class="mt-1 shrink-0" />
            <span class="min-w-0">
              <span class="block text-sm font-medium">${esc(m.display_name)}</span>
              <span class="block text-xs text-neutral-500">${countText}</span>
            </span>
          </label>`;
      }).join('')}
    </div>`;
}

function examConceptsTabsHtml(active) {
  const tabCls = (tab) => tab === active
    ? 'rounded-md bg-white px-3 py-1 text-sm font-medium text-ink shadow-sm'
    : 'rounded-md px-3 py-1 text-sm font-medium text-neutral-500 hover:text-neutral-700';
  return `
    <div data-tabs class="inline-flex rounded-lg bg-neutral-100 p-0.5">
      <button type="button" data-tab="concepts" class="${tabCls('concepts')}">Concepts</button>
      <button type="button" data-tab="materials" class="${tabCls('materials')}">Materials</button>
    </div>
    <div data-tab-content class="mt-2"></div>`;
}

async function examConceptsModal(examId, name) {
  const courseId = currentCourseIdFromHash();
  if (!courseId) return;
  let exam, concepts, materials;
  try {
    [exam, concepts, materials] = await Promise.all([
      api.get(`/exams/${examId}`),
      api.get(`/courses/${courseId}/concepts`),
      api.get(`/courses/${courseId}/materials`),
    ]);
  } catch (e) {
    ui.toast(e.message, 'error');
    return;
  }
  const ticked = new Set(exam.concept_ids || []);

  // Materials tab = study materials ONLY. PYQs are never a source of concepts
  // (they only shape practice-problem style/difficulty per CLAUDE.md), so they
  // must not appear in this tab or contribute to the bulk-tick mapping below.
  const studyMaterials = materials.filter((m) => m.kind === 'material');

  // material_id -> [concept_id, ...]. Prefer the structured link; fall back to
  // a substring match of the material's display name inside the concept's
  // parsed source_locations.source text when material_id wasn't resolved.
  const materialMap = new Map();
  for (const m of studyMaterials) materialMap.set(m.id, []);
  for (const c of concepts) {
    if (c.material_id != null && materialMap.has(c.material_id)) {
      materialMap.get(c.material_id).push(c.id);
      continue;
    }
    let src = '';
    try {
      const parsed = JSON.parse(c.source_locations || '');
      src = (parsed && parsed.source) || '';
    } catch (_) { /* not parseable JSON — skip fuzzy match */ }
    if (!src) continue;
    const srcLower = src.toLowerCase();
    for (const m of studyMaterials) {
      if (m.display_name && srcLower.includes(m.display_name.toLowerCase())) {
        materialMap.get(m.id).push(c.id);
        break;
      }
    }
  }

  if (!concepts.length) {
    ui.formModal({
      title: `Concepts for "${name}"`,
      submitLabel: 'Save',
      bodyHtml: `<p class="text-sm text-neutral-500">No concepts yet. Generate notes / analyze materials first to get concepts.</p>`,
      onSubmit: async () => {
        await api.put(`/exams/${examId}/concepts`, { concept_ids: [] });
        ui.toast('Concepts updated');
        await regenScheduleQuiet();
        await loadExamsSection(courseId);
        await loadCoursePlan(courseId);
      },
    });
    return;
  }

  let activeTab = 'concepts';

  ui.formModal({
    title: `Concepts for "${name}"`,
    submitLabel: 'Save',
    bodyHtml: examConceptsTabsHtml(activeTab),
    onSubmit: async (root) => {
      const concept_ids = Array.from(ticked);
      await api.put(`/exams/${examId}/concepts`, { concept_ids });
      ui.toast('Concepts updated');
      await regenScheduleQuiet();
      await loadExamsSection(courseId);
      await loadCoursePlan(courseId);
    },
  });

  // ui.formModal mounts its dialog into document.body synchronously before
  // returning, and this app never nests modals — so the just-mounted card is
  // reliably the only [role="dialog"] element at this point. This lets us
  // attach tab-switch / bulk-toggle listeners without changing ui.js.
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return; // defensive: should not happen, but never throw here

  function renderActiveTab() {
    const host = dialog.querySelector('[data-tab-content]');
    if (!host) return;
    host.innerHTML = activeTab === 'concepts'
      ? examConceptsTabHtml(concepts, ticked)
      : examMaterialsTabHtml(studyMaterials, materialMap, ticked);
  }

  dialog.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      dialog.querySelectorAll('[data-tab]').forEach((b) => {
        b.className = b.dataset.tab === activeTab
          ? 'rounded-md bg-white px-3 py-1 text-sm font-medium text-ink shadow-sm'
          : 'rounded-md px-3 py-1 text-sm font-medium text-neutral-500 hover:text-neutral-700';
      });
      renderActiveTab();
    });
  });

  dialog.querySelector('[data-tab-content]').addEventListener('change', (e) => {
    const conceptBox = e.target.closest('[data-concept-id]');
    if (conceptBox) {
      const id = Number(conceptBox.dataset.conceptId);
      if (conceptBox.checked) ticked.add(id); else ticked.delete(id);
      return;
    }
    const materialBox = e.target.closest('[data-material-id]');
    if (materialBox) {
      const ids = materialMap.get(Number(materialBox.dataset.materialId)) || [];
      if (materialBox.checked) ids.forEach((id) => ticked.add(id));
      else ids.forEach((id) => ticked.delete(id));
      renderActiveTab(); // materials tab shows counts derived from ticked state via other concepts too
    }
  });

  renderActiveTab();
}

/* ---------- course study plan (Build 2, Step 5): per-course schedule ---------- */

function coursePlanRow(item) {
  const days = daysBetween(todayISO(), item.exam_date);
  const daysText = days === 0 ? 'today' : days === 1 ? 'in 1 day' : days > 1 ? `in ${days} days` : 'past';
  const dotCls = item.note_id ? 'bg-emerald-500' : 'bg-amber-400';
  const doneMark = item.done ? doneCheckIcon : '';
  return `
    <button data-action="open-lesson" data-course-id="${item.course_id}" data-note-id="${item.note_id || ''}" data-concept-id="${item.concept_id != null ? item.concept_id : ''}"
      class="card card-interactive flex w-full items-center gap-3 px-4 py-3 text-left">
      <span class="h-2.5 w-2.5 shrink-0 rounded-full ${dotCls}"></span>
      <div class="flex min-w-0 flex-1 items-center gap-1.5">
        <p class="min-w-0 truncate text-sm font-medium ${item.done ? 'text-neutral-400 line-through' : ''}">${esc(item.concept_name)}</p>
        ${doneMark}
      </div>
      <div class="hidden shrink-0 text-right sm:block">
        <p class="truncate text-xs text-neutral-500">for ${esc(item.exam_name)}</p>
        <p class="mt-0.5 text-xs text-neutral-400">${daysText}</p>
      </div>
      ${chevronIcon}
    </button>`;
}

function coursePlanList(items) {
  return `<div class="flex w-full flex-col gap-3">${items.map(coursePlanRow).join('')}</div>`;
}

function coursePlanDaySection(iso, items) {
  return `
    <section class="mt-4 first:mt-0">
      <h4 class="text-xs font-semibold uppercase tracking-wide text-neutral-400">${fmtDayHeader(iso)}</h4>
      <div class="mt-2">${coursePlanList(items)}</div>
    </section>`;
}

async function loadCoursePlan(courseId) {
  const host = document.getElementById('course-plan-section');
  if (!host) return;
  const header = sectionHeader('Study plan',
    'When to study each concept, based on your exams. Updates automatically when you change your exams.', '');
  let items = [];
  try {
    items = await api.get(`/courses/${courseId}/schedule`);
  } catch (e) {
    host.innerHTML = header + errorBox(`Could not load study plan: ${esc(e.message)}`);
    return;
  }

  let html = header;
  if (!items.length) {
    html += dashed('No study plan for this course yet. Add an exam above and your day-by-day plan appears here.');
  } else {
    const byDate = {};
    const dates = [];
    items.forEach((it) => {
      if (!byDate[it.study_date]) { byDate[it.study_date] = []; dates.push(it.study_date); }
      byDate[it.study_date].push(it);
    });
    html += dates.map((d) => coursePlanDaySection(d, byDate[d])).join('');
  }

  host.innerHTML = html;
}

/* ---------- quiz status label ----------
   Quiz generation is MANUAL: opening or selecting a lesson NEVER generates a
   quiz. Generation happens only from the quiz view itself (renderQuiz ->
   quizStartGeneration) when the student clicks "Start Quiz". quizStatusCache is
   retained but is no longer pre-populated, so quizButtonLabel simply reads
   "Start Quiz" on the lesson views. */

const quizStatusCache = {}; // concept_id -> last known quiz status (no longer prefetched)

function quizButtonLabel(conceptId) {
  const status = conceptId != null ? quizStatusCache[conceptId] : null;
  return (status === 'generating' || status === 'pending') ? 'Preparing quiz…' : 'Start Quiz';
}

/* ---------- PDF reader overlay: shared immersive reader ---------- */
/* A single full-viewport overlay mounted on document.body, used by both the
   course study view and the schedule study view.
   CUSTOM CANVAS REBUILD (reverts the PDFViewer-virtualized phase): PDFViewer
   virtualized rendering — pages render on-demand as they near the viewport —
   which shows up as a split-second "loading" JITTER on every scroll. Notes
   here are short, so instead we render EVERY page to its own <canvas> up
   front when the reader opens (readerRenderAllPages, called once from
   loadReaderPdf and again, debounced, on window resize). Because every page
   is already rendered, scrolling never triggers a render — no jitter.
   Zoom is CSS-only (readerZoom/readerApplyZoom, state.scale): each page
   wrapper's fit-to-width CSS box (cssW × cssH, computed once per render
   pass) is resized via inline width/height; the page <canvas> and our own
   annotation canvas fill it via width:100%/height:100%, and PDF.js's text
   layer (fixed at its own base cssW/cssH) is kept aligned via a single
   `transform: scale(state.scale)` — no page re-renders on zoom.
   PDF.js is used only as a library now (window.__pdfjs.lib, bootstrapped
   from an ES module <script> in index.html's <head>) — getDocument() to
   load the file, page.render() for the bitmap, and its text-layer API
   (TextLayer class or the older renderTextLayer function — probed at
   runtime in readerRenderPdfTextLayer) for selectable text.
   Do NOT reintroduce content-visibility (it broke text-layer measurement/
   layout for off-screen pages) or backdrop-filter (it re-blurs the whole
   screen every frame and made scrolling/hover/clicks laggy — already
   removed from the overlay/navbar backgrounds in reader.css).
   The annotation tools (highlight/pen/text/eraser) are wired per-page
   directly in the readerRenderAllPages loop (setupReaderPageInteraction +
   redrawPage) instead of via a PDFViewer event. The toolbar is mounted into
   #reader-tools in openReader(). */

const READER_PDFJS_WAIT_TIMEOUT_MS = 2000; // how long to poll for window.__pdfjs before falling back
const READER_PDFJS_WAIT_INTERVAL_MS = 50;
const READER_ZOOM_MIN = 0.25;   // user zoom-out floor
const READER_ZOOM_MAX = 4;      // user zoom-in ceiling
// The reader opens here (fraction of raw fit-to-width). Fit-to-width alone reads
// too large, so the comfortable default is ~58% of it — and THAT is shown to the
// user as "100%" (readerApplyZoom normalizes the label by this). Zoom-in/out and
// reset are all relative to this baseline.
const READER_DEFAULT_ZOOM = 0.58;
const READER_RESIZE_DEBOUNCE_MS = 300; // re-render all pages at the new fit-width after a window resize settles
const READER_RENDER_DPR_CAP = 2; // canvas backing-store DPR cap — crisp on retina without ballooning memory across every page rendered up front

/* ---------- "Ask AI" (Phase B): select text or snip a region in the reader,
   ask about it, get a streamed answer in a docked panel. Backend contract
   (Phase A, already built): POST /concepts/:id/ask, JSON body
   { mode?, question?, selection?, context?, image? } -> 200 text/plain
   STREAMING response. Only enabled when openReader() is passed a conceptId
   (the canvas lesson-open call sites) — readerState.ask stays null otherwise
   and none of this UI is rendered. No "pin to canvas" here — that's Phase C. */
const READER_ASK_MODES = [
  { mode: 'explain', label: 'Explain' },
  { mode: 'simple', label: 'Simply' },
  { mode: 'deep', label: 'In depth' },
  { mode: 'analogy', label: 'Analogy' },
  { mode: 'define', label: 'Define' },
];
const READER_ASK_MODE_LABELS = READER_ASK_MODES.reduce((m, x) => { m[x.mode] = x.label; return m; }, {});
const READER_SNIP_MIN_PX = 8;       // ignore a snip drag smaller than this (accidental click)
const READER_SNIP_MAX_OUTPUT = 1600; // cap the crop's long side (px) so the base64 stays well under the server's 4MB image limit

/* ---------- annotations (Build 4, Step 4) ---------- */
/* Data model (resolution-independent — fractions of a page's CSS box, so
   annotations replot correctly at any zoom/resize):
     { type:'highlight', page, color, x, y, w, h }         — rect, [0..1] of page
     { type:'pen', page, color, width, points:[{x,y},...] } — width = fraction of page width
     { type:'text', page, color, x, y, size, text }         — size = fraction of page height
   Kept as one flat array on readerState.annotations, insertion-ordered so a
   plain "pop the last one" gives Undo and later entries draw on top (so the
   eraser's "topmost" hit is just the last match in the array). */
const READER_COLORS = ['#f5c518', '#34d399', '#60a5fa', '#f87171', '#1a1a1a'];
const READER_STROKE_THIN = 0.004;
const READER_STROKE_THICK = 0.01;
const READER_TEXT_SIZE = 0.022; // fraction of page height

let readerState = null;        // { note, container, scrollEl, indicatorEl, zoomLabelEl, pdfDoc, scale, observer, resizeHandler, resizeTimer, keyHandler, pages, tool, color, strokeWidth, annotations, dirty, saveTimer }
                                // note also carries {pdfUrl, annGetUrl, annPutUrl} — defaulted in openReader() to the
                                // /notes/:id endpoints; canvas-file cards pass explicit /canvas-files/:id ones instead.

function readerFallback(note, container) {
  const scrollEl = container.querySelector('#reader-scroll');
  if (scrollEl) {
    const base = note.pdfUrl || `/api/notes/${note.id}/pdf`;
    const href = base + (base.includes('?') ? '&' : '?') + 'download=1';
    scrollEl.innerHTML = `
      <div class="reader-fallback">
        <p class="text-sm text-neutral-500">Couldn't load the rich reader.</p>
        <a href="${href}" class="${btnSecondary}">Download PDF</a>
      </div>`;
  }
  const indicator = container.querySelector('#reader-page-indicator');
  if (indicator) indicator.textContent = '';
}

/* ---------- annotation drawing / persistence (Build 4, Step 4) ----------
   pageEntry.wrapper is our own .reader-page div (built in
   readerRenderAllPages); pageEntry.annCanvas / pageEntry.textLayer are our
   overlay nodes appended into it in the same loop. */

function readerRedrawAll(state) {
  state.pages.forEach((p) => redrawPage(state, p));
}

// Repaints one page's overlay from the normalized model: clears the
// annotation canvas, redraws every highlight/pen annotation for that page
// (denormalizing fractions -> current canvas px, so it's correct at any
// zoom/resize), then syncs the DOM text layer. `preview`, if given, is an
// in-progress (uncommitted) annotation drawn on top for live feedback.
function redrawPage(state, pageEntry, preview) {
  const canvas = pageEntry.annCanvas;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width, H = canvas.height;
  const list = state.annotations.filter((a) => a.page === pageEntry.pageNumber && a.type !== 'text');
  const all = preview && preview.type !== 'text' ? list.concat([preview]) : list;
  for (const a of all) {
    if (a.type === 'highlight') {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = a.color;
      ctx.fillRect(a.x * W, a.y * H, a.w * W, a.h * H);
      ctx.restore();
    } else if (a.type === 'pen' && a.points && a.points.length > 1) {
      ctx.save();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = Math.max(1, a.width * W);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(a.points[0].x * W, a.points[0].y * H);
      for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x * W, a.points[i].y * H);
      ctx.stroke();
      ctx.restore();
    }
  }
  readerSyncTextLayer(state, pageEntry);
}

// Re-renders committed text annotations as positioned DOM elements (crisp,
// selectable) — percentage positioning keeps them correct across resize
// without any px math; only font-size needs the page's current CSS height.
function readerSyncTextLayer(state, pageEntry) {
  const layer = pageEntry.textLayer;
  layer.innerHTML = '';
  const rect = pageEntry.wrapper.getBoundingClientRect();
  const cssH = rect.height || pageEntry.cssH;
  const list = state.annotations.filter((a) => a.page === pageEntry.pageNumber && a.type === 'text');
  for (const a of list) {
    const div = document.createElement('div');
    div.className = 'reader-text-note';
    div.style.left = (a.x * 100) + '%';
    div.style.top = (a.y * 100) + '%';
    div.style.color = a.color;
    div.style.fontSize = Math.max(10, a.size * cssH) + 'px';
    div.textContent = a.text;
    layer.appendChild(div);
  }
}

function readerPointToFraction(pageEntry, evt) {
  const rect = pageEntry.wrapper.getBoundingClientRect();
  const x = rect.width ? (evt.clientX - rect.left) / rect.width : 0;
  const y = rect.height ? (evt.clientY - rect.top) / rect.height : 0;
  return { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
}

function readerHitTest(annotation, pt) {
  if (annotation.type === 'highlight') {
    return pt.x >= annotation.x && pt.x <= annotation.x + annotation.w &&
           pt.y >= annotation.y && pt.y <= annotation.y + annotation.h;
  }
  if (annotation.type === 'pen') {
    const tol = Math.max((annotation.width || READER_STROKE_THIN) * 2.5, 0.012);
    return (annotation.points || []).some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) < tol);
  }
  if (annotation.type === 'text') {
    const w = 0.28, h = (annotation.size || READER_TEXT_SIZE) * 1.6;
    return pt.x >= annotation.x - 0.01 && pt.x <= annotation.x + w &&
           pt.y >= annotation.y - 0.01 && pt.y <= annotation.y + h;
  }
  return false;
}

// Removes the topmost (last-inserted, i.e. last matching entry — later
// annotations draw over earlier ones) annotation under `pt` on this page.
function readerEraseAt(state, pageEntry, pt) {
  let hit = -1;
  state.annotations.forEach((a, i) => {
    if (a.page === pageEntry.pageNumber && readerHitTest(a, pt)) hit = i;
  });
  if (hit === -1) return false;
  state.annotations.splice(hit, 1);
  redrawPage(state, pageEntry);
  return true;
}

// Undo: pop the single most-recently-added annotation (simple stack over the
// insertion-ordered array) and repaint its page.
function readerUndo(state) {
  if (!state || !state.annotations.length) return;
  const last = state.annotations.pop();
  const pageEntry = state.pages.find((p) => p.pageNumber === last.page);
  if (pageEntry) redrawPage(state, pageEntry);
  readerMarkDirty(state);
}

function readerMarkDirty(state) {
  state.dirty = true;
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => readerFlushSave(state), 800);
}

async function readerFlushSave(state) {
  if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
  if (!state.dirty) return;
  state.dirty = false;
  try {
    await api.put(state.note.annPutUrl, { data: state.annotations });
    if (readerState === state) readerShowSaved(state);
  } catch (e) {
    console.error('Reader: failed to save annotations', e);
    if (readerState === state) state.dirty = true; // retry on the next change
  }
}

function readerShowSaved(state) {
  const el = state.container && state.container.querySelector('#reader-save-status');
  if (!el) return;
  el.textContent = 'Saved';
  el.classList.add('reader-save-visible');
  clearTimeout(state.savedFadeTimer);
  state.savedFadeTimer = setTimeout(() => el.classList.remove('reader-save-visible'), 1500);
}

function loadReaderAnnotations(note, state) {
  api.get(note.annGetUrl).then((res) => {
    if (readerState !== state) return;
    state.annotations = Array.isArray(res && res.data) ? res.data : [];
    readerRedrawAll(state);
  }).catch((e) => {
    console.error('Reader: failed to load annotations', e);
  });
}

// Wires pointer interaction for one page's overlay: highlight drag, pen
// freehand, eraser click/drag, and text placement (click -> editable box ->
// commit on blur/Enter). Gated by state.tool; CSS (.reader-tool-*) toggles
// pointer-events so the page still scrolls normally in "none" (read) mode.
function setupReaderPageInteraction(state, pageEntry) {
  const canvas = pageEntry.annCanvas;
  const textLayer = pageEntry.textLayer;
  let drawing = null;

  canvas.addEventListener('pointerdown', (e) => {
    if (readerState !== state) return;
    const tool = state.tool;
    if (tool === 'none') return;
    e.preventDefault();
    const pt = readerPointToFraction(pageEntry, e);
    if (tool === 'highlight') {
      drawing = { type: 'highlight', page: pageEntry.pageNumber, color: state.color, x: pt.x, y: pt.y, w: 0, h: 0, _start: pt };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (tool === 'pen') {
      drawing = { type: 'pen', page: pageEntry.pageNumber, color: state.color, width: state.strokeWidth, points: [pt] };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    } else if (tool === 'eraser') {
      if (readerEraseAt(state, pageEntry, pt)) readerMarkDirty(state);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (readerState !== state) return;
    if (drawing) {
      const pt = readerPointToFraction(pageEntry, e);
      if (drawing.type === 'highlight') {
        drawing.x = Math.min(drawing._start.x, pt.x);
        drawing.y = Math.min(drawing._start.y, pt.y);
        drawing.w = Math.abs(pt.x - drawing._start.x);
        drawing.h = Math.abs(pt.y - drawing._start.y);
      } else if (drawing.type === 'pen') {
        drawing.points.push(pt);
      }
      redrawPage(state, pageEntry, drawing);
    } else if (state.tool === 'eraser' && e.buttons === 1) {
      const pt = readerPointToFraction(pageEntry, e);
      if (readerEraseAt(state, pageEntry, pt)) readerMarkDirty(state);
    }
  });

  const finishDrawing = () => {
    if (readerState !== state || !drawing) return;
    if (drawing.type === 'highlight') {
      delete drawing._start;
      if (drawing.w > 0.004 && drawing.h > 0.004) { state.annotations.push(drawing); readerMarkDirty(state); }
    } else if (drawing.type === 'pen') {
      if (drawing.points.length > 1) { state.annotations.push(drawing); readerMarkDirty(state); }
    }
    drawing = null;
    redrawPage(state, pageEntry);
  };
  canvas.addEventListener('pointerup', finishDrawing);
  canvas.addEventListener('pointercancel', finishDrawing);
  canvas.addEventListener('pointerleave', () => { if (drawing && drawing.type === 'pen') finishDrawing(); });

  textLayer.addEventListener('click', (e) => {
    if (readerState !== state || state.tool !== 'text') return;
    const pt = readerPointToFraction(pageEntry, e);
    readerPlaceTextBox(state, pageEntry, pt);
  });
}

function readerPlaceTextBox(state, pageEntry, pt) {
  const layer = pageEntry.textLayer;
  const editor = document.createElement('div');
  editor.className = 'reader-text-editor';
  editor.contentEditable = 'true';
  editor.style.left = (pt.x * 100) + '%';
  editor.style.top = (pt.y * 100) + '%';
  editor.style.color = state.color;
  const rect = pageEntry.wrapper.getBoundingClientRect();
  const cssH = rect.height || pageEntry.cssH;
  editor.style.fontSize = Math.max(10, READER_TEXT_SIZE * cssH) + 'px';
  layer.appendChild(editor);
  editor.focus();

  let settled = false;
  const commit = () => {
    if (settled) return;
    settled = true;
    const text = editor.textContent.trim();
    editor.remove();
    if (text) {
      state.annotations.push({ type: 'text', page: pageEntry.pageNumber, color: state.color, x: pt.x, y: pt.y, size: READER_TEXT_SIZE, text });
      readerMarkDirty(state);
    }
    redrawPage(state, pageEntry);
  };
  editor.addEventListener('blur', commit);
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); settled = true; editor.remove(); }
    e.stopPropagation(); // don't let Escape bubble to the reader's close-on-Esc handler
  });
}

function readerToolbarHtml() {
  const tools = [
    { tool: 'none', title: 'Scroll / read (default)', active: true, svg:
      '<path d="M5 3l6 16 2-7 7-2-15-7z"/>' },
    { tool: 'highlight', title: 'Highlight', svg:
      '<path d="M9 11l6-6 4 4-6 6H9v-4z"/><path d="M5 21l3-3"/>' },
    { tool: 'pen', title: 'Pen', svg:
      '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>' },
    { tool: 'text', title: 'Text note', svg:
      '<path d="M5 6h14"/><path d="M12 6v14"/><path d="M9 20h6"/>' },
    { tool: 'eraser', title: 'Eraser', svg:
      '<path d="M18 13l-7 7H7l-4-4a2 2 0 0 1 0-2.8L13 3l7 7-2 3z"/><path d="M9.5 7.5l7 7"/>' },
  ];
  const toolBtns = tools.map((t) => `
    <button data-action="reader-tool" data-tool="${t.tool}" title="${esc(t.title)}" aria-label="${esc(t.title)}"
      class="reader-tool-btn${t.active ? ' reader-tool-btn-active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${t.svg}</svg>
    </button>`).join('');
  const swatches = READER_COLORS.map((c, i) => `
    <button data-action="reader-color" data-color="${c}" title="Color" aria-label="Color"
      class="reader-swatch${i === 0 ? ' reader-swatch-active' : ''}" style="background:${c}"></button>`).join('');
  return `
    ${toolBtns}
    <span class="reader-tool-sep"></span>
    <div class="flex items-center gap-1">${swatches}</div>
    <button data-action="reader-stroke" data-width="thin" title="Toggle stroke width" aria-label="Toggle stroke width" class="reader-tool-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M4 10h16" stroke-width="1.5"/><path d="M4 16h16" stroke-width="3.5"/>
      </svg>
    </button>
    <span class="reader-tool-sep"></span>
    <button data-action="reader-undo" title="Undo" aria-label="Undo" class="reader-tool-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>
      </svg>
    </button>
    <span id="reader-save-status" class="reader-save-status">&nbsp;</span>`;
}

function readerSetTool(tool) {
  if (!readerState) return;
  // A drawing tool and "Ask" (text-selection menu / region-snip) are mutually
  // exclusive read-mode-only affordances — switching tools hides any open
  // selection menu and cancels an in-progress snip drag.
  if (readerState.ask) {
    readerAskMenuHide(readerState);
    if (readerState.ask.snipping) readerCancelSnip(readerState);
  }
  readerState.tool = tool;
  const container = readerState.container;
  container.classList.remove('reader-tool-none', 'reader-tool-highlight', 'reader-tool-pen', 'reader-tool-text', 'reader-tool-eraser');
  container.classList.add('reader-tool-' + tool);
  container.querySelectorAll('[data-action="reader-tool"]').forEach((btn) => {
    btn.classList.toggle('reader-tool-btn-active', btn.dataset.tool === tool);
  });
}

function readerSetColor(color) {
  if (!readerState) return;
  readerState.color = color;
  readerState.container.querySelectorAll('[data-action="reader-color"]').forEach((btn) => {
    btn.classList.toggle('reader-swatch-active', btn.dataset.color === color);
  });
}

function readerToggleStroke() {
  if (!readerState) return;
  const thick = readerState.strokeWidth !== READER_STROKE_THICK;
  readerState.strokeWidth = thick ? READER_STROKE_THICK : READER_STROKE_THIN;
  const btn = readerState.container.querySelector('[data-action="reader-stroke"]');
  if (btn) { btn.classList.toggle('reader-tool-btn-active', thick); btn.dataset.width = thick ? 'thick' : 'thin'; }
}

// Zoom. `factorOrReset` is either a multiplier applied to the current
// state.scale (e.g. 1.2 to zoom in, 1/1.2 to zoom out) or the string 'reset'
// to snap back to fit-to-width (100%). Clamped to [READER_ZOOM_MIN,
// READER_ZOOM_MAX]. Purely a CSS resize (readerApplyZoom) — no canvas
// re-render — so it stays smooth regardless of page count.
function readerZoom(state, factorOrReset) {
  if (!state) return;
  if (factorOrReset === 'reset') {
    if (state.scale === READER_DEFAULT_ZOOM) return;
    state.scale = READER_DEFAULT_ZOOM;
    readerApplyZoom(state);
    return;
  }
  const next = Math.round(Math.max(READER_ZOOM_MIN, Math.min(READER_ZOOM_MAX, (state.scale || READER_DEFAULT_ZOOM) * factorOrReset)) * 1000) / 1000;
  if (Math.abs(next - (state.scale || 1)) < 1e-4) return;
  state.scale = next;
  readerApplyZoom(state);
}

// Applies state.scale to every already-rendered page: resizes each page
// wrapper's CSS box (cssW/cssH are the fit-to-width base size computed once
// in readerRenderAllPages) so the page <canvas> and our annotation canvas
// (both width:100%/height:100% of the wrapper) scale with it, and applies a
// matching `transform: scale()` to PDF.js's text layer, which is built once
// at the base size and kept aligned this way instead of being re-rendered.
function readerApplyZoom(state) {
  if (!state) return;
  const scale = state.scale || 1;
  if (state.zoomLabelEl) state.zoomLabelEl.textContent = Math.round(scale / READER_DEFAULT_ZOOM * 100) + '%';
  state.pages.forEach((p) => {
    p.wrapper.style.width = (p.cssW * scale) + 'px';
    p.wrapper.style.height = (p.cssH * scale) + 'px';
    if (p.pdfTextLayerEl) {
      // Zoom the PDF text layer the way PDF.js's own viewer does — resize its
      // box and bump --scale-factor (which re-lays the %-positioned spans and
      // their calc(var(--scale-factor)*…) font sizes). Do NOT use a CSS
      // transform: a transform on a text-containing element breaks the browser's
      // caret/selection mapping, which made a small drag select ALL the text.
      p.pdfTextLayerEl.style.transform = '';
      p.pdfTextLayerEl.style.width = (p.cssW * scale) + 'px';
      p.pdfTextLayerEl.style.height = (p.cssH * scale) + 'px';
      p.pdfTextLayerEl.style.setProperty('--scale-factor', String((p.fitScale || 1) * scale));
    }
  });
}

// Download the note as a PDF with the user's annotations baked in. Annotations
// live only client-side (normalized coords, painted on per-page canvases), so we
// composite each page's bitmap + our annotation canvas + text notes onto one
// canvas and assemble a PDF with jsPDF (loaded from a CDN in index.html). With NO
// annotations (or if jsPDF didn't load) we just download the clean original PDF,
// which stays vector/selectable. The annotated export is a raster snapshot.
async function readerDownloadAnnotated(state) {
  if (!state || !state.note) return;
  const pdfBase = state.note.pdfUrl || `/api/notes/${state.note.id}/pdf`;
  const cleanUrl = pdfBase + (pdfBase.includes('?') ? '&' : '?') + 'download=1';
  const downloadClean = () => {
    const a = document.createElement('a');
    a.href = cleanUrl; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  };
  const jspdfNS = window.jspdf;
  const hasAnn = (state.annotations || []).length > 0;
  if (!hasAnn || !jspdfNS || !jspdfNS.jsPDF || !state.pages.length) { downloadClean(); return; }
  ui.toast('Preparing annotated PDF…');
  try {
    let doc = null;
    for (const p of state.pages) {
      const ptW = p.cssW / p.fitScale, ptH = p.cssH / p.fitScale; // original PDF page size (points)
      const c = document.createElement('canvas');
      c.width = p.canvas.width; c.height = p.canvas.height;
      const ctx = c.getContext('2d');
      ctx.drawImage(p.canvas, 0, 0);      // page bitmap
      ctx.drawImage(p.annCanvas, 0, 0);   // highlight + pen strokes
      const W = c.width, H = c.height;    // text notes (DOM-only, so draw them here)
      for (const t of state.annotations.filter((x) => x.page === p.pageNumber && x.type === 'text')) {
        const fs = Math.max(10, t.size * H);
        ctx.save();
        ctx.fillStyle = t.color;
        ctx.font = `${fs}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillText(t.text || '', t.x * W, t.y * H);
        ctx.restore();
      }
      const img = c.toDataURL('image/png');
      if (!doc) doc = new jspdfNS.jsPDF({ unit: 'pt', format: [ptW, ptH] });
      else doc.addPage([ptW, ptH]);
      doc.addImage(img, 'PNG', 0, 0, ptW, ptH);
    }
    const safe = (state.note.title || 'note').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'note';
    doc.save(`${safe}-annotated.pdf`);
  } catch (e) {
    ui.toast('Could not build the annotated PDF — downloading the original.', 'error');
    downloadClean();
  }
}

// Polls briefly for window.__pdfjs (set by index.html's <head> ES-module
// bootstrap script) in case that module script hasn't finished executing/
// fetching yet on a slow connection. Resolves true once it appears, or false
// after timeoutMs so the caller can fall back gracefully.
function readerWaitForPdfjs(timeoutMs) {
  if (window.__pdfjs) return Promise.resolve(true);
  return new Promise((resolve) => {
    const start = Date.now();
    const iv = setInterval(() => {
      if (window.__pdfjs) {
        clearInterval(iv);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(iv);
        resolve(false);
      }
    }, READER_PDFJS_WAIT_INTERVAL_MS);
  });
}

// Builds a selectable PDF.js text layer for one page, sized at its base
// (unzoomed) CSS box (cssW × cssH) — readerApplyZoom keeps it aligned with a
// zoomed page via `transform: scale()` rather than rebuilding it. Best-effort:
// the standalone `renderTextLayer` function was removed from PDF.js around
// v4.0 in favor of the `TextLayer` class, so we probe for whichever the
// loaded build (pdfjs-dist@4.6.82) exposes and fall back to a plain (no
// selection) page if neither is present, logging instead of throwing.
// Builds and RETURNS a rendered PDF text-layer element for one page. Uses PDF.js's
// TextLayerBuilder (a viewer component) — NOT the raw `TextLayer` class — because
// the builder also creates the `.endOfContent` element and wires the `.selecting`
// drag toggle, which is what constrains native text selection. The raw TextLayer
// class renders spans but omits both, which made a partial drag select ALL the
// text. Falls back to the raw TextLayer (imperfect selection) only if the builder
// isn't available; returns null on failure (the page still displays its canvas).
async function readerRenderPdfTextLayer(pdfjs, page, fitScale, cssW, cssH) {
  try {
    if (typeof pdfjs.TextLayerBuilder === 'function') {
      const builder = new pdfjs.TextLayerBuilder({ pdfPage: page });
      await builder.render(page.getViewport({ scale: fitScale }));
      const el = builder.div; // <div class="textLayer"> incl. .endOfContent + selection wiring
      el.classList.add('reader-pdf-textlayer');
      el.style.width = cssW + 'px';
      el.style.height = cssH + 'px';
      el.style.setProperty('--scale-factor', String(fitScale));
      return el;
    }
    // Fallback: raw TextLayer (no .endOfContent → selection may over-select).
    const el = document.createElement('div');
    el.className = 'textLayer reader-pdf-textlayer';
    el.style.width = cssW + 'px';
    el.style.height = cssH + 'px';
    el.style.setProperty('--scale-factor', String(fitScale));
    const lib = pdfjs.lib;
    const viewport = page.getViewport({ scale: fitScale });
    if (typeof lib.TextLayer === 'function') {
      const tl = new lib.TextLayer({ textContentSource: page.streamTextContent(), container: el, viewport });
      await tl.render();
    } else if (typeof lib.renderTextLayer === 'function') {
      const task = lib.renderTextLayer({ textContent: await page.getTextContent(), container: el, viewport, textDivs: [] });
      if (task && task.promise) await task.promise;
    } else {
      console.warn('Reader: no PDF.js text-layer API found — this page will display without selectable text.');
    }
    return el;
  } catch (e) {
    console.error('Reader: text layer render failed for a page (continuing without selection)', e);
    return null;
  }
}

// Renders EVERY page of the open PDF to its own <canvas> up front — the core
// no-jitter guarantee: because nothing is left to render lazily, scrolling
// never triggers a render. Called once from loadReaderPdf and again
// (debounced) on window resize, since the fit-to-width base size depends on
// the scroll container's current width. Rebuilds #reader-scroll's children
// from scratch each time (cheap: this only runs at open and on resize, never
// on scroll or zoom) and repaints from the already-loaded state.annotations,
// so annotations survive a resize-triggered rebuild.
async function readerRenderAllPages(state) {
  const doc = state && state.pdfDoc;
  if (!doc || readerState !== state) return;
  const { lib } = window.__pdfjs;
  const scrollEl = state.scrollEl;
  // .reader-scroll has 1rem (16px) of left/right padding (reader.css) — fit
  // the page to the space actually available inside that padding.
  const availWidth = Math.max(200, scrollEl.clientWidth - 32);
  const dpr = Math.min(window.devicePixelRatio || 1, READER_RENDER_DPR_CAP);
  // Fix 4 (Build 14 Phase B): build every page ALREADY at the current zoom
  // (state.scale, defaulting to READER_DEFAULT_ZOOM/58%) instead of at raw
  // fit-to-width — otherwise pages painted at 100% fit-width then got
  // shrunk to 58% by the readerApplyZoom() call at the end of this loop,
  // which read as a big-then-small flash on every open. The backing-store
  // bitmap render below is untouched (still fitScale×dpr — crisp regardless
  // of the CSS box size); only the wrapper/text-layer CSS box is pre-scaled.
  const scale = state.scale || 1;

  if (state.observer) { state.observer.disconnect(); state.observer = null; }
  // B4: keep the open-time loading placeholder (if still present — first
  // render only; a later resize-triggered re-render finds none) attached
  // through this rebuild instead of wiping it here, so the scroll area isn't
  // blank again while the first page's getPage()/render() await below runs.
  // It's removed just after the first page's wrapper is appended.
  const loadingEl = scrollEl.querySelector('#reader-loading');
  scrollEl.innerHTML = '';
  if (loadingEl) scrollEl.appendChild(loadingEl);
  state.pages = [];

  const total = doc.numPages;
  for (let i = 1; i <= total; i++) {
    if (readerState !== state) return; // closed mid-render
    const page = await doc.getPage(i);
    if (readerState !== state) return;
    const viewport1 = page.getViewport({ scale: 1 });
    const fitScale = availWidth / viewport1.width;
    const cssW = viewport1.width * fitScale;
    const cssH = viewport1.height * fitScale;

    const wrapper = document.createElement('div');
    wrapper.className = 'reader-page';
    wrapper.dataset.pageNumber = String(i);
    wrapper.style.width = (cssW * scale) + 'px';
    wrapper.style.height = (cssH * scale) + 'px';

    // 1. The page bitmap. Backing store rendered at fit-width × capped DPR
    // for a crisp display; CSS size (width/height:100% of the wrapper) is
    // what zoom actually resizes.
    const canvas = document.createElement('canvas');
    canvas.className = 'reader-page-canvas';
    const renderScale = fitScale * dpr;
    canvas.width = Math.max(1, Math.round(viewport1.width * renderScale));
    canvas.height = Math.max(1, Math.round(viewport1.height * renderScale));
    const renderViewport = page.getViewport({ scale: renderScale });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: renderViewport }).promise;
    if (readerState !== state) return;

    // 2. PDF.js's own selectable text layer (via TextLayerBuilder — it builds
    // its own <div>, incl. .endOfContent + selection wiring), sitting directly
    // above the bitmap (below our annotation layers). May be null on failure.
    const pdfTextLayerEl = await readerRenderPdfTextLayer(window.__pdfjs, page, fitScale, cssW, cssH);
    if (readerState !== state) return;
    // Pre-scale the text layer to the same initial zoom as the wrapper (mirrors
    // the per-page block in readerApplyZoom — kept as a plain CSS box resize +
    // --scale-factor bump, no transform, for the same reason documented there).
    if (pdfTextLayerEl) {
      pdfTextLayerEl.style.width = (cssW * scale) + 'px';
      pdfTextLayerEl.style.height = (cssH * scale) + 'px';
      pdfTextLayerEl.style.setProperty('--scale-factor', String(fitScale * scale));
    }

    // 3. Our own annotation canvas (highlight/pen) and note-text layer,
    // sized to the same backing-store pixels as the page canvas.
    const annCanvas = document.createElement('canvas');
    annCanvas.className = 'reader-ann-canvas';
    annCanvas.width = canvas.width;
    annCanvas.height = canvas.height;
    const textLayer = document.createElement('div');
    textLayer.className = 'reader-textlayer';

    wrapper.appendChild(canvas);
    if (pdfTextLayerEl) wrapper.appendChild(pdfTextLayerEl);
    wrapper.appendChild(annCanvas);
    wrapper.appendChild(textLayer);
    scrollEl.appendChild(wrapper);
    // B4: the first page's canvas has now painted (the `await page.render(...)`
    // above already resolved) — the loading placeholder has done its job.
    if (loadingEl && loadingEl.isConnected) loadingEl.remove();

    const pageEntry = { pageNumber: i, wrapper, canvas, annCanvas, textLayer, pdfTextLayerEl, cssW, cssH, fitScale };
    state.pages.push(pageEntry);
    setupReaderPageInteraction(state, pageEntry);
    redrawPage(state, pageEntry); // paints whatever's already in state.annotations

    await new Promise((r) => setTimeout(r, 0)); // yield so the UI stays responsive while later pages render
  }

  if (readerState !== state) return;
  // Defensive: a 0-page PDF never enters the loop above, so the placeholder
  // (if this was the first render) would otherwise never be removed.
  if (loadingEl && loadingEl.isConnected) loadingEl.remove();
  readerApplyZoom(state); // re-apply the current zoom to the freshly built pages
  readerSetupObserver(state);
  if (state.indicatorEl) state.indicatorEl.textContent = `${total ? 1 : 0} / ${total}`;
}

// Tracks which page is most visible in the scroll container and keeps the
// "N / total" navbar indicator in sync — no scroll listener needed.
function readerSetupObserver(state) {
  if (!state || !state.pages.length) return;
  const ratios = new Map();
  const obs = new IntersectionObserver((entries) => {
    if (readerState !== state) return;
    entries.forEach((e) => ratios.set(e.target, e.intersectionRatio));
    let bestEl = null, bestRatio = 0;
    ratios.forEach((ratio, el) => { if (ratio > bestRatio) { bestRatio = ratio; bestEl = el; } });
    if (bestEl && state.indicatorEl) {
      state.indicatorEl.textContent = `${bestEl.dataset.pageNumber} / ${state.pages.length}`;
    }
  }, { root: state.scrollEl, threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  state.pages.forEach((p) => obs.observe(p.wrapper));
  state.observer = obs;
}

// Loads the note's PDF and renders every page up front (readerRenderAllPages).
// Also wires a debounced window-resize handler, since the fit-to-width base
// size depends on the scroll container's current width.
async function loadReaderPdf(note, state) {
  const ready = window.__pdfjs || (await readerWaitForPdfjs(READER_PDFJS_WAIT_TIMEOUT_MS) && window.__pdfjs);
  if (readerState !== state) return; // closed while we were waiting
  if (!ready) {
    console.error('Reader: window.__pdfjs is not available (CDN blocked, or the module script has not finished loading) — showing fallback.');
    readerFallback(note, state.container);
    return;
  }
  const { lib } = window.__pdfjs;
  try {
    const pdf = await lib.getDocument(note.pdfUrl).promise;
    if (readerState !== state) { try { pdf.destroy(); } catch (e) {} return; }
    state.pdfDoc = pdf;
    await readerRenderAllPages(state);
    if (readerState !== state) return;
    const onResize = () => {
      clearTimeout(state.resizeTimer);
      state.resizeTimer = setTimeout(() => {
        if (readerState === state) readerRenderAllPages(state);
      }, READER_RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    state.resizeHandler = onResize;
  } catch (err) {
    if (readerState !== state) return; // closed (or replaced) before load finished — not a real failure
    console.error('Reader: failed to load PDF', err);
    readerFallback(note, state.container);
  }
}

/* ---------- "Ask AI" (Phase B) ----------
   Two triggers, one flow: selecting text in the PDF's own selectable text
   layer shows a small floating chip menu (readerAskMenuShow); dragging a
   marquee over a page (readerToggleSnip / readerSnipPointerDown) crops those
   pixels into a data: URL instead. Either one opens the docked panel
   (readerAskOpenPanel) and fires a streamed ask (readerAskFire) against
   POST /concepts/:conceptId/ask. A follow-up textarea in the panel re-fires
   with just {question, context} (context = the original selection, carried
   so the model stays on topic — no new image, no conversation history: the
   backend is stateless per call, per the Phase-A contract). */

function readerAskMenuHtml() {
  const chips = READER_ASK_MODES.map((m, i) => `
    <button type="button" data-action="reader-ask-chip" data-mode="${m.mode}" class="reader-ask-chip">${i === 0 ? '✨ ' : ''}${esc(m.label)}</button>`).join('');
  // Round 8 item 5: an explicit dismiss (×) — the menu now tracks the live
  // selection through scroll instead of hiding on it, so there needs to be a
  // deliberate way to make it go away besides clearing the selection by hand.
  return chips + `<button type="button" data-action="reader-ask-menu-dismiss" title="Deselect" class="reader-ask-menu-dismiss">&times;</button>`;
}

function readerAskPanelHtml() {
  return `
    <div class="reader-ask-panel-header">
      <span class="reader-ask-panel-title">✨ Ask AI</span>
      <button type="button" data-action="reader-ask-close" title="Close" class="icon-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
      </button>
    </div>
    <div class="reader-ask-source" id="reader-ask-source"></div>
    <div class="reader-ask-thread" id="reader-ask-thread"></div>
    <div class="reader-ask-pin-bar" id="reader-ask-pin-bar" hidden>
      <button type="button" id="reader-ask-pin-btn" data-action="reader-ask-pin" class="reader-ask-pin-btn">📌 Pin to canvas</button>
    </div>
    <div class="reader-ask-composer">
      <textarea id="reader-ask-input" class="reader-ask-input" rows="1" placeholder="Ask a follow-up…"></textarea>
      <button type="button" id="reader-ask-send-btn" data-action="reader-ask-send" class="btn btn-primary reader-ask-send-btn">Send</button>
    </div>`;
}

// Wires every "Ask AI" listener for one reader session. Called once from
// openReader() when hasAsk. Everything attached to `document` here (as
// opposed to elements inside `state.container`, which die with the container)
// is torn down explicitly in closeReader() via the handler refs stashed on
// state.ask._*.
function readerBuildAskUi(state) {
  const ask = state.ask;
  if (!ask) return;
  const container = state.container;
  ask.menuEl = container.querySelector('#reader-ask-menu');
  ask.panelEl = container.querySelector('#reader-ask-panel');
  ask.sourceEl = container.querySelector('#reader-ask-source');
  ask.threadEl = container.querySelector('#reader-ask-thread');
  ask.inputEl = container.querySelector('#reader-ask-input');
  ask.panelOpen = false;
  ask.snipping = false;
  ask.controller = null;
  ask.context = '';       // carried into follow-ups as `context` (the last text-selection topic)
  ask.firstContext = '';  // round 7: the first page-context actually sent — captured as `grounding` if pinned
  ask._pendingSelection = ''; // the selection the floating menu is currently anchored to
  ask.turns = [];         // {role:'user'|'assistant', text}[] — the whole conversation, for "Pin to canvas" (round 6)

  readerAskRenderSource(state, null); // empty/placeholder state until a topic is set
  readerAskUpdatePinControl(state);   // hidden until >=1 turn completes

  if (ask.inputEl) {
    ask.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); readerAskSendFollowUp(state); }
      else if (e.key === 'Escape') {
        // Close the panel first rather than the whole reader — matches the
        // existing text-note-editor convention (readerPlaceTextBox) of
        // stopping Escape from reaching the document-level reader keyHandler.
        e.stopPropagation();
        readerAskClosePanel(state);
      }
    });
  }

  // Trigger 1: text selection. selectionchange fires continuously during a
  // drag, so it's rAF-throttled to at most once per frame; mouseup covers the
  // "selection just finished" moment (and keyboard/touch selections that
  // don't always emit a trailing mouseup inside the scroll container).
  let selRaf = null;
  const onSelChange = () => {
    if (selRaf) return;
    selRaf = requestAnimationFrame(() => { selRaf = null; if (readerState === state) readerHandleSelectionChange(state); });
  };
  document.addEventListener('selectionchange', onSelChange);
  ask._selChangeHandler = onSelChange;

  const onMouseUp = () => { setTimeout(() => { if (readerState === state) readerHandleSelectionChange(state); }, 0); };
  state.scrollEl.addEventListener('mouseup', onMouseUp);
  ask._mouseUpHandler = onMouseUp;

  // Round 8 item 5: reposition (not hide) the menu on scroll, so it follows a
  // still-live selection instead of disappearing the instant the page moves —
  // readerHandleSelectionChange recomputes the selection's live rect and only
  // hides the menu once the selection is actually collapsed/cleared. rAF-
  // throttled like the selectionchange handler above (a plain scroll listener
  // calling getBoundingClientRect on every tick would be wasteful).
  let scrollRaf = null;
  const onScroll = () => {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => { scrollRaf = null; if (readerState === state) readerHandleSelectionChange(state); });
  };
  state.scrollEl.addEventListener('scroll', onScroll);
  ask._scrollHideHandler = onScroll;

  const onDocMouseDown = (e) => {
    if (!ask.menuEl || ask.menuEl.hidden || ask.menuEl.contains(e.target)) return;
    readerAskMenuHide(state);
  };
  document.addEventListener('mousedown', onDocMouseDown);
  ask._outsideClickHandler = onDocMouseDown;

  // Trigger 2: region snip. Attached once to scrollEl (survives the
  // resize-triggered page-wrapper rebuild in readerRenderAllPages, since only
  // scrollEl's CHILDREN are replaced, not scrollEl itself); the handler itself
  // checks state.ask.snipping so it's a no-op outside snip mode.
  const onPointerDown = (e) => readerSnipPointerDown(state, e);
  state.scrollEl.addEventListener('pointerdown', onPointerDown);
  ask._snipPointerDownHandler = onPointerDown;
}

/* ---- floating "Explain" menu (text-selection trigger) ---- */

function readerHandleSelectionChange(state) {
  if (!state || !state.ask) return;
  if (state.tool !== 'none' || state.ask.snipping) { readerAskMenuHide(state); return; }
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) { readerAskMenuHide(state); return; }
  const text = sel.toString().trim();
  if (!text) { readerAskMenuHide(state); return; }
  // Only for a selection inside PDF.js's own selectable text layer (so this
  // never fires for, say, a drag-select across the navbar or the ask panel).
  const elOf = (node) => node && (node.nodeType === 1 ? node : node.parentElement);
  const inLayer = (node) => { const el = elOf(node); return !!(el && el.closest && el.closest('.reader-pdf-textlayer')); };
  if (!inLayer(sel.anchorNode) || !inLayer(sel.focusNode)) { readerAskMenuHide(state); return; }
  let rect;
  try { rect = sel.getRangeAt(0).getBoundingClientRect(); } catch (e) { readerAskMenuHide(state); return; }
  if (!rect || (!rect.width && !rect.height)) { readerAskMenuHide(state); return; }
  readerAskMenuShow(state, rect, text);
}

function readerAskMenuShow(state, rect, text) {
  const menu = state.ask.menuEl;
  if (!menu) return;
  state.ask._pendingSelection = text;
  menu.hidden = false;
  const containerRect = state.container.getBoundingClientRect();
  requestAnimationFrame(() => {
    if (readerState !== state || menu.hidden) return;
    const mw = menu.offsetWidth, mh = menu.offsetHeight;
    let left = rect.left - containerRect.left + rect.width / 2 - mw / 2;
    let top = rect.top - containerRect.top - mh - 10;
    if (top < 8) top = rect.bottom - containerRect.top + 10; // flip below the selection if there's no room above
    left = Math.max(8, Math.min(left, containerRect.width - mw - 8));
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  });
}

function readerAskMenuHide(state) {
  if (!state || !state.ask || !state.ask.menuEl) return;
  state.ask.menuEl.hidden = true;
  state.ask._pendingSelection = '';
}

/* ---------- current-page context (Build 9 round 7 Part 1) ----------
   The reader already renders every page's selectable text up front
   (pageEntry.pdfTextLayerEl). Grounding an ask in "what's on the page right
   now" costs nothing extra (no upload, no extra API call) — just a bit more
   text on the one /ask request. */

// Which .reader-page entry a DOM node (e.g. a selection anchor) sits inside,
// via its PDF.js text layer — null if the node isn't in any page's text layer
// (or no pageEntry matches, e.g. the reader hasn't finished rendering yet).
function readerFindPageForNode(state, node) {
  if (!state || !node) return null;
  return state.pages.find((p) => p.pdfTextLayerEl && p.pdfTextLayerEl.contains(node)) || null;
}

// Falls back to "whichever page currently occupies the most visible area of
// the scroll viewport" — computed on demand from live bounding rects (doesn't
// depend on the passive IntersectionObserver that only drives the page-number
// indicator). Used for the navbar "✨ Ask" / typed follow-ups, where there's
// no selection/snip to anchor to.
function readerMostVisiblePage(state) {
  if (!state || !state.pages || !state.pages.length || !state.scrollEl) return null;
  const viewRect = state.scrollEl.getBoundingClientRect();
  let best = null, bestArea = 0;
  state.pages.forEach((p) => {
    if (!p.wrapper) return;
    const r = p.wrapper.getBoundingClientRect();
    const w = Math.max(0, Math.min(r.right, viewRect.right) - Math.max(r.left, viewRect.left));
    const h = Math.max(0, Math.min(r.bottom, viewRect.bottom) - Math.max(r.top, viewRect.top));
    const area = w * h;
    if (area > bestArea) { bestArea = area; best = p; }
  });
  return best;
}

// The relevant page's already-rendered text, whitespace-collapsed and capped
// — cheap context for /ask with zero extra network calls. `pageEntry` may be
// passed explicitly (the page a selection/snip came from); omitted, it picks
// the currently most-visible page. Returns '' if unavailable.
const READER_ASK_PAGE_CONTEXT_CAP = 2500;
function readerCurrentPageText(state, pageEntry) {
  if (!state) return '';
  const entry = pageEntry || readerMostVisiblePage(state);
  if (!entry || !entry.pdfTextLayerEl) return '';
  const raw = entry.pdfTextLayerEl.textContent || '';
  const collapsed = raw.replace(/\s+/g, ' ').trim();
  return collapsed.length > READER_ASK_PAGE_CONTEXT_CAP ? collapsed.slice(0, READER_ASK_PAGE_CONTEXT_CAP) : collapsed;
}

function readerAskChipClick(state, mode) {
  if (!state || !state.ask) return;
  const text = state.ask._pendingSelection;
  // Capture the live selection's anchor BEFORE readerAskMenuHide runs (it only
  // touches our own menu/_pendingSelection state, not the DOM selection, but
  // grabbing this first is cheap insurance either way).
  const sel = window.getSelection && window.getSelection();
  const anchorNode = sel && sel.anchorNode;
  readerAskMenuHide(state);
  if (!text) return;
  readerAskRenderSource(state, { kind: 'text', text });
  const page = readerFindPageForNode(state, anchorNode) || readerMostVisiblePage(state);
  readerAskFire(state, { mode, selection: text, context: readerCurrentPageText(state, page) });
}

/* ---- region snip (works on diagrams/scans with no selectable text) ---- */

function readerToggleSnip(state) {
  if (!state || !state.ask) return;
  if (state.ask.snipping) { readerCancelSnip(state); return; }
  readerAskMenuHide(state);
  if (state.tool !== 'none') readerSetTool('none'); // drawing tools and snipping don't mix
  state.ask.snipping = true;
  state.container.classList.add('reader-snipping');
  const btn = state.container.querySelector('[data-action="reader-snip"]');
  if (btn) btn.classList.add('reader-tool-btn-active');
}

function readerCancelSnip(state) {
  if (!state || !state.ask) return;
  state.ask.snipping = false;
  state.container.classList.remove('reader-snipping');
  const btn = state.container.querySelector('[data-action="reader-snip"]');
  if (btn) btn.classList.remove('reader-tool-btn-active');
  if (state.ask._snipMarqueeEl) { state.ask._snipMarqueeEl.remove(); state.ask._snipMarqueeEl = null; }
}

// Delegated on scrollEl (see readerBuildAskUi); a no-op unless snip mode is
// active. Clamps the marquee to the .reader-page it started on — "constrain a
// snip to the single page where it began" — even if the pointer strays onto a
// neighboring page's canvas mid-drag.
function readerSnipPointerDown(state, e) {
  if (!state.ask || !state.ask.snipping) return;
  const wrapper = e.target.closest && e.target.closest('.reader-page');
  if (!wrapper) return;
  e.preventDefault();
  const pageEntry = state.pages.find((p) => p.wrapper === wrapper);
  if (!pageEntry) return;
  const wrapRect = wrapper.getBoundingClientRect();
  const marquee = document.createElement('div');
  marquee.className = 'reader-snip-marquee';
  wrapper.appendChild(marquee);
  state.ask._snipMarqueeEl = marquee;
  const start = { x: e.clientX, y: e.clientY };
  const clampRect = (curX, curY) => {
    const x0 = Math.max(wrapRect.left, Math.min(start.x, curX));
    const x1 = Math.min(wrapRect.right, Math.max(start.x, curX));
    const y0 = Math.max(wrapRect.top, Math.min(start.y, curY));
    const y1 = Math.min(wrapRect.bottom, Math.max(start.y, curY));
    return { x0, y0, x1, y1 };
  };
  const paint = (r) => {
    marquee.style.left = (r.x0 - wrapRect.left) + 'px';
    marquee.style.top = (r.y0 - wrapRect.top) + 'px';
    marquee.style.width = Math.max(0, r.x1 - r.x0) + 'px';
    marquee.style.height = Math.max(0, r.y1 - r.y0) + 'px';
  };
  let last = clampRect(e.clientX, e.clientY);
  paint(last);
  const scrollEl = state.scrollEl;
  try { scrollEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const onMove = (ev) => { last = clampRect(ev.clientX, ev.clientY); paint(last); };
  const cleanup = () => {
    scrollEl.removeEventListener('pointermove', onMove);
    scrollEl.removeEventListener('pointerup', onUp);
    scrollEl.removeEventListener('pointercancel', onCancel);
  };
  const onUp = () => { cleanup(); if (readerState === state) readerFinishSnip(state, pageEntry, wrapRect, last); };
  const onCancel = () => { cleanup(); if (readerState === state) readerCancelSnip(state); };
  scrollEl.addEventListener('pointermove', onMove);
  scrollEl.addEventListener('pointerup', onUp);
  scrollEl.addEventListener('pointercancel', onCancel);
}

// Crops pageEntry.canvas (the page BITMAP, at its full render-time backing-
// store resolution) to the marquee rect and opens the ask panel with the
// resulting image. Maps the marquee (in viewport px, relative to the page
// wrapper) to bitmap pixels by fraction-of-wrapper == fraction-of-canvas —
// correct at any zoom, since the wrapper and the canvas it contains are
// always sized in lockstep (readerApplyZoom resizes the wrapper; the canvas
// fills it via width/height:100%).
function readerFinishSnip(state, pageEntry, wrapRect, rect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  readerCancelSnip(state); // always exit snip mode + remove the marquee, whatever the outcome
  if (w < READER_SNIP_MIN_PX || h < READER_SNIP_MIN_PX) return; // accidental click/tiny drag — no-op
  const srcCanvas = pageEntry.canvas;
  const fracX = wrapRect.width ? (rect.x0 - wrapRect.left) / wrapRect.width : 0;
  const fracY = wrapRect.height ? (rect.y0 - wrapRect.top) / wrapRect.height : 0;
  const fracW = wrapRect.width ? w / wrapRect.width : 0;
  const fracH = wrapRect.height ? h / wrapRect.height : 0;
  const sx = Math.max(0, Math.round(fracX * srcCanvas.width));
  const sy = Math.max(0, Math.round(fracY * srcCanvas.height));
  const sw = Math.max(1, Math.min(srcCanvas.width - sx, Math.round(fracW * srcCanvas.width)));
  const sh = Math.max(1, Math.min(srcCanvas.height - sy, Math.round(fracH * srcCanvas.height)));
  const longSide = Math.max(sw, sh);
  const outScale = longSide > READER_SNIP_MAX_OUTPUT ? READER_SNIP_MAX_OUTPUT / longSide : 1;
  const outW = Math.max(1, Math.round(sw * outScale));
  const outH = Math.max(1, Math.round(sh * outScale));
  const off = document.createElement('canvas');
  off.width = outW;
  off.height = outH;
  off.getContext('2d').drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, outW, outH);
  const dataUrl = off.toDataURL('image/png');
  // Round 10 Part 2 (CANVAS.md §14): stash the crop for a later canvas paste
  // too, in ADDITION to firing the Ask-AI flow below (unchanged) — a plain
  // Ctrl+V on the canvas drops this as a new image item. Last snip/copy wins.
  canvasClipboard = { kind: 'image', dataUrl };
  readerAskRenderSource(state, { kind: 'image', dataUrl });
  state.ask.context = ''; // new visual topic — no text context to carry into a follow-up
  readerAskFire(state, { mode: 'explain', image: dataUrl, context: readerCurrentPageText(state, pageEntry) });
}

/* ---- docked ask panel: source/topic strip, threaded Q&A, follow-up ---- */

function readerAskRenderSource(state, src) {
  const el = state.ask && state.ask.sourceEl;
  if (!el) return;
  if (!src) {
    el.innerHTML = `<p class="reader-ask-source-empty">Select text, snip a region, or ask below.</p>`;
    return;
  }
  if (src.kind === 'image') {
    el.innerHTML = `<div class="reader-ask-source-label">Snipped region</div><img class="reader-ask-source-thumb" src="${src.dataUrl}" alt="Snipped region" />`;
    return;
  }
  const text = (src.text || '').trim();
  const truncated = text.length > 280 ? text.slice(0, 280) + '…' : text;
  el.innerHTML = `<div class="reader-ask-source-label">Selected text</div><blockquote class="reader-ask-source-quote">${esc(truncated)}</blockquote>`;
}

function readerAskOpenPanel(state) {
  if (!state || !state.ask || !state.ask.panelEl || state.ask.panelOpen) return;
  state.ask.panelOpen = true;
  state.ask.panelEl.hidden = false;
  requestAnimationFrame(() => { if (state.ask && state.ask.panelEl) state.ask.panelEl.classList.add('reader-ask-panel-open'); });
  readerAskMenuHide(state);
}

function readerAskClosePanel(state) {
  if (!state || !state.ask || !state.ask.panelEl || !state.ask.panelOpen) return;
  state.ask.panelOpen = false;
  if (state.ask.controller) { try { state.ask.controller.abort(); } catch (e) {} state.ask.controller = null; }
  state.ask.panelEl.classList.remove('reader-ask-panel-open');
  setTimeout(() => { if (state.ask && state.ask.panelEl && !state.ask.panelOpen) state.ask.panelEl.hidden = true; }, 220);
}

/* ---------- rich text rendering for AI answers (Build 9 round 6) ----------
   Both the reader's ask panel and the canvas 'ai' conversation overlay show
   raw LLM output -- which is markdown (headings/bold/lists/etc, plus
   $...$ / $$...$$ / \(...\) / \[...\] math) -- that must never become live
   HTML. renderRichText() below: (1) HTML-escapes the raw text FIRST (the XSS
   guard -- every tag that ends up in the DOM comes from this function's own
   template strings, never from the model's output), (2) pulls math spans out
   behind placeholder tokens so the markdown pass can't mangle _/* inside
   them, (3) runs a small hand-rolled markdown->HTML pass over what's left,
   (4) restores the math, (5) sets innerHTML and lets KaTeX (renderMath) find
   the delimiters. Best-effort -- anything unrecognized just degrades to
   escaped plain text. No new CDN dependency.

   Placeholder tokens are wrapped in a control character built at RUNTIME via
   String.fromCharCode (never a literal control byte in this source file) --
   a character that never appears in real model output, so the restore
   regexes below can't misfire against real text the way plain letters+digits
   could (e.g. a token like "C1" would collide with, and corrupt, a passage
   like "vitamin C12"). Each restore happens on the JS string BEFORE anything
   is ever assigned to .innerHTML, so the HTML parser never sees these bytes. */
const RICH_TEXT_CODE_MARK = String.fromCharCode(1);  // wraps inline `code` placeholders
const RICH_TEXT_BLOCK_MARK = String.fromCharCode(2); // wraps fenced ```code``` placeholders
const RICH_TEXT_MATH_MARK = String.fromCharCode(3);  // wraps protected math spans

// Inline code first (so bold/italic can't reach across a `code span`), via
// the same protect-then-restore trick as the math spans below.
function richTextInlineCode(s, codeStore) {
  return s.replace(/`([^`\n]+?)`/g, (m, code) => {
    const token = RICH_TEXT_CODE_MARK + codeStore.length + RICH_TEXT_CODE_MARK;
    codeStore.push('<code class="ai-rich-code">' + code + '</code>');
    return token;
  });
}

function richTextInline(s, codeStore) {
  s = richTextInlineCode(s, codeStore);
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (m, txt, url) => `<a href="${url}" rel="noopener" target="_blank">${txt}</a>`);
  s = s.replace(/\*\*([^*\n]+?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/__([^_\n]+?)__/g, '<strong>$1</strong>');
  s = s.replace(/\*([^*\n]+?)\*/g, '<em>$1</em>');
  s = s.replace(/(^|[^\w])_([^_\n]+?)_(?=$|[^\w])/g, '$1<em>$2</em>');
  return s;
}

// Converts already-escaped, math-protected text into HTML. Line-oriented:
// headings/blockquotes/lists are recognized per line, a blank line starts a
// new paragraph, and a lone newline inside a paragraph becomes a <br>.
function richTextMarkdown(text) {
  const codeStore = [];
  // Fenced code blocks first -- their content must not be touched by anything
  // below (including the per-line loop) -- pulled to a placeholder and
  // restored at the very end alongside inline code.
  const blockStore = [];
  text = text.replace(/```[^\n]*\n([\s\S]*?)```/g, (m, code) => {
    const token = RICH_TEXT_BLOCK_MARK + blockStore.length + RICH_TEXT_BLOCK_MARK;
    blockStore.push('<pre class="ai-rich-pre"><code>' + code.replace(/\n$/, '') + '</code></pre>');
    return token;
  });
  const blockLineRe = new RegExp('^' + RICH_TEXT_BLOCK_MARK + '\\d+' + RICH_TEXT_BLOCK_MARK + '$');

  const lines = text.split('\n');
  const parts = [];
  let para = [];
  let list = null; // { tag: 'ul'|'ol', items: [] }

  const flushPara = () => {
    if (para.length) {
      const html = para.join('<br>');
      if (html.trim()) parts.push('<p>' + html + '</p>');
      para = [];
    }
  };
  const flushList = () => {
    if (list) {
      parts.push('<' + list.tag + '>' + list.items.map((it) => '<li>' + it + '</li>').join('') + '</' + list.tag + '>');
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flushPara(); flushList(); continue; }
    if (blockLineRe.test(line.trim())) { flushPara(); flushList(); parts.push(line.trim()); continue; }
    let m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flushPara(); flushList();
      const cls = m[1].length <= 2 ? 'ai-rich-h1' : 'ai-rich-h3';
      parts.push('<p class="' + cls + '">' + richTextInline(m[2], codeStore) + '</p>');
      continue;
    }
    m = /^&gt;\s?(.*)$/.exec(line); // '>' arrives already HTML-escaped (this runs after esc())
    if (m) {
      flushPara(); flushList();
      const quoted = [richTextInline(m[1], codeStore)];
      while (i + 1 < lines.length && /^&gt;\s?/.test(lines[i + 1])) {
        i++;
        quoted.push(richTextInline(lines[i].replace(/^&gt;\s?/, ''), codeStore));
      }
      parts.push('<blockquote>' + quoted.join('<br>') + '</blockquote>');
      continue;
    }
    m = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (m) {
      if (!list || list.tag !== 'ul') { flushPara(); flushList(); list = { tag: 'ul', items: [] }; }
      list.items.push(richTextInline(m[1], codeStore));
      continue;
    }
    m = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (m) {
      if (!list || list.tag !== 'ol') { flushPara(); flushList(); list = { tag: 'ol', items: [] }; }
      list.items.push(richTextInline(m[1], codeStore));
      continue;
    }
    flushList();
    para.push(richTextInline(line, codeStore));
  }
  flushPara(); flushList();

  let html = parts.join('');
  html = html.replace(new RegExp(RICH_TEXT_BLOCK_MARK + '(\\d+)' + RICH_TEXT_BLOCK_MARK, 'g'), (_, i) => blockStore[Number(i)] || '');
  html = html.replace(new RegExp(RICH_TEXT_CODE_MARK + '(\\d+)' + RICH_TEXT_CODE_MARK, 'g'), (_, i) => codeStore[Number(i)] || '');
  return html;
}

// The shared entry point -- el is the element to fill, rawText the model's raw
// (unescaped) output. Used at the FINAL render of every AI answer: the
// reader's ask-panel bubble, the canvas conversation-overlay's assistant
// turns. (The streaming interim render stays plain textContent -- only the
// settled text is rich-rendered, here.)
function renderRichText(el, rawText) {
  if (!el) return;
  el.classList.add('ai-rich');
  let text = esc(String(rawText == null ? '' : rawText));

  const mathStore = [];
  const pushMath = (m) => { const t = RICH_TEXT_MATH_MARK + mathStore.length + RICH_TEXT_MATH_MARK; mathStore.push(m); return t; };
  text = text.replace(/\$\$[\s\S]+?\$\$/g, pushMath);
  text = text.replace(/\\\[[\s\S]+?\\\]/g, pushMath);
  text = text.replace(/\\\([\s\S]+?\\\)/g, pushMath);
  text = text.replace(/\$[^\$\n]+?\$/g, pushMath);

  let html = richTextMarkdown(text);
  html = html.replace(new RegExp(RICH_TEXT_MATH_MARK + '(\\d+)' + RICH_TEXT_MATH_MARK, 'g'), (_, i) => mathStore[Number(i)] || '');

  el.innerHTML = html;
  renderMath(el);
}

// Appends a fresh {question, answer} bubble pair to the thread and returns
// the (initially empty) answer bubble element for the caller to stream into.
function readerAskAppendPair(state, questionHtml) {
  const thread = state.ask.threadEl;
  const wrap = document.createElement('div');
  wrap.className = 'reader-ask-pair';
  wrap.innerHTML = `
    <div class="reader-ask-bubble reader-ask-bubble-q">${questionHtml}</div>
    <div class="reader-ask-bubble reader-ask-bubble-a"><span class="reader-ask-loading">Thinking…</span></div>`;
  thread.appendChild(wrap);
  thread.scrollTop = thread.scrollHeight;
  return wrap.querySelector('.reader-ask-bubble-a');
}

// The single entry point for firing an ask (from a chip, a snip, or a
// follow-up) — opens the panel, appends the Q/A bubble pair, streams the
// answer in via api.stream, and renders KaTeX once the stream settles. Only
// one ask streams at a time: a new one aborts whatever's in flight.
async function readerAskFire(state, params) {
  if (!state || !state.ask) return;
  const ask = state.ask;
  if (ask.controller) { try { ask.controller.abort(); } catch (e) {} }
  const controller = new AbortController();
  ask.controller = controller;

  readerAskOpenPanel(state);

  let questionHtml;
  if (params.image) {
    questionHtml = '[about the snipped region]';
  } else if (params.selection) {
    const label = READER_ASK_MODE_LABELS[params.mode] || 'Explain';
    const trimmed = params.selection.length > 220 ? params.selection.slice(0, 220) + '…' : params.selection;
    questionHtml = `<span class="reader-ask-mode-badge">${esc(label)}</span><q>${esc(trimmed)}</q>`;
  } else {
    questionHtml = esc(params.question || '');
  }
  const answerEl = readerAskAppendPair(state, questionHtml);

  const body = { mode: params.mode || 'explain' };
  if (params.question) body.question = params.question;
  if (params.selection) body.selection = params.selection;
  if (params.context) body.context = params.context;
  if (params.image) body.image = params.image;

  if (params.selection !== undefined) ask.context = params.selection;
  // Round 7 Part 1: remember the first page-context actually sent for this
  // conversation — pinned as `grounding` so a reopened convo stays on-topic
  // even with the reader (and its page text) long closed.
  if (params.context && !ask.firstContext) ask.firstContext = params.context;

  let acc = '';
  try {
    const full = await api.stream(askEndpointFor(ask.scope), body, (delta) => {
      if (readerState !== state || ask.controller !== controller) return; // superseded/closed mid-stream
      acc += delta;
      answerEl.textContent = acc;
      if (state.ask.threadEl) state.ask.threadEl.scrollTop = state.ask.threadEl.scrollHeight;
    }, { signal: controller.signal });
    if (readerState !== state || ask.controller !== controller) return;
    const finalText = full || acc;
    renderRichText(answerEl, finalText);

    // Round 6: accumulate the whole conversation (not just this one answer)
    // so it can be pinned as a single titled card — see readerAskPinToCanvas.
    const userText = params.image ? 'Explain this region'
      : (params.selection !== undefined ? params.selection : (params.question || ''));
    // Round 7 Part 2: remember what the question was actually anchored to (a
    // highlighted quote or a snip crop) so a reopened/pinned conversation can
    // show it back — a typed follow-up carries no snippet.
    const userTurn = { role: 'user', text: userText };
    if (params.image) userTurn.snippet = { kind: 'image', dataUrl: params.image };
    else if (params.selection !== undefined) userTurn.snippet = { kind: 'text', text: params.selection };
    ask.turns.push(userTurn);
    ask.turns.push({ role: 'assistant', text: finalText });
    readerAskUpdatePinControl(state);
  } catch (err) {
    if (err && err.name === 'AbortError') return; // fired again / panel closed — not a user-visible error
    if (readerState !== state || ask.controller !== controller) return;
    answerEl.classList.add('reader-ask-error');
    answerEl.textContent = 'Could not get an answer: ' + (err && err.message ? err.message : 'unknown error');
  } finally {
    if (ask.controller === controller) ask.controller = null;
  }
}

// Shows/hides the ask panel's single "Pin to canvas" control (round 6) —
// visible once there's something worth pinning (>=1 completed turn).
// F1: previously ALSO required a canvas board to already be open
// (`canvasState`), which meant the control was silently absent whenever the
// reader was opened from a context with no canvas mounted (e.g. the mind
// map's "Read note") — a dead end with no way to discover pinning at all.
// Now it's always shown once there's a turn to pin; readerAskPinToCanvas
// already handles the no-canvas case with a clear toast ("Open this lesson's
// canvas to pin a conversation") instead of silently doing nothing.
function readerAskUpdatePinControl(state) {
  if (!state || !state.ask || !state.ask.panelEl) return;
  const bar = state.ask.panelEl.querySelector('#reader-ask-pin-bar');
  if (!bar) return;
  bar.hidden = !(state.ask.turns && state.ask.turns.length > 0);
}

// Pins the WHOLE conversation so far as one titled card on the lesson's
// canvas (round 6 — replaces the old per-answer "Pin to canvas" button).
// Generates a short title via the same /ask endpoint (no new backend route),
// falling back to a few words of the first question on error/empty.
async function readerAskPinToCanvas(state) {
  if (!state || !state.ask) return;
  const ask = state.ask;
  if (!canvasState) { ui.toast('Open this lesson’s canvas to pin a conversation', 'error'); return; }
  // Scope-generalized (was a bare conceptId comparison): the pinned convo must
  // land on the SAME board (concept lesson or revision canvas) it was asked on.
  const cScope = canvasState.scope;
  if (!cScope || !ask.scope || cScope.kind !== ask.scope.kind || cScope.id !== ask.scope.id) {
    ui.toast('This conversation belongs to a different lesson', 'error'); return;
  }
  if (!ask.turns || !ask.turns.length) return;

  const btn = ask.panelEl && ask.panelEl.querySelector('#reader-ask-pin-btn');
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Pinning…'; }

  const firstUserText = (ask.turns.find((t) => t.role === 'user') || {}).text || '';
  let title = '';
  try {
    const raw = await api.stream(askEndpointFor(ask.scope), {
      question: `In 2 to 4 words, give a short topic title (no quotes, no punctuation, no trailing period) for this study question: "${firstUserText.slice(0, 300)}". Reply with ONLY the title.`,
    }, () => {});
    title = (raw || '').trim().replace(/^["'\s]+|["'\s.。]+$/g, '');
  } catch (e) { /* fall back below */ }
  if (!title) {
    const words = firstUserText.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    title = words.length ? words.join(' ') : 'AI conversation';
  }

  // Round 7 Part 1: capture the page context this conversation started from
  // as `grounding` — so continuing it later (canvasAiConvoSend), even with the
  // reader closed, still has the lesson page it was about.
  let grounding = '';
  if (ask.firstContext) {
    const capped = ask.firstContext.length > 2000 ? ask.firstContext.slice(0, 2000) : ask.firstContext;
    grounding = 'From the lesson page:\n' + capped;
  }

  canvasPinAiConversation({ title, thread: ask.turns.slice(), askScope: ask.scope, sourceItemId: ask.sourceItemId, grounding });

  if (btn) { btn.disabled = false; btn.textContent = '📌 Pin to canvas'; }
}

function readerAskSendFollowUp(state) {
  if (!state || !state.ask || !state.ask.inputEl) return;
  const text = state.ask.inputEl.value.trim();
  if (!text) { state.ask.inputEl.focus(); return; }
  state.ask.inputEl.value = '';
  // Round 7 Part 1: ground every follow-up (incl. one started from the navbar
  // "✨ Ask" with no prior selection) in the current page's text, layered on
  // top of the existing prior-selection continuity (`ask.context`).
  const pageText = readerCurrentPageText(state);
  const parts = [];
  if (state.ask.context) parts.push(state.ask.context);
  if (pageText) parts.push(pageText);
  const context = parts.length ? parts.join('\n\n').slice(0, 3500) : undefined;
  readerAskFire(state, { mode: 'explain', question: text, context });
}

function openReader(note, opts = {}) {
  if (!note || !note.id) { ui.toast('No PDF for this lesson', 'error'); return; }
  // Backward-compatible URL generalization (Build 9 Phase 2a §7 of CANVAS.md):
  // existing callers pass {id, title, has_thumb} and get today's /notes/:id
  // endpoints via these defaults; canvas-file cards instead pass explicit
  // pdfUrl/annGetUrl/annPutUrl so this same reader can open a dropped
  // PDF/docx/pptx from the infinite canvas. Stored on readerState.note.*.
  note = {
    ...note,
    pdfUrl: note.pdfUrl || `/api/notes/${note.id}/pdf`,
    annGetUrl: note.annGetUrl || `/notes/${note.id}/annotations`,
    annPutUrl: note.annPutUrl || `/notes/${note.id}/annotations`,
  };
  if (readerState) closeReader();

  // "Ask AI" (Phase B) is opt-in per open: only the canvas lesson-open call
  // sites pass a conceptId (or, since the revision canvas, an askScope). The
  // dormant study-view callers pass no 2nd arg (opts = {}), so hasAsk stays
  // false there — no menu/panel/buttons render.
  // Scope generalization: opts.askScope = {kind:'concept'|'revision', id} is
  // the general form; every existing caller instead passes opts.conceptId,
  // which is wrapped into {kind:'concept', id} here for back-compat — their
  // ask traffic keeps hitting the exact same /concepts/:id/ask URL as before.
  const askScope = (opts && opts.askScope) || (opts && opts.conceptId != null ? { kind: 'concept', id: opts.conceptId } : null);
  const hasAsk = !!askScope;

  const container = document.createElement('div');
  container.className = 'reader-overlay reader-tool-none';
  container.innerHTML = `
    <div class="reader-navbar">
      ${note.renameUrl
        ? `<div class="flex min-w-0 flex-1 items-center gap-1.5" title="Click to rename this file">
             <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-neutral-400"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
             <input id="reader-title" value="${esc(note.title || 'Untitled')}" spellcheck="false" aria-label="Rename file"
               class="min-w-0 flex-1 truncate rounded-md border border-dashed border-neutral-300 bg-transparent px-1.5 py-0.5 text-sm font-semibold text-ink transition hover:border-neutral-400 focus:border-solid focus:bg-neutral-100 focus:outline-none" />
           </div>`
        : `<p class="min-w-0 truncate text-sm font-semibold text-ink" title="${esc(note.title || '')}">${esc(note.title || 'Untitled')}</p>`}
      <div class="flex shrink-0 items-center gap-3">
        <div id="reader-tools" class="flex items-center gap-1">${readerToolbarHtml()}</div>
        ${hasAsk ? `
        <span class="reader-tool-sep"></span>
        <div class="flex items-center gap-1">
          <button data-action="reader-snip" title="Snip a region to ask about" class="reader-tool-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/></svg>
          </button>
          <button data-action="reader-ask-open" title="Ask AI about this lesson" class="reader-ask-open-btn">✨ Ask</button>
        </div>` : ''}
        <div class="flex items-center gap-0.5">
          <button data-action="reader-zoom-out" title="Zoom out (Ctrl/Cmd -)" class="reader-tool-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M8 11h6"/></svg>
          </button>
          <button id="reader-zoom-level" data-action="reader-zoom-reset" title="Reset zoom to fit"
            class="min-w-[3.2rem] rounded-full px-1 py-1 text-center text-xs font-medium tabular-nums text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">100%</button>
          <button data-action="reader-zoom-in" title="Zoom in (Ctrl/Cmd +)" class="reader-tool-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>
          </button>
        </div>
        <span id="reader-page-indicator" class="text-xs font-medium tabular-nums text-neutral-500">&nbsp;</span>
        <button id="reader-pomodoro" data-action="open-pomodoro" title="Focus timer" class="reader-tool-btn"></button>
        <button data-action="reader-download" title="Download (with your annotations)"
          class="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>
        </button>
        <button data-action="reader-close" title="Close (Esc)"
          class="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <div class="reader-viewport">
      <div class="reader-scroll" id="reader-scroll"><div class="reader-loading" id="reader-loading"><div class="reader-spinner"></div><p class="reader-loading-text">Loading…</p></div></div>
      ${hasAsk ? `<div class="reader-ask-panel" id="reader-ask-panel" hidden>${readerAskPanelHtml()}</div>` : ''}
    </div>
    ${hasAsk ? `<div class="reader-ask-menu" id="reader-ask-menu" hidden>${readerAskMenuHtml()}</div>` : ''}`;
  document.body.appendChild(container);
  requestAnimationFrame(() => { container.classList.add('reader-open'); });

  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      // Stop this Escape from also reaching another document-level keydown
      // listener behind the reader (e.g. the mind map's, which clears its own
      // selection on Escape) — only the Escape path is affected here.
      e.stopPropagation();
      e.stopImmediatePropagation();
      closeReader();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;
    if (e.key.toLowerCase() === 'z') {
      // Don't hijack undo while a text-note editor (contenteditable) or any
      // other input has focus — let the browser's native text undo run.
      const active = document.activeElement;
      const editingText = !!active && (
        active.isContentEditable ||
        (typeof active.closest === 'function' && active.closest('.reader-textlayer')) ||
        ['input', 'textarea'].includes((active.tagName || '').toLowerCase())
      );
      if (editingText) return;
      e.preventDefault();
      readerUndo(readerState);
      return;
    }
    if (e.key === '=' || e.key === '+') { e.preventDefault(); readerZoom(readerState, 1.2); return; }
    if (e.key === '-') { e.preventDefault(); readerZoom(readerState, 1 / 1.2); return; }
    if (e.key === '0') { e.preventDefault(); readerZoom(readerState, 'reset'); return; }
  };
  document.addEventListener('keydown', keyHandler);

  readerState = {
    note,
    container,
    scrollEl: container.querySelector('#reader-scroll'),
    indicatorEl: container.querySelector('#reader-page-indicator'),
    zoomLabelEl: container.querySelector('#reader-zoom-level'),
    pdfDoc: null,
    scale: READER_DEFAULT_ZOOM, // shown as "100%" — a comfortable fraction of fit-to-width
    observer: null,
    resizeHandler: null,
    resizeTimer: null,
    keyHandler,
    pages: [], // populated per-page by readerRenderAllPages() as every page renders up front
    tool: 'none',
    color: READER_COLORS[0],
    strokeWidth: READER_STROKE_THIN,
    annotations: [],
    dirty: false,
    saveTimer: null,
    savedFadeTimer: null,
    ask: hasAsk ? {
      scope: askScope,
      conceptId: opts.conceptId,
      conceptName: opts.conceptName || '',
      conceptSummary: opts.conceptSummary || '',
      sourceItemId: opts.sourceItemId || null,
    } : null,
  };

  if (hasAsk) readerBuildAskUi(readerState);

  // Independent of the PDF load below: fetches saved annotations in parallel.
  // Whichever of "annotations loaded" or "pages rendered" finishes first, the
  // other's completion triggers the correct repaint — readerRedrawAll (from
  // here) and the per-page redrawPage call (from readerRenderAllPages) are
  // both idempotent and safe to call in either order.
  loadReaderAnnotations(note, readerState);
  loadReaderPdf(note, readerState);
  renderPomodoroReaderBtn(); // reflect a timer that's already running when the reader opens

  // Editable title (canvas files only — notes pass no renameUrl). Enter/blur
  // commits via PATCH; Escape reverts and is stopped from reaching the reader's
  // document-level close handler.
  if (note.renameUrl) {
    const inp = container.querySelector('#reader-title');
    if (inp) {
      let committing = false;
      const commit = async () => {
        if (committing) return;
        const name = (inp.value || '').trim();
        if (!name || name === note.title) { inp.value = note.title || 'Untitled'; return; }
        committing = true;
        try {
          await api.patch(note.renameUrl, { display_name: name });
          note.title = name;
          if (typeof note.onRenamed === 'function') note.onRenamed(name);
        } catch (err) { ui.toast('Rename failed', 'error'); inp.value = note.title || 'Untitled'; }
        finally { committing = false; }
      };
      inp.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); commit(); inp.blur(); }
        else if (e.key === 'Escape') { e.stopPropagation(); inp.value = note.title || 'Untitled'; inp.blur(); }
      });
      inp.addEventListener('blur', commit);
    }
  }
}

function closeReader() {
  if (!readerState) return;
  const st = readerState;
  readerState = null; // mark closed immediately so a re-entrant openReader() can proceed
  if (st.ask) {
    // Abort any in-flight ask + remove the document-level listeners (the
    // scrollEl-level ones die with the container below, but these two are on
    // `document` and would otherwise leak across reader opens/route changes).
    if (st.ask.controller) { try { st.ask.controller.abort(); } catch (e) {} st.ask.controller = null; }
    if (st.ask._selChangeHandler) document.removeEventListener('selectionchange', st.ask._selChangeHandler);
    if (st.ask._outsideClickHandler) document.removeEventListener('mousedown', st.ask._outsideClickHandler);
    if (st.ask._mouseUpHandler && st.scrollEl) st.scrollEl.removeEventListener('mouseup', st.ask._mouseUpHandler);
    if (st.ask._scrollHideHandler && st.scrollEl) st.scrollEl.removeEventListener('scroll', st.ask._scrollHideHandler);
    if (st.ask._snipPointerDownHandler && st.scrollEl) st.scrollEl.removeEventListener('pointerdown', st.ask._snipPointerDownHandler);
  }
  if (st.saveTimer) { clearTimeout(st.saveTimer); st.saveTimer = null; }
  if (st.savedFadeTimer) clearTimeout(st.savedFadeTimer);
  if (st.resizeTimer) { clearTimeout(st.resizeTimer); st.resizeTimer = null; }
  if (st.resizeHandler) window.removeEventListener('resize', st.resizeHandler);
  if (st.observer) { try { st.observer.disconnect(); } catch (e) {} }
  if (st.dirty) {
    // Fire-and-forget: fetch keeps running after the DOM/state teardown below.
    st.dirty = false;
    api.put(st.note.annPutUrl, { data: st.annotations }).catch((e) => {
      console.error('Reader: failed to flush annotations on close', e);
    });
  }
  if (st.pdfDoc) { try { st.pdfDoc.destroy(); } catch (e) {} }
  if (st.keyHandler) document.removeEventListener('keydown', st.keyHandler);
  const el = st.container;
  if (el) {
    el.classList.remove('reader-open');
    el.classList.add('reader-closing');
    setTimeout(() => { el.remove(); }, 260);
  }
}

/* ---------- infinite canvas (Build 9 "Axiom Canvas", Phase 2a) ----------
   Spec: frontend/CANVAS.md. A "lesson" is keyed by concept_id. Replaces the
   old study window as the place lessons are opened (§8.2); the compiled
   note is item #0, dropped canvas_files (Phase 2b uploads them — this phase
   just renders whatever Phase-1's backend already returns) are the rest.
   World transform (§3): #canvas-world has `transform: translate(tx,ty)
   scale(s)`; every item is an absolutely positioned child using RAW world
   px for left/top/width/height — the single parent transform does the
   pan/zoom for all of them at once, so no per-item math is needed outside
   drag/resize (which convert a screen-space pointer delta to world space by
   dividing by `scale`). */

let canvasState = null; // { courseId, conceptId, scrollEl, worldEl, note, concept, files, filesById,
                         //   itemsById (Map id -> {data, el, refKind, refObj, clickable}),
                         //   tx, ty, scale, selection ({items:Set, drawings:Set} — Selection Core,
                         //   generalizes the old single `selectedId`; a read-only `state.selectedId`
                         //   getter is still defined for back-compat), drawings, dirty, saveTimer,
                         //   spaceDown, _cleanup, fileSearch, fileSort, _panRaf }  (Phase 2b additions:
                         //   concept, fileSearch, fileSort, _panRaf — everything else is Phase 2a)
                         //   (round 10 Part 2 addition: _activeItemDragEl — the item element currently
                         //   mid drag/resize, if any, so a pinch-zoom's 2nd pointer can force it to end)
                         //   (Revision-canvas addition: `scope: { kind: 'concept'|'revision', id }` —
                         //   which board this is. Concept scope keeps `conceptId`/`concept`/`concepts`/
                         //   `note`/`notesByConceptId` populated exactly as before (scope.id === conceptId,
                         //   kept in sync); revision scope instead carries `revision: { id, status,
                         //   error_message, token }` + `revisionTitle`, and leaves `conceptId`/`concept`
                         //   unset (falsy) — every concept-only helper (lesson list/switch, Start Quiz/
                         //   Mark-done, note rename) is simply never invoked for that scope. Layout/upload
                         //   URLs go through canvasLayoutApiBase(state); a dropped file's raw/pdf/thumb/
                         //   rename/delete/annotation URLs go through canvasFileMediaBase(state).)

function canvasIsRevisionScope(state) {
  return !!(state && state.scope && state.scope.kind === 'revision');
}
// Base path (no /api prefix — api.js's methods add it) for this canvas's own
// layout GET/PUT and file-upload POST endpoints.
function canvasLayoutApiBase(state) {
  return canvasIsRevisionScope(state) ? `/revisions/${state.scope.id}` : `/concepts/${state.scope.id}`;
}
// Path segment for a dropped file's raw/pdf/thumb/PATCH/DELETE/annotations
// endpoints — routers/revision_canvas.py mirrors routers/canvas.py's shape
// exactly, keyed on revision_id instead of concept_id, under this sibling path.
function canvasFileMediaBase(state) {
  return canvasIsRevisionScope(state) ? 'revision-canvas-files' : 'canvas-files';
}

// Ask-AI endpoint root for a given scope ({kind:'concept'|'revision', id}) —
// generalizes the reader/canvas "ask" call sites (previously hardcoded to
// `/concepts/${conceptId}/ask`) so the same ask panel/pin/convo/lightbox code
// can target either POST /concepts/:id/ask or the sibling
// POST /revisions/:id/ask (routers/revision_canvas.py). Concept is the
// default/back-compat shape — see openReader's opts.conceptId handling.
function askEndpointFor(scope) {
  return (scope && scope.kind === 'revision') ? `/revisions/${scope.id}/ask` : `/concepts/${scope.id}/ask`;
}

// Global search (Fix 2, Build 14 Phase B): set by selectSearchResult when a
// canvas-text match is picked from a DIFFERENT concept's canvas than the one
// (if any) currently open — location.hash then navigates to that concept's
// canvas, and renderCanvasView's normal load path consumes this one-shot
// (nulling it) to pan to the target drawing once the board is built, instead
// of leaving the view at its usual fit-to-view/saved position. Left null when
// the palette instead pans in-place on an already-open matching canvas.
let canvasPendingFocus = null; // { conceptId, drawingId } | null

// Clipboard core (round 10 Part 2, CANVAS.md §14): a module-level slot (not
// per-lesson state) so it survives switching lessons within the session — a
// bonus cross-canvas paste. Holds ONE of:
//   { kind: 'selection', items: [...cloned pinned-'ai' item models...], drawings: [...cloned drawing objects...] }
//   { kind: 'image', dataUrl }   -- a stashed reader/lightbox snip crop
// Only one kind at a time; the last copy/snip action wins (canvasClipboard is
// simply overwritten, never merged).
let canvasClipboard = null;

const CANVAS_ZOOM_MIN = 0.15;
const CANVAS_ZOOM_MAX = 4;
const CANVAS_GRID_SIZE = 22; // px of dot-grid spacing at scale 1 (canvas.css draws the dots)
const CANVAS_POLL_INTERVAL_MS = 1500; // convert-status poll cadence for docx/pptx canvas files
const CANVAS_POLL_MAX_ATTEMPTS = 80;  // ~2 minutes cap — guards against a stuck poll

// ---- Phase 3 (whiteboard vector layer) — CANVAS.md §4.3/§9. World-space SVG
// drawings, conceptually the reader annotation engine (app.js ~1608+) adapted
// to store absolute world coords instead of page fractions and render as SVG
// DOM nodes instead of a 2-D canvas, so shapes/text/connectors stay
// individually addressable and connectors can re-route on item move.
const CANVAS_SVG_NS = 'http://www.w3.org/2000/svg';
const CANVAS_XHTML_NS = 'http://www.w3.org/1999/xhtml';
const CANVAS_COLORS = READER_COLORS.concat(['#7A5AF8', '#12B886']); // reuse + a couple more (CANVAS.md §9)
const CANVAS_STROKE_WIDTHS = [2, 4, 8]; // world px — thin/medium/thick
const CANVAS_TEXT_SIZE = 18; // world px font-size for a fresh text/sticky note
// Round 9: connectors between cards are ALWAYS this bright neon purple (on-theme
// with --primary #7A5AF8 / --lilac #C77DFF; reads clearly on both the light and
// dark canvas), distinct from the user-colored `arrow` tool. Applied at render
// time in canvasBuildDrawingEl so legacy/persisted connectors turn purple too.
const CANVAS_CONNECTOR_COLOR = '#B026FF';

// Visual fixes round: the sticky-note frame stroke used to be a hardcoded
// 'rgba(0,0,0,.12)' (invisible in dark mode) — read the theme's own
// --border-strong token at build time instead so it adapts to both themes.
// Cheap (one getComputedStyle read per sticky repaint) and always current
// even if the user toggles the theme mid-session.
function canvasBorderStrongColor() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--border-strong');
  return (v && v.trim()) || '#9a93ad';
}

const CANVAS_TOOLS = ['select', 'pen', 'text', 'sticky', 'rect', 'ellipse', 'line', 'arrow', 'connector', 'eraser'];
const CANVAS_HISTORY_CAP = 100;
// Selection Core (multi-select): screen-px drag threshold before an empty-
// canvas pointerdown commits to a marquee-select instead of being treated as
// a plain click (mirrors the 3-4px thresholds used elsewhere on the canvas —
// item drag, drawing manipulate).
const CANVAS_MARQUEE_THRESHOLD = 4;

// The only drawing types canvasDrawingHitTest (single click) and the marquee
// (drag-select) can target — "box-shaped" drawings with a rectangular
// bounds via canvasDrawingBounds. Matches the pre-existing hit-test comment:
// "Only box-shaped drawings (sticky/rect/ellipse/text) are grab targets so a
// big pen stroke's bounding box doesn't swallow pans/marquees."
function canvasDrawingIsBoxSelectable(d) {
  return !!d && (d.type === 'sticky' || d.type === 'rect' || d.type === 'ellipse' || d.type === 'text');
}

function canvasClampScale(s) { return Math.min(CANVAS_ZOOM_MAX, Math.max(CANVAS_ZOOM_MIN, s)); }
function canvasNewItemId() { return 'it_' + Math.random().toString(36).slice(2, 10); }

function canvasSidebarCollapsed(side) {
  try { return localStorage.getItem(`axiom_canvas_sidebar_${side}`) === '1'; } catch (e) { return false; }
}
function canvasSetSidebarCollapsed(side, val) {
  try { localStorage.setItem(`axiom_canvas_sidebar_${side}`, val ? '1' : '0'); } catch (e) { /* ignore */ }
}

/* ---- resizable sidebars (round 7 Part 6) ---- */
const CANVAS_SIDEBAR_WIDTH_DEFAULT = 240;
const CANVAS_SIDEBAR_WIDTH_MIN = 200;
const CANVAS_SIDEBAR_WIDTH_MAX = 480;

function canvasClampSidebarWidth(px) {
  return Math.min(CANVAS_SIDEBAR_WIDTH_MAX, Math.max(CANVAS_SIDEBAR_WIDTH_MIN, Math.round(px)));
}
function canvasSidebarWidth(side) {
  try {
    const raw = localStorage.getItem(`axiom_canvas_sidebar_w_${side}`);
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? canvasClampSidebarWidth(n) : CANVAS_SIDEBAR_WIDTH_DEFAULT;
  } catch (e) { return CANVAS_SIDEBAR_WIDTH_DEFAULT; }
}
function canvasSetSidebarWidth(side, px) {
  const clamped = canvasClampSidebarWidth(px);
  try { localStorage.setItem(`axiom_canvas_sidebar_w_${side}`, String(clamped)); } catch (e) { /* ignore */ }
  return clamped;
}

// Pointer-drag on a sidebar's resizer grip (its content-facing / right edge).
// Mirrors the reader snip/marquee drag pattern: setPointerCapture on the grip
// itself so subsequent pointermove/up keep firing on it regardless of where
// the cursor strays, then persist the final width on pointerup. A no-op while
// that sidebar is collapsed (the grip is hidden via CSS then too).
function canvasWireSidebarResizer(resizerEl) {
  const side = resizerEl.dataset.side;
  resizerEl.addEventListener('pointerdown', (e) => {
    if (canvasSidebarCollapsed(side)) return;
    const sidebarEl = document.getElementById(`canvas-sidebar-${side}`);
    if (!sidebarEl) return;
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarEl.getBoundingClientRect().width;
    try { resizerEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    resizerEl.classList.add('canvas-sidebar-resizer-active');
    sidebarEl.classList.add('canvas-sidebar-resizing'); // suspend the collapse-width transition so live drags don't lag/rubber-band
    const onMove = (ev) => {
      const next = canvasClampSidebarWidth(startWidth + (ev.clientX - startX));
      sidebarEl.style.width = next + 'px';
    };
    const onUp = () => {
      resizerEl.removeEventListener('pointermove', onMove);
      resizerEl.removeEventListener('pointerup', onUp);
      resizerEl.removeEventListener('pointercancel', onUp);
      resizerEl.classList.remove('canvas-sidebar-resizer-active');
      sidebarEl.classList.remove('canvas-sidebar-resizing');
      canvasSetSidebarWidth(side, parseFloat(sidebarEl.style.width) || CANVAS_SIDEBAR_WIDTH_DEFAULT);
    };
    resizerEl.addEventListener('pointermove', onMove);
    resizerEl.addEventListener('pointerup', onUp);
    resizerEl.addEventListener('pointercancel', onUp);
  });
}

function canvasReadinessDot(note) {
  const style = (color) => `<span class="canvas-dot" style="background:${color}"></span>`;
  if (!note) return style('var(--border-strong)');
  if (note.status === 'compiled') return style('var(--success)');
  if (note.status === 'failed') return style('var(--danger)');
  if (note.status === 'generating') return '<span class="canvas-dot canvas-dot-spin"></span>';
  return style('var(--border-strong)');
}

/* ---- entry point: "Study" button only has a course id — resolve a lesson ---- */
async function openCourseCanvas(courseId) {
  try {
    const concepts = await api.get(`/courses/${courseId}/concepts`);
    if (!concepts.length) { ui.toast('No lessons yet — analyze materials first.', 'error'); return; }
    const notes = await api.get(`/courses/${courseId}/notes`).catch(() => []);
    const withCompiledNote = concepts.find((c) => notes.some((n) => n.concept_id === c.id && n.status === 'compiled'));
    const target = withCompiledNote || concepts[0];
    location.hash = `#/course/${courseId}/canvas/${target.id}`;
  } catch (e) { ui.toast(e.message, 'error'); }
}

/* ---- shell markup: 64px icon rail (untouched, outside #view) + two new
   collapsible sidebars + the canvas surface, all inside #view (full-bleed) ---- */

function canvasSidebarToggleIcon(collapsed) {
  const d = collapsed ? 'M9 5l7 7-7 7' : 'M15 5l-7 7 7 7';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
}

function canvasSidebarToggleBtnHtml(side, collapsed) {
  return `
    <button data-action="canvas-toggle-sidebar" data-side="${side}" title="${collapsed ? 'Expand' : 'Collapse'}" class="icon-btn canvas-sidebar-toggle">
      ${canvasSidebarToggleIcon(collapsed)}
    </button>`;
}

function canvasLessonRowHtml(courseId, concept, note, active) {
  return `
    <button data-action="canvas-select-lesson" data-course-id="${courseId}" data-concept-id="${concept.id}"
      class="canvas-lesson-row${active ? ' active' : ''}" title="${esc(concept.name)}">
      ${canvasReadinessDot(note)}<span class="truncate">${esc(concept.name)}</span>
    </button>`;
}

// ---- lesson controls (round 5 §0): the lesson's two actions — Start Quiz +
// Mark-done toggle — now live inline in the canvas TOPBAR (next to the lesson
// title), not in a card at the top of the Files sidebar (which the user found
// congested). The concept name is already the topbar title and its summary is
// the title's tooltip, so the old "Studying" label / name / summary are gone.
// Reuses the existing doneToggleBtn()/toggleDone()/quizButtonLabel() plumbing
// unchanged, so a "Mark done" click here still updates in place everywhere.
function canvasLessonControlsHtml(concept, note) {
  if (!concept) return '';
  const done = !!(note && note.done);
  return `
    <button data-action="start-quiz" data-concept-id="${concept.id}" class="btn btn-primary canvas-lesson-quiz-btn">${quizButtonLabel(concept.id)}</button>
    ${doneToggleBtn(concept.id, done, 'row')}`;
}

function canvasRenderLessonControls(state) {
  const host = document.getElementById('canvas-lesson-controls');
  if (host) host.innerHTML = canvasLessonControlsHtml(state.concept, state.note);
}

// ---- file-container rows (Phase 2b §2): note #0 first, then canvas files —
// search + sort control which/how the FILE rows (never the note) are
// filtered/ordered; a null itemId (file exists but nothing currently places
// it on the board) degrades gracefully in canvasPanToItem().
function canvasFileRowHtml(row, isChild) {
  // Fix 1: a convo nested under the file/note it was pinned from gets an
  // extra class so CSS can indent it (canvas-file-row-child in canvas.css).
  // Orphaned convos (no resolvable source) render exactly as before, at the
  // top level in the bottom "Conversations" group.
  const childCls = isChild ? ' canvas-file-row-child' : '';
  // Round 7 Part 3: a pinned AI conversation — the "AI" tag, its title, and a
  // delete control. Unlike a file row, clicking it OPENS the conversation
  // (content, not a spatial location on the board) rather than panning to it.
  if (row.rowKind === 'ai') {
    return `
      <div class="canvas-file-row${childCls}" title="${esc(row.name)}">
        <div data-action="canvas-open-convo" data-item-id="${row.itemId}" class="canvas-file-row-main">
          <span class="canvas-file-tag canvas-file-tag-ai">AI</span>
          <span class="truncate">${esc(row.name)}</span>
        </div>
        <span class="canvas-file-row-actions">
          <button type="button" data-action="canvas-delete-convo" data-item-id="${row.itemId}" title="Delete conversation" class="canvas-file-action canvas-file-action-danger">${trashIcon}</button>
        </span>
      </div>`;
  }
  // Round 8 item 3: the lesson's own note (item #0) gets a rename-only action
  // (no delete — it's not removable from the canvas) that renames the whole
  // lesson (concept + note), same as editing the note title in the reader.
  const actionsHtml = row.rowKind === 'note'
    ? `<button type="button" data-action="canvas-rename-note" title="Rename" class="canvas-file-action">${renameIcon}</button>`
    : `<button type="button" data-action="canvas-rename-file" data-file-id="${row.fileId}" title="Rename" class="canvas-file-action">${renameIcon}</button>
      <button type="button" data-action="canvas-delete-file" data-file-id="${row.fileId}" title="Remove" class="canvas-file-action canvas-file-action-danger">${trashIcon}</button>`;
  return `
    <div class="canvas-file-row${childCls}" title="${esc(row.name)}">
      <div data-action="canvas-pan-to-item" data-item-id="${row.itemId || ''}" class="canvas-file-row-main">
        <span class="canvas-file-tag">${esc(row.kindLabel)}</span>
        <span class="truncate">${esc(row.name)}</span>
        ${row.statusLabel ? `<span class="canvas-file-status">${esc(row.statusLabel)}</span>` : ''}
      </div>
      <span class="canvas-file-row-actions">${actionsHtml}</span>
    </div>`;
}

// Rebuilds #canvas-file-list from current state (files/note + the live
// itemsById map) applying the search/sort the sidebar controls hold on
// `state`. Called after mount, and after any upload/rename/delete/poll
// changes what's on the board — never rebuilds the rest of the shell.
function canvasRenderFileList(state) {
  const host = document.getElementById('canvas-file-list');
  if (!host) return;
  const q = (state.fileSearch || '').trim().toLowerCase();
  const sort = state.fileSort || 'newest';
  const cmp = (a, b) => {
    if (sort === 'name') return a.name.localeCompare(b.name);
    if (sort === 'type') return a.kindLabel.localeCompare(b.kindLabel) || a.name.localeCompare(b.name);
    return (b.createdAt || '').localeCompare(a.createdAt || ''); // newest first
  };

  const noteRow = state.note ? {
    rowKind: 'note',
    itemId: canvasFindItemIdByRef(state, 'note', state.note.id),
    fileId: null,
    kindLabel: 'NOTE',
    name: state.note.title || 'Note',
    statusLabel: state.note.status !== 'compiled' ? state.note.status : '',
  } : null;

  // Unfiltered (search applied later, per-row, once children are known —
  // see rowHtml() below) so a parent whose own name doesn't match can still
  // surface via a matching child convo.
  const fileRowsAll = state.files.map((f) => ({
    rowKind: 'file',
    kind: f.kind || '',
    itemId: canvasFindItemIdByRef(state, 'canvas-file', f.id),
    fileId: f.id,
    kindLabel: (f.kind || '').toUpperCase(),
    name: f.display_name,
    statusLabel: f.status !== 'ready' ? f.status : '',
    createdAt: f.created_at || '',
  }));

  // Fix 1: pinned AI conversations, scanned live off the itemsById map (their
  // thread/title lives only in the item's ref — no separate client-side
  // collection). Each is nested under the file/note item it was pinned FROM:
  // resolved from ref.sourceItemId (added when Fix 1 landed), falling back to
  // the `from` of its persisted connector drawing for a convo pinned before
  // that field existed — the connector was always drawn at pin time
  // (canvasPinAiConversation), so this recovers the hierarchy for every
  // existing pinned convo too. A convo whose resolved source isn't a
  // currently-rendered note/file item (source deleted, or genuinely never
  // had one) falls back to the flat "Conversations" group at the bottom.
  const allAiRows = [];
  state.itemsById.forEach((entry, itemId) => {
    if (entry.refKind !== 'ai') return;
    const obj = entry.refObj || {};
    let sourceItemId = obj.sourceItemId || null;
    if (!sourceItemId) {
      const conn = (state.drawings || []).find((d) => d.type === 'connector' && d.to === itemId);
      if (conn) sourceItemId = conn.from || null;
    }
    allAiRows.push({
      rowKind: 'ai',
      kind: 'ai',
      itemId,
      fileId: null,
      kindLabel: 'AI',
      name: obj.title || 'AI conversation',
      statusLabel: '',
      createdAt: obj.created_at ? new Date(obj.created_at).toISOString() : '',
      sourceItemId,
    });
  });

  const parentItemIds = new Set();
  if (noteRow && noteRow.itemId) parentItemIds.add(noteRow.itemId);
  fileRowsAll.forEach((r) => { if (r.itemId) parentItemIds.add(r.itemId); });

  const childrenByParent = new Map(); // parent itemId -> ai rows
  const orphanRows = [];
  allAiRows.forEach((row) => {
    if (row.sourceItemId && parentItemIds.has(row.sourceItemId)) {
      if (!childrenByParent.has(row.sourceItemId)) childrenByParent.set(row.sourceItemId, []);
      childrenByParent.get(row.sourceItemId).push(row);
    } else {
      orphanRows.push(row);
    }
  });
  childrenByParent.forEach((rows) => rows.sort(cmp));
  orphanRows.sort(cmp);

  // Renders one parent row plus its nested children, applying the search: a
  // parent shows if ITS name matches OR it has >=1 matching child; a shown
  // child must itself match the query (no query = show everything).
  function rowWithChildrenHtml(row) {
    const children = childrenByParent.get(row.itemId) || [];
    const childrenToShow = q ? children.filter((c) => c.name.toLowerCase().includes(q)) : children;
    const parentMatches = !q || row.name.toLowerCase().includes(q);
    if (q && !parentMatches && !childrenToShow.length) return '';
    return canvasFileRowHtml(row) + childrenToShow.map((c) => canvasFileRowHtml(c, true)).join('');
  }

  const groupFiles = (pred) => fileRowsAll.filter(pred).sort(cmp).map(rowWithChildrenHtml).join('');
  const orphanRowsFiltered = q ? orphanRows.filter((r) => r.name.toLowerCase().includes(q)) : orphanRows;

  // Group by type with subheaders (fixed order); hide empty groups.
  const groups = [
    { label: 'Lesson note', html: noteRow ? rowWithChildrenHtml(noteRow) : '' },
    { label: 'Images', html: groupFiles((r) => r.kind === 'image') },
    { label: 'PDFs', html: groupFiles((r) => r.kind === 'pdf') },
    { label: 'Documents', html: groupFiles((r) => r.kind === 'docx' || r.kind === 'pptx') },
    { label: 'Conversations', html: orphanRowsFiltered.map((r) => canvasFileRowHtml(r)).join('') },
  ].filter((g) => g.html);

  host.innerHTML = groups.length
    ? groups.map((g) => `<p class="canvas-file-group-title">${esc(g.label)}</p>${g.html}`).join('')
    : `<p class="canvas-sidebar-empty">${q ? 'Nothing matches your search.' : 'No files or conversations on this board yet.'}</p>`;
}

// Left sidebar in SCHEDULE origin: the upcoming schedule lessons grouped by day
// (cross-course), mirroring the dashboard agenda. Each row switches the canvas
// to that lesson (canvas-select-lesson handles the cross-course case).
function canvasScheduleSidebarHtml(items, activeConceptId) {
  if (!items || !items.length) return '<p class="canvas-sidebar-empty">No scheduled lessons.</p>';
  const byDate = new Map();
  items.forEach((it) => {
    const d = it.study_date || '';
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(it);
  });
  return Array.from(byDate.keys()).sort().map((d) => {
    const rows = byDate.get(d).map((it) => {
      const active = it.concept_id === activeConceptId ? ' active' : '';
      const dotColor = it.note_id ? 'var(--success)' : 'var(--text-subtle)';
      const course = esc(it.course_code || it.course_name || '');
      return `<button data-action="canvas-select-lesson" data-course-id="${it.course_id}" data-concept-id="${it.concept_id}" class="canvas-lesson-row${active}" title="${esc(it.concept_name || '')}"><span class="canvas-dot" style="background:${dotColor}"></span><span class="truncate">${esc(it.concept_name || 'Lesson')}</span>${course ? `<span class="canvas-sched-course">${course}</span>` : ''}</button>`;
    }).join('');
    return `<p class="canvas-sched-date">${esc(fmtDate(d))}</p>${rows}`;
  }).join('');
}

function canvasShellHtml(courseId, activeConceptId, concepts, notesByConceptId, activeConcept, activeNote, files, origin, scheduleItems) {
  const lessonsCollapsed = canvasSidebarCollapsed('lessons');
  const filesCollapsed = canvasSidebarCollapsed('files');
  const lessonsWidthAttr = lessonsCollapsed ? '' : ` style="width:${canvasSidebarWidth('lessons')}px"`;
  const filesWidthAttr = filesCollapsed ? '' : ` style="width:${canvasSidebarWidth('files')}px"`;
  const isSchedule = origin === 'schedule';

  const listHtml = isSchedule
    ? canvasScheduleSidebarHtml(scheduleItems, activeConceptId)
    : concepts.map((c) => canvasLessonRowHtml(courseId, c, notesByConceptId.get(c.id), c.id === activeConceptId)).join('');
  const backHtml = isSchedule
    ? `<a href="#/" class="btn btn-ghost">&larr; Schedule</a>`
    : `<a href="#/course/${courseId}" class="btn btn-ghost">&larr; Course</a>`;

  return `
    <div class="canvas-shell canvas-tool-select">
      <div class="canvas-sidebar canvas-sidebar-lessons${lessonsCollapsed ? ' collapsed' : ''}" id="canvas-sidebar-lessons"${lessonsWidthAttr}>
        <div class="canvas-sidebar-header">
          <span class="canvas-sidebar-title">${isSchedule ? 'Schedule' : 'Lessons'}</span>
          ${canvasSidebarToggleBtnHtml('lessons', lessonsCollapsed)}
        </div>
        <div class="canvas-sidebar-list" id="canvas-lesson-list">${listHtml}</div>
        <div class="canvas-sidebar-resizer" data-side="lessons" title="Drag to resize"></div>
      </div>
      <div class="canvas-sidebar canvas-sidebar-files${filesCollapsed ? ' collapsed' : ''}" id="canvas-sidebar-files"${filesWidthAttr}>
        <div class="canvas-sidebar-header">
          <span class="canvas-sidebar-title">Files</span>
          ${canvasSidebarToggleBtnHtml('files', filesCollapsed)}
        </div>
        <div class="canvas-sidebar-body">
          <div class="canvas-panel-card canvas-tools-card">
            <div class="canvas-file-toolbar">
              <input id="canvas-file-search" type="search" placeholder="Search files&hellip;" class="field-input canvas-file-search" />
              <select id="canvas-file-sort" class="field-input canvas-file-sort">
                <option value="newest">Newest</option>
                <option value="name">Name (A&ndash;Z)</option>
                <option value="type">Type</option>
              </select>
            </div>
            <button id="canvas-add-file-btn" type="button" class="btn btn-secondary canvas-add-file-btn">+ Add file</button>
            <input id="canvas-file-input" type="file" multiple class="hidden" />
          </div>
          <div class="canvas-panel-card canvas-files-card">
            <p class="canvas-panel-card-title">Files</p>
            <div class="canvas-sidebar-list" id="canvas-file-list"></div>
          </div>
        </div>
        <div class="canvas-sidebar-resizer" data-side="files" title="Drag to resize"></div>
      </div>
      <div class="canvas-main">
        <div class="canvas-topbar">
          ${backHtml}
          <p class="canvas-topbar-title truncate" title="${esc(activeConcept && activeConcept.summary ? activeConcept.summary : '')}">${esc(activeConcept ? activeConcept.name : 'Lesson')}</p>
          <div class="canvas-lesson-controls" id="canvas-lesson-controls">${canvasLessonControlsHtml(activeConcept, activeNote)}</div>
          <div class="canvas-zoom-controls">
            <button data-action="canvas-zoom-out" title="Zoom out (-)" class="icon-btn">&minus;</button>
            <span id="canvas-zoom-level" class="canvas-zoom-label">100%</span>
            <button data-action="canvas-zoom-in" title="Zoom in (+)" class="icon-btn">&plus;</button>
            <button data-action="canvas-zoom-reset" title="Fit to view (0)" class="btn btn-ghost">Fit</button>
          </div>
        </div>
        <div class="canvas-scroll" id="canvas-scroll">
          <div class="canvas-world" id="canvas-world">
            <svg id="canvas-vectors"
                 style="position:absolute; left:-100000px; top:-100000px; width:200000px; height:200000px; overflow:visible;"
                 viewBox="-100000 -100000 200000 200000">
              <defs id="canvas-vectors-defs"></defs>
              <g id="canvas-vectors-g"></g>
            </svg>
          </div>
          <div class="canvas-empty-hint" id="canvas-empty-hint" hidden>
            <p>Nothing here yet — drop a file, or generate this lesson's note from the course page.</p>
            <button type="button" id="canvas-empty-add-file-btn" class="btn btn-secondary">+ Add file</button>
          </div>
          <p class="canvas-gesture-hint">Drag to select &middot; Space or middle-drag to pan</p>
        </div>
        <div id="canvas-toolbar-host"></div>
      </div>
    </div>`;
}

// Revision-canvas shell (round: revision canvas, part 1) — a pared-down
// sibling of canvasShellHtml above for a REVISION's own board: no lesson-list
// sidebar (a revision has no sibling lessons to switch between) and no
// Start-Quiz/Mark-done topbar controls (a revision isn't a lesson). Kept as
// its own function rather than branching canvasShellHtml so the concept-scope
// shell stays byte-for-byte untouched. Everything else — the Files sidebar,
// canvas-scroll/world/vectors surface, zoom controls, toolbar host — mirrors
// canvasShellHtml's markup/ids exactly, so the shared wiring code
// (canvasWireEvents, the search/sort/add-file listeners + sidebar resizer
// wiring in renderCanvasView/renderRevisionCanvasView, canvasRenderToolbar)
// works unchanged against this shell too. `.canvas-main` is `flex:1 1 auto`
// (canvas.css) so omitting the lessons sidebar `<div>` entirely — rather than
// hiding it — reflows correctly with no layout special-casing needed.
function canvasRevisionShellHtml(courseId, title) {
  const filesCollapsed = canvasSidebarCollapsed('files');
  const filesWidthAttr = filesCollapsed ? '' : ` style="width:${canvasSidebarWidth('files')}px"`;
  return `
    <div class="canvas-shell canvas-tool-select">
      <div class="canvas-sidebar canvas-sidebar-files${filesCollapsed ? ' collapsed' : ''}" id="canvas-sidebar-files"${filesWidthAttr}>
        <div class="canvas-sidebar-header">
          <span class="canvas-sidebar-title">Files</span>
          ${canvasSidebarToggleBtnHtml('files', filesCollapsed)}
        </div>
        <div class="canvas-sidebar-body">
          <div class="canvas-panel-card canvas-tools-card">
            <div class="canvas-file-toolbar">
              <input id="canvas-file-search" type="search" placeholder="Search files&hellip;" class="field-input canvas-file-search" />
              <select id="canvas-file-sort" class="field-input canvas-file-sort">
                <option value="newest">Newest</option>
                <option value="name">Name (A&ndash;Z)</option>
                <option value="type">Type</option>
              </select>
            </div>
            <button id="canvas-add-file-btn" type="button" class="btn btn-secondary canvas-add-file-btn">+ Add file</button>
            <input id="canvas-file-input" type="file" multiple class="hidden" />
          </div>
          <div class="canvas-panel-card canvas-files-card">
            <p class="canvas-panel-card-title">Files</p>
            <div class="canvas-sidebar-list" id="canvas-file-list"></div>
          </div>
        </div>
        <div class="canvas-sidebar-resizer" data-side="files" title="Drag to resize"></div>
      </div>
      <div class="canvas-main">
        <div class="canvas-topbar">
          <a href="#/analysis/course/${courseId}" class="btn btn-ghost">&larr; Analysis</a>
          <p class="canvas-topbar-title truncate" title="${esc(title)}">${esc(title)}</p>
          <div class="canvas-zoom-controls">
            <button data-action="canvas-zoom-out" title="Zoom out (-)" class="icon-btn">&minus;</button>
            <span id="canvas-zoom-level" class="canvas-zoom-label">100%</span>
            <button data-action="canvas-zoom-in" title="Zoom in (+)" class="icon-btn">&plus;</button>
            <button data-action="canvas-zoom-reset" title="Fit to view (0)" class="btn btn-ghost">Fit</button>
          </div>
        </div>
        <div class="canvas-scroll" id="canvas-scroll">
          <div class="canvas-world" id="canvas-world">
            <svg id="canvas-vectors"
                 style="position:absolute; left:-100000px; top:-100000px; width:200000px; height:200000px; overflow:visible;"
                 viewBox="-100000 -100000 200000 200000">
              <defs id="canvas-vectors-defs"></defs>
              <g id="canvas-vectors-g"></g>
            </svg>
          </div>
          <div class="canvas-empty-hint" id="canvas-empty-hint" hidden>
            <p>Nothing here yet — drop a file, or check back once the revision PDF compiles.</p>
            <button type="button" id="canvas-empty-add-file-btn" class="btn btn-secondary">+ Add file</button>
          </div>
          <p class="canvas-gesture-hint">Drag to select &middot; Space or middle-drag to pan</p>
        </div>
        <div id="canvas-toolbar-host"></div>
      </div>
    </div>`;
}

function canvasToggleSidebar(side) {
  const collapsed = !canvasSidebarCollapsed(side);
  canvasSetSidebarCollapsed(side, collapsed);
  const el = document.getElementById(`canvas-sidebar-${side}`);
  if (!el) return;
  el.classList.toggle('collapsed', collapsed);
  // An inline width would override the `.collapsed` CSS rule's fixed width
  // (inline beats a class selector) — so clear it on collapse (let the class
  // win) and restore the saved width on expand (round 7 Part 6).
  if (collapsed) el.style.width = '';
  else el.style.width = canvasSidebarWidth(side) + 'px';
  const btn = el.querySelector('[data-action="canvas-toggle-sidebar"]');
  if (btn) {
    btn.title = collapsed ? 'Expand' : 'Collapse';
    btn.innerHTML = canvasSidebarToggleIcon(collapsed);
  }
}

/* ---- item content (thumbnail card vs. inline image) ---- */

function canvasItemRefData(state, item) {
  // Round 9: one note per concept (item #0) — resolve by PRESENCE, not strict id
  // equality. A regenerated/retried note gets a new id; the old id-equality check
  // then left the persisted note item's stale ref.id unresolvable → the item
  // unmounted and any connector anchored to it (e.g. a pinned convo's arrow)
  // silently vanished (and could be permanently dropped by a refresh). Matching
  // on presence keeps item #0 (and its connectors) alive across regeneration.
  if (item.ref.type === 'note') return state.note ? { kind: 'note', obj: state.note } : null;
  // Revision canvas item #0 — the exam's own revision PDF. Unlike a note,
  // revisions.id is STABLE across a regenerate (routers/analysis.py's
  // generate_revision UPDATEs the same row), so plain id equality is enough —
  // no presence-fallback workaround needed.
  if (item.ref.type === 'revision-pdf') {
    return (state.revision && state.revision.id === item.ref.id)
      ? { kind: 'revision-pdf', obj: { id: state.revision.id, status: state.revision.status, error_message: state.revision.error_message, token: state.revision.token, title: state.revisionTitle } }
      : null;
  }
  if (item.ref.type === 'canvas-file') {
    const obj = state.filesById.get(item.ref.id);
    return obj ? { kind: 'canvas-file', obj } : null;
  }
  // Phase C / round 6: a pinned AI conversation — the whole thread lives
  // directly in the ref (no backing table row to look up), so this always
  // resolves and the card round-trips through canvasLayoutDoc with no other
  // state needed. Round 6 shape: {type:'ai', title, thread:[{role,text}…],
  // conceptId}. Backward-compat: normalize a round-5 legacy ref
  // ({type:'ai', question, answer}, no .thread) into a synthesized 1-turn
  // thread + a derived title — never written back here (openAiConversation
  // does that, in place, the first time a legacy card is actually opened).
  if (item.ref.type === 'ai') {
    const ref = item.ref;
    if (Array.isArray(ref.thread)) {
      // Fix 1: surface sourceItemId (may be undefined on a convo pinned
      // before that field existed — canvasRenderFileList's connector
      // fallback recovers it for those).
      return { kind: 'ai', obj: { title: ref.title || 'AI conversation', thread: ref.thread, conceptId: ref.conceptId, created_at: ref.created_at || 0, sourceItemId: ref.sourceItemId || null } };
    }
    const question = ref.question || '';
    const answer = ref.answer || '';
    const words = question.trim().split(/\s+/).filter(Boolean).slice(0, 6);
    return {
      kind: 'ai',
      obj: {
        title: words.length ? words.join(' ') : 'AI answer',
        thread: [{ role: 'user', text: question }, { role: 'assistant', text: answer }],
        conceptId: state.conceptId,
        created_at: ref.created_at || 0, // legacy (round 5) ref predates created_at
        sourceItemId: ref.sourceItemId || null, // legacy ref never had this
      },
    };
  }
  // Phase 2b: an in-flight (or failed) drag-drop / "+ Add file" upload — a
  // purely client-side placeholder never written to canvas_files, so it has
  // no backing row to look up. `canvasLayoutDoc` excludes these from what
  // gets persisted (§ below), so this ref only ever exists transiently.
  if (item.ref.type === 'uploading') return { kind: 'uploading', obj: { name: item.ref.name, phase: item.ref.phase || 'uploading', error: item.ref.error } };
  return null;
}

function canvasSpinnerHtml() {
  return '<span class="canvas-item-spinner"></span>';
}

function canvasItemContentHtml(refKind, obj, state) {
  if (refKind === 'uploading') {
    if (obj.phase === 'failed') {
      return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder canvas-item-error" title="${esc(obj.error || '')}">Failed</div></div><div class="canvas-item-label">${esc(obj.name)}</div>`;
    }
    return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder">${canvasSpinnerHtml()}</div></div><div class="canvas-item-label">${esc(obj.name)} &middot; uploading&hellip;</div>`;
  }
  if (refKind === 'note') {
    if (obj.status === 'compiled') {
      const thumb = obj.has_thumb
        ? `<img src="/api/notes/${obj.id}/thumb" alt="" draggable="false" class="canvas-item-thumb-img">`
        : `<div class="canvas-item-thumb-placeholder">PDF</div>`;
      return `<div class="canvas-item-thumb">${thumb}</div><div class="canvas-item-label">${esc(obj.title || 'Note')}</div>`;
    }
    if (obj.status === 'failed') {
      return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder canvas-item-error">Compile failed</div></div><div class="canvas-item-label">${esc(obj.title || 'Note')}</div>`;
    }
    return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder">${canvasSpinnerHtml()}</div></div><div class="canvas-item-label">${esc(obj.title || 'Note')} &middot; generating&hellip;</div>`;
  }
  // Revision canvas item #0 (parallel to the 'note' branch above) — the
  // exam's compiled revision PDF. Never dropped/blanked regardless of status
  // (canvasItemRefData resolves it by stable id equality, always present once
  // the board is open); a generating/failed status just changes the thumb
  // placeholder, same as a note mid-compile.
  if (refKind === 'revision-pdf') {
    const vTok = obj.token ? `?v=${encodeURIComponent(obj.token)}` : '';
    if (obj.status === 'compiled') {
      const thumb = `<img src="/api/revisions/${obj.id}/thumb${vTok}" alt="" draggable="false" class="canvas-item-thumb-img">`;
      return `<div class="canvas-item-thumb">${thumb}</div><div class="canvas-item-label">${esc(obj.title || 'Revision PDF')}</div>`;
    }
    if (obj.status === 'failed') {
      return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder canvas-item-error" title="${esc(obj.error_message || '')}">Compile failed</div></div><div class="canvas-item-label">${esc(obj.title || 'Revision PDF')}</div>`;
    }
    return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder">${canvasSpinnerHtml()}</div></div><div class="canvas-item-label">${esc(obj.title || 'Revision PDF')} &middot; generating&hellip;</div>`;
  }
  if (refKind === 'ai') {
    // Round 6: a clean, openable summary card — title + message count + a
    // short PLAIN-text preview (not markdown/rich-rendered "at rest"; that
    // only happens once you open the full conversation — see
    // openAiConversation). No raw dump of the answer text here.
    const thread = obj.thread || [];
    const count = thread.length;
    const firstUser = thread.find((t) => t.role === 'user');
    const firstAssistant = thread.find((t) => t.role === 'assistant');
    let previewSrc = (firstUser ? firstUser.text : (firstAssistant ? firstAssistant.text : '')) || '';
    previewSrc = previewSrc.replace(/\s+/g, ' ').trim();
    const preview = previewSrc.length > 140 ? previewSrc.slice(0, 140) + '…' : previewSrc;
    // Round 8 item 4: deliberately louder than a plain file card (accent
    // header bar + bigger/bolder title + an explicit CTA, not just a subtle
    // hint) so a pinned conversation stands out on a board full of files —
    // see the .canvas-ai-card* rules in canvas.css.
    return `<div class="canvas-ai-card">
      <div class="canvas-ai-header">
        <span class="canvas-ai-header-icon">&#10024;</span>
        <span class="canvas-ai-title">${esc(obj.title || 'AI conversation')}</span>
      </div>
      <div class="canvas-ai-subline">AI CONVERSATION &middot; ${count} message${count === 1 ? '' : 's'}</div>
      <div class="canvas-ai-preview">${preview ? esc(preview) : '<span class="canvas-ai-preview-empty">No messages yet</span>'}</div>
      <div class="canvas-ai-open-hint">Open conversation &rsaquo;</div>
    </div>`;
  }
  // canvas-file
  // Fix (canvas image re-add showing the old cached image): canvas_files.id
  // is a plain INTEGER PRIMARY KEY (no AUTOINCREMENT), so deleting the newest
  // row lets SQLite reuse its id — a re-added file can get the SAME id, and
  // thus the SAME /raw or /thumb URL, as a deleted one, serving the browser's
  // cached response for the old file. Append the file's disk_uuid (unique per
  // physical file) as a cache-busting query token so a reused id still gets a
  // fresh URL for the new file.
  // canvas-file / revision-canvas-file — same shape, different endpoint root
  // (mediaBase) depending on which board this is.
  const mediaBase = canvasFileMediaBase(state);
  const vTok = obj.disk_uuid ? `?v=${encodeURIComponent(obj.disk_uuid)}` : '';
  if (obj.kind === 'image') {
    return `<div class="canvas-item-image"><img src="/api/${mediaBase}/${obj.id}/raw${vTok}" alt="" draggable="false" class="canvas-item-image-img"></div><div class="canvas-item-label">${esc(obj.display_name)}</div>`;
  }
  if (obj.status === 'converting') {
    return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder">${canvasSpinnerHtml()}</div></div><div class="canvas-item-label">${esc(obj.display_name)} &middot; converting&hellip;</div>`;
  }
  if (obj.status === 'failed') {
    return `<div class="canvas-item-thumb"><div class="canvas-item-thumb-placeholder canvas-item-error" title="${esc(obj.error_message || '')}">Failed</div></div><div class="canvas-item-label">${esc(obj.display_name)}</div>`;
  }
  const thumb = `<img src="/api/${mediaBase}/${obj.id}/thumb${vTok}" alt="" draggable="false" class="canvas-item-thumb-img">`;
  return `<div class="canvas-item-thumb">${thumb}</div><div class="canvas-item-label">${esc(obj.display_name)}</div>`;
}

function canvasItemIsClickable(refKind, obj) {
  if (refKind === 'uploading') return false;
  if (refKind === 'note') return obj.status === 'compiled';
  if (refKind === 'revision-pdf') return obj.status === 'compiled';
  if (refKind === 'ai') return true; // round 6: opens the conversation overlay (canvasOpenItem)
  if (obj.kind === 'image') return true;
  return obj.status === 'ready';
}

/* ---- mounting + interaction (select / move / resize / open) ---- */

// A small hover ✕ to remove an item (Phase 2b §3). Never shown for the
// lesson's own note (item #0), or a revision canvas's own revision-pdf item
// #0 — neither is deletable from the canvas.
function canvasItemCloseBtnHtml(refKind, itemId) {
  if (refKind === 'note' || refKind === 'revision-pdf') return '';
  return `<button type="button" class="canvas-item-close" data-action="canvas-item-delete" data-item-id="${itemId}" title="Remove" aria-label="Remove">&times;</button>`;
}

// Rebuilds an item's inner content (thumb/image/spinner/error + label + the
// resize handle + the close button) from its current ref data. Used both at
// first mount and to refresh in place after an upload/poll/rename changes
// what an item points at, without tearing down the element (keeps its drag
// listeners + selection state intact).
function canvasSetItemContent(el, refKind, obj, state) {
  el.innerHTML = canvasItemCloseBtnHtml(refKind, el.dataset.itemId)
    + canvasItemContentHtml(refKind, obj, state)
    + '<div class="canvas-item-resize" title="Resize"></div>';
  // Thumbnails can 404 (no thumb yet / render failed) — fall back to a plain
  // type-tag placeholder rather than a broken-image glyph.
  const thumbImg = el.querySelector('.canvas-item-thumb-img');
  if (thumbImg) {
    thumbImg.addEventListener('error', () => {
      const div = document.createElement('div');
      div.className = 'canvas-item-thumb-placeholder';
      div.textContent = (refKind === 'note' || refKind === 'revision-pdf') ? 'PDF' : (obj.kind || 'FILE').toUpperCase();
      thumbImg.replaceWith(div);
    }, { once: true });
  }
}

// F3: toggles the "Nothing here yet" empty-canvas hint — visible only when
// the board has NO items (no compiled note #0, no files) AND no whiteboard
// drawings. Called from every place items/drawings are mounted/removed so it
// never lingers once something exists, and reappears if the last thing on
// the board is deleted. pointer-events:none on the hint (canvas.css) keeps it
// from blocking pan/zoom/drop while shown; only its own "+ Add file" button
// re-enables pointer-events.
function canvasUpdateEmptyHint(state) {
  const hint = document.getElementById('canvas-empty-hint');
  if (!hint || !state) return;
  const empty = state.itemsById.size === 0 && (!state.drawings || state.drawings.length === 0);
  hint.hidden = !empty;
}

function canvasMountItem(state, item) {
  const ref = canvasItemRefData(state, item);
  if (!ref) return; // ref points at a deleted note/canvas-file — dropped per CANVAS.md §4.3
  const el = document.createElement('div');
  el.className = 'canvas-item';
  el.dataset.itemId = item.id;
  el.style.left = item.x + 'px';
  el.style.top = item.y + 'px';
  el.style.width = item.w + 'px';
  el.style.height = item.h + 'px';
  el.style.zIndex = String(item.z || 1);
  canvasSetItemContent(el, ref.kind, ref.obj, state);
  state.worldEl.appendChild(el);
  // (round 6: the 'ai' card's at-rest preview is plain text, not markdown/
  // KaTeX — no renderMath needed here any more; the full formatted thread
  // only renders once the conversation overlay opens.)

  const entry = { data: item, el, refKind: ref.kind, refObj: ref.obj, clickable: canvasItemIsClickable(ref.kind, ref.obj) };
  state.itemsById.set(item.id, entry);
  canvasWireItemInteraction(state, item.id);
  canvasUpdateEmptyHint(state);
}

// Re-derives an item's ref (e.g. an 'uploading' placeholder that just got its
// real canvas-file id, or a canvas-file whose status flipped converting→ready
// on a poll tick) and repaints its content in place.
function canvasRefreshItem(state, itemId) {
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  const ref = canvasItemRefData(state, entry.data);
  if (!ref) {
    // Round 9: a note item (#0) must NEVER be auto-removed by a refresh — that
    // would also drop its connectors (canvasRemoveItemFromDom → canvasDropConnectorsForItem)
    // and persist the deletion. Only genuinely deletable refs (canvas-file /
    // uploading placeholder) are cleaned up here; explicit user deletes go
    // through canvasRequestDeleteItem. Same guard for a revision canvas's own
    // revision-pdf item #0.
    if (entry.data.ref && (entry.data.ref.type === 'note' || entry.data.ref.type === 'revision-pdf')) return;
    canvasRemoveItemFromDom(state, itemId); // ref now points at something deleted
    return;
  }
  entry.refKind = ref.kind;
  entry.refObj = ref.obj;
  entry.clickable = canvasItemIsClickable(ref.kind, ref.obj);
  canvasSetItemContent(entry.el, ref.kind, ref.obj, state);
}

function canvasRemoveItemFromDom(state, itemId) {
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  entry.el.remove();
  state.itemsById.delete(itemId);
  state.selection.items.delete(itemId);
  // Phase 3: this is the single choke point where an item stops existing on
  // the board (delete-file confirm, an 'uploading' placeholder removal, and
  // canvasRefreshItem's "ref now points at something deleted" cleanup all
  // funnel through here) — so drop any connector anchored to it here too
  // (CANVAS.md §4.3: "deleting an item must drop any connectors referencing it").
  if (state.pendingConnectorFrom === itemId) canvasConnectorCancel(state);
  if (canvasDropConnectorsForItem(state, itemId)) markCanvasDirty(state);
  canvasUpdateEmptyHint(state);
}

function canvasNextZ(state) {
  let maxZ = 0;
  state.itemsById.forEach((en) => { maxZ = Math.max(maxZ, en.data.z || 0); });
  return maxZ + 1;
}

// Reverse lookup: which item (if any) currently places this note/canvas-file
// on the board — used by the file-container sidebar's "click → pan" (§8.3).
function canvasFindItemIdByRef(state, refType, refId) {
  for (const [id, entry] of state.itemsById) {
    if (entry.data.ref && entry.data.ref.type === refType && entry.data.ref.id === refId) return id;
  }
  // Round 9: a note's persisted ref.id can go stale after regeneration (new id).
  // There's exactly one note item per canvas — fall back to it so the poll/refresh
  // path still locates item #0 instead of concluding "deleted".
  if (refType === 'note') {
    for (const [id, entry] of state.itemsById) {
      if (entry.data.ref && entry.data.ref.type === 'note') return id;
    }
  }
  return null;
}

// Selection Core: generalizes the old single `state.selectedId` to a SET
// (`state.selection.items` + `state.selection.drawings`) so marquee-select
// and Shift-click can build a multi-selection. Default (no opts / additive
// false) behavior is byte-for-byte the old single-select: clear everything
// else, select just this item, bring it to front. `additive: true` (wired to
// Shift-click) instead TOGGLES this item's membership in the current
// selection and never touches z-order (a multi-select shouldn't scramble the
// stack just from building it up).
function canvasSelectItem(state, itemId, opts) {
  const additive = !!(opts && opts.additive);
  if (!additive) {
    canvasClearSelection(state);
  } else if (state.selection.items.has(itemId)) {
    const entry = state.itemsById.get(itemId);
    if (entry) entry.el.classList.remove('selected');
    state.selection.items.delete(itemId);
    return;
  }
  state.selection.items.add(itemId);
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  entry.el.classList.add('selected');
  if (!additive) {
    // bring-to-front on select (single-select only — matches the original
    // behavior; an additive Shift-click shouldn't reorder the z-stack)
    let maxZ = 0;
    state.itemsById.forEach((en) => { maxZ = Math.max(maxZ, en.data.z || 0); });
    if ((entry.data.z || 0) < maxZ) {
      entry.data.z = maxZ + 1;
      entry.el.style.zIndex = String(entry.data.z);
      markCanvasDirty(state);
    }
  }
}

// Drawing counterpart of canvasSelectItem. Drawings have no persistent DOM
// node to toggle a class on directly (canvasRenderVectors rebuilds the SVG
// wholesale every repaint) — canvasBuildDrawingEl adds the `.canvas-drawing-
// selected` halo class itself by checking `state.selection.drawings`, so
// selecting/deselecting here just mutates the set and repaints.
function canvasSelectDrawing(state, drawingId, opts) {
  const additive = !!(opts && opts.additive);
  if (!additive) {
    canvasClearSelection(state);
  } else if (state.selection.drawings.has(drawingId)) {
    state.selection.drawings.delete(drawingId);
    canvasRenderVectors(state);
    return;
  }
  state.selection.drawings.add(drawingId);
  canvasRenderVectors(state);
}

function canvasClearSelection(state) {
  if (!state.selection.items.size && !state.selection.drawings.size) return;
  state.selection.items.forEach((id) => {
    const entry = state.itemsById.get(id);
    if (entry) entry.el.classList.remove('selected');
  });
  const hadDrawingSelection = state.selection.drawings.size > 0;
  state.selection.items = new Set();
  state.selection.drawings = new Set();
  if (hadDrawingSelection) canvasRenderVectors(state); // repaint drops the selected-drawing halo
}

// Round 8 item 3: the single place that propagates a lesson (concept) rename
// everywhere the canvas shows its name — factored out of canvasOpenItem's
// note branch (the reader's title-edit `onRenamed`) so the new Files-sidebar
// rename pencil (canvasRenameNoteModal) can reuse the exact same fan-out
// instead of duplicating it. `name` is already persisted server-side
// (PATCH /concepts/:id — updates concepts.name + notes.title; the list/
// schedule/quiz read concepts.name live) by the time this runs.
function canvasApplyConceptRename(state, name) {
  if (state.concept) state.concept.name = name;
  if (state.note) state.note.title = name;
  const c = state.concepts && state.concepts.find((x) => x.id === state.conceptId);
  if (c) c.name = name;
  canvasRenderLessonControls(state);
  canvasRenderFileList(state);
  const noteItemId = state.note ? canvasFindItemIdByRef(state, 'note', state.note.id) : null;
  if (noteItemId && state.itemsById.has(noteItemId)) canvasRefreshItem(state, noteItemId);
  const titleEl = document.querySelector('.canvas-topbar-title');
  if (titleEl) titleEl.textContent = name;
  const rowLabel = document.querySelector(`.canvas-lesson-row[data-concept-id="${state.conceptId}"] .truncate`);
  if (rowLabel) rowLabel.textContent = name;
}

function canvasOpenItem(state, entry) {
  if (entry.refKind === 'note') {
    // The lesson note's title IS the concept name — editing it renames the whole
    // lesson (concept + note) everywhere (PATCH /concepts/:id updates concepts.name
    // + notes.title; the list/schedule/quiz read concepts.name live).
    openReader({
      id: entry.refObj.id,
      title: entry.refObj.title,
      has_thumb: entry.refObj.has_thumb,
      renameUrl: `/concepts/${state.conceptId}`,
      onRenamed: (name) => canvasApplyConceptRename(state, name),
    }, {
      conceptId: state.conceptId,
      conceptName: state.concept && state.concept.name,
      conceptSummary: state.concept && state.concept.summary,
      sourceItemId: entry.data.id,
    });
    return;
  }
  // Revision canvas item #0 — opens the reader on the exam's own compiled
  // revision PDF, now WITH Ask-AI (revision-canvas ask wiring, part 2):
  // askScope = {kind:'revision', id} routes every ask/pin/convo call on this
  // reader instance at POST /revisions/:id/ask instead of the concept ask.
  if (entry.refKind === 'revision-pdf') {
    const r = entry.refObj;
    if (r.status !== 'compiled') {
      ui.toast(r.status === 'failed' ? (r.error_message || 'Revision compile failed.') : 'Revision PDF is not ready yet.', 'error');
      return;
    }
    const vTok = r.token ? `?v=${encodeURIComponent(r.token)}` : '';
    openReader({
      id: r.id,
      title: r.title || 'Revision',
      pdfUrl: `/api/revisions/${r.id}/pdf${vTok}`,
      // No dedicated revision-note annotation endpoint exists (only the
      // per-dropped-file one, routers/revision_canvas.py) — this 404s
      // harmlessly, same as revisionReaderNote's pre-existing behavior.
      annGetUrl: `/revisions/${r.id}/annotations`,
      annPutUrl: `/revisions/${r.id}/annotations`,
    }, {
      askScope: { kind: 'revision', id: state.scope.id },
      conceptName: r.title || 'Revision', // sensible label — no concept summary to show for a revision
      sourceItemId: entry.data.id,
    });
    return;
  }
  if (entry.refKind === 'ai') { openAiConversation(entry); return; }
  const f = entry.refObj;
  if (f.kind === 'image') { canvasOpenLightbox(f, entry.data.id); return; }
  // Cache-bust the PDF URL the same way as the thumb/raw images above (a
  // reused canvas_files.id must not open the reader on a stale cached PDF);
  // annotation endpoints stay keyed by id only (no ?v=). mediaBase picks the
  // right endpoint root (canvas-files vs. revision-canvas-files) per scope.
  const mediaBase = canvasFileMediaBase(state);
  const pdfVTok = f.disk_uuid ? `?v=${encodeURIComponent(f.disk_uuid)}` : '';
  // Ask-AI is opt-in per openReader() call (hasAsk = !!opts.askScope/opts.conceptId).
  // Concept scope keeps passing conceptId exactly as before; a revision
  // canvas's dropped files now pass askScope = {kind:'revision', id} so they
  // open with Ask-AI hitting POST /revisions/:id/ask.
  const isConceptScope = !canvasIsRevisionScope(state);
  openReader({
    id: f.id,
    title: f.display_name,
    pdfUrl: `/api/${mediaBase}/${f.id}/pdf${pdfVTok}`,
    annGetUrl: `/${mediaBase}/${f.id}/annotations`,
    annPutUrl: `/${mediaBase}/${f.id}/annotations`,
    renameUrl: `/${mediaBase}/${f.id}`,
    onRenamed: (name) => {
      f.display_name = name;
      const inState = state.filesById.get(f.id);
      if (inState) inState.display_name = name;
      const itemId = canvasFindItemIdByRef(state, 'canvas-file', f.id);
      if (itemId) canvasRefreshItem(state, itemId);
      canvasRenderFileList(state);
    },
  }, isConceptScope ? {
    conceptId: state.conceptId,
    conceptName: state.concept && state.concept.name,
    conceptSummary: state.concept && state.concept.summary,
    sourceItemId: entry.data.id,
  } : {
    askScope: { kind: 'revision', id: state.scope.id },
    conceptName: state.revisionTitle || 'Revision',
    sourceItemId: entry.data.id,
  });
}

function canvasWireItemInteraction(state, itemId) {
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  const el = entry.el;

  el.addEventListener('pointerdown', (e) => {
    if (canvasState !== state) return;
    if (e.button !== 0 || state.spaceDown) return; // left-only item drag; space-drag pans instead
    if (e.target.closest('.canvas-item-close')) return; // owned by the delegated click handler (delete)
    // Phase 3: the connector tool picks items (click A, then B) instead of
    // dragging/opening them; every other drawing tool should draw straight
    // through an item (e.g. an arrow starting on top of a card), so just let
    // the pointerdown bubble up to the canvas-level draw handler untouched.
    if (state.tool === 'connector') {
      e.stopPropagation();
      canvasConnectorPick(state, itemId);
      return;
    }
    if (state.tool !== 'select') return;
    e.stopPropagation();

    // Selection Core: Shift-click ONLY toggles this item's membership in the
    // selection — it never starts a drag/resize/open, mirroring how a
    // marquee is built up with plain clicks before dragging any member. A
    // plain (non-Shift) click on an item that's already part of a live
    // multi-selection keeps that whole selection (so the drag below moves
    // everyone); a plain click on anything else makes this item the sole
    // selection, exactly like the original single-select.
    if (e.shiftKey) {
      canvasSelectItem(state, itemId, { additive: true });
      return;
    }
    const keepMulti = state.selection.items.has(itemId)
      && (state.selection.items.size > 1 || state.selection.drawings.size > 0);
    if (!keepMulti) canvasSelectItem(state, itemId);

    // Live lookup (not captured at wire-time): canvasRefreshItem() rebuilds
    // this element's innerHTML (upload finishing, a status poll, a rename),
    // which replaces the resize-handle node — a stale reference here would
    // silently break resizing on any item that's ever been refreshed.
    const handle = el.querySelector('.canvas-item-resize');
    const moveItemIds = Array.from(state.selection.items);
    const moveDrawingIds = Array.from(state.selection.drawings);
    const multi = moveItemIds.length > 1 || moveDrawingIds.length > 0;
    const isResize = !multi && e.target === handle; // resizing "a whole selection" isn't well-defined — single-item only
    const startClientX = e.clientX, startClientY = e.clientY;
    const start = { x: entry.data.x, y: entry.data.y, w: entry.data.w, h: entry.data.h };
    // Snapshot starting positions for every item/drawing being moved together
    // (a no-op single-entry map in the common single-select case).
    const itemStarts = new Map();
    moveItemIds.forEach((id) => {
      const en = state.itemsById.get(id);
      if (en) itemStarts.set(id, { x: en.data.x, y: en.data.y });
    });
    const drawingStarts = new Map();
    moveDrawingIds.forEach((did) => {
      const d = (state.drawings || []).find((dd) => dd.id === did);
      if (!d) return;
      if (d.type === 'line' || d.type === 'arrow') drawingStarts.set(did, { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2 });
      else if (d.type === 'pen') drawingStarts.set(did, { points: (d.points || []).map((p) => ({ x: p.x, y: p.y })) });
      else drawingStarts.set(did, { x: d.x, y: d.y });
    });
    let moved = false;
    let drawingsSnapshotted = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    // Round 10 Part 2 (pinch-zoom, CANVAS.md §14): tracked so a second touch
    // pointer landing mid-drag can force this gesture to end cleanly (see
    // canvasCancelActiveGesture) — every OTHER single-pointer gesture already
    // captures on state.scrollEl, which listens for 'pointercancel' itself;
    // item drag/resize is the one exception (it captures on the item's own
    // element instead), so it needs its own reference.
    state._activeItemDragEl = el;
    const onMove = (ev) => {
      const dxs = ev.clientX - startClientX, dys = ev.clientY - startClientY;
      if (Math.abs(dxs) > 3 || Math.abs(dys) > 3) moved = true;
      const dx = dxs / state.scale, dy = dys / state.scale;
      if (isResize) {
        entry.data.w = Math.max(140, start.w + dx);
        entry.data.h = Math.max(110, start.h + dy);
        el.style.width = entry.data.w + 'px';
        el.style.height = entry.data.h + 'px';
      } else {
        if (moved && drawingStarts.size && !drawingsSnapshotted) { canvasSnapshotHistory(state); drawingsSnapshotted = true; }
        itemStarts.forEach((st, id) => {
          const en = state.itemsById.get(id);
          if (!en) return;
          en.data.x = st.x + dx;
          en.data.y = st.y + dy;
          en.el.style.left = en.data.x + 'px';
          en.el.style.top = en.data.y + 'px';
        });
        if (drawingStarts.size) {
          drawingStarts.forEach((st, did) => {
            const d = (state.drawings || []).find((dd) => dd.id === did);
            if (!d) return;
            if (d.type === 'line' || d.type === 'arrow') { d.x1 = st.x1 + dx; d.y1 = st.y1 + dy; d.x2 = st.x2 + dx; d.y2 = st.y2 + dy; }
            else if (d.type === 'pen') { d.points = st.points.map((p) => ({ x: p.x + dx, y: p.y + dy })); }
            else { d.x = st.x + dx; d.y = st.y + dy; }
          });
          canvasRenderVectors(state);
        }
      }
      canvasUpdateConnectors(state); // Phase 3: keep any attached connector anchored live during drag/resize
    };
    const onUp = () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      if (state._activeItemDragEl === el) state._activeItemDragEl = null;
      if (moved) markCanvasDirty(state);
      else if (!multi && entry.clickable) canvasOpenItem(state, entry);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
  });
}

/* ---- "Pin to canvas" — turn a reader "Ask AI" conversation into a card on
   this lesson's board, connected by an arrow back to whatever item (the
   PDF/note the reader was opened from). Called from readerAskPinToCanvas
   when the student clicks the ask panel's single "📌 Pin to canvas" control.
   Round 6: pins the WHOLE conversation (opts.thread), not just one answer
   (supersedes Phase C's canvasPinAiAnswer(question, answer)). The thread
   lives directly in the item's ref (canvasItemRefData's 'ai' branch), so it
   persists via the ordinary canvasLayoutDoc/markCanvasDirty path — no new
   endpoint, no new client-side collection. ---- */
function canvasPinAiConversation(opts) {
  if (!canvasState) { ui.toast('Open this lesson’s canvas to pin a conversation', 'error'); return; }
  const state = canvasState;
  const sourceItemId = opts.sourceItemId;
  const src = sourceItemId ? state.itemsById.get(sourceItemId) : null;
  // Ask-AI scope generalization: callers may pass opts.askScope directly
  // (e.g. {kind:'revision', id}), or the older opts.conceptId shape — either
  // way this normalizes to one scope object stored on the ref, so a
  // continued/re-titled conversation keeps asking the right endpoint
  // (canvasAiConvoSend). conceptId is still stored alongside for legacy refs
  // saved before askScope existed.
  const askScope = opts.askScope || (opts.conceptId != null ? { kind: 'concept', id: opts.conceptId } : null);
  const conceptId = opts.conceptId != null ? opts.conceptId : (askScope && askScope.kind === 'concept' ? askScope.id : undefined);

  // Round 8 item 4: bumped from the original 300x190 — the redesigned card's
  // accent header + bigger title + CTA need more room to read comfortably.
  const w = 380, h = 340;
  let x, y;
  if (src) {
    x = src.data.x + src.data.w + 60;
    y = src.data.y;
  } else {
    const center = canvasViewportCenterWorld(state);
    x = center.x - w / 2;
    y = center.y - h / 2;
  }

  const item = {
    id: canvasNewItemId(),
    ref: {
      type: 'ai',
      title: opts.title || 'AI conversation',
      thread: opts.thread || [],
      conceptId: conceptId,
      // Revision-canvas ask wiring, part 2: the scope this conversation asks
      // against (askEndpointFor) — {kind:'concept', id} or {kind:'revision', id}.
      // A legacy ref saved before this field existed has only `conceptId`;
      // canvasAiConvoSend falls back to {kind:'concept', id: ref.conceptId}.
      askScope: askScope || undefined,
      // Round 7: grounding = the page-context this convo started from (for
      // continuity — canvasAiConvoSend); created_at = for the Files sidebar's
      // "Conversations" group (listing/sort). Both optional/backward-compat.
      grounding: opts.grounding || '',
      created_at: Date.now(),
      // Fix 1: the item this convo was pinned FROM, so the Files sidebar can
      // nest it under that file/note instead of a flat "Conversations" list.
      // Additive/backward-compat — a convo pinned before this field existed
      // just has null here; canvasRenderFileList falls back to the `from` of
      // the connector drawn just below for those.
      sourceItemId: opts.sourceItemId || null,
    },
    x, y, w, h,
    z: canvasNextZ(state),
  };
  canvasSnapshotHistory(state);
  canvasMountItem(state, item);

  if (src) {
    state.drawings.push({
      id: canvasNewDrawingId(),
      type: 'connector',
      color: CANVAS_CONNECTOR_COLOR,
      stroke: state.strokeWidth || CANVAS_STROKE_WIDTHS[0],
      from: sourceItemId,
      to: item.id,
    });
    canvasRenderVectors(state);
  }

  markCanvasDirty(state);
  canvasRenderFileList(state); // round 7: the new convo shows up in the sidebar's "Conversations" group immediately
  ui.toast('Pinned to canvas');
}

/* ---- AI conversation overlay (Build 9 round 6) ----
   Opened by clicking a pinned 'ai' card (canvasOpenItem). A single,
   body-mounted overlay (like the reader), but its own small stacking layer:
   above the canvas, below app modals — canvas.css puts it at z-index 65
   (reader 55 < pomodoro tray 60 < this 65 < auth gate 70 < modals 75 <
   toasts 80). Reads/writes the item's ref DIRECTLY (entry.data.ref, not the
   entry.refObj snapshot canvasItemRefData returns) so a continued
   conversation persists through the normal canvasLayoutDoc save path; a
   legacy round-5 {question,answer} ref is upgraded in place to the round-6
   {title,thread,conceptId} shape the first time it's opened. */
let aiConvoState = null; // { itemId, overlayEl, threadEl, inputEl, sendBtn, titleInput, controller, _keyHandler }

function canvasAiAppendTurn(threadEl, turn) {
  const wrap = document.createElement('div');
  wrap.className = 'canvas-ai-turn canvas-ai-turn-' + (turn.role === 'user' ? 'user' : 'assistant');
  if (turn.role === 'user') {
    // Round 7 Part 2: show what the question was actually anchored to — the
    // highlighted quote or the snip crop — above/with the question text.
    // Backward-compat: a turn with no snippet (or a typed follow-up) renders
    // exactly as before (just the escaped text).
    let snippetHtml = '';
    let mainText = turn.text || '';
    if (turn.snippet && turn.snippet.kind === 'image' && turn.snippet.dataUrl) {
      snippetHtml = `<img class="canvas-ai-snip" src="${turn.snippet.dataUrl}" alt="Snipped region" />`;
    } else if (turn.snippet && turn.snippet.kind === 'text' && turn.snippet.text) {
      const t = turn.snippet.text;
      const truncated = t.length > 280 ? t.slice(0, 280) + '…' : t;
      snippetHtml = `<blockquote class="canvas-ai-turn-snippet-quote">${esc(truncated)}</blockquote>`;
      if (mainText === turn.snippet.text) mainText = ''; // it's the same text — don't repeat it below the quote
    }
    wrap.innerHTML = `<div class="canvas-ai-turn-bubble canvas-ai-turn-bubble-user">${snippetHtml}${mainText ? esc(mainText) : ''}</div>`;
    threadEl.appendChild(wrap);
    return wrap;
  }
  wrap.innerHTML = '<div class="canvas-ai-turn-bubble canvas-ai-turn-bubble-assistant"></div>';
  threadEl.appendChild(wrap);
  renderRichText(wrap.querySelector('.canvas-ai-turn-bubble-assistant'), turn.text || '');
  return wrap;
}

function openAiConversation(entry) {
  if (!canvasState || !entry) return;
  closeAiConversation();
  const state = canvasState;
  const itemId = entry.data.id;

  // Upgrade a legacy round-5 {question,answer} ref to the round-6
  // {title,thread,conceptId} shape IN PLACE, once, so continuing the
  // conversation persists correctly (canvasLayoutDoc serializes entry.data.ref
  // verbatim — the normalized copy canvasItemRefData returns is not it).
  let ref = entry.data.ref;
  if (!Array.isArray(ref.thread)) {
    const normalized = canvasItemRefData(state, entry.data);
    ref = { type: 'ai', title: normalized.obj.title, thread: normalized.obj.thread.slice(), conceptId: normalized.obj.conceptId };
    entry.data.ref = ref;
    markCanvasDirty(state);
  }

  const overlay = document.createElement('div');
  overlay.className = 'canvas-ai-overlay';
  overlay.innerHTML = `
    <div class="canvas-ai-overlay-panel" role="dialog" aria-modal="true">
      <div class="canvas-ai-overlay-header">
        <span class="canvas-ai-overlay-icon">&#10024;</span>
        <input id="canvas-ai-title-input" class="canvas-ai-title-input" spellcheck="false" aria-label="Conversation title" value="${esc(ref.title || 'AI conversation')}" />
        <button type="button" data-action="canvas-ai-close" title="Close (Esc)" class="icon-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="canvas-ai-overlay-thread" id="canvas-ai-overlay-thread"></div>
      <div class="canvas-ai-overlay-composer">
        <textarea id="canvas-ai-overlay-input" class="canvas-ai-overlay-input" rows="1" placeholder="Continue this conversation…"></textarea>
        <button type="button" id="canvas-ai-overlay-send" class="btn btn-primary canvas-ai-overlay-send-btn">Send</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('canvas-ai-overlay-open'));

  const threadEl = overlay.querySelector('#canvas-ai-overlay-thread');
  const inputEl = overlay.querySelector('#canvas-ai-overlay-input');
  const sendBtn = overlay.querySelector('#canvas-ai-overlay-send');
  const titleInput = overlay.querySelector('#canvas-ai-title-input');

  aiConvoState = { itemId, overlayEl: overlay, threadEl, inputEl, sendBtn, titleInput, controller: null, _keyHandler: null };

  (ref.thread || []).forEach((turn) => canvasAiAppendTurn(threadEl, turn));
  threadEl.scrollTop = threadEl.scrollHeight;

  // Inline-renameable title — mirrors the reader's editable-title affordance
  // (Enter/blur commits, Escape reverts + stops it reaching the Escape-closes
  // handler below).
  let committingTitle = false;
  const commitTitle = () => {
    if (committingTitle) return;
    const entryNow = state.itemsById.get(itemId);
    if (!entryNow) return;
    const curRef = entryNow.data.ref;
    const name = (titleInput.value || '').trim();
    if (!name || name === curRef.title) { titleInput.value = curRef.title || 'AI conversation'; return; }
    committingTitle = true;
    curRef.title = name;
    canvasRefreshItem(state, itemId);
    canvasRenderFileList(state); // round 7: keep the sidebar's "Conversations" row name in sync
    markCanvasDirty(state);
    committingTitle = false;
  };
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitTitle(); titleInput.blur(); }
    else if (e.key === 'Escape') {
      e.stopPropagation();
      const entryNow = state.itemsById.get(itemId);
      titleInput.value = (entryNow && entryNow.data.ref.title) || 'AI conversation';
      titleInput.blur();
    }
  });
  titleInput.addEventListener('blur', commitTitle);

  const send = () => canvasAiConvoSend(state, itemId);
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });

  const onKeyDown = (e) => { if (e.key === 'Escape') closeAiConversation(); };
  document.addEventListener('keydown', onKeyDown);
  aiConvoState._keyHandler = onKeyDown;
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeAiConversation(); });
}

function closeAiConversation() {
  if (!aiConvoState) return;
  const st = aiConvoState;
  aiConvoState = null;
  if (st.controller) { try { st.controller.abort(); } catch (e) {} }
  if (st._keyHandler) document.removeEventListener('keydown', st._keyHandler);
  if (st.overlayEl) {
    st.overlayEl.classList.remove('canvas-ai-overlay-open');
    st.overlayEl.classList.add('canvas-ai-overlay-closing');
    setTimeout(() => { st.overlayEl.remove(); }, 200);
  }
}

// Continues the pinned conversation: streams a follow-up answer (grounded by
// a truncated digest of the prior thread, capped well under the backend's
// ~4000-char context limit), then persists both new turns onto the item's
// ref (so canvasRefreshItem's card preview / "N messages" stays current and
// the next debounced canvas save picks it up).
async function canvasAiConvoSend(state, itemId) {
  if (!aiConvoState || aiConvoState.itemId !== itemId) return;
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  const ref = entry.data.ref;
  const text = (aiConvoState.inputEl.value || '').trim();
  if (!text) return;
  aiConvoState.inputEl.value = '';
  if (aiConvoState.controller) { try { aiConvoState.controller.abort(); } catch (e) {} }
  const controller = new AbortController();
  aiConvoState.controller = controller;

  canvasAiAppendTurn(aiConvoState.threadEl, { role: 'user', text });
  const assistantWrap = document.createElement('div');
  assistantWrap.className = 'canvas-ai-turn canvas-ai-turn-assistant';
  assistantWrap.innerHTML = '<div class="canvas-ai-turn-bubble canvas-ai-turn-bubble-assistant"><span class="reader-ask-loading">Thinking…</span></div>';
  aiConvoState.threadEl.appendChild(assistantWrap);
  aiConvoState.threadEl.scrollTop = aiConvoState.threadEl.scrollHeight;
  const answerEl = assistantWrap.querySelector('.canvas-ai-turn-bubble-assistant');

  // Round 7 Part 1: prepend the convo's stored `grounding` (the lesson-page
  // text it started from) ahead of the prior-turns digest, so a reopened
  // conversation stays on-topic even with the reader long closed — while
  // keeping the combined context under the same ~3500-char budget as before.
  const digest = (ref.thread || [])
    .map((t) => (t.role === 'user' ? 'Q: ' : 'A: ') + (t.text || ''))
    .join('\n');
  let context;
  if (ref.grounding) {
    const groundingPart = ref.grounding + '\n\n';
    const budget = Math.max(0, 3500 - groundingPart.length);
    context = groundingPart + digest.slice(-budget);
  } else {
    context = digest.slice(-3500);
  }

  // Legacy refs (pinned before askScope existed) only have ref.conceptId —
  // fall back to wrapping it as a concept scope so they keep working.
  const askScope = ref.askScope || { kind: 'concept', id: ref.conceptId };

  let acc = '';
  try {
    const full = await api.stream(askEndpointFor(askScope), { question: text, context }, (delta) => {
      if (!aiConvoState || aiConvoState.controller !== controller) return; // superseded/closed mid-stream
      acc += delta;
      answerEl.textContent = acc;
      aiConvoState.threadEl.scrollTop = aiConvoState.threadEl.scrollHeight;
    }, { signal: controller.signal });
    if (!aiConvoState || aiConvoState.controller !== controller) return;
    const finalText = full || acc;
    renderRichText(answerEl, finalText);
    ref.thread = ref.thread || [];
    ref.thread.push({ role: 'user', text });
    ref.thread.push({ role: 'assistant', text: finalText });
    canvasRefreshItem(state, itemId);
    markCanvasDirty(state);
  } catch (err) {
    if (err && err.name === 'AbortError') return; // fired again / overlay closed — not a user-visible error
    if (!aiConvoState || aiConvoState.controller !== controller) return;
    answerEl.classList.add('reader-ask-error');
    answerEl.textContent = 'Could not get an answer: ' + (err && err.message ? err.message : 'unknown error');
  } finally {
    if (aiConvoState && aiConvoState.controller === controller) aiConvoState.controller = null;
  }
}

/* ---- image lightbox (Miro-style: always-visible inline image, click for a
   larger view). Mounted on document.body below the reader's z-55. Extended
   (round 7 Part 4) with an "Ask AI" / "Snip" toolbar so a raw dropped image
   (a diagram/figure with no PDF/text layer, so the reader's own snip can't
   reach it) can still be asked about — reusing the same multimodal
   /concepts/:id/ask endpoint + renderRichText + canvasPinAiConversation the
   reader's region-snip already uses (app.js ~2500-2605). ---- */

let canvasLightboxEl = null;
let canvasLightboxState = null; // { file, itemId, conceptId, overlayEl, stageEl, imgEl, panelEl, bodyEl,
                                 //   pinBarEl, pinBtnEl, composerEl, inputEl, controller, snipping,
                                 //   marqueeEl, thread }
                                 // thread (round 8 item 1): {role,text,snippet?}[] — the WHOLE image
                                 // conversation so far (mirrors the reader ask panel's ask.turns /
                                 // the pinned-convo overlay's ref.thread), so Ask/Snip can be
                                 // continued via a composer instead of only ever producing one Q/A.

const CANVAS_LIGHTBOX_SNIP_MIN_PX = 8;        // ignore an accidental click / tiny drag
const CANVAS_LIGHTBOX_ASK_MAX_OUTPUT = 1600;  // cap the long side (px) of any image sent to /ask

function canvasCloseLightbox() {
  if (!canvasLightboxEl) return;
  if (canvasLightboxState && canvasLightboxState.controller) {
    try { canvasLightboxState.controller.abort(); } catch (e) { /* ignore */ }
  }
  canvasLightboxEl.remove();
  canvasLightboxEl = null;
  canvasLightboxState = null;
  document.removeEventListener('keydown', canvasLightboxKeyHandler);
}

function canvasLightboxKeyHandler(e) {
  if (e.key === 'Escape') canvasCloseLightbox();
}

// `itemId` is the image's canvas item id (its board position) — passed by
// canvasOpenItem so a pinned conversation can draw a connector back to it.
function canvasOpenLightbox(file, itemId) {
  canvasCloseLightbox();
  const conceptId = canvasState && canvasState.conceptId;
  // Ask-AI scope (concept or revision) this lightbox's image belongs to —
  // captured at open time, same as conceptId above (canvasState.scope always
  // exists for either board — see renderCanvasView/renderRevisionCanvasView).
  const scope = canvasState && canvasState.scope;
  const mediaBase = canvasFileMediaBase(canvasState);
  const overlay = document.createElement('div');
  overlay.className = 'canvas-lightbox';
  overlay.innerHTML = `
    <div class="canvas-lightbox-toolbar">
      <button type="button" data-action="canvas-lightbox-ask" title="Ask AI about this image" class="btn btn-secondary canvas-lightbox-tool-btn">&#10024; Ask</button>
      <button type="button" data-action="canvas-lightbox-snip" title="Snip a region to ask about" class="btn btn-secondary canvas-lightbox-tool-btn">Snip</button>
    </div>
    <button data-action="canvas-lightbox-close" title="Close (Esc)" class="icon-btn canvas-lightbox-close-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
    </button>
    <div class="canvas-lightbox-stage" id="canvas-lightbox-stage">
      <img src="/api/${mediaBase}/${file.id}/raw${file.disk_uuid ? `?v=${encodeURIComponent(file.disk_uuid)}` : ''}" alt="${esc(file.display_name)}" class="canvas-lightbox-img" id="canvas-lightbox-img">
    </div>
    <div class="canvas-lightbox-answer-panel" id="canvas-lightbox-answer-panel" hidden>
      <div class="canvas-lightbox-answer-header">
        <span class="canvas-lightbox-answer-title">&#10024; Ask AI</span>
        <button type="button" data-action="canvas-lightbox-answer-close" title="Close" class="icon-btn">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="canvas-lightbox-answer-body" id="canvas-lightbox-answer-body"></div>
      <div class="reader-ask-pin-bar" id="canvas-lightbox-pin-bar" hidden>
        <button type="button" id="canvas-lightbox-pin-btn" data-action="canvas-lightbox-pin" class="reader-ask-pin-btn">📌 Pin to canvas</button>
      </div>
      <div class="reader-ask-composer" id="canvas-lightbox-composer" hidden>
        <textarea id="canvas-lightbox-input" class="reader-ask-input" rows="1" placeholder="Ask a follow-up…"></textarea>
        <button type="button" data-action="canvas-lightbox-send" class="btn btn-primary reader-ask-send-btn">Send</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) canvasCloseLightbox(); });
  document.addEventListener('keydown', canvasLightboxKeyHandler);
  canvasLightboxEl = overlay;

  const state = {
    file, itemId, conceptId, scope,
    overlayEl: overlay,
    stageEl: overlay.querySelector('#canvas-lightbox-stage'),
    imgEl: overlay.querySelector('#canvas-lightbox-img'),
    panelEl: overlay.querySelector('#canvas-lightbox-answer-panel'),
    bodyEl: overlay.querySelector('#canvas-lightbox-answer-body'),
    pinBarEl: overlay.querySelector('#canvas-lightbox-pin-bar'),
    pinBtnEl: overlay.querySelector('#canvas-lightbox-pin-btn'),
    composerEl: overlay.querySelector('#canvas-lightbox-composer'),
    inputEl: overlay.querySelector('#canvas-lightbox-input'),
    controller: null,
    snipping: false,
    marqueeEl: null,
    thread: [], // round 8 item 1: the whole image conversation so far (see the state comment above)
  };
  canvasLightboxState = state;
  state.stageEl.addEventListener('pointerdown', (e) => canvasLightboxSnipPointerDown(state, e));
  // Round 8 item 1: Enter sends the follow-up, Shift+Enter inserts a newline
  // (mirrors the reader ask panel's composer, readerBuildAskUi).
  state.inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); canvasLightboxSendFollowUp(state); }
  });
}

// Draws the <img> (same-origin — /api/canvas-files/:id/raw — so the canvas is
// never tainted) to an offscreen canvas at its natural size (capped), for a
// WHOLE-image ask.
function canvasLightboxAskWhole(state) {
  if (!state) return;
  const img = state.imgEl;
  if (!img || !img.naturalWidth) { ui.toast('Image not loaded yet', 'error'); return; }
  const longSide = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longSide > CANVAS_LIGHTBOX_ASK_MAX_OUTPUT ? CANVAS_LIGHTBOX_ASK_MAX_OUTPUT / longSide : 1;
  const outW = Math.max(1, Math.round(img.naturalWidth * scale));
  const outH = Math.max(1, Math.round(img.naturalHeight * scale));
  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  let dataUrl;
  try {
    off.getContext('2d').drawImage(img, 0, 0, outW, outH);
    dataUrl = off.toDataURL('image/png');
  } catch (e) {
    ui.toast('Could not read this image', 'error');
    return;
  }
  canvasLightboxFireAsk(state, dataUrl, 'Explain this image');
}

function canvasLightboxToggleSnip(state) {
  if (!state) return;
  if (state.snipping) { canvasLightboxCancelSnip(state); return; }
  state.snipping = true;
  state.overlayEl.classList.add('canvas-lightbox-snipping');
  const btn = state.overlayEl.querySelector('[data-action="canvas-lightbox-snip"]');
  if (btn) btn.classList.add('canvas-lightbox-tool-btn-active');
}

function canvasLightboxCancelSnip(state) {
  if (!state) return;
  state.snipping = false;
  state.overlayEl.classList.remove('canvas-lightbox-snipping');
  const btn = state.overlayEl.querySelector('[data-action="canvas-lightbox-snip"]');
  if (btn) btn.classList.remove('canvas-lightbox-tool-btn-active');
  if (state.marqueeEl) { state.marqueeEl.remove(); state.marqueeEl = null; }
}

// Delegated on the stage; a no-op unless snip mode is active. Mirrors the
// reader's readerSnipPointerDown (marquee drag + pointer capture) — see
// app.js ~2528.
function canvasLightboxSnipPointerDown(state, e) {
  if (!state.snipping) return;
  const img = state.imgEl;
  if (!img) return;
  e.preventDefault();
  const imgRect = img.getBoundingClientRect();
  const stageRect = state.stageEl.getBoundingClientRect();
  const marquee = document.createElement('div');
  marquee.className = 'reader-snip-marquee canvas-lightbox-snip-marquee';
  state.stageEl.appendChild(marquee);
  state.marqueeEl = marquee;
  const start = { x: e.clientX, y: e.clientY };
  const clampRect = (curX, curY) => {
    const x0 = Math.max(imgRect.left, Math.min(start.x, curX));
    const x1 = Math.min(imgRect.right, Math.max(start.x, curX));
    const y0 = Math.max(imgRect.top, Math.min(start.y, curY));
    const y1 = Math.min(imgRect.bottom, Math.max(start.y, curY));
    return { x0, y0, x1, y1 };
  };
  const paint = (r) => {
    marquee.style.left = (r.x0 - stageRect.left) + 'px';
    marquee.style.top = (r.y0 - stageRect.top) + 'px';
    marquee.style.width = Math.max(0, r.x1 - r.x0) + 'px';
    marquee.style.height = Math.max(0, r.y1 - r.y0) + 'px';
  };
  let last = clampRect(e.clientX, e.clientY);
  paint(last);
  const stage = state.stageEl;
  try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const onMove = (ev) => { last = clampRect(ev.clientX, ev.clientY); paint(last); };
  const cleanup = () => {
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerup', onUp);
    stage.removeEventListener('pointercancel', onCancel);
  };
  const onUp = () => { cleanup(); if (canvasLightboxState === state) canvasLightboxFinishSnip(state, imgRect, last); };
  const onCancel = () => { cleanup(); if (canvasLightboxState === state) canvasLightboxCancelSnip(state); };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerup', onUp);
  stage.addEventListener('pointercancel', onCancel);
}

// Maps the marquee (viewport px, relative to the <img> element's rendered
// box) to the image's NATURAL pixels. Today the <img> has only
// max-width/max-height (no fixed box), so its rendered box already equals its
// content box with no letterboxing — but this still computes the
// object-fit:contain content rect from naturalWidth/Height vs the element's
// own client box (the general case), so the mapping stays correct even if
// that ever changes (e.g. a fixed-size lightbox stage later).
function canvasLightboxFinishSnip(state, imgRect, rect) {
  const w = rect.x1 - rect.x0, h = rect.y1 - rect.y0;
  canvasLightboxCancelSnip(state); // always exit snip mode + remove the marquee, whatever the outcome
  if (w < CANVAS_LIGHTBOX_SNIP_MIN_PX || h < CANVAS_LIGHTBOX_SNIP_MIN_PX) return; // accidental click/tiny drag
  const img = state.imgEl;
  if (!img || !img.naturalWidth) return;
  const boxW = imgRect.width, boxH = imgRect.height;
  const natW = img.naturalWidth, natH = img.naturalHeight;
  if (!boxW || !boxH) return;
  const boxRatio = boxW / boxH, natRatio = natW / natH;
  let contentW, contentH, contentLeft, contentTop;
  if (natRatio > boxRatio) {
    // the natural image is relatively wider than its box -> letterboxed top/bottom
    contentW = boxW;
    contentH = boxW / natRatio;
    contentLeft = imgRect.left;
    contentTop = imgRect.top + (boxH - contentH) / 2;
  } else {
    // the natural image is relatively taller -> letterboxed left/right
    contentH = boxH;
    contentW = boxH * natRatio;
    contentTop = imgRect.top;
    contentLeft = imgRect.left + (boxW - contentW) / 2;
  }
  const fracX = contentW ? (rect.x0 - contentLeft) / contentW : 0;
  const fracY = contentH ? (rect.y0 - contentTop) / contentH : 0;
  const fracW = contentW ? w / contentW : 0;
  const fracH = contentH ? h / contentH : 0;
  const sx = Math.max(0, Math.round(fracX * natW));
  const sy = Math.max(0, Math.round(fracY * natH));
  const sw = Math.max(1, Math.min(natW - sx, Math.round(fracW * natW)));
  const sh = Math.max(1, Math.min(natH - sy, Math.round(fracH * natH)));
  const longSide = Math.max(sw, sh);
  const outScale = longSide > CANVAS_LIGHTBOX_ASK_MAX_OUTPUT ? CANVAS_LIGHTBOX_ASK_MAX_OUTPUT / longSide : 1;
  const outW = Math.max(1, Math.round(sw * outScale));
  const outH = Math.max(1, Math.round(sh * outScale));
  const off = document.createElement('canvas');
  off.width = outW; off.height = outH;
  let dataUrl;
  try {
    off.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
    dataUrl = off.toDataURL('image/png');
  } catch (e) {
    ui.toast('Could not read this image', 'error');
    return;
  }
  // Round 10 Part 2 (CANVAS.md §14): stash for a later canvas paste too, same
  // as the reader's readerFinishSnip — Ask-AI below is unchanged.
  canvasClipboard = { kind: 'image', dataUrl };
  canvasLightboxFireAsk(state, dataUrl, 'Explain this region');
}

// Streams an answer for a whole-image or snipped-region ask into the
// lightbox's compact answer panel — reuses api.stream + renderRichText (the
// same plumbing as the reader's ask panel, app.js ~2805 readerAskFire). Only
// one ask streams at a time here: a new one aborts whatever's in flight.
// Round 8 item 1: this is always the FIRST turn of a fresh topic (fired from
// the "Ask"/"Snip" toolbar buttons, never from the composer) — it resets
// state.thread and rebuilds the answer body from scratch, then reveals the
// composer so the topic can be continued via canvasLightboxSendFollowUp.
async function canvasLightboxFireAsk(state, dataUrl, userText) {
  if (!state || canvasLightboxState !== state) return;
  // Ask-AI scope: concept-scope boards ground on the concept, revision-scope
  // boards on the exam revision — derived from the scope captured at open
  // time (canvasOpenLightbox reads it off canvasState.scope). This is the
  // single choke point both the whole-image "Ask" button and the "Snip" flow
  // converge on.
  const askScope = state.scope;
  if (!askScope) { ui.toast('Ask AI isn’t available here.', 'error'); return; }
  if (state.controller) { try { state.controller.abort(); } catch (e) { /* ignore */ } }
  const controller = new AbortController();
  state.controller = controller;

  state.thread = [];
  state.panelEl.hidden = false;
  state.pinBarEl.hidden = true;
  if (state.composerEl) state.composerEl.hidden = true;
  state.bodyEl.innerHTML = `
    <div class="reader-ask-bubble reader-ask-bubble-q">${esc(userText)}</div>
    <div class="reader-ask-bubble reader-ask-bubble-a"><span class="reader-ask-loading">Thinking&hellip;</span></div>`;
  const answerEl = state.bodyEl.querySelector('.reader-ask-bubble-a');

  const context = (canvasState && canvasState.concept && canvasState.concept.summary) || '';
  const body = { image: dataUrl };
  if (context) body.context = context;

  let acc = '';
  try {
    const full = await api.stream(askEndpointFor(askScope), body, (delta) => {
      if (canvasLightboxState !== state || state.controller !== controller) return; // superseded/closed mid-stream
      acc += delta;
      answerEl.textContent = acc;
    }, { signal: controller.signal });
    if (canvasLightboxState !== state || state.controller !== controller) return;
    const finalText = full || acc;
    renderRichText(answerEl, finalText);
    state.thread = [
      { role: 'user', text: userText, snippet: { kind: 'image', dataUrl } },
      { role: 'assistant', text: finalText },
    ];
    state.pinBarEl.hidden = false;
    if (state.pinBtnEl) { state.pinBtnEl.disabled = false; state.pinBtnEl.textContent = '📌 Pin to canvas'; }
    if (state.composerEl) state.composerEl.hidden = false;
  } catch (err) {
    if (err && err.name === 'AbortError') return; // fired again / lightbox closed — not a user-visible error
    if (canvasLightboxState !== state || state.controller !== controller) return;
    answerEl.classList.add('reader-ask-error');
    answerEl.textContent = 'Could not get an answer: ' + (err && err.message ? err.message : 'unknown error');
  } finally {
    if (state.controller === controller) state.controller = null;
  }
}

// Round 8 item 1: continues the image conversation from the composer — mirrors
// canvasAiConvoSend's follow-up shape (a truncated digest of the thread so
// far as `context`, no new image upload). Appends both turns to state.thread
// once the answer settles so the eventual "Pin to canvas" (canvasLightboxPin)
// carries the WHOLE conversation, not just the first Q/A.
async function canvasLightboxSendFollowUp(state) {
  if (!state || canvasLightboxState !== state || !state.inputEl) return;
  const text = (state.inputEl.value || '').trim();
  if (!text) { state.inputEl.focus(); return; }
  state.inputEl.value = '';
  if (state.controller) { try { state.controller.abort(); } catch (e) { /* ignore */ } }
  const controller = new AbortController();
  state.controller = controller;

  const qEl = document.createElement('div');
  qEl.className = 'reader-ask-bubble reader-ask-bubble-q';
  qEl.textContent = text;
  state.bodyEl.appendChild(qEl);
  const aEl = document.createElement('div');
  aEl.className = 'reader-ask-bubble reader-ask-bubble-a';
  aEl.innerHTML = '<span class="reader-ask-loading">Thinking&hellip;</span>';
  state.bodyEl.appendChild(aEl);
  state.bodyEl.scrollTop = state.bodyEl.scrollHeight;

  // Digest of the conversation so far — same ~3500-char budget as
  // canvasAiConvoSend's continuation of a pinned conversation.
  const digest = (state.thread || [])
    .map((t) => (t.role === 'user' ? 'Q: ' : 'A: ') + (t.text || ''))
    .join('\n');
  const context = digest.slice(-3500);

  let acc = '';
  try {
    const full = await api.stream(askEndpointFor(state.scope), { question: text, context }, (delta) => {
      if (canvasLightboxState !== state || state.controller !== controller) return;
      acc += delta;
      aEl.textContent = acc;
      state.bodyEl.scrollTop = state.bodyEl.scrollHeight;
    }, { signal: controller.signal });
    if (canvasLightboxState !== state || state.controller !== controller) return;
    const finalText = full || acc;
    renderRichText(aEl, finalText);
    state.thread = state.thread || [];
    state.thread.push({ role: 'user', text });
    state.thread.push({ role: 'assistant', text: finalText });
    state.pinBarEl.hidden = false;
    if (state.pinBtnEl) { state.pinBtnEl.disabled = false; state.pinBtnEl.textContent = '📌 Pin to canvas'; }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    if (canvasLightboxState !== state || state.controller !== controller) return;
    aEl.classList.add('reader-ask-error');
    aEl.textContent = 'Could not get an answer: ' + (err && err.message ? err.message : 'unknown error');
  } finally {
    if (state.controller === controller) state.controller = null;
  }
}

function canvasLightboxCloseAnswerPanel(state) {
  if (!state) return;
  if (state.controller) { try { state.controller.abort(); } catch (e) { /* ignore */ } state.controller = null; }
  state.panelEl.hidden = true;
}

// Derives a title from the dropped image's own filename — no extra AI call
// just to name the pin (per the round-7 spec: "Title without an extra AI call").
function canvasLightboxTitleFromFileName(displayName) {
  const name = (displayName || '').trim();
  if (!name) return 'Image question';
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  return base.trim() || 'Image question';
}

// Round 8 item 1: pins the WHOLE image conversation (every turn accumulated
// via Ask/Snip + any composer follow-ups), not just the first answer.
function canvasLightboxPin(state) {
  if (!state || !state.thread || !state.thread.length) return;
  if (!canvasState) { ui.toast('Open this lesson’s canvas to pin a conversation', 'error'); return; }
  const btn = state.pinBtnEl;
  if (btn) { if (btn.disabled) return; btn.disabled = true; btn.textContent = 'Pinning…'; }
  const title = canvasLightboxTitleFromFileName(state.file && state.file.display_name);
  canvasPinAiConversation({ title, thread: state.thread.slice(), askScope: state.scope, sourceItemId: state.itemId, grounding: '', created_at: Date.now() });
  if (btn) { btn.disabled = false; btn.textContent = '📌 Pin to canvas'; }
}

/* ---- drag-drop / "+ Add file" upload + convert-status polling (Phase 2b §1) ----
   A placeholder item mounts immediately (ref.type:'uploading') so the drop
   feels instant; once POST resolves we swap its ref to the real canvas-file
   id and — for docx/pptx — poll the board until status leaves 'converting'. */

function canvasViewportCenterWorld(state) {
  const rect = state.scrollEl.getBoundingClientRect();
  return canvasScreenToWorld(state, rect.width / 2, rect.height / 2);
}

async function canvasUploadFile(state, file, worldX, worldY) {
  const itemId = canvasNewItemId();
  const item = {
    id: itemId,
    ref: { type: 'uploading', name: file.name, phase: 'uploading' },
    x: Math.round(worldX), y: Math.round(worldY), w: 360, h: 480,
    z: canvasNextZ(state),
  };
  canvasMountItem(state, item);

  const fd = new FormData();
  fd.append('file', file);
  let row;
  try {
    row = await api.upload(`${canvasLayoutApiBase(state)}/canvas/files`, fd);
  } catch (e) {
    if (canvasState !== state) return; // canvas closed while uploading — nothing left to update
    const entry = state.itemsById.get(itemId);
    if (entry) {
      entry.data.ref = { type: 'uploading', name: file.name, phase: 'failed', error: e.message };
      canvasRefreshItem(state, itemId);
    }
    ui.toast(`${file.name}: ${e.message || 'Upload failed'}`, 'error');
    return;
  }
  if (canvasState !== state) return; // canvas closed mid-upload — the file is saved server-side either way

  state.filesById.set(row.id, row);
  const existingIdx = state.files.findIndex((f) => f.id === row.id);
  if (existingIdx === -1) state.files.push(row); else state.files[existingIdx] = row;

  const entry = state.itemsById.get(itemId);
  if (entry) {
    entry.data.ref = { type: 'canvas-file', id: row.id };
    canvasRefreshItem(state, itemId);
  }
  markCanvasDirty(state); // now safe to persist — the item's ref points at a real row
  canvasRenderFileList(state);

  if (row.status === 'converting') canvasPollFile(state, row.id, itemId);
}

// Polls the board's file list until this file's status leaves 'converting'
// (→ 'ready' flips it to a real thumbnail card; → 'failed' shows the reason).
// Stops itself if the canvas is closed/switched, the item was deleted, or the
// attempt cap is hit (a stuck LibreOffice conversion shouldn't poll forever).
function canvasPollFile(state, fileId, itemId, attempt = 0) {
  setTimeout(async () => {
    if (canvasState !== state) return;
    if (!state.itemsById.has(itemId)) return; // item removed (deleted) while converting
    let data;
    try {
      data = await api.get(`${canvasLayoutApiBase(state)}/canvas`);
    } catch (e) {
      // transient failure — keep trying up to the attempt cap rather than
      // giving up on a single blip
      if (attempt + 1 < CANVAS_POLL_MAX_ATTEMPTS) canvasPollFile(state, fileId, itemId, attempt + 1);
      return;
    }
    if (canvasState !== state) return;
    const file = (data.files || []).find((f) => f.id === fileId);
    if (!file) return; // deleted server-side elsewhere — stop quietly
    state.filesById.set(fileId, file);
    const idx = state.files.findIndex((f) => f.id === fileId);
    if (idx !== -1) state.files[idx] = file;

    if (file.status === 'converting') {
      if (attempt + 1 >= CANVAS_POLL_MAX_ATTEMPTS) {
        ui.toast(`${file.display_name}: still converting — check back later.`, 'error');
        return;
      }
      canvasPollFile(state, fileId, itemId, attempt + 1);
      return;
    }
    // ready or failed — repaint the item + sidebar row once, then stop
    if (state.itemsById.has(itemId)) canvasRefreshItem(state, itemId);
    canvasRenderFileList(state);
    markCanvasDirty(state);
    if (file.status === 'failed') ui.toast(`${file.display_name}: ${file.error_message || 'Conversion failed'}`, 'error');
  }, CANVAS_POLL_INTERVAL_MS);
}

function canvasHandleFileInputChange(state, fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  const center = canvasViewportCenterWorld(state);
  files.forEach((f, i) => canvasUploadFile(state, f, center.x - 180 + i * 24, center.y - 130 + i * 24));
}

function canvasWireDropUpload(state) {
  const scrollEl = state.scrollEl;
  // G9: an enter/leave DEPTH COUNTER instead of an exact-target dragleave
  // check — dragging over nested children (item cards, drawings) fires a
  // dragleave/dragenter pair on each child boundary crossing, which made the
  // old exact-target check flicker the highlight on/off. The highlight only
  // toggles when the counter actually reaches/leaves zero.
  let dragDepth = 0;
  const onDragEnter = (e) => {
    if (canvasState !== state) return;
    e.preventDefault();
    dragDepth++;
    scrollEl.classList.add('canvas-drop-hint');
  };
  const onDragOver = (e) => {
    if (canvasState !== state) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (e) => {
    if (canvasState !== state) return;
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) scrollEl.classList.remove('canvas-drop-hint');
  };
  const onDrop = (e) => {
    if (canvasState !== state) return;
    e.preventDefault();
    dragDepth = 0;
    scrollEl.classList.remove('canvas-drop-hint');
    const files = e.dataTransfer && e.dataTransfer.files ? Array.from(e.dataTransfer.files) : [];
    if (!files.length) return;
    const rect = scrollEl.getBoundingClientRect();
    files.forEach((f, i) => {
      const world = canvasScreenToWorld(state, e.clientX - rect.left + i * 24, e.clientY - rect.top + i * 24);
      canvasUploadFile(state, f, world.x - 180, world.y - 130);
    });
  };
  scrollEl.addEventListener('dragenter', onDragEnter);
  scrollEl.addEventListener('dragover', onDragOver);
  scrollEl.addEventListener('dragleave', onDragLeave);
  scrollEl.addEventListener('drop', onDrop);
  return () => {
    scrollEl.removeEventListener('dragenter', onDragEnter);
    scrollEl.removeEventListener('dragover', onDragOver);
    scrollEl.removeEventListener('dragleave', onDragLeave);
    scrollEl.removeEventListener('drop', onDrop);
  };
}

/* ---- file-container actions: smooth-pan / rename / delete (Phase 2b §2/§3) ---- */

function canvasAnimatePan(state, targetTx, targetTy) {
  if (state._panRaf) cancelAnimationFrame(state._panRaf);
  const startTx = state.tx, startTy = state.ty, t0 = performance.now(), dur = 320;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    if (canvasState !== state) return;
    const k = easeOutCubic(Math.min(1, (now - t0) / dur));
    state.tx = startTx + (targetTx - startTx) * k;
    state.ty = startTy + (targetTy - startTy) * k;
    canvasApplyTransform(state);
    if (k < 1) { state._panRaf = requestAnimationFrame(step); return; }
    state._panRaf = null;
    markCanvasDirty(state);
  };
  state._panRaf = requestAnimationFrame(step);
}

// Figma-style "click a file → center it": pans (keeping the current zoom) so
// the item's center lands in the middle of the viewport, and selects it.
function canvasPanToItem(state, itemId) {
  const entry = itemId ? state.itemsById.get(itemId) : null;
  if (!entry) { ui.toast('Not placed on the canvas yet', 'error'); return; }
  const rect = state.scrollEl.getBoundingClientRect();
  const cx = entry.data.x + entry.data.w / 2, cy = entry.data.y + entry.data.h / 2;
  canvasSelectItem(state, itemId);
  canvasAnimatePan(state, rect.width / 2 - cx * state.scale, rect.height / 2 - cy * state.scale);
}

// Fix 2 (global search → canvas text/sticky): same "center it" pan as
// canvasPanToItem, but for a whiteboard DRAWING (text-box/sticky) rather than
// a placed item — mirrors it exactly, just resolving world bounds via
// canvasDrawingBounds instead of an item's {x,y,w,h}. Briefly flashes the
// drawing's SVG node (a plain inline-style toggle, no new CSS) so the pan
// destination is unambiguous.
function canvasPanToDrawing(state, drawingId) {
  const d = drawingId != null ? (state.drawings || []).find((x) => x.id === drawingId) : null;
  if (!d) { ui.toast('Not on this canvas', 'error'); return; }
  const bounds = canvasDrawingBounds(d);
  if (!bounds) { ui.toast('Not on this canvas', 'error'); return; }
  const rect = state.scrollEl.getBoundingClientRect();
  const cx = bounds.x + bounds.w / 2, cy = bounds.y + bounds.h / 2;
  canvasAnimatePan(state, rect.width / 2 - cx * state.scale, rect.height / 2 - cy * state.scale);
  const node = state.vectorNodes && state.vectorNodes.get(drawingId);
  if (node) {
    const prevFilter = node.style.filter;
    node.style.filter = 'drop-shadow(0 0 0 transparent)';
    requestAnimationFrame(() => {
      node.style.transition = 'filter .25s ease';
      node.style.filter = 'drop-shadow(0 0 10px var(--primary, #7A5AF8))';
      setTimeout(() => {
        node.style.filter = prevFilter || '';
        setTimeout(() => { node.style.transition = ''; }, 260);
      }, 1200);
    });
  }
}

// Round 8 item 3: rename the lesson's own note (item #0) from the Files
// sidebar's rename pencil — same endpoint/field the reader's title-edit uses
// (PATCH /concepts/:id, {display_name}), then fans the new name out via the
// shared canvasApplyConceptRename (also used by the reader's onRenamed).
function canvasRenameNoteModal(state) {
  if (!state.concept) return;
  const current = (state.note && state.note.title) || state.concept.name || 'Note';
  ui.formModal({
    title: 'Rename lesson',
    submitLabel: 'Save',
    bodyHtml: field('Name', `<input id="f-canvas-rename-note" class="${inputCls}" value="${esc(current)}" />`),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-canvas-rename-note').value.trim();
      if (!name) throw new Error('Please enter a name.');
      await api.patch(`/concepts/${state.conceptId}`, { display_name: name });
      if (canvasState !== state) return;
      canvasApplyConceptRename(state, name);
      ui.toast('Renamed');
    },
  });
}

function canvasRenameFileModal(state, fileId) {
  const file = state.filesById.get(Number(fileId));
  if (!file) return;
  ui.formModal({
    title: 'Rename file',
    submitLabel: 'Save',
    bodyHtml: field('Name', `<input id="f-canvas-rename" class="${inputCls}" value="${esc(file.display_name)}" />`),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-canvas-rename').value.trim();
      if (!name) throw new Error('Please enter a name.');
      const updated = await api.patch(`/${canvasFileMediaBase(state)}/${file.id}`, { display_name: name });
      if (canvasState !== state) return;
      state.filesById.set(updated.id, updated);
      const idx = state.files.findIndex((f) => f.id === updated.id);
      if (idx !== -1) state.files[idx] = updated;
      const itemId = canvasFindItemIdByRef(state, 'canvas-file', updated.id);
      if (itemId) canvasRefreshItem(state, itemId);
      canvasRenderFileList(state);
      ui.toast('Renamed');
    },
  });
}

// Shared delete core for both entry points (on-canvas ✕ and the sidebar row's
// delete control) — confirms, calls the API, then removes the item (if any)
// and the sidebar row.
function canvasConfirmDeleteFile(state, file, itemId) {
  ui.confirmModal({
    title: 'Remove file?',
    message: `This removes "${file.display_name}" from this lesson's canvas. This can't be undone.`,
    confirmLabel: 'Remove',
    onConfirm: async () => {
      await api.del(`/${canvasFileMediaBase(state)}/${file.id}`);
      if (canvasState !== state) return;
      state.filesById.delete(file.id);
      state.files = state.files.filter((f) => f.id !== file.id);
      if (itemId) canvasRemoveItemFromDom(state, itemId);
      markCanvasDirty(state);
      canvasRenderFileList(state);
      ui.toast('File removed');
    },
  });
}

// Delete via the on-canvas item (✕ button or Delete/Backspace on selection).
// The note (item #0) is never deletable from here — CANVAS.md §2/Phase 2b §3.
// An 'uploading' placeholder has no server-side row yet, so it's just a local
// removal (no confirm needed — nothing durable to lose). Same for Phase C's
// 'ai' cards: the answer lives only in this lesson's canvas_layout row (never
// its own canvas_files row — canvasItemRefData's 'ai' branch), so there's no
// DELETE endpoint to call; canvasRemoveItemFromDom already drops its connector
// and the next markCanvasDirty save simply omits it. Without this branch it
// would fall through to canvasConfirmDeleteFile, which assumes every item has
// a canvas_files row (file.id/file.display_name) and would 404.
function canvasRequestDeleteItem(state, itemId) {
  const entry = state.itemsById.get(itemId);
  if (!entry) return;
  if (entry.refKind === 'note' || entry.refKind === 'revision-pdf') return;
  if (entry.refKind === 'uploading') {
    // A transient upload placeholder — remove silently (no confirm).
    canvasRemoveItemFromDom(state, itemId);
    markCanvasDirty(state);
    canvasRenderFileList(state);
    return;
  }
  if (entry.refKind === 'ai') {
    // B8: a pinned AI conversation can hold real, unrecoverable work (its
    // thread lives only in the layout JSON) — confirm before dropping it,
    // matching how file cards confirm.
    ui.confirmModal({
      title: 'Delete conversation?',
      message: 'This removes the pinned AI conversation from the canvas. This can’t be undone.',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        canvasRemoveItemFromDom(state, itemId);
        markCanvasDirty(state);
        // Round 7: an 'ai' item may also be listed in the Files sidebar's
        // "Conversations" group — keep the list in sync.
        canvasRenderFileList(state);
      },
    });
    return;
  }
  canvasConfirmDeleteFile(state, entry.refObj, itemId);
}

// Delete via the file-container sidebar row's delete control (has a fileId,
// which may or may not currently have a placed item — either way it's deletable).
function canvasRequestDeleteFile(state, fileId) {
  const file = state.filesById.get(Number(fileId));
  if (!file) return;
  canvasConfirmDeleteFile(state, file, canvasFindItemIdByRef(state, 'canvas-file', file.id));
}

/* ---- Selection Core: Delete/Backspace over a (possibly multi-)selection ----
   Splices every selected drawing out in one history snapshot + removes every
   selected non-note item, choosing a confirm strategy that avoids a "confirm
   storm" on a big marquee delete:
     - a single selected element reuses the existing single-item/drawing path
       (canvasRequestDeleteItem already has the right per-kind confirm rules);
     - multiple elements where none is a canvas-file delete immediately
       (drawings are undoable via Ctrl+Z; ai/uploading items have no server
       row to lose);
     - multiple elements where at least one IS a canvas-file show ONE
       confirm, then delete everything.
   A selected `note` item is filtered out up front — it is never deletable —
   so a solely-selected note + Delete stays the exact same no-op it always
   was (canvasRequestDeleteItem's own `if (entry.refKind === 'note') return;`
   never even gets a chance to differ). */

// Splices the given drawing ids out of state.drawings in ONE history
// snapshot (so a multi-drawing delete is a single Ctrl+Z step), repaints and
// persists. Also used for the "exactly one drawing selected" case.
function canvasDeleteDrawingsNow(state, drawingIds) {
  if (!drawingIds || !drawingIds.length) return;
  const idSet = new Set(drawingIds);
  canvasSnapshotHistory(state);
  state.drawings = state.drawings.filter((d) => !idSet.has(d.id));
  drawingIds.forEach((id) => state.selection.drawings.delete(id));
  canvasRenderVectors(state);
  canvasRenderToolbar(state);
  markCanvasDirty(state);
}

// A selected `note` item can never be deleted; if one rode along in a
// multi-selection alongside deletable elements, strip it from the selection
// too once the rest is gone, so "clear the selection after" holds even for a
// mixed selection (a solely-selected note is never routed through this —
// see canvasDeleteSelection's early return).
function canvasStripUndeletableSelection(state) {
  state.selection.items.forEach((id) => {
    const en = state.itemsById.get(id);
    if (en && (en.refKind === 'note' || en.refKind === 'revision-pdf')) {
      en.el.classList.remove('selected');
      state.selection.items.delete(id);
    }
  });
}

function canvasDeleteSelection(state) {
  const drawingIds = Array.from(state.selection.drawings);
  const itemIds = Array.from(state.selection.items).filter((id) => {
    const en = state.itemsById.get(id);
    return en && en.refKind !== 'note' && en.refKind !== 'revision-pdf';
  });
  const total = drawingIds.length + itemIds.length;
  if (!total) return; // nothing deletable selected (e.g. only the note) — same no-op as before

  if (total === 1) {
    if (itemIds.length === 1) { canvasRequestDeleteItem(state, itemIds[0]); return; }
    canvasDeleteDrawingsNow(state, drawingIds); // the lone selected element is a drawing
    return;
  }

  const hasFile = itemIds.some((id) => {
    const en = state.itemsById.get(id);
    return en && en.refKind === 'canvas-file';
  });

  if (!hasFile) {
    canvasDeleteDrawingsNow(state, drawingIds);
    itemIds.forEach((id) => canvasRemoveItemFromDom(state, id));
    canvasStripUndeletableSelection(state);
    canvasRenderFileList(state);
    return;
  }

  ui.confirmModal({
    title: 'Delete selection?',
    message: `Delete ${total} selected item(s)? Files are removed permanently.`,
    confirmLabel: 'Delete',
    onConfirm: async () => {
      canvasDeleteDrawingsNow(state, drawingIds);
      for (const id of itemIds) {
        const en = state.itemsById.get(id);
        if (!en) continue;
        if (en.refKind === 'canvas-file') {
          const file = en.refObj;
          try {
            await api.del(`/${canvasFileMediaBase(state)}/${file.id}`);
          } catch (e) {
            console.error('Canvas: failed to delete file', e);
            continue; // leave this one on the board rather than silently losing track of it
          }
          if (canvasState !== state) return;
          state.filesById.delete(file.id);
          state.files = state.files.filter((f) => f.id !== file.id);
        }
        canvasRemoveItemFromDom(state, id);
      }
      canvasStripUndeletableSelection(state);
      canvasRenderFileList(state);
      ui.toast('Selection deleted');
    },
  });
}

/* ---- world transform: screen <-> world, pan, zoom, fit-to-view (§3) ---- */

function canvasApplyTransform(state) {
  state.worldEl.style.transform = `translate(${state.tx}px, ${state.ty}px) scale(${state.scale})`;
  const label = document.getElementById('canvas-zoom-level');
  if (label) label.textContent = Math.round(state.scale * 100) + '%';
}

function canvasScreenToWorld(state, sx, sy) {
  return { x: (sx - state.tx) / state.scale, y: (sy - state.ty) / state.scale };
}

function canvasZoomAt(state, factor, sx, sy) {
  const before = canvasScreenToWorld(state, sx, sy);
  state.scale = canvasClampScale(state.scale * factor);
  state.tx = sx - before.x * state.scale;
  state.ty = sy - before.y * state.scale;
  canvasApplyTransform(state);
  markCanvasDirty(state);
}

function canvasZoomCenter(state, factor) {
  const rect = state.scrollEl.getBoundingClientRect();
  canvasZoomAt(state, factor, rect.width / 2, rect.height / 2);
}

function canvasFitToView(state, persist = true) {
  const rect = state.scrollEl.getBoundingClientRect();
  const entries = Array.from(state.itemsById.values());
  if (!entries.length) {
    state.scale = 1;
    state.tx = Math.max(40, rect.width / 2 - 260);
    state.ty = 40;
  } else {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    entries.forEach((en) => {
      minX = Math.min(minX, en.data.x); minY = Math.min(minY, en.data.y);
      maxX = Math.max(maxX, en.data.x + en.data.w); maxY = Math.max(maxY, en.data.y + en.data.h);
    });
    const pad = 60;
    const bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
    const s = canvasClampScale(Math.min((rect.width - pad * 2) / bw, (rect.height - pad * 2) / bh));
    state.scale = s;
    state.tx = rect.width / 2 - (minX + bw / 2) * s;
    state.ty = rect.height / 2 - (minY + bh / 2) * s;
  }
  canvasApplyTransform(state);
  if (persist) markCanvasDirty(state);
}

function canvasStartPan(state, e) {
  e.preventDefault();
  const scrollEl = state.scrollEl;
  const startClientX = e.clientX, startClientY = e.clientY;
  const startTx = state.tx, startTy = state.ty;
  scrollEl.classList.add('panning');
  try { scrollEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const onMove = (ev) => {
    state.tx = startTx + (ev.clientX - startClientX);
    state.ty = startTy + (ev.clientY - startClientY);
    canvasApplyTransform(state);
  };
  const onUp = () => {
    scrollEl.classList.remove('panning');
    scrollEl.removeEventListener('pointermove', onMove);
    scrollEl.removeEventListener('pointerup', onUp);
    scrollEl.removeEventListener('pointercancel', onUp);
    markCanvasDirty(state);
  };
  scrollEl.addEventListener('pointermove', onMove);
  scrollEl.addEventListener('pointerup', onUp);
  scrollEl.addEventListener('pointercancel', onUp);
}

/* ---- Selection Core: marquee (rubber-band) select ----
   A left-drag starting on truly empty canvas in select mode (not on an item,
   not on a hit drawing, not Space-held) now draws a marquee instead of
   panning (canvasWireEvents' onPointerDown routes here). Drawn in SCREEN
   space as a plain DOM rect over #canvas-scroll (mirrors the reader/lightbox
   snip marquee pattern — app.js ~5063), so it needs no world-space math while
   dragging; only the final rect is converted to world coords once, on
   release, to test intersection against every item/drawing. */
function canvasStartMarqueeSelect(state, e) {
  e.preventDefault();
  canvasClearSelection(state); // a plain click (no drag) just clears — matches the old empty-click behavior
  const scrollEl = state.scrollEl;
  const scrollRect = scrollEl.getBoundingClientRect();
  const startX = e.clientX - scrollRect.left, startY = e.clientY - scrollRect.top;
  const marquee = document.createElement('div');
  marquee.className = 'canvas-marquee';
  scrollEl.appendChild(marquee);
  let moved = false;
  let last = { x0: startX, y0: startY, x1: startX, y1: startY };
  try { scrollEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const paint = (curX, curY) => {
    const x0 = Math.min(startX, curX), x1 = Math.max(startX, curX);
    const y0 = Math.min(startY, curY), y1 = Math.max(startY, curY);
    marquee.style.left = x0 + 'px';
    marquee.style.top = y0 + 'px';
    marquee.style.width = Math.max(0, x1 - x0) + 'px';
    marquee.style.height = Math.max(0, y1 - y0) + 'px';
    last = { x0, y0, x1, y1 };
  };
  const onMove = (ev) => {
    const cx = ev.clientX - scrollRect.left, cy = ev.clientY - scrollRect.top;
    if (Math.abs(cx - startX) > CANVAS_MARQUEE_THRESHOLD || Math.abs(cy - startY) > CANVAS_MARQUEE_THRESHOLD) moved = true;
    paint(cx, cy);
  };
  const cleanup = () => {
    scrollEl.removeEventListener('pointermove', onMove);
    scrollEl.removeEventListener('pointerup', finishUp);
    scrollEl.removeEventListener('pointercancel', cleanup);
    marquee.remove();
  };
  const finishUp = () => {
    cleanup();
    if (canvasState === state && moved) canvasApplyMarqueeSelection(state, last);
  };
  scrollEl.addEventListener('pointermove', onMove);
  scrollEl.addEventListener('pointerup', finishUp);
  scrollEl.addEventListener('pointercancel', cleanup);
}

// Converts the marquee's final screen rect (relative to #canvas-scroll) to a
// world rect and additively selects every item + box-selectable drawing
// whose bounds intersect it (selection was already cleared at drag-start).
function canvasApplyMarqueeSelection(state, screenRect) {
  const p0 = canvasScreenToWorld(state, screenRect.x0, screenRect.y0);
  const p1 = canvasScreenToWorld(state, screenRect.x1, screenRect.y1);
  const wx0 = Math.min(p0.x, p1.x), wx1 = Math.max(p0.x, p1.x);
  const wy0 = Math.min(p0.y, p1.y), wy1 = Math.max(p0.y, p1.y);
  const intersects = (ax, ay, aw, ah) => ax < wx1 && ax + aw > wx0 && ay < wy1 && ay + ah > wy0;

  state.itemsById.forEach((entry, id) => {
    const d = entry.data;
    if (intersects(d.x, d.y, d.w, d.h)) canvasSelectItem(state, id, { additive: true });
  });
  let addedDrawing = false;
  (state.drawings || []).forEach((d) => {
    if (!canvasDrawingIsBoxSelectable(d)) return;
    const b = canvasDrawingBounds(d);
    if (b && intersects(b.x, b.y, b.w, b.h)) { state.selection.drawings.add(d.id); addedDrawing = true; }
  });
  if (addedDrawing) canvasRenderVectors(state); // repaint to show the selected-drawing halos
}

/* ---- Clipboard core (round 10 Part 2 — CANVAS.md §14) ----
   Native `copy`/`paste` DOM events only (never a keydown Ctrl+C/V branch) —
   those events simply don't fire while an editable element (a sticky/text
   drawing's inline editor, a form field) is focused, so native text
   copy/paste inside them is never hijacked; canvasClipboardBlocked() below is
   a belt-and-braces check on top of that. Only drawings + pinned 'ai' cards
   are ever copyable — file-backed items (note/canvas-file/uploading) are
   deliberately excluded (CANVAS.md §2/§13: they're durable server rows, not
   board doodles, and "copy" for them isn't a meaningful concept here). */

function canvasClipboardBlocked(e) {
  const isEditableEl = (el) => !!el && el.nodeType === 1
    && (el.isContentEditable || ['input', 'textarea', 'select'].includes((el.tagName || '').toLowerCase()));
  return isEditableEl(document.activeElement) || isEditableEl(e.target);
}

// Base64 data: URL -> a real File (never a bare Blob) so canvasUploadFile's
// FormData append always carries a filename with a valid extension — the
// backend validates canvas uploads BY EXTENSION (CANVAS.md §5), not MIME.
function canvasDataUrlToFile(dataUrl, filename) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl || '');
  if (!m) return null;
  const mime = m[1] || 'image/png';
  let bytes;
  if (m[2]) {
    const bin = atob(m[3]);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(m[3]));
  }
  return new File([bytes], filename, { type: mime });
}

// Paste path #2/#3 (a stashed snip crop, or a real OS-clipboard screenshot) —
// both are just "upload this image at roughly the pointer/viewport", reusing
// the existing upload pipeline (placeholder card -> POST -> real canvas-file).
function canvasPasteImageDataUrl(state, dataUrl, filename) {
  const file = canvasDataUrlToFile(dataUrl, filename || `pasted-${Date.now()}.png`);
  if (!file) return;
  const center = canvasViewportCenterWorld(state);
  canvasUploadFile(state, file, center.x - 180, center.y - 130);
}

// Paste path #1: an in-app copy of a selection (drawings + pinned 'ai' cards).
// Every pasted element gets a FRESH id (canvasNewItemId/canvasNewDrawingId —
// never reused, so there's no risk of colliding with a still-live original or
// an earlier paste of the same clipboard), offset by +24/+24 world px so a
// paste never perfectly overlaps its source, and the whole pasted set becomes
// the new selection so it can be dragged immediately.
function canvasPasteSelection(state, clip) {
  const items = clip.items || [];
  const drawings = clip.drawings || [];
  if (!items.length && !drawings.length) return;

  canvasClearSelection(state);
  const idMap = new Map(); // old item id -> new item id (only 'ai' items are ever in `items`)
  const pastedItemIds = [];

  items.forEach((oldItem) => {
    const newId = canvasNewItemId();
    idMap.set(oldItem.id, newId);
    const ref = JSON.parse(JSON.stringify(oldItem.ref));
    if (ref.type === 'ai') {
      // Keep sourceItemId only if that source item still exists on THIS
      // board (so the pasted copy still nests under it in the Files
      // sidebar); otherwise it's an orphan, same as any convo whose source
      // was separately deleted. No new connector is drawn on paste either way.
      ref.sourceItemId = (ref.sourceItemId && state.itemsById.has(ref.sourceItemId)) ? ref.sourceItemId : null;
    }
    canvasMountItem(state, {
      id: newId, ref,
      x: oldItem.x + 24, y: oldItem.y + 24, w: oldItem.w, h: oldItem.h,
      z: canvasNextZ(state),
    });
    pastedItemIds.push(newId);
  });

  const pastedDrawingIds = [];
  if (drawings.length) {
    canvasSnapshotHistory(state); // one snapshot for the whole paste — one Ctrl+Z step
    const newDrawings = [];
    drawings.forEach((oldD) => {
      const d = JSON.parse(JSON.stringify(oldD));
      d.id = canvasNewDrawingId();
      if (d.type === 'connector') {
        // Kept ONLY if BOTH endpoints were themselves copied (i.e. both are
        // pinned 'ai' items in `items` above) — remap to the fresh item ids.
        // Otherwise drop it rather than paste a dangling connector. In
        // practice, since only 'ai' items are copyable, a connector usually
        // links a file -> ai card, so most connectors are dropped here — that
        // matches CANVAS.md §14.
        const from = idMap.get(oldD.from), to = idMap.get(oldD.to);
        if (!from || !to) return;
        d.from = from; d.to = to;
      } else if (d.type === 'line' || d.type === 'arrow') {
        d.x1 += 24; d.y1 += 24; d.x2 += 24; d.y2 += 24;
      } else if (d.type === 'pen') {
        d.points = (d.points || []).map((p) => ({ x: p.x + 24, y: p.y + 24 }));
      } else {
        d.x += 24; d.y += 24;
      }
      newDrawings.push(d);
    });
    state.drawings = (state.drawings || []).concat(newDrawings);
    newDrawings.forEach((d) => pastedDrawingIds.push(d.id));
  }

  pastedItemIds.forEach((id) => canvasSelectItem(state, id, { additive: true }));
  pastedDrawingIds.forEach((id) => state.selection.drawings.add(id));
  if (drawings.length) canvasRenderVectors(state); // repaint: new drawings + their selected-halo + connector removal, in one pass

  markCanvasDirty(state);
  if (pastedItemIds.length) canvasRenderFileList(state); // a pasted 'ai' card needs to show up in the sidebar
}

// Round 10 Part 2 (pinch-zoom, CANVAS.md §14): best-effort force-end of
// whichever single-pointer gesture (pan / marquee / shape-draw / sticky-draw
// / drawing-manipulate — all of them capture on state.scrollEl and listen for
// 'pointercancel' there, cleaning up unconditionally, i.e. none of them
// filter by pointerId) or item drag/resize (captures on the item's own
// element instead — tracked in state._activeItemDragEl while live) is mid-
// flight, so a second touch point landing mid-drag doesn't fight the pinch.
function canvasCancelActiveGesture(state) {
  try { state.scrollEl.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true })); } catch (e) { /* ignore */ }
  if (state._activeItemDragEl) {
    try { state._activeItemDragEl.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, cancelable: true })); } catch (e) { /* ignore */ }
    state._activeItemDragEl = null;
  }
}

function canvasWireEvents(state) {
  const scrollEl = state.scrollEl;

  const onPointerDown = (e) => {
    if (canvasState !== state) return;
    if (e.button === 1) { canvasStartPan(state, e); return; } // middle-mouse pan works over items too
    if (e.button !== 0) return;
    // Phase 3: any drawing tool takes over the canvas pointer surface instead
    // of panning/selecting (CANVAS.md §9). Connector clicks on an item are
    // handled by the item's own pointerdown (canvasWireItemInteraction) —
    // bail out here so this handler doesn't also start a shape draw.
    if (state.tool !== 'select') {
      if (state.tool === 'connector') {
        // Item clicks are handled by the item's OWN pointerdown
        // (canvasWireItemInteraction → canvasConnectorPick). A click on empty
        // canvas cancels any pending pick instead of starting a bogus shape.
        if (!e.target.closest('.canvas-item')) canvasConnectorCancel(state);
        return;
      }
      if (state.tool === 'eraser') { canvasEraserPointerDown(state, e); return; }
      canvasStartShapeDraw(state, e);
      return;
    }
    if (e.target.closest('.canvas-item')) return; // the item's own handler owns this drag
    // In select mode, a pointerdown over a drawing (sticky/shape/text) moves it
    // (or resizes it, if near its bottom-right corner). Hit-testing is done
    // against the model in world coords — NOT the SVG element (which is
    // pointer-events:none in select mode so item cards stay clickable).
    const selRect = scrollEl.getBoundingClientRect();
    const selWpt = canvasScreenToWorld(state, e.clientX - selRect.left, e.clientY - selRect.top);
    const hitDrawing = canvasDrawingHitTest(state, selWpt);
    if (hitDrawing) {
      // Re-edit a text/sticky note on double-click. Detected HERE (on the scroll
      // surface) rather than the note's foreignObject dblclick, because in select
      // mode #canvas-vectors is pointer-events:none. Round 9: e.detail is NOT
      // reliable here — the first click starts canvasStartDrawingManipulate which
      // preventDefaults the pointerdown, resetting the browser's click-count so
      // the 2nd pointerdown never reports detail>=2 (and the compat dblclick never
      // fires either). So track the last hit drawing + time ourselves.
      if (hitDrawing.type === 'text' || hitDrawing.type === 'sticky') {
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const last = state._lastDrawingClick;
        if (last && last.id === hitDrawing.id && (now - last.t) < 400) {
          state._lastDrawingClick = null;
          e.preventDefault();
          canvasEditDrawingText(state, hitDrawing);
          return;
        }
        state._lastDrawingClick = { id: hitDrawing.id, t: now };
      }
      // Selection Core: Shift-click ONLY toggles membership (no manipulate),
      // mirroring the item pointerdown above. A plain click that's already
      // part of a live multi-selection keeps it (so the drag below moves
      // everyone); otherwise this drawing becomes the sole selection.
      if (e.shiftKey) {
        canvasSelectDrawing(state, hitDrawing.id, { additive: true });
        return;
      }
      const keepMulti = state.selection.drawings.has(hitDrawing.id)
        && (state.selection.drawings.size > 1 || state.selection.items.size > 0);
      if (!keepMulti) canvasSelectDrawing(state, hitDrawing.id);
      canvasStartDrawingManipulate(state, e, hitDrawing, selWpt);
      return;
    }
    // Selection Core: empty canvas now marquee-selects by default; Space-held
    // drag still pans (matches middle-mouse, which already works over items
    // too — see the e.button===1 branch above).
    if (state.spaceDown) { canvasStartPan(state, e); return; }
    canvasStartMarqueeSelect(state, e);
  };
  scrollEl.addEventListener('pointerdown', onPointerDown);

  const onWheel = (e) => {
    if (canvasState !== state) return;
    e.preventDefault();
    const rect = scrollEl.getBoundingClientRect();
    const factor = Math.pow(1.0015, -e.deltaY); // zoom toward the cursor
    canvasZoomAt(state, factor, e.clientX - rect.left, e.clientY - rect.top);
  };
  scrollEl.addEventListener('wheel', onWheel, { passive: false });

  /* ---- pinch-zoom (round 10 Part 2 — CANVAS.md §14) ----
     A two-pointer touch gesture, tracked independently of the single-pointer
     gestures above. Listened for in the CAPTURE phase on scrollEl so a
     pointerdown is seen here even though those gestures' own handlers call
     e.stopPropagation() during the (later) bubble phase, and even when the
     pointer lands on an item card (whose own pointerdown handler lives on
     the item element, a descendant of scrollEl — capture always runs before
     a descendant's own listener gets the event). */
  const pinchPointers = new Map(); // pointerId -> {x, y} in viewport (clientX/Y) coords
  let pinchDist = null; // distance (px) at the last processed tick, or null when not (yet) pinching

  const onPinchPointerDown = (e) => {
    if (canvasState !== state) return;
    if (pinchPointers.size >= 2) { e.stopPropagation(); return; } // a 3rd+ pointer never starts its own gesture either
    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPointers.size === 2) {
      canvasCancelActiveGesture(state); // end whatever single-pointer gesture pointer #1 may already be mid-flight on
      const pts = Array.from(pinchPointers.values());
      pinchDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || null;
      e.stopPropagation(); // this 2nd pointer must not ALSO start its own select/marquee/drag
      if (e.cancelable) e.preventDefault();
    }
  };
  const onPinchPointerMove = (e) => {
    if (canvasState !== state || !pinchPointers.has(e.pointerId)) return;
    pinchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPointers.size !== 2 || !pinchDist) return;
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const pts = Array.from(pinchPointers.values());
    const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
    if (!dist) return;
    const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
    const rect = scrollEl.getBoundingClientRect();
    canvasZoomAt(state, dist / pinchDist, midX - rect.left, midY - rect.top); // zoom toward the pinch midpoint
    pinchDist = dist;
  };
  const onPinchPointerEnd = (e) => {
    if (!pinchPointers.has(e.pointerId)) return;
    pinchPointers.delete(e.pointerId);
    if (pinchPointers.size < 2) pinchDist = null; // exits pinch mode — the next pointerdown starts a fresh, ordinary gesture
  };
  scrollEl.addEventListener('pointerdown', onPinchPointerDown, { capture: true });
  scrollEl.addEventListener('pointermove', onPinchPointerMove, { capture: true });
  scrollEl.addEventListener('pointerup', onPinchPointerEnd, { capture: true });
  scrollEl.addEventListener('pointercancel', onPinchPointerEnd, { capture: true });

  const isTyping = () => {
    const a = document.activeElement;
    return !!a && (a.isContentEditable || ['input', 'textarea', 'select'].includes((a.tagName || '').toLowerCase()));
  };
  const onKeyDown = (e) => {
    if (canvasState !== state || isTyping()) return;
    if (e.code === 'Space') { state.spaceDown = true; scrollEl.classList.add('canvas-space'); return; }
    if (e.key === '+' || e.key === '=') { e.preventDefault(); canvasZoomCenter(state, 1.2); return; }
    if (e.key === '-') { e.preventDefault(); canvasZoomCenter(state, 1 / 1.2); return; }
    if (e.key === '0') { e.preventDefault(); canvasFitToView(state); return; }
    // Phase 3: drawings undo/redo. isTyping() above already guards against
    // hijacking native text undo while a drawing text/sticky editor
    // (contentEditable) or any other input has focus — mirrors the reader's guard.
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) canvasRedo(state); else canvasUndo(state);
      return;
    }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); canvasRedo(state); return; }
    if (e.key === 'Escape' && state.tool === 'connector' && state.pendingConnectorFrom) {
      e.preventDefault();
      canvasConnectorCancel(state);
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && (state.selection.items.size || state.selection.drawings.size)) {
      e.preventDefault();
      canvasDeleteSelection(state);
      return;
    }
  };
  const onKeyUp = (e) => {
    if (e.code === 'Space') { state.spaceDown = false; scrollEl.classList.remove('canvas-space'); }
  };
  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);

  /* ---- clipboard: copy/paste of the selection (round 10 Part 2 — CANVAS.md
     §14). Native `copy`/`paste` events — NOT a keydown branch — so they never
     fire while an editable element is focused; isTyping() (already defined
     above) plus an event-target check (canvasClipboardBlocked) is belt-and-
     braces on top of that. */
  const onCopy = (e) => {
    if (canvasState !== state || isTyping() || canvasClipboardBlocked(e)) return;
    const hasSelection = state.selection.items.size || state.selection.drawings.size;
    if (!hasSelection) return; // nothing selected — let native copy proceed
    const copiedItemIds = new Set();
    const items = [];
    state.selection.items.forEach((id) => {
      const entry = state.itemsById.get(id);
      if (entry && entry.refKind === 'ai') { items.push(JSON.parse(JSON.stringify(entry.data))); copiedItemIds.add(id); }
      // note/canvas-file/uploading items are deliberately excluded — CANVAS.md §14.
    });
    const drawings = [];
    const copiedDrawingIds = new Set();
    state.selection.drawings.forEach((id) => {
      const d = (state.drawings || []).find((x) => x.id === id);
      if (d) { drawings.push(JSON.parse(JSON.stringify(d))); copiedDrawingIds.add(id); }
    });
    // A connector between two copied 'ai' cards travels with them automatically —
    // connectors are never individually click/marquee-selectable (CANVAS.md
    // §13), so this is the only way one is ever part of a copy.
    if (copiedItemIds.size > 1) {
      (state.drawings || []).forEach((d) => {
        if (d.type === 'connector' && !copiedDrawingIds.has(d.id) && copiedItemIds.has(d.from) && copiedItemIds.has(d.to)) {
          drawings.push(JSON.parse(JSON.stringify(d)));
        }
      });
    }
    canvasClipboard = { kind: 'selection', items, drawings };
    e.preventDefault();
  };
  const onPaste = (e) => {
    if (canvasState !== state || isTyping() || canvasClipboardBlocked(e)) return;
    if (canvasClipboard && canvasClipboard.kind === 'selection') {
      e.preventDefault();
      canvasPasteSelection(state, canvasClipboard);
      return;
    }
    if (canvasClipboard && canvasClipboard.kind === 'image') {
      e.preventDefault();
      canvasPasteImageDataUrl(state, canvasClipboard.dataUrl);
      return;
    }
    // Path #3: a real OS-clipboard screenshot (no prior in-app copy/snip).
    const dt = e.clipboardData;
    const dtItems = dt && dt.items;
    if (!dtItems) return;
    for (let i = 0; i < dtItems.length; i++) {
      const it = dtItems[i];
      if (it.kind === 'file' && it.type && it.type.indexOf('image/') === 0) {
        const blob = it.getAsFile();
        if (!blob) continue;
        e.preventDefault();
        const ext = it.type.split('/')[1] || 'png';
        const file = /\.[a-z0-9]+$/i.test(blob.name || '') ? blob : new File([blob], `pasted-${Date.now()}.${ext}`, { type: it.type });
        const center = canvasViewportCenterWorld(state);
        canvasUploadFile(state, file, center.x - 180, center.y - 130);
        return;
      }
    }
  };
  document.addEventListener('copy', onCopy);
  document.addEventListener('paste', onPaste);

  const removeDropUpload = canvasWireDropUpload(state);

  state._cleanup = () => {
    scrollEl.removeEventListener('pointerdown', onPointerDown);
    scrollEl.removeEventListener('wheel', onWheel);
    scrollEl.removeEventListener('pointerdown', onPinchPointerDown, { capture: true });
    scrollEl.removeEventListener('pointermove', onPinchPointerMove, { capture: true });
    scrollEl.removeEventListener('pointerup', onPinchPointerEnd, { capture: true });
    scrollEl.removeEventListener('pointercancel', onPinchPointerEnd, { capture: true });
    document.removeEventListener('keydown', onKeyDown);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('copy', onCopy);
    document.removeEventListener('paste', onPaste);
    removeDropUpload();
    canvasCloseLightbox();
  };
}

/* ---- layout persistence (mirrors readerMarkDirty/readerFlushSave) ---- */

function canvasLayoutDoc(state) {
  const items = [];
  state.itemsById.forEach((en) => {
    // An in-flight/failed upload placeholder has no backing canvas_files row
    // yet (or ever, if it failed) — never persist it. Once the upload
    // resolves, canvasRefreshItem() swaps the ref to a real 'canvas-file' id
    // and the *next* save includes it normally.
    if (en.data.ref && en.data.ref.type === 'uploading') return;
    items.push({ id: en.data.id, ref: en.data.ref, x: en.data.x, y: en.data.y, w: en.data.w, h: en.data.h, z: en.data.z });
  });
  return { v: 1, view: { tx: state.tx, ty: state.ty, scale: state.scale }, items, drawings: state.drawings || [] };
}

function markCanvasDirty(state) {
  state.dirty = true;
  if (state.saveTimer) clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => canvasFlushSave(state), 800);
}

async function canvasFlushSave(state) {
  if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
  if (!state.dirty) return;
  state.dirty = false;
  try {
    await api.put(`${canvasLayoutApiBase(state)}/canvas`, { data: canvasLayoutDoc(state) });
  } catch (e) {
    console.error('Canvas: failed to save layout', e);
    if (canvasState === state) state.dirty = true; // retry on the next change
  }
}

/* ---- building the board: load saved layout, or auto-place item #0 + files ---- */

function canvasBuildItems(state, layout) {
  const hasSaved = layout && Array.isArray(layout.items) && layout.items.length;
  if (hasSaved) {
    layout.items.forEach((it) => canvasMountItem(state, it));
    return;
  }
  // Auto-place: item #0 top-left, then every canvas file flowing right in
  // rows. Persisted immediately so the next open reuses these positions
  // instead of re-auto-placing. Item #0 is the lesson's compiled note (only
  // once compiled — CANVAS.md §2) for a concept-scope board, or the exam's
  // revision PDF (always, regardless of status — it's never dropped) for a
  // revision-scope board.
  let z = 1;
  const items = [];
  if (canvasIsRevisionScope(state)) {
    if (state.revision) {
      items.push({ id: canvasNewItemId(), ref: { type: 'revision-pdf', id: state.revision.id }, x: 40, y: 40, w: 520, h: 700, z: z++ });
    }
  } else if (state.note && state.note.status === 'compiled') {
    items.push({ id: canvasNewItemId(), ref: { type: 'note', id: state.note.id }, x: 40, y: 40, w: 520, h: 700, z: z++ });
  }
  const startX = items.length ? 620 : 40;
  const colW = 360, colH = 480, gap = 40, perRow = 3;
  state.files.forEach((f, i) => {
    const col = i % perRow, row = Math.floor(i / perRow);
    items.push({
      id: canvasNewItemId(), ref: { type: 'canvas-file', id: f.id },
      x: startX + col * (colW + gap), y: 40 + row * (colH + gap), w: colW, h: colH, z: z++,
    });
  });
  items.forEach((it) => canvasMountItem(state, it));
  if (items.length) markCanvasDirty(state);
}

async function renderCanvasView(courseId, conceptId, origin) {
  origin = origin === 'schedule' ? 'schedule' : 'course';
  const view = document.getElementById('view');
  view.classList.add('view-fullbleed');
  view.innerHTML = '<div class="canvas-loading">Loading canvas&hellip;</div>';

  let notes = [], concepts = [];
  try {
    [notes, concepts] = await Promise.all([
      api.get(`/courses/${courseId}/notes`),
      api.get(`/courses/${courseId}/concepts`),
    ]);
  } catch (e) {
    view.innerHTML = `<div class="p-8 text-sm" style="color:var(--danger)">Could not load course: ${esc(e.message)}</div>`;
    return;
  }

  if (!concepts.length) {
    view.innerHTML = `
      <div class="canvas-empty-shell">
        <a href="#/course/${courseId}" class="btn btn-ghost">&larr; Back to course</a>
        <p class="mt-6 text-sm text-muted">No lessons yet — analyze materials on the course page first.</p>
      </div>`;
    return;
  }

  const notesByConceptId = new Map();
  notes.forEach((n) => { if (n.concept_id != null) notesByConceptId.set(n.concept_id, n); });

  let activeConceptId = conceptId != null && conceptId !== '' ? Number(conceptId) : null;
  if (activeConceptId == null || !concepts.some((c) => c.id === activeConceptId)) {
    const withCompiledNote = concepts.find((c) => {
      const n = notesByConceptId.get(c.id);
      return n && n.status === 'compiled';
    });
    activeConceptId = (withCompiledNote || concepts[0]).id;
  }

  let canvasData;
  try {
    canvasData = await api.get(`/concepts/${activeConceptId}/canvas`);
  } catch (e) {
    canvasData = { layout: null, files: [] };
  }

  const activeNote = notesByConceptId.get(activeConceptId) || null;
  const activeConcept = concepts.find((c) => c.id === activeConceptId);
  const files = canvasData.files || [];

  // Schedule origin: the left sidebar lists the upcoming schedule (cross-course).
  // /schedule/upcoming now also carries synthetic kind:'revision' rows (Build
  // 12 Phase 4, whole-exam — no single concept_id/note_id); this cross-course
  // lesson list only knows how to render per-concept lessons, so filter those
  // out rather than let them render as a broken/unselectable lesson row.
  let scheduleItems = [];
  if (origin === 'schedule') {
    try {
      const to = new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 10);
      scheduleItems = (await api.get(`/schedule/upcoming?from=${todayISO()}&to=${to}`))
        .filter((it) => it.kind !== 'revision');
    } catch (e) { scheduleItems = []; }
  }

  view.innerHTML = canvasShellHtml(courseId, activeConceptId, concepts, notesByConceptId, activeConcept, activeNote, files, origin, scheduleItems);

  const state = {
    scope: { kind: 'concept', id: activeConceptId }, // see the canvasState comment above
    courseId: Number(courseId),
    conceptId: activeConceptId,
    concept: activeConcept || null,
    concepts,                 // full lesson list — used by canvasSwitchLesson (in-place switch)
    notesByConceptId,         // concept_id -> note, for item #0 + the lesson header
    origin,                   // 'course' | 'schedule' — which list the left sidebar shows
    scheduleItems,            // schedule-origin sidebar rows (empty in course mode)
    scrollEl: view.querySelector('#canvas-scroll'),
    worldEl: view.querySelector('#canvas-world'),
    note: activeNote,
    files,
    filesById: new Map(files.map((f) => [f.id, f])),
    itemsById: new Map(),
    selection: { items: new Set(), drawings: new Set() }, // Selection Core (generalizes the old single selectedId)
    tx: 0, ty: 0, scale: 1,
    drawings: (canvasData.layout && canvasData.layout.drawings) || [], // Phase 3 owns this
    // ---- Phase 3: vector drawing layer ----
    vectorsEl: view.querySelector('#canvas-vectors'),
    vectorsG: view.querySelector('#canvas-vectors-g'),
    vectorsDefs: view.querySelector('#canvas-vectors-defs'),
    vectorNodes: new Map(), // drawing id -> its SVG DOM node, rebuilt by canvasRenderVectors()
    tool: 'select',
    color: CANVAS_COLORS[0],
    strokeWidth: CANVAS_STROKE_WIDTHS[1],
    pendingConnectorFrom: null, // itemId picked as the connector's first endpoint, or null
    historyPast: [], // stack of JSON-stringified `drawings` snapshots (undo)
    historyFuture: [], // stack of JSON-stringified `drawings` snapshots (redo)
    dirty: false,
    saveTimer: null,
    spaceDown: false,
    fileSearch: '',
    fileSort: 'newest',
    _panRaf: null,
    _activeItemDragEl: null, // round 10 Part 2: see the canvasState comment above
    _cleanup: null,
  };
  canvasState = state;
  // Back-compat shim: nothing in this codebase reads state.selectedId any
  // more (every consumer now goes through state.selection), but keep a
  // read-only getter — mirrors the old single-selection semantics (the sole
  // selected item id, or null when empty/multi/a-drawing-is-selected).
  Object.defineProperty(state, 'selectedId', {
    get() { return (state.selection.items.size === 1 && !state.selection.drawings.size) ? Array.from(state.selection.items)[0] : null; },
    configurable: true,
  });

  canvasBuildItems(state, canvasData.layout);
  canvasRenderVectors(state); // Phase 3: paint any saved drawings/connectors now that itemsById is populated
  canvasRenderToolbar(state);
  canvasWireEvents(state);
  canvasRenderFileList(state);

  // Resume polling any docx/pptx canvas file that was already 'converting'
  // when this board loaded (e.g. opened in a fresh tab mid-conversion) — the
  // upload-time poll only covers the tab that started the upload.
  state.itemsById.forEach((entry, itemId) => {
    if (entry.refKind === 'canvas-file' && entry.refObj && entry.refObj.status === 'converting') {
      canvasPollFile(state, entry.refObj.id, itemId);
    }
  });

  if (canvasData.layout && canvasData.layout.view) {
    state.tx = canvasData.layout.view.tx || 0;
    state.ty = canvasData.layout.view.ty || 0;
    state.scale = canvasClampScale(canvasData.layout.view.scale || 1);
    canvasApplyTransform(state);
  } else {
    canvasFitToView(state, false); // computed default — not itself a user change worth a write
  }

  // Fix 2 (global search → canvas text/sticky): consume a pending pan request
  // left by selectSearchResult, if it targets THIS concept — one-shot, nulled
  // immediately so a stale request can't fire on a later, unrelated canvas
  // open (e.g. the user navigates elsewhere before this fetch resolves).
  if (canvasPendingFocus && canvasPendingFocus.conceptId === activeConceptId) {
    const targetDrawingId = canvasPendingFocus.drawingId;
    canvasPendingFocus = null;
    canvasPanToDrawing(state, targetDrawingId);
  }

  // File-container controls (Phase 2b §1/§2): search/sort re-render just the
  // row list; Add-file mirrors the drop-upload path but places at the
  // current viewport center instead of a drop point.
  const searchInput = view.querySelector('#canvas-file-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.fileSearch = searchInput.value;
      canvasRenderFileList(state);
    });
  }
  const sortSelect = view.querySelector('#canvas-file-sort');
  if (sortSelect) {
    sortSelect.value = state.fileSort;
    sortSelect.addEventListener('change', () => {
      state.fileSort = sortSelect.value;
      canvasRenderFileList(state);
    });
  }
  const addFileBtn = view.querySelector('#canvas-add-file-btn');
  const fileInput = view.querySelector('#canvas-file-input');
  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      canvasHandleFileInputChange(state, fileInput.files);
      fileInput.value = '';
    });
  }
  // F3: the empty-canvas hint's own "+ Add file" reuses the same hidden input
  // (never rebuilt across lesson switches, so this listener stays attached).
  const emptyAddFileBtn = view.querySelector('#canvas-empty-add-file-btn');
  if (emptyAddFileBtn && fileInput) emptyAddFileBtn.addEventListener('click', () => fileInput.click());

  // Resizable sidebars (round 7 Part 6) — wired once at mount; canvasSwitchLesson
  // rebuilds only the board contents, never the shell, so these stay attached.
  view.querySelectorAll('.canvas-sidebar-resizer').forEach((el) => canvasWireSidebarResizer(el));
}

// Revision-canvas entry point (round: revision canvas, part 1) — mirrors
// renderCanvasView above structurally (build state → canvasBuildItems →
// canvasRenderVectors/Toolbar/Events/FileList → transform → wire the Files
// sidebar controls), but scoped to a REVISION instead of a concept: no
// lesson list / no notesByConceptId / no note — item #0 is the exam's own
// compiled revision PDF (ref.type 'revision-pdf'). Resolved entirely off
// EXISTING endpoints (GET /exams/:id, GET /courses/:id, GET /exams/:id/revision,
// GET /revisions/:id/canvas) — no new backend surface needed for this part.
async function renderRevisionCanvasView(examId) {
  examId = Number(examId);
  const view = document.getElementById('view');
  view.classList.add('view-fullbleed');
  view.innerHTML = '<div class="canvas-loading">Loading canvas&hellip;</div>';

  let exam, course, revRes;
  try {
    exam = await api.get(`/exams/${examId}`);
    course = await api.get(`/courses/${exam.course_id}`);
    revRes = await api.get(`/exams/${examId}/revision`);
  } catch (e) {
    view.innerHTML = `<div class="p-8 text-sm" style="color:var(--danger)">Could not load revision: ${esc(e.message)}</div>`;
    return;
  }

  if (revRes.status !== 'compiled' || !revRes.revision_id) {
    // Direct/refreshed navigation before the revision is compiled (a stale
    // link, or a reload while 'generating') — the prepare/poll flow lives on
    // the Analysis page (openRevisionFlow + revisionStartPoll); bounce there
    // rather than duplicate that flow inside the canvas route.
    view.classList.remove('view-fullbleed');
    document.body.classList.remove('fullbleed-view');
    ui.toast(revRes.status === 'generating' ? 'Revision is still preparing…' : 'Prepare the revision PDF first.', 'error');
    location.hash = `#/analysis/course/${exam.course_id}`;
    return;
  }

  const revisionId = revRes.revision_id;
  let canvasData;
  try {
    canvasData = await api.get(`/revisions/${revisionId}/canvas`);
  } catch (e) {
    canvasData = { layout: null, files: [] };
  }
  const files = canvasData.files || [];
  const courseLabel = (course && (course.name || course.code)) || 'Course';
  const examLabel = (exam && exam.name) || 'Exam';
  const title = `Revision — ${courseLabel} — ${examLabel}`;

  view.innerHTML = canvasRevisionShellHtml(exam.course_id, title);

  const state = {
    scope: { kind: 'revision', id: revisionId },
    courseId: Number(exam.course_id),
    examId,
    revision: { id: revisionId, status: revRes.status, error_message: revRes.error_message || null, token: revisionCacheToken(revRes) },
    revisionTitle: title,
    // Concept-scope fields left null/empty (defensive) — every concept-only
    // helper (lesson list/switch, Start Quiz/Mark-done, note rename) is never
    // invoked for this scope, but several read-paths null-check these anyway.
    conceptId: undefined,
    concept: null,
    concepts: [],
    notesByConceptId: new Map(),
    origin: 'course',
    scheduleItems: [],
    note: null,
    scrollEl: view.querySelector('#canvas-scroll'),
    worldEl: view.querySelector('#canvas-world'),
    files,
    filesById: new Map(files.map((f) => [f.id, f])),
    itemsById: new Map(),
    selection: { items: new Set(), drawings: new Set() },
    tx: 0, ty: 0, scale: 1,
    drawings: (canvasData.layout && canvasData.layout.drawings) || [],
    vectorsEl: view.querySelector('#canvas-vectors'),
    vectorsG: view.querySelector('#canvas-vectors-g'),
    vectorsDefs: view.querySelector('#canvas-vectors-defs'),
    vectorNodes: new Map(),
    tool: 'select',
    color: CANVAS_COLORS[0],
    strokeWidth: CANVAS_STROKE_WIDTHS[1],
    pendingConnectorFrom: null,
    historyPast: [],
    historyFuture: [],
    dirty: false,
    saveTimer: null,
    spaceDown: false,
    fileSearch: '',
    fileSort: 'newest',
    _panRaf: null,
    _activeItemDragEl: null,
    _cleanup: null,
  };
  canvasState = state;
  Object.defineProperty(state, 'selectedId', {
    get() { return (state.selection.items.size === 1 && !state.selection.drawings.size) ? Array.from(state.selection.items)[0] : null; },
    configurable: true,
  });

  canvasBuildItems(state, canvasData.layout);
  canvasRenderVectors(state);
  canvasRenderToolbar(state);
  canvasWireEvents(state);
  canvasRenderFileList(state);

  state.itemsById.forEach((entry, itemId) => {
    if (entry.refKind === 'canvas-file' && entry.refObj && entry.refObj.status === 'converting') {
      canvasPollFile(state, entry.refObj.id, itemId);
    }
  });

  if (canvasData.layout && canvasData.layout.view) {
    state.tx = canvasData.layout.view.tx || 0;
    state.ty = canvasData.layout.view.ty || 0;
    state.scale = canvasClampScale(canvasData.layout.view.scale || 1);
    canvasApplyTransform(state);
  } else {
    canvasFitToView(state, false);
  }

  const searchInput = view.querySelector('#canvas-file-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      state.fileSearch = searchInput.value;
      canvasRenderFileList(state);
    });
  }
  const sortSelect = view.querySelector('#canvas-file-sort');
  if (sortSelect) {
    sortSelect.value = state.fileSort;
    sortSelect.addEventListener('change', () => {
      state.fileSort = sortSelect.value;
      canvasRenderFileList(state);
    });
  }
  const addFileBtn = view.querySelector('#canvas-add-file-btn');
  const fileInput = view.querySelector('#canvas-file-input');
  if (addFileBtn && fileInput) {
    addFileBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      canvasHandleFileInputChange(state, fileInput.files);
      fileInput.value = '';
    });
  }
  const emptyAddFileBtn = view.querySelector('#canvas-empty-add-file-btn');
  if (emptyAddFileBtn && fileInput) emptyAddFileBtn.addEventListener('click', () => fileInput.click());

  view.querySelectorAll('.canvas-sidebar-resizer').forEach((el) => canvasWireSidebarResizer(el));
}

// Switch the active lesson WITHOUT rebuilding the shell/sidebars (the old
// behavior — set location.hash → route() → renderCanvasView — flashed the whole
// screen). Re-renders only the canvas contents + file panel + lesson header +
// the active-row highlight, and updates the URL via replaceState so no route()
// fires. Flushes the current lesson's unsaved drawings first.
async function canvasSwitchLesson(state, conceptId, courseId) {
  conceptId = Number(conceptId);
  courseId = (courseId != null && courseId !== '') ? Number(courseId) : state.courseId;
  if (!state || canvasState !== state) return;
  if (conceptId === state.conceptId && courseId === state.courseId) return;

  closeAiConversation(); // round 6: an open conversation card belongs to the lesson we're leaving

  if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
  if (state.dirty) {
    state.dirty = false;
    api.put(`${canvasLayoutApiBase(state)}/canvas`, { data: canvasLayoutDoc(state) })
      .catch((e) => console.error('Canvas: failed to flush layout on lesson switch', e));
  }

  // Schedule origin can cross courses: refresh this course's concept list + notes
  // so the lesson header + note item #0 resolve for the target concept.
  if (courseId !== state.courseId) {
    try {
      const [notes, concepts] = await Promise.all([
        api.get(`/courses/${courseId}/notes`),
        api.get(`/courses/${courseId}/concepts`),
      ]);
      if (canvasState !== state) return;
      state.courseId = courseId;
      state.concepts = concepts;
      state.notesByConceptId = new Map();
      notes.forEach((n) => { if (n.concept_id != null) state.notesByConceptId.set(n.concept_id, n); });
    } catch (e) { /* keep old course data on failure */ }
  }
  if (!state.concepts.some((c) => c.id === conceptId)) return;

  let data;
  try { data = await api.get(`/concepts/${conceptId}/canvas`); }
  catch (e) { data = { layout: null, files: [] }; }
  if (canvasState !== state) return; // left / switched again mid-fetch

  state.conceptId = conceptId;
  if (state.scope) state.scope.id = conceptId; // keep scope.id in sync — this function is concept-scope only
  state.concept = state.concepts.find((c) => c.id === conceptId) || null;
  state.note = state.notesByConceptId.get(conceptId) || null;
  state.files = data.files || [];
  state.filesById = new Map(state.files.map((f) => [f.id, f]));
  state.drawings = (data.layout && data.layout.drawings) || [];
  state.selection = { items: new Set(), drawings: new Set() };
  state.pendingConnectorFrom = null;
  state.historyPast = [];
  state.historyFuture = [];
  state.fileSearch = '';

  // Rebuild ONLY the canvas contents — keep #canvas-vectors + the shell + all
  // the already-wired listeners (canvasWireEvents / search / sort / add-file).
  state.worldEl.querySelectorAll('.canvas-item').forEach((el) => el.remove());
  state.itemsById = new Map();
  canvasBuildItems(state, data.layout);
  canvasRenderVectors(state);
  canvasRenderFileList(state);
  canvasRenderLessonControls(state);

  document.querySelectorAll('.canvas-lesson-row').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.conceptId) === conceptId);
  });
  const titleEl = document.querySelector('.canvas-topbar-title');
  if (titleEl) titleEl.textContent = state.concept ? state.concept.name : 'Lesson';
  const searchInput = document.getElementById('canvas-file-search');
  if (searchInput) searchInput.value = '';

  if (data.layout && data.layout.view) {
    state.tx = data.layout.view.tx || 0;
    state.ty = data.layout.view.ty || 0;
    state.scale = canvasClampScale(data.layout.view.scale || 1);
    canvasApplyTransform(state);
  } else {
    canvasFitToView(state, false);
  }

  state.itemsById.forEach((entry, itemId) => {
    if (entry.refKind === 'canvas-file' && entry.refObj && entry.refObj.status === 'converting') {
      canvasPollFile(state, entry.refObj.id, itemId);
    }
  });

  const q = state.origin === 'schedule' ? '?from=schedule' : '';
  try { history.replaceState(null, '', `#/course/${state.courseId}/canvas/${conceptId}${q}`); } catch (e) { /* ignore */ }
}

function stopCanvas() {
  closeAiConversation(); // round 6: never leave the conversation overlay orphaned across a route change
  const view = document.getElementById('view');
  if (!canvasState) {
    if (view) view.classList.remove('view-fullbleed');
    return;
  }
  const state = canvasState;
  canvasState = null;
  if (state._panRaf) { cancelAnimationFrame(state._panRaf); state._panRaf = null; }
  if (state.saveTimer) { clearTimeout(state.saveTimer); state.saveTimer = null; }
  if (state.dirty) {
    state.dirty = false;
    api.put(`${canvasLayoutApiBase(state)}/canvas`, { data: canvasLayoutDoc(state) }).catch((e) => {
      console.error('Canvas: failed to flush layout on close', e);
    });
  }
  if (state._cleanup) state._cleanup();
  if (view) view.classList.remove('view-fullbleed');
}

/* ---------- infinite canvas: whiteboard vector layer (Build 9 Phase 3) ----------
   Spec: frontend/CANVAS.md §4.3 (drawings[] shapes), §9 (tool set), §10
   (layering). Conceptually the reader annotation engine (app.js ~1608+):
   one flat insertion-ordered array (`state.drawings`), repaint-from-model,
   pop-based undo (here a full snapshot stack instead, per the task spec),
   a contentEditable inline text editor, and a debounced save via the
   existing markCanvasDirty()/canvasFlushSave() (unchanged — canvasLayoutDoc
   already serializes `state.drawings` verbatim). Adapted: world coords (not
   page fractions) and SVG DOM nodes (not a 2-D canvas), so shapes/text/
   connectors are individually addressable and connectors can re-route when
   an item moves.

   #canvas-vectors is a 0×0, `overflow:visible` <svg> positioned at inset:0
   inside #canvas-world — its own local coordinate system (no viewBox) is
   1 unit = 1 CSS px anchored at world (0,0), exactly matching the raw
   world-space left/top every .canvas-item already uses, so every drawing's
   stored x/y/points/etc. map directly onto SVG attributes with no extra math.
   Because the <svg> element's own box is 0×0, it never blocks pointer events
   on items or the canvas surface just by being stacked above them (nothing
   there to hit-test) — real interaction for every tool is driven off
   pointer listeners on state.scrollEl (a normal, fully-sized element, same
   as the existing pan/item-drag code) using canvasScreenToWorld() to convert
   screen points, with eraser hit-testing done against the `drawings` model
   (canvasHitTestDrawing) rather than DOM pointer targeting. The exception is
   committed text/sticky notes, which render into a <foreignObject> — real
   embedded HTML with its own genuine box — so double-click-to-edit works
   regardless of the SVG's own pointer-events state. */

function canvasNewDrawingId() { return 'dr_' + Math.random().toString(36).slice(2, 10); }

function canvasSvgEl(tag, attrs) {
  const el = document.createElementNS(CANVAS_SVG_NS, tag);
  if (attrs) Object.keys(attrs).forEach((k) => el.setAttribute(k, attrs[k]));
  return el;
}

/* ---- toolbar: tool/color/stroke selection + undo/redo (mirrors the
   reader's readerToolbarHtml/readerSetTool/readerSetColor) ---- */

function canvasToolIcon(tool) {
  const paths = {
    select: '<path d="M5 3l6 16 2-7 7-2-15-7z"/>',
    pen: '<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    text: '<path d="M5 6h14"/><path d="M12 6v14"/><path d="M9 20h6"/>',
    sticky: '<path d="M4 4h13l3 3v13H4z"/><path d="M17 4v4h4"/>',
    rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    ellipse: '<ellipse cx="12" cy="12" rx="8" ry="6"/>',
    line: '<path d="M5 19L19 5"/>',
    arrow: '<path d="M5 19L19 5"/><path d="M19 5h-6"/><path d="M19 5v6"/>',
    connector: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="17" r="2"/><path d="M8 8l8 8"/>',
    eraser: '<path d="M18 13l-7 7H7l-4-4a2 2 0 0 1 0-2.8L13 3l7 7-2 3z"/><path d="M9.5 7.5l7 7"/>',
  };
  return paths[tool] || '';
}

function canvasToolTitle(tool) {
  const titles = {
    select: 'Select / pan',
    pen: 'Pen',
    text: 'Text note',
    sticky: 'Sticky note',
    rect: 'Rectangle',
    ellipse: 'Ellipse',
    line: 'Line',
    arrow: 'Arrow',
    connector: 'Connector (click two items)',
    eraser: 'Eraser',
  };
  return titles[tool] || tool;
}

function canvasToolbarHtml(state) {
  const toolBtns = CANVAS_TOOLS.map((tool) => `
    <button data-action="canvas-tool" data-tool="${tool}" title="${esc(canvasToolTitle(tool))}" aria-label="${esc(canvasToolTitle(tool))}"
      class="canvas-tool-btn${state.tool === tool ? ' canvas-tool-btn-active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${canvasToolIcon(tool)}</svg>
    </button>`).join('');
  const swatches = CANVAS_COLORS.map((c) => `
    <button data-action="canvas-color" data-color="${c}" title="Color" aria-label="Color"
      class="canvas-swatch${state.color === c ? ' canvas-swatch-active' : ''}" style="background:${c}"></button>`).join('');
  const strokeBtns = CANVAS_STROKE_WIDTHS.map((w) => `
    <button data-action="canvas-stroke" data-width="${w}" title="Stroke width" aria-label="Stroke width"
      class="canvas-stroke-btn${state.strokeWidth === w ? ' canvas-stroke-btn-active' : ''}">
      <span class="canvas-stroke-dot" style="width:${Math.min(14, w + 4)}px;height:${Math.min(14, w + 4)}px"></span>
    </button>`).join('');
  return `
    <div class="canvas-toolbar" id="canvas-toolbar">
      <div class="canvas-toolbar-group">${toolBtns}</div>
      <span class="canvas-toolbar-sep"></span>
      <div class="canvas-toolbar-group">${swatches}</div>
      <span class="canvas-toolbar-sep"></span>
      <div class="canvas-toolbar-group">${strokeBtns}</div>
      <span class="canvas-toolbar-sep"></span>
      <div class="canvas-toolbar-group">
        <button data-action="canvas-undo" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo (Ctrl/Cmd+Z)" class="canvas-tool-btn"${state.historyPast.length ? '' : ' disabled'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>
        </button>
        <button data-action="canvas-redo" title="Redo (Ctrl/Cmd+Shift+Z)" aria-label="Redo (Ctrl/Cmd+Shift+Z)" class="canvas-tool-btn"${state.historyFuture.length ? '' : ' disabled'}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h2"/></svg>
        </button>
      </div>
    </div>`;
}

function canvasRenderToolbar(state) {
  const host = document.getElementById('canvas-toolbar-host');
  if (host) host.innerHTML = canvasToolbarHtml(state);
}

function canvasSetTool(state, tool) {
  if (!state || !CANVAS_TOOLS.includes(tool) || state.tool === tool) return;
  if (state.tool === 'connector' && state.pendingConnectorFrom) canvasConnectorCancel(state);
  state.tool = tool;
  const shell = state.scrollEl && state.scrollEl.closest('.canvas-shell');
  if (shell) {
    CANVAS_TOOLS.forEach((t) => shell.classList.remove('canvas-tool-' + t));
    shell.classList.add('canvas-tool-' + tool);
  }
  canvasRenderToolbar(state);
}

function canvasSetColor(state, color) {
  if (!state) return;
  state.color = color;
  canvasRenderToolbar(state);
}

function canvasSetStroke(state, width) {
  if (!state) return;
  state.strokeWidth = Number(width);
  canvasRenderToolbar(state);
}

/* ---- history: snapshot-the-whole-array undo/redo (§9 "Undo/redo: array
   history") — simpler and more robust than per-field undo, and the model is
   small enough per lesson for this to stay cheap. ---- */

function canvasSnapshotHistory(state) {
  state.historyPast.push(JSON.stringify(state.drawings));
  if (state.historyPast.length > CANVAS_HISTORY_CAP) state.historyPast.shift();
  state.historyFuture = [];
}

function canvasUndo(state) {
  if (!state || !state.historyPast.length) return;
  state.historyFuture.push(JSON.stringify(state.drawings));
  state.drawings = JSON.parse(state.historyPast.pop());
  canvasRenderVectors(state);
  canvasRenderToolbar(state);
  markCanvasDirty(state);
}

function canvasRedo(state) {
  if (!state || !state.historyFuture.length) return;
  state.historyPast.push(JSON.stringify(state.drawings));
  state.drawings = JSON.parse(state.historyFuture.pop());
  canvasRenderVectors(state);
  canvasRenderToolbar(state);
  markCanvasDirty(state);
}

/* ---- connector anchoring: nearest-side/center intersection between two
   item rects, recomputed every repaint so a connector always follows its
   items (CANVAS.md §4.3). ---- */

function canvasDrawingItemRect(state, itemId) {
  const entry = state.itemsById.get(itemId);
  if (!entry) return null;
  return { x: entry.data.x, y: entry.data.y, w: entry.data.w, h: entry.data.h };
}

function canvasRectBoundaryPoint(rect, towardX, towardY) {
  const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
  const dx = towardX - cx, dy = towardY - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const halfW = Math.max(1, rect.w / 2), halfH = Math.max(1, rect.h / 2);
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// Returns [pointOnA, pointOnB] where each item's boundary is crossed by the
// line between the two rects' centers — a simple, correct "nearest side"
// anchor that re-derives itself from each item's CURRENT rect every call.
function canvasConnectorAnchorPoints(rectA, rectB) {
  const centerA = { x: rectA.x + rectA.w / 2, y: rectA.y + rectA.h / 2 };
  const centerB = { x: rectB.x + rectB.w / 2, y: rectB.y + rectB.h / 2 };
  return [
    canvasRectBoundaryPoint(rectA, centerB.x, centerB.y),
    canvasRectBoundaryPoint(rectB, centerA.x, centerA.y),
  ];
}

function canvasConnectorPoints(state, drawing) {
  const a = canvasDrawingItemRect(state, drawing.from);
  const b = canvasDrawingItemRect(state, drawing.to);
  if (!a || !b) return null; // an endpoint item no longer exists — skip rendering (defensive; should be dropped already)
  return canvasConnectorAnchorPoints(a, b);
}

// Fix 3 (Build 14 Phase B): point-in-rect / segment-vs-segment / segment-vs-rect
// helpers used only to decide whether a connector's straight chord would visibly
// cross another board item (see canvasConnectorPathD below).
function canvasPointInRect(p, rect) {
  return p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h;
}

function canvasSegSegIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (denom === 0) return false; // parallel/collinear — ignore the edge-overlap case, not worth the extra branching here
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

// True if the p0→p1 segment enters `rect` (expanded by `margin` on every
// side) — either endpoint lands inside it, or the segment crosses one of its
// four edges.
function canvasSegIntersectsRect(p0, p1, rect, margin) {
  const m = margin || 0;
  const exp = { x: rect.x - m, y: rect.y - m, w: rect.w + m * 2, h: rect.h + m * 2 };
  if (canvasPointInRect(p0, exp) || canvasPointInRect(p1, exp)) return true;
  const c = [
    { x: exp.x, y: exp.y }, { x: exp.x + exp.w, y: exp.y },
    { x: exp.x + exp.w, y: exp.y + exp.h }, { x: exp.x, y: exp.y + exp.h },
  ];
  for (let i = 0; i < 4; i++) {
    if (canvasSegSegIntersect(p0, p1, c[i], c[(i + 1) % 4])) return true;
  }
  return false;
}

// Visual fixes round (+ Fix 3, reworked): connectors are STRAIGHT by default;
// they only bow into a smooth quadratic bezier when the straight chord would
// visibly cross another board item (obstacles = every item EXCEPT the
// connector's own two endpoints, so the anchors sitting on their own item's
// boundary never count as a "hit"). The manual arrow tool stays straight
// unconditionally — see the `arrow` branch in canvasBuildDrawingEl, untouched.
//
// Superseded the earlier "bow at the chord midpoint by a fixed chord-length
// fraction, first hit only" approach — it only cleared ~30px and a large or
// off-center obstacle (not dead-center on the chord) still got crossed. Now:
// (1) every obstacle the chord crosses is considered, routing around
//     whichever one's center sits closest to the chord line (most "in the
//     way"), not just whichever was hit first;
// (2) the bow's peak is based over the obstacle's own center (projected onto
//     the chord), not the chord's midpoint, so an off-center obstacle is
//     still actually cleared;
// (3) the control-point offset is grown (sampling the resulting quadratic at
//     16 points) until no sampled point lands inside the obstacle's expanded
//     rect — a guarantee the curve clears it, not just a fixed-size guess.
function canvasConnectorPathD(state, drawing, pts) {
  if (!pts) return '';
  const [p0, p1] = pts;
  const straight = `M ${p0.x} ${p0.y} L ${p1.x} ${p1.y}`;
  if (!(state && state.itemsById && drawing)) return straight;

  const margin = 12;
  // Obstacles = non-endpoint items whose expanded rect the straight chord crosses.
  const obstacles = [];
  for (const [itemId, entry] of state.itemsById) {
    if (itemId === drawing.from || itemId === drawing.to) continue;
    const d = entry && entry.data;
    if (!d) continue;
    const rect = { x: d.x, y: d.y, w: d.w, h: d.h };
    if (canvasSegIntersectsRect(p0, p1, rect, margin)) obstacles.push(rect);
  }
  if (!obstacles.length) return straight;

  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len; // unit along the chord
  let nx = -uy, ny = ux; // unit normal (perpendicular to the chord)

  // Route around whichever obstacle's center is closest to the chord line
  // (most "in the way").
  const perpDist = (r) => {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    return Math.abs((cx - p0.x) * nx + (cy - p0.y) * ny);
  };
  obstacles.sort((a, b) => perpDist(a) - perpDist(b));
  const obs = obstacles[0];
  const ocx = obs.x + obs.w / 2, ocy = obs.y + obs.h / 2;

  // Base = the obstacle center's projection onto the chord — where the bow
  // should peak (not necessarily the chord's own midpoint).
  let tproj = (ocx - p0.x) * ux + (ocy - p0.y) * uy;
  tproj = Math.max(0, Math.min(len, tproj));
  const baseX = p0.x + ux * tproj, baseY = p0.y + uy * tproj;
  // Choose the normal side that points AWAY from the obstacle center.
  if (nx * (baseX - ocx) + ny * (baseY - ocy) < 0) { nx = -nx; ny = -ny; }

  // How far (along the chosen normal, from `base`) the expanded obstacle
  // extends — its farthest corner sets the minimum clearance the bow needs.
  const exp = { x: obs.x - margin, y: obs.y - margin, w: obs.w + margin * 2, h: obs.h + margin * 2 };
  const corners = [
    { x: exp.x, y: exp.y }, { x: exp.x + exp.w, y: exp.y },
    { x: exp.x + exp.w, y: exp.y + exp.h }, { x: exp.x, y: exp.y + exp.h },
  ];
  let maxClear = 0;
  for (const c of corners) {
    const dd = (c.x - baseX) * nx + (c.y - baseY) * ny;
    if (dd > maxClear) maxClear = dd;
  }
  let apexOffset = maxClear + 18; // clearance past the obstacle's far edge

  // Grow the control-point offset until the sampled quadratic no longer
  // enters the obstacle's expanded rect anywhere along its length —
  // guarantees "around", not just "roughly toward".
  const build = (off) => {
    const cx = baseX + nx * off * 2, cy = baseY + ny * off * 2; // quad apex ~= half the control-point offset
    let clear = true;
    for (let i = 1; i < 16; i++) {
      const t = i / 16, mt = 1 - t;
      const sx = mt * mt * p0.x + 2 * mt * t * cx + t * t * p1.x;
      const sy = mt * mt * p0.y + 2 * mt * t * cy + t * t * p1.y;
      if (canvasPointInRect({ x: sx, y: sy }, exp)) { clear = false; break; }
    }
    return { cx, cy, clear };
  };
  let r = build(apexOffset), tries = 0;
  while (!r.clear && tries < 5) { apexOffset *= 1.4; r = build(apexOffset); tries++; }
  return `M ${p0.x} ${p0.y} Q ${r.cx.toFixed(1)} ${r.cy.toFixed(1)} ${p1.x} ${p1.y}`;
}

// Cheap per-frame update during an item drag/resize: just moves the existing
// connector <line> DOM nodes' endpoints, no full rebuild — canvasRenderVectors
// still runs once on drag-end via the item's own markCanvasDirty path... no,
// markCanvasDirty only persists; the full repaint already happened at
// mount/mutation time and connectors don't themselves change, so this alone
// keeps them visually correct through the whole drag with no extra rebuild.
function canvasUpdateConnectors(state) {
  if (!state.vectorNodes || !state.vectorNodes.size) return;
  state.drawings.forEach((d) => {
    if (d.type !== 'connector') return;
    const el = state.vectorNodes.get(d.id);
    if (!el) return;
    const pts = canvasConnectorPoints(state, d);
    if (!pts) return;
    el.setAttribute('d', canvasConnectorPathD(state, d, pts));
  });
}

// Drops every connector referencing `itemId` (an item that just stopped
// existing on the board) — CANVAS.md §4.3. Returns true if anything changed.
function canvasDropConnectorsForItem(state, itemId) {
  const before = state.drawings.length;
  state.drawings = state.drawings.filter((d) => !(d.type === 'connector' && (d.from === itemId || d.to === itemId)));
  if (state.drawings.length === before) return false;
  canvasRenderVectors(state);
  return true;
}

/* ---- connector two-click pick flow ---- */

function canvasConnectorClearPendingVisual(state) {
  if (!state.pendingConnectorFrom) return;
  const entry = state.itemsById.get(state.pendingConnectorFrom);
  if (entry) entry.el.classList.remove('canvas-connector-pending');
}

function canvasConnectorCancel(state) {
  canvasConnectorClearPendingVisual(state);
  state.pendingConnectorFrom = null;
}

function canvasConnectorPick(state, itemId) {
  if (!state.pendingConnectorFrom) {
    state.pendingConnectorFrom = itemId;
    const entry = state.itemsById.get(itemId);
    if (entry) entry.el.classList.add('canvas-connector-pending');
    return;
  }
  if (state.pendingConnectorFrom === itemId) { canvasConnectorCancel(state); return; } // re-click same item cancels
  const from = state.pendingConnectorFrom;
  canvasConnectorClearPendingVisual(state);
  state.pendingConnectorFrom = null;
  canvasSnapshotHistory(state);
  state.drawings.push({ id: canvasNewDrawingId(), type: 'connector', color: CANVAS_CONNECTOR_COLOR, stroke: state.strokeWidth, from, to: itemId });
  canvasRenderVectors(state);
  markCanvasDirty(state);
}

/* ---- arrowhead markers: one <marker> per distinct color, created lazily
   into #canvas-vectors-defs and reused (SVG markers can't just take
   currentColor reliably across browsers, so a tiny per-color marker is the
   simplest portable approach). ---- */

function canvasArrowMarkerId(state, color) {
  const id = 'canvas-arrowhead-' + color.replace(/[^a-zA-Z0-9]/g, '');
  if (state.vectorsDefs && !state.vectorsDefs.querySelector('#' + id)) {
    const marker = canvasSvgEl('marker', {
      id, viewBox: '0 0 10 10', refX: '8', refY: '5',
      markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse',
    });
    marker.appendChild(canvasSvgEl('path', { d: 'M0,0 L10,5 L0,10 z', fill: color }));
    state.vectorsDefs.appendChild(marker);
  }
  return id;
}

/* ---- building + repainting SVG nodes from the model (repaint-from-model,
   like the reader's redrawPage) ---- */

function canvasBuildDrawingEl(state, d, isPreview) {
  const strokeW = d.stroke || 2;
  let el = null;
  if (d.type === 'pen') {
    const pts = (d.points || []).map((p) => `${p.x},${p.y}`).join(' ');
    if (!pts) return null;
    el = canvasSvgEl('polyline', { points: pts, fill: 'none', stroke: d.color, 'stroke-width': strokeW, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  } else if (d.type === 'rect') {
    el = canvasSvgEl('rect', { x: d.x, y: d.y, width: Math.max(0, d.w), height: Math.max(0, d.h), fill: (d.fill && d.fill !== 'none') ? d.fill : 'none', stroke: d.color, 'stroke-width': strokeW });
  } else if (d.type === 'ellipse') {
    el = canvasSvgEl('ellipse', { cx: d.x + d.w / 2, cy: d.y + d.h / 2, rx: Math.max(0, d.w / 2), ry: Math.max(0, d.h / 2), fill: (d.fill && d.fill !== 'none') ? d.fill : 'none', stroke: d.color, 'stroke-width': strokeW });
  } else if (d.type === 'line') {
    el = canvasSvgEl('line', { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, stroke: d.color, 'stroke-width': strokeW, 'stroke-linecap': 'round' });
  } else if (d.type === 'arrow') {
    el = canvasSvgEl('line', { x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2, stroke: d.color, 'stroke-width': strokeW, 'stroke-linecap': 'round', 'marker-end': `url(#${canvasArrowMarkerId(state, d.color)})` });
  } else if (d.type === 'connector') {
    const pts = canvasConnectorPoints(state, d);
    if (!pts) return null;
    // Round 9: always neon purple (+ a glow via the .canvas-connector-line class),
    // regardless of the color stored on the drawing — distinct from the arrow tool.
    // Visual fixes round: a smooth quadratic-bezier <path> instead of a straight
    // <line> (the manual `arrow` branch above is untouched and stays straight).
    el = canvasSvgEl('path', { d: canvasConnectorPathD(state, d, pts), fill: 'none', stroke: CANVAS_CONNECTOR_COLOR, 'stroke-width': strokeW, 'stroke-linecap': 'round', 'marker-end': `url(#${canvasArrowMarkerId(state, CANVAS_CONNECTOR_COLOR)})` });
    el.setAttribute('class', 'canvas-connector-line');
  } else if (d.type === 'text') {
    const w = Math.max(40, (d.text || '').length * (d.size || CANVAS_TEXT_SIZE) * 0.62 + 16);
    const h = (d.size || CANVAS_TEXT_SIZE) * 1.6 + 8;
    const fo = canvasSvgEl('foreignObject', { x: d.x, y: d.y, width: w, height: h });
    const div = document.createElementNS(CANVAS_XHTML_NS, 'div');
    div.className = 'canvas-drawing-text';
    div.style.color = d.color;
    div.style.fontSize = (d.size || CANVAS_TEXT_SIZE) + 'px';
    div.style.fontWeight = d.bold ? '700' : '400'; // round 8 item 6: whole-note formatting
    div.style.fontStyle = d.italic ? 'italic' : 'normal';
    div.textContent = d.text || '';
    if (!isPreview) div.addEventListener('dblclick', (e) => { e.stopPropagation(); canvasEditDrawingText(state, d); });
    fo.appendChild(div);
    el = fo;
  } else if (d.type === 'sticky') {
    const g = canvasSvgEl('g', {});
    g.appendChild(canvasSvgEl('rect', { x: d.x, y: d.y, width: Math.max(1, d.w), height: Math.max(1, d.h), fill: d.color, stroke: canvasBorderStrongColor(), 'stroke-width': 1.5, rx: 6 }));
    const fo = canvasSvgEl('foreignObject', { x: d.x + 8, y: d.y + 8, width: Math.max(1, d.w - 16), height: Math.max(1, d.h - 16) });
    const div = document.createElementNS(CANVAS_XHTML_NS, 'div');
    div.className = 'canvas-sticky-text';
    // Round 8 item 6: a sticky's font-size/bold/italic are now part of the
    // model too (previously the fixed 0.8rem from .canvas-sticky-text with no
    // way to change it) — 15 matches the size canvasEditDrawingText already
    // used as the sticky editor's default.
    div.style.fontSize = (d.size || 15) + 'px';
    div.style.fontWeight = d.bold ? '700' : '400';
    div.style.fontStyle = d.italic ? 'italic' : 'normal';
    div.textContent = d.text || '';
    if (!isPreview) div.addEventListener('dblclick', (e) => { e.stopPropagation(); canvasEditDrawingText(state, d); });
    fo.appendChild(div);
    g.appendChild(fo);
    if (!isPreview) {
      // A small bottom-right handle to signal the sticky is resizable (drag it —
      // or anywhere near the corner — to resize; the drag itself is handled by
      // canvasStartDrawingManipulate via world hit-testing, not this element).
      const hs = 12;
      g.appendChild(canvasSvgEl('rect', {
        x: d.x + Math.max(1, d.w) - hs, y: d.y + Math.max(1, d.h) - hs,
        width: hs, height: hs, fill: 'rgba(0,0,0,.28)', rx: 2,
      }));
    }
    el = g;
  }
  if (el) {
    if (d.id) el.dataset.drawingId = d.id;
    if (isPreview) el.setAttribute('opacity', '0.65');
    // Selection Core: a selected-drawing halo, since SVG has no built-in
    // "selected" pseudo-class — canvasRenderVectors rebuilds every drawing's
    // element wholesale each repaint, so re-checking membership here is the
    // single place this needs to live (mirrors .canvas-item.selected for
    // item cards; see .canvas-drawing-selected in canvas.css).
    if (!isPreview && d.id && state.selection && state.selection.drawings.has(d.id)) el.classList.add('canvas-drawing-selected');
  }
  return el;
}

// Full repaint from `state.drawings` (+ an optional in-progress, uncommitted
// `preview` drawing on top for live feedback while dragging). Rebuilds
// state.vectorNodes so canvasUpdateConnectors() has fresh DOM refs.
function canvasRenderVectors(state, preview) {
  const g = state.vectorsG;
  if (!g) return;
  g.innerHTML = '';
  const nodes = new Map();
  (state.drawings || []).forEach((d) => {
    const el = canvasBuildDrawingEl(state, d, false);
    if (!el) return;
    g.appendChild(el);
    if (d.id) nodes.set(d.id, el);
  });
  if (preview) {
    const el = canvasBuildDrawingEl(state, preview, true);
    if (el) g.appendChild(el);
  }
  state.vectorNodes = nodes;
  canvasUpdateEmptyHint(state); // F3: covers every drawing add/erase/undo/redo + the initial build/lesson-switch paint
}

/* ---- eraser: model-based hit-testing (mirrors the reader's readerHitTest/
   readerEraseAt) — "topmost" = last-inserted matching entry, since later
   drawings paint over earlier ones. ---- */

function canvasPtNearSegment(pt, a, b, tol) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq ? ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const px = a.x + t * dx, py = a.y + t * dy;
  return Math.hypot(pt.x - px, pt.y - py) <= tol;
}

function canvasDrawingBounds(d) {
  if (d.type === 'rect' || d.type === 'ellipse' || d.type === 'sticky') return { x: d.x, y: d.y, w: d.w, h: d.h };
  if (d.type === 'text') return { x: d.x, y: d.y, w: Math.max(40, (d.text || '').length * (d.size || CANVAS_TEXT_SIZE) * 0.62 + 16), h: (d.size || CANVAS_TEXT_SIZE) * 1.6 + 8 };
  if (d.type === 'pen') {
    if (!d.points || !d.points.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    d.points.forEach((p) => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y); });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }
  if (d.type === 'line' || d.type === 'arrow') return { x: Math.min(d.x1, d.x2), y: Math.min(d.y1, d.y2), w: Math.abs(d.x2 - d.x1), h: Math.abs(d.y2 - d.y1) };
  return null;
}

function canvasHitTestDrawing(state, d, pt, tol) {
  if (d.type === 'pen') {
    const pts = d.points || [];
    for (let i = 1; i < pts.length; i++) if (canvasPtNearSegment(pt, pts[i - 1], pts[i], Math.max(tol, d.stroke || 2))) return true;
    return false;
  }
  if (d.type === 'line' || d.type === 'arrow') {
    return canvasPtNearSegment(pt, { x: d.x1, y: d.y1 }, { x: d.x2, y: d.y2 }, Math.max(tol, d.stroke || 2));
  }
  if (d.type === 'connector') {
    const pts = canvasConnectorPoints(state, d);
    if (!pts) return false;
    return canvasPtNearSegment(pt, pts[0], pts[1], Math.max(tol, d.stroke || 2));
  }
  if (d.type === 'rect') {
    const nearLeft = Math.abs(pt.x - d.x) <= tol && pt.y >= d.y - tol && pt.y <= d.y + d.h + tol;
    const nearRight = Math.abs(pt.x - (d.x + d.w)) <= tol && pt.y >= d.y - tol && pt.y <= d.y + d.h + tol;
    const nearTop = Math.abs(pt.y - d.y) <= tol && pt.x >= d.x - tol && pt.x <= d.x + d.w + tol;
    const nearBottom = Math.abs(pt.y - (d.y + d.h)) <= tol && pt.x >= d.x - tol && pt.x <= d.x + d.w + tol;
    return nearLeft || nearRight || nearTop || nearBottom;
  }
  if (d.type === 'ellipse') {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2, rx = Math.max(1, d.w / 2), ry = Math.max(1, d.h / 2);
    const nx = (pt.x - cx) / rx, ny = (pt.y - cy) / ry;
    const dist = Math.sqrt(nx * nx + ny * ny);
    return Math.abs(dist - 1) <= (tol / Math.min(rx, ry));
  }
  if (d.type === 'sticky') {
    return pt.x >= d.x - tol && pt.x <= d.x + d.w + tol && pt.y >= d.y - tol && pt.y <= d.y + d.h + tol;
  }
  if (d.type === 'text') {
    const b = canvasDrawingBounds(d);
    if (!b) return false;
    return pt.x >= b.x - tol && pt.x <= b.x + b.w + tol && pt.y >= b.y - tol && pt.y <= b.y + b.h + tol;
  }
  return false;
}

const CANVAS_ERASER_TOL = 8; // world px hit tolerance

function canvasEraseAt(state, pt) {
  let hitIdx = -1;
  state.drawings.forEach((d, i) => { if (canvasHitTestDrawing(state, d, pt, CANVAS_ERASER_TOL)) hitIdx = i; }); // keep last match = topmost
  if (hitIdx === -1) return false;
  canvasSnapshotHistory(state);
  state.drawings.splice(hitIdx, 1);
  canvasRenderVectors(state);
  canvasRenderToolbar(state);
  markCanvasDirty(state);
  return true;
}

function canvasEraserPointerDown(state, e) {
  const rect = state.scrollEl.getBoundingClientRect();
  const hit = (ev) => canvasEraseAt(state, canvasScreenToWorld(state, ev.clientX - rect.left, ev.clientY - rect.top));
  hit(e);
  const onMove = (ev) => { if (canvasState === state) hit(ev); };
  const onUp = () => {
    state.scrollEl.removeEventListener('pointermove', onMove);
    state.scrollEl.removeEventListener('pointerup', onUp);
    state.scrollEl.removeEventListener('pointercancel', onUp);
  };
  state.scrollEl.addEventListener('pointermove', onMove);
  state.scrollEl.addEventListener('pointerup', onUp);
  state.scrollEl.addEventListener('pointercancel', onUp);
}

/* ---- whole-note text formatting toolbar (round 8 item 6) ----
   A tiny floating bar shown ONLY while canvasOpenDrawingEditor's world-space
   text editor is open — a font-size stepper + Bold/Italic toggles. Mounted
   to document.body in SCREEN coordinates (not into #canvas-world), so it
   doesn't pan/zoom away with the editor while writing; repositioned against
   the editor's live bounding box (its size can change as the font size
   changes). The `fmt` object is mutated in place and read back by the
   caller's onCommit, so no separate onChange plumbing is needed. ---- */
const CANVAS_TEXT_FORMAT_SIZE_MIN = 12;
const CANVAS_TEXT_FORMAT_SIZE_MAX = 48;
const CANVAS_TEXT_FORMAT_SIZE_STEP = 2;

function canvasTextFormatToolbarHtml(fmt) {
  return `
    <button type="button" class="canvas-fmt-btn" data-fmt="size-dec" title="Smaller">&minus;</button>
    <span class="canvas-fmt-size" data-fmt-size>${fmt.size}</span>
    <button type="button" class="canvas-fmt-btn" data-fmt="size-inc" title="Larger">+</button>
    <span class="canvas-fmt-sep"></span>
    <button type="button" class="canvas-fmt-btn canvas-fmt-toggle${fmt.bold ? ' active' : ''}" data-fmt="bold" title="Bold"><b>B</b></button>
    <button type="button" class="canvas-fmt-btn canvas-fmt-toggle${fmt.italic ? ' active' : ''}" data-fmt="italic" title="Italic"><i>I</i></button>`;
}

// Mounts the toolbar just above `editor` (flips below if there's no room),
// wires its controls to mutate `fmt` and restyle `editor` LIVE, and returns a
// teardown function the caller runs when the edit session ends (commit or
// cancel) either way.
function canvasMountTextFormatToolbar(editor, fmt) {
  const bar = document.createElement('div');
  bar.className = 'canvas-fmt-toolbar';
  bar.innerHTML = canvasTextFormatToolbarHtml(fmt);
  document.body.appendChild(bar);

  const position = () => {
    const r = editor.getBoundingClientRect();
    const bw = bar.offsetWidth, bh = bar.offsetHeight;
    let top = r.top - bh - 8;
    if (top < 4) top = r.bottom + 8; // flip below if there's no room above
    const left = Math.max(4, Math.min(r.left, window.innerWidth - bw - 4));
    bar.style.left = left + 'px';
    bar.style.top = top + 'px';
  };
  requestAnimationFrame(position);

  const applyLive = () => {
    editor.style.fontSize = fmt.size + 'px';
    editor.style.fontWeight = fmt.bold ? '700' : '400';
    editor.style.fontStyle = fmt.italic ? 'italic' : 'normal';
    const sizeEl = bar.querySelector('[data-fmt-size]');
    if (sizeEl) sizeEl.textContent = fmt.size;
    const boldBtn = bar.querySelector('[data-fmt="bold"]');
    if (boldBtn) boldBtn.classList.toggle('active', fmt.bold);
    const italicBtn = bar.querySelector('[data-fmt="italic"]');
    if (italicBtn) italicBtn.classList.toggle('active', fmt.italic);
    requestAnimationFrame(position); // the editor's box can resize with the font
  };

  // Prevent the editor from losing focus (which commits/ends the edit) when
  // clicking a toolbar control — same trick as a toolbar next to any
  // contentEditable: preventDefault on mousedown stops the browser from
  // moving focus at all, so no blur ever fires on the editor.
  bar.addEventListener('mousedown', (e) => e.preventDefault());
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-fmt]');
    if (!btn) return;
    const action = btn.dataset.fmt;
    if (action === 'size-inc') fmt.size = Math.min(CANVAS_TEXT_FORMAT_SIZE_MAX, fmt.size + CANVAS_TEXT_FORMAT_SIZE_STEP);
    else if (action === 'size-dec') fmt.size = Math.max(CANVAS_TEXT_FORMAT_SIZE_MIN, fmt.size - CANVAS_TEXT_FORMAT_SIZE_STEP);
    else if (action === 'bold') fmt.bold = !fmt.bold;
    else if (action === 'italic') fmt.italic = !fmt.italic;
    applyLive();
  });

  return () => bar.remove();
}

/* ---- inline text editor: a contentEditable div in WORLD coords, appended
   directly into #canvas-world so it pans/zooms with everything else (mirrors
   the reader's readerPlaceTextBox — commit on blur/Enter, Esc cancels and
   must not bubble to any close handler). Used for both the text tool (fresh
   note) and re-editing an existing text/sticky note (double-click). Round 8
   item 6: also mounts the whole-note format toolbar above it and passes the
   live-edited {size,bold,italic} back to onCommit as a second argument. ---- */

function canvasOpenDrawingEditor(state, opts, onCommit) {
  // Round 9: never open a second editor — the scroll-surface re-edit path and the
  // foreignObject dblclick fallback can both fire for a single double-click.
  if (state.worldEl && state.worldEl.querySelector('.canvas-text-editor')) return null;
  const editor = document.createElement('div');
  editor.className = 'canvas-text-editor';
  editor.contentEditable = 'true';
  editor.style.left = opts.x + 'px';
  editor.style.top = opts.y + 'px';
  editor.style.color = opts.color;
  const fmt = { size: opts.size || CANVAS_TEXT_SIZE, bold: !!opts.bold, italic: !!opts.italic };
  editor.style.fontSize = fmt.size + 'px';
  editor.style.fontWeight = fmt.bold ? '700' : '400';
  editor.style.fontStyle = fmt.italic ? 'italic' : 'normal';
  // A sticky note wraps text INSIDE its box: fix the editor width to the box so
  // it wraps like the committed note (the free text tool leaves this unset and
  // grows via max-content instead).
  if (opts.wrapWidth) {
    editor.style.width = opts.wrapWidth + 'px';
    editor.style.maxWidth = 'none';
    editor.style.whiteSpace = 'pre-wrap';
    editor.style.wordBreak = 'break-word';
  }
  if (opts.text) editor.textContent = opts.text;
  state.worldEl.appendChild(editor);
  editor.focus();
  if (opts.text) {
    try {
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) { /* ignore */ }
  }

  const destroyToolbar = canvasMountTextFormatToolbar(editor, fmt);

  let settled = false;
  const commit = () => {
    if (settled) return;
    settled = true;
    destroyToolbar();
    const text = editor.textContent.trim();
    editor.remove();
    onCommit(text, fmt);
  };
  editor.addEventListener('blur', commit);
  editor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editor.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); settled = true; destroyToolbar(); editor.remove(); }
    e.stopPropagation(); // don't let Escape/Enter bubble to the canvas's own key handler
  });
  return editor;
}

function canvasPlaceTextNote(state, pt) {
  canvasSetTool(state, 'select'); // so a click-away commits instead of dropping another text box
  canvasOpenDrawingEditor(state, { x: pt.x, y: pt.y, color: state.color, size: CANVAS_TEXT_SIZE }, (text, fmt) => {
    if (!text) { canvasRenderVectors(state); return; }
    canvasSnapshotHistory(state);
    state.drawings.push({ id: canvasNewDrawingId(), type: 'text', color: state.color, x: pt.x, y: pt.y, size: fmt.size, bold: fmt.bold, italic: fmt.italic, text });
    canvasRenderVectors(state);
    canvasRenderToolbar(state);
    markCanvasDirty(state);
  });
}

// Re-edit an existing text/sticky note's text (double-click on its rendered
// foreignObject content). An emptied text note is dropped entirely; an
// emptied sticky just keeps its (now-empty) box, matching the data model.
// Round 8 item 6: also preloads the note's saved size/bold/italic into the
// editor + format toolbar, and persists any format-only change (even with
// the text left untouched).
function canvasEditDrawingText(state, d) {
  if (canvasState !== state) return;
  const before = d.text || '';
  const beforeFmt = { size: d.size || (d.type === 'sticky' ? 15 : CANVAS_TEXT_SIZE), bold: !!d.bold, italic: !!d.italic };
  canvasOpenDrawingEditor(state, {
    x: d.type === 'sticky' ? d.x + 8 : d.x,
    y: d.type === 'sticky' ? d.y + 8 : d.y,
    color: d.type === 'sticky' ? 'var(--text)' : d.color,
    size: beforeFmt.size,
    bold: beforeFmt.bold,
    italic: beforeFmt.italic,
    text: before,
    wrapWidth: d.type === 'sticky' ? Math.max(40, (d.w || 180) - 16) : undefined,
  }, (text, fmt) => {
    const changed = text !== before || fmt.size !== beforeFmt.size || !!fmt.bold !== beforeFmt.bold || !!fmt.italic !== beforeFmt.italic;
    if (!changed) { canvasRenderVectors(state); return; }
    if (d.type === 'text' && !text) {
      const idx = state.drawings.indexOf(d);
      if (idx !== -1) {
        canvasSnapshotHistory(state);
        state.drawings.splice(idx, 1);
        canvasRenderVectors(state);
        canvasRenderToolbar(state);
        markCanvasDirty(state);
      }
      return;
    }
    canvasSnapshotHistory(state);
    d.text = text;
    d.size = fmt.size;
    d.bold = fmt.bold;
    d.italic = fmt.italic;
    canvasRenderVectors(state);
    canvasRenderToolbar(state);
    markCanvasDirty(state);
  });
}

/* ---- drag-to-draw: pen / rect / ellipse / line / arrow (pointer listeners
   on state.scrollEl, converted to world coords each move — mirrors the
   reader's highlight/pen drag handling in setupReaderPageInteraction). ---- */

function canvasStartShapeDraw(state, e) {
  const tool = state.tool;
  // Capture the pointer to scrollEl (like canvasStartPan does) so a real mouse
  // drag keeps delivering pointermove/pointerup to THIS handler even as the
  // cursor passes over the SVG vector layer or item cards. Without capture, the
  // drag-based tools (pen/rect/ellipse/line/arrow) never received move events on
  // a real drag and so never met their commit threshold — only the click-based
  // sticky/text tools worked. preventDefault stops a native text-selection drag.
  e.preventDefault();
  try { state.scrollEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const rect = state.scrollEl.getBoundingClientRect();
  const toWorld = (ev) => canvasScreenToWorld(state, ev.clientX - rect.left, ev.clientY - rect.top);
  const startPt = toWorld(e);

  if (tool === 'text') { canvasPlaceTextNote(state, startPt); return; }
  if (tool === 'sticky') { canvasStartStickyDraw(state, e, toWorld, startPt); return; }

  let draft;
  if (tool === 'pen') draft = { id: canvasNewDrawingId(), type: 'pen', color: state.color, stroke: state.strokeWidth, points: [startPt] };
  else if (tool === 'rect') draft = { id: canvasNewDrawingId(), type: 'rect', color: state.color, stroke: state.strokeWidth, x: startPt.x, y: startPt.y, w: 0, h: 0, fill: 'none' };
  else if (tool === 'ellipse') draft = { id: canvasNewDrawingId(), type: 'ellipse', color: state.color, stroke: state.strokeWidth, x: startPt.x, y: startPt.y, w: 0, h: 0, fill: 'none' };
  else if (tool === 'line') draft = { id: canvasNewDrawingId(), type: 'line', color: state.color, stroke: state.strokeWidth, x1: startPt.x, y1: startPt.y, x2: startPt.x, y2: startPt.y };
  else if (tool === 'arrow') draft = { id: canvasNewDrawingId(), type: 'arrow', color: state.color, stroke: state.strokeWidth, x1: startPt.x, y1: startPt.y, x2: startPt.x, y2: startPt.y };
  else return;

  canvasRenderVectors(state, draft);

  const onMove = (ev) => {
    if (canvasState !== state) return;
    const pt = toWorld(ev);
    if (draft.type === 'pen') {
      draft.points.push(pt);
    } else if (draft.type === 'rect' || draft.type === 'ellipse') {
      draft.x = Math.min(startPt.x, pt.x);
      draft.y = Math.min(startPt.y, pt.y);
      draft.w = Math.abs(pt.x - startPt.x);
      draft.h = Math.abs(pt.y - startPt.y);
    } else {
      draft.x2 = pt.x;
      draft.y2 = pt.y;
    }
    canvasRenderVectors(state, draft);
  };
  const finish = () => {
    state.scrollEl.removeEventListener('pointermove', onMove);
    state.scrollEl.removeEventListener('pointerup', finish);
    state.scrollEl.removeEventListener('pointercancel', finish);
    if (canvasState !== state) return;
    let commit;
    if (draft.type === 'pen') commit = draft.points.length > 1;
    else if (draft.type === 'rect' || draft.type === 'ellipse') commit = draft.w > 2 && draft.h > 2;
    else commit = Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) > 2;
    if (commit) {
      canvasSnapshotHistory(state);
      state.drawings.push(draft);
      markCanvasDirty(state);
      canvasRenderToolbar(state);
    }
    canvasRenderVectors(state);
  };
  state.scrollEl.addEventListener('pointermove', onMove);
  state.scrollEl.addEventListener('pointerup', finish);
  state.scrollEl.addEventListener('pointercancel', finish);
}

// Sticky: click/drag defines the box (a plain click — no real drag — falls
// back to a sensible default size), then immediately opens the text editor
// so typing can start right away.
function canvasStartStickyDraw(state, e, toWorld, startPt) {
  const draft = { id: canvasNewDrawingId(), type: 'sticky', color: state.color, x: startPt.x, y: startPt.y, w: 0, h: 0, text: '' };
  canvasRenderVectors(state, draft);

  const onMove = (ev) => {
    if (canvasState !== state) return;
    const pt = toWorld(ev);
    draft.x = Math.min(startPt.x, pt.x);
    draft.y = Math.min(startPt.y, pt.y);
    draft.w = Math.abs(pt.x - startPt.x);
    draft.h = Math.abs(pt.y - startPt.y);
    canvasRenderVectors(state, draft);
  };
  const finish = () => {
    state.scrollEl.removeEventListener('pointermove', onMove);
    state.scrollEl.removeEventListener('pointerup', finish);
    state.scrollEl.removeEventListener('pointercancel', finish);
    if (canvasState !== state) return;
    if (draft.w < 20 || draft.h < 20) { draft.w = 180; draft.h = 140; } // a simple click -> default size
    canvasSnapshotHistory(state);
    state.drawings.push(draft);
    markCanvasDirty(state);
    canvasRenderToolbar(state);
    canvasRenderVectors(state);
    canvasSetTool(state, 'select'); // so a click-away commits instead of dropping another sticky
    canvasEditDrawingText(state, draft); // prompt for text right away
  };
  state.scrollEl.addEventListener('pointermove', onMove);
  state.scrollEl.addEventListener('pointerup', finish);
  state.scrollEl.addEventListener('pointercancel', finish);
}

// Select-mode manipulation of drawings. Only box-shaped drawings (sticky/rect/
// ellipse/text) are grab targets so a big pen stroke's bounding box doesn't
// swallow pans. Topmost (last-drawn) wins.
function canvasDrawingHitTest(state, pt) {
  const ds = state.drawings || [];
  for (let i = ds.length - 1; i >= 0; i--) {
    const d = ds[i];
    if (!canvasDrawingIsBoxSelectable(d)) continue;
    const b = canvasDrawingBounds(d);
    if (!b) continue;
    if (pt.x >= b.x - 4 && pt.x <= b.x + b.w + 4 && pt.y >= b.y - 4 && pt.y <= b.y + b.h + 4) return d;
  }
  return null;
}

function canvasDrawingIsResizable(d) {
  return !!d && (d.type === 'sticky' || d.type === 'rect' || d.type === 'ellipse');
}

// Drag a hit drawing: near its bottom-right corner = resize, otherwise move.
// All work is on the model + a full repaint (canvasRenderVectors), captured to
// scrollEl so the drag survives the pointer crossing other elements.
function canvasStartDrawingManipulate(state, e, d, startWpt) {
  const rect = state.scrollEl.getBoundingClientRect();
  const toWorld = (ev) => canvasScreenToWorld(state, ev.clientX - rect.left, ev.clientY - rect.top);
  const b = canvasDrawingBounds(d);
  const cornerTol = 14 / state.scale;
  const mode = (canvasDrawingIsResizable(d)
    && Math.abs(startWpt.x - (b.x + b.w)) <= cornerTol
    && Math.abs(startWpt.y - (b.y + b.h)) <= cornerTol) ? 'resize' : 'move';

  // Selection Core: a MOVE (not resize) drags the whole current selection
  // together (mirrors canvasWireItemInteraction's symmetric multi-move) — the
  // caller (canvasWireEvents' onPointerDown) has already ensured `d` is a
  // member of state.selection.drawings before invoking this. Resize always
  // stays single-target (resizing "a whole selection" isn't well-defined).
  const drawingIdSet = new Set(mode === 'move' ? state.selection.drawings : []);
  drawingIdSet.add(d.id);
  const moveDrawingIds = Array.from(drawingIdSet);
  const moveItemIds = mode === 'move' ? Array.from(state.selection.items) : [];

  const orig = {
    x: d.x, y: d.y, w: d.w, h: d.h,
    x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
    points: d.points ? d.points.map((p) => ({ x: p.x, y: p.y })) : null,
  };
  const drawingStarts = new Map();
  moveDrawingIds.forEach((did) => {
    const dd = did === d.id ? d : (state.drawings || []).find((x) => x.id === did);
    if (!dd) return;
    if (dd.type === 'line' || dd.type === 'arrow') drawingStarts.set(did, { x1: dd.x1, y1: dd.y1, x2: dd.x2, y2: dd.y2 });
    else if (dd.type === 'pen') drawingStarts.set(did, { points: (dd.points || []).map((p) => ({ x: p.x, y: p.y })) });
    else drawingStarts.set(did, { x: dd.x, y: dd.y });
  });
  const itemStarts = new Map();
  moveItemIds.forEach((id) => {
    const en = state.itemsById.get(id);
    if (en) itemStarts.set(id, { x: en.data.x, y: en.data.y });
  });

  e.preventDefault();
  try { state.scrollEl.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  let moved = false;
  const onMove = (ev) => {
    if (canvasState !== state) return;
    const p = toWorld(ev);
    const dx = p.x - startWpt.x, dy = p.y - startWpt.y;
    if (!moved) {
      if (Math.hypot(dx, dy) < 3 / state.scale) return; // ignore jitter so a plain click still dbl-click-edits
      moved = true;
      canvasSnapshotHistory(state);
    }
    if (mode === 'resize') {
      d.w = Math.max(24, orig.w + dx);
      d.h = Math.max(24, orig.h + dy);
    } else {
      drawingStarts.forEach((st, did) => {
        const dd = did === d.id ? d : (state.drawings || []).find((x) => x.id === did);
        if (!dd) return;
        if (dd.type === 'line' || dd.type === 'arrow') { dd.x1 = st.x1 + dx; dd.y1 = st.y1 + dy; dd.x2 = st.x2 + dx; dd.y2 = st.y2 + dy; }
        else if (dd.type === 'pen') { dd.points = st.points.map((pp) => ({ x: pp.x + dx, y: pp.y + dy })); }
        else { dd.x = st.x + dx; dd.y = st.y + dy; }
      });
      itemStarts.forEach((st, id) => {
        const en = state.itemsById.get(id);
        if (!en) return;
        en.data.x = st.x + dx;
        en.data.y = st.y + dy;
        en.el.style.left = en.data.x + 'px';
        en.el.style.top = en.data.y + 'px';
      });
      if (itemStarts.size) canvasUpdateConnectors(state);
    }
    canvasRenderVectors(state);
  };
  const finish = () => {
    state.scrollEl.removeEventListener('pointermove', onMove);
    state.scrollEl.removeEventListener('pointerup', finish);
    state.scrollEl.removeEventListener('pointercancel', finish);
    if (moved) markCanvasDirty(state);
    canvasRenderVectors(state);
  };
  state.scrollEl.addEventListener('pointermove', onMove);
  state.scrollEl.addEventListener('pointerup', finish);
  state.scrollEl.addEventListener('pointercancel', finish);
}

/* ---------- study view (Step 6): split notes list + preview/reading pane ---------- */

let studyState = null;    // { courseId, notes, activeId }

function studyStatusDot(status) {
  if (status === 'compiled') return '<span class="h-2 w-2 shrink-0 rounded-full bg-emerald-500"></span>';
  if (status === 'failed') return '<span class="h-2 w-2 shrink-0 rounded-full bg-red-500"></span>';
  if (status === 'generating') return '<span class="h-2.5 w-2.5 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></span>';
  return '<span class="h-2 w-2 shrink-0 rounded-full bg-neutral-300"></span>';
}

function studyListItem(n, activeId) {
  const base = 'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition';
  if (n.status === 'compiled') {
    const cls = n.id === activeId ? `${base} bg-neutral-100 font-medium text-ink` : `${base} text-neutral-600 hover:bg-neutral-50`;
    return `<button data-action="study-select" data-note-id="${n.id}" class="${cls}">${studyStatusDot(n.status)}<span class="truncate">${esc(n.title)}</span></button>`;
  }
  if (n.status === 'failed') {
    return `<button data-action="study-error" data-note-id="${n.id}" data-title="${esc(n.title)}" class="${base} text-red-600 hover:bg-red-50">${studyStatusDot(n.status)}<span class="truncate">${esc(n.title)}</span></button>`;
  }
  return `<div class="${base} text-neutral-400">${studyStatusDot(n.status)}<span class="truncate">${esc(n.title)}</span></div>`;
}

function studyPreviewHtml(note, openAction = 'study-open-reading') {
  const thumb = note.has_thumb
    ? `<img src="/api/notes/${note.id}/thumb" alt="" class="h-full w-full object-contain">`
    : `<div class="flex h-full w-full items-center justify-center text-sm text-neutral-300">PDF</div>`;
  return `
    <div class="flex h-full items-center justify-center p-8">
      <button data-action="${openAction}" data-note-id="${note.id}"
        class="group relative flex max-h-full w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-md transition hover:shadow-lg" style="aspect-ratio: 8.5 / 11;">
        ${thumb}
        <div class="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/10">
          <span class="rounded-full bg-ink/90 px-4 py-1.5 text-sm font-medium text-white opacity-0 shadow transition group-hover:opacity-100">Click to read</span>
        </div>
      </button>
    </div>`;
}

/* ---------- study left-pane lesson detail (Build 2, Step 4) ---------- */

function studyDetailHtml() {
  if (!studyState) return '';
  const note = studyState.notes.find((n) => n.id === studyState.activeId);
  if (!note) return '';
  const concept = note.concept_id != null ? studyState.concepts[note.concept_id] : null;
  const name = concept && concept.name ? concept.name : note.title;
  const summary = concept && concept.summary ? concept.summary : '';
  const quizBtn = note.concept_id != null
    ? `<button data-action="start-quiz" data-concept-id="${note.concept_id}" class="mt-3 w-full ${btnPrimary}">${quizButtonLabel(note.concept_id)}</button>`
    : '';
  const doneBadge = note.done
    ? `<span title="Done" class="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-[11px] font-semibold text-emerald-700">${doneCheckIcon}Done</span>`
    : '';
  const toggleBtn = note.concept_id != null ? doneToggleBtn(note.concept_id, note.done, 'card') : '';
  return `
    <p class="px-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Studying</p>
    <p class="mt-1 px-1 text-sm font-semibold leading-snug text-ink">${esc(name)}${doneBadge}</p>
    ${summary ? `<p class="mt-1 px-1 text-xs leading-snug text-neutral-500">${esc(summary)}</p>` : ''}
    ${quizBtn}
    ${toggleBtn}
    <div class="mt-3 flex items-center gap-3 px-1">
      <a data-action="open-course" data-id="${studyState.courseId}" href="#/course/${studyState.courseId}"
        class="text-sm font-medium text-neutral-600 hover:text-neutral-900">Manage course &rarr;</a>
      <a href="/api/notes/${note.id}/pdf?download=1" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">Download PDF</a>
    </div>
    <div class="my-3 border-t border-neutral-100"></div>`;
}

function studyRenderDetail() {
  const host = document.getElementById('study-detail');
  if (host) host.innerHTML = studyDetailHtml();
}

function studyRenderRight() {
  const host = document.getElementById('study-right');
  if (!host || !studyState) return;
  if (!studyState.activeId) {
    host.innerHTML = `
      <div class="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p class="text-sm text-neutral-400">No compiled notes yet.</p>
        <a href="#/course/${studyState.courseId}" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">&larr; Back to course</a>
      </div>`;
    return;
  }
  const note = studyState.notes.find((n) => n.id === studyState.activeId);
  if (!note) return;
  host.innerHTML = studyPreviewHtml(note);
}

function studySelectNote(noteId) {
  if (!studyState) return;
  const id = Number(noteId);
  const note = studyState.notes.find((n) => n.id === id);
  if (!note || note.status !== 'compiled' || id === studyState.activeId) return;
  studyState.activeId = id;
  const list = document.getElementById('study-list');
  if (list) list.innerHTML = studyState.notes.map((n) => studyListItem(n, studyState.activeId)).join('');
  studyRenderDetail();
  studyRenderRight();
}

function studyOpenReading() {
  if (!studyState) return;
  const note = studyState.notes.find((n) => n.id === studyState.activeId);
  openReader(note);
}

function studyCollapseReading() {
  closeReader();
}

async function renderStudyView(courseId, noteId) {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  let course, notes, concepts;
  try {
    [course, notes, concepts] = await Promise.all([
      api.get(`/courses/${courseId}`),
      api.get(`/courses/${courseId}/notes`),
      api.get(`/courses/${courseId}/concepts`),
    ]);
  } catch (e) {
    view.innerHTML = `
      <button data-action="home" class="mb-6 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; All courses</button>
      <div class="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">Course not found.</div>`;
    return;
  }

  const compiled = notes.filter((n) => n.status === 'compiled');
  const requested = noteId ? compiled.find((n) => String(n.id) === String(noteId)) : null;
  const active = requested || compiled[0] || null;

  const conceptMap = {};
  (concepts || []).forEach((c) => { conceptMap[c.id] = { name: c.name, summary: c.summary }; });

  studyState = { courseId: String(courseId), notes, activeId: active ? active.id : null, concepts: conceptMap };

  view.innerHTML = `
    <div class="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div class="flex w-64 shrink-0 flex-col overflow-y-auto border-r border-neutral-100 p-3">
        <a href="#/course/${courseId}" class="mb-2 inline-flex items-center gap-1 px-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; Back</a>
        <div id="study-detail"></div>
        <h3 class="mt-1 px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Notes</h3>
        <div id="study-list" class="mt-2 flex flex-col gap-1">
          ${notes.length ? notes.map((n) => studyListItem(n, studyState.activeId)).join('') : emptyList('No notes yet.')}
        </div>
      </div>
      <div id="study-right" class="min-w-0 flex-1"></div>
    </div>`;

  studyRenderDetail();
  studyRenderRight();
}

/* ---------- schedule study view: cross-course agenda + PDF pane ---------- */

let schedStudy = null; // { items, activeId }

function schedLessonRow(item, activeId) {
  const active = item.id === activeId;
  const dotCls = item.note_id ? 'bg-emerald-500' : 'bg-amber-400';
  const code = item.course_code
    ? `<span class="ml-1 shrink-0 text-[10px] font-medium text-neutral-400">${esc(item.course_code)}</span>`
    : '';
  const cls = active
    ? 'card-interactive flex w-full items-start gap-2 rounded-lg bg-neutral-100 px-3 py-2 text-left font-medium'
    : 'card-interactive flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-neutral-50';
  const doneMark = item.done ? `<span class="shrink-0" title="Done">${doneCheckIcon}</span>` : '';
  return `
    <button data-action="sched-select" data-item-id="${item.id}" style="${accentEdgeStyle(item.course_id)}" class="${cls}">
      <span class="mt-1 h-2 w-2 shrink-0 rounded-full ${dotCls}"></span>
      <span class="min-w-0 flex-1">
        <span class="flex min-w-0 items-center gap-1">
          <span class="min-w-0 truncate text-sm ${item.done ? 'text-neutral-400 line-through' : ''}">${esc(item.concept_name)}</span>
          ${doneMark}
        </span>
        <span class="block truncate text-xs text-neutral-400">${esc(item.course_name)}${code}</span>
      </span>
    </button>`;
}

function schedDaySection(iso, items, activeId) {
  return `
    <section class="mt-4 first:mt-0">
      <h4 class="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">${fmtDayHeader(iso)}</h4>
      <div class="mt-1.5 flex flex-col gap-1">${items.map((it) => schedLessonRow(it, activeId)).join('')}</div>
    </section>`;
}

function schedRenderLeft() {
  const host = document.getElementById('sched-left-list');
  if (!host || !schedStudy) return;
  const byDate = {};
  const dates = [];
  schedStudy.items.forEach((it) => {
    if (!byDate[it.study_date]) { byDate[it.study_date] = []; dates.push(it.study_date); }
    byDate[it.study_date].push(it);
  });
  host.innerHTML = dates.map((d) => schedDaySection(d, byDate[d], schedStudy.activeId)).join('');
}

function schedRenderRight() {
  const host = document.getElementById('sched-right');
  if (!host || !schedStudy) return;
  const item = schedStudy.items.find((it) => it.id === schedStudy.activeId);
  if (!item) { host.innerHTML = ''; return; }
  const downloadLink = item.note_id
    ? `<a href="/api/notes/${item.note_id}/pdf?download=1" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">Download PDF</a>`
    : '';
  const quizBtn = item.concept_id != null
    ? `<button data-action="start-quiz" data-concept-id="${item.concept_id}" class="rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800">${quizButtonLabel(item.concept_id)}</button>`
    : '';
  const doneBadge = item.done
    ? `<span title="Done" class="ml-1.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 align-middle text-[11px] font-semibold text-emerald-700">${doneCheckIcon}Done</span>`
    : '';
  const toggleBtn = item.concept_id != null ? doneToggleBtn(item.concept_id, item.done, 'row') : '';
  const headerHtml = `
    <div class="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold text-ink">${esc(item.concept_name)}${doneBadge}</p>
        <p class="truncate text-xs text-neutral-400">${esc(item.course_name)} &middot; for ${esc(item.exam_name)}</p>
      </div>
      <div class="flex shrink-0 items-center gap-3">
        ${quizBtn}
        ${toggleBtn}
        ${downloadLink}
        <a href="#/course/${item.course_id}" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">Manage course &rarr;</a>
      </div>
    </div>`;
  if (!item.note_id) {
    host.innerHTML = headerHtml + `
      <div class="flex h-[calc(100%-3.25rem)] flex-col items-center justify-center gap-3 p-8 text-center">
        <p class="text-sm text-neutral-400">This lesson's note hasn't been generated yet.</p>
        <a href="#/course/${item.course_id}" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">Generate from ${esc(item.course_name)} &rarr;</a>
      </div>`;
    return;
  }
  const note = { id: item.note_id, title: item.concept_name, has_thumb: item.note_has_thumb };
  const bodyHtml = studyPreviewHtml(note, 'sched-open-reading');
  host.innerHTML = headerHtml + `<div class="h-[calc(100%-3.25rem)]">${bodyHtml}</div>`;
}

function schedSelect(itemId) {
  if (!schedStudy) return;
  const id = Number(itemId);
  if (id === schedStudy.activeId) return;
  const item = schedStudy.items.find((it) => it.id === id);
  if (!item) return;
  schedStudy.activeId = id;
  schedRenderLeft();
  schedRenderRight();
}

function schedOpenReading() {
  if (!schedStudy) return;
  const item = schedStudy.items.find((it) => it.id === schedStudy.activeId);
  if (!item) return;
  openReader({ id: item.note_id, title: item.concept_name, has_thumb: item.note_has_thumb });
}

function schedCollapseReading() {
  closeReader();
}

async function renderScheduleStudy(itemId) {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  const today = todayISO();
  const to = addDaysISO(today, 30);
  let items = [];
  try {
    // Filter out synthetic kind:'revision' rows (Build 12 Phase 4) — this
    // dormant cross-course study view only knows how to render per-concept
    // lessons (schedLessonRow reads concept_id/note_id, which a revision row
    // has neither of).
    items = (await api.get(`/schedule/upcoming?from=${today}&to=${to}`))
      .filter((it) => it.kind !== 'revision');
  } catch (e) {
    view.innerHTML = `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load schedule: ${esc(e.message)}</div>`;
    return;
  }

  if (!items.length) {
    view.innerHTML = `
      <div class="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-3 text-center">
        <p class="text-sm text-neutral-400">No upcoming lessons scheduled.</p>
        <a href="#/" class="text-sm font-medium text-neutral-600 hover:text-neutral-900">&larr; Back to dashboard</a>
      </div>`;
    return;
  }

  const wantId = itemId ? Number(itemId) : null;
  const activeItem = (wantId && items.find((it) => it.id === wantId)) || items[0];
  schedStudy = { items, activeId: activeItem.id };

  view.innerHTML = `
    <div class="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div class="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-neutral-100 p-3 sm:w-80">
        <a href="#/" class="mb-2 inline-flex items-center gap-1 px-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; Dashboard</a>
        <h3 class="px-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Upcoming lessons</h3>
        <div id="sched-left-list" class="mt-1"></div>
      </div>
      <div id="sched-right" class="min-w-0 flex-1"></div>
    </div>`;

  schedRenderLeft();
  schedRenderRight();
}

async function showNoteError(noteId, title) {
  let text = '(could not load LaTeX)';
  try { text = await api.get(`/notes/${noteId}/latex`); } catch (e) { text = e.message; }
  const overlay = document.createElement('div');
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm';
  overlay.innerHTML = `
    <div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-neutral-200 bg-white p-5 shadow-xl">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">${esc(title)} — failed</h3>
        <button data-x class="rounded-md p-1 text-neutral-400 hover:bg-neutral-100">&#10005;</button>
      </div>
      <p class="mt-1 text-sm text-neutral-500">The compile error and generated LaTeX are below.</p>
      <pre class="mt-3 flex-1 overflow-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">${esc(text)}</pre>
    </div>`;
  document.body.appendChild(overlay);
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  function close() { overlay.remove(); document.removeEventListener('keydown', onKey); }
  document.addEventListener('keydown', onKey);
  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
  overlay.querySelector('[data-x]').addEventListener('click', close);
}

async function refreshMaterials(courseId) {
  const [c, materials] = await Promise.all([
    api.get(`/courses/${courseId}`),
    api.get(`/courses/${courseId}/materials`),
  ]);
  fillMaterialLists(materials, courseId);
  const cc = document.getElementById('course-counts');
  if (cc) cc.textContent = `${materials.length} materials · ${c.note_count} notes`;
}

function wireUploads(courseId) {
  ['material', 'pyq'].forEach((kind) => {
    const input = document.getElementById(`input-${kind}`);
    const drop = document.getElementById(`drop-${kind}`);
    if (input) {
      input.addEventListener('change', () => { handleFiles(courseId, kind, input.files); input.value = ''; });
    }
    if (drop) {
      ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add('border-neutral-400', 'bg-neutral-50');
      }));
      ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove('border-neutral-400', 'bg-neutral-50');
      }));
      drop.addEventListener('drop', (e) => {
        if (e.dataTransfer && e.dataTransfer.files) handleFiles(courseId, kind, e.dataTransfer.files);
      });
      drop.addEventListener('click', () => input && input.click());
      // A5: the dropzone carries role="button"/tabindex="0" (uploadPanel) so it's
      // reachable by keyboard — Enter/Space activates it the same as a click,
      // matching native <button> behavior.
      drop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          input && input.click();
        }
      });
    }
  });
}

// D5: mirrors routers/materials.py's ALLOWED_EXT / MAX_BYTES exactly, so an
// obviously-invalid file is rejected instantly (clear reason, no round trip)
// instead of waiting on a 400/413 from the server. Kept in sync by hand if
// the backend's allowed set ever changes.
const UPLOAD_ALLOWED_EXT = new Set(['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx', '.ppt', '.pptx']);
const UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

function uploadFileExt(name) {
  const dot = (name || '').lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

async function handleFiles(courseId, kind, fileList) {
  const files = Array.from(fileList);
  if (!files.length) return;
  const status = document.getElementById(`up-status-${kind}`);
  status.innerHTML = '';
  let ok = 0, fail = 0;
  for (const f of files) {
    const row = document.createElement('div');
    row.className = 'flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-3 py-1.5 text-xs';
    row.innerHTML = `<span class="truncate text-neutral-600">${esc(f.name)}</span><span data-s class="shrink-0 text-neutral-400">uploading…</span>`;
    status.appendChild(row);
    const s = row.querySelector('[data-s]');
    // D5: client-side pre-check — skip the upload call entirely for a reject.
    const ext = uploadFileExt(f.name);
    if (!UPLOAD_ALLOWED_EXT.has(ext)) {
      const msg = `Unsupported file type '${ext || '?'}'`;
      s.textContent = msg;
      s.className = 'shrink-0 text-red-600';
      ui.toast(`${f.name}: unsupported file type`, 'error');
      fail++;
      continue;
    }
    if (f.size > UPLOAD_MAX_BYTES) {
      s.textContent = 'File too large (max 50 MB)';
      s.className = 'shrink-0 text-red-600';
      ui.toast(`${f.name}: too large (max 50 MB)`, 'error');
      fail++;
      continue;
    }
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', f);
      await api.upload(`/courses/${courseId}/materials`, fd);
      s.textContent = '✓';
      s.className = 'shrink-0 text-emerald-600';
      ok++;
    } catch (e) {
      s.textContent = e.message || 'failed';
      s.className = 'shrink-0 text-red-600';
      fail++;
    }
  }
  await refreshMaterials(courseId);
  // F6 fix: after a successful STUDY-material upload, re-render the Concepts
  // section so the "Analyze materials" button (disabled while a course has zero
  // study materials) re-enables immediately — otherwise it stayed greyed until
  // a manual page reload. PYQ uploads don't affect that button, so skip them.
  if (ok && kind === 'material') loadStudyArea(courseId);
  if (ok) ui.toast(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
  if (!fail) setTimeout(() => { if (status) status.innerHTML = ''; }, 1500);
}

function delMaterial(id) {
  // B2: confirm before removing a source document — every other delete
  // (course/semester/exam) does, and a material's concepts/notes derive from
  // it, so a misclick here is genuinely destructive.
  ui.confirmModal({
    title: 'Remove material?',
    message: 'This permanently removes the file. Concepts and notes already generated from it are kept, but you can no longer re-analyze or regenerate from it. This can’t be undone.',
    confirmLabel: 'Remove',
    onConfirm: async () => {
      await api.del(`/materials/${id}`);
      ui.toast('Removed');
      const m = (location.hash || '').match(/^#\/course\/(\d+)/);
      if (m) await refreshMaterials(m[1]);
    },
  });
}

/* ---------- actions ---------- */

function newSemester() {
  ui.formModal({
    title: 'New semester',
    bodyHtml: field('Name', `<input id="f-name" class="${inputCls}" placeholder="e.g. Fall 2026" />`),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-name').value.trim();
      if (!name) throw new Error('Please enter a name.');
      await api.post('/semesters', { name });
      ui.toast('Semester created');
      await route();
    },
  });
}

function newCourse(semesterId) {
  ui.formModal({
    title: 'New course',
    bodyHtml: [
      field('Name', `<input id="f-name" class="${inputCls}" placeholder="e.g. Database Systems" />`),
      field('Code', `<input id="f-code" class="${inputCls}" placeholder="e.g. CSE311 (optional)" />`),
      field('Description', `<textarea id="f-desc" rows="3" class="${inputCls}" placeholder="Optional"></textarea>`),
    ].join(''),
    onSubmit: async (root) => {
      const name = root.querySelector('#f-name').value.trim();
      if (!name) throw new Error('Please enter a course name.');
      await api.post('/courses', {
        semester_id: Number(semesterId),
        name,
        code: root.querySelector('#f-code').value.trim() || null,
        description: root.querySelector('#f-desc').value.trim() || null,
      });
      ui.toast('Course created');
      await route();
    },
  });
}

function archiveSemester(id, name) {
  ui.confirmModal({
    title: 'Archive semester?',
    message: `"${name}" will be hidden from your courses and schedule; you can restore it anytime.`,
    confirmLabel: 'Archive',
    onConfirm: async () => {
      await api.post(`/semesters/${id}/archive`);
      ui.toast('Semester archived');
      await route();
    },
  });
}

async function unarchiveSemester(id, name) {
  await api.post(`/semesters/${id}/unarchive`);
  ui.toast(`"${name}" restored`);
  await route();
}

function delSemester(id, name) {
  ui.confirmModal({
    title: 'Delete semester?',
    message: `"${name}" and all of its courses, materials, and notes will be permanently removed.`,
    onConfirm: async () => {
      await api.del(`/semesters/${id}`);
      ui.toast('Semester deleted');
      await route();
    },
  });
}

function delCourse(id, name) {
  ui.confirmModal({
    title: 'Delete course?',
    message: `"${name}" and all of its materials and notes will be permanently removed.`,
    onConfirm: async () => {
      await api.del(`/courses/${id}`);
      ui.toast('Course deleted');
      if (location.hash.startsWith('#/course/')) location.hash = '#/';
      else await route();
    },
  });
}

/* ---------- health pill ---------- */

// D1: refreshHealthPill only ran once at boot, so the sidebar pill could sit
// on a stale "All systems OK" for the rest of the session even if the backend
// later went down (or came back). `healthPollTimer` guards a single slow
// (~90s) setInterval, started once from enterApp — see initHealthPoll below.
let healthPollTimer = null;

function initHealthPoll() {
  if (healthPollTimer) return; // never double-start
  healthPollTimer = setInterval(refreshHealthPill, 90000);
}

function healthRow(label, sub, s) {
  const ok = s && s.ok;
  const dot = ok ? 'bg-emerald-500' : 'bg-red-500';
  const mark = ok ? '<span class="text-emerald-600">&#10003;</span>' : '<span class="text-red-600">&#10007;</span>';
  return `
    <div class="flex items-start justify-between py-3">
      <div class="flex items-start gap-3">
        <span class="mt-1.5 h-2.5 w-2.5 rounded-full ${dot}"></span>
        <div><p class="text-sm font-medium">${label}</p><p class="text-xs text-neutral-500">${sub}</p></div>
      </div>
      <div class="text-right"><div class="text-sm font-semibold">${mark}</div>
        <p class="mt-0.5 max-w-[15rem] text-xs text-neutral-400">${s ? esc(s.detail) : ''}</p></div>
    </div>`;
}

function healthBody(h) {
  return healthRow('Database', 'SQLite store for courses, notes, and jobs', h.db)
    + healthRow('Tectonic', 'LaTeX → PDF compiler', h.tectonic)
    + healthRow('AI API key', 'Concept extraction & note generation', h.ai_key);
}

async function refreshHealthPill() {
  const el = document.getElementById('health-pill');
  if (!el) return;
  try {
    const h = await api.get('/health');
    window.__health = h;
    const allOk = h.db.ok && h.tectonic.ok && h.ai_key.ok;
    const dotCls = allOk ? 'bg-emerald-500' : 'bg-amber-500';
    const label = allOk ? 'All systems OK' : 'Check status';
    el.innerHTML = `<span class="sidebar-icon-slot"><span class="h-2.5 w-2.5 shrink-0 rounded-full ${dotCls}"></span></span><span>${label}</span>`;
    el.title = allOk ? 'All systems go' : 'Check status';
  } catch (e) {
    el.innerHTML = '<span class="sidebar-icon-slot"><span class="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"></span></span><span>Backend offline</span>';
    el.title = 'Backend offline';
  }
}

function showHealthModal() {
  const h = window.__health;
  const body = h ? healthBody(h) : '<p class="py-3 text-sm text-neutral-400">Loading…</p>';
  const { card, close } = ui.mountOverlay(`
    <div class="p-5">
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">System status</h3>
        <button data-x class="rounded-md p-1 text-neutral-400 hover:bg-neutral-100">&#10005;</button>
      </div>
      <div data-list class="mt-3 divide-y divide-neutral-100">${body}</div>
      <div class="mt-4 flex justify-end">
        <button data-recheck class="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">Recheck</button>
      </div>
    </div>`);
  card.querySelector('[data-x]').addEventListener('click', close);
  card.querySelector('[data-recheck]').addEventListener('click', async () => {
    await refreshHealthPill();
    card.querySelector('[data-list]').innerHTML = healthBody(window.__health);
  });
}

/* ---------- user profile (Build 5, Step 6) ---------- */

// window.__profile caches the single local user's profile (name, avatar, study
// prefs). Loaded once at boot and after any save; drives the sidebar chip + the
// dashboard greeting. Null until loaded / on fetch failure.
async function loadProfile() {
  try { window.__profile = await api.get('/profile'); }
  catch (_) { window.__profile = null; }
  renderSidebarUser();
}

function profileFirstName(p) {
  const n = (p && p.name ? p.name : '').trim();
  return n ? n.split(/\s+/)[0] : '';
}

function profileInitials(p) {
  const parts = (p && p.name ? p.name : '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const a = parts[0][0] || '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (a + b).toUpperCase();
}

// Avatar as an <img> when one is set, else an initials circle. sizeCls sets the
// square size (e.g. 'h-7 w-7' in the header, 'h-16 w-16' in settings).
function avatarHtml(p, sizeCls, textCls = 'text-xs') {
  if (p && p.avatar_url) {
    return `<img src="${esc(p.avatar_url)}" alt="" class="${sizeCls} shrink-0 rounded-full border border-neutral-200 object-cover">`;
  }
  return `<span class="badge-brand ${sizeCls} ${textCls} inline-flex shrink-0 items-center justify-center rounded-full font-semibold">${esc(profileInitials(p))}</span>`;
}

const logoutIcon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';

// Fills the sidebar #sidebar-user slot: a chip (avatar + first name) that
// routes to Settings, plus a small icon-button to log out.
function renderSidebarUser() {
  const el = document.getElementById('sidebar-user');
  if (!el) return;
  const p = window.__profile;
  const first = profileFirstName(p) || 'Profile';
  // Two nav-item-style rows (Build 13 FF2, Fix 4) so the bottom cluster
  // left-aligns collapsed and reveals its label on hover exactly like the
  // nav rows above. Each leading icon (avatar, logout glyph) sits in a
  // fixed-width .sidebar-icon-slot so it centers on the SAME vertical axis as
  // the health dot + the 18px nav icons instead of staggering by intrinsic
  // width (Build 14 FF); the avatar center-overflows the slot symmetrically.
  el.innerHTML = `
    <button data-action="go-settings" title="${esc(first)} — profile & settings" class="sidebar-nav-item">
      <span class="sidebar-icon-slot">${avatarHtml(p, 'h-7 w-7')}</span><span>${esc(first)}</span>
    </button>
    <button data-action="logout" title="Log out" class="sidebar-nav-item">
      <span class="sidebar-icon-slot">${logoutIcon}</span><span>Log Out</span>
    </button>`;
}

function greetingText() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  const first = profileFirstName(window.__profile);
  return first ? `${part}, ${esc(first)}` : 'Welcome back';
}

/* ---------- settings view (Build 5, Step 6): profile + study prefs + AI + system ---------- */

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // index = date.weekday() 0..6

// One row in the Settings "Saved Prompts" list (Build 6, Step 6 frontend).
// The checkbox gives radio semantics: checking one PUTs it as the single
// global active prompt; renderSettings() re-fetches + re-renders after any
// change, so at most one row is ever shown checked.
function savedPromptRowHtml(p, activeId) {
  const isActive = activeId != null && Number(activeId) === Number(p.id);
  const raw = p.instruction || '';
  const preview = raw.length > 140 ? esc(raw.slice(0, 140)) + '…' : esc(raw);
  return `
    <div class="card-interactive rounded-xl border p-3 ${isActive ? 'border-emerald-300 bg-emerald-50' : 'border-neutral-200 bg-white'}">
      <div class="flex items-start justify-between gap-3">
        <label class="flex flex-1 cursor-pointer items-start gap-2">
          <input type="checkbox" data-sp-active="${p.id}" ${isActive ? 'checked' : ''} class="mt-1">
          <div class="min-w-0">
            <p class="text-sm font-semibold">${esc(p.name)}</p>
            <p class="mt-0.5 line-clamp-2 text-xs text-neutral-500">${preview}</p>
            ${isActive ? `<span class="mt-1 inline-block rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">Applied to all notes</span>` : ''}
          </div>
        </label>
        <div class="flex shrink-0 gap-1">
          <button data-sp-edit="${p.id}" class="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100">Edit</button>
          <button data-sp-del="${p.id}" class="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">Delete</button>
        </div>
      </div>
    </div>`;
}

// Re-render Settings after an in-place mutation (provider/key/model/avatar change)
// WITHOUT jumping to the top — replacing #view resets scroll, so restore it.
// (route() entry uses renderSettings() directly, which SHOULD land at the top.)
async function reRenderSettings() {
  const y = window.scrollY;
  await renderSettings();
  window.scrollTo(0, y);
}

async function renderSettings() {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  let profile, health;
  try {
    [profile, health] = await Promise.all([
      api.get('/profile'),
      api.get('/health').catch(() => null),
    ]);
  } catch (e) {
    view.innerHTML = errorBox(esc(e.message || 'Failed to load settings.'));
    return;
  }
  window.__profile = profile;

  const offDays = new Set(profile.study_off_days || []);
  const dayChecks = WEEKDAY_LABELS.map((d, i) => `
    <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50">
      <input type="checkbox" data-offday="${i}" ${offDays.has(i) ? 'checked' : ''}>${d}
    </label>`).join('');
  const pomoPrefsVal = pomodoroPrefs();
  const pomoDurationOptions = (POMODORO_DURATION_OPTIONS.includes(pomoPrefsVal.defaultMin)
    ? POMODORO_DURATION_OPTIONS
    : [...POMODORO_DURATION_OPTIONS, pomoPrefsVal.defaultMin].sort((a, b) => a - b))
    .map((m) => `<option value="${m}" ${m === pomoPrefsVal.defaultMin ? 'selected' : ''}>${m} min</option>`)
    .join('');

  view.innerHTML = `
    <div class="mx-auto max-w-2xl space-y-6">
      <button data-action="go-courses" class="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">&larr; All courses</button>
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
        <p class="mt-1 text-sm text-neutral-500">Manage your profile, study preferences, and AI.</p>
      </div>

      <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold">Profile</h2>
        <div class="mt-4 flex flex-wrap items-center gap-4">
          <div id="settings-avatar">${avatarHtml(profile, 'h-16 w-16', 'text-lg')}</div>
          <div class="flex gap-2">
            <button id="avatar-pick" class="${btnSecondary}">Change photo</button>
            ${profile.has_avatar ? `<button id="avatar-remove" class="${btnSecondary}">Remove</button>` : ''}
          </div>
          <input id="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" class="hidden">
        </div>
        <div class="mt-5 grid gap-4 sm:grid-cols-2">
          ${field('Name', `<input id="p-name" class="${inputCls}" value="${esc(profile.name || '')}" placeholder="Your name">`)}
          ${field('Email', `<input id="p-email" type="email" class="${inputCls}" value="${esc(profile.email || '')}" placeholder="you@example.com">`)}
          ${field('Institution', `<input id="p-institution" class="${inputCls}" value="${esc(profile.institution || '')}" placeholder="University / school">`)}
          ${field('Program / major', `<input id="p-program" class="${inputCls}" value="${esc(profile.program || '')}" placeholder="e.g. BSc Computer Science">`)}
          ${field('Academic year', `<input id="p-year" class="${inputCls}" value="${esc(profile.academic_year || '')}" placeholder="e.g. Year 2 / Semester 6">`)}
        </div>

        <h3 class="mt-6 text-sm font-semibold text-neutral-700">Study preferences</h3>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          ${field('Lessons per day (per course)', `<input id="p-capacity" type="number" min="1" max="8" class="${inputCls}" value="${Number(profile.daily_capacity) || 2}">`, 'Max lessons scheduled per course on a single day — shapes your study plan.')}
          <div>
            <label class="block text-sm font-medium text-neutral-700">Days off</label>
            <div class="mt-1 flex flex-wrap gap-1.5">${dayChecks}</div>
            <p class="mt-1 text-xs text-neutral-400">Skipped when building your schedule.</p>
          </div>
        </div>
        <div class="mt-6"><button id="save-profile" class="${btnPrimary}">Save changes</button></div>
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold">Appearance</h2>
        <p class="mt-1 text-sm text-neutral-500">Theme for this browser.</p>
        <div class="mt-4 max-w-xs"><div id="theme-toggle"></div></div>
      </section>

      <div id="ai-section"></div>

      <div id="security-section"></div>

      <div id="sp-section"></div>

      <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold">Pomodoro</h2>
        <p class="mt-1 text-sm text-neutral-500">You pick the length each time you start a focus session.</p>
        <div class="mt-4">
          <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50">
            <input type="checkbox" id="pomo-chime" ${pomoPrefsVal.chime ? 'checked' : ''}>Chime on completion
          </label>
        </div>
      </section>

      <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">System</h2>
          <button id="recheck-health" class="${btnSecondary}">Recheck</button>
        </div>
        <div id="settings-health" class="mt-2 divide-y divide-neutral-100">${health ? healthBody(health) : '<p class="py-3 text-sm text-neutral-400">Status unavailable.</p>'}</div>
      </section>

      <section class="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
        <h2 class="text-lg font-semibold text-red-600">Delete account</h2>
        <p class="mt-1 text-sm text-neutral-500">Permanently deletes this account and all of its courses, notes, exams, and schedule. This cannot be undone.</p>
        <button id="delete-account" class="btn btn-danger mt-4">Delete my account</button>
      </section>
    </div>`;

  // --- wire interactions (local listeners) ---
  document.getElementById('save-profile').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    btn.disabled = true;
    try {
      const off = Array.from(document.querySelectorAll('[data-offday]:checked')).map((el) => Number(el.dataset.offday));
      window.__profile = await api.put('/profile', {
        name: document.getElementById('p-name').value.trim(),
        email: document.getElementById('p-email').value.trim(),
        institution: document.getElementById('p-institution').value.trim(),
        program: document.getElementById('p-program').value.trim(),
        academic_year: document.getElementById('p-year').value.trim(),
        daily_capacity: Number(document.getElementById('p-capacity').value) || 2,
        study_off_days: off,
      });
      renderSidebarUser();
      ui.toast('Profile saved');
    } catch (e) { ui.toast(e.message || 'Failed to save profile', 'error'); }
    finally { btn.disabled = false; }
  });

  const fileInput = document.getElementById('avatar-file');
  document.getElementById('avatar-pick').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f);
    try {
      await api.upload('/profile/avatar', fd);
      window.__profile = await api.get('/profile');
      renderSidebarUser();
      await reRenderSettings();
      ui.toast('Photo updated');
    } catch (e) { ui.toast(e.message || 'Upload failed', 'error'); }
  });
  const rm = document.getElementById('avatar-remove');
  if (rm) rm.addEventListener('click', async () => {
    try {
      await api.del('/profile/avatar');
      window.__profile = await api.get('/profile');
      renderSidebarUser();
      await reRenderSettings();
      ui.toast('Photo removed');
    } catch (e) { ui.toast(e.message || 'Failed to remove photo', 'error'); }
  });

  document.getElementById('pomo-chime').addEventListener('change', (ev) => {
    const prefs = pomodoroPrefs();
    prefs.chime = !!ev.target.checked;
    pomodoroSavePrefs(prefs);
    ui.toast(prefs.chime ? 'Chime enabled' : 'Chime disabled');
  });

  document.getElementById('recheck-health').addEventListener('click', async () => {
    try {
      const h = await api.get('/health');
      window.__health = h;
      document.getElementById('settings-health').innerHTML = healthBody(h);
      await refreshHealthPill();
    } catch (e) { ui.toast(e.message || 'Recheck failed', 'error'); }
  });

  document.getElementById('delete-account').addEventListener('click', () => {
    ui.confirmModal({
      title: 'Delete this account?',
      message: 'This permanently deletes this account and all of its courses, notes, exams, and schedule. This cannot be undone.',
      confirmLabel: 'Delete my account',
      onConfirm: async () => {
        try { await api.post('/auth/delete-account', {}); window.location.reload(); }
        catch (e) { ui.toast(e.message || 'Failed to delete account', 'error'); }
      },
    });
  });

  renderThemeToggle(); // fills the Appearance section's #theme-toggle (moved here from the sidebar)
  await renderAiSection();
  await renderSavedPromptsSection();
  await renderSecuritySection();
}

// Renders ONLY the AI-provider section into #ai-section (its own /settings fetch +
// listeners), so switching provider / saving a key updates in place — no full-page
// Settings re-render or scroll shift.
async function renderAiSection() {
  const host = document.getElementById('ai-section');
  if (!host) return;
  let s;
  try { s = await api.get('/settings'); } catch (_) { host.innerHTML = ''; return; }
  const PROVIDER_LABELS = { gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Custom (OpenAI-compatible)' };
  const providerOptions = (s.providers || [])
    .map((p) => `<option value="${esc(p)}" ${p === s.provider ? 'selected' : ''}>${esc(PROVIDER_LABELS[p] || p)}</option>`).join('');
  const modelSuggestionOptions = (s.model_suggestions || []).map((m) => `<option value="${esc(m)}"></option>`).join('');
  const keyHint = s.key_source === 'user' ? `Using your key ••••${esc(s.key_last4 || '')}`
    : s.key_source === 'env' ? 'Using the key from backend/.env'
    : 'No key set — enter one to enable AI features';
  host.innerHTML = `
    <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold">AI provider</h2>
      <p class="mt-1 text-sm text-neutral-500">Choose which AI provider powers concept extraction, note generation, and quizzes.</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field('Provider', `<select id="ai-provider" class="${inputCls}">${providerOptions}</select>`)}
        ${field('Model', `<input id="ai-model" list="ai-model-suggestions" class="${inputCls}" value="${esc(s.model || '')}" placeholder="e.g. ${esc((s.model_suggestions && s.model_suggestions[0]) || 'model id')}"><datalist id="ai-model-suggestions">${modelSuggestionOptions}</datalist>`, 'Free text — any model id this provider supports.')}
      </div>
      <div id="ai-base-url-field" class="mt-4" ${s.provider === 'custom' ? '' : 'style="display:none"'}>
        ${field('Base URL', `<input id="ai-base-url" class="${inputCls}" value="${esc(s.base_url || '')}" placeholder="e.g. https://openrouter.ai/api/v1">`, 'Any OpenAI-compatible endpoint, e.g. https://openrouter.ai/api/v1.')}
      </div>
      <div class="mt-4">
        ${field('API key', `<input id="ai-key" type="password" class="${inputCls}" placeholder="${esc(keyHint)}" autocomplete="off">`, 'Stored locally in this app — never shown in full. Leave blank to keep the current key.')}
        <div class="mt-2 flex gap-2">
          <button id="save-ai" class="${btnPrimary}">Save</button>
          <button id="clear-key" class="${btnSecondary}">Use .env key</button>
        </div>
      </div>
    </section>`;
  const providerSel = host.querySelector('#ai-provider');
  providerSel.addEventListener('change', async () => {
    try {
      await api.put('/settings', { provider: providerSel.value });
      ui.toast(`Provider set to ${PROVIDER_LABELS[providerSel.value] || providerSel.value}`);
      await refreshHealthPill();
      await renderAiSection();
    } catch (e) { ui.toast(e.message || 'Failed to switch provider', 'error'); }
  });
  host.querySelector('#save-ai').addEventListener('click', async () => {
    const provider = providerSel.value;
    const payload = { provider, model: host.querySelector('#ai-model').value.trim() };
    if (provider === 'custom') payload.base_url = host.querySelector('#ai-base-url').value.trim();
    const keyVal = host.querySelector('#ai-key').value.trim();
    if (keyVal) payload.api_key = keyVal;
    try {
      await api.put('/settings', payload);
      ui.toast('AI settings saved');
      await refreshHealthPill();
      await renderAiSection();
    } catch (e) { ui.toast(e.message || 'Failed to save AI settings', 'error'); }
  });
  host.querySelector('#clear-key').addEventListener('click', async () => {
    try {
      await api.put('/settings', { provider: providerSel.value, api_key: '' });
      ui.toast('Cleared — using .env key');
      await refreshHealthPill();
      await renderAiSection();
    } catch (e) { ui.toast(e.message || 'Failed to clear key', 'error'); }
  });
}

// Renders ONLY the account-security section into #security-section (Feature 5)
// — modeled exactly on renderAiSection()'s own-fetch/build/wire-locally
// pattern, so it can be called (and re-rendered) on its own without touching
// the rest of Settings or its scroll position. Fetches nothing on its own
// (no dedicated GET endpoint) — it's a pure action form.
async function renderSecuritySection() {
  const host = document.getElementById('security-section');
  if (!host) return;
  const secQOptions = SECURITY_QUESTIONS
    .map((q) => `<option value="${esc(q)}">${esc(q)}</option>`).join('');
  host.innerHTML = `
    <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 class="text-lg font-semibold">Account security</h2>
      <p class="mt-1 text-sm text-neutral-500">Change your password. You'll stay signed in.</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field('Current password', `<input id="sec-current" type="password" class="${inputCls}" autocomplete="current-password">`)}
      </div>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        ${field('New password', `<input id="sec-new" type="password" class="${inputCls}" autocomplete="new-password">`, 'At least 6 characters.')}
        ${field('Confirm new password', `<input id="sec-confirm" type="password" class="${inputCls}" autocomplete="new-password">`)}
      </div>
      <div class="mt-4">
        <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm hover:bg-neutral-50">
          <input type="checkbox" id="sec-toggle-q">Also change your security question
        </label>
      </div>
      <div id="sec-q-fields" class="mt-4 hidden grid gap-4 sm:grid-cols-2">
        ${field('Security question', `<select id="sec-question" class="${inputCls}"><option value="">Select a question&hellip;</option>${secQOptions}</select>`)}
        ${field('Answer', `<input id="sec-answer" class="${inputCls}" autocomplete="off">`, 'Not case-sensitive.')}
      </div>
      <div class="mt-6"><button id="save-security" class="${btnPrimary}">Save</button></div>
    </section>`;

  const toggleQ = host.querySelector('#sec-toggle-q');
  const qFields = host.querySelector('#sec-q-fields');
  toggleQ.addEventListener('change', () => {
    qFields.classList.toggle('hidden', !toggleQ.checked);
  });

  host.querySelector('#save-security').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const current = host.querySelector('#sec-current').value;
    const next = host.querySelector('#sec-new').value;
    const confirmVal = host.querySelector('#sec-confirm').value;
    if (next.length < 6) { ui.toast('New password must be at least 6 characters', 'error'); return; }
    if (next !== confirmVal) { ui.toast('New passwords do not match', 'error'); return; }
    const payload = { current_password: current, new_password: next };
    if (toggleQ.checked) {
      const q = host.querySelector('#sec-question').value;
      const a = host.querySelector('#sec-answer').value.trim();
      if (q && a) {
        payload.security_question = q;
        payload.security_answer = a;
      }
    }
    btn.disabled = true;
    try {
      await api.post('/auth/change-password', payload);
      ui.toast('Password updated');
      await renderSecuritySection(); // clears the form + resets the toggle
    } catch (e) {
      ui.toast(e.message || 'Failed to update password', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// Fills #sp-section ONLY (Build 7 Phase 4, Fix B) — every Saved-Prompt
// add/edit/delete/activate action re-runs just this function instead of the
// full renderSettings(), so the rest of the Settings page (and the user's
// scroll position) never moves. Fetches its own /saved-prompts data
// independently of renderSettings() so it can be called on its own.
async function renderSavedPromptsSection() {
  const host = document.getElementById('sp-section');
  if (!host) return;
  let sp = { prompts: [], active_prompt_id: null };
  try { sp = await api.get('/saved-prompts'); } catch (_) { /* render empty */ }

  host.innerHTML = `
    <section class="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-semibold">Saved Prompts</h2>
          <p class="mt-1 text-sm text-neutral-500">Reusable custom note instructions. Mark one to apply to every note you generate.</p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          ${sp.active_prompt_id != null ? `<button id="sp-clear" class="${btnSecondary}">Don't apply to any</button>` : ''}
          <button id="sp-add" class="${btnPrimary}">Add prompt</button>
        </div>
      </div>
      <div class="mt-4 space-y-2">
        ${(sp.prompts || []).length
          ? sp.prompts.map((p) => savedPromptRowHtml(p, sp.active_prompt_id)).join('')
          : dashed('No saved prompts yet.')}
      </div>
    </section>`;
  playFadeSwap(host);

  document.getElementById('sp-add').addEventListener('click', () => savedPromptModal());

  host.querySelectorAll('[data-sp-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.spEdit);
      const p = (sp.prompts || []).find((x) => x.id === id);
      if (p) savedPromptModal(p);
    });
  });

  host.querySelectorAll('[data-sp-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.spDel);
      const p = (sp.prompts || []).find((x) => x.id === id);
      ui.confirmModal({
        title: 'Delete saved prompt?',
        message: `This removes "${p ? p.name : 'this prompt'}" from your library.`,
        confirmLabel: 'Delete',
        onConfirm: async () => {
          await api.del('/saved-prompts/' + id);
          ui.toast('Deleted');
          await renderSavedPromptsSection();
        },
      });
    });
  });

  host.querySelectorAll('[data-sp-active]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const id = Number(cb.dataset.spActive);
      try {
        await api.put('/saved-prompts/active', { id: cb.checked ? id : null });
        ui.toast(cb.checked ? 'Applied to all notes' : 'Cleared');
        await renderSavedPromptsSection();
      } catch (e) { ui.toast(e.message || 'Failed to update', 'error'); }
    });
  });

  const spClear = document.getElementById('sp-clear');
  if (spClear) spClear.addEventListener('click', async () => {
    try {
      await api.put('/saved-prompts/active', { id: null });
      ui.toast('Cleared');
      await renderSavedPromptsSection();
    } catch (e) { ui.toast(e.message || 'Failed to update', 'error'); }
  });
}

/* ---------- quiz view (Build 3, Step 3): interactive per-concept quiz ---------- */

// Renders any $...$ / $$...$$ LaTeX inside el via KaTeX auto-render, if the
// CDN scripts loaded. No-op (and never throws) if they didn't — the raw
// dollar-delimited text just stays visible as plain text in that case.
function renderMath(el) {
  if (!el || typeof window.renderMathInElement !== 'function') return;
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },  // round 6: renderRichText also protects these from markdown
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false },  // round 6
      ],
      throwOnError: false,
    });
  } catch (_) { /* ignore rendering errors — better a raw formula than a crash */ }
}

let quizState = null;     // { conceptId, courseId, conceptName, questions, i, score, total, answered, selected, shortValue, shortCorrect }
let quizPollTimer = null;

function quizStopPoll() {
  if (quizPollTimer) { clearTimeout(quizPollTimer); quizPollTimer = null; }
}

function quizBackHref() {
  return quizState && quizState.courseId != null ? `#/course/${quizState.courseId}` : '#/';
}

function quizLoadingHtml(msg) {
  return `
    <div class="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
      <span class="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"></span>
      <p class="text-sm text-neutral-500">${esc(msg)}</p>
    </div>`;
}

function quizRenderPreparing() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="mx-auto max-w-md">
      <div class="mb-4"><a href="${quizBackHref()}" class="text-sm text-neutral-500 hover:text-neutral-800">&larr; Back</a></div>
      <div class="flex flex-col items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
        <span class="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700"></span>
        <p class="text-sm font-medium text-neutral-700">Preparing your quiz&hellip;</p>
        <p class="text-xs text-neutral-400">The AI is writing questions for this concept. This can take a little while.</p>
        <button data-action="quiz-cancel" class="mt-2 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-500 hover:border-neutral-300 hover:text-neutral-800">Cancel</button>
      </div>
    </div>`;
}

function quizRenderError(message) {
  quizStopPoll();
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="mx-auto max-w-md">
      <div class="mb-4"><a href="${quizBackHref()}" class="text-sm text-neutral-500 hover:text-neutral-800">&larr; Back</a></div>
      <div class="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-10 text-center shadow-sm">
        <p class="text-sm font-medium text-red-700">Could not prepare the quiz</p>
        <p class="text-xs text-red-600">${esc(message || 'Unknown error')}</p>
        <button data-action="quiz-retry-generate" class="mt-2 ${btnPrimary}">Retry</button>
      </div>
    </div>`;
}

function quizSetQuestions(questions) {
  quizState.questions = questions;
  quizState.i = 0;
  quizState.score = 0;
  quizState.total = questions.reduce((sum, q) => sum + (q.marks || 1), 0);
  quizState.answered = false;
  quizState.selected = null;
  quizState.shortValue = '';
  quizState.shortCorrect = null;
}

async function quizPoll(conceptId) {
  let data;
  try {
    data = await api.get(`/concepts/${conceptId}/quiz`);
  } catch (e) {
    quizRenderError(e.message);
    return;
  }
  if (!quizState || quizState.conceptId !== conceptId) return; // navigated away meanwhile
  quizState.courseId = data.course_id != null ? data.course_id : quizState.courseId;
  quizState.conceptName = data.concept_name || quizState.conceptName;
  if (data.status === 'ready' && data.questions && data.questions.length) {
    quizSetQuestions(data.questions);
    quizRenderRuntime();
  } else if (data.status === 'failed') {
    quizRenderError(data.error_message || 'Quiz generation failed.');
  } else {
    quizPollTimer = setTimeout(() => quizPoll(conceptId), 2000);
  }
}

async function quizStartGeneration(conceptId, regenerate) {
  quizStopPoll();
  quizRenderPreparing();
  try {
    await api.post(`/concepts/${conceptId}/quiz/generate${regenerate ? '?regenerate=1' : ''}`, {});
  } catch (e) {
    quizRenderError(e.message);
    return;
  }
  quizPollTimer = setTimeout(() => quizPoll(conceptId), 2000);
}

async function renderQuiz(conceptIdRaw) {
  quizStopPoll();
  const conceptId = Number(conceptIdRaw);
  quizState = {
    conceptId, courseId: null, conceptName: 'Quiz',
    questions: [], i: 0, score: 0, total: 0,
    answered: false, selected: null, shortValue: '', shortCorrect: null,
  };
  const view = document.getElementById('view');
  view.innerHTML = quizLoadingHtml('Loading quiz…');
  let data;
  try {
    data = await api.get(`/concepts/${conceptId}/quiz`);
  } catch (e) {
    quizRenderError(e.message);
    return;
  }
  quizState.courseId = data.course_id != null ? data.course_id : null;
  quizState.conceptName = data.concept_name || quizState.conceptName;
  if (data.status === 'ready' && data.questions && data.questions.length) {
    quizSetQuestions(data.questions);
    quizRenderRuntime();
  } else {
    await quizStartGeneration(conceptId, false);
  }
}

function quizCategoryTag(category) {
  const isPyq = category === 'pyq';
  const label = isPyq ? 'Past exam' : 'Concept';
  const cls = isPyq
    ? 'border-amber-200 bg-amber-50 text-amber-700'
    : 'border-neutral-200 bg-neutral-100 text-neutral-600';
  return `<span class="inline-block rounded-full border ${cls} px-2 py-0.5 text-[11px] font-medium">${label}</span>`;
}

function quizMcqOptionCls(state) {
  // Big, tactile option buttons (Priority 3): generous padding, hover-lift +
  // press like .btn/.card-interactive, a grape hover border for the
  // unanswered state, and an emerald/red reveal once answered.
  const base = 'w-full rounded-xl border-2 px-5 py-4 text-left text-sm font-medium leading-snug transition-all duration-200 ease-out';
  if (state === 'correct') return `${base} rise-in border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm`;
  if (state === 'wrong') return `${base} rise-in border-red-400 bg-red-50 text-red-800 shadow-sm`;
  if (state === 'disabled') return `${base} border-neutral-200 bg-neutral-50 text-neutral-400`;
  return `${base} border-neutral-200 bg-white text-neutral-700 hover:-translate-y-0.5 hover:border-primary hover:shadow-md active:translate-y-0 active:scale-[0.98]`;
}

function quizHeaderHtml() {
  const { conceptName, i, questions, score, total } = quizState;
  const n = questions.length;
  const pct = n ? Math.round((i / n) * 100) : 0;
  return `
    <div class="mb-6 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-wide text-neutral-400">Quiz</p>
        <h2 class="truncate text-xl font-semibold tracking-tight">${esc(conceptName)}</h2>
      </div>
      <button data-action="quiz-exit" class="shrink-0 ${btnSecondary}">Exit</button>
    </div>
    <div class="mb-6 flex items-center gap-4">
      <div class="h-2 flex-1 overflow-hidden rounded-full bg-neutral-100">
        <div class="h-full rounded-full bg-primary transition-all duration-500 ease-out" style="width:${pct}%"></div>
      </div>
      <span class="shrink-0 text-xs font-medium text-neutral-500">Question ${Math.min(i + 1, n)} of ${n}</span>
      <span class="shrink-0 chip chip-grape">Score ${score}</span>
    </div>`;
}

function quizBodyHtml() {
  const q = quizState.questions[quizState.i];
  if (!q) return '';
  const marks = q.marks || 1;
  let inner;
  if (q.kind === 'mcq') {
    const opts = (q.options || []).map((opt, idx) => {
      let state = 'default';
      if (quizState.answered) {
        if (idx === q.answer_index) state = 'correct';
        else if (idx === quizState.selected) state = 'wrong';
        else state = 'disabled';
      }
      return `<button data-action="quiz-answer-mcq" data-idx="${idx}" ${quizState.answered ? 'disabled' : ''}
        class="${quizMcqOptionCls(state)}">${esc(opt)}</button>`;
    }).join('');
    inner = `<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">${opts}</div>`;
  } else {
    inner = `
      <div class="max-w-lg">
        <input id="quiz-short-input" type="text" ${quizState.answered ? 'disabled' : ''}
          value="${quizState.answered ? esc(quizState.shortValue || '') : ''}"
          placeholder="Type your answer…" class="${inputCls}" />
        <p id="quiz-short-hint" class="mt-1.5 hidden text-xs text-red-500">Type an answer first</p>
        ${!quizState.answered ? `<button data-action="quiz-submit-short" class="mt-3 ${btnPrimary}" disabled>Submit</button>` : ''}
      </div>`;
  }
  let feedback = '';
  if (quizState.answered) {
    if (q.kind === 'mcq') {
      const correct = quizState.selected === q.answer_index;
      feedback = `
        <div class="rise-in mt-4 rounded-xl border ${correct ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'} p-4">
          <p class="text-sm font-semibold ${correct ? 'text-emerald-700' : 'text-red-700'}">${correct ? 'Correct!' : 'Wrong'}</p>
          ${q.explanation ? `<p class="quiz-explanation mt-1 text-sm text-neutral-700">${esc(q.explanation)}</p>` : ''}
        </div>`;
    } else {
      const selfCheck = quizState.shortCorrect === null
        ? `
          <div class="mt-3 flex flex-wrap items-center gap-3">
            <p class="text-sm text-neutral-500">Did you get it right?</p>
            <button data-action="quiz-self-correct" class="${btnPrimary}">I got it right</button>
            <button data-action="quiz-self-wrong" class="${btnSecondary}">I got it wrong</button>
          </div>`
        : `<p class="mt-3 text-sm font-semibold ${quizState.shortCorrect ? 'text-emerald-700' : 'text-red-700'}">${quizState.shortCorrect ? 'Marked correct — nice work.' : 'Marked wrong — keep at it.'}</p>`;
      feedback = `
        <div class="rise-in mt-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
          <p class="quiz-answer-text text-sm font-medium text-neutral-700">Correct answer: <span class="font-semibold">${esc(q.answer_text || '')}</span></p>
          ${q.explanation ? `<p class="quiz-explanation mt-1 text-sm text-neutral-700">${esc(q.explanation)}</p>` : ''}
          ${selfCheck}
        </div>`;
    }
  }
  const showNext = quizState.answered && (q.kind === 'mcq' || quizState.shortCorrect !== null);
  const isLast = quizState.i === quizState.questions.length - 1;
  return `
    <div class="card rise-in p-6 sm:p-8">
      <div class="flex items-center justify-between gap-2">
        ${quizCategoryTag(q.category)}
        <span class="text-xs font-medium text-neutral-400">${marks} mark${marks === 1 ? '' : 's'}</span>
      </div>
      <p class="quiz-question mt-3 text-lg font-medium leading-snug text-ink">${esc(q.question)}</p>
      <div class="mt-5">${inner}</div>
      ${feedback}
      ${showNext ? `<div class="mt-6 flex justify-end"><button data-action="quiz-next" class="${btnPrimary}">${isLast ? 'Finish' : 'Next question'}</button></div>` : ''}
    </div>`;
}

function quizWireShortInput() {
  const input = document.getElementById('quiz-short-input');
  if (input && !quizState.answered) {
    input.focus();
    const submitBtn = document.querySelector('[data-action="quiz-submit-short"]');
    const hint = document.getElementById('quiz-short-hint');
    const sync = () => {
      const blank = input.value.trim() === '';
      if (submitBtn) submitBtn.disabled = blank;
      if (!blank && hint) hint.classList.add('hidden');
    };
    input.addEventListener('input', sync);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); quizSubmitShort(); } });
  }
}

function quizRenderRuntime() {
  const view = document.getElementById('view');
  view.innerHTML = `
    <div class="mx-auto max-w-3xl">
      <div id="quiz-header">${quizHeaderHtml()}</div>
      <div id="quiz-body">${quizBodyHtml()}</div>
    </div>`;
  renderMath(document.getElementById('quiz-body'));
  quizWireShortInput();
}

function quizRefresh() {
  const header = document.getElementById('quiz-header');
  const body = document.getElementById('quiz-body');
  if (header) header.innerHTML = quizHeaderHtml();
  if (body) {
    body.innerHTML = quizBodyHtml();
    renderMath(body);
    quizWireShortInput();
  }
}

function quizAnswerMcq(idx) {
  if (!quizState || quizState.answered) return;
  const q = quizState.questions[quizState.i];
  quizState.answered = true;
  quizState.selected = idx;
  if (idx === q.answer_index) quizState.score += (q.marks || 1);
  quizRefresh();
}

function quizSubmitShort() {
  if (!quizState || quizState.answered) return;
  const input = document.getElementById('quiz-short-input');
  const value = input ? input.value.trim() : '';
  if (value === '') {
    // Rejected: blank/whitespace-only answers don't advance the quiz. Also
    // guards the Enter-key path, which bypasses the disabled Submit button.
    const hint = document.getElementById('quiz-short-hint');
    if (hint) hint.classList.remove('hidden');
    if (input) input.focus();
    return;
  }
  quizState.shortValue = value;
  quizState.answered = true;
  quizState.shortCorrect = null; // pending self-check
  quizRefresh();
}

function quizSelfCorrect() {
  if (!quizState || quizState.shortCorrect !== null) return;
  const q = quizState.questions[quizState.i];
  quizState.shortCorrect = true;
  quizState.score += (q.marks || 1);
  quizRefresh();
}

function quizSelfWrong() {
  if (!quizState || quizState.shortCorrect !== null) return;
  quizState.shortCorrect = false;
  quizRefresh();
}

async function quizFinish() {
  const { conceptId, score, total } = quizState;
  let progress = null;
  try {
    progress = await api.post(`/concepts/${conceptId}/quiz/result`, { score, total });
  } catch (e) {
    ui.toast(e.message || 'Could not save quiz result', 'error');
  }
  let attempts = [];
  try { attempts = await api.get(`/concepts/${conceptId}/attempts`); } catch (_) { /* nice-to-have — skip if unavailable */ }
  quizRenderSummary(progress, attempts);
}

function quizNext() {
  if (!quizState) return;
  if (quizState.i >= quizState.questions.length - 1) {
    quizFinish();
    return;
  }
  quizState.i += 1;
  quizState.answered = false;
  quizState.selected = null;
  quizState.shortValue = '';
  quizState.shortCorrect = null;
  quizRefresh();
}

function quizPerfMessage(score, total) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  if (total > 0 && score >= total) return 'Perfect score — you have mastered this concept.';
  if (pct >= 80) return 'Great work — almost there.';
  if (pct >= 50) return 'Solid effort — a bit more practice will help.';
  return 'Keep practicing — you will get there.';
}

function quizRenderSummary(progress, attempts) {
  const { score, total } = quizState;
  const full = total > 0 && score >= total;
  const view = document.getElementById('view');
  const doneNote = full
    ? `<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Lesson complete! &#10003; Marked done.</div>`
    : '';
  // Nice-to-have (Feature 2): a compact "most recent first" trail of past
  // attempts on this concept — cap 5 so it never crowds the summary card.
  const attemptsLine = (attempts && attempts.length)
    ? `<p class="mt-3 text-xs text-neutral-400">Your attempts: ${attempts.slice(0, 5).map((a) => `${a.score}/${a.total}`).join(' &middot; ')}</p>`
    : '';
  view.innerHTML = `
    <div class="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-neutral-400">Quiz complete</p>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight">${score} / ${total}</h2>
      <p class="mt-2 text-sm text-neutral-500">${esc(quizPerfMessage(score, total))}</p>
      ${doneNote}
      ${attemptsLine}
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button data-action="quiz-retry" class="${btnSecondary}">Retry</button>
        <button data-action="quiz-new" class="${btnSecondary}">New questions</button>
        <a href="${quizBackHref()}" class="${btnPrimary}">Back to course</a>
      </div>
    </div>`;
}

async function quizCancel() {
  quizStopPoll();
  const cid = quizState && quizState.conceptId;
  const back = quizBackHref();
  if (cid != null) { try { await api.post(`/concepts/${cid}/quiz/cancel`, {}); } catch (_) { /* ignore */ } }
  ui.toast('Quiz cancelled');
  location.hash = back;
}

// G3: on Retry, reshuffle each MCQ's option order (Fisher-Yates) so it isn't
// a pixel-identical replay of the layout the student just saw the answers
// for — the stored answer_index is remapped to the option's NEW position so
// correctness checking (quizAnswerMcq) is unaffected. Short-answer questions
// have no fixed option order, so they're untouched.
function quizShuffleMcqOptions(q) {
  if (!q || q.kind !== 'mcq' || !Array.isArray(q.options) || q.options.length < 2) return;
  if (typeof q.answer_index !== 'number' || !q.options[q.answer_index]) return;
  const correctOption = q.options[q.answer_index];
  const shuffled = q.options.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  q.options = shuffled;
  q.answer_index = shuffled.indexOf(correctOption);
}

function quizRetry() {
  if (!quizState) return;
  quizState.questions.forEach(quizShuffleMcqOptions);
  quizState.i = 0;
  quizState.score = 0;
  quizState.answered = false;
  quizState.selected = null;
  quizState.shortValue = '';
  quizState.shortCorrect = null;
  quizRenderRuntime();
}

async function quizNewQuestions() {
  if (!quizState) return;
  await quizStartGeneration(quizState.conceptId, true);
}

function quizExit() {
  // B6: leaving mid-attempt throws away the in-progress answers AND the
  // generated question set — confirm first if the student has started.
  const started = quizState && (quizState.answered || (quizState.i || 0) > 0);
  if (started) {
    ui.confirmModal({
      title: 'Leave the quiz?',
      message: 'You’ll lose your progress on this attempt and the generated questions. Leave anyway?',
      confirmLabel: 'Leave',
      onConfirm: async () => { location.hash = quizBackHref(); },
    });
    return;
  }
  location.hash = quizBackHref();
}

/* ---------- global task tray (Build 3 Further-Fixes, Step 4) ----------
   An always-on, bottom-right chip showing background work (extraction /
   note generation / quiz generation) across the WHOLE app, independent of
   whatever route is on screen. Built once into document.body at init (see
   initTaskTray() near the bottom) so route()/renderX() never wipe it. */

let taskTrayOpen = false; // survives refreshes so the panel doesn't collapse under the user
let taskTrayPrevCount = 0; // D4: last-seen active count, to fire a completion toast only on >0 -> 0

function buildTaskTray() {
  if (document.getElementById('task-tray')) return; // idempotent — never double-mount
  const host = document.createElement('div');
  host.id = 'task-tray';
  host.className = 'fixed bottom-4 right-4 z-[55] hidden flex flex-col items-end gap-2';
  host.innerHTML = `
    <div data-tray-panel class="hidden w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-neutral-200 bg-white p-3 shadow-lg"></div>
    <button type="button" data-action="tray-toggle"
      class="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3.5 py-2 text-xs font-medium text-neutral-700 shadow-sm hover:bg-neutral-50">
      <span class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600"></span>
      <span data-tray-count>0 tasks processing</span>
    </button>`;
  document.body.appendChild(host);
}

function taskTrayItemHtml(task) {
  const cancelHtml = task.cancelable
    ? `<button type="button" data-action="tray-cancel" data-course-id="${task.course_id}"
         class="shrink-0 rounded-lg border border-neutral-200 px-2 py-1 text-[11px] text-neutral-500 hover:border-neutral-300 hover:text-neutral-800">Cancel</button>`
    : `<span class="shrink-0 text-[11px] text-neutral-400" title="Quiz generation can't be cancelled">&mdash;</span>`;
  return `
    <div class="flex items-start justify-between gap-2 py-1.5 text-xs first:pt-0">
      <span class="text-neutral-700">${esc(task.label)}</span>
      ${cancelHtml}
    </div>`;
}

async function refreshTaskTray() {
  const host = document.getElementById('task-tray');
  if (!host) return;
  let data;
  try {
    data = await api.get('/tasks/active');
  } catch (_) {
    // D1: opportunistic recheck — if the backend has actually gone down, this
    // poll (every 2.5s) is the fastest available signal, well ahead of the
    // dedicated 90s health interval. Fire-and-forget; refreshHealthPill has
    // its own try/catch and won't throw.
    refreshHealthPill();
    return; // transient failure — skip this tick silently, don't spam toasts
  }
  const tasks = (data && data.tasks) || [];
  const count = (data && data.count) || 0;
  // D4: fire a one-shot "finished" toast on the >0 -> 0 transition only (never
  // on every poll, and never when it was already 0 — e.g. right after boot).
  if (count === 0 && taskTrayPrevCount > 0) {
    ui.toast('Background tasks finished');
  }
  taskTrayPrevCount = count;
  if (count === 0) {
    host.classList.add('hidden');
    return;
  }
  host.classList.remove('hidden');
  const countEl = host.querySelector('[data-tray-count]');
  if (countEl) countEl.textContent = `${count} task${count === 1 ? '' : 's'} processing`;
  const panel = host.querySelector('[data-tray-panel]');
  if (panel) {
    panel.innerHTML = tasks.map(taskTrayItemHtml).join('');
    panel.classList.toggle('hidden', !taskTrayOpen);
  }
}

function taskTrayToggle() {
  taskTrayOpen = !taskTrayOpen;
  const panel = document.querySelector('#task-tray [data-tray-panel]');
  if (panel) panel.classList.toggle('hidden', !taskTrayOpen);
}

async function taskTrayCancel(courseId) {
  try {
    await api.post(`/courses/${courseId}/job/cancel`, {});
    ui.toast('Cancelling…');
    await refreshTaskTray();
  } catch (e) { ui.toast(e.message, 'error'); }
}

function initTaskTray() {
  buildTaskTray();
  refreshTaskTray();
  setInterval(refreshTaskTray, 2500);
}

/* ---------- Pomodoro focus timer (Build 6, Step 4) ----------
   Entirely frontend: no backend, no DB, no Gemini. State lives in
   localStorage so a running session survives a reload (or even the tab being
   closed), and a bottom-center tray (mirroring the bottom-right task tray
   above, but never overlapping it) shows/controls it from anywhere in the
   app. The PDF reader's navbar also gets a compact live readout — see the
   `#reader-pomodoro` button built in openReader(). */

const POMODORO_STORAGE_KEY = 'axiom_pomodoro';
const POMODORO_PREFS_KEY = 'axiom_pomodoro_prefs';
const POMODORO_PRESETS = [25, 45, 60]; // minutes — quick-pick buttons in the setup popup
const POMODORO_DURATION_OPTIONS = [15, 25, 45, 60, 90]; // minutes — Settings' "default duration" select

let pomodoro = null;             // { startedAt, durationSec, paused, pausedRemainingSec, label } | null
let pomodoroInterval = null;     // the single setInterval(pomodoroTick, 1000), running whenever pomodoro != null
let pomodoroAudioCtx = null;     // lazily created inside a user gesture (Start click) so the chime is allowed to play
let pomodoroManageCloseFn = null; // the mounted manage-popup's close(), if one is open — lets a natural completion dismiss it

function pomodoroPrefs() {
  try {
    const raw = localStorage.getItem(POMODORO_PREFS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    const defaultMin = Number(p && p.defaultMin);
    return {
      defaultMin: Number.isFinite(defaultMin) && defaultMin > 0 ? defaultMin : 25,
      chime: !p || p.chime !== false,
    };
  } catch (_) { return { defaultMin: 25, chime: true }; }
}

function pomodoroSavePrefs(prefs) {
  try { localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify(prefs)); } catch (_) { /* storage unavailable — ignore */ }
}

function pomodoroSave() {
  try {
    if (pomodoro) localStorage.setItem(POMODORO_STORAGE_KEY, JSON.stringify(pomodoro));
    else localStorage.removeItem(POMODORO_STORAGE_KEY);
  } catch (_) { /* storage unavailable — degrade to in-memory only for this tab */ }
}

function pomodoroLoad() {
  try {
    const raw = localStorage.getItem(POMODORO_STORAGE_KEY);
    if (!raw) { pomodoro = null; return; }
    const p = JSON.parse(raw);
    if (!p || typeof p.startedAt !== 'number' || typeof p.durationSec !== 'number') { pomodoro = null; return; }
    pomodoro = p;
    // A running (non-paused) timer whose time fully elapsed while the tab was
    // closed shouldn't fire a stale "complete" chime/toast on reload — just
    // drop it silently.
    if (!pomodoro.paused && pomodoroRemaining() <= 0) { pomodoro = null; pomodoroSave(); }
  } catch (_) { pomodoro = null; }
}

// Seconds left, always >= 0.
function pomodoroRemaining() {
  if (!pomodoro) return 0;
  if (pomodoro.paused) return Math.max(0, pomodoro.pausedRemainingSec);
  return Math.max(0, pomodoro.durationSec - Math.floor((Date.now() - pomodoro.startedAt) / 1000));
}

function fmtMMSS(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pomodoroEnsureInterval() {
  if (pomodoroInterval) return;
  pomodoroInterval = setInterval(pomodoroTick, 1000);
}

function pomodoroClearInterval() {
  if (pomodoroInterval) { clearInterval(pomodoroInterval); pomodoroInterval = null; }
}

// Re-paints every surface that can be showing the timer right now: the
// bottom-center tray, the reader navbar button (if the reader is open), and
// the manage popup (if it's open) — each is a no-op when its element isn't
// in the DOM, so this is safe to call unconditionally from anywhere.
function pomodoroRenderAll() {
  renderPomodoroTray();
  renderPomodoroReaderBtn();
  renderPomodoroManageModal();
}

function pomodoroTick() {
  if (!pomodoro) { pomodoroClearInterval(); return; }
  if (!pomodoro.paused && pomodoroRemaining() <= 0) { pomodoroComplete(); return; }
  pomodoroRenderAll();
}

function pomodoroAudioContext() {
  if (pomodoroAudioCtx) return pomodoroAudioCtx;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    pomodoroAudioCtx = Ctx ? new Ctx() : null;
  } catch (_) { pomodoroAudioCtx = null; }
  return pomodoroAudioCtx;
}

// A gentle two-note chime (sine, ~660Hz then ~880Hz). Best-effort: any
// failure (no Web Audio support, autoplay policy, etc.) is swallowed —
// a missing chime should never break the timer itself.
function pomodoroChime() {
  if (!pomodoroPrefs().chime) return;
  try {
    const ctx = pomodoroAudioContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    const now = ctx.currentTime;
    [[660, 0], [880, 0.16]].forEach(([freq, delay]) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = now + delay;
      const dur = 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  } catch (_) { /* best-effort — never throw from a chime */ }
}

function pomodoroStart(durationSec, label) {
  pomodoro = { startedAt: Date.now(), durationSec, paused: false, pausedRemainingSec: 0, label: label || '' };
  pomodoroSave();
  pomodoroEnsureInterval();
  pomodoroRenderAll();
  ui.toast('Focus session started');
}

function pomodoroPause() {
  if (!pomodoro || pomodoro.paused) return;
  pomodoro.pausedRemainingSec = pomodoroRemaining();
  pomodoro.paused = true;
  pomodoroSave();
  pomodoroRenderAll();
}

function pomodoroResume() {
  if (!pomodoro || !pomodoro.paused) return;
  pomodoro.startedAt = Date.now() - (pomodoro.durationSec - pomodoro.pausedRemainingSec) * 1000;
  pomodoro.paused = false;
  pomodoroSave();
  pomodoroEnsureInterval();
  pomodoroRenderAll();
}

function pomodoroStop() {
  pomodoro = null;
  pomodoroSave();
  pomodoroClearInterval();
  pomodoroRenderAll();
}

function pomodoroComplete() {
  pomodoroChime();
  ui.toast('Focus session complete 🎉');
  pomodoro = null;
  pomodoroSave();
  pomodoroClearInterval();
  pomodoroRenderAll();
}

const POMODORO_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/>' +
  '<path d="M12 9v4l2.5 2.5"/><path d="M9 2h6"/></svg>';

/* ---- bottom-center tray (mirrors buildTaskTray/refreshTaskTray's pattern) ---- */

function buildPomodoroTray() {
  if (document.getElementById('pomodoro-tray')) return; // idempotent — never double-mount
  const host = document.createElement('div');
  host.id = 'pomodoro-tray';
  // bottom-CENTER (the task tray owns bottom-right) + z-[60] so it floats
  // above the reader overlay (z-index: 55, see reader.css).
  host.className = 'fixed bottom-4 left-1/2 z-[60] hidden -translate-x-1/2';
  host.innerHTML = `
    <div class="flex items-center gap-3 rounded-full border border-neutral-200 bg-white py-2 pl-4 pr-2 shadow-lg">
      <div data-action="open-pomodoro" class="flex cursor-pointer items-center gap-2.5">
        <span class="shrink-0 text-neutral-400">${POMODORO_ICON_SVG}</span>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span data-pomo-time class="text-sm font-semibold tabular-nums text-ink">0:00</span>
            <span data-pomo-label class="hidden max-w-[9rem] truncate text-xs text-neutral-400"></span>
          </div>
          <div class="h-1 w-32 overflow-hidden rounded-full bg-neutral-100">
            <div data-pomo-bar class="h-full rounded-full bg-ink" style="width:0%"></div>
          </div>
        </div>
      </div>
      <div class="flex items-center gap-0.5">
        <button type="button" data-action="pomo-pause" title="Pause"
          class="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
        </button>
        <button type="button" data-action="pomo-resume" title="Resume"
          class="hidden rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-ink">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z"/></svg>
        </button>
        <button type="button" data-action="pomo-stop" title="Stop"
          class="rounded-full p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>
        </button>
      </div>
    </div>`;
  document.body.appendChild(host);
}

function renderPomodoroTray() {
  const host = document.getElementById('pomodoro-tray');
  if (!host) return;
  if (!pomodoro) { host.classList.add('hidden'); return; }
  host.classList.remove('hidden');
  const remaining = pomodoroRemaining();
  const timeEl = host.querySelector('[data-pomo-time]');
  const labelEl = host.querySelector('[data-pomo-label]');
  const barEl = host.querySelector('[data-pomo-bar]');
  const pauseBtn = host.querySelector('[data-action="pomo-pause"]');
  const resumeBtn = host.querySelector('[data-action="pomo-resume"]');
  if (timeEl) timeEl.textContent = fmtMMSS(remaining);
  if (labelEl) {
    labelEl.textContent = pomodoro.label || '';
    labelEl.classList.toggle('hidden', !pomodoro.label);
  }
  if (barEl) {
    const pct = pomodoro.durationSec > 0 ? Math.min(100, Math.max(0, (1 - remaining / pomodoro.durationSec) * 100)) : 0;
    barEl.style.width = pct + '%';
  }
  if (pauseBtn) pauseBtn.classList.toggle('hidden', pomodoro.paused);
  if (resumeBtn) resumeBtn.classList.toggle('hidden', !pomodoro.paused);
}

/* ---- reader navbar control (see openReader() for the mount point) ---- */

function renderPomodoroReaderBtn() {
  const btn = document.getElementById('reader-pomodoro');
  if (!btn) return; // reader isn't open — nothing to do
  if (pomodoro) {
    btn.classList.add('reader-tool-btn-timer');
    btn.innerHTML = `<span class="tabular-nums">${fmtMMSS(pomodoroRemaining())}</span>`;
    btn.title = pomodoro.paused ? 'Focus timer (paused) — click to manage' : 'Focus timer — click to manage';
  } else {
    btn.classList.remove('reader-tool-btn-timer');
    btn.title = 'Focus timer';
    btn.innerHTML = POMODORO_ICON_SVG;
  }
}

/* ---- setup / manage popup ---- */

function pomodoroModal() {
  if (pomodoro) pomodoroManageModal();
  else pomodoroSetupModal();
}

function pomodoroManageModal() {
  const { card, close } = ui.mountOverlay(`
    <div class="p-5">
      <h3 class="text-lg font-semibold">Focus session</h3>
      <div class="mt-4 flex flex-col items-center gap-1 rounded-xl bg-neutral-50 py-7">
        <span data-pm-time class="text-4xl font-semibold tabular-nums text-ink">${fmtMMSS(pomodoroRemaining())}</span>
        <span data-pm-label class="text-sm text-neutral-400">${esc(pomodoro.label || '')}</span>
      </div>
      <div class="mt-5 flex justify-center gap-2">
        <button type="button" data-pm-pause class="${btnSecondary}"${pomodoro.paused ? ' style="display:none"' : ''}>Pause</button>
        <button type="button" data-pm-resume class="${btnSecondary}"${!pomodoro.paused ? ' style="display:none"' : ''}>Resume</button>
        <button type="button" data-pm-stop
          class="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50">Stop</button>
      </div>
      <div class="mt-5 border-t border-neutral-100 pt-4 text-center">
        <button type="button" data-pm-new class="text-sm text-neutral-500 hover:text-neutral-800">Start a new session instead</button>
      </div>
    </div>`);
  pomodoroManageCloseFn = close;
  card.querySelector('[data-pm-pause]').addEventListener('click', pomodoroPause);
  card.querySelector('[data-pm-resume]').addEventListener('click', pomodoroResume);
  card.querySelector('[data-pm-stop]').addEventListener('click', () => {
    pomodoroStop();
    pomodoroManageCloseFn = null;
    close();
  });
  card.querySelector('[data-pm-new]').addEventListener('click', () => {
    pomodoroStop();
    pomodoroManageCloseFn = null;
    close();
    pomodoroSetupModal();
  });
}

// Keeps an already-open manage popup live: called every tick (and after every
// state change via pomodoroRenderAll). A no-op if the popup isn't mounted. If
// the timer completes/stops while the popup is open, close it via the close()
// captured when it was opened.
function renderPomodoroManageModal() {
  const timeEl = document.querySelector('[data-pm-time]');
  if (!timeEl) return;
  if (!pomodoro) {
    if (pomodoroManageCloseFn) { pomodoroManageCloseFn(); pomodoroManageCloseFn = null; }
    return;
  }
  timeEl.textContent = fmtMMSS(pomodoroRemaining());
  const labelEl = document.querySelector('[data-pm-label]');
  if (labelEl) labelEl.textContent = pomodoro.label || '';
  const pauseBtn = document.querySelector('[data-pm-pause]');
  const resumeBtn = document.querySelector('[data-pm-resume]');
  if (pauseBtn) pauseBtn.style.display = pomodoro.paused ? 'none' : '';
  if (resumeBtn) resumeBtn.style.display = pomodoro.paused ? '' : 'none';
}

function pomodoroSetupModal() {
  const prefs = pomodoroPrefs();
  const defaultPreset = POMODORO_PRESETS.includes(prefs.defaultMin) ? prefs.defaultMin : 25;
  const presetBtnCls = (active) => 'pomo-preset-btn rounded-lg border px-3 py-2 text-sm font-medium transition ' +
    (active ? 'border-ink bg-ink text-white' : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50');
  const presetBtns = POMODORO_PRESETS.map((m) =>
    `<button type="button" data-pm-preset="${m}" class="${presetBtnCls(m === defaultPreset)}">${m} min</button>`).join('');
  const { card, close } = ui.mountOverlay(`
    <div class="p-5">
      <h3 class="text-lg font-semibold">Start a focus session</h3>
      <div class="mt-4 grid grid-cols-3 gap-2">${presetBtns}</div>
      <div class="mt-4">${field('Custom minutes', `<input id="pm-custom" type="number" min="1" max="180" class="${inputCls}" placeholder="e.g. 50">`)}</div>
      <div class="mt-3">${field('Label (optional)', `<input id="pm-label" class="${inputCls}" placeholder="Focus">`)}</div>
      <p data-pm-err class="mt-3 hidden text-sm text-red-600"></p>
      <div class="mt-5 flex justify-end gap-2">
        <button type="button" data-pm-cancel class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100">Cancel</button>
        <button type="button" data-pm-start class="${btnPrimary}">Start</button>
      </div>
    </div>`);
  let selectedPreset = defaultPreset;
  const customInput = card.querySelector('#pm-custom');
  const labelInput = card.querySelector('#pm-label');
  const errEl = card.querySelector('[data-pm-err]');
  card.querySelectorAll('[data-pm-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedPreset = Number(btn.dataset.pmPreset);
      card.querySelectorAll('[data-pm-preset]').forEach((b) => { b.className = presetBtnCls(b === btn); });
      customInput.value = '';
    });
  });
  card.querySelector('[data-pm-cancel]').addEventListener('click', close);
  card.querySelector('[data-pm-start]').addEventListener('click', () => {
    errEl.classList.add('hidden');
    let minutes = selectedPreset;
    const customVal = customInput.value.trim();
    if (customVal) {
      const n = Number(customVal);
      if (!Number.isFinite(n) || n <= 0 || n > 180) {
        errEl.textContent = 'Enter a duration between 1 and 180 minutes.';
        errEl.classList.remove('hidden');
        return;
      }
      minutes = n;
    }
    // Create/resume the shared AudioContext from inside this click (a real
    // user gesture) so the eventual completion chime is allowed to play.
    const ctx = pomodoroAudioContext();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    pomodoroStart(Math.round(minutes * 60), labelInput.value.trim());
    close();
  });
}

function initPomodoro() {
  buildPomodoroTray();
  pomodoroLoad();
  if (pomodoro) pomodoroEnsureInterval();
  renderPomodoroTray();
}

/* ---------- theme control (Build 7, Phase 1: light/dark/system) ----------
   Mirrors the no-flash inline script in index.html's <head> (which applies
   the theme synchronously before first paint using the same localStorage key
   and the same system-preference check, since app.js loads later). */

function getTheme() {
  try { return localStorage.getItem('axiom_theme') || 'system'; }
  catch (_) { return 'system'; }
}

function applyTheme() {
  const t = getTheme();
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme:dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

function setTheme(mode) {
  try { localStorage.setItem('axiom_theme', mode); } catch (_) {}
  applyTheme();
  renderThemeToggle();
  renderSidebarThemeToggle();
}

const THEME_OPTIONS = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

// G7: compact single-button theme control for the sidebar bottom cluster
// (icon + hover-revealed label, matching #health-pill/#sidebar-user rows).
// Clicking cycles system -> light -> dark -> system by dispatching the SAME
// data-action="theme-<mode>" the Settings 3-way control already uses (see
// dispatch() below) — no new dispatcher branch, so there is exactly one
// handler per click either way (never a double-fire). Kept alongside the
// segmented control in Settings (#theme-toggle/renderThemeToggle); both are
// re-rendered together from setTheme()/initTheme() so they never drift.
const THEME_CYCLE_ICONS = {
  system: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/></svg>',
  light: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
};
const THEME_CYCLE_ORDER = ['system', 'light', 'dark'];
function renderSidebarThemeToggle() {
  const el = document.getElementById('sidebar-theme-toggle');
  if (!el) return;
  const current = getTheme();
  const idx = THEME_CYCLE_ORDER.indexOf(current);
  const next = THEME_CYCLE_ORDER[(idx < 0 ? 0 : idx + 1) % THEME_CYCLE_ORDER.length];
  const opt = THEME_OPTIONS.find((o) => o.mode === current);
  const label = opt ? opt.label : 'System';
  el.innerHTML = `
    <button data-action="theme-${next}" title="Theme: ${esc(label)} — click to change" class="sidebar-nav-item">
      <span class="sidebar-icon-slot">${THEME_CYCLE_ICONS[current] || THEME_CYCLE_ICONS.system}</span><span>Theme: ${esc(label)}</span>
    </button>`;
}

// Renders the compact segmented System/Light/Dark control into the sidebar's
// #theme-toggle slot (index.html, above #health-pill). Re-rendered on every
// setTheme() call so the active option's highlight stays in sync.
function renderThemeToggle() {
  const el = document.getElementById('theme-toggle');
  if (!el) return;
  const current = getTheme();
  el.innerHTML = `
    <div class="flex items-center gap-0.5 rounded-lg surface-2 p-0.5 text-xs">
      ${THEME_OPTIONS.map(({ mode, label }) => `
        <button data-action="theme-${mode}" title="${label} theme"
          class="flex-1 rounded-md px-2 py-1 font-medium transition ${mode === current ? 'chip-grape' : 'text-muted'}">
          ${label}
        </button>`).join('')}
    </div>`;
}

// Applies the persisted/system theme and mounts the sidebar toggle. Called
// once from enterApp(); also safe to call at boot before auth resolves.
function initTheme() {
  applyTheme();
  renderThemeToggle();
  renderSidebarThemeToggle();
}

// Live-follow the OS theme while the user's choice is 'system' (does not
// override an explicit light/dark choice).
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme();
  });
} catch (_) {}

/* ---------- Question Analysis (Build 12, Phase 2 — frontend) ----------
   Backend (Phase 1, already live): GET /courses/:id/analysis -> { status,
   data|null, stale, pyq_count, concept_count[, error_message] };
   POST /courses/:id/analysis/generate -> 202 (409 running, 400 no PYQs).
   `status` is 'pending' (no row yet — never run) | 'generating' | 'ready' |
   'failed'. One row per course; on-demand + cached + stale-aware, mirrors
   the mind-map discovery control (mindmap.js) and the quiz generate/poll
   flow. This phase is a pure viz over `data` (an AnalysisResult) — NO
   revision/PDF (that's Phases 3-4; deliberately not referenced here).
   All markup uses `.qa-*` classes from analysis.css + the app's existing
   `.card`/`.btn`/`.chip` component classes (theme.css) — no new color
   system, no chart library. ---------- */

let analysisPollTimer = null;
let analysisPollCourseId = null; // guards a stray timer from a prior course/route

// Ready-state viz state for the per-exam topic filter (added after the
// original Build 12 viz): { cid, exams, res, selectedExamId ('all'|examId),
// examFilters ({examId: Promise|{hasConcepts,names}}), conceptNamesPromise }.
// Built fresh by analysisRenderBody only when status==='ready'; null in every
// other state so a stale data-action="analysis-exam" click (e.g. left over
// after navigating away) is a harmless no-op. Cleared in analysisStopPoll(),
// which route() already calls on every navigation.
let analysisViewState = null;

function analysisStopPoll() {
  if (analysisPollTimer) { clearTimeout(analysisPollTimer); analysisPollTimer = null; }
  analysisPollCourseId = null;
  analysisViewState = null;
}

// A tiny semantic pill reusing the app's existing container-tint tokens
// directly (no new success/warning/danger color classes needed). A leading
// status dot + bolder weight (`.qa-status-pill`/`.qa-status-dot`, analysis.css)
// makes it read as a prominent status chip rather than a quiet label.
function analysisPillHtml(label, kind) {
  const styles = {
    success: { bg: 'var(--success-c)', fg: 'var(--on-mint-c)', dot: 'var(--success)' },
    warning: { bg: 'var(--warning-c)', fg: 'var(--on-lemon-c)', dot: 'var(--warning)' },
    danger: { bg: 'var(--danger-c)', fg: 'var(--on-danger-c)', dot: 'var(--danger)' },
    info: { bg: 'var(--sky-c)', fg: 'var(--on-sky-c)', dot: 'var(--info)' },
    neutral: { bg: 'var(--surface-2)', fg: 'var(--text-muted)', dot: 'var(--text-subtle)' },
  };
  const s = styles[kind] || styles.neutral;
  return `<span class="chip qa-status-pill" style="background:${s.bg};color:${s.fg}"><span class="qa-status-dot" style="background:${s.dot}"></span>${esc(label)}</span>`;
}

function analysisPillForStatus(status, stale, pyqCount) {
  if (!pyqCount) return '';
  if (status === 'generating') {
    return `<span class="chip qa-status-pill qa-pill-live" style="background:var(--sky-c);color:var(--on-sky-c)"><span class="qa-spinner"></span>Analyzing…</span>`;
  }
  if (status === 'ready') return stale ? analysisPillHtml('Stale', 'warning') : analysisPillHtml('Ready', 'success');
  if (status === 'failed') return analysisPillHtml('Failed', 'danger');
  return analysisPillHtml('Not analyzed', 'neutral');
}

/* ---- selection page: #/analysis ---- */
// Mirrors the Courses page's `courseCard` visual language (leading
// accentTileStyle() gradient tile with initials, name, accentChipCls() code
// chip) so the two pages read as one family — see app.js `courseCard` (~75)
// + theme.css `.course-tile` (~272). The readiness pill moves up beside the
// name (a prominent `.qa-status-pill`, filled in async); the PYQ-count line
// + CTA slot are unchanged.

function analysisCourseCardHtml(c, i) {
  const code = c.code
    ? `<div class="mt-1"><span class="chip ${accentChipCls(c.id)}">${esc(c.code)}</span></div>`
    : '';
  return `
    <div id="qa-card-${c.id}" style="${riseDelayStyle(i)}" class="card rise-in p-5">
      <div class="flex items-start gap-3">
        <span class="course-tile" style="${accentTileStyle(c.id)}">${esc(courseInitials(c.name))}</span>
        <div class="min-w-0 flex-1 pt-0.5">
          <div class="flex min-w-0 items-start justify-between gap-2">
            <h4 class="min-w-0 truncate text-base font-semibold leading-snug">${esc(c.name)}</h4>
            <span id="qa-pill-${c.id}" class="shrink-0"></span>
          </div>
          ${code}
        </div>
      </div>
      <p id="qa-count-${c.id}" class="mt-4 text-xs text-subtle">Checking past questions…</p>
      <div id="qa-cta-${c.id}" class="mt-3"></div>
    </div>`;
}

function analysisSemesterSectionHtml(sem, courses) {
  const body = courses.length
    ? `<div class="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${courses.map((c, i) => analysisCourseCardHtml(c, i)).join('')}</div>`
    : `<div class="dashed mt-5 p-6 text-sm">No courses in this semester yet.</div>`;
  return `
    <section class="mb-10">
      <div class="flex items-center gap-2.5">
        <h3 class="text-lg font-semibold">${esc(sem.name)}</h3>
        <span class="chip chip-neutral">${courses.length} course${courses.length === 1 ? '' : 's'}</span>
      </div>
      ${body}
    </section>`;
}

// Fills in each card's PYQ count + readiness pill + CTA once its analysis
// status resolves (fired in parallel, independent of the others — a slow or
// failed lookup for one course never blocks the rest).
function analysisFillCourseCards(courses) {
  courses.forEach((c) => {
    api.get(`/courses/${c.id}/analysis`).then((res) => {
      const countEl = document.getElementById(`qa-count-${c.id}`);
      const pillEl = document.getElementById(`qa-pill-${c.id}`);
      const ctaEl = document.getElementById(`qa-cta-${c.id}`);
      if (countEl) {
        countEl.textContent = res.pyq_count
          ? `${res.pyq_count} past question${res.pyq_count === 1 ? '' : 's'} uploaded`
          : 'No past questions yet';
      }
      if (pillEl) pillEl.innerHTML = analysisPillForStatus(res.status, res.stale, res.pyq_count);
      if (ctaEl) {
        ctaEl.innerHTML = res.pyq_count
          ? `<button data-action="open-analysis-course" data-id="${c.id}" class="btn btn-secondary w-full justify-center">See analysis</button>`
          : `<a href="#/course/${c.id}" class="text-sm font-medium" style="color:var(--primary)">Upload past questions to analyze &rarr;</a>`;
      }
    }).catch(() => {
      const countEl = document.getElementById(`qa-count-${c.id}`);
      if (countEl) countEl.textContent = 'Could not check';
      const ctaEl = document.getElementById(`qa-cta-${c.id}`);
      if (ctaEl) ctaEl.innerHTML = `<a href="#/course/${c.id}" class="text-sm font-medium" style="color:var(--primary)">Open course &rarr;</a>`;
    });
  });
}

async function renderAnalysisSelect() {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-muted">Loading…</p>';
  const [semesters, courses] = await Promise.all([
    api.get('/semesters'),
    api.get('/courses'),
  ]);

  let html = `
    <div class="mb-8">
      <h2 class="text-2xl font-semibold tracking-tight">Question analysis</h2>
      <p class="mt-1 text-sm text-muted">Question types, topic importance, and exam patterns mined from each course's past questions.</p>
    </div>`;

  if (!semesters.length) {
    view.innerHTML = html + `
      <div class="dashed flex flex-col items-center gap-3 p-12 text-center">
        ${emptyCourseIcon}
        <p class="text-sm font-medium">No semesters yet</p>
        <p class="mx-auto max-w-sm text-sm text-muted">Create a semester and course, then upload past questions to analyze them here.</p>
        <a href="#/courses" class="btn btn-primary mt-2 inline-flex">Go to Courses</a>
      </div>`;
    return;
  }

  const byId = {};
  semesters.forEach((s) => { byId[s.id] = []; });
  courses.forEach((c) => { if (byId[c.semester_id]) byId[c.semester_id].push(c); });
  const anyCourses = semesters.some((s) => (byId[s.id] || []).length);

  if (!anyCourses) {
    view.innerHTML = html + `
      <div class="dashed flex flex-col items-center gap-3 p-12 text-center">
        ${emptyCourseIcon}
        <p class="text-sm font-medium">No courses yet</p>
        <p class="mx-auto max-w-sm text-sm text-muted">Add a course, then upload past questions to analyze them here.</p>
        <a href="#/courses" class="btn btn-primary mt-2 inline-flex">Go to Courses</a>
      </div>`;
    return;
  }

  html += semesters.map((s) => analysisSemesterSectionHtml(s, byId[s.id] || [])).join('');
  view.innerHTML = html;
  analysisFillCourseCards(courses.filter((c) => byId[c.semester_id]));
}

/* ---- course view: #/analysis/course/:cid ---- */

// A single small stat tile (value + label) — used for the header's
// "N questions across M papers" readout instead of a plain sentence.
function analysisStatChipHtml(value, label) {
  return `<div class="qa-stat-chip"><span class="qa-stat-value">${esc(String(value))}</span><span class="qa-stat-label">${esc(label)}</span></div>`;
}

// Refined hero: a course-accented card (accentKey(cid) — this course's own
// stable identity color, same id-keyed convention as accentTileStyle on the
// selection page) wraps the title, stat chips, stale badge, and the CTA.
function analysisHeaderHtml(cid, course, res) {
  const stale = res.status === 'ready' && res.stale;
  const canGenerate = res.pyq_count > 0 && res.status !== 'generating';
  const stats = (res.status === 'ready' && res.data)
    ? analysisStatChipHtml(res.data.total_questions, res.data.total_questions === 1 ? 'question' : 'questions')
      + analysisStatChipHtml(res.data.papers_detected, res.data.papers_detected === 1 ? 'paper' : 'papers')
    : analysisStatChipHtml(res.pyq_count, res.pyq_count === 1 ? 'question uploaded' : 'questions uploaded');
  const k = accentKey(cid);
  const heroStyle = `background:linear-gradient(135deg, color-mix(in srgb, var(--${k}) 10%, var(--surface)), var(--surface));border-left:4px solid var(--${k})`;
  return `
    <div class="mb-6">
      <button data-action="analysis-back" class="btn btn-ghost -ml-2 mb-4">&larr; Back</button>
      <div class="card qa-hero p-6" style="${heroStyle}">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-2xl font-semibold tracking-tight">${esc(course.name)}</h2>
              ${stale ? analysisPillHtml('Stale — re-analyze for the latest PYQs', 'warning') : ''}
            </div>
            <div class="qa-stats mt-3">${stats}</div>
          </div>
          ${canGenerate ? `<button data-action="analysis-generate" data-course-id="${cid}" class="btn btn-primary shrink-0">${res.status === 'ready' ? '↻ Re-analyze' : '✨ Analyze'}</button>` : ''}
        </div>
      </div>
    </div>`;
}

function analysisEmptyPyqHtml(cid) {
  return `
    <div class="card qa-state-card p-12 text-center">
      <span class="qa-state-icon">📄</span>
      <p class="mt-4 text-base font-medium">No past questions yet</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-muted">Upload past questions (PYQs) to this course to see its question-type mix, topic importance, and exam patterns.</p>
      <a href="#/course/${cid}" class="btn btn-primary mt-5 inline-flex">Upload past questions</a>
    </div>`;
}

function analysisPendingHtml(cid) {
  return `
    <div class="card qa-state-card p-12 text-center">
      <span class="qa-state-icon">✨</span>
      <p class="mt-4 text-base font-medium">Ready to analyze</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-muted">Run one AI pass over this course's past questions to see question-type distribution, topic importance, and exam patterns.</p>
      <button data-action="analysis-generate" data-course-id="${cid}" class="btn btn-primary mt-5">✨ Analyze past questions</button>
    </div>`;
}

function analysisFailedHtml(cid, msg) {
  return `
    <div class="card qa-state-card p-10 text-center">
      <span class="qa-state-icon" style="background:var(--danger-c);color:var(--danger)">!</span>
      <p class="mt-4 text-base font-medium" style="color:var(--danger)">Analysis failed</p>
      <p class="mx-auto mt-1 max-w-sm text-sm text-muted">${esc(msg || 'Something went wrong — please try again.')}</p>
      <button data-action="analysis-generate" data-course-id="${cid}" class="btn btn-secondary mt-5">Retry</button>
    </div>`;
}

function analysisGeneratingHtml() {
  return `
    <div class="card qa-generating flex flex-col items-center gap-3 p-14 text-center">
      <span class="qa-spinner qa-spinner-lg"></span>
      <p class="text-base font-medium">Analyzing your past questions…</p>
      <p class="max-w-sm text-sm text-muted">One AI pass over the uploaded PYQs — usually well under a minute.</p>
    </div>`;
}

// ---- the viz itself (renders from a ready AnalysisResult `data`) ----

function analysisDonutHtml(types) {
  const total = types.reduce((s, t) => s + (Number(t.count) || 0), 0) || 1;
  const r = 52, cx = 64, cy = 64, sw = 18;
  const circ = 2 * Math.PI * r;
  let acc = 0;
  const segs = types.map((t, i) => {
    const frac = (Number(t.count) || 0) / total;
    const len = Math.max(frac * circ - 1.5, 0); // small gap between segments
    const dash = `${len.toFixed(2)} ${(circ - len).toFixed(2)}`;
    const dashoffset = (-acc).toFixed(2);
    acc += frac * circ;
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--${accentKeyByIndex(i)})" stroke-width="${sw}" stroke-linecap="round" stroke-dasharray="${dash}" stroke-dashoffset="${dashoffset}"></circle>`;
  }).join('');
  return `
    <svg viewBox="0 0 128 128" class="qa-donut" role="img" aria-label="Question type distribution">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface-2)" stroke-width="${sw}"></circle>
      <g transform="rotate(-90 ${cx} ${cy})">${segs}</g>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" class="qa-donut-total">${total}</text>
      <text x="${cx}" y="${cy + 15}" text-anchor="middle" class="qa-donut-total-label">question${total === 1 ? '' : 's'}</text>
    </svg>`;
}

function analysisTypesLegendHtml(types) {
  const total = types.reduce((s, t) => s + (Number(t.count) || 0), 0) || 1;
  return types.map((t, i) => {
    const pct = Math.round(((Number(t.count) || 0) / total) * 100);
    const accent = accentKeyByIndex(i);
    return `
      <div class="qa-legend-item" style="background:var(--${accent}-c)">
        <div class="qa-legend-row">
          <span class="qa-legend-dot" style="background:var(--${accent})"></span>
          <span class="qa-legend-label" style="color:var(--on-${accent}-c)">${esc(t.type)}</span>
          <span class="qa-legend-count" style="color:var(--on-${accent}-c)">${t.count} &middot; ${pct}%</span>
        </div>
        ${t.note ? `<p class="qa-legend-note" style="color:var(--on-${accent}-c);opacity:.8">${esc(t.note)}</p>` : ''}
      </div>`;
  }).join('');
}

function analysisTypesSectionHtml(types) {
  if (!types || !types.length) return '';
  return `
    <section class="card qa-section p-6">
      <h3 class="text-base font-semibold">Question-type distribution</h3>
      <p class="mt-1 text-sm text-muted">How past questions break down by format.</p>
      <div class="qa-types-layout mt-5">
        <div class="qa-donut-wrap">${analysisDonutHtml(types)}</div>
        <div class="qa-legend">${analysisTypesLegendHtml(types)}</div>
      </div>
    </section>`;
}

function analysisTopicRowHtml(t, i) {
  const pct = Math.max(0, Math.min(100, Number(t.importance) || 0));
  const top = i < 3;
  const accent = accentKeyByIndex(i);
  const freq = Number(t.frequency) || 0;
  const rankStyle = top
    ? `background:var(--${accent}-c);color:var(--on-${accent}-c);box-shadow:0 0 0 3px color-mix(in srgb, var(--${accent}) 22%, transparent)`
    : '';
  return `
    <div class="qa-topic-row ${top ? 'qa-topic-row-top' : ''}">
      <span class="qa-topic-rank" style="${rankStyle}">${i + 1}</span>
      <div class="qa-topic-main">
        <div class="qa-topic-head">
          <span class="qa-topic-name">${esc(t.name)}</span>
          ${t.concept_name && t.concept_name !== t.name ? `<span class="qa-topic-concept">${esc(t.concept_name)}</span>` : ''}
          <span class="qa-topic-freq" title="Recurs ${freq} time${freq === 1 ? '' : 's'} across the papers">&times;${freq}</span>
        </div>
        <div class="qa-bar-track">
          <div class="qa-bar-fill" data-w="${pct}" style="background:linear-gradient(90deg, var(--${accent}-c), var(--${accent}))"></div>
        </div>
        ${t.rationale ? `<p class="qa-topic-rationale">${esc(t.rationale)}</p>` : ''}
      </div>
      <span class="qa-topic-score">${pct}</span>
    </div>`;
}

function analysisTopicsSectionHtml(topics) {
  if (!topics || !topics.length) return '';
  const sorted = topics.slice().sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0));
  return `
    <section class="card qa-section p-6">
      <h3 class="text-base font-semibold">Topic importance ranking</h3>
      <p class="mt-1 text-sm text-muted">Ranked by how heavily each topic is tested across the past papers.</p>
      <div class="qa-topics mt-4">${sorted.map((t, i) => analysisTopicRowHtml(t, i)).join('')}</div>
    </section>`;
}

const analysisSparkIcon =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14h7l-1 8 11-14h-7l1-8z"/></svg>';

function analysisPatternsSectionHtml(patterns) {
  if (!patterns || !patterns.length) return '';
  return `
    <section class="card qa-section p-6">
      <h3 class="text-base font-semibold">Patterns &amp; insights</h3>
      <div class="qa-patterns mt-4">
        ${patterns.map((p, i) => {
          const accent = accentKeyByIndex(i);
          return `<div class="qa-pattern-card"><span class="qa-pattern-icon" style="background:var(--${accent}-c);color:var(--${accent})">${analysisSparkIcon}</span><span class="qa-pattern-text">${esc(p)}</span></div>`;
        }).join('')}
      </div>
    </section>`;
}

function analysisSamplesSectionHtml(topics) {
  const withSamples = (topics || [])
    .filter((t) => t.sample_questions && t.sample_questions.length)
    .slice()
    .sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0));
  if (!withSamples.length) return '';
  return `
    <section class="card qa-section p-6">
      <h3 class="text-base font-semibold">Representative questions</h3>
      <p class="mt-1 text-sm text-muted">Real past questions for each top topic.</p>
      <div class="qa-samples mt-4">
        ${withSamples.map((t, i) => {
          const accent = accentKeyByIndex(i);
          return `
          <details class="qa-details"${i === 0 ? ' open' : ''}>
            <summary>
              <span class="qa-details-lead">
                <span class="dot dot-${accent}"></span>
                <span class="qa-details-name">${esc(t.name)}</span>
              </span>
              <span class="qa-details-count">${t.sample_questions.length} question${t.sample_questions.length === 1 ? '' : 's'}</span>
            </summary>
            <div class="qa-details-body">
              ${t.sample_questions.map((q, qi) => `<div class="qa-sample-q"><span class="qa-sample-q-idx">Q${qi + 1}</span><span>${esc(q)}</span></div>`).join('')}
            </div>
          </details>`;
        }).join('')}
      </div>
    </section>`;
}

function analysisSummarySectionHtml() {
  return `
    <section class="card qa-section qa-summary-card p-6">
      <div class="flex items-center gap-2.5">
        <span class="qa-icon-badge">${analysisSparkIcon}</span>
        <h3 class="text-base font-semibold">Summary &amp; exam strategy</h3>
      </div>
      <div id="qa-summary" class="ai-rich mt-3 text-sm leading-relaxed"></div>
    </section>`;
}

// ---- per-exam topic filter ("All papers" + one button per exam) ----
// The analysis is ONE blended AnalysisResult over every past paper the course
// has; this is a pure client-side re-slice of the already-cached `data` — no
// new AI call, no re-fetch of the analysis. "All papers" shows the full
// overview (donut + patterns + every topic); picking an exam hides the donut
// + patterns (they describe the whole course's papers and can't be split per
// exam) and narrows the topic ranking + representative questions down to that
// exam's ticked concepts, resolved via GET /exams/:id -> concept_ids ->
// GET /courses/:cid/concepts id->name (same mapping examConceptsModal uses),
// matched against topic.concept_name case-insensitively/trimmed — mirroring
// the server's own revision filter so the two stay conceptually consistent.

function analysisExamBarHtml(exams, selectedId) {
  const isAll = !selectedId || selectedId === 'all';
  const allCls = isAll ? 'chip chip-grape qa-exam-btn qa-exam-btn-active' : 'chip chip-neutral qa-exam-btn';
  const items = [`<button type="button" data-action="analysis-exam" data-exam-id="all" class="${allCls}">All papers</button>`]
    .concat((exams || []).map((e) => {
      const active = !isAll && String(e.id) === String(selectedId);
      const cls = active ? `chip ${accentChipCls(e.id)} qa-exam-btn qa-exam-btn-active` : 'chip chip-neutral qa-exam-btn';
      return `<button type="button" data-action="analysis-exam" data-exam-id="${e.id}" class="${cls}">${esc(e.name)}</button>`;
    }));
  return `<div id="qa-exam-bar" class="qa-exam-bar" role="tablist" aria-label="Filter by exam">${items.join('')}</div>`;
}

// Lazily fetches + caches (once per view load, on `state`) an id->name map
// for the course's concepts — used to resolve an exam's ticked concept_ids
// down to the topic.concept_name strings the analysis already carries.
function analysisEnsureConceptNames(state) {
  if (!state.conceptNamesPromise) {
    state.conceptNamesPromise = api.get(`/courses/${state.cid}/concepts`)
      .then((concepts) => {
        const byId = new Map();
        (concepts || []).forEach((c) => byId.set(c.id, c.name));
        return byId;
      })
      .catch(() => new Map());
  }
  return state.conceptNamesPromise;
}

// Resolves + caches one exam's ticked-concept-name set on
// state.examFilters[examId]. hasConcepts distinguishes "exam has zero ticked
// concepts" (concept_count===0) from "ticked concepts just don't match any
// analyzed topic" — the two edge-case fallback captions read differently.
async function analysisLoadExamFilter(state, examId) {
  let resolved;
  try {
    const [exam, nameById] = await Promise.all([
      api.get(`/exams/${examId}`),
      analysisEnsureConceptNames(state),
    ]);
    const ids = exam.concept_ids || [];
    const names = new Set();
    ids.forEach((id) => {
      const nm = nameById.get(id);
      if (nm) names.add(String(nm).trim().toLowerCase());
    });
    resolved = { hasConcepts: ids.length > 0, names };
  } catch (e) {
    resolved = { hasConcepts: false, names: new Set() };
  }
  state.examFilters[examId] = resolved;
  return resolved;
}

// Resolves ONE exam's (never "all") filtered topic set + caption + display
// name -- shared by analysisVizBodyHtml (renders the topic ranking/samples)
// and analysisSummaryText (derives the exam-strategy blurb) so the two can
// never disagree about which topics belong to the selected exam.
// { loading: true } while the exam's ticked-concept set hasn't resolved yet
// (analysisSelectExam kicks off analysisLoadExamFilter and re-renders once it
// settles). Mirrors the two documented empty-result fallbacks (no ticked
// concepts / ticked concepts match no analyzed topic) -> filtered = all topics.
function analysisResolveExamFilter(state, examId) {
  const data = state.res.data;
  const exam = (state.exams || []).find((e) => String(e.id) === String(examId));
  const examName = (exam && exam.name) || '';
  const filter = state.examFilters ? state.examFilters[examId] : null;
  if (!filter || filter instanceof Promise) {
    return { loading: true, examName, filtered: [], caption: '', hasConcepts: false };
  }
  const topics = data.topics || [];
  let filtered = topics;
  let caption;
  if (!filter.hasConcepts) {
    caption = 'This exam has no ticked concepts — showing all topics.';
  } else {
    filtered = topics.filter((t) => filter.names.has(String(t.concept_name || '').trim().toLowerCase()));
    if (filtered.length) {
      caption = `Showing ${filtered.length} of ${topics.length} topic${topics.length === 1 ? '' : 's'} for ${esc(examName)}.`;
    } else {
      caption = "None of this exam's concepts appear in the analysis yet — showing all topics.";
      filtered = topics;
    }
  }
  return { loading: false, examName, filtered, caption, hasConcepts: filter.hasConcepts };
}

// The viz body for the current selection: the full overview for "All
// papers", or a filtered topics/samples-only view (donut + patterns hidden)
// for one exam, with a caption + the two documented empty-result fallbacks
// (no ticked concepts / ticked concepts match no analyzed topic) so it's
// never left showing nothing.
function analysisVizBodyHtml(state) {
  const data = state.res.data;
  if (!state.selectedExamId || state.selectedExamId === 'all') {
    const sections = [
      analysisTypesSectionHtml(data.question_types),
      analysisTopicsSectionHtml(data.topics),
      analysisPatternsSectionHtml(data.patterns),
      analysisSamplesSectionHtml(data.topics),
      analysisSummarySectionHtml(),
    ].filter(Boolean);
    return sections.join('');
  }
  const examId = state.selectedExamId;
  const resolved = analysisResolveExamFilter(state, examId);
  if (resolved.loading) {
    return `<p class="qa-exam-caption">Loading ${esc(resolved.examName)}&hellip;</p>`;
  }
  const sections = [
    `<p class="qa-exam-caption">${resolved.caption}</p>`,
    analysisTopicsSectionHtml(resolved.filtered),
    analysisSamplesSectionHtml(resolved.filtered),
    analysisSummarySectionHtml(),
  ].filter(Boolean);
  return sections.join('');
}

// Derives the "Summary & exam strategy" text shown in #qa-summary: the
// course-wide AI summary for "All papers" (unchanged), or -- with NO extra
// AI call -- a markdown strategy built client-side from that exam's already-
// filtered topics (analysisResolveExamFilter, the exact same set
// analysisVizBodyHtml renders above it). Returned as markdown; the caller
// feeds it straight to renderRichText, which HTML-escapes first so raw topic
// names/rationales here are safe. While the exam's filter hasn't resolved
// yet (loading), returns '' -- the caption above already says "Loading…" and
// the re-render once it settles calls this again.
function analysisSummaryText(state) {
  const data = state.res.data;
  if (!state.selectedExamId || state.selectedExamId === 'all') {
    return data.summary || '';
  }
  const resolved = analysisResolveExamFilter(state, state.selectedExamId);
  if (resolved.loading) return '';
  const topics = resolved.filtered || [];
  if (!topics.length) return data.summary || '';
  const examName = resolved.examName || 'this exam';
  const byImportance = topics.slice().sort((a, b) => (Number(b.importance) || 0) - (Number(a.importance) || 0));
  const top = byImportance.slice(0, 3);
  const names = top.map((t) => `**${t.name}**`);
  let lead;
  if (names.length >= 3) {
    lead = `**Focus for ${examName}:** prioritise ${names[0]}, ${names[1]}, and ${names[2]} first — they carry the most weight on this paper.`;
  } else if (names.length === 2) {
    lead = `**Focus for ${examName}:** prioritise ${names[0]} and ${names[1]} first — they carry the most weight on this paper.`;
  } else {
    lead = `**Focus for ${examName}:** prioritise ${names[0]} first — it carries the most weight on this paper.`;
  }
  const bullets = top.map((t) => {
    const rationale = (t.rationale || '').trim();
    const imp = (typeof t.importance === 'number' || typeof t.importance === 'string') && t.importance !== ''
      ? ` (importance ${Math.round(Number(t.importance) || 0)}/100)`
      : '';
    return `- **${t.name}**${imp}${rationale ? ' — ' + rationale : ''}`;
  });
  const byFrequency = topics.slice().sort((a, b) => (Number(b.frequency) || 0) - (Number(a.frequency) || 0));
  const mostFrequent = byFrequency[0];
  const parts = [lead, bullets.join('\n')];
  if (mostFrequent) {
    parts.push(`**${mostFrequent.name}** recurs most often across the papers, so expect it again.`);
  }
  return parts.filter(Boolean).join('\n\n');
}

function analysisVizHtml(state) {
  const bar = (state.exams && state.exams.length) ? analysisExamBarHtml(state.exams, state.selectedExamId) : '';
  return `<div id="qa-viz" class="qa-sections">${bar}<div id="qa-viz-body">${analysisVizBodyHtml(state)}</div></div>`;
}

// Re-renders just the exam bar (active highlight) + the filtered body after a
// data-action="analysis-exam" click — never re-fetches the analysis itself.
function analysisRenderVizRegion() {
  const state = analysisViewState;
  if (!state) return;
  const barEl = document.getElementById('qa-exam-bar');
  if (barEl) barEl.outerHTML = analysisExamBarHtml(state.exams, state.selectedExamId);
  const bodyEl = document.getElementById('qa-viz-body');
  if (!bodyEl) return;
  bodyEl.innerHTML = analysisVizBodyHtml(state);
  renderMath(bodyEl);
  const summaryEl = bodyEl.querySelector('#qa-summary');
  if (summaryEl) renderRichText(summaryEl, analysisSummaryText(state));
  analysisAnimateBars();
}

// data-action="analysis-exam" handler (data-exam-id="all"|"<id>"). Renders
// optimistically (bar highlight + a brief loading caption if unresolved) and
// re-renders again once the exam's concept-name set resolves; both steps are
// guarded against navigating away, or picking a different exam meanwhile.
async function analysisSelectExam(examId) {
  const state = analysisViewState;
  if (!state) return; // stale click from a course/route we've since left
  state.selectedExamId = examId;
  analysisRenderVizRegion();
  if (examId === 'all') return;
  if (!(examId in state.examFilters)) {
    state.examFilters[examId] = analysisLoadExamFilter(state, examId);
  }
  await state.examFilters[examId];
  if (analysisViewState !== state || state.selectedExamId !== examId) return;
  analysisRenderVizRegion();
}

/* ---- "Prepare revision" control (Build 12, Phase 4 — ANALYSIS.md §7 last
   bullet). Phase 2 deliberately omitted this; it lists the course's exams
   (fetched alongside the analysis) and reuses the exact same open-revision
   flow (generate -> poll -> open) as the dashboard row. Each exam's
   ready/prepare pill + button label resolve asynchronously via
   analysisFillRevisionCards, same pattern as analysisFillCourseCards on the
   selection page — never blocks the rest of the viz from rendering. ---- */

function analysisRevisionPillForStatus(status, stale) {
  if (status === 'generating') {
    return `<span class="chip qa-pill-live" style="background:var(--sky-c);color:var(--on-sky-c)"><span class="qa-spinner"></span>Preparing…</span>`;
  }
  if (status === 'compiled') return stale ? analysisPillHtml('Stale', 'warning') : analysisPillHtml('Ready', 'success');
  if (status === 'failed') return analysisPillHtml('Failed', 'danger');
  return analysisPillHtml('Not yet prepared', 'neutral');
}

// Reuses the same lilac-dashed + doc-glyph identity as the dashboard's
// synthetic revision row (revisionRow, revisionDocIcon — see app.js ~262) so
// "revision" reads as one consistent concept across the app.
function analysisRevisionRowHtml(exam, courseName, i) {
  return `
    <div class="qa-revision-item" style="${riseDelayStyle(i)}">
      <span class="qa-revision-icon" style="color:var(--lilac)">${revisionDocIcon}</span>
      <div class="min-w-0 flex-1">
        <p class="qa-revision-item-name">${esc(exam.name)}</p>
        <p class="qa-revision-item-date">Exam date ${esc(fmtDate(exam.exam_date))}</p>
      </div>
      <span id="qa-rev-pill-${exam.id}" class="qa-rev-status shrink-0"></span>
      <button id="qa-rev-btn-${exam.id}" data-action="open-revision" data-exam-id="${exam.id}"
        data-course-name="${esc(courseName)}" data-exam-name="${esc(exam.name)}"
        class="btn btn-secondary qa-rev-btn shrink-0 whitespace-nowrap">Prepare revision PDF</button>
    </div>`;
}

function analysisRevisionSectionHtml(cid, courseName, exams) {
  const head = `
    <div class="flex items-center gap-2.5">
      <span class="qa-icon-badge" style="background:var(--lilac-c);color:var(--lilac)">${revisionDocIcon}</span>
      <h3 class="text-base font-semibold">Revision PDF</h3>
    </div>`;
  if (!exams || !exams.length) {
    return `
      <section class="card qa-section qa-revision-section p-6">
        ${head}
        <p class="mt-3 text-sm text-muted">Add an exam to this course to generate a revision. <a href="#/course/${cid}" class="font-medium" style="color:var(--primary)">Go to course &rarr;</a></p>
      </section>`;
  }
  return `
    <section class="card qa-section qa-revision-section p-6">
      ${head}
      <p class="mt-2 text-sm text-muted">Most-to-least-important concepts plus tailored practice, one PDF per exam &mdash; auto-scheduled the day before it.</p>
      <div class="qa-revisions mt-4">${exams.map((e, i) => analysisRevisionRowHtml(e, courseName, i)).join('')}</div>
    </section>`;
}

// Fires in parallel, independent of the rest of the page — mirrors
// analysisFillCourseCards on the selection page.
function analysisFillRevisionCards(exams, courseName) {
  (exams || []).forEach((ex) => {
    api.get(`/exams/${ex.id}/revision`).then((res) => {
      const pillEl = document.getElementById(`qa-rev-pill-${ex.id}`);
      const btnEl = document.getElementById(`qa-rev-btn-${ex.id}`);
      if (pillEl) pillEl.innerHTML = analysisRevisionPillForStatus(res.status, res.stale);
      if (btnEl) {
        btnEl.textContent = res.status === 'compiled'
          ? `Open revision PDF`
          : `Prepare revision PDF`;
      }
    }).catch(() => { /* leave the static label/no pill — non-fatal */ });
  });
}

// Grows each importance bar from 0 -> target on mount (skipped instantly
// under prefers-reduced-motion via analysis.css's transition:none override —
// the width still lands correctly, just without the animated grow-in).
function analysisAnimateBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('#qa-viz .qa-bar-fill[data-w]').forEach((el) => {
      requestAnimationFrame(() => { el.style.width = el.dataset.w + '%'; });
    });
  });
}

function analysisRenderBody(cid, course, res, exams) {
  const view = document.getElementById('view');
  const header = analysisHeaderHtml(cid, course, res);
  const revisionSection = analysisRevisionSectionHtml(cid, course.name, exams);
  // Rebuilt fresh on every call (initial load, poll settle, post-generate) —
  // re-armed below only for the ready state so a leftover exam-bar click from
  // a state this course no longer has (e.g. a re-analyze wiped the old data)
  // can't act on stale data.
  analysisViewState = null;

  if (!res.pyq_count) {
    // Nothing to analyze yet — skip the revision control too (it would just
    // 400 with the same "no PYQs" message; the empty state above already
    // gives the clear upload CTA).
    view.innerHTML = header + analysisEmptyPyqHtml(cid);
    return;
  }
  if (res.status === 'ready' && res.data) {
    analysisViewState = { cid, exams: exams || [], res, selectedExamId: 'all', examFilters: {}, conceptNamesPromise: null };
    view.innerHTML = header + analysisVizHtml(analysisViewState) + revisionSection;
    const vizEl = document.getElementById('qa-viz');
    renderMath(vizEl);
    const summaryEl = document.getElementById('qa-summary');
    if (summaryEl) renderRichText(summaryEl, analysisSummaryText(analysisViewState));
    analysisAnimateBars();
    analysisFillRevisionCards(exams, course.name);
    return;
  }
  if (res.status === 'generating') {
    view.innerHTML = header + analysisGeneratingHtml() + revisionSection;
    analysisFillRevisionCards(exams, course.name);
    analysisStartPoll(cid);
    return;
  }
  if (res.status === 'failed') {
    view.innerHTML = header + analysisFailedHtml(cid, res.error_message) + revisionSection;
    analysisFillRevisionCards(exams, course.name);
    return;
  }
  view.innerHTML = header + analysisPendingHtml(cid) + revisionSection; // 'pending' — never run
  analysisFillRevisionCards(exams, course.name);
}

async function renderAnalysisView(cid) {
  analysisStopPoll();
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-muted">Loading…</p>';
  let course, res, exams;
  try {
    [course, res, exams] = await Promise.all([
      api.get(`/courses/${cid}`),
      api.get(`/courses/${cid}/analysis`),
      api.get(`/courses/${cid}/exams`).catch(() => []),
    ]);
  } catch (e) {
    view.innerHTML = `<div class="card p-6 text-sm" style="color:var(--danger)">Could not load: ${esc(e.message)}</div>`;
    return;
  }
  analysisRenderBody(cid, course, res, exams);
}

// Polls GET /courses/:cid/analysis every ~2s while status stays 'generating'
// (mirrors mindmap.js's discovery poll); re-renders the whole body once it
// settles. Guarded by analysisPollCourseId so a stale timer from a course the
// user has since navigated away from can never clobber the current view.
function analysisStartPoll(cid) {
  analysisPollCourseId = cid;
  const tick = async () => {
    if (analysisPollCourseId !== cid) return;
    let res;
    try {
      res = await api.get(`/courses/${cid}/analysis`);
    } catch (e) {
      if (analysisPollCourseId === cid) analysisPollTimer = setTimeout(tick, 2500);
      return;
    }
    if (analysisPollCourseId !== cid) return;
    if (res.status === 'generating') {
      analysisPollTimer = setTimeout(tick, 2000);
      return;
    }
    analysisStopPoll();
    const [course, exams] = await Promise.all([
      api.get(`/courses/${cid}`).catch(() => ({ id: cid, name: '' })),
      api.get(`/courses/${cid}/exams`).catch(() => []),
    ]);
    if (location.hash !== `#/analysis/course/${cid}`) return; // navigated away mid-fetch
    analysisRenderBody(cid, course, res, exams);
  };
  analysisPollTimer = setTimeout(tick, 2000);
}

function confirmAnalysisGenerate(cid) {
  ui.confirmModal({
    title: 'Analyze past questions?',
    message: "This runs one AI call over this course's uploaded past questions to find question types, topic importance, recurring patterns, and an exam-strategy summary.",
    confirmLabel: 'Analyze',
    tone: 'primary', // safe, beneficial AI action — not a destructive delete
    onConfirm: async () => {
      try {
        await api.post(`/courses/${cid}/analysis/generate`, {});
      } catch (e) {
        // A run already in flight (409) just means: join its poll instead of
        // failing the modal — mirrors mindmap.js's mmRunDiscover.
        if (!/already running/i.test(e.message || '')) throw e;
      }
      // The endpoint sets status='generating' SYNCHRONOUSLY before returning
      // 202 (see routers/analysis.py), so re-fetching right away already
      // reflects it — no need to fake pyq_count/etc. in a placeholder.
      const [course, res, exams] = await Promise.all([
        api.get(`/courses/${cid}`).catch(() => ({ id: cid, name: '' })),
        api.get(`/courses/${cid}/analysis`).catch(() => ({ status: 'generating', data: null, stale: false, pyq_count: 0 })),
        api.get(`/courses/${cid}/exams`).catch(() => []),
      ]);
      analysisRenderBody(cid, course, res, exams);
    },
  });
}

/* ---------- revision PDF: open / generate / poll (Build 12, Phase 4) ----------
   Shared by the dashboard revision row/chip AND the analysis view's "Prepare
   revision PDF" control — both dispatch through the single `open-revision`
   action, which always re-fetches GET /exams/:eid/revision fresh (never
   trusts a stale dataset attribute from when the row was rendered) and then:
     compiled  -> open the PDF in the existing reader (openReader, pdfUrl)
     generating -> join the poll (a run already in flight elsewhere)
     else (pending/failed) -> confirm, POST .../generate, then poll
   No reader.js change: pdfUrl/annGetUrl/annPutUrl are all pre-existing
   openReader() options (already used by canvas-file cards). Explicit
   annGetUrl/annPutUrl overrides here — rather than letting openReader default
   them to /notes/{id}/annotations — are deliberate: revisions are a separate
   `revisions` table with its own autoincrement id sequence, so a bare
   `{id: revisionId}` could otherwise collide with an unrelated note that
   happens to share the same numeric id and load/overwrite ITS annotations.
   Pointing at a route that simply doesn't exist (revisions have no
   annotations endpoint in this phase) 404s harmlessly instead. ---------- */

let revisionPollTimer = null;
let revisionPollExamId = null; // guards a stale timer from a prior exam/route

function revisionStopPoll() {
  if (revisionPollTimer) { clearTimeout(revisionPollTimer); revisionPollTimer = null; }
  revisionPollExamId = null;
}

// E1: the revision row is UPDATEd in place on regenerate (routers/analysis.py
// generate_revision — same `revisions.id`, new PDF bytes), so a bare
// `/api/revisions/:id/pdf` URL is identical before and after a regen and can
// serve a browser-cached stale PDF on reopen. Prefers `res.source_sig` (a
// content fingerprint already computed server-side for staleness checks) if
// the /exams/:eid/revision response ever starts returning it; otherwise
// res.revision_id alone doesn't change across a regen so it can't be used as
// the token, and there's no updated_at in the response today — falls back to
// the open-time timestamp, which always busts the cache on every (re)open.
function revisionCacheToken(res) {
  if (res && res.source_sig) return String(res.source_sig);
  if (res && res.revision_id != null && res.updated_at) return `${res.revision_id}-${res.updated_at}`;
  return String(Date.now());
}

function revisionReaderNote(revisionId, courseName, cacheToken) {
  const v = cacheToken ? `?v=${encodeURIComponent(cacheToken)}` : '';
  return {
    id: revisionId,
    title: `Revision — ${courseName}`,
    pdfUrl: `/api/revisions/${revisionId}/pdf${v}`,
    // Annotation URLs unchanged — no cache-bust needed/wanted there.
    annGetUrl: `/revisions/${revisionId}/annotations`,
    annPutUrl: `/revisions/${revisionId}/annotations`,
  };
}

// Polls GET /exams/:eid/revision every ~2.5s while status stays 'generating';
// opens the reader once compiled, toasts a visible message on failure.
// Guarded by revisionPollExamId exactly like analysisStartPoll's cid guard.
function revisionStartPoll(examId, courseName) {
  const key = String(examId);
  revisionPollExamId = key;
  const tick = async () => {
    if (revisionPollExamId !== key) return;
    let res;
    try {
      res = await api.get(`/exams/${examId}/revision`);
    } catch (e) {
      if (revisionPollExamId === key) revisionPollTimer = setTimeout(tick, 2500);
      return;
    }
    if (revisionPollExamId !== key) return;
    if (res.status === 'generating') {
      revisionPollTimer = setTimeout(tick, 2500);
      return;
    }
    revisionStopPoll();
    if (res.status === 'compiled' && res.revision_id) {
      ui.toast('Revision ready');
      // Revision canvas part 1: open the revision's own canvas (matching how
      // a compiled lesson opens to its canvas), not the reader directly.
      location.hash = `#/exams/${examId}/revision/canvas`;
    } else if (res.status === 'failed') {
      ui.toast(res.error_message || 'Revision generation failed', 'error');
    }
  };
  revisionPollTimer = setTimeout(tick, 2500);
}

async function openRevisionFlow(examId, courseName, examName) {
  let res;
  try {
    res = await api.get(`/exams/${examId}/revision`);
  } catch (e) {
    ui.toast(e.message || 'Could not check revision status', 'error');
    return;
  }
  if (res.status === 'compiled' && res.revision_id) {
    // Revision canvas part 1: open the revision's own canvas (matching how a
    // compiled lesson opens to its canvas), not the reader directly.
    location.hash = `#/exams/${examId}/revision/canvas`;
    return;
  }
  if (res.status === 'generating') {
    ui.toast('Preparing your revision…');
    revisionStartPoll(examId, courseName);
    return;
  }
  ui.confirmModal({
    title: 'Prepare revision PDF?',
    message: `Prepare the revision PDF for ${examName}? This uses one AI call and compiles a PDF.`,
    confirmLabel: 'Prepare',
    tone: 'primary', // safe, beneficial AI action — not a destructive delete
    onConfirm: async () => {
      try {
        await api.post(`/exams/${examId}/revision/generate`, {});
      } catch (e) {
        // A run already in flight (409) just means: join its poll instead of
        // failing the modal — mirrors confirmAnalysisGenerate's own 409 case.
        if (!/already generating/i.test(e.message || '')) throw e;
      }
      ui.toast('Preparing your revision…');
      revisionStartPoll(examId, courseName);
    },
  });
}

/* ---------- global search command palette (Build 13c) ----------
   Ctrl/Cmd+K (or the sidebar's Search rail icon) opens a body-mounted overlay
   that searches the WHOLE curriculum — courses + concepts — by name (courses
   also match on code, concepts also match on summary). There's no dedicated
   backend search endpoint; GET /mindmap/graph already returns the account's
   entire semesters/courses/concepts/links in one authed call, so this reuses
   it (fetched once per page session and cached in searchPaletteGraph — a
   stale cache just means a brand-new course/concept made in this session
   might not show up until the next reload, which is an acceptable tradeoff
   for not adding a backend endpoint). Not built on ui.mountOverlay: it needs
   its own (wider) panel width and its own ArrowUp/ArrowDown/Enter handling
   layered on top of Escape/backdrop-click, so it mounts a bespoke overlay at
   the same z-[75] tier instead (see ui.js's mountOverlay comment for the
   layering stack). */
let searchPaletteEl = null;      // the mounted backdrop element, or null when closed
let searchPaletteGraph = null;   // cached /mindmap/graph response for this page session
// Fix 2 (Build 14 Phase B): cached GET /api/canvas/text-index response for this
// page session — {items:[{concept_id, course_id, course_name, concept_name,
// drawing_id, kind, text}]}, one row per text-box/sticky-note drawing across
// the account's canvases (pen strokes aren't indexed — nothing to match on).
// Same staleness tradeoff as searchPaletteGraph: cached once per page load.
let searchPaletteCanvasIndex = null;
let searchPaletteResults = [];   // flat list of the CURRENTLY rendered rows, in display order
let searchPaletteSelected = 0;   // index into searchPaletteResults

// Registered once from enterApp() (guarded by appEntered same as initTaskTray/
// initPomodoro) — a plain global hotkey, so it works from any view.
function initSearchHotkey() {
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (!mod || (e.key !== 'k' && e.key !== 'K')) return;
    e.preventDefault();
    if (searchPaletteEl) closeSearchPalette();
    else openSearchPalette();
  });
}

async function openSearchPalette() {
  if (searchPaletteEl) return;
  const magnifier =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';
  const overlay = document.createElement('div');
  overlay.className = 'search-palette-backdrop';
  overlay.innerHTML = `
    <div class="search-palette" role="dialog" aria-modal="true" aria-label="Search">
      <div class="search-palette-input-row">
        ${magnifier}
        <input type="text" class="field-input search-palette-input" placeholder="Search courses and lessons…" autocomplete="off" spellcheck="false">
      </div>
      <div class="search-palette-results" data-results></div>
    </div>`;
  document.body.appendChild(overlay);
  searchPaletteEl = overlay;
  searchPaletteSelected = 0;

  const input = overlay.querySelector('.search-palette-input');

  overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) closeSearchPalette(); });
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeSearchPalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchSelection(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchSelection(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); activateSearchSelection(); }
    // A3: focus trap — the search input is the palette's only natively
    // focusable element (result rows are plain divs, navigated via arrow
    // keys instead), so Tab/Shift+Tab just keeps focus there rather than
    // letting it escape to the page behind the overlay.
    else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }
  });
  input.addEventListener('input', () => renderSearchResults(input.value));

  input.focus();
  renderSearchResults(''); // empty-query hint while the graph loads (or from cache)

  if (!searchPaletteGraph) {
    try { searchPaletteGraph = await api.get('/mindmap/graph'); }
    catch (e) { searchPaletteGraph = { courses: [], concepts: [] }; }
    // The user may have closed the palette while this fetch was in flight.
    if (searchPaletteEl === overlay) renderSearchResults(input.value);
  }
  if (!searchPaletteCanvasIndex) {
    try { searchPaletteCanvasIndex = (await api.get('/canvas/text-index')).items || []; }
    catch (e) { searchPaletteCanvasIndex = []; }
    if (searchPaletteEl === overlay) renderSearchResults(input.value);
  }
}

function closeSearchPalette() {
  if (!searchPaletteEl) return;
  searchPaletteEl.remove();
  searchPaletteEl = null;
  searchPaletteResults = [];
  searchPaletteSelected = 0;
}

function moveSearchSelection(delta) {
  if (!searchPaletteResults.length) return;
  searchPaletteSelected = (searchPaletteSelected + delta + searchPaletteResults.length) % searchPaletteResults.length;
  highlightSearchSelection();
}

function highlightSearchSelection() {
  if (!searchPaletteEl) return;
  searchPaletteEl.querySelectorAll('[data-search-row]').forEach((row) => {
    const selected = Number(row.dataset.searchRow) === searchPaletteSelected;
    row.classList.toggle('search-palette-row-selected', selected);
    if (selected) row.scrollIntoView({ block: 'nearest' });
  });
}

function activateSearchSelection() {
  const r = searchPaletteResults[searchPaletteSelected];
  if (r) selectSearchResult(r);
}

function selectSearchResult(r) {
  closeSearchPalette();
  if (r.type === 'course') { location.hash = `#/course/${r.id}`; return; }
  if (r.type === 'canvas-text') {
    // Already on that concept's canvas? Pan in place — no navigation/reload.
    if (canvasState && canvasState.conceptId === r.conceptId) {
      canvasPanToDrawing(canvasState, r.drawingId);
    } else {
      canvasPendingFocus = { conceptId: r.conceptId, drawingId: r.drawingId };
      location.hash = `#/course/${r.courseId}/canvas/${r.conceptId}`;
    }
    return;
  }
  location.hash = `#/course/${r.courseId}/canvas/${r.id}`;
}

const SEARCH_RESULT_CAP = 8;

// Builds a short, readable snippet around the (lowercased) match `q` inside
// `text`, similar to a search-engine result preview: trims to nearby context
// rather than dumping the whole note. Falls back to a plain truncation if the
// match position can't be found (shouldn't happen — caller only calls this on
// texts that already matched `q`).
function searchSnippet(text, q, maxLen) {
  const t = text || '';
  if (!q) return t.length > maxLen ? t.slice(0, maxLen).trim() + '…' : t;
  const idx = t.toLowerCase().indexOf(q);
  if (idx === -1) return t.length > maxLen ? t.slice(0, maxLen).trim() + '…' : t;
  const pad = Math.max(0, Math.floor((maxLen - q.length) / 2));
  const start = Math.max(0, idx - pad);
  const end = Math.min(t.length, idx + q.length + pad);
  let snippet = t.slice(start, end).trim();
  if (start > 0) snippet = '…' + snippet;
  if (end < t.length) snippet = snippet + '…';
  return snippet;
}

function renderSearchResults(query) {
  const resultsEl = searchPaletteEl && searchPaletteEl.querySelector('[data-results]');
  if (!resultsEl) return;
  // D3: searchPaletteGraph is null until the very first /mindmap/graph fetch
  // resolves (openSearchPalette calls this once immediately, before that
  // fetch even starts) — without this, that first call falls through to the
  // "nothing to search" empty state, which reads as if the account has no
  // courses/concepts at all. Show a neutral loading row instead until the
  // graph is actually in hand (loaded, or failed — openSearchPalette sets it
  // to a fallback {courses:[],concepts:[]} either way, so this only gates the
  // true not-yet-fetched window).
  if (searchPaletteGraph === null) {
    resultsEl.innerHTML = `<div class="search-palette-empty">Loading…</div>`;
    searchPaletteResults = [];
    searchPaletteSelected = 0;
    return;
  }
  const g = searchPaletteGraph || { courses: [], concepts: [] };
  const courses = g.courses || [];
  const concepts = g.concepts || [];
  const canvasItems = searchPaletteCanvasIndex || [];
  const q = (query || '').trim().toLowerCase();
  const courseName = (courseId) => {
    const c = courses.find((x) => x.id === courseId);
    return c ? c.name : '';
  };

  const courseMatches = (q
    ? courses.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.code || '').toLowerCase().includes(q))
    : courses
  ).slice(0, SEARCH_RESULT_CAP);
  const conceptMatches = (q
    ? concepts.filter((c) => (c.name || '').toLowerCase().includes(q) || (c.summary || '').toLowerCase().includes(q))
    : concepts
  ).slice(0, SEARCH_RESULT_CAP);
  // Canvas notes (text-box/sticky) only match on an actual, non-empty query —
  // an empty query listing every note on every board would be noisy and,
  // unlike courses/concepts, there's no natural "show all" browsing use case
  // for them here.
  const canvasMatches = (q
    ? canvasItems.filter((it) => (it.text || '').toLowerCase().includes(q))
    : []
  ).slice(0, SEARCH_RESULT_CAP);

  searchPaletteResults = [
    ...courseMatches.map((c) => ({ type: 'course', id: c.id, title: c.name, subtitle: c.code || '' })),
    ...conceptMatches.map((c) => ({ type: 'concept', id: c.id, courseId: c.course_id, title: c.name, subtitle: courseName(c.course_id) })),
    ...canvasMatches.map((it) => ({
      type: 'canvas-text',
      conceptId: it.concept_id,
      courseId: it.course_id,
      drawingId: it.drawing_id,
      kind: it.kind,
      title: searchSnippet(it.text, q, 90),
      subtitle: `${it.course_name || ''} · ${it.concept_name || ''}`,
    })),
  ];
  searchPaletteSelected = 0;

  if (!searchPaletteResults.length) {
    resultsEl.innerHTML = `<div class="search-palette-empty">${
      q ? `No matches for &ldquo;${esc(query.trim())}&rdquo;.` : 'No courses or lessons yet — nothing to search.'
    }</div>`;
    return;
  }

  let html = '';
  if (courseMatches.length) {
    html += '<div class="search-palette-group-label">Courses</div>';
    courseMatches.forEach((c, i) => { html += searchPaletteRowHtml(i, 'course', c.name, c.code || ''); });
  }
  if (conceptMatches.length) {
    html += '<div class="search-palette-group-label">Concepts</div>';
    conceptMatches.forEach((c, i) => {
      html += searchPaletteRowHtml(courseMatches.length + i, 'concept', c.name, courseName(c.course_id));
    });
  }
  if (canvasMatches.length) {
    html += '<div class="search-palette-group-label">Canvas notes</div>';
    const base = courseMatches.length + conceptMatches.length;
    canvasMatches.forEach((it, i) => {
      // it is the raw /canvas/text-index item ({text, course_name,
      // concept_name, …}), not the mapped searchPaletteResults entry — build
      // the same snippet/subtitle here as in the results mapping above.
      html += searchPaletteRowHtml(base + i, 'canvas-text', searchSnippet(it.text, q, 90), `${it.course_name || ''} · ${it.concept_name || ''}`);
    });
  }
  if (!q) html += `<div class="search-palette-hint">Type to filter, or use &uarr;/&darr; and Enter.</div>`;
  resultsEl.innerHTML = html;
  highlightSearchSelection();
  resultsEl.querySelectorAll('[data-search-row]').forEach((row) => {
    const idx = Number(row.dataset.searchRow);
    row.addEventListener('click', () => selectSearchResult(searchPaletteResults[idx]));
    row.addEventListener('mousemove', () => {
      if (idx !== searchPaletteSelected) { searchPaletteSelected = idx; highlightSearchSelection(); }
    });
  });
}

// `type` is 'course' | 'concept' | 'canvas-text'; `title`/`subtitle` are
// already-resolved display strings (a snippet, for canvas-text rows).
function searchPaletteRowHtml(idx, type, title, subtitle) {
  const dotCls = type === 'course' ? 'dot-grape' : type === 'canvas-text' ? 'dot-lemon' : 'dot-sky';
  const badge = type === 'course' ? 'Course' : type === 'canvas-text' ? 'Note' : 'Lesson';
  return `
    <div class="search-palette-row" data-search-row="${idx}">
      <span class="dot ${dotCls}"></span>
      <div class="search-palette-row-text">
        <div class="search-palette-row-title">${esc(title || 'Untitled')}</div>
        ${subtitle ? `<div class="search-palette-row-subtitle">${esc(subtitle)}</div>` : ''}
      </div>
      <span class="chip chip-neutral search-palette-row-badge">${badge}</span>
    </div>`;
}

/* ---------- routing + wiring ---------- */

// Highlights the sidebar nav item matching the current route. Called on every
// route() so back/forward, hash links, and programmatic navigation all stay
// in sync (courses list, a single course, and any of its sub-views all count
// as "Courses"; settings likewise; everything else falls back to "Home").
function updateSidebarActive() {
  const hash = location.hash || '#/';
  let section = 'home';
  if (/^#\/settings\/?$/.test(hash)) section = 'settings';
  else if (/^#\/mindmap\/?$/.test(hash)) section = 'mindmap';
  else if (/^#\/analysis/.test(hash)) section = 'analysis';
  else if (/^#\/(courses\/?$|course\/)/.test(hash)) section = 'courses';
  document.querySelectorAll('#sidebar [data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === section);
  });
}

async function route() {
  quizStopPoll();
  stopJobPolling();
  stopMaterialsPolling();
  closeReader();
  stopCanvas();
  analysisStopPoll();
  revisionStopPoll();
  if (window.mindmap) window.mindmap.stop();
  updateSidebarActive();
  const hash = location.hash || '#/';
  const canvas = hash.match(/^#\/course\/(\d+)\/canvas(?:\/(\d+))?/);
  const revisionCanvas = hash.match(/^#\/exams\/(\d+)\/revision\/canvas/);
  const study = hash.match(/^#\/course\/(\d+)\/study(?:\/(\d+))?/);
  const scheduleStudy = hash.match(/^#\/study(?:\/(\d+))?$/);
  const coursesList = hash.match(/^#\/courses\/?$/);
  const settingsView = hash.match(/^#\/settings\/?$/);
  const mindmapView = hash.match(/^#\/mindmap\/?$/);
  const analysisSelect = hash.match(/^#\/analysis\/?$/);
  const analysisView = hash.match(/^#\/analysis\/course\/(\d+)/);
  const quizView = hash.match(/^#\/quiz\/(\d+)$/);
  const course = hash.match(/^#\/course\/(\d+)/);
  // Fix 2: on the full-bleed views (mind map, canvas, revision canvas) the
  // sidebar hover-expand must FLOAT over the content instead of pushing it —
  // those views recompute their own layout (mmResize / the canvas board) off
  // the content column's width, so a push-driven expand visibly resized them
  // while the cursor was just over the rail. `body.fullbleed-view` (index.html
  // inline <style>) takes #sidebar out of flow (position:fixed) and offsets
  // the content column by the rail's collapsed width instead. Toggled here —
  // not inside the try block — so it's set/cleared on every route change
  // regardless of which branch below renders, mirroring updateSidebarActive().
  document.body.classList.toggle('fullbleed-view', !!(canvas || revisionCanvas || mindmapView));
  try {
    if (quizView) await renderQuiz(quizView[1]);
    else if (canvas) await renderCanvasView(canvas[1], canvas[2], /[?&]from=schedule/.test(hash) ? 'schedule' : 'course');
    else if (revisionCanvas) await renderRevisionCanvasView(revisionCanvas[1]);
    else if (study) await renderStudyView(study[1], study[2]);
    else if (scheduleStudy) await renderScheduleStudy(scheduleStudy[1]);
    else if (coursesList) await renderCourses();
    else if (settingsView) await renderSettings();
    else if (mindmapView) await window.mindmap.render();
    else if (analysisView) await renderAnalysisView(analysisView[1]);
    else if (analysisSelect) await renderAnalysisSelect();
    else if (course) await renderCourse(course[1]);
    else { dashCatchupChecked = false; await renderDashboard(); }
  } catch (e) {
    document.getElementById('view').innerHTML =
      `<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">Could not load: ${esc(e.message)}</div>`;
  }
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-action]');
  if (!t) return;
  const a = t.dataset.action;
  // Build 12 FF: a lesson row/chip drag-drop just completed — swallow the
  // native click that follows it (dashDragPointerDown set this) so the drop
  // doesn't ALSO re-open the lesson.
  if (a === 'open-schedule-lesson' && dashJustDragged) { dashJustDragged = false; return; }
  if (a === 'home') { e.preventDefault(); location.hash = '#/'; }
  else if (a === 'go-courses') { e.preventDefault(); location.hash = '#/courses'; }
  else if (a === 'go-settings') { e.preventDefault(); location.hash = '#/settings'; }
  else if (a === 'go-mindmap') { e.preventDefault(); location.hash = '#/mindmap'; }
  else if (a === 'go-analysis') { e.preventDefault(); location.hash = '#/analysis'; }
  else if (a === 'go-search') { e.preventDefault(); openSearchPalette(); }
  else if (a === 'open-analysis-course') location.hash = `#/analysis/course/${t.dataset.id}`;
  else if (a === 'analysis-back') location.hash = '#/analysis';
  else if (a === 'analysis-generate') confirmAnalysisGenerate(t.dataset.courseId);
  else if (a === 'analysis-exam') analysisSelectExam(t.dataset.examId);
  else if (a === 'open-revision') openRevisionFlow(t.dataset.examId, t.dataset.courseName, t.dataset.examName);
  else if (a === 'show-health') showHealthModal();
  else if (a === 'new-semester') newSemester();
  else if (a === 'regen-schedule') regenSchedule();
  else if (a === 'dash-view-list') setDashboardView('list');
  else if (a === 'dash-view-calendar') setDashboardView('calendar');
  else if (a === 'cal-prev') { calendarMonth = addMonthsISO(calendarMonth, -1); renderDashContent(); }
  else if (a === 'cal-next') { calendarMonth = addMonthsISO(calendarMonth, 1); renderDashContent(); }
  else if (a === 'dismiss-catchup') {
    catchupBanner = '';
    const el = document.getElementById('dash-catchup');
    if (el) el.innerHTML = '';
  }
  else if (a === 'open-lesson') {
    const cid = t.dataset.courseId;
    const conceptId = t.dataset.conceptId;
    const nid = t.dataset.noteId;
    // Build 9 Phase 2a: the canvas replaces the old study window — prefer the
    // concept id (always present on this row's schedule item); fall back to
    // the old note-based route only if it's somehow missing.
    if (conceptId) location.hash = `#/course/${cid}/canvas/${conceptId}`;
    else location.hash = nid ? `#/course/${cid}/study/${nid}` : `#/course/${cid}`;
  }
  else if (a === 'del-semester') delSemester(t.dataset.id, t.dataset.name);
  else if (a === 'archive-semester') archiveSemester(t.dataset.id, t.dataset.name);
  else if (a === 'unarchive-semester') unarchiveSemester(t.dataset.id, t.dataset.name);
  else if (a === 'new-course') newCourse(t.dataset.semesterId);
  else if (a === 'open-course') location.hash = `#/course/${t.dataset.id}`;
  else if (a === 'del-course') delCourse(t.dataset.id, t.dataset.name);
  else if (a === 'del-material') delMaterial(t.dataset.id);
  else if (a === 'generate') startGeneration(t.dataset.id);
  else if (a === 'gen-notes') startNoteGeneration(t.dataset.id);
  else if (a === 'choose-notes') noteConceptPicker(t.dataset.id);
  else if (a === 'reanalyze-all') confirmReanalyzeAll(t.dataset.id);
  else if (a === 'regen-all') confirmRegenAll(t.dataset.id);
  else if (a === 'rename-concept') renameConcept(t.dataset.id, t.dataset.name);
  else if (a === 'del-concept') delConcept(t.dataset.id, t.dataset.name);
  else if (a === 'note-customize') noteCustomizeModal(t.dataset.id);
  else if (a === 'cancel-job') cancelJob(t.dataset.id);
  else if (a === 'open-note') {
    // Build 9 Phase 2a: canvas replaces the study window. Notes always carry
    // concept_id; fall back to the old study route only if it's missing.
    location.hash = t.dataset.conceptId
      ? `#/course/${t.dataset.courseId}/canvas/${t.dataset.conceptId}`
      : `#/course/${t.dataset.courseId}/study/${t.dataset.noteId}`;
  }
  else if (a === 'open-study') openCourseCanvas(t.dataset.id);
  else if (a === 'note-error') showNoteError(t.dataset.noteId, t.dataset.title);
  else if (a === 'retry-note') { e.stopPropagation(); retryNote(t.dataset.noteId); }
  else if (a === 'study-select') studySelectNote(t.dataset.noteId);
  else if (a === 'study-open-reading') studyOpenReading();
  else if (a === 'study-close-reading') studyCollapseReading();
  else if (a === 'study-error') showNoteError(t.dataset.noteId, t.dataset.title);
  else if (a === 'open-schedule-lesson') {
    // Build 9 Phase 2a: schedule rows already carry course_id + concept_id
    // (SCHEDULE_SELECT in schedule.py already selects both — no backend
    // change needed here); fall back to the old cross-course study route
    // only if either is somehow missing.
    location.hash = (t.dataset.courseId && t.dataset.conceptId)
      ? `#/course/${t.dataset.courseId}/canvas/${t.dataset.conceptId}?from=schedule`
      : '#/study/' + t.dataset.itemId;
  }
  else if (a === 'reset-schedule-move') { e.stopPropagation(); resetScheduleMove(t.dataset.examId, t.dataset.conceptId); }
  else if (a === 'canvas-select-lesson') {
    // In-place switch (course OR schedule mode; canvasSwitchLesson handles a
    // cross-course target in schedule mode). Fall back to a hash nav only if the
    // canvas isn't mounted.
    if (canvasState) canvasSwitchLesson(canvasState, t.dataset.conceptId, t.dataset.courseId);
    else location.hash = `#/course/${t.dataset.courseId}/canvas/${t.dataset.conceptId}`;
  }
  else if (a === 'canvas-toggle-sidebar') canvasToggleSidebar(t.dataset.side);
  else if (a === 'canvas-zoom-in') { if (canvasState) canvasZoomCenter(canvasState, 1.2); }
  else if (a === 'canvas-zoom-out') { if (canvasState) canvasZoomCenter(canvasState, 1 / 1.2); }
  else if (a === 'canvas-zoom-reset') { if (canvasState) canvasFitToView(canvasState); }
  else if (a === 'canvas-lightbox-close') canvasCloseLightbox();
  else if (a === 'canvas-lightbox-ask') { if (canvasLightboxState) canvasLightboxAskWhole(canvasLightboxState); }
  else if (a === 'canvas-lightbox-snip') { if (canvasLightboxState) canvasLightboxToggleSnip(canvasLightboxState); }
  else if (a === 'canvas-lightbox-answer-close') { if (canvasLightboxState) canvasLightboxCloseAnswerPanel(canvasLightboxState); }
  else if (a === 'canvas-lightbox-pin') { if (canvasLightboxState) canvasLightboxPin(canvasLightboxState); }
  else if (a === 'canvas-lightbox-send') { if (canvasLightboxState) canvasLightboxSendFollowUp(canvasLightboxState); }
  else if (a === 'canvas-pan-to-item') { if (canvasState) canvasPanToItem(canvasState, t.dataset.itemId); }
  else if (a === 'canvas-item-delete') { e.stopPropagation(); if (canvasState) canvasRequestDeleteItem(canvasState, t.dataset.itemId); }
  else if (a === 'canvas-rename-file') { e.stopPropagation(); if (canvasState) canvasRenameFileModal(canvasState, t.dataset.fileId); }
  else if (a === 'canvas-rename-note') { e.stopPropagation(); if (canvasState) canvasRenameNoteModal(canvasState); }
  else if (a === 'canvas-delete-file') { e.stopPropagation(); if (canvasState) canvasRequestDeleteFile(canvasState, t.dataset.fileId); }
  else if (a === 'canvas-open-convo') {
    // Round 8 item 2: pan the board to the card first (so the user sees where
    // it lives), THEN open the chat overlay on top of it.
    if (canvasState) {
      canvasPanToItem(canvasState, t.dataset.itemId);
      openAiConversation(canvasState.itemsById.get(t.dataset.itemId));
    }
  }
  else if (a === 'canvas-delete-convo') { e.stopPropagation(); if (canvasState) canvasRequestDeleteItem(canvasState, t.dataset.itemId); }
  else if (a === 'canvas-tool') { if (canvasState) canvasSetTool(canvasState, t.dataset.tool); }
  else if (a === 'canvas-color') { if (canvasState) canvasSetColor(canvasState, t.dataset.color); }
  else if (a === 'canvas-stroke') { if (canvasState) canvasSetStroke(canvasState, t.dataset.width); }
  else if (a === 'canvas-undo') { if (canvasState) canvasUndo(canvasState); }
  else if (a === 'canvas-redo') { if (canvasState) canvasRedo(canvasState); }
  else if (a === 'sched-select') schedSelect(t.dataset.itemId);
  else if (a === 'sched-open-reading') schedOpenReading();
  else if (a === 'sched-close-reading') schedCollapseReading();
  else if (a === 'reader-close') closeReader();
  else if (a === 'reader-download') readerDownloadAnnotated(readerState);
  else if (a === 'reader-tool') readerSetTool(t.dataset.tool);
  else if (a === 'reader-color') readerSetColor(t.dataset.color);
  else if (a === 'reader-stroke') readerToggleStroke();
  else if (a === 'reader-undo') readerUndo(readerState);
  else if (a === 'reader-zoom-in') readerZoom(readerState, 1.2);
  else if (a === 'reader-zoom-out') readerZoom(readerState, 1 / 1.2);
  else if (a === 'reader-zoom-reset') readerZoom(readerState, 'reset');
  else if (a === 'reader-snip') { if (readerState && readerState.ask) readerToggleSnip(readerState); }
  else if (a === 'reader-ask-open') { if (readerState && readerState.ask) readerAskOpenPanel(readerState); }
  else if (a === 'reader-ask-close') { if (readerState && readerState.ask) readerAskClosePanel(readerState); }
  else if (a === 'reader-ask-chip') { if (readerState && readerState.ask) readerAskChipClick(readerState, t.dataset.mode); }
  else if (a === 'reader-ask-menu-dismiss') {
    // Round 8 item 5: an explicit "deselect" — clears the live selection (so
    // the menu, which now tracks the selection through scroll instead of
    // hiding on it, actually goes away) rather than just hiding the menu
    // while leaving text highlighted.
    if (readerState && readerState.ask) {
      try { window.getSelection().removeAllRanges(); } catch (e) { /* ignore */ }
      readerAskMenuHide(readerState);
    }
  }
  else if (a === 'reader-ask-send') { if (readerState && readerState.ask) readerAskSendFollowUp(readerState); }
  else if (a === 'reader-ask-pin') { if (readerState && readerState.ask) readerAskPinToCanvas(readerState); }
  else if (a === 'canvas-ai-close') closeAiConversation();
  else if (a === 'new-exam') newExam(t.dataset.id);
  else if (a === 'edit-exam') editExam(t.dataset.examId);
  else if (a === 'del-exam') delExam(t.dataset.examId, t.dataset.name);
  else if (a === 'exam-concepts') examConceptsModal(t.dataset.examId, t.dataset.name);
  else if (a === 'start-quiz') location.hash = `#/quiz/${t.dataset.conceptId}`;
  else if (a === 'start-quiz-stop') { e.stopPropagation(); location.hash = `#/quiz/${t.dataset.conceptId}`; }
  else if (a === 'toggle-done') toggleDone(t.dataset.conceptId, t.dataset.done === '1');
  else if (a === 'toggle-done-stop') { e.stopPropagation(); toggleDone(t.dataset.conceptId, t.dataset.done === '1'); }
  else if (a === 'quiz-exit') quizExit();
  else if (a === 'quiz-cancel') quizCancel();
  else if (a === 'quiz-answer-mcq') quizAnswerMcq(Number(t.dataset.idx));
  else if (a === 'quiz-submit-short') quizSubmitShort();
  else if (a === 'quiz-self-correct') quizSelfCorrect();
  else if (a === 'quiz-self-wrong') quizSelfWrong();
  else if (a === 'quiz-next') quizNext();
  else if (a === 'quiz-retry') quizRetry();
  else if (a === 'quiz-new') quizNewQuestions();
  else if (a === 'quiz-retry-generate') { if (quizState) quizStartGeneration(quizState.conceptId, false); }
  else if (a === 'tray-toggle') taskTrayToggle();
  else if (a === 'tray-cancel') taskTrayCancel(t.dataset.courseId);
  else if (a === 'open-pomodoro') pomodoroModal();
  else if (a === 'pomo-pause') pomodoroPause();
  else if (a === 'pomo-resume') pomodoroResume();
  else if (a === 'pomo-stop') pomodoroStop();
  else if (a === 'theme-system') setTheme('system');
  else if (a === 'theme-light') setTheme('light');
  else if (a === 'theme-dark') setTheme('dark');
  else if (a === 'logout') logout();
});

/* ---------- Auth gate (Build 6, single account; redesigned Build 7 Phase 2;
   MAJOR visual/interaction redesign Build 9 round 8 item 7 — split hero +
   form layout, animated mode transitions, floating labels, strength meter,
   success micro-animation; auth LOGIC/ids/validation all unchanged) ----------
   Before the app boots, GET /auth/status: if not authenticated we mount a
   full-screen signup/login/forgot-password screen (over a cursor-reactive
   animated background, auth-only) and stop; once authenticated we enter the
   app (health pill + task tray + profile + route). api.js dispatches
   'axiom:unauthorized' on any 401, so an expired session bounces back to the
   login screen. Backend (Build 8 — multi-account): signup creates a NEW,
   separate account when one is already registered (claims the seeded
   account only on the very first-ever registration) — no data is wiped or
   overwritten, so signup here just submits directly, no confirm needed. */
let authMode = 'login';       // 'login' | 'signup' | 'forgot'
let authRegistered = false;   // from GET /auth/status — picks the default screen (login vs signup)
let authForgotStep = 'email'; // 'email' | 'reset' — two-step forgot-password flow
let authForgotEmail = '';
let authForgotQuestion = '';
let authBgController = null;   // { el, teardown() } for the animated background, or null
let authHeroController = null; // { teardown() } for the hero panel (tagline rotator), or null
let appEntered = false;

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was your favorite childhood book?",
];

function isValidEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

const AUTH_EYE_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
const AUTH_EYE_OFF_ICON =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"/><path d="M10.6 5.1A10.9 10.9 0 0 1 12 5c7 0 10.5 7 10.5 7a13.9 13.9 0 0 1-3.15 4.15M6.6 6.6C3.4 8.5 1.5 12 1.5 12s3.5 7 10.5 7a10.4 10.4 0 0 0 5.4-1.5"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>';
// pathLength="100" normalizes stroke-dasharray/stroke-dashoffset to 0-100
// regardless of the path's actual geometric length, so the CSS "draw-in"
// animation (theme.css .auth-success-ring/.auth-success-tick) is exact.
const AUTH_CHECK_ICON =
  '<svg viewBox="0 0 52 52" width="52" height="52" fill="none"><circle class="auth-success-ring" cx="26" cy="26" r="24" pathLength="100" stroke="currentColor" stroke-width="2.5"/><path class="auth-success-tick" d="M15 27l7 7 15-15" pathLength="100" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';

// Rotating hero value-props (purely presentational — cycled by mountAuthHero()).
const AUTH_TAGLINES = [
  'Concepts extracted straight from your own study materials.',
  'Every note ends with practice styled on real past exam questions.',
  'A daily study plan that adapts as your exams get closer.',
  'Ask AI about anything, right inside your notes.',
];

// Purely visual password-strength heuristic (0-4). Never gates submission —
// the real rule stays "≥6 characters", enforced only in the submit handler.
function authPasswordStrength(pw) {
  if (!pw) return { score: 0, label: '' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) score++;
  score = Math.min(score, 4);
  const labels = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
  return { score, label: labels[score] };
}

// A floating-label field for the auth screen. Keeps a real <label for="…">
// (accessible) as a sibling AFTER the control so CSS (:focus/:not(:placeholder-shown))
// can float it — see theme.css §5. `type`: 'text' | 'email' | 'password'
// (with a show/hide toggle, id="au-toggle") | 'password-plain' (no toggle,
// e.g. confirm-password) | 'select'.
function authField(opts) {
  const { id, label, type = 'text', autocomplete = 'off', hint = '', options = null, value = '' } = opts;
  let controlHtml;
  let wrapClass = 'auth-field auth-anim-row';
  if (type === 'select') {
    wrapClass += ' auth-field--select';
    const optsHtml = (options || []).map((q) => `<option value="${esc(q)}">${esc(q)}</option>`).join('');
    controlHtml = `<select id="${id}" class="auth-input" autocomplete="${autocomplete}">${optsHtml}</select>`;
  } else if (type === 'password') {
    wrapClass += ' auth-field--password';
    controlHtml =
      `<input id="${id}" type="password" class="auth-input" placeholder=" " autocomplete="${autocomplete}" value="${esc(value)}">` +
      `<button type="button" id="au-toggle" class="auth-toggle-btn" aria-label="Show password">${AUTH_EYE_ICON}</button>`;
  } else if (type === 'password-plain') {
    controlHtml = `<input id="${id}" type="password" class="auth-input" placeholder=" " autocomplete="${autocomplete}" value="${esc(value)}">`;
  } else {
    controlHtml = `<input id="${id}" type="${type}" class="auth-input" placeholder=" " autocomplete="${autocomplete}" value="${esc(value)}">`;
  }
  // The input + (optional) toggle + label live in an inner .auth-field-control
  // (the positioning context). The hint sits BELOW that control — so the
  // absolutely-positioned floating label centers against the INPUT's height
  // only, not the input+hint (which used to drop it to the bottom on hinted
  // fields). The label stays a sibling of the input, so the `~` float
  // selectors still match.
  return `<div class="${wrapClass}">
    <div class="auth-field-control">
      ${controlHtml}
      <label for="${id}" class="auth-label">${esc(label)}</label>
    </div>
    ${hint ? `<span class="auth-hint">${esc(hint)}</span>` : ''}
  </div>`;
}

// Strength meter shown only under a NEW-password field (signup password,
// forgot-reset new password) — never under an existing-password login field.
function authStrengthMeterHtml() {
  return `<div class="auth-strength auth-anim-row" id="au-strength" data-score="0" aria-hidden="true">
    <div class="auth-strength-track"><div class="auth-strength-fill"></div></div>
    <span class="auth-strength-label"></span>
  </div>`;
}

function authScreenHtml(mode, initialError) {
  const errClass = 'auth-error rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600' + (initialError ? ' show' : '');
  const errHtml = `<p id="au-error" class="${errClass}" role="alert" aria-live="assertive">${initialError ? esc(initialError) : ''}</p>`;

  let heading, sub, submitLabel, bodyHtml, footerHtml;

  if (mode === 'signup') {
    heading = 'Create your account';
    sub = 'Set up Axiom to start studying smarter.';
    submitLabel = 'Create account';
    bodyHtml = `
      ${authField({ id: 'au-name', label: 'Name', autocomplete: 'name' })}
      ${authField({ id: 'au-email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${authField({ id: 'au-password', label: 'Password', type: 'password', autocomplete: 'new-password', hint: 'At least 6 characters' })}
      ${authStrengthMeterHtml()}
      ${authField({ id: 'au-confirm', label: 'Confirm password', type: 'password-plain', autocomplete: 'new-password' })}
      ${authField({ id: 'au-secq', label: 'Security question', type: 'select', options: SECURITY_QUESTIONS })}
      ${authField({ id: 'au-secans', label: 'Security answer', autocomplete: 'off', hint: 'Used only to reset your password if you ever forget it.' })}
    `;
    footerHtml = `<p class="mt-5 text-center text-sm text-muted">Already have an account? <button type="button" data-auth-link="login" class="link font-medium">Log in</button></p>`;
  } else if (mode === 'login') {
    heading = 'Welcome back';
    sub = 'Log in to pick up where you left off.';
    submitLabel = 'Log in';
    bodyHtml = `
      ${authField({ id: 'au-email', label: 'Email', type: 'email', autocomplete: 'email' })}
      ${authField({ id: 'au-password', label: 'Password', type: 'password', autocomplete: 'current-password' })}
    `;
    footerHtml = `
      <div class="mt-5 flex items-center justify-between text-sm">
        <button type="button" data-auth-link="forgot" class="link">Forgot password?</button>
        <button type="button" data-auth-link="signup" class="link">Create new account</button>
      </div>`;
  } else {
    // forgot: two steps in the same card — find the question, then answer + reset.
    heading = 'Reset your password';
    if (authForgotStep === 'reset') {
      sub = 'Answer your security question to set a new password.';
      submitLabel = 'Reset password';
      bodyHtml = `
        <div class="auth-anim-row auth-secq-display">
          <span class="auth-secq-display-label">Security question</span>
          <div class="auth-secq-display-value">${esc(authForgotQuestion)}</div>
        </div>
        ${authField({ id: 'au-secans', label: 'Answer', autocomplete: 'off' })}
        ${authField({ id: 'au-password', label: 'New password', type: 'password', autocomplete: 'new-password', hint: 'At least 6 characters' })}
        ${authStrengthMeterHtml()}
        ${authField({ id: 'au-confirm', label: 'Confirm new password', type: 'password-plain', autocomplete: 'new-password' })}
      `;
    } else {
      sub = "Enter your account email and we'll show your security question.";
      submitLabel = 'Continue';
      bodyHtml = `${authField({ id: 'au-email', label: 'Email', type: 'email', autocomplete: 'email', value: authForgotEmail })}`;
    }
    // G8: on the reset step, add a way back to the email step (e.g. to fix a
    // mistyped address) without leaving the forgot-password flow entirely.
    // Reuses the SAME data-auth-link="forgot" wiring the entry point uses —
    // that handler already resets authForgotStep to 'email' whenever the
    // clicked link's mode is 'forgot' (see wireAuthCard), so no new handler
    // is needed; the email field re-shows prefilled with the previous value
    // (authForgotEmail), ready to edit rather than blank.
    footerHtml = authForgotStep === 'reset'
      ? `<p class="mt-5 flex items-center justify-between text-sm text-muted">
          <button type="button" data-auth-link="forgot" class="link">Use a different email</button>
          <button type="button" data-auth-link="login" class="link font-medium">Back to log in</button>
        </p>`
      : `<p class="mt-5 text-center text-sm text-muted"><button type="button" data-auth-link="login" class="link font-medium">Back to log in</button></p>`;
  }

  return `
    <div class="auth-card">
      <div class="auth-card-head">
        <h1 class="auth-card-heading">${esc(heading)}</h1>
        <p class="auth-card-sub">${esc(sub)}</p>
      </div>
      <form id="auth-form" novalidate>
        ${bodyHtml}
        ${errHtml}
        <button type="submit" id="au-submit" class="${btnPrimary} btn-pill w-full py-2.5 text-[0.95rem] auth-submit-btn auth-anim-row">
          <span class="auth-spinner" aria-hidden="true"></span>
          <span class="auth-submit-label">${esc(submitLabel)}</span>
        </button>
      </form>
      <div class="auth-card-foot">${footerHtml}</div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Animated self-drawing "Axiom" logo (premium brand mark — Build "logo1").
// Real Inter ExtraBold (800) glyph outlines, extracted OFFLINE via
// opentype.js against the actual Google Fonts Inter woff2 (decompressed with
// wawoff2) — no font parsing at runtime, no new dependency shipped. The path
// data below is the exact traced outline of each letterform.
//
// Technique (see theme.css's "Animated self-drawing Axiom logo" section for
// the CSS half): each glyph is a <path> pair — one stroked (fill:none,
// currentColor stroke) with pathLength="1" so stroke-dasharray/-dashoffset
// can animate on a clean 0..1 scale regardless of real geometry, ONE
// underneath filled (currentColor, opacity animates in once the stroke
// finishes). The stroke "ink"s the letter on (dashoffset 1->0), then
// crossfades to the solid fill, holds, fades out, and loops.
//
// IMPORTANT — why 5 separate glyphs, not one combined "Axiom" path: Chromium's
// stroke-dasharray/-dashoffset rendering was empirically found to break (it
// paints the WHOLE path solid regardless of dashoffset) once a single <path>
// accumulates too many subpaths + a long combined length — reproduced with a
// combined 8-subpath/~3400-unit "Axiom" path, both with pathLength
// normalization AND raw geometric units, at multiple dash ratios. Each
// individual letter (1-2 subpaths, a few hundred units) dashes correctly in
// isolation, so the wordmark is 5 independent glyph paths instead.
// The 5 letters stagger their draw-IN across a SHARED 2s cycle using 5 sets
// of @keyframes (axiomWordStroke0..4 / axiomWordFill0..4) rather than
// `animation-delay` — a delay shifts a letter's entire loop including its
// fade-out/reset, so with 5 independent delays each letter blinked invisible
// at a DIFFERENT moment near the loop boundary (looked glitchy). Baking the
// stagger into the keyframe percentages instead keeps the fade-out/reset
// (90%-100%) IDENTICAL across all 5, so the whole word vanishes and redraws
// as one clean unit every cycle.
//
// Reduced motion needs no special-casing here: theme.css §6's existing
// global `@media (prefers-reduced-motion: reduce) { *{animation:none!important} }`
// kills every one of these animations outright, leaving the plain rest
// state declared in CSS (fill opacity 1, stroke opacity 0) — a finished,
// static, filled word/mark.
const AXIOM_WORDMARK_VB = '-4.41 -163.785 640.754 174.836';
const AXIOM_MARK_VB = '-5.41 -155.508 164.727 165.508';
const AXIOM_MARK_D = 'M42.871 0L4.590 0L53.125-145.508L99.316-145.508L149.316 0L110.645 0L90.430-63.574Q85.547-79.492 81.006-97.412Q76.465-115.332 71.875-134.570L79.590-134.570Q75.195-115.234 71.094-97.314Q66.992-79.395 62.402-63.574L42.871 0M116.406-30.957L37.598-30.957L37.598-57.324L116.406-57.324';
// Center of AXIOM_MARK_VB — the pivot the sheen-sweep rotation turns around
// (see axiomLogoSvg('mark')), so the highlight tilts in place with zero
// displacement rather than swinging off from an arbitrary origin.
const AXIOM_MARK_CX = -5.41 + 164.727 / 2;
const AXIOM_MARK_CY = -155.508 + 165.508 / 2;
// Per-glyph outline paths for "Axiom" (A, x, i, o, m), in the SAME coordinate
// space as AXIOM_WORDMARK_VB (so they line up with no extra offsetting).
const AXIOM_WORDMARK_GLYPHS = [
  'M42.871 0L4.590 0L53.125-145.508L99.316-145.508L149.316 0L110.645 0L90.430-63.574Q85.547-79.492 81.006-97.412Q76.465-115.332 71.875-134.570L79.590-134.570Q75.195-115.234 71.094-97.314Q66.992-79.395 62.402-63.574L42.871 0M116.406-30.957L37.598-30.957L37.598-57.324L116.406-57.324',
  'M192.578 0L157.129 0L199.023-69.336L199.023-42.773L159.180-109.180L195.313-109.180L203.711-93.555Q208.203-85.059 211.914-76.318Q215.625-67.578 219.434-59.375L207.422-59.375Q211.426-67.480 215.234-76.270Q219.043-85.059 223.730-93.555L232.520-109.180L268.066-109.180L227.246-42.676L227.246-69.043L269.531 0L233.594 0L223.047-18.945Q218.359-27.441 214.453-36.328Q210.547-45.215 206.641-53.320L218.652-53.320Q214.941-45.215 211.182-36.328Q207.422-27.441 202.930-18.945',
  'M318.066 0L283.984 0L283.984-109.180L318.066-109.180L318.066 0M300.977-121.973Q293.750-121.973 288.574-126.807Q283.398-131.641 283.398-138.379Q283.398-145.215 288.574-150Q293.750-154.785 300.977-154.785Q308.301-154.785 313.477-150.049Q318.652-145.312 318.652-138.379Q318.652-131.543 313.477-126.758Q308.301-121.973 300.977-121.973',
  'M391.309 2.051Q374.219 2.051 361.914-5.029Q349.609-12.109 343.018-24.756Q336.426-37.402 336.426-54.199Q336.426-71.094 343.018-83.740Q349.609-96.387 361.914-103.467Q374.219-110.547 391.309-110.547Q408.398-110.547 420.703-103.467Q433.008-96.387 439.551-83.740Q446.094-71.094 446.094-54.199Q446.094-37.402 439.551-24.756Q433.008-12.109 420.703-5.029Q408.398 2.051 391.309 2.051M391.309-24.023Q397.852-24.023 402.344-27.832Q406.836-31.641 409.131-38.477Q411.426-45.312 411.426-54.395Q411.426-63.477 409.131-70.264Q406.836-77.051 402.344-80.762Q397.852-84.473 391.309-84.473Q384.766-84.473 380.273-80.762Q375.781-77.051 373.486-70.264Q371.191-63.477 371.191-54.395Q371.191-45.312 373.486-38.477Q375.781-31.641 380.273-27.832Q384.766-24.023 391.309-24.023',
  'M498.535 0L464.453 0L464.453-109.180L495.801-109.180L497.754-80.859L495.410-80.859Q497.949-91.504 502.979-98.047Q508.008-104.590 514.697-107.617Q521.387-110.645 528.809-110.645Q540.527-110.645 547.705-103.125Q554.883-95.605 558.789-78.516L554.980-78.516Q557.617-89.941 563.281-97.070Q568.945-104.199 576.563-107.422Q584.180-110.645 592.383-110.645Q602.637-110.645 610.498-106.201Q618.359-101.758 622.852-93.506Q627.344-85.254 627.344-73.633L627.344 0L593.359 0L593.359-65.918Q593.359-74.219 589.014-78.516Q584.668-82.812 577.930-82.812Q573.145-82.812 569.580-80.664Q566.016-78.516 564.160-74.658Q562.305-70.801 562.305-65.527L562.305 0L529.590 0L529.590-66.406Q529.590-73.926 525.391-78.369Q521.191-82.812 514.355-82.812Q509.668-82.812 506.104-80.664Q502.539-78.516 500.537-74.561Q498.535-70.605 498.535-64.844',
];

// Returns the animated logo's markup. variant: 'wordmark' (full "Axiom",
// 5 staggered glyphs) | 'mark' (just the "A", for the sidebar tile). Colors
// via `currentColor` — callers set `color` in CSS on the mount point.
function axiomLogoSvg(variant) {
  if (variant === 'mark') {
    // Bare solid "A" (currentColor fill, always opacity 1 — never disappears)
    // plus a soft light "sheen" band clipped to the glyph's own shape and
    // swept across it periodically via a CSS-only translateX animation (see
    // .axiom-logo-sheen / @keyframes axiomSheen in theme.css). The sheen
    // rect is authored centered on the SAME point the wrapping <g> rotates
    // around (AXIOM_MARK_CX/CY, the glyph's viewBox center) so the SVG
    // `transform="rotate(...)"` tilts it in place with no displacement —
    // the CSS translateX then slides it along its own (pre-rotation) local
    // x-axis, which reads as a gentle diagonal sweep once the tilt is
    // applied. Single instance (sidebar-only), so fixed element ids are fine.
    return `<svg class="axiom-logo axiom-logo-mark" viewBox="${AXIOM_MARK_VB}" xmlns="http://www.w3.org/2000/svg" aria-label="Axiom" role="img">
      <defs>
        <clipPath id="axiom-mark-clip"><path d="${AXIOM_MARK_D}"></path></clipPath>
        <linearGradient id="axiom-mark-sheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#ffffff" stop-opacity="0"></stop>
          <stop offset="50%" stop-color="#ffffff" stop-opacity="0.75"></stop>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"></stop>
        </linearGradient>
      </defs>
      <path class="axiom-logo-fill" d="${AXIOM_MARK_D}"></path>
      <g clip-path="url(#axiom-mark-clip)">
        <g transform="rotate(-18 ${AXIOM_MARK_CX} ${AXIOM_MARK_CY})">
          <rect class="axiom-logo-sheen" x="${AXIOM_MARK_CX - 25}" y="${AXIOM_MARK_CY - 300}" width="50" height="600" fill="url(#axiom-mark-sheen)"></rect>
        </g>
      </g>
    </svg>`;
  }
  const glyphs = AXIOM_WORDMARK_GLYPHS.map((d, i) => `<g class="axiom-logo-glyph-${i}">
        <path class="axiom-logo-fill" d="${d}" pathLength="1"></path>
        <path class="axiom-logo-stroke" d="${d}" pathLength="1" fill="none"></path>
      </g>`).join('');
  return `<svg class="axiom-logo axiom-logo-wordmark" viewBox="${AXIOM_WORDMARK_VB}" xmlns="http://www.w3.org/2000/svg" aria-label="Axiom" role="img">${glyphs}</svg>`;
}

// The brand/hero panel (left column on wide viewports, compact top band when
// stacked). Mounted once per auth-gate lifetime (independent of mode swaps)
// so its tagline rotator keeps a stable timer — see mountAuthHero/teardownAuthHero.
function authHeroHtml() {
  return `
    <div class="auth-hero-inner">
      <div class="auth-hero-brand">
        ${axiomLogoSvg('wordmark')}
      </div>
      <h2 class="auth-hero-title">Study smarter,<br>not longer.</h2>
      <div class="auth-tagline" id="auth-tagline"></div>
      <div class="auth-hero-motifs" aria-hidden="true">
        <div class="auth-motif auth-motif-1"><span class="dot dot-mint"></span>Concept notes, auto-generated</div>
        <div class="auth-motif auth-motif-2"><span class="dot dot-sky"></span>Practice quizzes, instantly</div>
        <div class="auth-motif auth-motif-3"><span class="dot dot-peach"></span>A study plan that adapts</div>
      </div>
    </div>`;
}

// Mounts the hero panel + starts the tagline rotator (skipped under
// prefers-reduced-motion — a single static tagline instead). Idempotent like
// mountAuthBg. Torn down in enterApp() via teardownAuthHero().
function mountAuthHero(container) {
  if (!container) return;
  teardownAuthHero();
  container.innerHTML = authHeroHtml();
  const taglineEl = container.querySelector('#auth-tagline');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let idx = 0;
  const paint = () => {
    if (!taglineEl) return;
    taglineEl.innerHTML = `<span class="auth-tagline-text">${esc(AUTH_TAGLINES[idx])}</span>`;
  };
  paint();
  let timer = null;
  if (!reduced && taglineEl) {
    timer = setInterval(() => {
      const cur = taglineEl.querySelector('.auth-tagline-text');
      if (cur) cur.classList.add('auth-tagline-exit');
      setTimeout(() => {
        idx = (idx + 1) % AUTH_TAGLINES.length;
        paint();
      }, 180);
    }, 2600);
  }
  authHeroController = {
    teardown() {
      if (timer) clearInterval(timer);
      container.innerHTML = '';
    },
  };
}

function teardownAuthHero() {
  if (authHeroController) {
    authHeroController.teardown();
    authHeroController = null;
  }
}

// Cursor-reactive animated background (auth screen only — DESIGN.md §8).
// Five blurred accent blobs: a CSS keyframe gives each a slow idle float
// (`.auth-blob`'s own `transform`), while a separate RAF loop here eases a
// *parent* wrapper's `transform` toward the pointer (a different element, so
// the two transforms never fight). `prefers-reduced-motion` gets one static
// gradient instead — no RAF, no listener. mountAuthBg() is idempotent (it
// tears down any previous controller first) so re-mounting never leaks a loop;
// renderAuthScreen() never touches this node (it lives in its own #auth-bg-slot,
// outside the #auth-card-slot that mode switches replace).
function mountAuthBg(container) {
  if (!container) return;
  teardownAuthBg();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bg = document.createElement('div');
  bg.className = 'auth-bg';
  bg.setAttribute('aria-hidden', 'true');
  container.appendChild(bg);

  if (reduced) {
    bg.classList.add('auth-bg-static');
    authBgController = { el: bg, teardown() { bg.remove(); } };
    return;
  }

  const accents = ['grape', 'mint', 'peach', 'sky', 'lilac'];
  // Travel range roughly doubled from the original (was ±30px-ish) so the
  // cursor-follow is CLEARLY visible, not a subtle nudge.
  const factors = [
    { x: 46, y: 34 }, { x: -58, y: 30 }, { x: 38, y: -42 },
    { x: -34, y: -50 }, { x: 50, y: 24 },
  ];
  const blobEls = accents.map((accent, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'auth-blob-pointer';
    wrap.innerHTML = `<div class="auth-blob auth-blob-${i + 1} auth-blob-${accent}"></div>`;
    bg.appendChild(wrap);
    return wrap;
  });

  const pointer = { x: 0, y: 0 }; // target, normalized -1..1 from viewport center
  const eased = { x: 0, y: 0 };   // current eased position
  let rafId = null;

  const onMove = (e) => {
    pointer.x = (e.clientX / (window.innerWidth || 1) - 0.5) * 2;
    pointer.y = (e.clientY / (window.innerHeight || 1) - 0.5) * 2;
  };
  window.addEventListener('mousemove', onMove, { passive: true });

  const tick = () => {
    // Snappier lerp (was 0.06) so the background is clearly, promptly
    // reactive to the pointer rather than a slow, barely-visible drift.
    eased.x += (pointer.x - eased.x) * 0.16;
    eased.y += (pointer.y - eased.y) * 0.16;
    blobEls.forEach((el, i) => {
      const f = factors[i];
      el.style.transform = `translate3d(${(eased.x * f.x).toFixed(2)}px, ${(eased.y * f.y).toFixed(2)}px, 0)`;
    });
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  authBgController = {
    el: bg,
    teardown() {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', onMove);
      bg.remove();
    },
  };
}

function teardownAuthBg() {
  if (authBgController) {
    authBgController.teardown();
    authBgController = null;
  }
}

function showAuthGate(status) {
  authRegistered = !!(status && status.registered);
  authMode = authRegistered ? 'login' : 'signup';
  authForgotStep = 'email';
  authForgotEmail = '';
  authForgotQuestion = '';
  let screen = document.getElementById('auth-screen');
  if (!screen) {
    screen = document.createElement('div');
    screen.id = 'auth-screen';
    screen.className = 'fixed inset-0 z-[70] overflow-y-auto bg-paper';
    // The scroll lives on #auth-screen; an inner min-h-full flex wrapper centers
    // the shell when it fits and top-aligns it (fully reachable, logo never
    // clipped) when a short viewport can't hold it — instead of centering+
    // overflow on the same element, which clips the top. .auth-shell is a
    // responsive 2-col grid (hero | form panel) that stacks on narrow/short
    // viewports (theme.css §5).
    screen.innerHTML = '<div id="auth-bg-slot"></div>'
      + '<div class="relative z-10 min-h-full flex items-center justify-center px-6 py-10">'
      + '<div class="auth-shell">'
      + '<div class="auth-hero" id="auth-hero-slot"></div>'
      + '<div class="auth-panel"><div id="auth-card-slot"></div></div>'
      + '</div></div>';
    document.body.appendChild(screen);
    mountAuthBg(document.getElementById('auth-bg-slot'));
    mountAuthHero(document.getElementById('auth-hero-slot'));
  }
  renderAuthScreen();
}

// A brief success moment (checkmark draw-in) shown after a successful
// signup/login/reset, right before enterApp() tears the gate down. Purely
// presentational — resolves immediately under reduced motion.
function authCelebrate(slot, message) {
  return new Promise((resolve) => {
    const card = slot.querySelector('.auth-card');
    if (!card) return resolve();
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    card.innerHTML = `<div class="auth-success">
      <div class="auth-success-icon">${AUTH_CHECK_ICON}</div>
      <p class="auth-success-msg">${esc(message)}</p>
    </div>`;
    if (reduced) return resolve();
    setTimeout(resolve, 620);
  });
}

// Wires up the (mode-specific) markup just injected into #auth-card-slot:
// password show/hide, the strength meter, mode-switch links, and the submit
// handler. Validation rules, endpoints, and enterApp() are UNCHANGED from the
// pre-redesign version — only presentation (icons, busy/spinner state, the
// success beat) was added around them.
function wireAuthCard(slot) {
  const form = slot.querySelector('#auth-form');
  const errEl = slot.querySelector('#au-error');
  const pw = slot.querySelector('#au-password');
  const toggle = slot.querySelector('#au-toggle');
  const submit = slot.querySelector('#au-submit');
  const submitLabelEl = submit ? submit.querySelector('.auth-submit-label') : null;
  const strengthEl = slot.querySelector('#au-strength');
  if (!form || !errEl || !submit) return;

  const showErr = (msg) => {
    errEl.textContent = msg;
    errEl.classList.add('show');
  };

  if (toggle && pw) toggle.addEventListener('click', () => {
    const showing = pw.type === 'text';
    pw.type = showing ? 'password' : 'text';
    toggle.innerHTML = showing ? AUTH_EYE_ICON : AUTH_EYE_OFF_ICON;
    toggle.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
  });

  if (pw && strengthEl) {
    const fillLabel = strengthEl.querySelector('.auth-strength-label');
    const updateStrength = () => {
      const { score, label } = authPasswordStrength(pw.value);
      strengthEl.dataset.score = String(score);
      if (fillLabel) fillLabel.textContent = pw.value ? label : '';
    };
    pw.addEventListener('input', updateStrength);
    updateStrength();
  }

  // G5: signup-only inline per-field validation (email format, password
  // length, confirm-match) on blur/input — purely visual feedback next to
  // each field; the submit handler below keeps its own checks + banner
  // unchanged, so a valid submission is never blocked by this.
  if (authMode === 'signup') {
    const emailEl = slot.querySelector('#au-email');
    const confirmEl = slot.querySelector('#au-confirm');
    const setFieldHint = (input, message) => {
      if (!input) return;
      const wrap = input.closest('.auth-field');
      if (!wrap) return;
      let hintEl = wrap.querySelector('.auth-field-error');
      if (!hintEl) {
        hintEl = document.createElement('p');
        hintEl.className = 'auth-field-error';
        wrap.appendChild(hintEl);
      }
      hintEl.textContent = message || '';
      hintEl.classList.toggle('show', !!message);
    };
    const validateEmail = () => {
      const v = (emailEl.value || '').trim();
      setFieldHint(emailEl, v && !isValidEmail(v) ? 'Enter a valid email address.' : '');
    };
    const validatePassword = () => {
      const v = pw.value || '';
      setFieldHint(pw, v && v.length < 6 ? 'Must be at least 6 characters.' : '');
      validateConfirm();
    };
    function validateConfirm() {
      const v = confirmEl.value || '';
      setFieldHint(confirmEl, v && v !== pw.value ? 'Passwords do not match.' : '');
    }
    if (emailEl) { emailEl.addEventListener('blur', validateEmail); emailEl.addEventListener('input', validateEmail); }
    if (pw) { pw.addEventListener('blur', validatePassword); pw.addEventListener('input', validatePassword); }
    if (confirmEl) { confirmEl.addEventListener('blur', validateConfirm); confirmEl.addEventListener('input', validateConfirm); }
  }

  const firstInput = slot.querySelector('input, select');
  if (firstInput) firstInput.focus();

  slot.querySelectorAll('[data-auth-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      authMode = btn.dataset.authLink;
      if (authMode === 'forgot') { authForgotStep = 'email'; authForgotQuestion = ''; }
      renderAuthScreen();
    });
  });

  const setBusy = (busy, label) => {
    submit.disabled = busy;
    submit.classList.toggle('is-busy', busy);
    if (submitLabelEl) submitLabelEl.textContent = busy ? label : submit.dataset.origLabel;
  };
  submit.dataset.origLabel = submitLabelEl ? submitLabelEl.textContent : submit.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show');

    if (authMode === 'signup') {
      const name = (slot.querySelector('#au-name').value || '').trim();
      const email = (slot.querySelector('#au-email').value || '').trim();
      const password = slot.querySelector('#au-password').value || '';
      const confirm = slot.querySelector('#au-confirm').value || '';
      const secQ = slot.querySelector('#au-secq').value;
      const secAns = (slot.querySelector('#au-secans').value || '').trim();
      if (!name) return showErr('Please enter your name.');
      if (!isValidEmail(email)) return showErr('Please enter a valid email address.');
      if (password.length < 6) return showErr('Password must be at least 6 characters.');
      if (password !== confirm) return showErr('Passwords do not match.');
      if (!secAns) return showErr('Please answer the security question.');

      setBusy(true, 'Creating…');
      try {
        await api.post('/auth/signup', { name, email, password, security_question: secQ, security_answer: secAns });
        await authCelebrate(slot, `Welcome, ${name.split(' ')[0] || 'there'}!`);
        enterApp();
      } catch (err) {
        setBusy(false);
        showErr((err && err.message) || 'Something went wrong.');
      }
    } else if (authMode === 'login') {
      const email = (slot.querySelector('#au-email').value || '').trim();
      const password = slot.querySelector('#au-password').value || '';
      if (!email) return showErr('Please enter your email.');
      if (!password) return showErr('Please enter your password.');
      setBusy(true, 'Logging in…');
      try {
        await api.post('/auth/login', { email, password });
        await authCelebrate(slot, 'Welcome back!');
        enterApp();
      } catch (err) {
        setBusy(false);
        showErr((err && err.message) || 'Something went wrong.');
      }
    } else if (authForgotStep === 'email') {
      const email = (slot.querySelector('#au-email').value || '').trim();
      if (!isValidEmail(email)) return showErr('Please enter a valid email address.');
      setBusy(true, 'Checking…');
      try {
        const res = await api.post('/auth/security-question', { email });
        authForgotEmail = email;
        authForgotQuestion = res.question;
        authForgotStep = 'reset';
        renderAuthScreen();
      } catch (err) {
        setBusy(false);
        let msg = (err && err.message) || 'Something went wrong.';
        if (/security question/i.test(msg)) msg = "We couldn't find a security question for that account.";
        showErr(msg);
      }
    } else {
      const secAns = (slot.querySelector('#au-secans').value || '').trim();
      const password = slot.querySelector('#au-password').value || '';
      const confirm = slot.querySelector('#au-confirm').value || '';
      if (!secAns) return showErr('Please answer the security question.');
      if (password.length < 6) return showErr('Password must be at least 6 characters.');
      if (password !== confirm) return showErr('Passwords do not match.');
      setBusy(true, 'Resetting…');
      try {
        await api.post('/auth/reset', { email: authForgotEmail, security_answer: secAns, new_password: password });
        await authCelebrate(slot, 'Password reset!');
        enterApp();
      } catch (err) {
        setBusy(false);
        let msg = (err && err.message) || 'Something went wrong.';
        if (/incorrect answer/i.test(msg)) msg = "That answer doesn't match.";
        showErr(msg);
      }
    }
  });
}

// Renders authScreenHtml(authMode) into #auth-card-slot. The very first mount
// (or under reduced motion) swaps instantly — no JS choreography, just the
// plain CSS entrance animations on .auth-card/.auth-anim-row.
//
// A MODE change instead runs one deterministic sequence, keyed off real
// animation/transition-end events rather than a pile of racing setTimeouts
// (that pile-up was the source of the flicker/lag):
//   1. Freeze the slot at its CURRENT height and clip overflow only for this
//      window (.auth-card-slot-animating — see theme.css; overflow:hidden is
//      never the resting state, which is also the Bug-1 fix).
//   2. Fade the outgoing card out in place (.auth-card-leaving); wait for
//      that animation's `animationend`.
//   3. Swap the DOM (mount the new card). Its own entrance animation
//      (authCardIn) already gives a single, calm content fade — the
//      per-field stagger is skipped for switches (it would just compete with
//      the height morph and read busy); the very first mount keeps it.
//   4. Measure the new card's natural height and morph the slot to it with
//      ONE `height` transition, started on the next frame.
//   5. On that transition's `transitionend` (propertyName === 'height'),
//      clear the inline height/transition and the clipping class — so the
//      slot is left with no leftover inline styles at rest.
// Each stage also has a generous fallback timer purely as a safety net (in
// case an end-event never fires, e.g. a hidden tab); it is not the driver.
//
// authTransitionInterrupt: if the user switches modes again (clicks another
// link) before a previous switch has settled, that earlier in-flight sequence
// is force-settled synchronously before the new one starts — so two
// sequences never race on the same shared inline styles.
let authTransitionInterrupt = null;
function renderAuthScreen(initialError) {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;
  const slot = screen.querySelector('#auth-card-slot');
  if (!slot) return;

  if (authTransitionInterrupt) {
    const prev = authTransitionInterrupt;
    authTransitionInterrupt = null;
    prev();
  }

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const prevCard = slot.querySelector('.auth-card');

  const mount = (isSwitch) => {
    slot.innerHTML = authScreenHtml(authMode, initialError);
    if (isSwitch) {
      // On a mode switch the content is swapped INSTANTLY at full opacity — no
      // fade in or out at all — so there is never a frame where the card is
      // blank. (The old approach faded the outgoing card fully to opacity 0,
      // THEN mounted the incoming card which faded in FROM opacity 0, leaving a
      // visible gap where neither card was shown.) The only motion is the
      // height morph below, which reveals/collapses the new card smoothly via
      // the slot's overflow:hidden.
      slot.querySelectorAll('.auth-anim-row').forEach((row) => { row.style.animation = 'none'; });
      const card = slot.querySelector('.auth-card');
      if (card) card.style.animation = 'none'; // suppress authCardIn (opacity 0→1)
    }
    wireAuthCard(slot);
  };

  const settle = () => {
    slot.style.height = '';
    slot.style.transition = '';
    slot.classList.remove('auth-card-slot-animating');
    authTransitionInterrupt = null;
  };

  if (!prevCard || reduced) {
    mount(false);
    return;
  }

  // Freeze the current height, swap the content instantly (full opacity), then
  // morph the slot height old→new. The card is always fully visible — clipped
  // to the animating height by .auth-card-slot-animating's overflow:hidden — so
  // no blank frame ever appears.
  const startH = slot.getBoundingClientRect().height;
  slot.style.height = startH + 'px';
  slot.classList.add('auth-card-slot-animating');

  mount(true);
  const newCard = slot.querySelector('.auth-card');
  const endH = newCard ? newCard.getBoundingClientRect().height : startH;

  let morphed = false;
  const morphFallback = window.setTimeout(finishMorph, 420);
  function finishMorph(e) {
    if (morphed) return;
    if (e && (e.target !== slot || e.propertyName !== 'height')) return;
    morphed = true;
    window.clearTimeout(morphFallback);
    slot.removeEventListener('transitionend', finishMorph);
    settle();
  }
  slot.addEventListener('transitionend', finishMorph);
  authTransitionInterrupt = () => finishMorph(null);

  slot.style.transition = 'height .3s var(--ease-spring)';
  requestAnimationFrame(() => { slot.style.height = endH + 'px'; });
}

async function logout() {
  try { await api.post('/auth/logout', {}); } catch (_) {}
  window.location.reload();
}

function enterApp() {
  teardownAuthBg();
  teardownAuthHero();
  const el = document.getElementById('auth-screen');
  if (el) el.remove();
  if (appEntered) { route(); return; }
  appEntered = true;
  refreshHealthPill();
  initHealthPoll();
  initTaskTray();
  initPomodoro();
  initSearchHotkey();
  initTheme();
  // Load the profile first so the header chip + dashboard greeting have the name
  // on the very first paint; route() runs whether the fetch succeeds or fails.
  loadProfile().finally(route);
}

async function boot() {
  let status;
  try { status = await api.get('/auth/status'); }
  catch (_) { status = { registered: false, authenticated: false }; }
  if (!status.authenticated) { showAuthGate(status); return; }
  enterApp();
}

window.addEventListener('hashchange', route);
window.addEventListener('axiom:unauthorized', () => {
  if (!document.getElementById('auth-screen')) showAuthGate({ registered: true, authenticated: false });
});
// #theme-toggle is static markup in index.html (present before auth resolves),
// so mount it once here too — enterApp() also calls initTheme() once the app
// is entered, keeping the toggle in sync either way.
initTheme();
boot();
