# Axiom — ARCHITECTURE.md

Detailed map of the system. Pair with `CLAUDE.md`. Update after major changes.

## Directory layout
```
Axiom/
  Axiom_Project_Document.md      # vision / concept doc
  CLAUDE.md                      # agent orientation
  ARCHITECTURE.md                # this file
  .gitignore
  backend/
    .env / .env.example          # GEMINI_API_KEY, TECTONIC_PATH, GEMINI_MODEL, AXIOM_DATA_DIR
    requirements.txt
    .venv/                       # virtualenv (gitignored)
    app/
      main.py                    # FastAPI app: lifespan(init_db), CORS, routers, static mount
      config.py                  # paths, env, GEMINI_MODEL, TECTONIC_PATH, ensure_dirs()
      db.py                      # get_connection(), init_db(), SCHEMA_SQL
      routers/
        health.py                # GET /api/health
        semesters.py             # semesters CRUD
        courses.py               # courses CRUD (+ material/note counts)
        materials.py             # upload / list / delete materials (PDF + images)
        generation.py            # POST generate, GET job, GET concepts  (+ notes in step 4/5)
      services/
        storage.py               # UUID names, per-course dirs, file cleanup
        gemini.py                # File API upload, concept extraction, retry
        generation_service.py    # background job bodies (extract; note loop in 4/5)
        latex.py                 # (step 4) preamble, sanitize, tectonic compile, thumbnail
  frontend/
    index.html                   # app shell: header + health pill + #view
    js/api.js                    # fetch wrapper (get/post/del/upload)
    js/ui.js                     # escapeHtml, toast, formModal, confirmModal, mountOverlay
    js/app.js                    # hash router, dashboard, course detail, concepts, actions
  data/                          # gitignored runtime store (or AXIOM_DATA_DIR)
    axiom.db
    uploads/<course_id>/<uuid>.<ext>
    notes/<course_id>/<uuid>.pdf
    thumbs/<course_id>/<uuid>.png
    work/<uuid>/                 # transient tectonic build dirs
```

## Data model (SQLite, all children FK→cascade, scoped by course_id)
- semesters(id, name, created_at)
- courses(id, semester_id→semesters, name, code, description, created_at)
- materials(id, course_id→courses, kind['material'|'pyq'], display_name, disk_uuid,
  mime_type, size_bytes, gemini_file_uri, gemini_file_name, gemini_expiry, created_at)
- concepts(id, course_id→courses, name, summary, source_locations(JSON), material_id[BFF: primary source material, fuzzy-resolved from extraction's source_file], order_index, created_at)

> Migrations: `db._ensure_columns(conn)` (run in `init_db`) ALTERs existing tables
> to add new columns idempotently (checks `PRAGMA table_info`). Columns added this
> way so far: `concepts.material_id`.
- lessons(id, course_id→courses, title, order_index, created_at)   # one "All notes" lesson per course
- notes(id, course_id, lesson_id→lessons, concept_id→concepts, title, latex_source,
  pdf_disk_uuid, thumb_disk_uuid, status['pending'|'generating'|'compiled'|'failed'],
  error_message, created_at)
- jobs(id, course_id, type['extract'|'generate'], status['queued'|'running'|'done'|'failed'],
  progress, total, message, created_at, updated_at)
- **[Build 2]** exams(id, course_id→courses, name, study_start_date, exam_date(ISO), created_at)
- **[Build 2]** exam_concepts(exam_id→exams, concept_id→concepts, PK(exam_id,concept_id))
- **[Build 2]** schedule_items(id, semester_id, course_id, exam_id, concept_id, study_date, order_index, created_at)

## HTTP API (all under /api)
- GET  /health
- Semesters: GET /semesters · POST /semesters · DELETE /semesters/{id}
- Courses:   GET /courses[?semester_id] · GET /courses/{id} · POST /courses · DELETE /courses/{id}
- Materials: GET /courses/{id}/materials · POST /courses/{id}/materials (multipart kind+file) · DELETE /materials/{id}
- Generation: POST /courses/{id}/generate (202, starts bg job) · GET /courses/{id}/job · GET /courses/{id}/concepts
- (Step 4/5) Notes: GET /courses/{id}/notes · GET /notes/{id}/pdf (inline) · GET /notes/{id}/thumb · GET /notes/{id}/latex
- [Build 2] Exams: POST/GET /courses/{id}/exams · GET/PATCH/DELETE /exams/{id} · PUT /exams/{id}/concepts (tick set, cross-course validated)
- [Build 2] Schedule: POST /semesters/{id}/schedule/generate · POST /schedule/generate-all · GET /semesters/{id}/schedule?from&to · GET /schedule/upcoming?from&to · GET /courses/{id}/schedule (rows joined to course/exam/concept + resolved compiled note)
- [BFF] Downloads: GET /notes/{id}/pdf?download=1 · GET /courses/{id}/notes.zip · GET /schedule/upcoming.ics · GET /semesters/{id}/schedule.ics
- [BFF] Jobs: POST /courses/{id}/job/cancel (sets jobs.cancel_requested; loops check `_is_cancelled`)
- [BFF] Archive: GET /semesters?include_archived=1 · POST /semesters/{id}/archive · /unarchive (archived hidden from list + `/schedule/upcoming(.ics)` + generate-all)
- [BFF] New columns (via `_ensure_columns` migration): concepts.material_id, jobs.cancel_requested, semesters.archived
- [Build 3] Tables: settings(key PK, value) · quizzes(id, course_id, concept_id UNIQUE, status, questions_json, error_message, ts) · lesson_progress(id, course_id, concept_id UNIQUE, done, done_at, best_score, best_total, ts)
- [Build 3] Settings: GET/PUT /settings (runtime `gemini_model`; `gemini.current_model()` reads it). Quiz: GET/POST /concepts/{id}/quiz[/generate?regenerate] · POST /concepts/{id}/quiz/result (full marks→done). Progress: POST /concepts/{id}/done · /undone · GET /courses/{id}/progress. `lesson_progress.done` LEFT-JOINed into notes + schedule rows.
- [B3FF] Tasks: GET /tasks/active (active jobs + generating quizzes, per-course; drives the global bottom-right task tray; cancel only for notes/extraction). Note gen/quiz gen prompts are sibling-aware (`sibling_names`) so per-concept output is distinct; `practice` tcolorbox is `breakable`; quizzes prefetch on lesson-open (cached, no regen); short-answer requires non-blank.
- [Build 3] Quiz flow: on-demand+cached per concept — `POST …/quiz/generate` runs `quiz_service.run_quiz_job` (bg thread) → `gemini.generate_quiz` (QuizQuestion: mcq+short × concept+pyq categories, LaTeX math, NO schema defaults) → stored `questions_json`. Frontend `#/quiz/:conceptId` (`renderQuiz`) renders one question/screen with KaTeX (CDN), MCQ auto-grade + short-answer self-check, full marks → auto-done. Gemini model switch is runtime via Settings.
- [B3FF2] Dup prevention: POST /semesters 409s a duplicate name (case-insensitive); POST /courses 409s a duplicate name or code within the same semester (cross-semester reuse allowed). Retry one note: POST /notes/{id}/retry (see Note generation below). Exam concept modal Materials tab lists study materials only (`kind==='material'`); PYQs excluded.
- [Build 4] Customized note gen (whole-batch, opt-in): `courses.note_instructions` + `note_enhancements` (JSON keys) columns (migrated); `gemini.NOTE_ENHANCEMENTS` 9-mode catalog; `_NOTE_PROMPT` has an `<<EXTRA_INSTRUCTIONS>>` block (style/memory-technique only — never invents facts). `PUT /courses/{id}/note-prefs` {instructions, enhancements[]} (drops unknown keys, caps ~2000) · `GET /note-enhancements` [{key,label}] · course prefs surface via `GET /courses/{id}` (`c.*`). Prefs thread through `generate_note_latex(...,extra_instructions,enhancement_keys)` → `_compile_one_note` → `run_generate_job`/`run_note_retry` (both read `_course_note_prefs`, so retries match the batch). Frontend: **Customize** button (`note-customize`) → `ui.formModal` (textarea + 9 checkboxes), `PUT`s prefs; header shows "Customize ✓" + active modes. Generate/retry endpoints keep empty bodies.
- [Build 4] Annotations: `note_annotations(note_id PK → notes CASCADE, data_json, updated_at)` (new table, CREATE IF NOT EXISTS). `GET /notes/{id}/annotations` → {data:[...]} (404 missing) · `PUT /notes/{id}/annotations` {data:[...]} (404 missing, 413 over ~2MB, upsert ON CONFLICT). Stored resolution-independent (normalized [0..1] page coords). See Immersive PDF reader below.
- [Build 5] Schedule catch-up: `build_schedule` is now DONE-AWARE (excludes `lesson_progress.done` concepts) + takes `cap`/`skip_weekdays`; `GET /schedule/overdue?today=` → `{count}` of past-dated undone items (non-archived). Dashboard auto-`generate-all`s once on entry when count>0 + shows a dismissible banner. Reader gained zoom (`readerState.scale`, `− NN% +`, Ctrl/Cmd +/-/0) + Ctrl/Cmd+Z→undo. Cancel: `_compile_one_note` checks cancel before compile+repair; `db._reconcile_orphans` (in `init_db`) flips orphaned `generating` notes→`failed` + stuck `running/queued` jobs→`done` on startup; frontend shows a persistent "Cancelling…" (disabled) state via `cancelingCourseId`.
- [Build 5] User profile: `user_profile(id, name, email, avatar_disk_uuid, institution, program, academic_year, daily_capacity DEFAULT 2, study_off_days JSON, ts)` (new table, seeded id=1). `routers/profile.py`: `GET/PUT /profile` (validates capacity 1–8, off_days ⊂0–6; returns `has_avatar`+`avatar_url`, never the disk uuid) · `POST/GET/DELETE /profile/avatar` (image ≤5MB → `config.AVATARS_DIR`/`storage.avatar_dir()`, served like `note_thumb`). Runtime AI key: `gemini.current_api_key()` (settings `gemini_api_key` → `.env` fallback) + `client()` rebuilds on key change (`_client_key`). `PUT /settings` now takes `gemini_model` and/or `gemini_api_key` (""=clear); `GET /settings` returns a MASKED indicator only (`key_source`, `key_last4`). `schedule.py` feeds the profile's capacity/off-days into `build_schedule`. Frontend: header avatar/name chip (`#header-user`/`renderHeaderUser`, `window.__profile` via `loadProfile`) → `#/settings`; `renderSettings` = Profile / Study preferences / AI / System sections; dashboard greeting by name. Single local user now; shaped to become a `users` row under future auth.

## Scheduling engine (Build 2, done-aware since Build 5) — `services/scheduler.py`
`build_schedule(semester_id, today=None, cap=CAP, skip_weekdays=None)` is a PURE
deterministic function (reads, returns dicts, never writes). Per exam (sorted
nearest exam_date first): window = `max(study_start,today) … exam_date−1`
(minus any `skip_weekdays`; fallback to the unfiltered range, then `[today]`, if
empty); concept i of n gets ideal day `i*days//n`, then an outward search
(0,+1,−1,+2,−2,…) finds the nearest day under `cap` (default 2) for that
(course,day) — the load map is shared across a course's exams, so two exams can't
overload a day; different courses stack on the same date. **[Build 5]** concepts
already completed (`lesson_progress.done`) are EXCLUDED, so a regenerate rolls only
the remaining/undone work forward from today (missed lessons catch up, done ones
never reschedule). Past exams and empty-concept exams contribute nothing. The
generate endpoints pass the user's profile `daily_capacity`/`study_off_days` as
`cap`/`skip_weekdays` and replace all `schedule_items` for the semester in one
transaction.

## Pipelines
### Concept extraction (step 3)  — job type 'extract'
POST /courses/{id}/generate → guard (course exists, ≥1 material, no active job) →
insert jobs row → background thread `run_extract_job`:
1. ensure_gemini_files: upload each upload to Gemini File API (wait ACTIVE), persist name/uri; reuse if still ACTIVE; returns {"material":[...],"pyq":[...]}.
2. extract_concepts(files["material"]) — STUDY MATERIALS ONLY (PYQs excluded): one generate_content call, response_schema=list[ConceptOut] (name/summary/source), retry on 429/503.
3. Replace concepts for course; ensure the single lesson exists.
4. Job → done ("Found N concepts").
UI polls GET /courses/{id}/job every 2s; renders concept cards from GET /courses/{id}/concepts.

### Note generation (step 4/5)  — job type 'generate'   [DONE]
POST /courses/{id}/notes/generate (guards: course exists, ≥1 concept, no active
job) → bg thread `run_generate_job`:
1. ensure_gemini_files (materials + PYQs).
2. Ensure lesson; delete prior notes (rows + pdf/thumb files) for a clean regen.
3. For each concept: `gemini.generate_note_latex(name, summary, material_files, pyq_files)`
   — materials labeled "STUDY MATERIALS" (only teaching source), PYQs labeled "PAST
   EXAM QUESTIONS" (practice-style only); temp 0.3, max_output_tokens 65536 (with
   MAX_TOKENS truncation check) → `latex.sanitize_body` → `latex.build_document`
   (locked preamble + \notetitle) → `latex.compile_to` (Tectonic) → move PDF →
   `latex.render_thumbnail` (pypdfium2+Pillow). notes.status compiled/failed
   (+error_message); one failure never stops the batch. sleep 2s between calls;
   job.progress advances (i+1/total).
4. Job done: "N notes ready[, M failed]".
The per-note pipeline (step 3) is factored into `_compile_one_note(course_id,
note_id, concept_name, summary, material_files, pyq_pairs, sibling_names,
job_id=None, progress_label="")` — generate → sanitize → build_document →
compile_to (+1 self-repair) → render_thumbnail → update row to compiled/failed;
`should_cancel` is wired to `job_id` (batch) or a no-op (retry). `run_generate_job`
calls it per concept; `run_note_retry(note_id)` calls it for a single note.
Serve: GET /notes/{id}/pdf (FileResponse inline), /thumb (png), /latex (debug).
**Retry one note:** POST /notes/{id}/retry (404 missing; 409 if the note is already
`generating` or a batch job is active for its course) flips the note to `generating`,
clears its error, and runs `run_note_retry` in a daemon thread (reuses
`_compile_one_note` with the concept's sibling names; a retry has no job to cancel).
Frontend: `loadStudyArea` renders Concepts + Notes sections, polls the job **and
keeps polling while ANY note is `generating`** (so a retried card flips
failed→generating→compiled with no reload); note cards show thumbnails; click →
`openPdfModal` (iframe, ESC/backdrop close); a **failed** card is a `<div>` (opens
`showNoteError` — compile log + LaTeX) with a nested **Retry** button
(`retry-note` → `retryNote`, `stopPropagation` so it doesn't open the modal).

## Key decisions
- One Gemini call per concept for notes (full token budget → detailed PDFs; backend drives the loop, no ambiguity).
- [B4FF] Note + repair calls **stream** (`generate_with_retry(stream=True)` → `generate_content_stream` reassembled by `_consume_stream`), so the per-read HTTP timeout bounds inactivity between chunks, not the whole response — long/customized notes don't `ReadTimeout`, and cancel is checked between chunks. Structured calls (concepts, quiz) stay non-streamed (they read `resp.parsed`). Client timeout 300s.
- STUDY MATERIALS are the ONLY source of concepts and note teaching content. PYQs
  are attached to note generation ONLY (never extraction), under an explicit role
  label, purely to match practice-problem style/difficulty — never a topic source.
  `ensure_gemini_files` returns {"material":[...], "pyq":[...]}. Page-slicing is a
  future optimization (page ranges stored in concepts.source_locations).
- Locked LaTeX preamble owned by backend; Gemini emits body only (never \documentclass/\usepackage/\begin{document}); forbidden macros stripped in sanitize.
- Tectonic = XeTeX-based, UTF-8 native (no inputenc/fontenc); auto-fetches packages (first compile slow, then cached).
- Files UUID-named on disk (no crashes on spaces/odd names); display names in DB; inline PDF via Content-Disposition: inline.
- Model `gemini-3.5-flash` (2.5-flash retired; 3.6 & 3.7 hit daily quota in use).
  Free-tier quota is PER-MODEL, so switching models gives a fresh daily bucket;
  override via GEMINI_MODEL. `generate_with_retry` handles transient 503/429.

## Frontend model
Single page. `route()` reads `location.hash`: dashboard (`#/` — Build-2 schedule
agenda), **courses** management (`#/courses` — semesters/course cards, moved off
the dashboard), course detail (`#/course/:id`), per-course **study view**
(`#/course/:id/study[/:noteId]`, matched first), or the cross-course **schedule
study view** (`#/study/:itemId` — dashboard lessons open this: left = upcoming
lessons by date across all courses, right = the same PDF preview→scroll→ESC pane;
`renderScheduleStudy`/`sched*`, independent `schedStudy` state). Header nav:
Axiom→dashboard, Courses→`#/courses`. Views render into `#view` via innerHTML; interactions use event
delegation on `[data-action]`. Modals/toasts from `ui.js`. Background jobs polled
with a timer (`jobPollTimer`); `route()` clears both `jobPollTimer` and the study
Escape listener (`studyRemoveEscHandler`) on every navigation.

### Study view (step 6)
`renderStudyView(courseId, noteId)` + `study*` helpers (all in `app.js`). Left
column = note list (compiled clickable, failed → `showNoteError`, generating =
spinner, active highlighted); right pane `#study-right` has two states held in
`studyState {courseId, notes, activeId}`: the right pane shows the **preview**
(page-1 thumbnail card, "Click to read"); clicking it opens the immersive reader
(below). Selecting another note re-renders the preview. Entry points: clicking a
compiled note card, or the "Study" button in the Notes section. Right pane updates
via direct DOM writes (no re-fetch per click). (The old in-pane iframe "reading"
state was retired in Build 4.)

### Immersive PDF reader — `app.js` reader module + `frontend/css/reader.css`
> ⚠️ **Superseded rendering-engine detail below.** The reader was briefly rebuilt on PDF.js's
> `PDFViewer` component (the "Rendering engine" paragraph two down describes that), but its
> **virtualization jittered on scroll**, so it was **reverted to a custom render-ALL-pages canvas
> loop** (`readerRenderAllPages`: every page's `<canvas>` rendered up front → no on-scroll render →
> no jitter; CSS-only zoom via `readerZoom`/`readerApplyZoom`; PDF.js **`TextLayer` class** per page
> for selection; `window.__pdfjs={lib}` only; NO `content-visibility`/`backdrop-filter`). See the
> **Build 5 FF** reader entries in `CLAUDE.md` for the authoritative current design. The rest of this
> section (overlay shell, navbar, annotations model, save/restore) still applies.

Replaces the plain iframe. A single **body-mounted overlay** (`openReader(note)` /
`closeReader()`, module `readerState`) shared by both study views — `studyOpenReading`
and `schedOpenReading` call `openReader`; it escapes the width-capped `#view`. A top
navbar (float-up + slide-in via `reader.css` keyframes) holds the title, an `N/total`
page indicator, zoom `− NN% +`, the annotation tools, Download (`?download=1`), and Close.
ESC/✕ and `route()` changes call `closeReader()` (tears down the viewer + doc, removes
listeners, flushes a pending annotation save). If PDF.js/CDN is unavailable → a download-
link fallback.

**Rendering engine (Build 5 FF — rebuilt on PDF.js's official viewer *components*).** The
original hand-rolled per-page canvas loop scrolled laggily and its custom text layer
jumbled, so rendering was moved to **`PDFViewer`** (`pdfjs-dist@4.6.82` ESM: `build/pdf.min.mjs`
+ `web/pdf_viewer.mjs` + `pdf_viewer.css`, bootstrapped by an inline `<script type=module>`
in `index.html` that exposes `window.__pdfjs = {lib, EventBus, PDFViewer, PDFLinkService}`;
worker `pdf.worker.min.mjs`). NOT `viewer.html` — **no sidebar/thumbnail/toolbar**; we only
use the `PDFViewer` page list in our own `#reader-scroll` (position:absolute) container,
styled to keep centered pages + rounded/shadow + transparent scrollbar. `loadReaderPdf`
builds `new PDFViewer({container, eventBus, linkService, textLayerMode:1, annotationMode:1,
removePageBorders:true})`, `pagesinit`→`currentScaleValue='page-width'`. This gives
**virtualized rendering (smooth scroll — only near-viewport pages render), a correct
selectable text layer, and native zoom** for free. `readerZoom` drives `pdfViewer.currentScale`
(0.25–4; reset='page-width'); page indicator ← `pagechanging`, zoom label ← `scalechanging`.

**Annotations (kept, re-layered).** `readerAttachOverlay` (on the `pagerendered` event)
attaches our overlay `<canvas>` (highlight/pen) + a `.reader-textlayer` (text boxes) onto
each PDF.js `.page` div and repaints from the model; re-fires on zoom re-render (create-once
then resize/repaint). Tools = Highlight, Pen, Text, Eraser, color swatches, stroke toggle,
Undo (gated by `readerState.tool`; a tool class sets the PDF `.textLayer` `pointer-events:none`
so drawing doesn't select text). Shapes stored in **normalized [0..1] page coords**, persisted
per note via `GET`/`PUT /notes/:id/annotations` — loaded on open, saved on an 800ms debounce
(`readerMarkDirty`→`readerFlushSave`), flushed on close.

## Build 6 additions (auth · sidebar · Pomodoro · incremental gen · saved prompts)

**Single-account auth** (`backend/app/auth.py`, `routers/auth.py`). The app is one user: the
`user_profile` id=1 row IS the account (`email` = login id, new `password_hash` column via
`_ADDED_COLUMNS`). `hash_password`/`verify_password` = stdlib `pbkdf2_hmac` sha256, 200k iters,
self-describing `pbkdf2_sha256$iters$salt$dk`, `hmac.compare_digest`. Sessions: new table
`sessions(token PK, created_at, expires_at)` (~30-day), `secrets.token_urlsafe(32)`;
`create_session`/`session_user`/`delete_session`. `require_auth(request)` reads the httpOnly
`axiom_session` cookie (SameSite=Lax, no Secure — local http) → 401 without a valid session.
`routers/auth.py` (mounted `/api`, NO auth dep): `GET /auth/status {registered,authenticated}`,
`POST /auth/signup|login`, `POST /auth/logout`, `GET /auth/me`. In `main.py`, **auth + health are
open; all 9 data routers get `dependencies=[Depends(require_auth)]`**; StaticFiles stays open so
the login page loads. Frontend: `api.js` sends `credentials:'same-origin'` and dispatches
`axiom:unauthorized` on 401; `app.js` gates at `boot()` on `/auth/status` → a full-screen
`#auth-screen` (signup when `!registered`, else login) until authenticated, then `enterApp()`.

**Sidebar shell** (`index.html`). The old top-right `<header>` is gone; the body is a flex row —
`<aside id="sidebar" w-60 sticky>` (Axiom wordmark → home; nav buttons Home/Courses/Pomodoro/
Settings, each `data-action`+`data-nav`; a spacer; bottom `#health-pill` + `#sidebar-user` chip +
logout) + a `flex-1` column holding the unchanged `<main id="view" max-w-5xl>`. `app.js`
`renderSidebarUser()` fills the chip; `updateSidebarActive()` (called from `route()`) toggles
`.active` on the current section's `[data-nav]`.

**Pomodoro** (`app.js`, frontend-only, `localStorage`). Module `pomodoro` = `{startedAt,
durationSec, paused, pausedRemainingSec, label}` (key `axiom_pomodoro`; remaining derived from
`startedAt` so it survives reload); a single 1s `pomodoroTick`; prefs in `axiom_pomodoro_prefs`
(default duration + chime). Surfaces: a bottom-center `#pomodoro-tray` (`z-[60]`, above the reader),
a `#reader-pomodoro` navbar button (live MM:SS), and setup/manage popups (`ui.mountOverlay`).
Web-Audio chime is best-effort. `initPomodoro()` runs in `enterApp()`.

**Incremental note generation.** `materials.analyzed` (default 0; `_ADDED_COLUMNS` + a one-time
backfill in `_ensure_columns` marking materials in courses that already have concepts). Both job
bodies take `mode='new'|'all'`: `run_extract_job` — `new` extracts only `analyzed=0` materials and
**appends** concepts (order_index continues, dedupe by case-insensitive name), marks them analyzed;
`all` = old wipe-and-rebuild. `run_generate_job` — `new` generates notes only for concepts with no
note row (existing notes kept); `all` = old wipe-and-regenerate. `ensure_gemini_files(...,
only_material_ids=)` restricts the material set. Endpoints `POST /courses/:id/generate` and
`/notes/generate` take `?mode=new|all` (default new; 400 when nothing is new). Frontend: the
Concepts/Notes headers offer "Analyze new materials"/"Generate new notes" (primary) + confirmed
"Re-analyze all"/"Regenerate all".

**Saved Prompts** (`routers/prompts.py`). New table `saved_prompts(id,name,instruction,created_at)`;
the global "apply to all" pointer is a `settings` key `active_prompt_id`. `GET/POST /saved-prompts`,
`PUT /saved-prompts/active` (registered BEFORE `PUT /saved-prompts/{id}` — Starlette matches in
order), `PUT/DELETE /saved-prompts/{id}`. `generation_service._effective_note_prefs(course_id)`
merges the active prompt's instruction with the course's own `note_instructions` (replaces the two
`_course_note_prefs` call sites; enhancements stay per-course). Frontend: a Settings **Saved Prompts**
section (CRUD + apply-to-all badge), a picker + active-prompt banner in `noteCustomizeModal`, and an
"Instruction applied to all notes: <name>" indicator in the Notes section.

## Build 7 — "Axiom Sugar" redesign · dark mode · auth UX · smoothness

Full visual redesign (Pixel/Material-You-*inspired*, our own palette), motion-rich, minimal, with
first-class dark mode. **Design source of truth: `frontend/DESIGN.md`.**

**Token system + theming (`frontend/css/theme.css`, first non-reader CSS).** All color/radius/shadow/
motion are CSS custom properties on `:root`, overridden on `:root.dark`. `index.html`'s Tailwind config
(Play CDN) sets `darkMode:'class'` and **remaps the palette to the vars** — `white`/`neutral-*`/`red`/
`amber`/`emerald`/`ink`/`paper` + accents → `var(--…)` — so the app's existing utility classes theme
automatically (near-zero markup churn) and flip under `.dark`. A synchronous **no-flash** head script
reads `localStorage.axiom_theme` (`system|light|dark`) and toggles `<html>.dark` before paint; `app.js`
`applyTheme/setTheme/getTheme/renderThemeToggle` + a `prefers-color-scheme` listener drive the sidebar
`#theme-toggle`. Component classes in `theme.css` (`.btn*`, `.icon-btn`, `.card`/`.card-interactive`,
`.field-input`, `.chip`+accents, `.dot`, `.nav-item`, `.modal-card`, `.toggle`, `rise`/`fadeSwap`
keyframes, `prefers-reduced-motion` off-switch); the shared `app.js` helpers point at them (`inputCls`→
`field-input`, `btnPrimary/Secondary`→`btn …`), so restyling cascades everywhere. `reader.css` retargeted
to the same tokens (themes in dark). Accent signifiers cycle a 5-hue set (mint/peach/sky/lilac/lemon) by
course/index; grape `--primary` = CTAs, active nav, links.

**Layering contract (`z-index`):** reader overlay `55` < modals (`ui.mountOverlay`) `60` < auth gate `70`
< toasts `80`. Raising modals to `z-[60]` fixed the "modal opens behind the reader" bug (the reader
Pomodoro button now works while reading).

**Auth UX.** `user_profile` gained `security_question` + `security_answer_hash` (via `_ADDED_COLUMNS`,
answer pbkdf2-hashed like the password). `POST /auth/signup` now collects the security Q/A and
**overwrites** the single account (re-registration; study data kept, sessions cleared); new open
endpoints `POST /auth/security-question {email}` → the question, and `POST /auth/reset {email,
security_answer, new_password}` (answer-gated, case-insensitive/trimmed) → new password + session. The
auth screen (`app.js`) is a redesigned candy card with three modes — **signup** (security-Q select +
answer), **login** ("Forgot password?" + "Create new account" links), **forgot** (2-step reset) — over a
**cursor-reactive animated background** (accent blobs eased toward the pointer via RAF; static under
reduced-motion; **auth-only**, mounted by `showAuthGate`, torn down in `enterApp`). Re-registration is
confirmed via a modal.

**Smoothness (no full-view re-renders).** Dashboard List⇄Calendar (and calendar nav / horizon /
regenerate) swap only an inner `#dash-content` (`renderDashContent()`/`setDashboardView()` + `fadeSwap`),
keeping the header/toggle fixed — no scroll-jump. Settings Saved-Prompt add/edit/delete/activate patch
only `#sp-section` (`renderSavedPromptsSection()`) instead of `renderSettings()` — scroll preserved. Quiz
options are tactile buttons with a candy progress bar; clickable cards/rows use `.card-interactive`;
`.badge-brand` keeps the sidebar wordmark + avatar-initials a solid grape badge in both themes.

## Build 7 round-3 — provider-agnostic AI layer

The AI integration is no longer Gemini-only. **`backend/app/services/ai/`** is a small provider
abstraction: `base.py` (an `Attachment` file descriptor, the `AIProvider` ABC, the shared prompts +
`ConceptOut`/`QuizQuestion` + `NOTE_ENHANCEMENTS`, prompt-text builders, file helpers incl.
`pdf_to_text` via pypdfium2, `parse_json_list`, `retry_call`, `AICancelled`); `gemini_provider.py`
(the original Gemini logic — File-API upload/cache, `response_schema` structured calls, streamed notes
with the non-APIError retry + non-stream fallback — behavior unchanged); `openai_provider.py` (serves
both real **OpenAI** and a **custom** OpenAI-compatible endpoint via `base_url` — OpenRouter / DeepSeek /
Qwen / local; images+PDF as base64, PDFs→text for custom/on-failure, `response_format=json_object`+parse,
streamed notes); `anthropic_provider.py` (**Claude** — base64 image/document blocks, JSON-by-prompt+parse,
`messages.stream`); and `__init__.py`, the settings-driven **dispatcher** exposing `current_provider`,
`current_key/current_model/base_url/available_models`, and the four operations. Settings keys:
`ai_provider`, `ai_key__<p>`, `ai_model__<p>`, `ai_base_url` — **except gemini**, which keeps the legacy
`gemini_api_key`/`gemini_model` (back-compat). **`services/gemini.py` is now a thin shim** re-exporting the
dispatcher (`GeminiCancelled = AICancelled`), so the many `gemini.X` call sites are untouched.
`generation_service`/`quiz_service` gather **`Attachment`s** (`gather_course_attachments`, no upload — the
Gemini adapter uploads lazily) and pass them to the passthroughs. `routers/settings.py` is provider-aware
(GET/PUT over `{provider, api_key, model, base_url}`, per-provider masked key, free-text model);
`routers/health.py` checks the active provider's key (`/health` field `ai_key`). The Settings **AI**
section (a Provider select + free-text Model + Base URL for custom + masked key) drives it. Default stays
Gemini; `openai`/`anthropic` SDKs are lazy-imported.
