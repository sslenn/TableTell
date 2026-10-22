"""
Pydantic schemas for Datasets and Ingestion.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class DatasetSummary(BaseModel):
    dataset_id: str
    filename: str
    total_rows: int
    total_cols: int
    data_health_score: int
    size_kb: float
    current_version: int = 1
    source_format: str = "csv"


class DatasetVersionSummary(BaseModel):
    version: int
    parent_version: Optional[int] = None
    created_at: str
    row_count: int
    col_count: int
    size_bytes: int
    quality_score: int
    changelog: List[str] = Field(default_factory=list)


class DatasetDetail(BaseModel):
    id: str
    name: str
    original_filename: str
    source_format: str
    current_version: int
    created_at: str
    updated_at: str
    description: Optional[str] = ""
    versions: List[DatasetVersionSummary] = Field(default_factory=list)


class FileUploadResponse(BaseModel):
    status: str
    message: str
    data: Dict[str, Any]
