"""
Vectorized Cross-Column Correlation Engine for TableTell.
Computes Pearson correlation matrix, multicollinearity alerts,
and automated feature interaction insights directly in DuckDB.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import duckdb
from app.storage.parquet_store import parquet_store


class CorrelationAnalyzer:
    def __init__(self, conn: Optional[duckdb.DuckDBPyConnection] = None):
        self.conn = conn or duckdb.connect(database=":memory:")

    def compute_correlation_matrix(
        self,
        dataset_id: str,
        version: Optional[int] = None,
        max_columns: int = 12
    ) -> Dict[str, Any]:
        """
        Computes an N x N Pearson correlation matrix for numeric columns in DuckDB.
        Identifies statistically significant pairs and multicollinearity warnings.
        """
        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)
        if not parquet_path.exists():
            raise FileNotFoundError(f"Parquet file not found for dataset '{dataset_id}'.")

        path_str = str(parquet_path).replace("\\", "/")
        safe_id = parquet_store.sanitize_id(dataset_id)
        self.conn.execute(f'CREATE OR REPLACE VIEW "{safe_id}" AS SELECT * FROM \'{path_str}\'')

        # Find numeric columns
        describe_res = self.conn.execute(f'DESCRIBE "{safe_id}"').fetchall()
        numeric_candidates = []
        for row in describe_res:
            col_name = row[0]
            col_type = str(row[1]).upper()
            c_low = col_name.lower()
            if any(t in col_type for t in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL"]):
                if not (c_low.endswith("id") or c_low.startswith("id_")):
                    numeric_candidates.append(col_name)

        if len(numeric_candidates) < 2:
            return {
                "dataset_id": dataset_id,
                "columns": numeric_candidates,
                "matrix": [],
                "significant_pairs": [],
                "collinearity_warnings": [],
                "analyst_digest": ["At least 2 numeric non-identifier columns are required to compute a correlation matrix."]
            }

        target_cols = numeric_candidates[:max_columns]
        n = len(target_cols)

        # Build vectorized CORR expressions
        corr_exprs = []
        for i in range(n):
            for j in range(i, n):
                c1 = target_cols[i]
                c2 = target_cols[j]
                if i == j:
                    corr_exprs.append(f"1.0 AS corr_{i}_{j}")
                else:
                    corr_exprs.append(f'ROUND(COALESCE(CORR("{c1}", "{c2}"), 0.0), 3) AS corr_{i}_{j}')

        query = f'SELECT {", ".join(corr_exprs)} FROM "{safe_id}"'
        try:
            row = self.conn.execute(query).fetchone()
        except Exception as e:
            return {
                "dataset_id": dataset_id,
                "columns": target_cols,
                "matrix": [],
                "significant_pairs": [],
                "collinearity_warnings": [],
                "analyst_digest": [f"Could not compute correlations: {str(e)}"]
            }

        # Build NxN symmetric matrix
        matrix: List[List[float]] = [[1.0 for _ in range(n)] for _ in range(n)]
        k = 0
        for i in range(n):
            for j in range(i, n):
                val = float(row[k]) if row[k] is not None else 0.0
                matrix[i][j] = val
                matrix[j][i] = val
                k += 1

        significant_pairs: List[Dict[str, Any]] = []
        collinearity_warnings: List[Dict[str, Any]] = []

        for i in range(n):
            for j in range(i + 1, n):
                r = matrix[i][j]
                col1 = target_cols[i]
                col2 = target_cols[j]

                # Categorize strength
                if r >= 0.70:
                    strength = "strong_positive"
                    insight = f"Strong direct relationship (r={r}): As '{col1}' rises, '{col2}' consistently increases."
                elif r <= -0.70:
                    strength = "strong_negative"
                    insight = f"Strong inverse relationship (r={r}): High '{col1}' is associated with lower '{col2}'."
                elif 0.40 <= r < 0.70:
                    strength = "moderate_positive"
                    insight = f"Moderate positive correlation (r={r}) between '{col1}' and '{col2}'."
                elif -0.70 < r <= -0.40:
                    strength = "moderate_negative"
                    insight = f"Moderate inverse correlation (r={r}) between '{col1}' and '{col2}'."
                else:
                    strength = "weak"
                    insight = f"Negligible or non-linear correlation (r={r})."

                pair_obj = {
                    "col1": col1,
                    "col2": col2,
                    "correlation": r,
                    "strength": strength,
                    "insight": insight
                }

                if abs(r) >= 0.40:
                    significant_pairs.append(pair_obj)

                # Multicollinearity warning
                if abs(r) >= 0.85:
                    collinearity_warnings.append({
                        **pair_obj,
                        "warning": f"High collinearity risk (r={r}). Consider dropping one column before linear regression or ML feature engineering to prevent variance inflation."
                    })

        significant_pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)

        # Formulate overall Analyst Digest
        analyst_digest = []
        if significant_pairs:
            top_pair = significant_pairs[0]
            analyst_digest.append(
                f"**Top Interaction**: '{top_pair['col1']}' and '{top_pair['col2']}' share the strongest correlation in the dataset (**r = {top_pair['correlation']}**)."
            )
        if collinearity_warnings:
            analyst_digest.append(
                f"⚠️ **Multicollinearity Detected**: {len(collinearity_warnings)} feature pair(s) exceed |r| ≥ 0.85, indicating redundant signal for downstream predictive modeling."
            )
        else:
            analyst_digest.append(
                "✅ **Independent Feature Signal**: No extreme collinearity (|r| ≥ 0.85) detected among analyzed numeric features."
            )

        return {
            "dataset_id": dataset_id,
            "columns": target_cols,
            "matrix": matrix,
            "significant_pairs": significant_pairs[:8],
            "collinearity_warnings": collinearity_warnings,
            "analyst_digest": analyst_digest
        }


correlation_analyzer = CorrelationAnalyzer()
