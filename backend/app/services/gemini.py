"""Back-compat shim: Axiom's AI layer was refactored (Phase A1) into a
provider abstraction under services/ai/ (services/ai/base.py — provider-
agnostic core; services/ai/gemini_provider.py — the Gemini adapter;
services/ai/__init__.py — the dispatcher). Only Gemini is wired for now, so
the app behaves exactly as before this refactor, just through a clean seam.

This module re-exports the same public names the rest of the app already
imports as `gemini.X` (routers, generation_service, quiz_service) so nothing
else needs to change in this phase. New code should prefer importing
`services.ai` directly; this shim exists only so existing
`from ..services import gemini` / `gemini.X` call sites keep working
unchanged.
"""
from .ai import (
    extract_concepts,
    generate_note_latex,
    repair_note_latex,
    generate_quiz,
    NOTE_ENHANCEMENTS,
    enhancement_catalog,
    enhancement_instructions,
    valid_enhancement_keys,
    ConceptOut,
    QuizQuestion,
    current_model,
    current_api_key,
    AVAILABLE_MODELS,
    current_provider,
)
from .ai.base import AICancelled as GeminiCancelled

# A few call sites reach past the dispatcher into Gemini-specific internals
# (health.py only uses current_api_key() above, but keep these alive in case
# anything else ever does `gemini.client()` / `gemini.get_file()` etc.).
from .ai.gemini_provider import client, get_file, delete_file, upload_and_activate, state_of

__all__ = [
    "extract_concepts",
    "generate_note_latex",
    "repair_note_latex",
    "generate_quiz",
    "NOTE_ENHANCEMENTS",
    "enhancement_catalog",
    "enhancement_instructions",
    "valid_enhancement_keys",
    "ConceptOut",
    "QuizQuestion",
    "current_model",
    "current_api_key",
    "AVAILABLE_MODELS",
    "current_provider",
    "GeminiCancelled",
    "client",
    "get_file",
    "delete_file",
    "upload_and_activate",
    "state_of",
]
