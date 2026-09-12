"""Provider dispatcher: picks the active AIProvider and re-exports the public
generation surface (extract_concepts, generate_note_latex, repair_note_latex,
generate_quiz) plus shared types/constants used elsewhere in the app.

Phase A1 wired up Gemini only. Phase A2 (this) adds OpenAI, Anthropic, and a
"custom" OpenAI-compatible provider (OpenRouter/DeepSeek/Qwen/local/etc.):
current_provider() now recognizes all four names, and provider() dispatches
to the matching adapter, cached per name and rebuilt if that provider's
key/model(/base_url) changes.

Settings-table key convention (all read defensively — any DB hiccup falls
back to the env/default, never breaks a generation call):
- 'ai_provider'            -> 'gemini' | 'openai' | 'anthropic' | 'custom'
- 'ai_key__<provider>'     -> that provider's API key
- 'ai_model__<provider>'   -> that provider's model id
- 'ai_base_url'            -> the 'custom' provider's OpenAI-compatible base URL

Gemini keeps its OWN legacy keys ('gemini_api_key' / 'gemini_model', read by
gemini_provider.current_api_key()/current_model()) for back-compat with
routers/settings.py and every existing caller — current_key()/current_model()
below dispatch straight to those for provider='gemini' rather than looking
under 'ai_key__gemini'/'ai_model__gemini', so nothing already stored in a
user's DB stops working.
"""
from ... import config, db
from .base import (
    AICancelled,
    Attachment,
    ConceptOut,
    QuizQuestion,
    NOTE_ENHANCEMENTS,
    enhancement_catalog,
    enhancement_instructions,
    valid_enhancement_keys,
    ASK_MODES,
    build_ask_messages,
)
from . import gemini_provider
from .gemini_provider import GeminiProvider, AVAILABLE_MODELS
from . import openai_provider
from .openai_provider import OpenAIProvider
from . import anthropic_provider
from .anthropic_provider import AnthropicProvider

_KNOWN_PROVIDERS = {"gemini", "openai", "anthropic", "custom"}

# Suggestion lists only (NOT a validated/gating catalog like Gemini's
# AVAILABLE_MODELS) — openai/anthropic users can still type any model id;
# 'custom' has no fixed catalog at all since it's an arbitrary endpoint.
_SUGGESTED_MODELS = {
    "openai": ["gpt-4o", "gpt-4o-mini", "o4-mini"],
    "anthropic": ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest"],
    "custom": [],
}

# Sensible fallback model when a key is set but no model has been chosen yet.
# 'custom' has none — an arbitrary endpoint has no universally-sane default.
_DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-3-5-sonnet-latest",
    "custom": "",
}

_providers = {}  # provider name -> (cache_sig, AIProvider instance)


def _setting(key: str) -> str:
    """Defensive settings-table lookup: "" on any DB hiccup or missing row."""
    try:
        conn = db.get_connection()
        try:
            row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
        finally:
            conn.close()
        if row and row["value"]:
            return row["value"]
    except Exception:
        pass
    return ""


def current_provider() -> str:
    """The active provider name: settings.ai_provider if it's a known,
    implemented provider, else 'gemini' (the default, and the only one any
    existing DB row could already imply since this key didn't exist before
    Phase A2).
    """
    val = _setting("ai_provider")
    return val if val in _KNOWN_PROVIDERS else "gemini"


def current_key(provider: str = None) -> str:
    """The API key for `provider` (default: the active provider).

    provider='gemini' dispatches straight to gemini_provider.current_api_key()
    (its own legacy 'gemini_api_key' setting / config.GEMINI_API_KEY) for
    back-compat — unchanged behavior from Phase A1. Other providers read
    'ai_key__<provider>', falling back to that provider's config.*_API_KEY env
    var (openai/anthropic); 'custom' has no env fallback (there is no single
    "the" custom endpoint to default to).
    """
    name = provider or current_provider()
    if name == "gemini":
        return gemini_provider.current_api_key()
    val = _setting(f"ai_key__{name}")
    if val:
        return val
    if name == "openai":
        return config.OPENAI_API_KEY or ""
    if name == "anthropic":
        return config.ANTHROPIC_API_KEY or ""
    return ""


def current_model(provider: str = None) -> str:
    """The model id for `provider` (default: the active provider).

    provider='gemini' dispatches straight to gemini_provider.current_model()
    (its own legacy 'gemini_model' setting / config.GEMINI_MODEL, validated
    against AVAILABLE_MODELS) for back-compat — unchanged behavior from Phase
    A1. Other providers read 'ai_model__<provider>', falling back to a
    sensible default (openai/anthropic) or "" (custom — no sane default for
    an arbitrary endpoint's model space).
    """
    name = provider or current_provider()
    if name == "gemini":
        return gemini_provider.current_model()
    val = _setting(f"ai_model__{name}")
    return val or _DEFAULT_MODELS.get(name, "")


def base_url() -> str:
    """The 'custom' provider's OpenAI-compatible base URL: settings override
    'ai_base_url' if set, else config.OPENAI_BASE_URL (.env fallback), else "".
    """
    val = _setting("ai_base_url")
    return val or (config.OPENAI_BASE_URL or "")


def available_models(provider: str = None) -> list:
    """A suggestion list of model ids for `provider` (default: the active
    provider) for a settings UI to offer — not an exhaustive or validated
    catalog the way Gemini's AVAILABLE_MODELS gates current_model().
    """
    name = provider or current_provider()
    if name == "gemini":
        return list(AVAILABLE_MODELS)
    return list(_SUGGESTED_MODELS.get(name, []))


def _provider_sig(name: str):
    """Cache-invalidation signature for `name`'s cached adapter instance."""
    if name == "custom":
        return (current_key(name), current_model(name), base_url())
    return (current_key(name), current_model(name))


def provider():
    """The active AIProvider instance, cached per provider name and rebuilt
    if that provider's key/model(/base_url, for 'custom') changes.

    Each adapter also tracks its own SDK-client rebuild-on-change internally
    (mirroring what GeminiProvider's module-level client() already did in
    Phase A1), so this cache is a (cheap, harmless) extra layer on top, not
    the only thing standing between a settings change and it taking effect.
    """
    name = current_provider()
    sig = _provider_sig(name)
    cached = _providers.get(name)
    if cached is not None and cached[0] == sig:
        return cached[1]
    if name == "openai":
        inst = OpenAIProvider("openai")
    elif name == "anthropic":
        inst = AnthropicProvider()
    elif name == "custom":
        inst = OpenAIProvider("custom")
    else:
        inst = GeminiProvider()
    _providers[name] = (sig, inst)
    return inst


def extract_concepts(materials, should_cancel=None):
    return provider().extract_concepts(materials, should_cancel=should_cancel)


def generate_note_latex(name, summary, materials, pyqs, sibling_names=None,
                         extra_instructions="", enhancement_keys=None, should_cancel=None):
    return provider().generate_note_latex(
        name, summary, materials, pyqs, sibling_names=sibling_names,
        extra_instructions=extra_instructions, enhancement_keys=enhancement_keys,
        should_cancel=should_cancel,
    )


def repair_note_latex(name, broken_body, error, should_cancel=None):
    return provider().repair_note_latex(name, broken_body, error, should_cancel=should_cancel)


def generate_quiz(name, summary, materials, pyqs, sibling_names=None, should_cancel=None):
    return provider().generate_quiz(
        name, summary, materials, pyqs, sibling_names=sibling_names, should_cancel=should_cancel,
    )


def stream_answer(system, user, image=None, should_cancel=None):
    return provider().stream_answer(system, user, image=image, should_cancel=should_cancel)


def current_api_key() -> str:
    """Back-compat no-arg alias for current_key() — the ACTIVE provider's key.
    Existing callers (services/gemini.py's re-export, routers/settings.py,
    routers/health.py) keep working unchanged: current_provider() still
    defaults to 'gemini' for any DB that never set 'ai_provider'.
    """
    return current_key()
