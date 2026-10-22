"""
API endpoints for Dataset Catalog, Schema, Preview, Profiling, and Versions.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store
from app.analytics.executor import query_executor
from app.schemas.dataset import DatasetSummary, DatasetDetail
from app.schemas.quality import DatasetAuditReport

router = APIRouter(prefix="/datasets", tags=["Datasets & Catalog"])


@router.get("", response_model=Dict[str, Any])
async def list_datasets():
    """Lists all available datasets in the catalog with cached health scores and metrics."""
    try:
        datasets = dataset_service.list_datasets()
        return {"status": "success", "datasets": datasets}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")


@router.get("/{dataset_id}", response_model=Dict[str, Any])
async def get_dataset(dataset_id: str):
    """Returns dataset details, version history, and lineage."""
    try:
        detail = dataset_service.get_dataset_detail(dataset_id)
        return {"status": "success", "data": detail}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{dataset_id}/preview", response_model=Dict[str, Any])
async def preview_dataset(
    dataset_id: str,
    limit: int = Query(10, ge=1, le=200),
    version: Optional[int] = Query(None)
):
    """Returns top rows of a dataset for tabular preview."""
    try:
        sql = f'SELECT * FROM "{dataset_id}" LIMIT {limit}'
        res = query_executor.execute_query(dataset_id, sql, version=version, max_rows=limit)
        return {"status": "success", "data": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")


@router.get("/{dataset_id}/audit", response_model=Dict[str, Any])
@router.get("/{dataset_id}/quality", response_model=Dict[str, Any])
@router.get("/{dataset_id}/profile", response_model=Dict[str, Any])
async def audit_dataset(
    dataset_id: str,
    version: Optional[int] = Query(None),
    refresh: bool = Query(False)
):
    """Returns the comprehensive multi-dimensional data quality audit and health score."""
    try:
        audit = quality_service.get_dataset_audit(dataset_id, version=version, force_recompute=refresh)
        return {"status": "success", "data": audit.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Audit failed: {str(e)}")


@router.get("/{dataset_id}/versions", response_model=Dict[str, Any])
async def list_versions(dataset_id: str):
    """Returns all recorded versions and transformations for a dataset."""
    try:
        versions = metadata_repo.list_versions(dataset_id)
        return {"status": "success", "data": versions}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch versions: {str(e)}")
