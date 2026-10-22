"""
Column-level statistical analysis and type classification.
"""

from typing import Dict, Any, List, Optional
import difflib
from collections import Counter
import numpy as np
import pandas as pd


def classify_statistical_variable_type(
    col_name: str,
    dtype: str,
    distinct_count: int,
    total_rows: int,
    sample_values: Optional[List[Any]] = None
) -> Dict[str, str]:
    """
    Classifies a column into the classical statistical hierarchy:
    Variable Types
    ├── Categorical
    │   ├── Nominal
    │   └── Ordinal
    └── Numerical
        ├── Discrete
        └── Continuous
            ├── Interval
            └── Ratio

    Returns dict:
    - 'variable_type': "Categorical" | "Numerical"
    - 'statistical_type': "Nominal" | "Ordinal" | "Discrete" | "Continuous (Interval)" | "Continuous (Ratio)"
    """
    c_lower = col_name.lower().strip()
    dtype_upper = dtype.upper().strip()
    samples = sample_values or []
    str_samples = [str(s).lower().strip() for s in samples if s is not None and str(s).strip() != ""]

    # 1. Check for Ordinal (Categorical)
    ordinal_col_keywords = [
        "tier", "rating", "rank", "ranking", "level", "grade", "stage",
        "priority", "severity", "satisfaction", "sentiment", "class"
    ]
    ordinal_value_patterns = [
        {"low", "medium", "high"},
        {"poor", "fair", "good", "excellent"},
        {"bronze", "silver", "gold", "platinum", "diamond"},
        {"strongly disagree", "disagree", "neutral", "agree", "strongly agree"},
        {"small", "medium", "large"},
        {"xs", "s", "m", "l", "xl", "xxl"},
        {"never", "rarely", "sometimes", "often", "always"},
        {"beginner", "intermediate", "advanced", "expert"},
        {"first", "second", "third"}
    ]
    is_ordinal_name = any(kw in c_lower for kw in ordinal_col_keywords)
    is_numeric_rating = (
        is_ordinal_name
        and distinct_count <= 10
        and (any(t in dtype_upper for t in ["INT", "FLOAT", "DOUBLE", "NUMERIC"]) or all(s.replace(".", "", 1).isdigit() for s in str_samples if s))
    )
    is_ordinal_values = False
    if str_samples:
        for val_set in ordinal_value_patterns:
            matches = sum(1 for s in str_samples if s in val_set)
            if matches >= 2 or (len(str_samples) == 1 and matches == 1 and is_ordinal_name):
                is_ordinal_values = True
                break

    if is_ordinal_name or is_ordinal_values or is_numeric_rating:
        return {
            "variable_type": "Categorical",
            "statistical_type": "Ordinal"
        }

    # 2. Check for Identifiers, Keys, and Codes (Nominal Categorical)
    is_id_name = any(c_lower.endswith(sfx) for sfx in ["_id", "id", "no", "number", "code", "key", "guid", "uuid", "ssn", "zip", "postal"])
    if is_id_name and (distinct_count / max(1, total_rows) > 0.6 or "id" in c_lower.split("_") or "key" in c_lower.split("_")):
        return {
            "variable_type": "Categorical",
            "statistical_type": "Nominal"
        }

    # 3. Check for Booleans & Binary indicators (Nominal Categorical)
    if any(t in dtype_upper for t in ["BOOL", "BOOLEAN"]) or (distinct_count <= 2 and any(c_lower.startswith(p) for p in ["is_", "has_", "flag_"])):
        return {
            "variable_type": "Categorical",
            "statistical_type": "Nominal"
        }

    # 4. Check for Dates / Timestamps (Continuous - Interval)
    if any(t in dtype_upper for t in ["DATE", "TIME", "TIMESTAMP"]) or any(d in c_lower for d in ["date", "timestamp", "time"]):
        return {
            "variable_type": "Numerical",
            "statistical_type": "Continuous (Interval)"
        }

    # 5. Check for General Strings / Text (Nominal Categorical)
    is_numeric_type = any(t in dtype_upper for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL", "BIGINT", "SMALLINT", "TINYINT"])
    if not is_numeric_type:
        return {
            "variable_type": "Categorical",
            "statistical_type": "Nominal"
        }

    # 6. Check for Discrete Numerical (Countable whole numbers)
    discrete_keywords = [
        "quantity", "qty", "count", "num_", "number_of", "items", "units",
        "visits", "views", "clicks", "downloads", "tickets", "children",
        "attempts", "steps", "days", "months", "years_experience"
    ]
    is_integer_type = any(t in dtype_upper for t in ["INT", "BIGINT", "SMALLINT", "TINYINT", "INTEGER"])
    has_discrete_keyword = any(kw in c_lower for kw in discrete_keywords)

    if (is_integer_type and has_discrete_keyword) or (is_integer_type and not any(r in c_lower for r in ["price", "cost", "revenue", "amount", "salary", "rate", "pct", "percent"])):
        if c_lower in ["year", "yr", "birth_year"]:
            return {
                "variable_type": "Numerical",
                "statistical_type": "Continuous (Interval)"
            }
        return {
            "variable_type": "Numerical",
            "statistical_type": "Discrete"
        }

    # 7. Check for Continuous (Interval vs Ratio)
    interval_keywords = ["temperature", "temp", "temp_c", "temp_f", "latitude", "longitude", "lat", "lon", "year"]
    if any(kw in c_lower for kw in interval_keywords):
        return {
            "variable_type": "Numerical",
            "statistical_type": "Continuous (Interval)"
        }

    # Continuous - Ratio: True zero point (money, measurement, duration, weights, percentages, amounts)
    return {
        "variable_type": "Numerical",
        "statistical_type": "Continuous (Ratio)"
    }


def classify_column_semantic_type(col_name: str, dtype: str, distinct_count: int, total_rows: int) -> str:
    """
    Classifies a column into: 'identifier', 'datetime', 'numeric', 'categorical', 'boolean'.
    Maintains full backwards compatibility with analytical and SQL rules.
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


def compute_categorical_stats(
    series: pd.Series,
    distinct_count: int = 0,
    total_rows: int = 0,
    rare_threshold_pct: float = 1.0
) -> Dict[str, Any]:
    """
    Computes distribution frequencies and detects categorical anomalies:
    1. Top frequency values (value, count, pct)
    2. Rare / singleton categories (< 1% occurrence or count == 1)
    3. Casing & whitespace inconsistencies (e.g. 'Pending ' vs 'pending')
    4. Fuzzy typo / near-duplicate detection via Levenshtein / SequenceMatcher
    5. Cardinality ratios
    """
    clean_series = series.dropna().astype(str)
    if clean_series.empty:
        return {
            "top_values": [],
            "rare_categories": [],
            "rare_count": 0,
            "casing_anomalies": [],
            "whitespace_anomalies": [],
            "fuzzy_duplicates": [],
            "cardinality_ratio": 0.0,
            "is_high_cardinality": False
        }

    total_valid = len(clean_series)
    val_counts = clean_series.value_counts()

    # 1. Top categories distribution (top 10)
    top_values = [
        {
            "value": str(val),
            "count": int(count),
            "pct": round((int(count) / total_valid) * 100, 2)
        }
        for val, count in val_counts.head(10).items()
    ]

    # 2. Rare categories (< 1% frequency or single occurrences, only when total >= 10 and distinct > 2)
    rare_categories = []
    if total_valid >= 10 and len(val_counts) > 2:
        for val, count in val_counts.items():
            pct = (count / total_valid) * 100
            if pct < rare_threshold_pct or (count == 1 and len(val_counts) > 3):
                rare_categories.append({
                    "value": str(val),
                    "count": int(count),
                    "pct": round(pct, 2)
                })

    # 3. Whitespace & Casing Drift
    whitespace_anomalies = []
    normalized_map: Dict[str, str] = {}
    casing_anomalies = []

    for val in val_counts.index:
        s_val = str(val)
        if s_val != s_val.strip():
            whitespace_anomalies.append(s_val)

        canonical_key = s_val.strip().lower()
        if canonical_key in normalized_map:
            prev = normalized_map[canonical_key]
            if prev != s_val:
                casing_anomalies.append({"variant": s_val, "canonical": prev})
        else:
            normalized_map[canonical_key] = s_val

    # 4. Fuzzy Match Typo Detection (SequenceMatcher >= 0.82)
    unique_candidates = [str(v).strip() for v in val_counts.index[:50] if len(str(v).strip()) >= 3]
    fuzzy_duplicates = []
    seen_pairs = set()

    for i in range(len(unique_candidates)):
        v1 = unique_candidates[i]
        for j in range(i + 1, len(unique_candidates)):
            v2 = unique_candidates[j]
            if v1.lower() == v2.lower():
                continue
            pair_key = tuple(sorted([v1.lower(), v2.lower()]))
            if pair_key in seen_pairs:
                continue

            if abs(len(v1) - len(v2)) <= 3:
                sim = difflib.SequenceMatcher(None, v1.lower(), v2.lower()).ratio()
                if 0.82 <= sim < 1.0:
                    seen_pairs.add(pair_key)
                    c1 = int(val_counts.get(v1, 0))
                    c2 = int(val_counts.get(v2, 0))
                    canonical, original = (v1, v2) if c1 >= c2 else (v2, v1)
                    fuzzy_duplicates.append({
                        "original": original,
                        "suggested_canonical": canonical,
                        "similarity": round(sim, 2)
                    })

    # 5. Cardinality Ratio
    cardinality_ratio = round(len(val_counts) / max(1, total_rows or total_valid), 4)
    is_high_card = len(val_counts) > 30 and cardinality_ratio > 0.8

    return {
        "top_values": top_values,
        "rare_categories": rare_categories[:10],
        "rare_count": len(rare_categories),
        "casing_anomalies": casing_anomalies[:10],
        "whitespace_anomalies": whitespace_anomalies[:10],
        "fuzzy_duplicates": fuzzy_duplicates[:5],
        "cardinality_ratio": cardinality_ratio,
        "is_high_cardinality": is_high_card
    }
