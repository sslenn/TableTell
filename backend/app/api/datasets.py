"""
API endpoints for Dataset Catalog, Schema, Preview, Profiling, and Versions.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response, FileResponse
import pandas as pd
from typing import List, Dict, Any, Optional
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store
from app.analytics.executor import query_executor
from app.schemas.dataset import DatasetSummary, DatasetDetail
from app.schemas.quality import DatasetAuditReport
from app.core.exceptions import DatasetNotFoundError

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


@router.get("/{dataset_id}/export")
async def export_dataset(
    dataset_id: str,
    version: Optional[int] = Query(None, description="Dataset version, defaults to latest/current"),
    format: str = Query("csv", pattern="^(csv|tsv|json|parquet)$", description="Export format"),
    delimiter: Optional[str] = Query(None, description="Delimiter for CSV/TSV (e.g. ',', ';', '\\t')"),
    include_header: bool = Query(True, description="Whether to include column headers"),
    bom: bool = Query(True, description="Prepend UTF-8 BOM for Microsoft Excel compatibility"),
    filename: Optional[str] = Query(None, description="Custom filename for download")
):
    """
    Exports the entire dataset (or clean version) as a file (CSV, TSV, JSON, Parquet).
    Streams or returns full dataset without arbitrary row truncations.
    """
    try:
        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found: {str(e)}")

    try:
        # If Parquet format requested, return the parquet file directly
        if format == "parquet":
            out_name = filename or f"{dataset_id}.parquet"
            if not out_name.endswith(".parquet"):
                out_name += ".parquet"
            return FileResponse(
                path=parquet_path,
                media_type="application/octet-stream",
                filename=out_name,
                headers={"Access-Control-Expose-Headers": "Content-Disposition"}
            )

        df = pd.read_parquet(parquet_path)

        if format in ("csv", "tsv"):
            sep = delimiter if delimiter else ("\t" if format == "tsv" else ",")
            # Handle escaped tab character passed as string '\t'
            if sep in (r"\t", "\\t"):
                sep = "\t"

            csv_text = df.to_csv(index=False, sep=sep, header=include_header)

            # UTF-8 BOM for Excel compatibility
            if bom:
                content_bytes = b"\xef\xbb\xbf" + csv_text.encode("utf-8")
            else:
                content_bytes = csv_text.encode("utf-8")

            default_ext = "tsv" if sep == "\t" else "csv"
            out_name = filename or f"{dataset_id}.{default_ext}"
            if not (out_name.endswith(".csv") or out_name.endswith(".tsv")):
                out_name += f".{default_ext}"

            media_type = "text/tab-separated-values; charset=utf-8" if sep == "\t" else "text/csv; charset=utf-8"

            return Response(
                content=content_bytes,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{out_name}"',
                    "Access-Control-Expose-Headers": "Content-Disposition",
                }
            )

        elif format == "json":
            json_text = df.to_json(orient="records", indent=2, date_format="iso")
            out_name = filename or f"{dataset_id}.json"
            if not out_name.endswith(".json"):
                out_name += ".json"
            return Response(
                content=json_text.encode("utf-8"),
                media_type="application/json; charset=utf-8",
                headers={
                    "Content-Disposition": f'attachment; filename="{out_name}"',
                    "Access-Control-Expose-Headers": "Content-Disposition",
                }
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported format: {format}")

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dataset export failed: {str(e)}")


@router.delete("/{dataset_id}", response_model=Dict[str, Any])
async def delete_dataset(dataset_id: str):
    """
    Deletes an uploaded dataset, removing its metadata, versions, and lake files.
    """
    try:
        res = dataset_service.delete_dataset(dataset_id)
        return res
    except DatasetNotFoundError:
        raise HTTPException(status_code=404, detail=f"Dataset '{dataset_id}' not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete dataset: {str(e)}")


