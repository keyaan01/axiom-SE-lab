"""Gemini adapter: implements AIProvider on top of the google-genai SDK.

Moved (unchanged in behavior) from the old services/gemini.py: the client
lifecycle, streaming/retry machinery, File-API upload/cache, and the four
generation calls. This phase only relocates the code behind the AIProvider
seam — same prompts, same streaming+retry robustness, same File-API caching,
same structured response_schema calls, same cancellation.
"""
import json
import time

from google import genai
from google.genai import types, errors

from ... import config, db
from .base import (
    AIProvider,
    Attachment,
    ConceptOut,
    QuizQuestion,
    AICancelled,
    NOTE_MAX_TOKENS,
    _RETRYABLE,
    concept_prompt_text,
    note_prompt_text,
    extra_instructions_block,
    quiz_prompt_text,
    repair_prompt_text,
    parse_data_url,
)

# Fast, free-tier friendly, reads PDFs and images natively. Configurable via
# GEMINI_MODEL in .env so a retired model can be swapped without code changes.
# This is the startup/fallback default; the model actually used per-call comes
# from current_model() below, which can be changed at runtime from Settings.
MODEL = config.GEMINI_MODEL

# Owner/testing tool (Build 3, Step 1): models selectable at runtime from the
# Settings screen. Free-tier quota is per-model, so switching gives a fresh
# daily bucket without touching .env or restarting the server.
AVAILABLE_MODELS = ["gemini-3.5-flash", "gemini-3.6-flash", "gemini-3.7-flash"]


def current_model() -> str:
    """The Gemini model to use for this call: the runtime override stored in
    the settings table if set and still valid, else config.GEMINI_MODEL.

    Wrapped so any DB hiccup (locked file, missing table on a very old DB,
    etc.) falls back to the startup default instead of breaking generation.
    """
    try:
        conn = db.get_connection()
        try:
            row = conn.execute(
                "SELECT value FROM settings WHERE key = 'gemini_model'"
            ).fetchone()
        finally:
            conn.close()
        if row and row["value"] in AVAILABLE_MODELS:
            return row["value"]
    except Exception:
        pass
    return config.GEMINI_MODEL


def current_api_key() -> str:
    """The Gemini API key to use for this call: the runtime override stored in
    the settings table if set and non-empty, else config.GEMINI_API_KEY (from
    backend/.env), else "" if neither is set (Build 5, Step 5 — lets a user
    store their own key at runtime without a restart).

    Wrapped in the same defensive try/except pattern as current_model() so any
    DB hiccup (locked file, missing table on a very old DB, etc.) falls back to
    the .env key instead of breaking generation.
    """
    try:
        conn = db.get_connection()
        try:
            row = conn.execute(
                "SELECT value FROM settings WHERE key = 'gemini_api_key'"
            ).fetchone()
        finally:
            conn.close()
        if row and row["value"]:
            return row["value"]
    except Exception:
        pass
    return config.GEMINI_API_KEY or ""


_client = None
# The API key _client was built with, so client() can detect a runtime key
# change (Build 5, Step 5) and rebuild instead of silently keeping stale auth.
_client_key = None

# Per-request HTTP timeout (milliseconds) so a single hung/overloaded Gemini
# call can't block a job forever — this is what makes Cancel effective on a
# stuck call: it bounds the worst case instead of hanging indefinitely.
# NOTE: for the streamed calls (notes, repair — see generate_with_retry's
# stream=True path) this is effectively a per-read INACTIVITY timeout between
# chunks, not a cap on the whole response, so a long-but-progressing generation
# (e.g. a heavily customized note) no longer trips it. It still bounds the
# non-streamed structured calls (concept extraction, quiz) end-to-end.
_REQUEST_TIMEOUT_MS = 300000


def client() -> genai.Client:
    """The shared genai.Client, rebuilt whenever the effective API key changes.

    current_api_key() checks the runtime settings override first, so a user
    who sets/changes their key from Settings sees it take effect on the very
    next call — no server restart, and no stale client holding an old key.
    """
    global _client, _client_key
    key = current_api_key()
    if not key:
        raise RuntimeError("No Gemini API key set (add one in Settings or backend/.env).")
    if _client is None or _client_key != key:
        _client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(timeout=_REQUEST_TIMEOUT_MS),
        )
        _client_key = key
    return _client


def state_of(f) -> str:
    s = getattr(f, "state", None)
    if s is None:
        return "UNKNOWN"
    return getattr(s, "name", str(s))


def get_file(name: str):
    return client().files.get(name=name)


def delete_file(name: str) -> None:
    try:
        client().files.delete(name=name)
    except Exception:
        pass  # best-effort


def upload_and_activate(path, mime_type: str, display_name: str, timeout: int = 180):
    """Upload a local file to the Gemini File API and wait until it is ACTIVE.

    PDFs briefly sit in PROCESSING; we poll until ready (or FAILED/timeout).
    """
    c = client()
    f = c.files.upload(
        file=str(path),
        config=types.UploadFileConfig(mime_type=mime_type, display_name=display_name),
    )
    waited = 0
    while state_of(f) == "PROCESSING" and waited < timeout:
        time.sleep(2)
        waited += 2
        f = c.files.get(name=f.name)
    if state_of(f) != "ACTIVE":
        raise RuntimeError(
            f"Gemini could not process '{display_name}' (state={state_of(f)}, "
            f"error={getattr(f, 'error', None)})."
        )
    return f


def _ensure_uploaded(att: Attachment):
    """Return an ACTIVE Gemini File object for this Attachment.

    Reuses att.gemini_file_name if the Gemini file is still ACTIVE; otherwise
    (re-)uploads att.disk_path via the File API and persists the new
    gemini_file_name (and uri/expiry) back onto the materials row keyed by
    att.material_id. This is the upload body that used to live inline in
    generation_service's old ensure_gemini_files (now gather_course_attachments,
    which no longer uploads), just keyed off an Attachment instead of a raw
    DB row. Gemini files expire (~48h), so this also transparently handles
    expiry.
    """
    f = None
    if att.gemini_file_name:
        try:
            f = get_file(att.gemini_file_name)
            if state_of(f) != "ACTIVE":
                f = None
        except Exception:
            f = None
    if f is None:
        f = upload_and_activate(att.disk_path, att.mime, att.display_name)
        conn = db.get_connection()
        try:
            conn.execute(
                "UPDATE materials SET gemini_file_uri = ?, gemini_file_name = ?, gemini_expiry = ? WHERE id = ?",
                (f.uri, f.name, str(getattr(f, "expiration_time", "") or ""), att.material_id),
            )
            conn.commit()
        finally:
            conn.close()
        att.gemini_file_name = f.name
    return f


class _StreamedResponse:
    """Minimal stand-in for a GenerateContentResponse reassembled from a stream.

    Exposes only what the streaming callers read: `.text` (all streamed text
    concatenated) and `.candidates` (from the final chunk, so `_finish_reason`
    keeps working). `.parsed` is always None — streaming is used only for the
    free-form text calls (notes, repair), which read `.text`; the structured
    calls (concepts, quiz) stay non-streamed and use `.parsed`.
    """
    def __init__(self, text, candidates):
        self.text = text
        self.candidates = candidates or []
        self.parsed = None


def _chunk_text(chunk) -> str:
    """Text delta of one stream chunk, tolerant of chunks that carry no text."""
    try:
        return chunk.text or ""
    except Exception:
        return ""


def _consume_stream(stream, should_cancel) -> "_StreamedResponse":
    """Drain a generate_content_stream, concatenating text and checking
    should_cancel BETWEEN chunks.

    This is what fixes long-generation read timeouts: because bytes arrive
    chunk-by-chunk, the HTTP read timeout bounds inactivity between chunks
    instead of the whole response, so a long-but-progressing note keeps the
    connection alive. Cancellation is also honoured mid-generation (not just
    between whole retries) since we can stop iterating.
    """
    parts = []
    last = None
    for chunk in stream:
        if should_cancel and should_cancel():
            try:
                stream.close()
            except Exception:
                pass
            raise AICancelled()
        last = chunk
        parts.append(_chunk_text(chunk))
    return _StreamedResponse("".join(parts), getattr(last, "candidates", None))


def generate_with_retry(contents, gen_config, attempts: int = 4, should_cancel=None,
                        stream: bool = False):
    """Call generate_content, retrying transient overload/rate-limit errors.

    should_cancel, if given, is a zero-arg callable returning True once the
    caller's job has been cancelled. It is checked at the top of every attempt
    and again right before each retry sleep, so a cancellation request takes
    effect between attempts. With stream=True it is ALSO checked between chunks
    (see _consume_stream), so an in-flight streamed generation is interruptible.

    stream=True streams the response and reassembles it (into a _StreamedResponse
    exposing .text/.candidates). Use it for the free-form text calls (notes,
    repair) so the per-read HTTP timeout applies to inactivity between chunks
    rather than the whole response — long, heavily-customized notes then don't
    trip the request timeout. The structured calls (concepts, quiz) stay
    non-streamed so resp.parsed keeps working.
    """
    delay = 2
    last = None
    for i in range(attempts):
        if should_cancel and should_cancel():
            raise AICancelled()
        try:
            if stream:
                try:
                    s = client().models.generate_content_stream(
                        model=current_model(), contents=contents, config=gen_config
                    )
                    return _consume_stream(s, should_cancel)
                except (AICancelled, errors.APIError):
                    raise
                except Exception as e:
                    # A streamed response can die mid-parse — a malformed/partial SSE
                    # chunk makes the SDK raise json.JSONDecodeError, or the socket
                    # drops. These are transient and are NOT APIErrors, so without
                    # this they'd fail the note with a raw "JSONDecodeError…". Treat
                    # them as retryable; on the final attempt fall back to a single
                    # NON-streamed call, which parses the whole response at once and
                    # sidesteps the streaming parser entirely.
                    last = e
                    if i < attempts - 1:
                        if should_cancel and should_cancel():
                            raise AICancelled()
                        time.sleep(delay)
                        delay = min(delay * 2, 20)
                        continue
                    return client().models.generate_content(
                        model=current_model(), contents=contents, config=gen_config
                    )
            return client().models.generate_content(
                model=current_model(), contents=contents, config=gen_config
            )
        except errors.APIError as e:
            code = getattr(e, "code", None)
            last = e
            if code in _RETRYABLE and i < attempts - 1:
                if should_cancel and should_cancel():
                    raise AICancelled()
                time.sleep(delay)
                delay = min(delay * 2, 20)
                continue
            raise
    raise last  # pragma: no cover


def _finish_reason(resp) -> str:
    try:
        fr = resp.candidates[0].finish_reason
        return getattr(fr, "name", str(fr))
    except Exception:
        return ""


class GeminiProvider(AIProvider):
    """AIProvider implementation backed by the google-genai SDK."""

    def extract_concepts(self, materials: list[Attachment], should_cancel=None) -> list[ConceptOut]:
        """Ask Gemini for the concept list, as validated JSON.

        materials must contain ONLY study-material Attachments (never PYQ/exam
        files) — concepts are drawn strictly from what is attached here. Each
        file is preceded by its display name so the model can report which
        file a concept mainly comes from (ConceptOut.source_file).

        should_cancel, if given, is passed through to generate_with_retry so a
        cancellation request can interrupt the retry loop (see AICancelled).
        """
        contents = []
        for att in materials:
            contents.append(f"STUDY MATERIAL FILE — {att.display_name}:")
            contents.append(_ensure_uploaded(att))
        contents.append(concept_prompt_text())
        resp = generate_with_retry(
            contents,
            types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[ConceptOut],
                temperature=0.2,
            ),
            should_cancel=should_cancel,
        )
        data = resp.parsed
        if not data:
            # Fallback: parse the raw JSON text ourselves.
            raw = (resp.text or "").strip()
            if not raw:
                raise RuntimeError("Gemini returned an empty response.")
            data = [ConceptOut(**d) for d in json.loads(raw)]
        return list(data)

    def generate_note_latex(self, name: str, summary: str, materials: list[Attachment],
                             pyqs: list[Attachment], sibling_names=None,
                             extra_instructions: str = "", enhancement_keys=None,
                             should_cancel=None) -> str:
        """Generate the LaTeX body of a single concept's note (teaching + practice).

        materials are the ONLY source of teaching content. pyqs (may be empty)
        are the course's past-exam-question Attachments: the model is asked to
        find the real question(s) that test this concept, reproduce + solve
        them, and cite the source file by its display_name — never to source
        new teaching topics. sibling_names (may be empty/None) lists the
        course's OTHER concept names, so the model stays narrowly focused on
        THIS concept instead of re-teaching shared background that the sibling
        concepts' own notes already cover. extra_instructions (optional free
        text) and enhancement_keys (optional list of NOTE_ENHANCEMENTS keys)
        are the student's per-course note-customization preferences (Build 4,
        Step 1) — folded into the EXTRA INSTRUCTIONS section of the prompt,
        never allowed to introduce new topics/facts. should_cancel, if given,
        is passed through to generate_with_retry so a cancellation request can
        interrupt the retry loop (see AICancelled).
        """
        pyq_names = ", ".join(p.display_name for p in pyqs) if pyqs else "none"
        siblings = ", ".join(sibling_names) if sibling_names else "none"
        extra_block = extra_instructions_block(extra_instructions, enhancement_keys)
        prompt = note_prompt_text(name, summary, pyq_names, siblings, extra_block)
        contents = ["STUDY MATERIALS — the ONLY source of teaching content for this note:"]
        contents += [_ensure_uploaded(att) for att in materials]
        if pyqs:
            contents += ["PAST EXAM QUESTIONS (reproduce the real questions that test this concept and cite them):"]
            for att in pyqs:
                contents += [f"PAST EXAM FILE — {att.display_name}:", _ensure_uploaded(att)]
        contents += [prompt]
        resp = generate_with_retry(
            contents,
            types.GenerateContentConfig(temperature=0.3, max_output_tokens=NOTE_MAX_TOKENS),
            should_cancel=should_cancel,
            stream=True,
        )
        text = (resp.text or "").strip()
        if _finish_reason(resp) == "MAX_TOKENS":
            raise RuntimeError("Note output was truncated (too long). Try regenerating.")
        if not text:
            raise RuntimeError("Gemini returned an empty note.")
        return text

    def repair_note_latex(self, name: str, broken_body: str, error: str, should_cancel=None) -> str:
        """Ask the model to fix a note body that failed to compile, given the error.

        should_cancel, if given, is passed through to generate_with_retry so a
        cancellation request can interrupt the retry loop / mid-stream repair
        call (see AICancelled) instead of only being noticed after it returns.
        """
        prompt = repair_prompt_text(name, error, broken_body)
        resp = generate_with_retry(
            [prompt],
            types.GenerateContentConfig(temperature=0.1, max_output_tokens=NOTE_MAX_TOKENS),
            should_cancel=should_cancel,
            stream=True,
        )
        text = (resp.text or "").strip()
        if not text:
            raise RuntimeError("Repair produced an empty note.")
        return text

    def generate_quiz(self, name: str, summary: str, materials: list[Attachment],
                       pyqs: list[Attachment], sibling_names=None, should_cancel=None) -> list[QuizQuestion]:
        """Ask Gemini for a quiz (concept-understanding + PYQ-style questions) for one concept.

        materials and pyqs are Attachment lists — materials are the source of
        truth for the concept, PYQs (may be empty) shape the "pyq" category's
        style/content. sibling_names (may be empty/None) lists the course's
        OTHER concept names, so questions stay specific to THIS concept
        instead of generic ones that would fit any sibling concept just as
        well.
        """
        contents = ["STUDY MATERIALS (source of truth for the concept):"]
        for att in materials:
            contents.append(f"STUDY MATERIAL FILE — {att.display_name}:")
            contents.append(_ensure_uploaded(att))
        if pyqs:
            contents.append("PAST EXAM QUESTIONS (base the PYQ-style questions on these):")
            for att in pyqs:
                contents.append(f"PAST EXAM FILE — {att.display_name}:")
                contents.append(_ensure_uploaded(att))
        siblings = ", ".join(sibling_names) if sibling_names else "none"
        prompt = quiz_prompt_text(name, summary, siblings)
        contents.append(prompt)
        resp = generate_with_retry(
            contents,
            types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=list[QuizQuestion],
                temperature=0.3,
                max_output_tokens=NOTE_MAX_TOKENS,
            ),
            should_cancel=should_cancel,
        )
        data = resp.parsed
        if not data:
            raw = (resp.text or "").strip()
            if not raw:
                raise RuntimeError("Gemini returned an empty quiz.")
            data = [QuizQuestion(**d) for d in json.loads(raw)]
        if not data:
            raise RuntimeError("Gemini returned an empty quiz.")
        return list(data)

    def stream_answer(self, system: str, user: str, image: str | None = None, should_cancel=None):
        """Stream a study-assistant answer (Phase A of the "ask AI" feature).

        Reuses the same generate_content_stream + should_cancel-between-chunks
        mechanism as generate_note_latex's streaming path (see _consume_stream
        above), but yields each chunk's text immediately instead of
        reassembling the whole response first, so the caller can relay it to
        the client as it arrives. The system prompt goes through Gemini's
        native system_instruction config field (unlike the note/quiz/concept
        prompts, which are inlined into `contents` — those predate this and
        are left unchanged). An optional image crop is attached as an inline
        Part built from the decoded data: URL bytes (no File API upload needed
        for a single small crop).
        """
        contents = []
        if image:
            mime, b64 = parse_data_url(image)
            import base64
            contents.append(types.Part.from_bytes(data=base64.b64decode(b64), mime_type=mime))
        contents.append(user)
        cfg = types.GenerateContentConfig(
            system_instruction=system, temperature=0.4, max_output_tokens=NOTE_MAX_TOKENS,
        )
        stream = client().models.generate_content_stream(
            model=current_model(), contents=contents, config=cfg,
        )
        try:
            for chunk in stream:
                if should_cancel and should_cancel():
                    raise AICancelled()
                text = _chunk_text(chunk)
                if text:
                    yield text
        finally:
            try:
                stream.close()
            except Exception:
                pass
