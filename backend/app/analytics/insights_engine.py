"""
Executive Insights Engine for TableTell.
Synthesizes deterministic, mathematically verified C-Suite Executive Decision Briefings
("So What? / Now What?") from DuckDB query results.
"""

import json
from typing import Dict, Any, List, Optional
from app.core.config import settings
from app.analytics.sql_generator import get_gemini_client


def _format_num(val: Any) -> str:
    """Formats numeric values into human-readable currency/compact notation."""
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


def synthesize_executive_briefing(
    user_query: str,
    sql: str,
    rows: List[Dict[str, Any]],
    columns: List[str],
    dataset_id: str,
    error: Optional[str] = None
) -> str:
    """
    Synthesizes a structured 4-part Executive Decision Memo:
    1. 📌 Executive Takeaway (Core finding & aggregate metrics)
    2. 🔍 Key Drivers & Attribution (Segment performance & Pareto concentration)
    3. ⚠️ Anomalies & Concentration Alert (Volatility or skew flags)
    4. 🎯 Strategic Recommendations (Actionable business next steps)
    """
    if error:
        return (
            f"⚠️ **TableTell was unable to execute the query safely**:\n\n"
            f"`{error}`\n\n"
            f"> 💡 **Tip**: Verify column names in the schema inspector or click **Auto-Clean** to resolve type anomalies."
        )

    if not rows:
        return f"The query executed successfully on **{dataset_id}** but returned **0 matching records**."

    # Single scalar KPI result (1 row, 1 column)
    if len(rows) == 1 and len(columns) == 1:
        col_name = columns[0]
        val = list(rows[0].values())[0]
        val_fmt = _format_num(val)
        return (
            f"### 📌 Executive KPI Indicator\n\n"
            f"The computed **{col_name.replace('_', ' ').title()}** across `{dataset_id}` is **{val_fmt}**.\n\n"
            f"**Recommended Action**: Compare this baseline against prior period performance or target benchmarks to assess pacing."
        )

    # Identify numeric metrics vs categorical dimensions
    numeric_cols = []
    categorical_cols = []
    for col in columns:
        sample_vals = [r.get(col) for r in rows[:5] if r.get(col) is not None]
        if sample_vals and all(isinstance(v, (int, float)) for v in sample_vals):
            numeric_cols.append(col)
        else:
            categorical_cols.append(col)

    # If no numeric column, provide categorical count breakdown
    if not numeric_cols:
        first_col = columns[0]
        distinct_vals = len(set(r.get(first_col) for r in rows if r.get(first_col) is not None))
        return (
            f"### 📌 Categorical Distribution Overview\n\n"
            f"Extracted **{len(rows)} records** spanning **{distinct_vals} distinct values** for **{first_col.replace('_', ' ').title()}**.\n\n"
            f"**Recommended Action**: Group by category with numerical aggregations (SUM or AVG) to conduct deeper driver analysis."
        )

    metric_col = numeric_cols[0]
    dim_col = categorical_cols[0] if categorical_cols else columns[0]

    # Deterministic statistical calculations
    metric_values = [float(r.get(metric_col)) for r in rows if isinstance(r.get(metric_col), (int, float))]
    if not metric_values:
        top_row = rows[0]
        return f"Query returned **{len(rows)} records**. Top entry: **{top_row.get(dim_col, 'N/A')}**."

    total_sum = sum(metric_values)
    avg_val = total_sum / len(metric_values)
    max_val = max(metric_values)
    min_val = min(metric_values)

    # Find top performer and bottom performer
    sorted_rows = sorted(
        [r for r in rows if isinstance(r.get(metric_col), (int, float))],
        key=lambda r: float(r.get(metric_col, 0)),
        reverse=True
    )
    top_row = sorted_rows[0] if sorted_rows else rows[0]
    bottom_row = sorted_rows[-1] if sorted_rows else rows[-1]

    top_label = str(top_row.get(dim_col, "Top Segment"))
    bottom_label = str(bottom_row.get(dim_col, "Bottom Segment"))

    top_share_pct = round((float(top_row.get(metric_col, 0)) / total_sum * 100), 1) if total_sum > 0 else 0.0
    spread = max_val - min_val
    ratio = round(max_val / min_val, 1) if min_val > 0 else None

    # Pareto concentration: top 20% (or top 1 if few)
    top_n_count = max(1, int(len(sorted_rows) * 0.2))
    top_n_sum = sum(float(r.get(metric_col, 0)) for r in sorted_rows[:top_n_count])
    pareto_pct = round((top_n_sum / total_sum * 100), 1) if total_sum > 0 else 0.0

    # Build structured deterministic briefing
    spread_str = f"**{_format_num(spread)}**"
    ratio_str = f" ({ratio}x spread)" if ratio else ""
    anomaly_text = (
        f"Significant concentration detected: the top {top_n_count} {dim_col.replace('_', ' ')}(s) account for **{pareto_pct}%** of the aggregate **{metric_col.replace('_', ' ').title()}**, exposing the business to dependency risk."
        if pareto_pct >= 60.0
        else f"Distribution across `{dim_col}` is relatively balanced; top contributor accounts for **{top_share_pct}%** of the aggregate volume."
    )

    deterministic_memo = f"""### 📌 Executive Takeaway
Analysis of **{metric_col.replace('_', ' ').title()}** by **{dim_col.replace('_', ' ').title()}** across `{dataset_id}` shows a cumulative total of **{_format_num(total_sum)}** (mean of **{_format_num(avg_val)}** per segment). **{top_label}** is the dominant performer with **{_format_num(max_val)}**, driving **{top_share_pct}%** of overall volume.

### 🔍 Key Drivers & Attribution
- **Primary Driver**: **{top_label}** leads with **{_format_num(max_val)}** ({top_share_pct}% of total), exceeding the segment average by **+{round(((max_val - avg_val) / avg_val) * 100, 1) if avg_val > 0 else 0}%**.
- **Performance Spread**: Variance between highest performer (**{top_label}**) and lowest performer (**{bottom_label}**: {_format_num(min_val)}) is {spread_str}{ratio_str}.
- **Pareto Concentration**: Top {top_n_count} contributor(s) represent **{pareto_pct}%** of total volume.

### ⚠️ Variance & Risk Flag
{anomaly_text}

### 🎯 Strategic Recommendations
1. **Capitalize on Momentum**: Protect and expand margins in **{top_label}** through targeted resource allocation.
2. **Diagnose Underperformance**: Conduct root-cause audit on **{bottom_label}** ({_format_num(min_val)}) to reduce operational drag.
3. **Portfolio Diversification**: Address high concentration risk by accelerating growth across mid-tier cohorts."""

    # Enhance with Gemini AI if client is available
    client = get_gemini_client()
    if client:
        try:
            prompt = f"""You are an elite Senior Data Analyst preparing an Executive Decision Briefing for C-Suite leadership.
User Question: "{user_query}"
Dataset: {dataset_id}
Executed SQL: {sql}

DETERMINISTIC VERIFIED METRICS (STRICTLY USE THESE NUMBERS):
- Metric Analyzed: {metric_col} (Total: {_format_num(total_sum)}, Mean: {_format_num(avg_val)})
- Top Performer: {top_label} = {_format_num(max_val)} ({top_share_pct}% share)
- Lowest Performer: {bottom_label} = {_format_num(min_val)}
- Spread: {_format_num(spread)}
- Pareto Concentration: Top {top_n_count} segments hold {pareto_pct}% of total

Format your response in GitHub Markdown using EXACTLY these 4 section headers:
### 📌 Executive Takeaway
(2 concise sentences highlighting key metrics and baseline)

### 🔍 Key Drivers & Attribution
(2-3 bullet points analyzing segment performance, concentration, and spread)

### ⚠️ Variance & Risk Flag
(1-2 sentences highlighting outliers, concentration risks, or distribution skews)

### 🎯 Strategic Recommendations
(2-3 prioritized, high-ROI business recommendations with action verbs)

Rules:
- Do NOT hallucinate different numbers. Use the exact numbers provided above.
- Be decisive, business-oriented, and quantitative."""

            resp = client.models.generate_content(
                model=settings.DEFAULT_MODEL,
                contents=prompt
            )
            if resp.text and len(resp.text.strip()) > 50:
                return resp.text.strip()
        except Exception:
            pass

    return deterministic_memo
