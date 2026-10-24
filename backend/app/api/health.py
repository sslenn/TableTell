"""
System Health and Diagnostics Endpoint for Production Monitoring.
"""

import shutil
import sqlite3
import datetime
from fastapi import APIRouter
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.analytics.executor import query_executor

router = APIRouter(prefix="/health", tags=["System Health"])


@router.get("")
async def get_health_status():
    """
    Returns real-time health metrics including SQLite database integrity,
    DuckDB engine state, data lake storage consumption, and AI provider status.
    """
    health_status = "healthy"
    diagnostics = {}

    # 1. SQLite Metadata DB Check
    try:
        datasets = metadata_repo.list_datasets()
        datasets_count = len(datasets)
        diagnostics["metadata_db"] = {
            "status": "connected",
            "datasets_count": datasets_count,
            "db_path": str(settings.METADATA_DB_PATH)
        }
    except Exception as e:
        health_status = "degraded"
        diagnostics["metadata_db"] = {
            "status": "error",
            "error": str(e)
        }

    # 2. DuckDB Engine Check
    try:
        rows = query_executor.conn.execute("SELECT 1 AS probe, 'ready' AS status").fetchall()
        duckdb_ready = len(rows) > 0 and rows[0][0] == 1
        diagnostics["duckdb_engine"] = {
            "status": "ready" if duckdb_ready else "error",
            "in_memory_catalog": True
        }
        if not duckdb_ready:
            health_status = "degraded"
    except Exception as e:
        health_status = "degraded"
        diagnostics["duckdb_engine"] = {
            "status": "error",
            "error": str(e)
        }

    # 3. Data Lake Disk Usage
    try:
        lake_path = settings.DATA_LAKE_DIR
        raw_files = list(settings.RAW_DIR.glob("*")) if settings.RAW_DIR.exists() else []
        proc_files = list(settings.PROCESSED_DIR.glob("*.parquet")) if settings.PROCESSED_DIR.exists() else []

        total_bytes = 0
        if lake_path.exists():
            for f in lake_path.rglob("*"):
                if f.is_file():
                    total_bytes += f.stat().st_size

        total_mb = round(total_bytes / (1024 * 1024), 2)

        # Host disk partition space
        disk_usage = shutil.disk_usage(lake_path)
        diagnostics["storage"] = {
            "data_lake_size_mb": total_mb,
            "raw_files_count": len(raw_files),
            "processed_parquet_count": len(proc_files),
            "disk_free_gb": round(disk_usage.free / (1024**3), 2),
            "disk_total_gb": round(disk_usage.total / (1024**3), 2)
        }
    except Exception as e:
        diagnostics["storage"] = {
            "status": "warning",
            "error": str(e)
        }

    # 4. AI Provider Configuration Check
    diagnostics["ai_engine"] = {
        "provider": "Google Gemini",
        "model": settings.DEFAULT_MODEL,
        "api_key_configured": bool(settings.GEMINI_API_KEY.strip())
    }

    return {
        "status": health_status,
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "diagnostics": diagnostics
    }
