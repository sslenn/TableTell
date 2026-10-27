"""
Aggregated API Router for TableTell.
"""

from fastapi import APIRouter, Depends
from app.core.config import settings
from app.core.auth import get_current_user, get_optional_user
from app.api.datasets import router as datasets_router
from app.api.upload import router as upload_router
from app.api.cleaning import router as cleaning_router
from app.api.analytics import router as analytics_router
from app.api.chat import router as chat_router
from app.api.audit import router as audit_router
from app.api.assistant import router as assistant_router
from app.api.health import router as health_router

api_router = APIRouter()

# Public bootstrap endpoint: allows frontend to dynamically discover Clerk publishable key
# even if not baked into Vite at build time (e.g. Coolify / Docker runtime environment variables)
@api_router.get("/auth/config", tags=["Auth Configuration"])
async def get_auth_config():
    publishable_key = settings.CLERK_PUBLISHABLE_KEY.strip()
    return {
        "enabled": bool(publishable_key),
        "publishable_key": publishable_key
    }

# Authenticated analytical dependencies (Clerk JWT validation)
protected_deps = [Depends(get_current_user)]

# Register modular sub-routers
api_router.include_router(datasets_router, dependencies=protected_deps)
api_router.include_router(upload_router, dependencies=protected_deps)
api_router.include_router(cleaning_router, dependencies=protected_deps)
api_router.include_router(analytics_router, dependencies=protected_deps)
api_router.include_router(chat_router, dependencies=protected_deps)
api_router.include_router(audit_router, dependencies=protected_deps)
api_router.include_router(assistant_router, dependencies=[Depends(get_optional_user)])

# Public endpoints (Docker and Coolify healthchecks)
api_router.include_router(health_router)
