"""
Pydantic schemas for Analytical Queries, Chat, Charts, and Run Lineage.
"""

import re
from pydantic import BaseModel, Field, field_validator
from typing import List, Dict, Any, Optional


class ChatRequest(BaseModel):
    dataset_id: str = Field(..., min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_\-]+$")
    query: str = Field(..., min_length=1, max_length=1000)
    version: Optional[int] = Field(default=None, ge=1, le=1000)
    max_retries: int = Field(default=2, ge=0, le=3)

    @field_validator("query")
    @classmethod
    def sanitize_query_prompt(cls, v: str) -> str:
        # Strip ASCII control characters (except standard newlines/tabs) to prevent prompt-injection smuggling
        cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", v or "").strip()
        if not cleaned:
            raise ValueError("Query cannot be empty.")
        return cleaned


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
    dataset_id: str = Field(..., min_length=1, max_length=120, pattern=r"^[a-zA-Z0-9_\-]+$")
    metric_col: Optional[str] = None
    dimension_col: Optional[str] = None
    version: Optional[int] = None
    limit: int = Field(default=15, ge=1, le=100)
