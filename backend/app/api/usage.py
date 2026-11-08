"""
API endpoints for TableTell AI Quota & BYOK (Bring Your Own Key) Verification.
"""

import logging
from typing import Dict, Any, Optional
from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, Field
from app.core.auth import get_optional_user, AuthenticatedUser
from app.core.rate_limit import get_current_quota_status
from app.analytics.sql_generator import get_gemini_client
from app.core.config import settings

logger = logging.getLogger("tabletell.usage")

router = APIRouter(prefix="/usage", tags=["AI Quota & BYOK Settings"])


class VerifyKeyRequest(BaseModel):
    api_key: str = Field(..., min_length=5, max_length=256, description="Gemini or OpenAI API key to verify")


@router.get("/quota")
async def get_quota_endpoint(
    request: Request,
    current_user: AuthenticatedUser = Depends(get_optional_user)
) -> Dict[str, Any]:
    """
    Returns live quota metrics for the current user/client:
    - byok_active: True if client provided their own API key header
    - daily_limit: max free queries allowed per day (e.g. 20)
    - used_today: queries used today
    - remaining: free queries remaining today
    - resets_at: UTC midnight reset timestamp
    - server_has_default_key: True if server has a default key configured
    """
    return get_current_quota_status(request, current_user)


@router.post("/verify-key")
async def verify_key_endpoint(body: VerifyKeyRequest) -> Dict[str, Any]:
    """
    Verifies that a user-provided API key is valid by sending a lightweight test request.
    """
    key = body.api_key.strip()
    if not key:
        return {"valid": False, "error": "API key cannot be empty."}

    client = get_gemini_client(api_key=key)
    if not client:
        return {"valid": False, "error": "Unsupported key format. Must be a Gemini (AIza...) or OpenAI (sk-...) API key."}

    try:
        # Perform 1-word smoke test with low temperature and short timeout
        model_name = settings.DEFAULT_MODEL
        resp = client.models.generate_content(
            model=model_name,
            contents="Say 'OK'."
        )
        if resp and resp.text:
            provider = "Google Gemini" if key.startswith(("AIza", "AQ.")) else "AI Router / OpenAI"
            return {
                "valid": True,
                "provider": provider,
                "message": "Key verified successfully!"
            }
        return {"valid": False, "error": "No response returned from AI provider."}
    except Exception as e:
        logger.warning(f"Key verification failed: {e}")
        err_msg = str(e)
        if "API_KEY_INVALID" in err_msg or "400" in err_msg or "401" in err_msg or "403" in err_msg:
            return {"valid": False, "error": "Invalid API key. Please check that you copied the complete key."}
        return {"valid": False, "error": f"Verification failed: {err_msg[:120]}"}
