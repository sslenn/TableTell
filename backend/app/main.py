from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.router import api_router

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous AI Data Analyst backend powered by DuckDB, Parquet, and LangGraph.",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS setup for decoupled frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers under /api
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/", tags=["Health"])
async def root():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs"
    }
