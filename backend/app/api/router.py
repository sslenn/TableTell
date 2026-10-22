"""
Aggregated API Router for TableTell.
"""

from fastapi import APIRouter
from app.api.datasets import router as datasets_router
from app.api.upload import router as upload_router
from app.api.cleaning import router as cleaning_router
from app.api.analytics import router as analytics_router
from app.api.chat import router as chat_router
from app.api.audit import router as audit_router

api_router = APIRouter()

# Register modular sub-routers
api_router.include_router(datasets_router)
api_router.include_router(upload_router)
api_router.include_router(cleaning_router)
api_router.include_router(analytics_router)
api_router.include_router(chat_router)
api_router.include_router(audit_router)
