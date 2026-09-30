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

from pydantic import BaseModel, model_validator


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

    @model_validator(mode="before")
    @classmethod
    def _coerce_freeform(cls, data):
        """Free-text providers (Anthropic/OpenAI/custom) don't go through
        Gemini's response_schema, so they often name the question-type field
        "type" (Claude does), sometimes omit a minor field, or use a variant
        kind value. Normalize a dict here so a valid question isn't dropped over
        cosmetics. Gemini is unaffected — its output already matches the fields,
        and this only runs at model instantiation (no field defaults are added,
        so the response_schema stays default-free)."""
        if not isinstance(data, dict):
            return data
        d = dict(data)
        if "kind" not in d and "type" in d:
            d["kind"] = d["type"]
        k = str(d.get("kind", "")).lower()
        d["kind"] = "short" if "short" in k or "answer" in k else "mcq"
        d.setdefault("category", "concept")
        d.setdefault("options", [])
        d.setdefault("answer_index", -1)
        d.setdefault("answer_text", "")
        d.setdefault("explanation", "")
        d.setdefault("marks", 1)
        return d


class ConceptLink(BaseModel):
    """One AI-discovered relationship between two concepts (mind map edge)."""
    # No defaults on any field: the Gemini structured-output response_schema
    # rejects Pydantic fields that carry a default value (mirrors QuizQuestion).
    a: int          # concept id (from the numbered list in the prompt)
    b: int          # the other concept id
    label: str      # 3-6 word relationship name, plain text
    strength: float # 0.0-1.0


class QuestionType(BaseModel):
    """One question-type bucket found across a course's past exam papers
    (Build 12 — Question Analysis)."""
    # No defaults on any field: the Gemini structured-output response_schema
    # rejects Pydantic fields that carry a default value (mirrors QuizQuestion).
    type: str   # e.g. "MCQ", "short answer", "derivation", "proof", "numerical"
    count: int  # how many questions of this type were found across the attached papers
    note: str   # a short observation about this type


class TopicImportance(BaseModel):
    """One recurring exam topic, ranked by importance/frequency (Build 12 —
    Question Analysis)."""
    # No defaults on any field (mirrors QuizQuestion/ConceptLink).
    name: str                     # short topic label
    concept_name: str             # mapped to a course concept name, or the model's own inferred topic name
    importance: int               # 0-100
    frequency: int                # how many times a question on this topic recurs across the papers
    rationale: str                # one sentence on why this topic matters / how it's tested
    sample_questions: list[str]   # 1-3 REAL questions taken from the attached papers


class AnalysisResult(BaseModel):
    """Structured output of AIProvider.analyze_questions — a course's
    past-exam-question analysis (Build 12 — Question Analysis, Phase 1)."""
    # No defaults on any field (mirrors QuizQuestion/ConceptLink) — Gemini's
    # response_schema rejects Pydantic fields with a default value.
    question_types: list[QuestionType]
    topics: list[TopicImportance]
    patterns: list[str]     # short recurring-pattern observations
    summary: str             # short exam-strategy summary
    papers_detected: int     # best-effort count of distinct papers/sittings among the attached files
    total_questions: int     # best-effort total count of individual questions across all attached files


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
# Link discovery (Build 10 — "Constellation" curriculum mind map). A single
# text-only call over the WHOLE curriculum's concept list, asking the model to
# find genuinely-related concept pairs (mind map edges). No attachments.
# ---------------------------------------------------------------------------

_LINKS_PROMPT = (
    "You are mapping a student's curriculum as a concept graph.\n"
    "Below is the complete list of concepts the student is studying, one per line, in the form\n"
    "id | course | concept name — summary\n\n"
    "<<CONCEPTS>>\n\n"
    "Find the pairs of DIFFERENT concepts that are genuinely, specifically related — one builds on "
    "the other, they share a core technique or principle, one is a special case or application of "
    "the other, or they are commonly studied or confused together. Connections BETWEEN different "
    "courses are especially valuable when they are real (e.g. a math tool an engineering course "
    "uses) — but never invent a link just to bridge courses.\n\n"
    "Rules:\n"
    "- Return each relationship once (a-b and b-a are the same pair; never link a concept to itself).\n"
    "- Be selective: only clear, defensible relationships. Most concepts should end up with 1-3 "
    "links; a concept with zero links is fine.\n"
    "- label: 3-6 words naming the relationship (e.g. \"builds on\", \"same underlying principle\", "
    "\"applies this technique\") — plain text, no LaTeX.\n"
    "- strength: 0.0-1.0 — 1.0 means one directly depends on the other, 0.4 means loosely related.\n"
    "- a and b MUST be ids copied exactly from the list above.\n"
)


def links_prompt_text(concept_lines: str) -> str:
    """Substitute the concept list into the link-discovery prompt."""
    return _LINKS_PROMPT.replace("<<CONCEPTS>>", concept_lines)


# ---------------------------------------------------------------------------
# Question analysis (Build 12 — "Question Analysis", Phase 1). A single call
# over ONLY a course's attached past-exam-question (PYQ) files: infer the
# question-type mix, recurring patterns, and a per-topic importance ranking
# (mapped to the course's known concept names when given, else clustered from
# the questions themselves). Grounding rule preserved: this NEVER feeds
# concepts/teaching — it only reads PYQs, the same files the note pipeline
# treats as practice-style/citation source only.
# ---------------------------------------------------------------------------

_ANALYSIS_PROMPT = (
    "You are analyzing a student's PAST EXAM QUESTIONS (PYQs) for one course. The attached files are "
    "ONLY past exam papers/question sheets — analyze ONLY what is actually asked in them. Do not use "
    "outside knowledge of the subject to invent questions or topics that are not actually present in "
    "the attached files.\n\n"
    "<<CONCEPTS_BLOCK>>\n\n"
    "Produce a structured analysis:\n"
    "- question_types: the mix of question types you observe (e.g. MCQ, short answer, long answer, "
    "numerical, derivation, proof, theory, ...). For each: \"type\", \"count\" (how many questions of "
    "this type you found across all attached papers), and a short \"note\".\n"
    "- topics: the recurring TOPICS the questions test, each with:\n"
    "  - name: a short topic label\n"
    "  - concept_name: <<CONCEPT_MAP_INSTRUCTION>>\n"
    "  - importance: an integer 0-100, how heavily this topic is emphasized across the papers (weigh "
    "frequency, marks, and recurrence)\n"
    "  - frequency: how many times a question on this topic appears across the attached papers\n"
    "  - rationale: one sentence on why this topic matters / how it tends to be tested\n"
    "  - sample_questions: 1-3 REAL question(s) taken verbatim (or near-verbatim) from the attached "
    "papers that test this topic\n"
    "- patterns: a list of short observations about RECURRING PATTERNS across the papers (e.g. "
    "\"Chapter 3 appears in every paper\", \"Derivations make up about 40% of the marks\", \"Topics X "
    "and Y are always paired in the same question\")\n"
    "- summary: a short (2-4 sentence) exam-strategy summary for the student\n"
    "- papers_detected: your best-effort count of distinct exam papers/sittings among the attached files\n"
    "- total_questions: your best-effort total count of individual questions across all attached files\n\n"
    "Return ONLY the JSON object for the analysis result — no prose, no markdown fences."
)


_REVISION_PROMPT = r"""You are writing an EXAM REVISION document as LaTeX BODY content, to help a student
prepare for their upcoming exam "<<EXAM_NAME>>". It is inserted into a document whose preamble is ALREADY
loaded (never repeat it):
- \documentclass{article}; packages: amsmath, amssymb, graphicx, tcolorbox, enumitem, xcolor, hyperref, parskip.
- A custom environment \begin{practice} ... \end{practice} for exam-style problems.

This revision covers the following topics, from an analysis of past exam questions, ORDERED MOST TO LEAST
IMPORTANT. Write your \section's in EXACTLY this order (most important topic first):
<<TOPICS_BLOCK>>

CONCEPTS THIS EXAM COVERS (context only — the topics above already map to these): <<CONCEPTS_LIST>>

The attached files are labeled by role. Use ONLY the files labeled STUDY MATERIALS as the source of truth for
teaching content. NEVER introduce a topic, term, or fact that is not present in the study materials, even if
it appears in the past exam questions. The files labeled PAST EXAM QUESTIONS are ONLY for selecting real
questions to reproduce + solve and for judging importance/style — never a source of new teaching content.

Structure: one \section per topic, in the given most-to-least-important order. For each topic section:
- A CONCISE revision of the must-know points, definitions, and formulas for that topic, drawn strictly from
  the study materials. This is a REVISION, not a full lesson: be tight and high-yield — bullet points, key
  formulas in display math \[ ... \], a short worked example only where it truly clarifies. Do not pad.
- End the section with ONE \begin{practice}...\end{practice} block containing BOTH:
  (a) the highest-value ACTUAL past question(s) testing this topic (from the attached PAST EXAM QUESTION
      files, or the sample questions listed above), each reproduced faithfully as a problem, followed by a
      complete step-by-step worked solution, ending with a small italic source note on its own line, e.g.
      {\footnotesize\emph{(Source: <PYQ file name> — from the past exam questions.)}}, naming the EXACT file
      name from its "PAST EXAM FILE — <name>:" label;
  (b) a few FRESH targeted practice questions in the same style, each clearly starting with \textbf{Practice:}
      and followed by a complete worked solution, grounded strictly in the study materials, ending with
      {\footnotesize\emph{(Practice question — not from a past paper.)}} so its origin is always clear.
  If no real past question is available for a topic, use ONLY (b)-style practice questions for it — never
  fabricate a question and label it as if it came from a past paper.

RENDERING: use display math \[ ... \] for long or complex expressions rather than a long inline $...$ that
overruns a line; avoid extremely long unbreakable tokens or URLs; keep every section tight and high-yield,
not padded.

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
Begin now with the first \section (the most important topic)."""


def revision_topics_block(ranked_topics: list[dict]) -> str:
    """Render the analysis's ranked topic list into numbered prompt lines
    (most-important first — callers pass ranked_topics already sorted by
    importance descending). Each topic dict is TopicImportance-shaped
    (name/concept_name/importance/frequency/rationale/sample_questions), as
    stored in question_analysis.data_json.
    """
    if not ranked_topics:
        return "No ranked topics available — cover the exam's concepts generally, in a sensible order."
    lines = []
    for i, t in enumerate(ranked_topics, start=1):
        samples = t.get("sample_questions") or []
        sample_text = " | ".join(s for s in samples if s) or "none"
        lines.append(
            f"{i}. \"{t.get('name', '')}\" (concept: {t.get('concept_name', '')}) — "
            f"importance {t.get('importance', 0)}/100, frequency {t.get('frequency', 0)}. "
            f"{t.get('rationale', '')} Sample past questions: {sample_text}"
        )
    return "\n".join(lines)


def revision_prompt_text(exam_name: str, topics_block: str, concepts_list: str) -> str:
    """Substitute the revision prompt's placeholders."""
    return (_REVISION_PROMPT
            .replace("<<EXAM_NAME>>", exam_name or "")
            .replace("<<TOPICS_BLOCK>>", topics_block)
            .replace("<<CONCEPTS_LIST>>", concepts_list))


def analysis_prompt_text(concepts: list[dict] | None) -> str:
    """Substitute the concept list (or a no-concepts fallback) into the
    question-analysis prompt.

    concepts is a list of {"name": ..., "summary": ...}-shaped dicts (may be
    empty/None — the extraction stage may not have run yet). When given, the
    model is asked to map each topic's concept_name to the CLOSEST matching
    name from this list (copied exactly) so the analysis lines up with the
    course's actual concepts; when empty, the model clusters topics on its
    own and concept_name becomes its own inferred topic name (per ANALYSIS.md
    §8 "No concepts" edge case).
    """
    if concepts:
        lines = "\n".join(f"- {c['name']}: {(c.get('summary') or '').strip()}" for c in concepts)
        concepts_block = (
            "This course's known CONCEPTS (map each topic's concept_name to the closest one of these "
            "EXACT names when it genuinely applies):\n" + lines
        )
        concept_map_instruction = (
            "the closest matching concept name from the list above, copied EXACTLY; if truly none fit, "
            "use your own short topic name instead"
        )
    else:
        concepts_block = (
            "No course concepts are available yet — cluster the questions into your own sensible topics."
        )
        concept_map_instruction = "your own inferred topic name for this cluster (no concept list is available)"
    return (_ANALYSIS_PROMPT
            .replace("<<CONCEPTS_BLOCK>>", concepts_block)
            .replace("<<CONCEPT_MAP_INSTRUCTION>>", concept_map_instruction))


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


def build_revision_ask_messages(exam_name: str, instruction: str,
                                 selection: str = "", context: str = "",
                                 has_image: bool = False) -> tuple[str, str]:
    """Same shape as build_ask_messages, but scoped to a per-exam revision
    document instead of a per-concept lesson (a student asking about a
    passage/figure while studying their revision PDF). Copied verbatim aside
    from the system line's framing and dropping the concept-summary line
    (a revision has no single concept summary to append)."""
    system = (
        "You are a helpful study tutor. A student is asking about a specific passage or "
        f"figure from their exam revision for \"{exam_name}\". You may use general knowledge "
        "and analogies to help explain, but stay relevant to that passage and to the revision "
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
        lines.append("Nearby context from the revision:")
        lines.append(context.strip())
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
    def discover_links(self, concept_lines: str, should_cancel=None) -> list[ConceptLink]:
        """Find related concept pairs across the whole curriculum (text-only call, no attachments)."""
        raise NotImplementedError

    @abstractmethod
    def analyze_questions(self, pyqs: list[Attachment], concepts: list[dict],
                           should_cancel=None) -> AnalysisResult:
        """Analyze a course's past exam questions (PYQs) ONLY — never study
        materials — for the question-type mix, recurring patterns, and a
        per-topic importance/frequency ranking (Build 12 — Question
        Analysis). concepts is the course's known concept list (may be
        empty), used to map each topic to a concept name; see
        analysis_prompt_text for how an empty list is handled.
        """
        raise NotImplementedError

    @abstractmethod
    def generate_revision_latex(self, exam_name: str, ranked_topics: list[dict],
                                 materials: list[Attachment], pyqs: list[Attachment],
                                 concepts: list[dict], should_cancel=None) -> str:
        """Generate an exam revision document's LaTeX body (Build 12 —
        Question Analysis, Phase 3): one \\section per topic in ranked_topics'
        order (most->least important, from the course's question_analysis),
        each a concise revision of the study-materials content plus a
        practice block mixing real cited PYQs and fresh practice questions.
        Mirrors generate_note_latex's grounding rule (materials are the only
        teaching source) and streaming behavior.
        """
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


def _strip_json_fence(text: str) -> str:
    """Drop a leading ```json / ``` fence and a trailing ``` fence, and trim."""
    raw = (text or "").strip()
    if raw.startswith("```"):
        raw = raw[3:]
        if raw.lstrip().lower().startswith("json"):
            raw = raw.lstrip()[4:]
        if raw.rstrip().endswith("```"):
            raw = raw.rstrip()[:-3]
        raw = raw.strip()
    return raw


def _remove_trailing_commas(s: str) -> str:
    """Delete commas that sit right before a } or ] (a common model mistake that
    the strict json module rejects), while never touching commas inside strings."""
    out = []
    in_str = False
    esc = False
    for i, ch in enumerate(s):
        if in_str:
            out.append(ch)
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
            out.append(ch)
            continue
        if ch == ",":
            j = i + 1
            while j < len(s) and s[j] in " \t\r\n":
                j += 1
            if j < len(s) and s[j] in "]}":
                continue  # drop this trailing comma
        out.append(ch)
    return "".join(out)


def _iter_json_objects(s: str):
    """Yield each COMPLETE top-level {...} object substring, string-aware. A
    truncated trailing object (unbalanced braces) is simply never yielded, so a
    cut-off array still gives up all of its complete elements."""
    depth = 0
    in_str = False
    esc = False
    start = None
    for i, ch in enumerate(s):
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == "{":
            if depth == 0:
                start = i
            depth += 1
        elif ch == "}":
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    yield s[start:i + 1]
                    start = None


def _validate_items(data, model) -> list:
    """Validate each dict against the model, silently dropping any element that
    doesn't fit (e.g. a truncated final quiz question missing a field) — one bad
    item never sinks the whole batch."""
    out = []
    for d in data:
        if not isinstance(d, dict):
            continue
        try:
            out.append(model(**d))
        except Exception:
            continue
    return out


def parse_json_list(text: str, model) -> list:
    """Parse a JSON array of objects out of raw model text and validate each
    element against a Pydantic model — robustly, for providers (Anthropic /
    OpenAI / custom) that emit JSON as free text rather than a guaranteed schema.

    Tolerates a ```json``` fence + surrounding prose, trailing commas, one
    malformed element, and a TRUNCATED tail (a quiz cut off mid-question still
    yields every complete question). Strategy: locate the array span, try a
    strict parse first, then fall back to salvaging complete {...} objects one at
    a time. Raises RuntimeError only if nothing usable can be recovered.
    """
    raw = _strip_json_fence(text)
    if not raw:
        raise RuntimeError("Model returned an empty response.")
    start = raw.find("[")
    span = raw[start:] if start != -1 else raw
    # 1) Strict attempt on the outermost [...] span (fast path).
    end = span.rfind("]")
    if end != -1:
        try:
            data = json.loads(_remove_trailing_commas(span[:end + 1]))
            if isinstance(data, list):
                out = _validate_items(data, model)
                if out:
                    return out
        except Exception:
            pass
    # 2) Salvage: pull each complete object out individually (survives truncation
    #    and a syntax error anywhere in the array).
    objs = []
    for chunk in _iter_json_objects(span):
        try:
            objs.append(json.loads(_remove_trailing_commas(chunk)))
        except Exception:
            continue
    out = _validate_items(objs, model)
    if not out:
        raise RuntimeError("Model response did not contain a usable JSON array.")
    return out


def _close_json(s: str) -> str:
    """Best-effort close of a truncated JSON snippet: terminate an open string
    and append the missing closing brackets (string-aware bracket tracking)."""
    stack = []
    in_str = False
    esc = False
    for ch in s:
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch in "{[":
            stack.append(ch)
        elif ch == "}":
            if stack and stack[-1] == "{":
                stack.pop()
        elif ch == "]":
            if stack and stack[-1] == "[":
                stack.pop()
    suffix = '"' if in_str else ""
    for opener in reversed(stack):
        suffix += "}" if opener == "{" else "]"
    return s + suffix


def parse_json_object(text: str, model):
    """Parse a single JSON object out of raw model text and validate it against a
    Pydantic model (the single-object counterpart to parse_json_list, used by
    AnalysisResult). Tolerates a fence, surrounding prose, trailing commas, and a
    lightly truncated tail (via best-effort bracket closing)."""
    raw = _strip_json_fence(text)
    if not raw:
        raise RuntimeError("Model returned an empty response.")
    start = raw.find("{")
    if start == -1:
        raise RuntimeError("Model response did not contain a JSON object.")
    end = raw.rfind("}")
    base = raw[start:end + 1] if end > start else raw[start:]
    cleaned = _remove_trailing_commas(base)
    for attempt in (base, cleaned, _close_json(cleaned)):
        try:
            data = json.loads(attempt)
        except Exception:
            continue
        if isinstance(data, dict):
            return model(**data)
    raise RuntimeError("Model response did not contain a parseable JSON object.")
