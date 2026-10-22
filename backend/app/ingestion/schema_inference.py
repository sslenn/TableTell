"""
Schema inference and header normalization for uploaded datasets.
"""

import re
from typing import List, Dict, Any
import pyarrow.parquet as pq


def normalize_column_name(col: str) -> str:
    """Standardizes column names to clean, SQL-friendly snake_case."""
    col = str(col).strip().lower()
    col = re.sub(r"[^\w\s]", "", col)
    col = re.sub(r"\s+", "_", col)
    return col or "column"


def infer_parquet_schema(parquet_path: str) -> Dict[str, Any]:
    """Inspects a Parquet file to extract schema and column types without full table scans."""
    schema = pq.read_schema(parquet_path)
    dtypes = {}
    for name in schema.names:
        field = schema.field(name)
        dtypes[name] = str(field.type)
    return {
        "columns": schema.names,
        "dtypes": dtypes,
        "total_cols": len(schema.names)
    }
