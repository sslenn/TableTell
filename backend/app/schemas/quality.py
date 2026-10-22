"""
Pydantic schemas for Data Quality, Profiling, and Health Audits.
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional


class HistogramBin(BaseModel):
    bin_start: float
    bin_end: float
    bin_label: str
    count: int
    pct: float


class BoxPlotStats(BaseModel):
    min: Optional[float] = None
    q25: Optional[float] = None
    median: Optional[float] = None
    q75: Optional[float] = None
    max: Optional[float] = None
    lower_bound: Optional[float] = None
    upper_bound: Optional[float] = None
    outliers: List[float] = Field(default_factory=list)


class DistributionProfile(BaseModel):
    distribution_type: str
    confidence: float
    skewness: Optional[float] = None
    kurtosis: Optional[float] = None
    mean_median_ratio: Optional[float] = None
    modality: str = "unimodal"
    is_symmetric: bool = False
    summary: str
    business_recommendation: str
    bins: List[HistogramBin] = Field(default_factory=list)
    box_plot: Optional[BoxPlotStats] = None
    density_curve: List[Dict[str, float]] = Field(default_factory=list)


class ColumnStat(BaseModel):
    column_name: str
    data_type: str
    semantic_type: Optional[str] = "categorical"
    variable_type: Optional[str] = "Categorical"
    statistical_type: Optional[str] = "Nominal"
    null_count: int
    null_pct: float
    distinct_count: int
    sample_values: List[Any] = Field(default_factory=list)
    min_val: Optional[Any] = None
    max_val: Optional[Any] = None
    mean_val: Optional[float] = None
    is_identifier: bool = False
    has_outliers: bool = False
    outlier_count: int = 0
    outlier_pct: float = 0.0
    distribution: Optional[DistributionProfile] = None
    categorical_stats: Optional[Dict[str, Any]] = None


class DimensionAuditRule(BaseModel):
    rule_name: str
    passed: bool
    description: str


class QualityDimensionScore(BaseModel):
    dimension: str
    weight: float
    score: int
    checks_passed: int
    checks_failed: int
    explanation: str
    rules_checked: List[DimensionAuditRule] = Field(default_factory=list)


class QualityIssue(BaseModel):
    rule_id: str
    dimension: str
    severity: str  # "critical" | "warning" | "info"
    affected_columns: List[str]
    affected_rows: int
    affected_pct: float
    evidence: str
    proposed_action: str
    approval_required: bool = True


class DatasetDistributionTopology(BaseModel):
    total_analyzed: int
    normal_count: int
    skewed_count: int
    uniform_count: int
    multimodal_count: int
    categorical_count: int
    key_findings: List[str] = Field(default_factory=list)


class DatasetAuditReport(BaseModel):
    dataset_id: str
    version: int = 1
    total_rows: int
    total_cols: int
    data_health_score: int
    duplicate_rows: int
    columns: List[ColumnStat] = Field(default_factory=list)
    column_names: List[str] = Field(default_factory=list)
    dtypes: Dict[str, str] = Field(default_factory=dict)
    null_summary: Dict[str, Dict[str, Any]] = Field(default_factory=dict)
    dimensions: List[QualityDimensionScore] = Field(default_factory=list)
    issues: List[str] = Field(default_factory=list)
    structured_issues: List[QualityIssue] = Field(default_factory=list)
    cleaning_recommendations: List[str] = Field(default_factory=list)
    topology: Optional[DatasetDistributionTopology] = None
