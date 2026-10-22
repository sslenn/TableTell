"""
Vectorized DuckDB Profiler for TableTell.
Computes comprehensive dataset profiles, column distributions, null ratios, and duplicates.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import duckdb
import pandas as pd
from app.profiling.column_stats import classify_column_semantic_type, compute_numeric_stats
from app.profiling.distribution import compute_column_distribution, compute_dataset_distribution_topology


class DatasetProfiler:
    def __init__(self, conn: Optional[duckdb.DuckDBPyConnection] = None):
        self.conn = conn or duckdb.connect(database=":memory:")

    def profile_parquet(self, parquet_path: Path) -> Dict[str, Any]:
        """
        Profiles a Parquet file using vectorized DuckDB queries and sample analysis.
        """
        if not parquet_path.exists():
            raise FileNotFoundError(f"Parquet file not found at: {parquet_path}")

        path_str = str(parquet_path).replace("\\", "/")

        # 1. Total row count & column schema
        describe_res = self.conn.execute(f"DESCRIBE SELECT * FROM '{path_str}'").fetchall()
        columns = [row[0] for row in describe_res]
        dtypes = {row[0]: row[1] for row in describe_res}

        total_rows = self.conn.execute(f"SELECT COUNT(*) FROM '{path_str}'").fetchone()[0]

        if total_rows == 0:
            return {
                "total_rows": 0,
                "total_cols": len(columns),
                "columns": [],
                "column_names": columns,
                "dtypes": dtypes,
                "duplicate_rows": 0,
                "null_summary": {}
            }

        # 2. Vectorized null and distinct counts across all columns in a single query
        def _quote(c: str) -> str:
            return f'"{c}"'

        null_exprs = [f"COUNT(*) - COUNT({_quote(col)}) AS null_{idx}" for idx, col in enumerate(columns)]
        dist_exprs = [f"COUNT(DISTINCT {_quote(col)}) AS dist_{idx}" for idx, col in enumerate(columns)]
        stats_query = f"SELECT {', '.join(null_exprs)}, {', '.join(dist_exprs)} FROM '{path_str}'"
        stats_row = self.conn.execute(stats_query).fetchone()

        num_cols = len(columns)
        null_counts = stats_row[:num_cols]
        dist_counts = stats_row[num_cols:]

        # 3. Duplicate row check
        dup_query = f"SELECT (SELECT COUNT(*) FROM '{path_str}') - (SELECT COUNT(*) FROM (SELECT DISTINCT * FROM '{path_str}'))"
        duplicate_rows = int(self.conn.execute(dup_query).fetchone()[0])

        # 4. Fetch sample for detailed distribution & outlier analysis (up to 5,000 rows)
        try:
            limit_val = min(5000, max(100, total_rows))
            sample_df = self.conn.execute(f"SELECT * FROM '{path_str}' LIMIT {limit_val}").fetchdf()
        except Exception:
            sample_df = pd.DataFrame()

        column_stats = []
        null_summary = {}

        for idx, col in enumerate(columns):
            null_c = int(null_counts[idx])
            dist_c = int(dist_counts[idx])
            pct = round((null_c / total_rows) * 100, 2) if total_rows > 0 else 0.0
            dtype = dtypes.get(col, "VARCHAR")
            semantic_type = classify_column_semantic_type(col, dtype, dist_c, total_rows)

            if null_c > 0:
                null_summary[col] = {"count": null_c, "pct": pct}

            sample_vals = []
            num_stats = {}
            dist_profile = None

            if not sample_df.empty and col in sample_df.columns:
                raw_samples = sample_df[col].dropna().unique()[:3].tolist()
                sample_vals = [
                    str(v) if not isinstance(v, (int, float, bool, str)) or pd.isna(v) else v
                    for v in raw_samples
                ]
                if semantic_type == "numeric":
                    num_stats = compute_numeric_stats(sample_df[col])
                    dist_profile = compute_column_distribution(sample_df[col], col, total_rows)

            column_stats.append({
                "column_name": col,
                "data_type": dtype,
                "semantic_type": semantic_type,
                "null_count": null_c,
                "null_pct": pct,
                "distinct_count": dist_c,
                "sample_values": sample_vals,
                "min_val": num_stats.get("min"),
                "max_val": num_stats.get("max"),
                "mean_val": num_stats.get("mean"),
                "is_identifier": semantic_type == "identifier",
                "has_outliers": num_stats.get("outlier_count", 0) > 0,
                "outlier_count": num_stats.get("outlier_count", 0),
                "outlier_pct": num_stats.get("outlier_pct", 0.0),
                "distribution": dist_profile.model_dump() if dist_profile else None
            })

        topology = compute_dataset_distribution_topology(column_stats)

        return {
            "total_rows": total_rows,
            "total_cols": len(columns),
            "columns": column_stats,
            "column_names": columns,
            "dtypes": dtypes,
            "duplicate_rows": duplicate_rows,
            "null_summary": null_summary,
            "topology": topology.model_dump()
        }


dataset_profiler = DatasetProfiler()
