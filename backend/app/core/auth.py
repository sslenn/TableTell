"""
Clerk Authentication & Session Verification for TableTell.
Validates Bearer JWT tokens issued by Clerk against a pinned, trusted JSON Web Key Set (JWKS).
Prevents SSRF and forged-issuer JWT bypass attacks.
"""

import base64
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# Bounded cache for verified PyJWKClients keyed by trusted jwks_url
_jwks_clients: Dict[str, jwt.PyJWKClient] = {}


def _derive_issuer_from_publishable_key(pub_key: str) -> Optional[str]:
    """
    Derives the canonical Clerk issuer URL (https://<frontend-api>) from a Clerk publishable key
    (e.g. pk_test_<base64> or pk_live_<base64>).
    """
    clean = (pub_key or "").strip()
    for prefix in ("pk_test_", "pk_live_"):
        if clean.startswith(prefix):
            b64_part = clean[len(prefix):]
            padding = "=" * (-len(b64_part) % 4)
            try:
                decoded = base64.b64decode(b64_part + padding).decode("utf-8").rstrip("$").strip()
                if decoded and "." in decoded and "/" not in decoded:
                    return f"https://{decoded}"
            except Exception:
                return None
    return None


def _resolve_trusted_clerk_endpoints() -> tuple[Optional[str], Optional[str]]:
    """
    Returns (trusted_issuer, trusted_jwks_url) derived strictly from server configuration,
    never from untrusted token claims.
    """
    explicit_issuer = getattr(settings, "CLERK_ISSUER", "").strip().rstrip("/")
    explicit_jwks = getattr(settings, "CLERK_JWKS_URL", "").strip()
    derived_issuer = _derive_issuer_from_publishable_key(settings.CLERK_PUBLISHABLE_KEY)

    trusted_issuer = explicit_issuer or derived_issuer
    if explicit_jwks:
        trusted_jwks_url = explicit_jwks
        if not trusted_issuer:
            parsed = urlparse(explicit_jwks)
            if parsed.scheme and parsed.netloc:
                trusted_issuer = f"{parsed.scheme}://{parsed.netloc}"
    elif trusted_issuer:
        trusted_jwks_url = f"{trusted_issuer}/.well-known/jwks.json"
    else:
        trusted_jwks_url = None

    return trusted_issuer, trusted_jwks_url


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
        if len(_jwks_clients) >= 4:
            _jwks_clients.clear()
        _jwks_clients[jwks_url] = jwt.PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwks_clients[jwks_url]


class AuthenticatedUser:
    def __init__(self, user_id: str, email: Optional[str] = None, claims: Optional[Dict[str, Any]] = None):
        self.user_id = user_id
        self.email = email or f"{user_id}@tabletell.user"
        self.claims = claims or {}

    @property
    def is_authenticated(self) -> bool:
        return True


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """
    Verifies the Clerk JWT token from the Authorization header against the server's pinned Clerk JWKS.
    If Clerk is not configured (e.g. during local offline dev without Clerk keys),
    it allows local execution with a fallback analyst profile.
    """
    auth_enabled = bool(settings.CLERK_SECRET_KEY.strip() or settings.CLERK_PUBLISHABLE_KEY.strip())

    if not auth_enabled:
        return AuthenticatedUser(
            user_id="local_analyst",
            email="analyst@tabletell.local",
            claims={"role": "admin", "dev_mode": True}
        )

    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in to TableTell.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    trusted_issuer, trusted_jwks_url = _resolve_trusted_clerk_endpoints()
    if not trusted_jwks_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server authentication configuration error: CLERK_PUBLISHABLE_KEY or CLERK_JWKS_URL must be valid.",
        )

    try:
        # 1. Verify signing key strictly from the server-pinned JWKS URL (never from unverified token claims)
        jwks_client = get_jwks_client(trusted_jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 2. Verify signature, expiration, and issuer claim
        decode_kwargs: Dict[str, Any] = {
            "algorithms": ["RS256", "EdDSA"],
            "options": {"verify_aud": False, "require": ["exp", "sub", "iss"]},
        }
        if trusted_issuer:
            decode_kwargs["issuer"] = trusted_issuer

        payload = jwt.decode(
            token,
            signing_key.key,
            **decode_kwargs
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing subject claim.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        email = payload.get("email") or payload.get("primary_email_address")
        return AuthenticatedUser(user_id=user_id, email=email, claims=payload)

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please sign in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidIssuerError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token issuer.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        logger.warning(f"Clerk token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> AuthenticatedUser:
    """
    Returns verified authenticated user if credentials are valid,
    otherwise gracefully returns a guest analyst profile.
    """
    auth_enabled = bool(settings.CLERK_SECRET_KEY.strip() or settings.CLERK_PUBLISHABLE_KEY.strip())
    if not auth_enabled:
        return AuthenticatedUser(
            user_id="local_analyst",
            email="analyst@tabletell.local",
            claims={"role": "admin", "dev_mode": True}
        )

    if not credentials or not credentials.credentials:
        return AuthenticatedUser(
            user_id="guest_analyst",
            email="guest@tabletell.local",
            claims={"role": "guest", "guest_mode": True}
        )

    try:
        return get_current_user(credentials)
    except Exception:
        return AuthenticatedUser(
            user_id="guest_analyst",
            email="guest@tabletell.local",
            claims={"role": "guest", "guest_mode": True}
        )
