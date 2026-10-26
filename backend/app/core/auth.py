"""
Clerk Authentication & Session Verification for TableTell.
Validates Bearer JWT tokens issued by Clerk against their JSON Web Key Set (JWKS).
"""

import logging
from typing import Optional, Dict, Any
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

# In-memory cache for PyJWKClients keyed by jwks_url
_jwks_clients: Dict[str, jwt.PyJWKClient] = {}


def get_jwks_client(jwks_url: str) -> jwt.PyJWKClient:
    if jwks_url not in _jwks_clients:
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
    Verifies the Clerk JWT token from the Authorization header.
    If Clerk is not configured (e.g. during local offline dev without Clerk keys),
    it allows local execution with a fallback analyst profile.
    If Clerk is configured, a valid token is strictly required.
    """
    auth_enabled = bool(settings.CLERK_SECRET_KEY.strip() or settings.CLERK_PUBLISHABLE_KEY.strip())

    if not auth_enabled:
        # Development / unconfigured mode: allow seamless local testing
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

    try:
        # 1. Unverified header inspect to obtain 'kid' and 'iss'
        unverified_claims = jwt.decode(token, options={"verify_signature": False})

        iss = unverified_claims.get("iss")
        if not iss:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing issuer claim.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # 2. Determine JWKS URL
        jwks_url = settings.CLERK_JWKS_URL.strip() or f"{iss.rstrip('/')}/.well-known/jwks.json"

        # 3. Fetch signing key from JWKS
        jwks_client = get_jwks_client(jwks_url)
        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # 4. Verify signature and standard claims
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256", "EdDSA"],
            options={"verify_aud": False}
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
    except Exception as e:
        logger.warning(f"Clerk token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
