"""
Pydantic schemas for Data Cleaning, Plans, Approvals, and Execution.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class CleaningRecommendation(BaseModel):
    recommendation_id: str
    rule_id: str
    action_type: str
    affected_columns: List[str]
    affected_rows: int
    affected_pct: float
    evidence: str
    proposed_action: str
    reason: str
    expected_impact: str
    risk_level: str  # "low" | "medium" | "high"
    approval_required: bool = True
    approved: bool = True
    parameters: Dict[str, Any] = Field(default_factory=dict)


class CleaningPlan(BaseModel):
    plan_id: str
    dataset_id: str
    source_version: int
    created_at: str
    recommendations: List[CleaningRecommendation] = Field(default_factory=list)


class CleaningExecutionRequest(BaseModel):
    approved_recommendation_ids: Optional[List[str]] = None
    target_version_description: Optional[str] = "Auto-cleaned dataset version"


class CleaningResult(BaseModel):
    status: str
    original_dataset_id: str
    cleaned_dataset_id: str
    source_version: int = 1
    new_version: int = 2
    original_rows: int
    cleaned_rows: int
    removed_duplicates: int
    imputed_nulls: int
    clean_parquet_file: str
    health_score_before: int
    health_score_after: int
    changelog: List[str] = Field(default_factory=list)
    total_rows_after: int
    parquet_path: str
