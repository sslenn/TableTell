"""
Diagnostic Analytics & Driver Decomposition Engine for TableTell.
Calculates root-cause contribution analysis, variance attribution,
and Pareto 80/20 concentration curves using DuckDB window functions.
"""

from pathlib import Path
from typing import Dict, Any, List, Optional
import duckdb
from app.storage.parquet_store import parquet_store
from app.services.quality_service import quality_service


def _format_num(val: Any) -> str:
    if val is None:
        return "N/A"
    if isinstance(val, (int, float)):
        abs_v = abs(val)
        if abs_v >= 1_000_000_000:
            return f"{val / 1_000_000_000:.2f}B"
        if abs_v >= 1_000_000:
            return f"{val / 1_000_000:.2f}M"
        if abs_v >= 10_000:
            return f"{val / 1_000:.1f}k"
        if isinstance(val, float):
            return f"{val:.2f}"
        return f"{val:,}"
    return str(val)


class DriverAnalyzer:
    def __init__(self, conn: Optional[duckdb.DuckDBPyConnection] = None):
        self.conn = conn or duckdb.connect(database=":memory:")

    def analyze_drivers(
        self,
        dataset_id: str,
        metric_col: Optional[str] = None,
        dimension_col: Optional[str] = None,
        version: Optional[int] = None,
        limit: int = 15
    ) -> Dict[str, Any]:
        """
        Executes vectorized driver decomposition on a dataset:
        1. Identifies optimal metric & dimension if not provided
        2. Calculates volume contribution, delta vs mean, and cumulative Pareto %
        3. Generates Pareto chart specification and root-cause diagnostic findings
        """
        parquet_path = parquet_store.resolve_dataset_path(dataset_id, version=version)
        if not parquet_path.exists():
            raise FileNotFoundError(f"Dataset '{dataset_id}' not found.")

        path_str = str(parquet_path).replace("\\", "/")
        safe_id = parquet_store.sanitize_id(dataset_id)

        # Vectorized schema inspection in 1ms
        describe_res = self.conn.execute(f"DESCRIBE SELECT * FROM '{path_str}'").fetchall()
        col_names = [r[0] for r in describe_res]
        dtypes = {r[0]: str(r[1]) for r in describe_res}

        # Auto-detect metric if not supplied
        if not metric_col:
            for col in col_names:
                t = dtypes.get(col, "").upper()
                c_low = col.lower()
                if not (c_low.endswith("id") or c_low.startswith("id_")):
                    if any(nt in t for nt in ["INT", "FLOAT", "DOUBLE", "DECIMAL", "NUMERIC", "REAL"]):
                        metric_col = col
                        break
            if not metric_col:
                raise ValueError("No numeric metric column found in dataset for driver analysis.")

        # Auto-detect dimension if not supplied
        if not dimension_col:
            for col in col_names:
                if col != metric_col:
                    t = dtypes.get(col, "").upper()
                    c_low = col.lower()
                    if not (c_low.endswith("id") or c_low.startswith("id_")):
                        if not any(nt in t for nt in ["FLOAT", "DOUBLE", "DECIMAL"]):
                            dimension_col = col
                            break
            if not dimension_col:
                dimension_col = [c for c in col_names if c != metric_col][0]

        path_str = str(parquet_path).replace("\\", "/")
        safe_id = parquet_store.sanitize_id(dataset_id)

        # Register view
        self.conn.execute(f'CREATE OR REPLACE VIEW "{safe_id}" AS SELECT * FROM \'{path_str}\'')

        # Vectorized DuckDB Driver Decomposition Query
        sql = f"""
        WITH aggregated AS (
            SELECT 
                CAST("{dimension_col}" AS VARCHAR) AS dim_val,
                SUM("{metric_col}") AS total_metric,
                AVG("{metric_col}") AS avg_metric,
                COUNT(*) AS row_count
            FROM "{safe_id}"
            WHERE "{dimension_col}" IS NOT NULL AND "{metric_col}" IS NOT NULL
            GROUP BY 1
        ),
        ranked AS (
            SELECT 
                dim_val,
                total_metric,
                avg_metric,
                row_count,
                SUM(total_metric) OVER () AS grand_total,
                AVG(total_metric) OVER () AS mean_dim_total
            FROM aggregated
        )
        SELECT 
            dim_val,
            ROUND(total_metric, 2) AS total_metric,
            ROUND(avg_metric, 2) AS avg_metric,
            row_count,
            ROUND((total_metric / NULLIF(grand_total, 0)) * 100, 2) AS pct_of_total,
            ROUND(total_metric - mean_dim_total, 2) AS delta_vs_mean,
            ROUND((SUM(total_metric) OVER (ORDER BY total_metric DESC) / NULLIF(grand_total, 0)) * 100, 2) AS cumulative_pct
        FROM ranked
        ORDER BY total_metric DESC
        LIMIT {limit};
        """

        res = self.conn.execute(sql).fetchdf()

        if res.empty:
            return {
                "dataset_id": dataset_id,
                "metric_name": metric_col,
                "dimension_name": dimension_col,
                "total_metric": 0.0,
                "mean_metric": 0.0,
                "pareto_concentration_pct": 0.0,
                "drivers": [],
                "insights": ["No data available to compute driver decomposition."]
            }

        total_metric = float(self.conn.execute(
            f'SELECT COALESCE(SUM("{metric_col}"), 0) FROM "{safe_id}" WHERE "{metric_col}" IS NOT NULL'
        ).fetchone()[0])

        grand_categories = int(self.conn.execute(
            f'SELECT COUNT(DISTINCT "{dimension_col}") FROM "{safe_id}" WHERE "{dimension_col}" IS NOT NULL'
        ).fetchone()[0])

        drivers: List[Dict[str, Any]] = []
        for idx, row in res.iterrows():
            pct = float(row["pct_of_total"])
            if idx == 0 or pct >= 25.0:
                role = "top_driver"
            elif pct <= 3.0:
                role = "underperformer"
            else:
                role = "secondary"

            drivers.append({
                "dimension_value": str(row["dim_val"]),
                "metric_value": float(row["total_metric"]),
                "row_count": int(row["row_count"]),
                "pct_of_total": pct,
                "cumulative_pct": float(row["cumulative_pct"]),
                "delta_vs_mean": float(row["delta_vs_mean"]),
                "role": role
            })

        # Calculate Pareto concentration
        top_contributor = drivers[0]
        pareto_threshold_idx = next((i for i, d in enumerate(drivers) if d["cumulative_pct"] >= 80.0), len(drivers) - 1)
        pareto_contributors_count = pareto_threshold_idx + 1
        pareto_held_pct = drivers[pareto_threshold_idx]["cumulative_pct"]

        # Formulate Senior Analyst Insights
        insights = [
            f"**Primary Growth Driver**: '{top_contributor['dimension_value']}' is the #1 driver, generating **{_format_num(top_contributor['metric_value'])}** ({top_contributor['pct_of_total']}% of total {metric_col.replace('_', ' ')}).",
            f"**Pareto 80/20 Concentration**: Just **{pareto_contributors_count} of {grand_categories} {dimension_col.replace('_', ' ')}s** account for **{pareto_held_pct}%** of all volume.",
            f"**Performance Drag**: '{drivers[-1]['dimension_value']}' generated the lowest volume (**{_format_num(drivers[-1]['metric_value'])}**, {drivers[-1]['pct_of_total']}% share), falling **{_format_num(abs(drivers[-1]['delta_vs_mean']))}** below category average."
        ]

        # Synthesize Plotly Pareto Dual-Axis Chart Spec
        pareto_chart_spec = {
            "data": [
                {
                    "type": "bar",
                    "name": f"Total {metric_col.replace('_', ' ').title()}",
                    "x": [d["dimension_value"] for d in drivers],
                    "y": [d["metric_value"] for d in drivers],
                    "marker": {
                        "color": ["#2DD4BF" if d["role"] == "top_driver" else "#38BDF8" for d in drivers]
                    },
                    "yaxis": "y"
                },
                {
                    "type": "scatter",
                    "mode": "lines+markers",
                    "name": "Cumulative Pareto %",
                    "x": [d["dimension_value"] for d in drivers],
                    "y": [d["cumulative_pct"] for d in drivers],
                    "line": {"color": "#F59E0B", "width": 2.5},
                    "marker": {"size": 6, "color": "#F59E0B"},
                    "yaxis": "y2"
                }
            ],
            "layout": {
                "title": {
                    "text": f"Driver Decomposition: {metric_col.replace('_', ' ').title()} by {dimension_col.replace('_', ' ').title()}",
                    "font": {"size": 14, "color": "#E2E8F0"}
                },
                "paper_bgcolor": "transparent",
                "plot_bgcolor": "transparent",
                "margin": {"l": 50, "r": 50, "t": 40, "b": 60},
                "xaxis": {
                    "tickangle": -30,
                    "color": "#94A3B8",
                    "gridcolor": "rgba(255, 255, 255, 0.05)"
                },
                "yaxis": {
                    "title": metric_col.replace('_', ' ').title(),
                    "color": "#94A3B8",
                    "gridcolor": "rgba(255, 255, 255, 0.05)"
                },
                "yaxis2": {
                    "title": "Cumulative Share %",
                    "overlaying": "y",
                    "side": "right",
                    "range": [0, 105],
                    "color": "#F59E0B",
                    "showgrid": False
                },
                "legend": {
                    "orientation": "h",
                    "y": 1.12,
                    "x": 0.0,
                    "font": {"color": "#CBD5E1", "size": 11}
                }
            }
        }

        return {
            "dataset_id": dataset_id,
            "metric_name": metric_col,
            "dimension_name": dimension_col,
            "total_metric": total_metric,
            "mean_metric": round(total_metric / max(1, grand_categories), 2),
            "pareto_concentration_pct": pareto_held_pct,
            "pareto_contributors_count": pareto_contributors_count,
            "grand_categories": grand_categories,
            "drivers": drivers,
            "insights": insights,
            "chart_spec": pareto_chart_spec
        }


driver_analyzer = DriverAnalyzer()
