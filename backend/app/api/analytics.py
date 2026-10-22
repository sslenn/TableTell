"""
API endpoints for Direct Analytical Queries and Run Lineage.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any, Optional
from app.services.analytics_service import analytics_service
from app.storage.metadata_repo import metadata_repo
from app.schemas.analytics import ChatRequest, ChatResponsePayload, AnalyticalRunDetail

router = APIRouter(prefix="/analytics", tags=["Analytics & Lineage"])


@router.post("/query", response_model=ChatResponsePayload)
async def execute_query(req: ChatRequest):
    """
    Direct analytical query endpoint returning verified DuckDB table,
    Plotly chart specification, and executive takeaway.
    """
    try:
        return analytics_service.process_query(
            dataset_id=req.dataset_id,
            user_query=req.query,
            version=req.version,
            max_retries=req.max_retries
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")


@router.get("/runs", response_model=Dict[str, Any])
async def list_analytical_runs(
    dataset_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200)
):
    """Lists audit lineage for past analytical queries."""
    try:
        runs = metadata_repo.list_analytical_runs(dataset_id=dataset_id, limit=limit)
        return {"status": "success", "runs": runs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch runs: {str(e)}")


@router.get("/runs/{run_id}", response_model=Dict[str, Any])
async def get_analytical_run(run_id: str):
    """Retrieves full trace for a specific analytical run."""
    run = metadata_repo.get_analytical_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return {"status": "success", "data": run}
