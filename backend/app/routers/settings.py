"""Owner/testing settings: runtime AI-provider switch (Gemini/OpenAI/Anthropic/
custom OpenAI-compatible) + per-provider API key + model + (for 'custom') base
URL.

Stored in the `settings` key/value table so choices take effect immediately
for the next AI call, without restarting the server or touching .env. See
`services/ai/__init__.py` for the settings-key convention: the active provider
lives at 'ai_provider'; each provider's key/model live at 'ai_key__<provider>'
/'ai_model__<provider>' EXCEPT gemini, which keeps its legacy 'gemini_api_key'
/'gemini_model' keys for back-compat.

The API key is NEVER returned in full — GET exposes only a masked indicator
(key_source + last 4 chars) so the UI can show "a key is set" without leaking
the secret back over the wire (Build 5, Step 5; generalized in the
multi-provider build).
"""
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .. import config, db
from ..services import ai

router = APIRouter()

_PROVIDERS = ["gemini", "openai", "anthropic", "custom"]


class SettingsUpdate(BaseModel):
    provider: Optional[str] = None
    api_key: Optional[str] = None
    model: Optional[str] = None
    base_url: Optional[str] = None


def _upsert(key: str, value: str) -> None:
    conn = db.get_connection()
    try:
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )
        conn.commit()
    finally:
        conn.close()


def _delete(key: str) -> None:
    conn = db.get_connection()
    try:
        conn.execute("DELETE FROM settings WHERE key = ?", (key,))
        conn.commit()
    finally:
        conn.close()


def _key_setting_name(provider: str) -> str:
    return "gemini_api_key" if provider == "gemini" else f"ai_key__{provider}"


def _model_setting_name(provider: str) -> str:
    return "gemini_model" if provider == "gemini" else f"ai_model__{provider}"


def _env_fallback_key(provider: str) -> str:
    if provider == "gemini":
        return config.GEMINI_API_KEY or ""
    if provider == "openai":
        return config.OPENAI_API_KEY or ""
    if provider == "anthropic":
        return config.ANTHROPIC_API_KEY or ""
    return ""  # custom has no env fallback


def _key_status() -> dict:
    """Masked key indicator for the ACTIVE provider."""
    provider = ai.current_provider()
    key = ai.current_key(provider)
    if not key:
        return {"key_source": "none", "key_last4": ""}
    conn = db.get_connection()
    try:
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (_key_setting_name(provider),),
        ).fetchone()
    finally:
        conn.close()
    user_set = bool(row and row["value"])
    source = "user" if user_set else ("env" if _env_fallback_key(provider) else "none")
    return {"key_source": source, "key_last4": key[-4:] if len(key) >= 4 else key}


def _settings_payload() -> dict:
    provider = ai.current_provider()
    return {
        "provider": provider,
        "providers": _PROVIDERS,
        "model": ai.current_model(provider),
        "model_suggestions": ai.available_models(provider),
        "base_url": ai.base_url() if provider == "custom" else "",
        **_key_status(),
    }


@router.get("/settings")
def get_settings():
    return _settings_payload()


@router.put("/settings")
def update_settings(payload: SettingsUpdate):
    if payload.provider is not None:
        if payload.provider not in _PROVIDERS:
            raise HTTPException(status_code=400, detail="Unknown provider")
        _upsert("ai_provider", payload.provider)

    target = payload.provider if payload.provider is not None else ai.current_provider()

    if payload.api_key is not None:
        key_name = _key_setting_name(target)
        if payload.api_key.strip():
            _upsert(key_name, payload.api_key.strip())
        else:
            # Empty string clears the override -> falls back to env/none.
            _delete(key_name)

    if payload.model is not None and payload.model.strip():
        _upsert(_model_setting_name(target), payload.model.strip())

    if payload.base_url is not None:
        # Empty clears the override -> falls back to config.OPENAI_BASE_URL/"".
        if payload.base_url.strip():
            _upsert("ai_base_url", payload.base_url.strip())
        else:
            _delete("ai_base_url")

    return _settings_payload()
