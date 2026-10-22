"""
Plotly Chart Specification Synthesizer for TableTell.
Converts verified analytical query results into Nordic Terminal themed visualizations.
"""

from typing import Dict, Any, List, Optional


def build_plotly_spec(
    rows: List[Dict[str, Any]],
    columns: List[str],
    user_query: str = ""
) -> Optional[Dict[str, Any]]:
    """
    Synthesizes an interactive Plotly chart specification based on result shape:
    - Date/Time X-axis -> Line Chart
    - Categorical X-axis + Numeric Y-axis -> Bar Chart
    - Two Numeric dimensions -> Scatter Plot
    - Single Scalar -> KPI Card
    """
    if not rows or not columns:
        return None

    num_cols = len(columns)
    q_lower = user_query.lower()

    # 1. Single scalar KPI indicator (1 row, 1 column or aggregation summary)
    if len(rows) == 1 and num_cols == 1:
        val = list(rows[0].values())[0]
        col_name = columns[0]
        return {
            "data": [
                {
                    "type": "indicator",
                    "mode": "number",
                    "value": val,
                    "title": {"text": col_name.replace("_", " ").title(), "font": {"size": 16, "color": "#2DD4BF"}}
                }
            ],
            "layout": _get_base_layout(f"{col_name.replace('_', ' ').title()}")
        }

    if num_cols < 2:
        return None

    x_col = columns[0]
    y_col = columns[1]

    # Detect if X-axis is date/temporal
    is_temporal = any(d in x_col.lower() for d in ["date", "time", "month", "year", "day", "week", "quarter"]) or any(
        isinstance(r.get(x_col), str) and ("-" in r.get(x_col, "") or "/" in r.get(x_col, "") or "." in r.get(x_col, ""))
        for r in rows[:3] if r.get(x_col) is not None
    )

    # Check if Y-axis is numeric
    is_y_numeric = any(isinstance(r.get(y_col), (int, float)) for r in rows if r.get(y_col) is not None)
    is_x_numeric = any(isinstance(r.get(x_col), (int, float)) for r in rows if r.get(x_col) is not None)

    # User explicitly requested scatter or bubble, or two numeric columns
    if any(k in q_lower for k in ["scatter", "correlation", "bubble", "vs", "versus"]) and is_x_numeric and is_y_numeric:
        return {
            "data": [
                {
                    "type": "scatter",
                    "mode": "markers",
                    "x": [r.get(x_col) for r in rows],
                    "y": [r.get(y_col) for r in rows],
                    "marker": {
                        "color": "#38BDF8",
                        "size": 10,
                        "line": {"color": "#2DD4BF", "width": 1.5}
                    }
                }
            ],
            "layout": _get_base_layout(f"{y_col.replace('_', ' ').title()} vs {x_col.replace('_', ' ').title()}", x_col, y_col)
        }

    # Trend over time -> Line Chart
    if is_temporal and is_y_numeric:
        return {
            "data": [
                {
                    "type": "scatter",
                    "mode": "lines+markers",
                    "x": [r.get(x_col) for r in rows],
                    "y": [r.get(y_col) for r in rows],
                    "line": {"color": "#2DD4BF", "width": 2.5, "shape": "spline"},
                    "marker": {"color": "#38BDF8", "size": 6}
                }
            ],
            "layout": _get_base_layout(f"Trend: {y_col.replace('_', ' ').title()} over {x_col.replace('_', ' ').title()}", x_col, y_col)
        }

    # Categorical comparison -> Bar Chart
    if is_y_numeric:
        return {
            "data": [
                {
                    "type": "bar",
                    "x": [r.get(x_col) for r in rows],
                    "y": [r.get(y_col) for r in rows],
                    "marker": {
                        "color": "#2DD4BF",
                        "line": {"color": "#5EEAD4", "width": 1.0}
                    },
                    "text": [r.get(y_col) for r in rows],
                    "textposition": "auto"
                }
            ],
            "layout": _get_base_layout(f"{y_col.replace('_', ' ').title()} by {x_col.replace('_', ' ').title()}", x_col, y_col)
        }

    return None


def _get_base_layout(title: str, x_label: str = "", y_label: str = "") -> Dict[str, Any]:
    """Generates consistent Nordic Terminal Plotly layout."""
    return {
        "template": "plotly_dark",
        "paper_bgcolor": "rgba(0,0,0,0)",
        "plot_bgcolor": "rgba(0,0,0,0)",
        "font": {
            "color": "#F0FDFA",
            "family": "Plus Jakarta Sans, sans-serif"
        },
        "title": {
            "text": title,
            "font": {"size": 15, "color": "#F0FDFA"}
        },
        "xaxis": {
            "gridcolor": "rgba(45, 212, 191, 0.12)",
            "title": {"text": x_label.replace("_", " ").title()} if x_label else None
        },
        "yaxis": {
            "gridcolor": "rgba(45, 212, 191, 0.12)",
            "title": {"text": y_label.replace("_", " ").title()} if y_label else None
        },
        "margin": {"l": 45, "r": 20, "t": 50, "b": 45}
    }
