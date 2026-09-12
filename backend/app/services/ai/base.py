"""Provider-agnostic AI core: shared data types, prompts, and the abstract
provider interface every concrete adapter (Gemini today, others later)
implements.

This module owns NOTHING specific to any one AI vendor's SDK — that lives in
per-provider adapter modules (e.g. gemini_provider.py). It defines:
- Attachment: a vendor-neutral handle to one uploaded course file.
- The Pydantic response models (ConceptOut, QuizQuestion) and prompt text
  (moved verbatim from the old services/gemini.py — Phase A1 is a pure move,
  not a rewrite of any prompt or generation logic).
- NOTE_ENHANCEMENTS and its helpers (per-course note customization catalog).
- AIProvider: the abstract base class adapters must implement.
- Small file/JSON helpers future adapters can reuse (read_bytes, is_pdf,
  is_image, data_url, pdf_to_text, parse_json_list).
"""
import json
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass

from pydantic import BaseModel


@dataclass
class Attachment:
    """A vendor-neutral handle to one uploaded course file (a `materials` row).

    Adapters translate this into whatever their SDK needs (e.g. the Gemini
    adapter lazily uploads disk_path via the File API, caching the resulting
    file name back onto gemini_file_name).
    """
    display_name: str
    disk_path: str
    mime: str
    kind: str  # 'material' | 'pyq'
    material_id: int
    gemini_file_name: str | None = None


# ---------------------------------------------------------------------------
# Shared constants (moved verbatim from services/gemini.py).
# ---------------------------------------------------------------------------

# HTTP codes worth retrying: rate limit and transient server/overload errors.
_RETRYABLE = {429, 500, 502, 503, 504}

# Output cap for a single note = the model's full output limit. This is only a
# ceiling (the model stops when the note is done, and billing is on tokens
# actually produced), so maxing it out simply removes any truncation risk.
NOTE_MAX_TOKENS = 65536


class AICancelled(RuntimeError):
    """Raised by a provider's generate call when should_cancel() reports true.

    Named AICancelled here (provider-agnostic); services/gemini.py keeps the
    old name GeminiCancelled alive as an alias so existing
    `except gemini.GeminiCancelled` call sites keep working unchanged.
    """


# ---------------------------------------------------------------------------
# Shared retry helper (Phase A2). Gemini keeps its own generate_with_retry
# (it needs the extra streaming-reassembly machinery in gemini_provider.py);
# the OpenAI/Anthropic/custom adapters use this simpler helper instead, since
# their SDK calls are plain callables with no special stream-parsing needs.
# ---------------------------------------------------------------------------

def retry_call(fn, *, attempts: int = 4, should_cancel=None, retry_on=(Exception,)):
    """Call fn(), retrying transient failures with exponential backoff
    (2s -> 4s -> ... capped at 20s).

    should_cancel, if given, is a zero-arg callable checked before every
    attempt (including the first); if it reports True, AICancelled is raised
    immediately instead of calling fn(). If fn() itself raises AICancelled
    (e.g. a streaming loop that noticed cancellation mid-generation), that
    always propagates immediately and is NEVER treated as a retryable error,
    regardless of `retry_on`.

    Only exceptions matching `retry_on` are retried; on the final attempt the
    exception is re-raised as-is (no wrapping).
    """
    delay = 2
    attempts = max(1, int(attempts))
    last = None
    for i in range(attempts):
        if should_cancel and should_cancel():
            raise AICancelled()
        try:
            return fn()
        except AICancelled:
            raise
        except retry_on as e:
            last = e
            if i >= attempts - 1:
                raise
            if should_cancel and should_cancel():
                raise AICancelled()
            time.sleep(delay)
            delay = min(delay * 2, 20)
    raise last  # pragma: no cover


# ---------------------------------------------------------------------------
# Response models (moved verbatim from services/gemini.py).
# ---------------------------------------------------------------------------

class ConceptOut(BaseModel):
    """One teachable concept the model found in the materials."""
    name: str
    summary: str
    source: str
    # No default: the Gemini structured-output response_schema rejects Pydantic
    # fields that carry a default value ("Default value is not supported in
    # the response schema for the Gemini API"), so this must stay required
    # like the other fields above. The prompt always asks the model to supply
    # it, and _resolve_material_id() treats an empty/unmatched string safely.
    source_file: str


class QuizQuestion(BaseModel):
    """One quiz question for a concept (either multiple-choice or short-answer)."""
    kind: str  # 'mcq' | 'short'
    category: str  # 'concept' | 'pyq'
    question: str  # LaTeX for any math
    # No default: the Gemini structured-output response_schema rejects Pydantic
    # fields that carry a default value, so every field here stays required
    # (mirrors ConceptOut above) — the prompt always asks for all of them.
    options: list[str]  # 4 options for mcq, [] for short
    answer_index: int  # correct 0-based index for mcq, -1 for short
    answer_text: str  # correct answer text for short, "" for mcq
    explanation: str
    marks: int


# ---------------------------------------------------------------------------
# Prompt text (moved verbatim from services/gemini.py — same text, same rules).
# ---------------------------------------------------------------------------

_CONCEPT_PROMPT = (
    "You are helping a university student study. The attached files are ONLY their course "
    "STUDY MATERIALS (lecture slides, notes, textbook pages, images) — there are no exam "
    "questions or PYQs attached to this request. Each file is preceded by a label of the form "
    "\"STUDY MATERIAL FILE — <name>:\" giving its exact file name.\n\n"
    "Identify the distinct, teachable CONCEPTS a student must learn, drawn STRICTLY and ONLY "
    "from the attached study materials. Use the natural granularity of a lecture subtopic — "
    "not a whole chapter, not a trivial single term. Cover the material thoroughly and in the "
    "order it is taught. Do NOT invent, infer, or include any topic, term, or concept that is "
    "not actually present in the attached files — every concept must be traceable to specific "
    "content in these materials.\n\n"
    "For each concept return:\n"
    "- name: a concise topic title (e.g. 'B+ Tree Insertion')\n"
    "- summary: one or two sentences on what it covers\n"
    "- source: where it appears, e.g. the file name and page/slide range if identifiable\n"
    "- source_file: the EXACT study-material file name (from the \"STUDY MATERIAL FILE — <name>\" "
    "labels) this concept mainly comes from\n\n"
    "Return ONLY the JSON array."
)


_NOTE_PROMPT = r"""You are writing a study note for ONE concept as LaTeX BODY content.
It is inserted into a document whose preamble is ALREADY loaded (never repeat it):
- \documentclass{article}; packages: amsmath, amssymb, graphicx, tcolorbox, enumitem, xcolor, hyperref, parskip.
- A custom environment \begin{practice} ... \end{practice} for exam-style problems.

CONCEPT: "<<NAME>>"
SUMMARY: <<SUMMARY>>
PAST EXAM FILES ATTACHED: <<PYQ_FILES>>
OTHER CONCEPTS IN THIS COURSE (each gets its OWN separate note): <<SIBLINGS>>

This course also covers these OTHER concepts, each written up in its OWN separate note:
<<SIBLINGS>>. Write this note about ONLY "<<NAME>>". Do NOT re-teach or duplicate the other
concepts' material, and do NOT repeat shared background at length — assume the reader will
study the siblings separately. Stay narrowly focused on "<<NAME>>"; the practice problems must
specifically test "<<NAME>>".

The attached files are labeled by role. Use ONLY the files labeled STUDY MATERIALS as the
source of truth for teaching content: write clear, thorough teaching notes for THIS concept
only — definitions, intuition, key results/formulas, and worked reasoning. Organize with
\section and \subsection. Use $...$ and \[...\] for math, and itemize/enumerate for lists.
NEVER introduce a topic, term, or fact that is not present in the study materials, even if it
appears in the past exam questions.

RENDERING: use display math \[ ... \] for long or complex expressions rather than a long inline
$...$ that overruns a line; avoid extremely long unbreakable tokens or URLs; keep the practice
block focused and specific, not padded.

EXTRA INSTRUCTIONS FROM THE STUDENT (optional — apply where genuinely relevant to STYLE, FORMAT,
and MEMORY TECHNIQUE only). These must NEVER introduce a topic, term, or fact that is absent from
the study materials, must stay grounded strictly in the study materials, and must never override the
STRICT OUTPUT RULES below:
<<EXTRA_INSTRUCTIONS>>

End with ONE \begin{practice}...\end{practice} block titled around real exam practice. From the
attached files labeled PAST EXAM QUESTIONS, identify the actual question(s) that test THIS
concept. For each, (a) reproduce the question faithfully as a problem, (b) give a complete,
step-by-step worked solution that teaches how to solve it, and (c) end that problem with a small
italic source note on its own line naming the EXACT source file, e.g.
{\footnotesize\emph{(Source: <PYQ file name> — from the past exam questions.)}}, using the exact
file name from its "PAST EXAM FILE — <name>:" label. If NONE of the attached past questions test
this concept (or no past exam files are attached), instead write 2-3 representative exam-style
problems with full solutions, grounded strictly in the study materials, and end EACH one with
{\footnotesize\emph{(Representative practice problem — not from a past paper.)}} so its origin is
always clear. Never introduce a topic that isn't in the study materials.

STRICT OUTPUT RULES:
- Output ONLY LaTeX body content. Do NOT include \documentclass, \usepackage, \begin{document},
  \end{document}, a title, or \maketitle.
- Only use the packages/commands listed above. Do NOT use \newcommand, \usepackage, or
  \includegraphics of external files.
- Every \item MUST be inside \begin{itemize}...\end{itemize} or \begin{enumerate}...\end{enumerate}
  (a list may live inside the practice box). NEVER write \item outside a list.
- Every \begin{...} must have a matching \end{...}, and every { must have a matching }.
- Escape literal special characters (\% \& \_ \# etc.); keep math inside math mode.
- Write ALL math symbols as LaTeX commands inside math mode (e.g. $\alpha$, $\times$, $\le$,
  $\to$, $\Rightarrow$, $x^{2}$, $\frac{a}{b}$). Do NOT paste raw Unicode symbols/superscripts
  (×, ≤, →, α, ², √, etc.) or "smart" quotes/dashes — plain ASCII in prose, commands in math.
- Every $ opens AND closes; never leave a dangling $ or mix $ with \[ \]. Subscripts/superscripts
  must have braces for multi-character args ($x_{ij}$, not $x_ij$).
- Prefer itemize/enumerate over tables. If a table is truly needed, keep it small and make the
  number of & separators in EVERY row match the column spec exactly, ending each row with \\.
- Do NOT reference figures, images, \ref/\cite, or files that don't exist.
- Do NOT wrap the output in markdown code fences.
Begin now with the first \section."""


_REPAIR_PROMPT = r"""The following LaTeX body (for a study note titled "<<NAME>>") FAILED to compile.

COMPILE ERROR:
<<ERROR>>

BROKEN LATEX BODY:
<<BODY>>

Return a CORRECTED full LaTeX body that fixes the error and compiles cleanly under XeTeX.
Keep the same teaching content and structure; only fix what is broken.
RULES: body content only (no \documentclass/\usepackage/\begin{document}/\end{document}/title).
Every \item MUST be inside \begin{itemize}...\end{itemize} or \begin{enumerate}...\end{enumerate}.
Close every \begin{...} and balance every brace. Only use amsmath, amssymb, graphicx, tcolorbox,
enumitem, xcolor, hyperref, parskip and the \begin{practice} environment. No markdown code fences.
Output only the corrected LaTeX body."""


_QUIZ_PROMPT = (
    "Make a topic-appropriate quiz (about 5-10 questions, scaled to the depth of the concept) "
    "for the concept \"<<NAME>>\" (<<SUMMARY>>).\n\n"
    "This course also covers these OTHER concepts, each with its OWN separate quiz: <<SIBLINGS>>. "
    "Every question must be specifically about \"<<NAME>>\" — do NOT reuse generic questions that "
    "would apply equally to any of the sibling concepts.\n\n"
    "Cover TWO categories of question:\n"
    "- category=\"concept\": foundational understanding of the concept itself — not necessarily "
    "modeled on past exam questions, and may be challenging.\n"
    "- category=\"pyq\": modeled on or drawn from the attached past exam questions (use the full "
    "question or break it into parts); if no past exam files are attached, still produce good "
    "exam-style questions for this category.\n\n"
    "Mix \"mcq\" (multiple choice) and \"short\" (short answer) questions across both categories.\n\n"
    "Rules:\n"
    "- Write any math, subscripts, or notation in LaTeX, wrapped in $...$.\n"
    "- Every mcq has EXACTLY 4 options in \"options\", exactly ONE correct answer given as a "
    "0-based \"answer_index\", and \"answer_text\" set to \"\".\n"
    "- Every short has \"options\" = [], \"answer_index\" = -1, and the correct answer given in "
    "\"answer_text\".\n"
    "- Give an \"explanation\" for every question (why the answer is correct).\n"
    "- Assign \"marks\" to every question (harder questions get more marks).\n\n"
    "Output ONLY the JSON array."
)


# ---------------------------------------------------------------------------
# Shared prompt-text builders (the substitution logic that used to live inline
# inside gemini.py's generate_note_latex/generate_quiz/repair_note_latex),
# pulled out so future adapters can reuse the exact same prompt assembly.
# ---------------------------------------------------------------------------

def concept_prompt_text() -> str:
    """The (static, no substitution needed) concept-extraction prompt."""
    return _CONCEPT_PROMPT


def extra_instructions_block(extra_instructions: str, enhancement_keys) -> str:
    """Build the <<EXTRA_INSTRUCTIONS>> block for the note prompt: the
    student's free-text instructions (if any) followed by one bullet per
    selected enhancement's instruction line, or "none" if there's nothing.
    """
    lines = []
    if (extra_instructions or "").strip():
        lines.append((extra_instructions or "").strip())
    lines += enhancement_instructions(enhancement_keys)
    return "\n".join(f"- {ln}" for ln in lines) if lines else "none"


def note_prompt_text(name: str, summary: str, pyq_names: str, siblings: str, extra_block: str) -> str:
    """Substitute the note prompt's placeholders. pyq_names/siblings are
    already-joined display strings (or "none"); extra_block is the output of
    extra_instructions_block.
    """
    return (_NOTE_PROMPT
            .replace("<<NAME>>", name or "")
            .replace("<<SUMMARY>>", summary or "")
            .replace("<<PYQ_FILES>>", pyq_names)
            .replace("<<SIBLINGS>>", siblings)
            .replace("<<EXTRA_INSTRUCTIONS>>", extra_block))


def repair_prompt_text(name: str, error_text: str, broken_body: str) -> str:
    """Substitute the repair prompt's placeholders (error text truncated to
    1500 chars, as before)."""
    return (_REPAIR_PROMPT
            .replace("<<NAME>>", name or "")
            .replace("<<ERROR>>", (error_text or "")[:1500])
            .replace("<<BODY>>", broken_body or ""))


def quiz_prompt_text(name: str, summary: str, siblings: str) -> str:
    """Substitute the quiz prompt's placeholders."""
    return (_QUIZ_PROMPT
            .replace("<<NAME>>", name or "")
            .replace("<<SUMMARY>>", summary or "")
            .replace("<<SIBLINGS>>", siblings))


# ---------------------------------------------------------------------------
# Ask/explain (Phase A of the in-reader "highlight/snip -> ask AI" study
# assistant). Provider-agnostic: ASK_MODES supplies a canned instruction per
# quick-action mode, build_ask_messages assembles the (system, user) prompt
# pair every adapter's stream_answer() turns into its own SDK message shape.
# ---------------------------------------------------------------------------

ASK_MODES: dict[str, str] = {
    "explain": "Explain the following clearly and concisely.",
    "simple": "Explain the following as simply as possible, like you would to a beginner (ELI5).",
    "deep": "Explain the following in depth, covering the underlying mechanism and why it matters.",
    "analogy": "Explain the following using a concrete, everyday analogy.",
    "define": "Define the key term(s) in the following precisely and briefly.",
}


def build_ask_messages(concept_name: str, concept_summary: str, instruction: str,
                        selection: str = "", context: str = "", has_image: bool = False) -> tuple[str, str]:
    """Assemble the (system, user) prompt pair for the in-reader "ask AI"
    study assistant: a student has highlighted/snipped a passage or figure
    from their lesson and wants it explained/defined/etc.

    system is a study-tutor prompt scoped to the lesson; user is the actual
    request (instruction + optional selection/image note/context/summary),
    assembled plainly with clear labels so every adapter can turn it into its
    own message shape unchanged.
    """
    system = (
        "You are a helpful study tutor. A student is asking about a specific passage or "
        f"figure from their lesson named \"{concept_name}\". You may use general knowledge "
        "and analogies to help explain, but stay relevant to that passage and to the lesson "
        "at hand — don't wander into unrelated territory. Any math MUST be written in LaTeX "
        "math mode ($...$ for inline, $$...$$ for display) so it renders correctly with "
        "KaTeX. Keep your answer focused and not overly long."
    )
    lines = [instruction]
    if (selection or "").strip():
        lines.append("")
        lines.append("Passage:")
        lines.append(selection.strip())
    if has_image:
        lines.append("")
        lines.append(
            "An image of the region is attached — look at it and explain what it shows."
        )
    if (context or "").strip():
        lines.append("")
        lines.append("Nearby context from the lesson:")
        lines.append(context.strip())
    if (concept_summary or "").strip():
        lines.append("")
        lines.append(f"Lesson summary: {concept_summary.strip()}")
    user = "\n".join(lines)
    return system, user


# ---------------------------------------------------------------------------
# NOTE_ENHANCEMENTS catalog (moved verbatim from services/gemini.py).
# ---------------------------------------------------------------------------

# Build 4, Step 1: optional per-course note customization. Ordered catalog of
# selectable "enhancement" (memory-technique) instructions a student can turn
# on for their course's notes, plus free-text instructions (see courses.py's
# note-prefs endpoints and generation_service._course_note_prefs).
NOTE_ENHANCEMENTS = [
    {"key": "mnemonics",     "label": "Mnemonics & acronyms",   "instruction": "Create mnemonics/acronyms for genuinely memorizable lists, sequences, and facts."},
    {"key": "memory_palace", "label": "Memory palace (loci)",    "instruction": "For memorizable groups or sequences, add a brief method-of-loci (memory palace) mapping to a vivid mental journey."},
    {"key": "storytelling",  "label": "Storytelling / narrative","instruction": "Tie the memorizable material together with a short, vivid narrative or story that aids recall."},
    {"key": "analogies",     "label": "Analogies & examples",    "instruction": "Explain abstract ideas with concrete real-world analogies and everyday examples."},
    {"key": "pitfalls",      "label": "Common pitfalls",         "instruction": "Call out common misconceptions and mistakes students make on this concept."},
    {"key": "exam_tips",     "label": "Exam tips",               "instruction": "Add brief exam tips: how this concept is typically tested and what to watch for."},
    {"key": "flashcards",    "label": "Flashcard recap",         "instruction": "End with a few flashcard-style question/answer pairs (spaced-repetition friendly) covering the must-know points."},
    {"key": "eli5",          "label": "Plain-language (ELI5)",   "instruction": "Add a short plain-language ('explain like I'm 5') intuition for the hardest idea."},
    {"key": "key_takeaways", "label": "Key-takeaways box",       "instruction": "Add a concise 'Key takeaways' summary of the must-remember points."},
]
_ENHANCEMENT_BY_KEY = {e["key"]: e for e in NOTE_ENHANCEMENTS}


def enhancement_catalog():
    """Public list of {key,label} for the UI/API."""
    return [{"key": e["key"], "label": e["label"]} for e in NOTE_ENHANCEMENTS]


def enhancement_instructions(keys):
    """Map a list of enhancement keys to their instruction lines, ignoring unknown keys, preserving catalog order."""
    keys = set(keys or [])
    return [e["instruction"] for e in NOTE_ENHANCEMENTS if e["key"] in keys]


def valid_enhancement_keys(keys):
    """Filter a list of keys to only known ones (preserving catalog order)."""
    keys = set(keys or [])
    return [e["key"] for e in NOTE_ENHANCEMENTS if e["key"] in keys]


# ---------------------------------------------------------------------------
# AIProvider — the abstract interface every adapter implements.
# ---------------------------------------------------------------------------

class AIProvider(ABC):
    """A provider-agnostic AI backend for Axiom's three generation tasks:
    concept extraction, note-body generation, note repair, and quiz
    generation. Concrete adapters (e.g. GeminiProvider) implement these by
    translating Attachments into whatever their SDK needs.
    """

    @abstractmethod
    def extract_concepts(self, materials: list[Attachment], should_cancel=None) -> list[ConceptOut]:
        """Ask the model for the concept list from study materials only."""
        raise NotImplementedError

    @abstractmethod
    def generate_note_latex(self, name: str, summary: str, materials: list[Attachment],
                             pyqs: list[Attachment], sibling_names=None,
                             extra_instructions: str = "", enhancement_keys=None,
                             should_cancel=None) -> str:
        """Generate the LaTeX body of a single concept's note."""
        raise NotImplementedError

    @abstractmethod
    def repair_note_latex(self, name: str, broken_body: str, error: str, should_cancel=None) -> str:
        """Fix a note body that failed to compile, given the compiler error."""
        raise NotImplementedError

    @abstractmethod
    def generate_quiz(self, name: str, summary: str, materials: list[Attachment],
                       pyqs: list[Attachment], sibling_names=None, should_cancel=None) -> list[QuizQuestion]:
        """Generate a quiz (concept + PYQ style questions) for one concept."""
        raise NotImplementedError

    @abstractmethod
    def stream_answer(self, system: str, user: str, image: str | None = None, should_cancel=None):
        """Stream a study-assistant answer to a highlight/snip "ask AI" question.

        system/user are the prompt pair from build_ask_messages(). image, when
        given, is a base64 data: URL string (e.g. "data:image/png;base64,...")
        for a single optional screenshot crop. Yields answer text chunks as
        they arrive (a generator); should_cancel, if given, is a zero-arg
        callable checked between chunks — raise AICancelled to stop early
        (mirrors the note-generation streaming path's cancellation).
        """
        raise NotImplementedError


# ---------------------------------------------------------------------------
# File / JSON helpers for future adapters (not needed by Gemini today, since
# it reads files natively via the File API — defined now per the Phase A1
# spec so later adapters (e.g. text-only APIs) can reuse them).
# ---------------------------------------------------------------------------

def read_bytes(att: Attachment) -> bytes:
    """Read an attachment's file bytes from disk."""
    with open(att.disk_path, "rb") as fh:
        return fh.read()


def is_pdf(mime: str) -> bool:
    return (mime or "").lower() == "application/pdf"


def is_image(mime: str) -> bool:
    return (mime or "").lower().startswith("image/")


def data_url(data: bytes, mime: str) -> str:
    """Base64 data: URL for embedding a file inline in a text-only prompt."""
    import base64
    b64 = base64.b64encode(data).decode("ascii")
    return f"data:{mime};base64,{b64}"


def parse_data_url(url: str) -> tuple[str, str]:
    """Split a base64 data: URL ("data:image/png;base64,....") into
    (mime, base64_str) — the inverse of data_url(), minus the decode step
    (callers that need raw bytes, e.g. Gemini's Part.from_bytes, base64-decode
    the returned string themselves; callers that want a base64 string, e.g.
    Anthropic's image source block, use it directly).

    Raises ValueError if `url` isn't a well-formed data: URL.
    """
    if not url or not url.startswith("data:") or "," not in url:
        raise ValueError("Not a valid data: URL")
    header, b64 = url.split(",", 1)
    if not b64:
        raise ValueError("Malformed data: URL (empty payload)")
    mime = header[5:].split(";")[0] or "application/octet-stream"
    return mime, b64


def pdf_to_text(disk_path) -> str:
    """Extract plain text from a PDF via pypdfium2, page by page.

    For adapters without native PDF understanding — not used by the Gemini
    adapter, which reads PDFs directly through the File API.
    """
    import pypdfium2 as pdfium
    doc = pdfium.PdfDocument(str(disk_path))
    try:
        parts = []
        for page in doc:
            textpage = page.get_textpage()
            try:
                parts.append(textpage.get_text_range())
            finally:
                textpage.close()
            page.close()
        return "\n\n".join(parts)
    finally:
        doc.close()


def parse_json_list(text: str, model) -> list:
    """Parse a JSON array of objects out of raw model text and validate each
    element against a Pydantic model.

    Tolerates a ```json ... ``` (or bare ```) fence around the array and any
    leading/trailing prose by locating the outermost [...] span. Raises a
    clear RuntimeError if no JSON array can be found/parsed.
    """
    raw = (text or "").strip()
    if not raw:
        raise RuntimeError("Model returned an empty response.")
    if raw.startswith("```"):
        # Strip a leading ```json / ``` fence and a trailing ``` fence.
        raw = raw[3:]
        if raw.lstrip().startswith("json"):
            raw = raw.lstrip()[4:]
        if raw.rstrip().endswith("```"):
            raw = raw.rstrip()[:-3]
        raw = raw.strip()
    start = raw.find("[")
    end = raw.rfind("]")
    if start == -1 or end == -1 or end < start:
        raise RuntimeError("Model response did not contain a JSON array.")
    data = json.loads(raw[start:end + 1])
    return [model(**d) for d in data]
