"""
Column-level statistical analysis and type classification.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd


def classify_column_semantic_type(col_name: str, dtype: str, distinct_count: int, total_rows: int) -> str:
    """
    Classifies a column into: 'identifier', 'datetime', 'numeric', 'categorical', 'boolean'.
    """
    c_lower = col_name.lower()
    dtype_upper = dtype.upper()

    # Check for identifier
    if any(c_lower.endswith(suffix) for suffix in ["_id", "id", "no", "number", "code", "key"]):
        if total_rows > 0 and (distinct_count / total_rows) > 0.7:
            return "identifier"

    # Check for datetime
    if any(t in dtype_upper for t in ["DATE", "TIME", "TIMESTAMP"]) or any(d in c_lower for d in ["date", "timestamp", "time"]):
        return "datetime"

    # Check for boolean
    if any(t in dtype_upper for t in ["BOOL", "BOOLEAN"]):
        return "boolean"

    # Check for numeric
    if any(t in dtype_upper for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL", "BIGINT"]):
        return "numeric"

    return "categorical"


def compute_numeric_stats(series: pd.Series) -> Dict[str, Any]:
    """Computes comprehensive descriptive statistics including IQR outliers for a numeric series."""
    valid_series = pd.to_numeric(series, errors="coerce").dropna()
    if valid_series.empty:
        return {
            "min": None,
            "max": None,
            "mean": None,
            "median": None,
            "std": None,
            "q25": None,
            "q75": None,
            "outlier_count": 0,
            "outlier_pct": 0.0
        }

    q25 = float(valid_series.quantile(0.25))
    q75 = float(valid_series.quantile(0.75))
    iqr = q75 - q25
    lower_bound = q25 - 1.5 * iqr
    upper_bound = q75 + 1.5 * iqr

    outliers = valid_series[(valid_series < lower_bound) | (valid_series > upper_bound)]
    outlier_count = int(len(outliers))
    outlier_pct = round((outlier_count / len(valid_series)) * 100, 2) if len(valid_series) > 0 else 0.0

    return {
        "min": round(float(valid_series.min()), 2),
        "max": round(float(valid_series.max()), 2),
        "mean": round(float(valid_series.mean()), 2),
        "median": round(float(valid_series.median()), 2),
        "std": round(float(valid_series.std()), 2) if len(valid_series) > 1 else 0.0,
        "q25": round(q25, 2),
        "q75": round(q75, 2),
        "outlier_count": outlier_count,
        "outlier_pct": outlier_pct
    }
