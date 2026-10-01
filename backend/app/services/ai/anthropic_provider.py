"""Anthropic adapter: implements AIProvider on top of the Anthropic Python
SDK's Messages API.

Lazy SDK import: `anthropic` is imported inside _client_obj(), never at
module top, so `services.ai` still imports fine even if the `anthropic`
package isn't installed — it is only needed once this provider is actually
selected and used.
"""
import base64

from .base import (
    AIProvider,
    Attachment,
    ConceptOut,
    QuizQuestion,
    ConceptLink,
    AnalysisResult,
    AICancelled,
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
    parse_json_list,
    parse_json_object,
    parse_data_url,
    retry_call,
)

# max_tokens is REQUIRED by the Messages API (no server-side default cap).
_NOTE_MAX_TOKENS = 8192
_STRUCTURED_MAX_TOKENS = 8192


class AnthropicProvider(AIProvider):
    """AIProvider backed by anthropic.Anthropic's Messages API."""

    def __init__(self):
        self._client = None
        self._client_key = None  # API key the cached client was built with

    # -- settings / client lifecycle -----------------------------------------

    def _read_settings(self):
        # Deferred import: services.ai's dispatcher module isn't done
        # importing itself when it imports this module (it constructs
        # AnthropicProvider while wiring up __init__.py), so this must be
        # resolved at call time, not at module-import time.
        from . import current_key, current_model
        key = current_key("anthropic")
        model = current_model("anthropic")
        return key, model

    def _client_obj(self):
        import anthropic  # lazy: only needed if this provider is actually used
        key, _model = self._read_settings()
        if not key:
            raise RuntimeError("No API key set for the 'anthropic' provider (set one in Settings).")
        if self._client is None or self._client_key != key:
            self._client = anthropic.Anthropic(api_key=key)
            self._client_key = key
        return self._client

    def _model(self) -> str:
        _key, model = self._read_settings()
        if not model:
            raise RuntimeError("No model set for the 'anthropic' provider (set one in Settings).")
        return model

    # -- content-block building ------------------------------------------------

    def _file_block(self, att: Attachment) -> dict:
        if is_image(att.mime):
            data = base64.b64encode(read_bytes(att)).decode("ascii")
            return {"type": "image", "source": {"type": "base64", "media_type": att.mime, "data": data}}
        if is_pdf(att.mime):
            data = base64.b64encode(read_bytes(att)).decode("ascii")
            return {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": data}}
        # Unknown mime type: best-effort placeholder text block so nothing
        # silently vanishes from the request.
        return {"type": "text", "text": f"[Unsupported file type for {att.display_name}]"}

    def _build_content(self, text_prompt: str, materials: list, pyqs: list) -> list:
        """Text block(s) with role labels (mirroring Gemini's — "STUDY
        MATERIAL FILE — <name>:" / "PAST EXAM FILE — <name>:") + a file block
        per attachment, then the text prompt, as one message's content list.
        """
        content = []
        for att in materials:
            content.append({"type": "text", "text": f"STUDY MATERIAL FILE — {att.display_name}:"})
            content.append(self._file_block(att))
        for att in pyqs:
            content.append({"type": "text", "text": f"PAST EXAM FILE — {att.display_name}:"})
            content.append(self._file_block(att))
        content.append({"type": "text", "text": text_prompt})
        return content

    # -- structured (JSON) calls: no json_object mode, so we rely on the -------
    # -- shared prompts already asking for a JSON array + parse_json_list. ----

    def _ask_json_list(self, content: list, model, should_cancel=None,
                        max_tokens: int = _STRUCTURED_MAX_TOKENS) -> list:
        def _ask(c):
            def _call():
                return self._client_obj().messages.create(
                    model=self._model(),
                    max_tokens=max_tokens,
                    messages=[{"role": "user", "content": c}],
                )
            resp = retry_call(_call, should_cancel=should_cancel)
            return "".join(getattr(b, "text", "") for b in resp.content)

        text = _ask(content)
        try:
            return parse_json_list(text, model)
        except Exception:
            retry_content = content + [
                {"type": "text", "text": "Return ONLY the JSON array, no prose."},
            ]
            text2 = _ask(retry_content)
            return parse_json_list(text2, model)  # let this raise if still unparseable

    def _ask_json_object(self, content: list, model, should_cancel=None,
                          max_tokens: int = _STRUCTURED_MAX_TOKENS):
        """One JSON-object structured call (the single-object counterpart to
        _ask_json_list, used for AnalysisResult), with ONE forceful re-ask if
        the response can't be parsed.
        """
        def _ask(c):
            def _call():
                return self._client_obj().messages.create(
                    model=self._model(),
                    max_tokens=max_tokens,
                    messages=[{"role": "user", "content": c}],
                )
            resp = retry_call(_call, should_cancel=should_cancel)
            return "".join(getattr(b, "text", "") for b in resp.content)

        text = _ask(content)
        try:
            return parse_json_object(text, model)
        except Exception:
            retry_content = content + [
                {"type": "text", "text": "Return ONLY the JSON object, no prose."},
            ]
            text2 = _ask(retry_content)
            return parse_json_object(text2, model)  # let this raise if still unparseable

    def extract_concepts(self, materials: list, should_cancel=None) -> list:
        prompt = concept_prompt_text()
        content = self._build_content(prompt, materials, [])
        return self._ask_json_list(content, ConceptOut, should_cancel=should_cancel)

    def generate_quiz(self, name: str, summary: str, materials: list, pyqs: list,
                       sibling_names=None, should_cancel=None) -> list:
        siblings = ", ".join(sibling_names) if sibling_names else "none"
        prompt = quiz_prompt_text(name, summary, siblings)
        content = self._build_content(prompt, materials, pyqs)
        data = self._ask_json_list(content, QuizQuestion, should_cancel=should_cancel)
        if not data:
            raise RuntimeError("Model returned an empty quiz.")
        return data

    def discover_links(self, concept_lines: str, should_cancel=None) -> list:
        """Find related concept pairs across the whole curriculum (Build 10).
        Text-only, no attachments; an empty list is a VALID result.
        """
        prompt = links_prompt_text(concept_lines)
        content = self._build_content(prompt, [], [])
        return self._ask_json_list(content, ConceptLink, should_cancel=should_cancel)

    def analyze_questions(self, pyqs: list, concepts: list,
                           should_cancel=None) -> AnalysisResult:
        """Analyze a course's past exam questions ONLY (Build 12 — Question
        Analysis). materials=[] — this call never sees study materials.
        """
        prompt = analysis_prompt_text(concepts)
        content = self._build_content(prompt, [], pyqs)
        return self._ask_json_object(content, AnalysisResult, should_cancel=should_cancel)

    # -- streaming text calls (notes / repair) ---------------------------------

    @staticmethod
    def _delta_text(chunk) -> str:
        """Text delta of one raw stream event, or "" if this event carries
        none (mirrors the SDK's own text-streaming helper: only
        content_block_delta events whose delta is a text_delta carry text).
        """
        try:
            if getattr(chunk, "type", None) != "content_block_delta":
                return ""
            delta = getattr(chunk, "delta", None)
            if getattr(delta, "type", None) != "text_delta":
                return ""
            return getattr(delta, "text", "") or ""
        except Exception:
            return ""

    def _stream_text(self, content: list, should_cancel=None,
                      max_tokens: int = _NOTE_MAX_TOKENS) -> str:
        def _call():
            parts = []
            # The installed SDK's messages.stream() context manager yields an
            # iterator of raw stream events (no public .text_stream property
            # in this version) — iterate it directly and pick out text deltas,
            # same logic the SDK's own (private) text-streaming helper uses.
            with self._client_obj().messages.stream(
                model=self._model(),
                max_tokens=max_tokens,
                messages=[{"role": "user", "content": content}],
            ) as stream:
                for chunk in stream:
                    if should_cancel and should_cancel():
                        raise AICancelled()
                    text = self._delta_text(chunk)
                    if text:
                        parts.append(text)
                final = stream.get_final_message()
            text = "".join(parts).strip()
            if getattr(final, "stop_reason", None) == "max_tokens":
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
        content = self._build_content(prompt, materials, pyqs)
        return self._stream_text(content, should_cancel=should_cancel)

    def repair_note_latex(self, name: str, broken_body: str, error: str, should_cancel=None) -> str:
        prompt = repair_prompt_text(name, error, broken_body)
        content = [{"type": "text", "text": prompt}]
        return self._stream_text(content, should_cancel=should_cancel)

    def generate_revision_latex(self, exam_name: str, ranked_topics: list, materials: list, pyqs: list,
                                 concepts: list, should_cancel=None) -> str:
        topics_block = revision_topics_block(ranked_topics)
        concepts_list = ", ".join(c.get("name", "") for c in concepts) if concepts else "none"
        prompt = revision_prompt_text(exam_name, topics_block, concepts_list)
        content = self._build_content(prompt, materials, pyqs)
        return self._stream_text(content, should_cancel=should_cancel)

    def stream_answer(self, system: str, user: str, image: str | None = None, should_cancel=None):
        """Stream a study-assistant answer (Phase A of the "ask AI" feature).

        Same messages.stream() event-iteration mechanism as _stream_text
        above, but yields each text delta as it arrives instead of collecting
        the whole response first. Unlike the note/quiz/concept prompts (which
        have no separate system/user split and go entirely into the user
        message), this call has a real system prompt, so it's passed via the
        Messages API's own `system` parameter. An optional image crop is
        parsed from its data: URL into (media_type, base64 data) exactly like
        _file_block() does for an image Attachment, and sent as an image
        content block ahead of the question text.
        """
        content = []
        if image:
            mime, b64 = parse_data_url(image)
            content.append({"type": "image", "source": {"type": "base64", "media_type": mime, "data": b64}})
        content.append({"type": "text", "text": user})
        with self._client_obj().messages.stream(
            model=self._model(),
            max_tokens=_NOTE_MAX_TOKENS,
            system=system,
            messages=[{"role": "user", "content": content}],
        ) as stream:
            for chunk in stream:
                if should_cancel and should_cancel():
                    raise AICancelled()
                text = self._delta_text(chunk)
                if text:
                    yield text
