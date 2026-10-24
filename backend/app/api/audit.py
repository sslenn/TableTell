"""
API endpoints for System Audit Lineage, Traceability, and Dataset Health Audits.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.storage.metadata_repo import metadata_repo
from app.services.quality_service import quality_service
from app.services.cleaning_service import cleaning_pipeline
from app.services.dataset_service import dataset_service
from app.analytics.executor import query_executor

router = APIRouter(prefix="", tags=["Health Audit & System Lineage"])


@router.get("/audit", response_model=Dict[str, Any])
async def get_system_audit_logs(limit: int = Query(100, ge=1, le=500)):
    """Returns chronologically ordered system audit logs and data transformations."""
    logs = metadata_repo.list_audit_logs(limit=limit)
    return {"status": "success", "logs": logs}


# =====================================================================
# Backward Compatibility Dataset Aliases
# =====================================================================

@router.get("/datasets/{dataset_id}/audit", response_model=Dict[str, Any], include_in_schema=False)
async def legacy_audit_dataset(dataset_id: str):
    try:
        audit = quality_service.get_dataset_audit(dataset_id)
        return {"status": "success", "data": audit.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Audit failed: {str(e)}")


@router.post("/datasets/{dataset_id}/clean", response_model=Dict[str, Any], include_in_schema=False)
async def legacy_clean_dataset(dataset_id: str):
    try:
        result = cleaning_pipeline.clean_dataset(dataset_id)
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")


@router.get("/datasets/{dataset_id}/preview", response_model=Dict[str, Any], include_in_schema=False)
async def legacy_preview_dataset(dataset_id: str, limit: int = 10):
    try:
        sql = f'SELECT * FROM "{dataset_id}" LIMIT {limit}'
        res = query_executor.execute_query(dataset_id, sql, max_rows=limit)
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")
