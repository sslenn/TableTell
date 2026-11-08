"""
Rate Limiting & BYOK (Bring Your Own Key) Governance for TableTell.
Provides:
1. Extraction and prioritization of user-provided Gemini/OpenAI API keys (BYOK).
2. Daily free query limiting (e.g. 20 queries/day per user/IP) when using hosted server key.
3. Unrestricted execution for users who provide their own API key.
"""

from datetime import datetime, timezone
from typing import Optional, Tuple, Dict, Any
from fastapi import Request, HTTPException, status
from app.core.config import settings
from app.core.auth import AuthenticatedUser
from app.storage.metadata_repo import metadata_repo


def get_client_identifier(request: Request, user: Optional[AuthenticatedUser] = None) -> str:
    """
    Identifies the caller uniquely:
    1. Authenticated user ID (if not generic local/guest)
    2. 'x-client-id' header generated and persisted by frontend in localStorage
    3. Client IP address as fallback
    """
    if user and user.user_id and user.user_id not in ("guest_analyst", "local_analyst"):
        return f"user:{user.user_id}"

    client_id = request.headers.get("x-client-id", "").strip()
    if client_id:
        return f"cid:{client_id}"

    client_ip = request.client.host if request.client else "127.0.0.1"
    # Check X-Forwarded-For if behind a proxy like Coolify / Render / Nginx
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    return f"ip:{client_ip}"


def get_custom_api_key(request: Request) -> Optional[str]:
    """
    Extracts user-provided BYOK API key from request headers.
    Supports 'X-Custom-AI-Key', 'X-Gemini-Key', or 'X-API-Key'.
    """
    for header_name in ("x-custom-ai-key", "x-gemini-key", "x-api-key"):
        val = request.headers.get(header_name, "").strip()
        if val:
            return val
    return None


def get_today_str() -> str:
    """Returns today's date string in UTC (YYYY-MM-DD)."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def check_and_apply_ai_access(
    request: Request,
    user: Optional[AuthenticatedUser] = None,
    increment: bool = True
) -> Dict[str, Any]:
    """
    Validates whether the incoming request is authorized to perform AI inference.
    Returns:
        {
            "api_key": Optional[str],  # Custom key if provided, else None (uses server default)
            "is_byok": bool,
            "used_today": int,
            "remaining": Optional[int],
            "limit": int
        }
    Raises:
        HTTPException(400) if no API key is available (server key missing and no BYOK).
        HTTPException(429) if daily free query limit has been exceeded.
    """
    custom_key = get_custom_api_key(request) if settings.ALLOW_BYOK else None

    # Case 1: User brings their own API key (BYOK) -> Unlimited, bypass rate limit
    if custom_key:
        return {
            "api_key": custom_key,
            "is_byok": True,
            "used_today": 0,
            "remaining": None,
            "limit": settings.DAILY_FREE_QUERIES_LIMIT
        }

    # Case 2: Relying on the server's hosted default API key
    server_has_key = bool(
        settings.AI_API_KEY.strip()
        or settings.GEMINI_API_KEY.strip()
        or settings.GOOGLE_API_KEY.strip()
    )

    if not server_has_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                "No AI API key is configured on this server. "
                "Please add your own free Gemini API key in Settings (BYOK) to run analysis."
            )
        )

    if not settings.ENABLE_DAILY_LIMITS:
        return {
            "api_key": None,
            "is_byok": False,
            "used_today": 0,
            "remaining": None,
            "limit": settings.DAILY_FREE_QUERIES_LIMIT
        }

    # Check daily usage
    today_str = get_today_str()
    client_id = get_client_identifier(request, user)
    used_today = metadata_repo.get_daily_usage(client_id, today_str)

    if used_today >= settings.DAILY_FREE_QUERIES_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You have reached your daily free limit of {settings.DAILY_FREE_QUERIES_LIMIT} queries. "
                "To continue analyzing without limits, please add your own free Google Gemini API key in Settings (BYOK)."
            )
        )

    if increment:
        used_today = metadata_repo.record_usage(client_id, today_str)

    remaining = max(0, settings.DAILY_FREE_QUERIES_LIMIT - used_today)

    return {
        "api_key": None,
        "is_byok": False,
        "used_today": used_today,
        "remaining": remaining,
        "limit": settings.DAILY_FREE_QUERIES_LIMIT
    }


def get_current_quota_status(
    request: Request,
    user: Optional[AuthenticatedUser] = None
) -> Dict[str, Any]:
    """
    Returns non-mutating quota status for the current client to display in the frontend UI.
    """
    custom_key = get_custom_api_key(request) if settings.ALLOW_BYOK else None
    server_has_key = bool(
        settings.AI_API_KEY.strip()
        or settings.GEMINI_API_KEY.strip()
        or settings.GOOGLE_API_KEY.strip()
    )

    if custom_key:
        return {
            "byok_active": True,
            "daily_limit": None,
            "used_today": 0,
            "remaining": None,
            "resets_at": None,
            "server_has_default_key": server_has_key,
            "byok_key_preview": f"{custom_key[:4]}...{custom_key[-4:]}" if len(custom_key) > 8 else "***"
        }

    today_str = get_today_str()
    client_id = get_client_identifier(request, user)
    used_today = metadata_repo.get_daily_usage(client_id, today_str)
    limit = settings.DAILY_FREE_QUERIES_LIMIT
    remaining = max(0, limit - used_today)

    # Next reset is midnight UTC
    now_utc = datetime.now(timezone.utc)
    resets_at = f"{today_str}T23:59:59Z"

    return {
        "byok_active": False,
        "daily_limit": limit if settings.ENABLE_DAILY_LIMITS else None,
        "used_today": used_today,
        "remaining": remaining if settings.ENABLE_DAILY_LIMITS else None,
        "resets_at": resets_at,
        "server_has_default_key": server_has_key,
        "byok_key_preview": None
    }
