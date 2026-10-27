"""
Pydantic schemas for Analytical Queries, Chat, Charts, and Run Lineage.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class ChatRequest(BaseModel):
    dataset_id: str
    query: str
    version: Optional[int] = None
    max_retries: int = 2


class TableResult(BaseModel):
    columns: List[str] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    row_count: int = 0
    duration_ms: float = 0.0


class ChatResponsePayload(BaseModel):
    status: str
    summary: Optional[str] = None
    sql: Optional[str] = None
    plotly_spec: Optional[Dict[str, Any]] = None
    table: TableResult
    self_healed: bool = False
    retries: int = 0
    dataset_id: Optional[str] = None
    version: int = 1
    run_id: Optional[str] = None


class AnalyticalRunDetail(BaseModel):
    id: str
    dataset_id: str
    dataset_version: int
    user_query: str
    generated_sql: Optional[str] = None
    validation_status: str
    execution_duration_ms: float
    row_count: int
    columns: List[str] = Field(default_factory=list)
    summary_markdown: Optional[str] = None
    error: Optional[str] = None
    created_at: str


class DriverAnalysisRequest(BaseModel):
    dataset_id: str
    metric_col: Optional[str] = None
    dimension_col: Optional[str] = None
    version: Optional[int] = None
    limit: int = 15
