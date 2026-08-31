# Axiom — BACKLOG.md

Things intentionally **deferred, not implemented, or only partially handled** in
the current build. This is the "don't forget" list. **Update after every task:**
when you defer something or knowingly leave an edge case, add it here; when you
implement it, remove it (or move it to done in CLAUDE.md).

Last updated: after Build 7 round-3 (multi-provider AI: Gemini/OpenAI/Anthropic/
custom, plus auth-bg + PYQ-citation fixes).

## Build 7 round-3 — deferred / future (multi-provider AI)
- **Non-Gemini providers not exercised against a real API.** OpenAI/Anthropic/custom adapters were
  verified with dummy keys + stubbed SDK calls only. Confirm a real end-to-end run (concepts → notes →
  quiz) with a real key per provider; watch for model-specific `max_tokens`/format quirks.
- **Non-Gemini file limits.** Those providers inline files as base64 (per-provider size/page caps, unlike
  Gemini's File API); PDFs on a *custom* endpoint (or on any file-rejection) fall back to `pypdfium2` text
  extraction, which loses diagrams/figures/handwriting. No chunking/splitting of oversized PDFs.
- **Structured output is json_object/prompt+parse** for non-Gemini (breadth over strictness) rather than
  native json_schema (OpenAI) / tool-use (Anthropic). Could tighten per provider.
- **No token/cost display** and no automatic model discovery (models are a free-text field + suggestions).
- Pinned `openai`/`anthropic` SDK versions in `requirements.txt` — the adapters introspect the installed
  shapes; a major SDK bump may need adapter tweaks.

## Build 7 — deferred / future
- **Password *change* while logged in.** Reset exists (security-question flow); an in-app
  "change password" (+ change the security question) from Settings is not built yet.
- **Mobile / responsive sidebar + layout.** The redesign targets desktop; the `w-60`
  sidebar is always expanded (no hamburger/collapse), and screens aren't tuned for small
  widths.
- **Live-paint verification gap.** The animated auth background (canvas/RAF) and the reader's
  canvas paint aren't pixel-verifiable in the hidden in-app browser tab (RAF/`:focus` don't
  fire when `document.hidden`); mechanisms + computed styles were verified. Confirm the auth
  background motion + reader visuals in a real browser.
- **Opacity-modified tokenized utilities** (e.g. `bg-white/90`, `bg-neutral-50/60`) lose their
  alpha under the var-based Tailwind palette remap (accepted tradeoff for near-zero-churn
  theming). If a specific translucent surface matters, give it an explicit token/rule.
- **Accent theming is light+dark only.** No user-selectable accent/theme presets beyond the
  fixed grape primary + 5-hue signifier set.

## Build 6 — deferred / future
- **Auth is single-account + local, not hardened.** stdlib pbkdf2 (200k iters) +
  opaque DB session tokens in an httpOnly `axiom_session` cookie (SameSite=Lax, no
  Secure — local http). NOT for public multi-tenant use. Deferred: real multi-user
  accounts (scope every table by `user_id`); bcrypt/argon2; HTTPS-only Secure cookie;
  login rate-limiting / lockout; password **reset** and **change**; email verification;
  CSRF hardening beyond SameSite. `password_hash` lives on the `user_profile` id=1 row.
- **Pomodoro is frontend-only** (`localStorage`): no backend, no cross-device sync, no
  work/break cycle automation, no session history/stats. A timer is per-browser.
- **Incremental gen dedupes concepts by exact (case-insensitive) name.** Two genuinely
  different concepts a model happens to name identically would collapse; renaming a
  material's concept then re-analyzing "new" adds it as a fresh concept (old one stays).
  No per-material re-analyze (it's whole-course, `analyzed=0` materials only).
- **Saved Prompts are global** (single user) and apply-to-all is one active prompt merged
  with the per-course instruction. Deferred: per-saved-prompt enhancement presets;
  folders/tags; per-course default prompt; ordering.
- **Mobile / responsive sidebar** not tuned — the `w-60` sidebar is always expanded, no
  collapse/hamburger for small screens.

## Build 5 — deferred / future
- **Login / registration / auth (the big one).** Everything is a single local user.
  `user_profile` is one row (id=1), shaped to become a `users` row: add
  `password_hash`, `email UNIQUE`, sessions, and scope every table by `user_id`.
- **API key at rest.** The user's Gemini key is stored PLAINTEXT in the local
  `settings` table (fine for a single-user local app). Encrypt + make per-user when
  auth lands. Never exposed to the frontend beyond a masked last-4.
- **Done lessons drop from the forward plan.** Done-aware scheduling excludes
  completed concepts, so a lesson fades from the agenda after the next rebalance
  (still shown struck-through until then; still recorded in `lesson_progress`).
  Revisit if a persistent "completed on <date>" history view is wanted.
- **Catch-up trigger is app-open only.** Rollover happens on a fresh dashboard
  entry; a session left open across midnight won't roll forward until reload.
- ~~Dark mode / theming~~ **DONE in Build 7** (CSS-var token system + `.dark` class +
  system/light/dark toggle with no-flash boot).
- **Study prefs are capacity + weekday-offs only.** No per-day hour budgets,
  specific unavailable dates, or timezone-aware scheduling yet.
- **Reader** renders all pages up front (fine for notes; could lazily/virtually
  render pages for very long PDFs). Zoom is now CSS-only (no re-render); zoom-in past
  the base bitmap resolution softens slightly (could re-render sharper on a debounce
  when zoomed in a lot), and scroll-position isn't re-anchored across a zoom step.

## Build 4 — deferred / future
- **Per-concept note instructions.** Customization is whole-batch (one set of
  choices per course, applied to every concept's note + retries). A per-concept
  instruction (a list with a box each) is deferred.
- ~~Export a PDF with annotations baked in~~ **DONE in Build 7** — the reader's Download
  button composites each page's bitmap + annotation canvas + text notes and builds a PDF
  via jsPDF (`readerDownloadAnnotated`); an unannotated note still downloads the clean
  vector original. (The annotated export is a raster snapshot; text isn't selectable in it.)
- **More annotation types** beyond highlight/pen/text/eraser (shapes, arrows,
  sticky notes), plus redo (only single-level Undo today) and per-annotation
  move/resize after commit.
- **Reader live-render not pixel-verified in-harness.** The in-app browser tab runs
  hidden (`document.hidden=true`), which stalls rAF + multi-page PDF.js render, so
  the float-up animation and canvas drawing were logic/console-verified, not
  pixel-verified. Confirm in a real browser; watch for perf on very long PDFs
  (all pages render up front — lazy/virtualized rendering is a future option).
- **Custom instruction is model-guided, not enforced.** The prompt injects the
  instruction + enhancement lines and guards against inventing facts, but whether
  Gemini fully applies a technique is model behavior (the injection itself is
  verified). No per-note toggle to preview the effect before generating.
- **Mobile/touch tuning** for the reader (pointer events work; not tuned for touch).

## Build 3 — deferred / future
- **Quiz attempt history + the testing→scheduling loop**: store per-attempt results and
  let wrong/weak concepts raise their schedule priority (the doc's core adaptive loop).
- **AI-graded short answers** (currently self-check reveal).
- **Per-question analytics / review** (which questions missed, review-just-those).
- **Timed quizzes / difficulty selection / question-count control** in Settings.
- **Settings**: currently owner-only model switch; will grow (study prefs, etc.).

## Build 2 — deferred / future
- **Quiz-after-lesson**: "Start quiz" from a lesson/note, graded from PYQs; wrong
  answers feed back into schedule priority (the doc's testing↔studying loop).
- **AI schedule rebalance**: optional Gemini pass to reflow/explain the plan on
  top of the deterministic scheduler (kept out for quota + determinism reasons).
- **Even-spacing refinement**: scheduler currently spreads via `i*days//n` +
  outward cap search; could evenly space across the whole window / add
  weekend-skip or per-day-hours preferences (needs per-concept time estimates).
- **Schedule concepts not tied to any exam** (currently only exam-ticked concepts
  are scheduled).
- **Step 6 (Build 2) light polish**: guiding empty states + "generate notes first"
  hints + consistency pass — pending user feedback on the full flow.

---

## Deferred features (planned, just not now)
- **PPTX / DOCX uploads.** Only PDF + images are accepted (Gemini-native). Office
  files need conversion to PDF first (LibreOffice headless: `soffice --headless
  --convert-to pdf`). Decide where to run it and add it to the upload path.
  Update the accept list, the "Allowed: …" error, and the frontend `accept=`.
- **Targeted page-mapping / page-slicing.** We attach ALL of a course's files to
  every concept call. `concepts.source_locations` already stores where each
  concept came from — use it later to send only relevant pages and cut tokens.
- ~~Design pass (Step 7)~~ **DONE in Build 7** — full "Axiom Sugar" redesign + dark mode
  across all screens (`frontend/DESIGN.md` + `theme.css`).

## Out of scope for this build (from the project doc — future builds)
- Quiz generation, exam creation + per-concept "will this be on the exam?" ticking.
- Exam-date scheduling / lesson sequencing by date (all notes live in ONE lesson).
- ~~Add/remove materials after generation as an incremental update~~ **DONE in Build 6
  Step 5** (default "new" mode appends concepts/notes for new materials; "all" rebuilds).
- Global search (FTS5 tables not created yet).
- ~~Auth / login~~ **single-account auth DONE in Build 6** (multi-user still deferred —
  see Build 6 section). CORS is still wide open (same-origin cookie flow doesn't need it).
- ~~Pomodoro timer~~ **DONE in Build 6 Step 4.** Whiteboard, Electron/React desktop shell
  still future.

## Known limitations & edge cases NOT fully handled
- **Free-tier quota is shared + finite.** The API key in `.env` is the user's;
  every generate consumes it. Per-minute 429s are retried with backoff; daily
  quota exhaustion fails the affected note visibly (`RESOURCE_EXHAUSTED`). No
  queuing/scheduling around daily limits, no cost display.
- **LaTeX self-repair is a single attempt.** Notes with hard-to-fix output (odd
  constructs, references to figures/images that don't exist, deeply unbalanced
  environments) can still end as `failed` after the one repair pass.
- **Corrupt / unreadable uploads.** A file that passes the extension check but
  isn't a real PDF/image causes Gemini `400 INVALID_ARGUMENT` for the whole
  extraction batch. It fails visibly but we don't pre-validate file contents or
  point at which file was bad.
- **Gemini File API expiry (~48h).** Handled by re-uploading on demand, but there
  is no proactive refresh or cleanup of stale Gemini files.
- **Concurrency across courses.** One job per course is enforced; multiple
  courses can run jobs at once, each spawning threads + Gemini calls (could trip
  rate limits). No global job queue.
- **Thumbnails are page-1 only**; multi-page notes show just the first page.
- **No automated test suite.** Verification is manual (import check + curl +
  browser driving). No pytest/CI.
- **Mobile / small-screen layout** is not specifically tuned yet.
- **Very large courses** (many concepts) generate sequentially and can take a
  while; there's a 2s pause between concepts by design.

## Nice-to-haves noticed along the way
- Show which PYQ a practice set was modeled on.
- A visible token/quota usage indicator.
- Cache warm-up note: first-ever Tectonic compile fetches packages (slow once).
