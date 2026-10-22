"""
TableTell Pydantic Schemas Package.
"""

from app.schemas.dataset import DatasetSummary, DatasetDetail, FileUploadResponse, DatasetVersionSummary
from app.schemas.quality import ColumnStat, QualityDimensionScore, QualityIssue, DatasetAuditReport
from app.schemas.cleaning import CleaningRecommendation, CleaningPlan, CleaningExecutionRequest, CleaningResult
from app.schemas.analytics import ChatRequest, TableResult, ChatResponsePayload, AnalyticalRunDetail

__all__ = [
    "DatasetSummary",
    "DatasetDetail",
    "FileUploadResponse",
    "DatasetVersionSummary",
    "ColumnStat",
    "QualityDimensionScore",
    "QualityIssue",
    "DatasetAuditReport",
    "CleaningRecommendation",
    "CleaningPlan",
    "CleaningExecutionRequest",
    "CleaningResult",
    "ChatRequest",
    "TableResult",
    "ChatResponsePayload",
    "AnalyticalRunDetail",
]
