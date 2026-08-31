// Axiom dashboard: hash-routed views for the semester/course list and a
// per-course detail shell (materials & note generation land here in Step 2).

const inputCls = 'field-input';

const trashIcon =
  '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">' +
  '<path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v11a2 2 0 002 2h4a2 2 0 002-2V7"/></svg>';

const esc = ui.escapeHtml;

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

function courseCard(c, i = 0) {
  const code = c.code
    ? `<span class="ml-2 rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 align-middle">${esc(c.code)}</span>`
    : '';
  const desc = c.description
    ? `<p class="mt-1.5 text-sm text-neutral-500 line-clamp-2">${esc(c.description)}</p>`
    : `<p class="mt-1.5 text-sm italic text-neutral-300">No description</p>`;
  return `
    <div data-action="open-course" data-id="${c.id}" style="${riseDelayStyle(i)}"
      class="card card-interactive rise-in group cursor-pointer p-4">
      <div class="flex items-start justify-between gap-2">
        <div class="flex min-w-0 items-start gap-2">
          <span class="mt-1.5 ${accentDotClsByIndex(i)}"></span>
          <h4 class="min-w-0 text-base font-semibold leading-tight">${esc(c.name)}${code}</h4>
        </div>
        <button data-action="del-course" data-id="${c.id}" data-name="${esc(c.name)}" title="Delete course"
          class="ml-2 shrink-0 rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100">
          ${trashIcon}
        </button>
      </div>
      ${desc}
      <div class="mt-3 flex items-center gap-2 text-xs text-neutral-400">
        <span>${c.material_count} material${c.material_count === 1 ? '' : 's'}</span>
        <span>·</span>
        <span>${c.note_count} note${c.note_count === 1 ? '' : 's'}</span>
      </div>
    </div>`;
}

function semesterBlock(sem, courses) {
  const body = courses.length
    ? `<div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">${courses.map((c, i) => courseCard(c, i)).join('')}</div>`
    : `<div class="mt-4 rounded-2xl border border-dashed border-neutral-200 p-6 text-center text-sm text-neutral-400">No courses yet — add one to get started.</div>`;
  return `
    <section class="mb-10">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <h3 class="text-lg font-semibold">${esc(sem.name)}</h3>
          <span class="text-sm text-neutral-400">${sem.course_count} course${sem.course_count === 1 ? '' : 's'}</span>
          <button data-action="archive-semester" data-id="${sem.id}" data-name="${esc(sem.name)}" title="Archive semester"
            class="rounded-md px-1.5 py-0.5 text-xs font-medium text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700">Archive</button>
          <button data-action="del-semester" data-id="${sem.id}" data-name="${esc(sem.name)}" title="Delete semester"
            class="rounded-md p-1 text-neutral-300 hover:bg-red-50 hover:text-red-600">${trashIcon}</button>
        </div>
        <button data-action="new-course" data-semester-id="${sem.id}"
          class="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50">+ New course</button>
      </div>
      ${body}
    </section>`;
}

function archivedSemesterRow(sem) {
  return `
    <div class="flex items-center justify-between rounded-xl border border-neutral-100 bg-neutral-50/60 px-4 py-2.5">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-neutral-500">${esc(sem.name)}</span>
        <span class="text-xs text-neutral-400">${sem.course_count} course${sem.course_count === 1 ? '' : 's'}</span>
      </div>
      <button data-action="unarchive-semester" data-id="${sem.id}" data-name="${esc(sem.name)}"
        class="rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50">Unarchive</button>
    </div>`;
}

function archivedSection(archived) {
  return `
    <section class="mt-2 border-t border-neutral-100 pt-6">
      <h3 class="text-sm font-medium text-neutral-400">Archived</h3>
      <div class="mt-3 space-y-2">${archived.map(archivedSemesterRow).join('')}</div>
    </section>`;
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

function lessonRow(item, i = 0) {
  const code = item.course_code
    ? `<span class="ml-1.5 shrink-0 rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 align-middle">${esc(item.course_code)}</span>`
    : '';
  const days = daysBetween(todayISO(), item.exam_date);
  const daysText = days === 0 ? 'today' : days === 1 ? 'in 1 day' : days > 1 ? `in ${days} days` : 'past';
  const dotCls = item.note_id ? 'bg-emerald-500' : 'bg-amber-400';
  const doneMark = item.done ? doneCheckIcon : '';
  return `
    <button data-action="open-schedule-lesson" data-item-id="${item.id}"
      style="${riseDelayStyle(i)};background:linear-gradient(135deg, color-mix(in srgb, var(--${accentKey(item.course_id)}) 11%, var(--surface)), var(--surface) 62%)"
      class="card card-interactive rise-in flex w-full items-center gap-3 px-4 py-3 text-left">
      <span class="h-3 w-3 shrink-0 rounded-full ${dotCls}" style="box-shadow:0 0 9px 1px ${item.note_id ? 'var(--success)' : 'var(--warning)'}"></span>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center">
          <span class="truncate text-sm text-neutral-500">${esc(item.course_name)}</span>${code}
        </div>
        <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
          <p class="min-w-0 truncate text-sm font-medium ${item.done ? 'text-neutral-400 line-through' : ''}">${esc(item.concept_name)}</p>
          ${doneMark}
        </div>
      </div>
      <div class="hidden shrink-0 text-right sm:block">
        <p class="truncate text-xs text-neutral-500">for ${esc(item.exam_name)}</p>
        <p class="mt-0.5 text-xs text-neutral-400">${daysText}</p>
      </div>
      ${chevronIcon}
    </button>`;
}

function lessonList(items) {
  return `<div class="flex w-full flex-col gap-3">${items.map((it, i) => lessonRow(it, i)).join('')}</div>`;
}

function daySectionHtml(iso, items) {
  const body = items.length
    ? `<div class="mt-2">${lessonList(items)}</div>`
    : `<p class="mt-2 text-sm text-neutral-400">Nothing scheduled today.</p>`;
  return `
    <section class="mt-6 first:mt-0">
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
  return `
    <button data-action="open-schedule-lesson" data-item-id="${item.id}" style="${accentContainerStyle(item.course_id)}"
      class="card-interactive flex w-full items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight">
      <span class="h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}"></span>
      <span class="min-w-0 flex-1 truncate ${item.done ? 'line-through opacity-60' : ''}">${esc(item.concept_name)}</span>
      ${doneMark}
      ${code}
    </button>`;
}

function calendarDayCell(iso, items, isCurrentMonth, isToday) {
  const dayNum = Number(iso.slice(-2));
  const visible = items.slice(0, CAL_MAX_CHIPS);
  const extra = items.length - visible.length;
  const cellCls = [
    'flex min-h-[6.5rem] flex-col gap-1 rounded-lg border p-1.5',
    isCurrentMonth ? 'border-neutral-100 bg-white' : 'border-neutral-50 bg-neutral-50/60',
    isToday ? 'ring-2 ring-inset ring-neutral-800' : '',
  ].join(' ');
  const numCls = isToday
    ? 'inline-flex h-5 w-5 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-semibold text-white'
    : isCurrentMonth ? 'text-xs font-medium text-neutral-600' : 'text-xs font-medium text-neutral-300';
  return `
    <div class="${cellCls}">
      <span class="${numCls}">${dayNum}</span>
      <div class="flex flex-col gap-1">
        ${visible.map(calendarChip).join('')}
        ${extra > 0 ? `<span class="px-1 text-[10px] text-neutral-400">+${extra} more</span>` : ''}
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
      <div class="min-w-[640px]">
        ${calendarWeekdayHeaderHtml()}
        <div class="mt-1 grid grid-cols-7 gap-1">${cells.join('')}</div>
      </div>
    </div>`;
}

/* ---------- dashboard ---------- */

let scheduleHorizon = null; // module-level: preserved across re-renders (e.g. after regenerate)
let dashboardView = 'list'; // 'list' | 'calendar' — module-level: preserved across re-renders
let calendarMonth = null;   // ISO first-of-month string — module-level: preserved across re-renders

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

// Fills #dash-content ONLY (list agenda or calendar month grid, whichever
// dashboardView currently is) — never touches the greeting/toggle/actions
// header above it, so switching views or paging the calendar never scrolls
// the page or nudges any other element (Build 7 Phase 4, Fix A).
async function renderDashContent() {
  const host = document.getElementById('dash-content');
  if (!host) return;
  const today = todayISO();
  let bodyHtml;

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
  await renderDashContent();
}

/* ---------- courses view (Build 2, Step 4): semester/course management ---------- */

async function renderCourses() {
  const view = document.getElementById('view');
  view.innerHTML = '<p class="text-sm text-neutral-400">Loading…</p>';
  const [allSemesters, courses] = await Promise.all([
    api.get('/semesters?include_archived=1'),
    api.get('/courses'),
  ]);
  const semesters = allSemesters.filter((s) => !s.archived);
  const archived = allSemesters.filter((s) => s.archived);

  let html = `
    <div class="mb-8 flex items-center justify-between">
      <div>
        <h2 class="text-2xl font-semibold tracking-tight">Courses</h2>
        <p class="text-sm text-neutral-500">Your term, in one place.</p>
      </div>
      <button data-action="new-semester"
        class="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">+ New semester</button>
    </div>`;

  if (!semesters.length) {
    html += `
      <div class="rounded-2xl border border-dashed border-neutral-200 p-12 text-center">
        <p class="text-neutral-500">No semesters yet.</p>
        <button data-action="new-semester"
          class="mt-4 rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800">Create your first semester</button>
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

function materialRow(m) {
  return `
    <div class="group flex items-center justify-between gap-2 rounded-lg border border-neutral-100 px-3 py-2">
      <div class="flex min-w-0 items-center gap-2">
        ${docIcon}
        <span class="truncate text-sm">${esc(m.display_name)}</span>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="text-xs text-neutral-400">${fmtSize(m.size_bytes)}</span>
        <button data-action="del-material" data-id="${m.id}" title="Remove"
          class="rounded-md p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-600 group-hover:opacity-100">${trashIcon}</button>
      </div>
    </div>`;
}

function uploadPanel(kind, title, subtitle) {
  return `
    <div class="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 class="font-semibold">${title}</h3>
      <p class="text-xs text-neutral-500">${subtitle}</p>
      <div id="drop-${kind}"
        class="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-neutral-200 p-6 text-center transition hover:border-neutral-300">
        <p class="text-sm text-neutral-500">Drop PDFs or images here, or <span class="font-medium text-neutral-700">browse</span></p>
        <p class="mt-1 text-xs text-neutral-400">PDF, PNG, JPG, WEBP · up to 50 MB</p>
        <input id="input-${kind}" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple class="hidden" />
      </div>
      <div id="up-status-${kind}" class="mt-3 space-y-1"></div>
      <div id="list-${kind}" class="mt-3 space-y-1"></div>
    </div>`;
}

function fillMaterialLists(materials) {
  const mats = materials.filter((m) => m.kind === 'material');
  const pyqs = materials.filter((m) => m.kind === 'pyq');
  const lm = document.getElementById('list-material');
  const lp = document.getElementById('list-pyq');
  if (lm) lm.innerHTML = mats.length ? mats.map(materialRow).join('') : emptyList('No study materials yet.');
  if (lp) lp.innerHTML = pyqs.length ? pyqs.map(materialRow).join('') : emptyList('No past questions yet.');
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
  fillMaterialLists(materials);
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
  let src = '';
  try { src = (JSON.parse(c.source_locations || '{}').source) || ''; } catch (_) { /* ignore */ }
  return `
    <div class="card p-4">
      <div class="flex items-start gap-2">
        <span class="mt-1.5 ${accentDotClsByIndex(i)}"></span>
        <h4 class="min-w-0 font-semibold leading-tight">${esc(c.name)}</h4>
      </div>
      <p class="mt-1 text-sm text-neutral-600">${esc(c.summary || '')}</p>
      ${src ? `<p class="mt-2 text-xs text-neutral-400">${esc(src)}</p>` : ''}
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
      <div data-action="open-note" data-note-id="${n.id}" data-course-id="${courseId}" data-title="${esc(n.title)}"
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
  let job = null, concepts = [], notes = [], course = null, sp = { prompts: [], active_prompt_id: null };
  try {
    [job, concepts, notes] = await Promise.all([
      api.get(`/courses/${courseId}/job`),
      api.get(`/courses/${courseId}/concepts`),
      api.get(`/courses/${courseId}/notes`),
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
  const conceptsHeaderAction = concepts.length
    ? `<div class="flex items-center gap-2">
        <button data-action="reanalyze-all" data-id="${courseId}" ${running ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Re-analyze all</button>
        <button data-action="generate" data-id="${courseId}" ${running ? 'disabled' : ''} class="${btnSecondary}">Analyze new materials</button>
      </div>`
    : `<button data-action="generate" data-id="${courseId}" ${running ? 'disabled' : ''} class="${btnSecondary}">Analyze materials</button>`;
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
    const chooseBtn = `<button data-action="choose-notes" data-id="${courseId}" ${running ? 'disabled' : ''} class="rounded-lg px-3 py-1.5 text-sm font-medium text-neutral-500 hover:bg-neutral-100">Choose…</button>`;
    const genNotesBtn = `<button data-action="gen-notes" data-id="${courseId}" ${running ? 'disabled' : ''} class="${btnPrimary}">${notes.length ? 'Generate new notes' : 'Generate notes'}</button>`;
    html += sectionHeader('Notes', 'One compiled PDF per concept.',
      `<div class="flex items-center gap-2">${studyBtn}${downloadAllBtn}<button data-action="note-customize" data-id="${courseId}" class="${btnSecondary}">Customize${customized ? ' ✓' : ''}</button>${chooseBtn}${genNotesBtn}</div>`, 'mt-12');
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
      <div class="mt-4 flex justify-end gap-2">
        <button data-cancel class="btn btn-ghost">Cancel</button>
        <button data-gen class="btn btn-primary">Generate selected</button>
      </div>
    </div>`);
  const boxes = () => Array.from(card.querySelectorAll('input[data-cid]'));
  card.querySelectorAll('[data-sel]').forEach((b) => b.addEventListener('click', () => {
    const mode = b.dataset.sel;
    boxes().forEach((x) => { x.checked = mode === 'all' ? true : mode === 'none' ? false : !noteByConcept.has(Number(x.dataset.cid)); });
  }));
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
    <button data-action="open-lesson" data-course-id="${item.course_id}" data-note-id="${item.note_id || ''}"
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

/* ---------- quiz prefetch (Build 3 Further-Fixes, Step 3) ----------
   Fired whenever a lesson becomes the active one in either study view, so the
   quiz is (usually) already generated by the time the student clicks "Start
   Quiz". Cached: a quiz that's already ready/generating/pending is left alone
   — this never triggers a second generation. */

const quizStatusCache = {}; // concept_id -> last known quiz status

function quizButtonLabel(conceptId) {
  const status = conceptId != null ? quizStatusCache[conceptId] : null;
  return (status === 'generating' || status === 'pending') ? 'Preparing quiz…' : 'Start Quiz';
}

async function maybePrefetchQuiz(conceptId) {
  if (conceptId == null) return null;
  let data;
  try {
    data = await api.get(`/concepts/${conceptId}/quiz`);
  } catch (_) {
    return null; // best-effort status check — never blocks the caller
  }
  const status = data && data.status;
  quizStatusCache[conceptId] = status;
  if (status === 'none' || status === 'failed') {
    quizStatusCache[conceptId] = 'generating'; // optimistic: generate always flips it to this
    api.post(`/concepts/${conceptId}/quiz/generate`, {}).catch(() => {
      quizStatusCache[conceptId] = status; // revert the optimistic label if the fire failed outright
    });
  }
  return status;
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

function readerFallback(note, container) {
  const scrollEl = container.querySelector('#reader-scroll');
  if (scrollEl) {
    scrollEl.innerHTML = `
      <div class="reader-fallback">
        <p class="text-sm text-neutral-500">Couldn't load the rich reader.</p>
        <a href="/api/notes/${note.id}/pdf?download=1" class="${btnSecondary}">Download PDF</a>
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
    await api.put(`/notes/${state.note.id}/annotations`, { data: state.annotations });
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
  api.get(`/notes/${note.id}/annotations`).then((res) => {
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
    <button data-action="reader-tool" data-tool="${t.tool}" title="${esc(t.title)}"
      class="reader-tool-btn${t.active ? ' reader-tool-btn-active' : ''}">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${t.svg}</svg>
    </button>`).join('');
  const swatches = READER_COLORS.map((c, i) => `
    <button data-action="reader-color" data-color="${c}" title="Color"
      class="reader-swatch${i === 0 ? ' reader-swatch-active' : ''}" style="background:${c}"></button>`).join('');
  return `
    ${toolBtns}
    <span class="reader-tool-sep"></span>
    <div class="flex items-center gap-1">${swatches}</div>
    <button data-action="reader-stroke" data-width="thin" title="Toggle stroke width" class="reader-tool-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round">
        <path d="M4 10h16" stroke-width="1.5"/><path d="M4 16h16" stroke-width="3.5"/>
      </svg>
    </button>
    <span class="reader-tool-sep"></span>
    <button data-action="reader-undo" title="Undo" class="reader-tool-btn">
      <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/>
      </svg>
    </button>
    <span id="reader-save-status" class="reader-save-status">&nbsp;</span>`;
}

function readerSetTool(tool) {
  if (!readerState) return;
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
  const cleanUrl = `/api/notes/${state.note.id}/pdf?download=1`;
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

  if (state.observer) { state.observer.disconnect(); state.observer = null; }
  scrollEl.innerHTML = '';
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
    wrapper.style.width = cssW + 'px';
    wrapper.style.height = cssH + 'px';

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

    const pageEntry = { pageNumber: i, wrapper, canvas, annCanvas, textLayer, pdfTextLayerEl, cssW, cssH, fitScale };
    state.pages.push(pageEntry);
    setupReaderPageInteraction(state, pageEntry);
    redrawPage(state, pageEntry); // paints whatever's already in state.annotations

    await new Promise((r) => setTimeout(r, 0)); // yield so the UI stays responsive while later pages render
  }

  if (readerState !== state) return;
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
    const pdf = await lib.getDocument('/api/notes/' + note.id + '/pdf').promise;
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

function openReader(note) {
  if (!note || !note.id) { ui.toast('No PDF for this lesson', 'error'); return; }
  if (readerState) closeReader();

  const container = document.createElement('div');
  container.className = 'reader-overlay reader-tool-none';
  container.innerHTML = `
    <div class="reader-navbar">
      <p class="min-w-0 truncate text-sm font-semibold text-ink" title="${esc(note.title || '')}">${esc(note.title || 'Untitled')}</p>
      <div class="flex shrink-0 items-center gap-3">
        <div id="reader-tools" class="flex items-center gap-1">${readerToolbarHtml()}</div>
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
      <div class="reader-scroll" id="reader-scroll"></div>
    </div>`;
  document.body.appendChild(container);
  requestAnimationFrame(() => { container.classList.add('reader-open'); });

  const keyHandler = (e) => {
    if (e.key === 'Escape') { closeReader(); return; }
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
  };

  // Independent of the PDF load below: fetches saved annotations in parallel.
  // Whichever of "annotations loaded" or "pages rendered" finishes first, the
  // other's completion triggers the correct repaint — readerRedrawAll (from
  // here) and the per-page redrawPage call (from readerRenderAllPages) are
  // both idempotent and safe to call in either order.
  loadReaderAnnotations(note, readerState);
  loadReaderPdf(note, readerState);
  renderPomodoroReaderBtn(); // reflect a timer that's already running when the reader opens
}

function closeReader() {
  if (!readerState) return;
  const st = readerState;
  readerState = null; // mark closed immediately so a re-entrant openReader() can proceed
  if (st.saveTimer) { clearTimeout(st.saveTimer); st.saveTimer = null; }
  if (st.savedFadeTimer) clearTimeout(st.savedFadeTimer);
  if (st.resizeTimer) { clearTimeout(st.resizeTimer); st.resizeTimer = null; }
  if (st.resizeHandler) window.removeEventListener('resize', st.resizeHandler);
  if (st.observer) { try { st.observer.disconnect(); } catch (e) {} }
  if (st.dirty) {
    // Fire-and-forget: fetch keeps running after the DOM/state teardown below.
    st.dirty = false;
    api.put(`/notes/${st.note.id}/annotations`, { data: st.annotations }).catch((e) => {
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
  if (note.concept_id != null) {
    maybePrefetchQuiz(note.concept_id).then(() => {
      if (studyState && studyState.activeId === id) studyRenderDetail();
    });
  }
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
  if (active && active.concept_id != null) {
    maybePrefetchQuiz(active.concept_id).then(() => {
      if (studyState && studyState.activeId === active.id) studyRenderDetail();
    });
  }
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
  if (item.concept_id != null) {
    maybePrefetchQuiz(item.concept_id).then(() => {
      if (schedStudy && schedStudy.activeId === id) schedRenderRight();
    });
  }
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
    items = await api.get(`/schedule/upcoming?from=${today}&to=${to}`);
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
  if (activeItem.concept_id != null) {
    maybePrefetchQuiz(activeItem.concept_id).then(() => {
      if (schedStudy && schedStudy.activeId === activeItem.id) schedRenderRight();
    });
  }
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
  fillMaterialLists(materials);
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
    }
  });
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
  if (ok) ui.toast(`${ok} file${ok === 1 ? '' : 's'} uploaded`);
  if (!fail) setTimeout(() => { if (status) status.innerHTML = ''; }, 1500);
}

async function delMaterial(id) {
  try {
    await api.del(`/materials/${id}`);
    ui.toast('Removed');
    const m = (location.hash || '').match(/^#\/course\/(\d+)/);
    if (m) await refreshMaterials(m[1]);
  } catch (e) {
    ui.toast(e.message, 'error');
  }
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
    el.innerHTML = `<span class="h-2.5 w-2.5 rounded-full ${allOk ? 'bg-emerald-500' : 'bg-amber-500'}"></span>`;
    el.title = allOk ? 'All systems go' : 'Check status';
  } catch (e) {
    el.innerHTML = '<span class="h-2.5 w-2.5 rounded-full bg-red-500"></span>';
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
  el.innerHTML = `
    <div class="flex flex-col items-center gap-1.5">
      <button data-action="go-settings" title="${esc(first)} — profile & settings"
        class="rounded-full p-0.5 transition hover:opacity-80">
        ${avatarHtml(p, 'h-9 w-9')}
      </button>
      <button data-action="logout" title="Log out"
        class="rounded-lg p-2 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
        ${logoutIcon}
      </button>
    </div>`;
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
        { left: '$', right: '$', display: false },
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
      <span class="shrink-0 chip chip-grape">Score ${score}/${total}</span>
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
  quizRenderSummary(progress);
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

function quizRenderSummary(progress) {
  const { score, total } = quizState;
  const full = total > 0 && score >= total;
  const view = document.getElementById('view');
  const doneNote = full
    ? `<div class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">Lesson complete! &#10003; Marked done.</div>`
    : '';
  view.innerHTML = `
    <div class="mx-auto flex max-w-lg flex-col items-center rounded-2xl border border-neutral-200 bg-white p-10 text-center shadow-sm">
      <p class="text-xs font-semibold uppercase tracking-wide text-neutral-400">Quiz complete</p>
      <h2 class="mt-2 text-3xl font-semibold tracking-tight">${score} / ${total}</h2>
      <p class="mt-2 text-sm text-neutral-500">${esc(quizPerfMessage(score, total))}</p>
      ${doneNote}
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button data-action="quiz-retry" class="${btnSecondary}">Retry</button>
        <button data-action="quiz-new" class="${btnSecondary}">New questions</button>
        <a href="${quizBackHref()}" class="${btnPrimary}">Back to course</a>
      </div>
    </div>`;
}

function quizRetry() {
  if (!quizState) return;
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
  location.hash = quizBackHref();
}

/* ---------- global task tray (Build 3 Further-Fixes, Step 4) ----------
   An always-on, bottom-right chip showing background work (extraction /
   note generation / quiz generation) across the WHOLE app, independent of
   whatever route is on screen. Built once into document.body at init (see
   initTaskTray() near the bottom) so route()/renderX() never wipe it. */

let taskTrayOpen = false; // survives refreshes so the panel doesn't collapse under the user

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
    return; // transient failure — skip this tick silently, don't spam toasts
  }
  const tasks = (data && data.tasks) || [];
  const count = (data && data.count) || 0;
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
}

const THEME_OPTIONS = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

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
}

// Live-follow the OS theme while the user's choice is 'system' (does not
// override an explicit light/dark choice).
try {
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme();
  });
} catch (_) {}

/* ---------- routing + wiring ---------- */

// Highlights the sidebar nav item matching the current route. Called on every
// route() so back/forward, hash links, and programmatic navigation all stay
// in sync (courses list, a single course, and any of its sub-views all count
// as "Courses"; settings likewise; everything else falls back to "Home").
function updateSidebarActive() {
  const hash = location.hash || '#/';
  let section = 'home';
  if (/^#\/settings\/?$/.test(hash)) section = 'settings';
  else if (/^#\/(courses\/?$|course\/)/.test(hash)) section = 'courses';
  document.querySelectorAll('#sidebar [data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === section);
  });
}

async function route() {
  quizStopPoll();
  stopJobPolling();
  closeReader();
  updateSidebarActive();
  const hash = location.hash || '#/';
  const study = hash.match(/^#\/course\/(\d+)\/study(?:\/(\d+))?/);
  const scheduleStudy = hash.match(/^#\/study(?:\/(\d+))?$/);
  const coursesList = hash.match(/^#\/courses\/?$/);
  const settingsView = hash.match(/^#\/settings\/?$/);
  const quizView = hash.match(/^#\/quiz\/(\d+)$/);
  const course = hash.match(/^#\/course\/(\d+)/);
  try {
    if (quizView) await renderQuiz(quizView[1]);
    else if (study) await renderStudyView(study[1], study[2]);
    else if (scheduleStudy) await renderScheduleStudy(scheduleStudy[1]);
    else if (coursesList) await renderCourses();
    else if (settingsView) await renderSettings();
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
  if (a === 'home') { e.preventDefault(); location.hash = '#/'; }
  else if (a === 'go-courses') { e.preventDefault(); location.hash = '#/courses'; }
  else if (a === 'go-settings') { e.preventDefault(); location.hash = '#/settings'; }
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
    const nid = t.dataset.noteId;
    location.hash = nid ? `#/course/${cid}/study/${nid}` : `#/course/${cid}`;
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
  else if (a === 'note-customize') noteCustomizeModal(t.dataset.id);
  else if (a === 'cancel-job') cancelJob(t.dataset.id);
  else if (a === 'open-note') location.hash = `#/course/${t.dataset.courseId}/study/${t.dataset.noteId}`;
  else if (a === 'open-study') location.hash = `#/course/${t.dataset.id}/study`;
  else if (a === 'note-error') showNoteError(t.dataset.noteId, t.dataset.title);
  else if (a === 'retry-note') { e.stopPropagation(); retryNote(t.dataset.noteId); }
  else if (a === 'study-select') studySelectNote(t.dataset.noteId);
  else if (a === 'study-open-reading') studyOpenReading();
  else if (a === 'study-close-reading') studyCollapseReading();
  else if (a === 'study-error') showNoteError(t.dataset.noteId, t.dataset.title);
  else if (a === 'open-schedule-lesson') { location.hash = '#/study/' + t.dataset.itemId; }
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
  else if (a === 'new-exam') newExam(t.dataset.id);
  else if (a === 'edit-exam') editExam(t.dataset.examId);
  else if (a === 'del-exam') delExam(t.dataset.examId, t.dataset.name);
  else if (a === 'exam-concepts') examConceptsModal(t.dataset.examId, t.dataset.name);
  else if (a === 'start-quiz') location.hash = `#/quiz/${t.dataset.conceptId}`;
  else if (a === 'start-quiz-stop') { e.stopPropagation(); location.hash = `#/quiz/${t.dataset.conceptId}`; }
  else if (a === 'toggle-done') toggleDone(t.dataset.conceptId, t.dataset.done === '1');
  else if (a === 'toggle-done-stop') { e.stopPropagation(); toggleDone(t.dataset.conceptId, t.dataset.done === '1'); }
  else if (a === 'quiz-exit') quizExit();
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

/* ---------- Auth gate (Build 6, single account; redesigned Build 7 Phase 2) ----------
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
let authBgController = null;  // { el, teardown() } for the animated background, or null
let appEntered = false;

const SECURITY_QUESTIONS = [
  "What was your first pet's name?",
  "What city were you born in?",
  "What was the name of your first school?",
  "What is your mother's maiden name?",
  "What was your favorite childhood book?",
];

function isValidEmail(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v); }

// A password <input> with a Show/Hide toggle button (id="au-toggle", wired in
// renderAuthScreen). Only one is ever on screen at a time across modes/steps.
function authPasswordFieldHtml(id, placeholder, autocomplete) {
  return `<div class="relative"><input id="${id}" type="password" class="${inputCls} pr-14" placeholder="${esc(placeholder)}" autocomplete="${autocomplete}"><button type="button" id="au-toggle" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-neutral-400 hover:text-neutral-700">Show</button></div>`;
}

function authScreenHtml(mode, initialError) {
  const errHtml = initialError
    ? `<p id="au-error" class="rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600">${esc(initialError)}</p>`
    : `<p id="au-error" class="hidden rounded-xl bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-600"></p>`;

  let heading, sub, submitLabel, bodyHtml, footerHtml;

  if (mode === 'signup') {
    heading = 'Create your account';
    sub = 'Set up Axiom to start studying smarter.';
    submitLabel = 'Create account';
    bodyHtml = `
      ${field('Name', `<input id="au-name" class="${inputCls}" placeholder="Your name" autocomplete="name">`)}
      ${field('Email', `<input id="au-email" type="email" class="${inputCls}" placeholder="you@example.com" autocomplete="email">`)}
      ${field('Password', authPasswordFieldHtml('au-password', 'At least 6 characters', 'new-password'))}
      ${field('Confirm password', `<input id="au-confirm" type="password" class="${inputCls}" placeholder="Re-enter password" autocomplete="new-password">`)}
      ${field('Security question', `<select id="au-secq" class="${inputCls}">${SECURITY_QUESTIONS.map((q) => `<option value="${esc(q)}">${esc(q)}</option>`).join('')}</select>`)}
      ${field('Security answer', `<input id="au-secans" class="${inputCls}" placeholder="Your answer" autocomplete="off">`, 'Used only to reset your password if you ever forget it.')}
    `;
    footerHtml = `<p class="mt-5 text-center text-sm text-muted">Already have an account? <button type="button" data-auth-link="login" class="link font-medium">Log in</button></p>`;
  } else if (mode === 'login') {
    heading = 'Welcome back';
    sub = 'Log in to pick up where you left off.';
    submitLabel = 'Log in';
    bodyHtml = `
      ${field('Email', `<input id="au-email" type="email" class="${inputCls}" placeholder="you@example.com" autocomplete="email">`)}
      ${field('Password', authPasswordFieldHtml('au-password', 'Your password', 'current-password'))}
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
        <div>
          <span class="text-sm font-medium text-neutral-700">Security question</span>
          <div class="mt-1.5 rounded-xl surface-2 px-3.5 py-2.5 text-sm text-ink">${esc(authForgotQuestion)}</div>
        </div>
        ${field('Answer', `<input id="au-secans" class="${inputCls}" placeholder="Your answer" autocomplete="off">`)}
        ${field('New password', authPasswordFieldHtml('au-password', 'At least 6 characters', 'new-password'))}
        ${field('Confirm new password', `<input id="au-confirm" type="password" class="${inputCls}" placeholder="Re-enter new password" autocomplete="new-password">`)}
      `;
    } else {
      sub = "Enter your account email and we'll show your security question.";
      submitLabel = 'Continue';
      bodyHtml = `${field('Email', `<input id="au-email" type="email" class="${inputCls}" placeholder="you@example.com" autocomplete="email" value="${esc(authForgotEmail)}">`)}`;
    }
    footerHtml = `<p class="mt-5 text-center text-sm text-muted"><button type="button" data-auth-link="login" class="link font-medium">Back to log in</button></p>`;
  }

  return `
    <div class="w-full max-w-sm">
      <div class="mb-4 flex flex-col items-center text-center">
        <div class="auth-monogram mb-3">A</div>
        <h1 class="text-xl font-semibold tracking-tight text-ink">${esc(heading)}</h1>
        <p class="mt-1 text-sm text-muted">${esc(sub)}</p>
      </div>
      <form id="auth-form" class="modal-card space-y-3 p-6">
        ${bodyHtml}
        ${errHtml}
        <button type="submit" id="au-submit" class="${btnPrimary} btn-pill w-full py-2 text-[0.95rem]">${esc(submitLabel)}</button>
      </form>
      ${footerHtml}
    </div>`;
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
  const factors = [
    { x: 24, y: 18 }, { x: -30, y: 16 }, { x: 20, y: -22 },
    { x: -18, y: -26 }, { x: 26, y: 12 },
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
    eased.x += (pointer.x - eased.x) * 0.06;
    eased.y += (pointer.y - eased.y) * 0.06;
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
    // the card when it fits and top-aligns it (fully reachable, logo never clipped)
    // when a short viewport can't hold it — instead of centering+overflow on the
    // same element, which clips the top.
    screen.innerHTML = '<div id="auth-bg-slot"></div>'
      + '<div class="relative z-10 min-h-full flex items-center justify-center px-6 py-8">'
      + '<div id="auth-card-slot" class="flex w-full justify-center"></div></div>';
    document.body.appendChild(screen);
    mountAuthBg(document.getElementById('auth-bg-slot'));
  }
  renderAuthScreen();
}

function renderAuthScreen(initialError) {
  const screen = document.getElementById('auth-screen');
  if (!screen) return;
  const slot = screen.querySelector('#auth-card-slot') || screen;
  slot.innerHTML = authScreenHtml(authMode, initialError);
  const form = slot.querySelector('#auth-form');
  const errEl = slot.querySelector('#au-error');
  const pw = slot.querySelector('#au-password');
  const toggle = slot.querySelector('#au-toggle');
  const submit = slot.querySelector('#au-submit');
  const showErr = (msg) => { errEl.textContent = msg; errEl.classList.remove('hidden'); };
  if (toggle && pw) toggle.addEventListener('click', () => {
    const showing = pw.type === 'text';
    pw.type = showing ? 'password' : 'text';
    toggle.textContent = showing ? 'Show' : 'Hide';
  });
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
    submit.textContent = busy ? label : submit.dataset.origLabel;
  };
  submit.dataset.origLabel = submit.textContent;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.add('hidden');

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

async function logout() {
  try { await api.post('/auth/logout', {}); } catch (_) {}
  window.location.reload();
}

function enterApp() {
  teardownAuthBg();
  const el = document.getElementById('auth-screen');
  if (el) el.remove();
  if (appEntered) { route(); return; }
  appEntered = true;
  refreshHealthPill();
  initTaskTray();
  initPomodoro();
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
