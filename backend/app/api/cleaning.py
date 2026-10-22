"""
API endpoints for Data Cleaning Plans, User Approvals, and Execution.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Dict, Any, Optional
from app.services.cleaning_service import cleaning_pipeline
from app.services.quality_service import quality_service
from app.cleaning.planner import cleaning_planner
from app.storage.metadata_repo import metadata_repo
from app.schemas.cleaning import CleaningPlan, CleaningExecutionRequest, CleaningResult

router = APIRouter(prefix="/datasets", tags=["Cleaning & Transformation"])


@router.post("/{dataset_id}/cleaning-plans", response_model=Dict[str, Any])
async def create_cleaning_plan(
    dataset_id: str,
    version: Optional[int] = Query(None)
):
    """
    Generates an explainable data-cleaning plan with specific recommendations
    for user review and approval prior to execution.
    """
    try:
        audit = quality_service.get_dataset_audit(dataset_id, version=version)
        plan = cleaning_planner.create_plan(audit)
        return {"status": "success", "data": plan.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate cleaning plan: {str(e)}")


@router.post("/{dataset_id}/cleaning-runs", response_model=Dict[str, Any])
@router.post("/{dataset_id}/clean", response_model=Dict[str, Any])
async def execute_cleaning(
    dataset_id: str,
    req: Optional[CleaningExecutionRequest] = Body(default=None)
):
    """
    Executes approved data transformations:
    - Normalizes headers to snake_case
    - Deduplicates records
    - Standardizes date timestamps
    - Imputes missing values
    - Creates a new dataset version (v2, v3, etc.)
    - Returns before-and-after statistics and changelog
    """
    try:
        approved_ids = req.approved_recommendation_ids if req else None
        desc = req.target_version_description if req else "User-approved cleaning run"

        result = cleaning_pipeline.clean_dataset(
            dataset_id=dataset_id,
            approved_rec_ids=approved_ids,
            description=desc or "Cleaned dataset version"
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")
