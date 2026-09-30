"""OpenAI adapter: implements AIProvider on top of the OpenAI SDK's Chat
Completions API.

Also serves the "custom" OpenAI-compatible provider (name="custom") for
arbitrary compatible endpoints (OpenRouter, DeepSeek, Qwen, a local server,
etc.) via a user-supplied base_url. The two share all logic here; only the
client's base_url and how aggressively we trust the endpoint to accept a
native PDF file part differ (see _file_part below).

Lazy SDK import: `openai` is imported inside _client_obj(), never at module
top, so `services.ai` (and this module) still imports fine even if the
`openai` package isn't installed — it is only needed once this provider is
actually selected and used.
"""
import json

from .base import (
    AIProvider,
    Attachment,
    ConceptOut,
    QuizQuestion,
    ConceptLink,
    AnalysisResult,
    AICancelled,
    NOTE_MAX_TOKENS,
    concept_prompt_text,
    note_prompt_text,
    extra_instructions_block,
    quiz_prompt_text,
    repair_prompt_text,
    links_prompt_text,
    analysis_prompt_text,
    revision_topics_block,
    revision_prompt_text,
    read_bytes,
    is_pdf,
    is_image,
    data_url,
    pdf_to_text,
    retry_call,
)

# Cap for structured JSON calls (concept extraction / quiz generation) — a
# course's concept list or one concept's quiz comfortably fits in this.
_STRUCTURED_MAX_TOKENS = 8192

# Cap for note/repair generation. NOTE_MAX_TOKENS (65536) is Gemini's full
# output ceiling; OpenAI-family models generally cap Chat Completions output
# well below that, so use a smaller, still-generous ceiling.
_NOTE_MAX_TOKENS = min(NOTE_MAX_TOKENS, 16384)


class OpenAIProvider(AIProvider):
    """AIProvider backed by openai.OpenAI's Chat Completions API.

    name="openai": talks to the real OpenAI API (base_url=None).
    name="custom": talks to a user-supplied OpenAI-compatible base_url.
      Being an arbitrary endpoint, it is NOT assumed to support the
      OpenAI-specific base64 "file" content part for PDFs — that path is
      openai-only; custom always sends extracted PDF text instead (see
      _file_part).
    """

    def __init__(self, name: str = "openai"):
        self.name = name
        self._client = None
        self._client_sig = None  # (key, base_url) the cached client was built with

    # -- settings / client lifecycle -----------------------------------------

    def _read_settings(self):
        # Deferred import: services.ai's dispatcher module isn't done
        # importing itself when it imports this module (it constructs
        # OpenAIProvider while wiring up __init__.py), so this must be
        # resolved at call time, not at module-import time.
        from . import current_key, current_model, base_url as _base_url
        key = current_key(self.name)
        model = current_model(self.name)
        base = _base_url() if self.name == "custom" else None
        return key, model, base

    def _client_obj(self):
        import openai  # lazy: only needed if this provider is actually used
        key, _model, base = self._read_settings()
        if not key:
            raise RuntimeError(
                f"No API key set for the '{self.name}' provider (set one in Settings)."
            )
        sig = (key, base)
        if self._client is None or self._client_sig != sig:
            self._client = openai.OpenAI(api_key=key, base_url=(base or None))
            self._client_sig = sig
        return self._client

    def _model(self) -> str:
        _key, model, _base = self._read_settings()
        if not model:
            raise RuntimeError(
                f"No model set for the '{self.name}' provider (set one in Settings)."
            )
        return model

    # -- message building -----------------------------------------------------

    def _file_part(self, att: Attachment) -> list:
        """One or more Chat Completions content parts for an Attachment."""
        if is_image(att.mime):
            data = read_bytes(att)
            return [{
                "type": "image_url",
                "image_url": {"url": data_url(data, att.mime)},
            }]
        if is_pdf(att.mime):
            if self.name == "openai":
                try:
                    data = read_bytes(att)
                    return [{
                        "type": "file",
                        "file": {
                            "filename": att.display_name,
                            "file_data": data_url(data, "application/pdf"),
                        },
                    }]
                except Exception:
                    pass  # fall through to the extracted-text fallback below
            # custom provider (arbitrary endpoint, may not accept files), or
            # the openai file-part path above failed for any reason: fall
            # back to the PDF's extracted text as a plain text part so a note
            # never dies just because a provider rejected a file.
            try:
                text = pdf_to_text(att.disk_path)
            except Exception as e:
                text = f"[Could not extract text from {att.display_name}: {e}]"
            return [{"type": "text", "text": text}]
        # Unknown/unexpected mime: best-effort text fallback.
        try:
            text = pdf_to_text(att.disk_path)
        except Exception:
            text = ""
        return [{"type": "text", "text": text or f"[Unsupported file type for {att.display_name}]"}]

    def _build_messages(self, text_prompt: str, materials: list, pyqs: list) -> list:
        """One user message whose content is a list of parts: label+file
        parts for every material then every PYQ (mirroring Gemini's role
        labels — "STUDY MATERIAL FILE — <name>:" / "PAST EXAM FILE — <name>:"),
        followed by the text prompt.
        """
        parts = []
        for att in materials:
            parts.append({"type": "text", "text": f"STUDY MATERIAL FILE — {att.display_name}:"})
            parts += self._file_part(att)
        for att in pyqs:
            parts.append({"type": "text", "text": f"PAST EXAM FILE — {att.display_name}:"})
            parts += self._file_part(att)
        parts.append({"type": "text", "text": text_prompt})
        return [{"role": "user", "content": parts}]

    # -- structured (JSON) calls ------------------------------------------------

    @staticmethod
    def _parse_items(content: str):
        """Parse a JSON object {"items": [...]} (or a bare array, tolerated)
        out of raw model text. Returns the items list, or None if the text
        can't be parsed into one.
        """
        if not content:
            return None
        raw = content.strip()
        if raw.startswith("```"):
            raw = raw[3:]
            if raw.lstrip().startswith("json"):
                raw = raw.lstrip()[4:]
            if raw.rstrip().endswith("```"):
                raw = raw.rstrip()[:-3]
            raw = raw.strip()
        try:
            obj = json.loads(raw)
        except Exception:
            return None
        if isinstance(obj, list):
            return obj
        if isinstance(obj, dict):
            items = obj.get("items")
            if isinstance(items, list):
                return items
            # Tolerate a differently-named single list key.
            for v in obj.values():
                if isinstance(v, list):
                    return v
        return None

    def _structured_call(self, messages: list, should_cancel=None,
                          max_tokens: int = _STRUCTURED_MAX_TOKENS) -> list:
        """One JSON-object structured chat completion, with ONE forceful
        re-ask if the response can't be parsed. Returns the raw `items` list
        (still needs validating into ConceptOut/QuizQuestion by the caller).
        """
        def _ask(msgs):
            def _call():
                return self._client_obj().chat.completions.create(
                    model=self._model(),
                    messages=msgs,
                    response_format={"type": "json_object"},
                    max_tokens=max_tokens,
                    temperature=0.2,
                )
            resp = retry_call(_call, should_cancel=should_cancel)
            return (resp.choices[0].message.content or "").strip()

        content = _ask(messages)
        items = self._parse_items(content)
        if items is None:
            retry_messages = messages + [
                {"role": "user", "content": "Return ONLY the JSON object, no prose."},
            ]
            content2 = _ask(retry_messages)
            items = self._parse_items(content2)
            if items is None:
                raise RuntimeError("Model did not return a parseable JSON object.")
        return items

    @staticmethod
    def _parse_object(content: str):
        """Parse a bare JSON OBJECT out of raw model text (the single-object
        counterpart to _parse_items, used for AnalysisResult — a structured
        object, not a list of items). Returns the dict, or None if the text
        can't be parsed into one.
        """
        if not content:
            return None
        raw = content.strip()
        if raw.startswith("```"):
            raw = raw[3:]
            if raw.lstrip().startswith("json"):
                raw = raw.lstrip()[4:]
            if raw.rstrip().endswith("```"):
                raw = raw.rstrip()[:-3]
            raw = raw.strip()
        try:
            obj = json.loads(raw)
        except Exception:
            return None
        return obj if isinstance(obj, dict) else None

    def _structured_object_call(self, messages: list, should_cancel=None,
                                 max_tokens: int = _STRUCTURED_MAX_TOKENS) -> dict:
        """One JSON-object structured chat completion, with ONE forceful
        re-ask if the response can't be parsed. Returns the raw dict (still
        needs validating into a Pydantic model by the caller). Mirrors
        _structured_call, but the target shape IS the whole object (no
        {"items": [...]} wrapper convention).
        """
        def _ask(msgs):
            def _call():
                return self._client_obj().chat.completions.create(
                    model=self._model(),
                    messages=msgs,
                    response_format={"type": "json_object"},
                    max_tokens=max_tokens,
                    temperature=0.2,
                )
            resp = retry_call(_call, should_cancel=should_cancel)
            return (resp.choices[0].message.content or "").strip()

        content = _ask(messages)
        obj = self._parse_object(content)
        if obj is None:
            retry_messages = messages + [
                {"role": "user", "content": "Return ONLY the JSON object, no prose."},
            ]
            content2 = _ask(retry_messages)
            obj = self._parse_object(content2)
            if obj is None:
                raise RuntimeError("Model did not return a parseable JSON object.")
        return obj

    def extract_concepts(self, materials: list, should_cancel=None) -> list:
        """Ask for the concept list from study materials only (json_object
        mode requires a top-level object, so the shared prompt is extended
        with an explicit {"items": [...]} instruction).
        """
        prompt = concept_prompt_text() + (
            "\n\nRespond with a single JSON OBJECT of the form "
            '{"items": [ ... ]} — an object, not a bare array.'
        )
        messages = self._build_messages(prompt, materials, [])
        items = self._structured_call(messages, should_cancel=should_cancel)
        return [ConceptOut(**d) for d in items]

    def generate_quiz(self, name: str, summary: str, materials: list, pyqs: list,
                       sibling_names=None, should_cancel=None) -> list:
        siblings = ", ".join(sibling_names) if sibling_names else "none"
        prompt = quiz_prompt_text(name, summary, siblings) + (
            "\n\nRespond with a single JSON OBJECT of the form "
            '{"items": [ ... ]} — an object, not a bare array.'
        )
        messages = self._build_messages(prompt, materials, pyqs)
        items = self._structured_call(messages, should_cancel=should_cancel)
        data = [QuizQuestion(**d) for d in items]
        if not data:
            raise RuntimeError("Model returned an empty quiz.")
        return data

    def discover_links(self, concept_lines: str, should_cancel=None) -> list:
        """Find related concept pairs across the whole curriculum (Build 10).
        Text-only, no attachments; an empty list is a VALID result.
        """
        prompt = links_prompt_text(concept_lines) + (
            "\n\nRespond with a single JSON OBJECT of the form "
            '{"items": [ ... ]} — an object, not a bare array.'
        )
        messages = self._build_messages(prompt, [], [])
        items = self._structured_call(messages, should_cancel=should_cancel)
        return [ConceptLink(**d) for d in items]

    def analyze_questions(self, pyqs: list, concepts: list,
                           should_cancel=None) -> AnalysisResult:
        """Analyze a course's past exam questions ONLY (Build 12 — Question
        Analysis). materials=[] — this call never sees study materials.
        """
        prompt = analysis_prompt_text(concepts)
        messages = self._build_messages(prompt, [], pyqs)
        obj = self._structured_object_call(messages, should_cancel=should_cancel)
        return AnalysisResult(**obj)

    # -- streaming text calls (notes / repair) ---------------------------------

    def _stream_text(self, messages: list, should_cancel=None,
                      max_tokens: int = _NOTE_MAX_TOKENS) -> str:
        def _call():
            parts = []
            finish_reason = None
            stream = self._client_obj().chat.completions.create(
                model=self._model(),
                messages=messages,
                stream=True,
                max_tokens=max_tokens,
                temperature=0.3,
            )
            for chunk in stream:
                if should_cancel and should_cancel():
                    try:
                        stream.close()
                    except Exception:
                        pass
                    raise AICancelled()
                if not getattr(chunk, "choices", None):
                    continue
                choice = chunk.choices[0]
                delta = getattr(choice, "delta", None)
                delta_content = getattr(delta, "content", None) if delta is not None else None
                if delta_content:
                    parts.append(delta_content)
                fr = getattr(choice, "finish_reason", None)
                if fr:
                    finish_reason = fr
            text = "".join(parts).strip()
            if finish_reason == "length":
                raise RuntimeError("Note output was truncated (too long). Try regenerating.")
            if not text:
                raise RuntimeError("Model returned an empty response.")
            return text
        return retry_call(_call, should_cancel=should_cancel)

    def generate_note_latex(self, name: str, summary: str, materials: list, pyqs: list,
                             sibling_names=None, extra_instructions: str = "",
                             enhancement_keys=None, should_cancel=None) -> str:
        pyq_names = ", ".join(p.display_name for p in pyqs) if pyqs else "none"
        siblings = ", ".join(sibling_names) if sibling_names else "none"
        extra_block = extra_instructions_block(extra_instructions, enhancement_keys)
        prompt = note_prompt_text(name, summary, pyq_names, siblings, extra_block)
        messages = self._build_messages(prompt, materials, pyqs)
        return self._stream_text(messages, should_cancel=should_cancel)

    def repair_note_latex(self, name: str, broken_body: str, error: str, should_cancel=None) -> str:
        prompt = repair_prompt_text(name, error, broken_body)
        messages = [{"role": "user", "content": prompt}]
        return self._stream_text(messages, should_cancel=should_cancel)

    def generate_revision_latex(self, exam_name: str, ranked_topics: list, materials: list, pyqs: list,
                                 concepts: list, should_cancel=None) -> str:
        topics_block = revision_topics_block(ranked_topics)
        concepts_list = ", ".join(c.get("name", "") for c in concepts) if concepts else "none"
        prompt = revision_prompt_text(exam_name, topics_block, concepts_list)
        messages = self._build_messages(prompt, materials, pyqs)
        return self._stream_text(messages, should_cancel=should_cancel)

    def stream_answer(self, system: str, user: str, image: str | None = None, should_cancel=None):
        """Stream a study-assistant answer (Phase A of the "ask AI" feature).

        Same chat.completions stream=True mechanism as _stream_text above, but
        yields each delta as it arrives instead of collecting the whole
        response first. `image`, when given, is already a data: URL string in
        exactly the shape _file_part() builds for an image Attachment
        (data_url(bytes, mime)), so it's used directly as the image_url part's
        "url" — no re-parsing needed.
        """
        user_content = []
        if image:
            user_content.append({"type": "image_url", "image_url": {"url": image}})
        user_content.append({"type": "text", "text": user})
        messages = [
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ]
        stream = self._client_obj().chat.completions.create(
            model=self._model(),
            messages=messages,
            stream=True,
            max_tokens=_NOTE_MAX_TOKENS,
            temperature=0.4,
        )
        try:
            for chunk in stream:
                if should_cancel and should_cancel():
                    raise AICancelled()
                if not getattr(chunk, "choices", None):
                    continue
                delta = getattr(chunk.choices[0], "delta", None)
                text = getattr(delta, "content", None) if delta is not None else None
                if text:
                    yield text
        finally:
            try:
                stream.close()
            except Exception:
                pass
