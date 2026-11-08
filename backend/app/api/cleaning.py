"""
API endpoints for Data Cleaning Plans, User Approvals, and Execution.
"""

from fastapi import APIRouter, HTTPException, Query, Body, Depends
from typing import List, Dict, Any, Optional
from app.core.auth import get_current_user, AuthenticatedUser
from app.services.cleaning_service import cleaning_pipeline
from app.services.dataset_service import dataset_service
from app.services.quality_service import quality_service
from app.cleaning.planner import cleaning_planner
from app.storage.metadata_repo import metadata_repo
from app.schemas.cleaning import CleaningPlan, CleaningExecutionRequest, CleaningResult

router = APIRouter(prefix="/datasets", tags=["Cleaning & Transformation"])


@router.post("/{dataset_id}/cleaning-plans", response_model=Dict[str, Any])
async def create_cleaning_plan(
    dataset_id: str,
    version: Optional[int] = Query(None),
    current_user: AuthenticatedUser = Depends(get_current_user)
):
    """
    Generates an explainable data-cleaning plan with specific recommendations
    for user review and approval prior to execution.
    """
    try:
        dataset_service.get_dataset_detail(dataset_id, owner_id=current_user.user_id)
        audit = quality_service.get_dataset_audit(dataset_id, version=version)
        plan = cleaning_planner.create_plan(audit)
        return {"status": "success", "data": plan.model_dump()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate cleaning plan: {str(e)}")


@router.post("/{dataset_id}/cleaning-runs", response_model=Dict[str, Any])
@router.post("/{dataset_id}/clean", response_model=Dict[str, Any])
async def execute_cleaning(
    dataset_id: str,
    req: Optional[CleaningExecutionRequest] = Body(default=None),
    current_user: AuthenticatedUser = Depends(get_current_user)
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
        dataset_service.get_dataset_detail(dataset_id, owner_id=current_user.user_id)
        approved_ids = req.approved_recommendation_ids if req else None
        desc = req.target_version_description if req else "User-approved cleaning run"

        result = cleaning_pipeline.clean_dataset(
            dataset_id=dataset_id,
            approved_rec_ids=approved_ids,
            description=desc or "Cleaned dataset version",
            owner_id=current_user.user_id
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")
