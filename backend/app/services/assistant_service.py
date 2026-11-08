"""
AI Assistant Service for TableTell.
Acts as a data science tutor, statistical engine, data engineering mentor, and TableTell platform navigator.
Enriched with live context (active tab, selected dataset, health score, active columns, and real-time DuckDB descriptive statistics).
Powered by Google Gemini Flash / OpenAI-compatible router with a comprehensive statistical & DuckDB-backed offline fallback engine.
"""

import os
import re
import json
import math
import asyncio
from typing import Dict, Any, List, Optional, AsyncGenerator
from app.core.config import settings
from app.storage.metadata_repo import metadata_repo
from app.storage.parquet_store import parquet_store
from app.analytics.executor import query_executor
from app.analytics.sql_generator import get_gemini_client, UniversalClient, GoogleGenAIClient

GOOGLE_OPENAI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

ASSISTANT_SYSTEM_PROMPT = """You are TableTell Copilot, a friendly expert statistician who chats like ChatGPT or Gemini, but only about statistics.

SCOPE (what you answer):
- Statistics, probability, hypothesis testing, experimental design / A/B testing, regression, econometrics, sampling, distributions, and data analysis methods.
- Questions about the user's active dataset (its columns, distributions, outliers, correlations) and how to analyse it in TableTell.
- If a question is clearly NOT about statistics or data analysis (e.g. cooking, coding unrelated to data, politics, general trivia), reply in one or two friendly sentences that you only help with statistics and data analysis, and suggest a related statistical question they could ask instead.

HOW TO ANSWER (most important):
1. Answer the EXACT question in the very first sentence. If it is a yes/no question, start with "Yes", "No", or "Mostly yes" and say why in the same sentence.
2. Then add only what helps: a short explanation, the key formula if relevant, and a concrete example. Stop once the question is answered.
3. Match length to the question: simple questions get 2–5 sentences; "explain"/"how" questions may use a few bullets or a short list. Never dump a long article or unrelated sections.
4. Be conversational and natural. Use the conversation history so follow-up questions ("what about for 3 groups?") make sense.
5. If the question is ambiguous, give the most likely answer and briefly note the alternative interpretation.
6. When the LIVE DUCKDB STATISTICAL PROFILE below is relevant, use its exact numbers to make the answer concrete (e.g. "your revenue_usd has mean 229.95 vs median 156.96, so it is right-skewed"). Never invent dataset numbers that are not in the profile.

FORMATTING RULES:
- Plain Markdown only. Do NOT use LaTeX or dollar-sign math ($...$) because the chat cannot render it.
- Write formulas in inline code with Unicode symbols, e.g. `t = (x̄₁ − x̄₂) / √(s₁²/n₁ + s₂²/n₂)`, `SE = s / √n`, `z = (x − μ) / σ`.
- Use **bold** for the key takeaway. Avoid big headings for short answers.
"""

FALLBACK_KNOWLEDGE_BASE: Dict[str, str] = {
    "what_is_tabletell": (
        "### 🏛️ What is TableTell?\n\n"
        "**TableTell** audits and cleans your raw spreadsheets into analysis-ready data, then turns plain-English questions into verified DuckDB SQL and charts you can audit.\n\n"
        "Key Differentiators:\n"
        "1. **Zero Math Hallucination**: AI generates read-only SQL, but **100% of arithmetic, statistics, and aggregations execute in DuckDB's C++ vectorized engine**.\n"
        "2. **Immutable Lakehouse**: Raw files in `data_lake/raw/` are never overwritten. Cleaning operations produce versioned Apache Parquet files (`v1` -> `v2`).\n"
        "3. **Autonomous Self-Healing**: If a query encounters a DuckDB syntax or column error, the LangGraph agent intercepts the traceback, repairs the SQL, and re-executes automatically."
    ),
    "iqr": (
        "### 📊 What is 1.5× IQR (Interquartile Range) & Outlier Detection?\n\n"
        "In statistics, the **Interquartile Range (IQR)** measures the spread of the middle 50% of your data and is resistant to extreme outliers:\n"
        "- **Q1 (25th percentile)**: 25% of observations fall below this value.\n"
        "- **Q2 (Median / 50th percentile)**: The exact middle value of the sorted dataset.\n"
        "- **Q3 (75th percentile)**: 75% of observations fall below this value.\n"
        "- **Formula**: `IQR = Q3 - Q1`\n\n"
        "**John Tukey's Fences Rule** flags an observation as a statistical outlier if:\n"
        "- **Lower Fence**: `Value < Q1 - 1.5 × IQR`\n"
        "- **Upper Fence**: `Value > Q3 + 1.5 × IQR` (and *extreme outlier* if `> Q3 + 3.0 × IQR`)\n\n"
        "> 💡 **Why IQR instead of Z-score?** Mean and Standard Deviation get distorted by a single extreme value, whereas `Q1`, `Median`, and `Q3` are order statistics that remain stable even on heavily skewed data."
    ),
    "std_variance": (
        "### 📏 Standard Deviation ($s$), Variance ($s^2$) & Coefficient of Variation ($CV$)\n\n"
        "These metrics quantify **dispersion** — how far individual data points spread out from the average (mean):\n\n"
        "1. **Sample Variance ($s^2$)**:\n"
        "   - Formula: `s² = Σ(xᵢ - x̄)² / (n - 1)`\n"
        "   - Measures average squared distance from the mean (dividing by `n - 1` applies *Bessel's correction* for an unbiased sample estimate).\n"
        "   - **DuckDB SQL**: `VAR_SAMP(column)` or `VARIANCE(column)`\n\n"
        "2. **Sample Standard Deviation ($s$)**:\n"
        "   - Formula: `s = √s²`\n"
        "   - Brings dispersion back into the **original units** of your column (e.g., dollars, units, days).\n"
        "   - Under a normal distribution, **~68%** of values lie within `±1s` of the mean, and **~95%** lie within `±2s`.\n"
        "   - **DuckDB SQL**: `STDDEV_SAMP(column)`\n\n"
        "3. **Coefficient of Variation ($CV$)**:\n"
        "   - Formula: `CV = s / x̄` (often expressed as a percentage)\n"
        "   - Allows you to compare volatility across columns with completely different scales (e.g., comparing `unit_price` dispersion vs. `quantity` dispersion)."
    ),
    "central_tendency": (
        "### 🎯 Mean vs. Median vs. Mode (Measures of Central Tendency)\n\n"
        "Each metric defines the \"center\" of a distribution differently:\n\n"
        "1. **Mean (Arithmetic Average, $\\bar{x}$)**:\n"
        "   - Formula: `x̄ = (Σxᵢ) / n` | **DuckDB**: `AVG(col)`\n"
        "   - Best for symmetric, bell-shaped distributions without extreme outliers.\n"
        "   - *Limitation*: Highly sensitive to outliers (a single $1M order pulls the mean up dramatically).\n\n"
        "2. **Median (50th Percentile, $Q_2$)**:\n"
        "   - The middle value when observations are sorted ascending | **DuckDB**: `MEDIAN(col)` or `QUANTILE_CONT(col, 0.5)`\n"
        "   - **Best for skewed business metrics** like revenue, order value, income, or latency.\n\n"
        "3. **Mode (Most Frequent Value)**:\n"
        "   - The value that appears most often | **DuckDB**: `MODE(col)`\n"
        "   - Essential for categorical fields (`category`, `payment_method`) and discrete integer counts.\n\n"
        "> 💡 **Quick Diagnostic**:\n"
        "> - If `Mean > Median` -> **Right-Skewed (Positive Skew)**: High-value tail pulls the average up.\n"
        "> - If `Mean < Median` -> **Left-Skewed (Negative Skew)**: Low-value tail pulls the average down.\n"
        "> - If `Mean ≈ Median` -> **Symmetric Distribution**."
    ),
    "zscore": (
        "### ⚡ Z-Score (Standard Score) & Standardization\n\n"
        "A **Z-score** tells you **how many standard deviations** a specific data point is above or below the mean:\n\n"
        "- **Formula**: `z = (x - μ) / σ` (or `(x - x̄) / s` in a sample)\n"
        "- **Interpretation**:\n"
        "  * `z = 0`: Exactly equal to the mean.\n"
        "  * `|z| > 2.0`: Unusual observation (top/bottom ~4.5% in a normal distribution).\n"
        "  * `|z| > 3.0`: Statistical outlier (top/bottom ~0.27% in a normal distribution).\n\n"
        "- **Modified Z-Score (for Skewed Data)**:\n"
        "  * Replaces mean and std dev with the Median and **MAD (Median Absolute Deviation)**:\n"
        "  * `Mᵢ = 0.6745 × |xᵢ - Median| / MAD` (values with `|Mᵢ| > 3.5` are flagged as outliers).\n\n"
        "- **DuckDB SQL Pattern**:\n"
        "```sql\n"
        "SELECT *, (col - AVG(col) OVER ()) / NULLIF(STDDEV_SAMP(col) OVER (), 0) AS z_score\n"
        "FROM dataset\n"
        "```"
    ),
    "correlation_regression": (
        "### 📈 Correlation ($r$), Rank Correlation ($\\rho$) & Linear Regression ($R^2$)\n\n"
        "1. **Pearson Correlation Coefficient ($r$)**:\n"
        "   - Measures the strength and direction of a **linear relationship** between two numeric variables (`-1.0` to `+1.0`).\n"
        "   - `+0.7 to +1.0`: Strong positive linear relationship.\n"
        "   - `0.0`: No linear association.\n"
        "   - `-0.7 to -1.0`: Strong negative (inverse) relationship.\n"
        "   - **DuckDB SQL**: `CORR(y, x)`\n\n"
        "2. **Spearman Rank Correlation ($\\rho$)**:\n"
        "   - Computes Pearson correlation on the **ranks** of the variables rather than raw values.\n"
        "   - Captures **monotonic (curved) relationships** and is robust against extreme outliers.\n\n"
        "3. **Linear Regression ($y = \\beta_0 + \\beta_1 x$) & $R^2$**:\n"
        "   - **Slope ($\\beta_1$)**: Expected change in $y$ for a 1-unit increase in $x$ | **DuckDB**: `REGR_SLOPE(y, x)`\n"
        "   - **Intercept ($\\beta_0$)**: Expected value of $y$ when $x = 0$ | **DuckDB**: `REGR_INTERCEPT(y, x)`\n"
        "   - **$R^2$ (Coefficient of Determination)**: Proportion of variance in $y$ explained by $x$ (`0%` to `100%`) | **DuckDB**: `REGR_R2(y, x)`\n\n"
        "> ⚠️ **Golden Rule**: *Correlation does not imply causation.* Confounding variables (like seasonality or customer segment) can make two variables move together without one causing the other."
    ),
    "hypothesis_pvalue": (
        "### 🧪 Hypothesis Testing, $p$-Values & Statistical Significance\n\n"
        "Hypothesis testing evaluates whether an observed pattern in your sample reflects a real effect or random sampling noise:\n\n"
        "1. **Core Framework**:\n"
        "   - **Null Hypothesis ($H_0$)**: No real effect or difference exists (e.g., $\\mu_A = \\mu_B$).\n"
        "   - **Alternative Hypothesis ($H_1$)**: A real effect or difference exists (e.g., $\\mu_A \\neq \\mu_B$).\n\n"
        "2. **What is a $p$-Value?**:\n"
        "   - The probability of observing a test statistic at least as extreme as your sample result **assuming the Null Hypothesis ($H_0$) is true**.\n"
        "   - **`p < 0.05` (at $\\alpha = 5\\%$)**: Statistically significant — reject $H_0$.\n"
        "   - **`p ≥ 0.05`**: Insufficient evidence to reject $H_0$ (does *not* prove $H_0$ is true, only that noise cannot be ruled out).\n\n"
        "3. **Choosing the Right Statistical Test**:\n"
        "   - **Compare 2 Group Means (continuous metric)**: **Welch's $t$-test** (does not assume equal variances) or **Mann-Whitney U test** (if heavily skewed).\n"
        "   - **Compare 3+ Group Means**: **One-Way ANOVA ($F$-test)** or **Kruskal-Wallis test**.\n"
        "   - **Compare Categorical Proportions / Conversion Rates**: **Chi-Square ($\\chi^2$) Test of Independence** or **Two-Proportion $Z$-Test**.\n\n"
        "4. **Type I vs. Type II Errors**:\n"
        "   - **Type I Error ($\\alpha$, False Positive)**: Declaring a difference when none exists.\n"
        "   - **Type II Error ($\\beta$, False Negative)**: Missing a real difference because sample size or statistical power ($1 - \\beta$) is too small."
    ),
    "distributions_skew_clt": (
        "### 🔔 Probability Distributions, Skewness, Kurtosis & Central Limit Theorem\n\n"
        "1. **Key Distributions in Data Analytics**:\n"
        "   - **Normal (Gaussian)**: Symmetric bell curve defined by mean ($\\mu$) and std dev ($\\sigma$). Follows the **68–95–99.7% Empirical Rule**.\n"
        "   - **Log-Normal / Pareto**: Right-skewed distributions typical of **e-commerce order values, revenue per user, and wealth**.\n"
        "   - **Poisson ($\\lambda$)**: Models the count of independent events in a fixed window (e.g., orders per hour, support tickets per day).\n"
        "   - **Binomial ($n, p$)**: Models the number of successes out of $n$ trials (e.g., checkout conversion rate).\n\n"
        "2. **Skewness & Kurtosis**:\n"
        "   - **Skewness** (`SKEWNESS(col)` in DuckDB): Measures asymmetry.\n"
        "     * `≈ 0`: Symmetric | `> +0.5`: Right-skewed (long high tail) | `< -0.5`: Left-skewed (long low tail).\n"
        "   - **Kurtosis** (`KURTOSIS(col)` in DuckDB): Measures tail heaviness (propensity to produce extreme outliers).\n\n"
        "3. **Central Limit Theorem (CLT)**:\n"
        "   - Even if your underlying column (like `revenue`) is heavily skewed, the **distribution of sample means ($\\bar{x}$)** converges to a **Normal distribution** as sample size $n$ grows (typically $n \\ge 30$), with Standard Error `SE = s / √n`."
    ),
    "confidence_ab_testing": (
        "### 🎯 Confidence Intervals, Standard Error & A/B Testing\n\n"
        "1. **Standard Error of the Mean ($SE$)**:\n"
        "   - Formula: `SE = s / √n`\n"
        "   - Measures how much the sample mean $\\bar{x}$ is expected to fluctuate across repeated samples of size $n$.\n\n"
        "2. **95% Confidence Interval ($CI$)**:\n"
        "   - Formula: `CI₉₅% = x̄ ± 1.96 × (s / √n)`\n"
        "   - Gives the plausible range for the true population mean. As sample size $n$ quadruples, the margin of error cuts in half.\n\n"
        "3. **A/B Testing & Uplift Evaluation**:\n"
        "   - **Relative Uplift**: `(Mean_Treatment - Mean_Control) / Mean_Control`\n"
        "   - **Two-Sample $t$-Statistic**: `t = (x̄₁ - x̄₂) / √(s₁²/n₁ + s₂²/n₂)`\n"
        "   - If `|t| > 1.96` (or `p < 0.05`), the uplift is statistically significant at the 95% confidence level.\n\n"
        "4. **Simpson's Paradox Warning**:\n"
        "   - An aggregate trend across the whole table can **reverse direction** when stratified by a confounding category (e.g., `region` or `customer_tier`). Always check segment-level breakdowns in Studio!"
    ),
    "clean": (
        "### 🧹 How Data Cleaning & Auto-Clean Works in TableTell\n\n"
        "TableTell follows a **deterministic 4-stage pipeline**:\n"
        "1. **Audit & Profiling**: DuckDB scans the dataset across 5 dimensions (Completeness, Validity, Consistency, Uniqueness, Anomaly).\n"
        "2. **Explainable Proposals**: Generates actionable proposals (e.g., *'Drop 2 duplicate rows'*, *'Convert date format to ISO-8601'*, *'Sanitize negative prices'*).\n"
        "3. **User Approval**: You review and approve proposals in the **Audit** or **Datasets** tab.\n"
        "4. **Safe Versioning**: Transformations run without touching your raw file, generating a clean `v2.parquet` file with before-and-after audit logs."
    ),
    "health_score": (
        "### 🎯 The TableTell 100-Point Health Score\n\n"
        "TableTell evaluates dataset hygiene across 5 standard enterprise dimensions:\n"
        "- **Completeness (25%)**: Penalizes missing primary keys and null fields.\n"
        "- **Validity (25%)**: Flags negative numbers in quantity/price and irregular date formats.\n"
        "- **Consistency (20%)**: Checks for clean snake_case column names without illegal SQL symbols.\n"
        "- **Uniqueness (15%)**: Measures exact row duplication and primary key collisions.\n"
        "- **Anomaly Review (15%)**: Evaluates 1.5x IQR outliers and categorical typos.\n\n"
        "> 💡 Scores above **80/100** are considered enterprise-ready for analytics and dashboards."
    ),
    "nominal": (
        "### 🏷️ Statistical Variable Types: Nominal, Ordinal, Discrete & Continuous\n\n"
        "Choosing the right statistical test or chart starts with identifying the variable scale:\n\n"
        "1. **Nominal (Categorical — No Order)**:\n"
        "   - Labels without quantitative rank (e.g., `Country`, `Category`, `Payment Method`).\n"
        "   - *Allowed Stats*: Mode, frequency count, proportions, Chi-Square ($\\chi^2$) test, Shannon entropy.\n\n"
        "2. **Ordinal (Categorical — Ranked Order)**:\n"
        "   - Categories with a natural hierarchy, but unequal spacing between levels (e.g., `Customer Tier`: Bronze < Silver < Gold).\n"
        "   - *Allowed Stats*: Median percentile rank, Spearman rank correlation ($\\rho$), Mann-Whitney U.\n\n"
        "3. **Discrete Numeric (Count Data)**:\n"
        "   - Whole-number counts (e.g., `quantity`, `orders_count`). Modeled with Poisson or Binomial distributions.\n\n"
        "4. **Continuous Ratio / Interval**:\n"
        "   - Real-valued measurements with true zero (`revenue`, `unit_price`, `discount`).\n"
        "   - *Allowed Stats*: Mean, Standard Deviation, IQR, Pearson $r$, Linear Regression, $t$-tests."
    ),
    "parquet": (
        "### ⚡ Why TableTell Uses Parquet Instead of CSV\n\n"
        "When you upload a CSV or Excel file, TableTell immediately converts it to **Apache Parquet**:\n"
        "- **70%–90% Smaller Disk Footprint**: Uses Snappy/ZSTD compression and dictionary encoding.\n"
        "- **Columnar Storage (Projection Pushdown)**: When you query 2 columns, DuckDB reads *only* those 2 columns from disk, leaving the rest untouched.\n"
        "- **Strict Data Typing**: Guarantees numbers remain numbers and dates don't get corrupted into strings.\n"
        "- **10x–50x Faster Analytics**: Vectorized engines like DuckDB process columnar Parquet chunks in SIMD CPU registers."
    ),
    "duckdb": (
        "### 🦆 Why DuckDB Instead of SQLite for Analytics?\n\n"
        "While SQLite is world-class for transactional (OLTP) storage, **DuckDB is purpose-built for analytical & statistical (OLAP) workloads**:\n\n"
        "1. **Columnar vs Row-Oriented**: DuckDB scans only the queried columns; SQLite scans entire rows.\n"
        "2. **Vectorized Execution**: DuckDB processes data in vectors of 2,048 values using CPU SIMD instructions.\n"
        "3. **Zero-Copy Parquet Reads**: DuckDB reads Parquet files directly from disk without importing them into an internal database file.\n"
        "4. **Native Statistical Aggregates**: Built-in support for `STDDEV_SAMP`, `VAR_SAMP`, `MEDIAN`, `QUANTILE_CONT`, `SKEWNESS`, `KURTOSIS`, `CORR`, and `REGR_R2`."
    ),
    "self_heal": (
        "### 🔄 How Autonomous Self-Healing Works\n\n"
        "In traditional text-to-SQL, an invalid column name or syntax error immediately breaks the user experience.\n\n"
        "**TableTell solves this using a LangGraph cyclical DAG**:\n"
        "1. **Generate**: The agent generates DuckDB SQL based on the schema.\n"
        "2. **Execute**: The query runs against sandboxed DuckDB views.\n"
        "3. **Detect**: If DuckDB throws an error (e.g., `BinderException: Column 'rev' not found`), the execution node catches the error.\n"
        "4. **Self-Heal Loop**: The error traceback, failed SQL, and schema are passed to the `self_heal` node to diagnose the mistake and repair the query.\n"
        "5. **Re-Execute**: The repaired query executes automatically, and the UI displays the **'Self-Healed'** badge!"
    ),
    "file_formats": (
        "### 📁 Supported File Formats in TableTell\n\n"
        "TableTell supports the following tabular formats:\n"
        "- **CSV (`.csv`)**: Delimiter auto-detected (comma, semicolon, tab), encoding normalized to UTF-8.\n"
        "- **Excel (`.xlsx`, `.xls`)**: First sheet parsed, headers normalized, types inferred.\n"
        "- **Apache Parquet (`.parquet`)**: Loaded with zero-copy projection.\n\n"
        "All uploaded files are preserved in `data_lake/raw/` and converted into optimized Parquet files in `data_lake/processed/`."
    ),
    "immutability": (
        "### 🛡️ Lakehouse Immutability & Versioning\n\n"
        "In TableTell, **data lineage is immutable**:\n"
        "- Your uploaded file is stored in `data_lake/raw/` as the permanent source of truth.\n"
        "- Cleaning operations NEVER mutate or overwrite the source file.\n"
        "- Every transformation creates a new Parquet version (`v1.parquet` -> `v2.parquet` -> `v3.parquet`).\n"
        "- Full before-and-after audit logs are recorded in SQLite, allowing you to trace every modified row and revert if needed."
    ),
    "privacy": (
        "### 🔒 Data Privacy & Security Governance\n\n"
        "TableTell is designed with strict data privacy:\n"
        "1. **Raw Data Never Leaves Your Environment**: Your full dataset rows are **never** uploaded to external LLM servers.\n"
        "2. **Schema-Only AI Context**: The LLM only receives column names, data types, and compact statistical aggregates needed to synthesize SQL and executive takeaways.\n"
        "3. **In-Process Compute**: 100% of mathematical computation, filtering, and aggregation runs locally in DuckDB's C++ engine.\n"
        "4. **Read-Only Sandbox**: Forbidden DDL/DML statements (`DROP`, `DELETE`, `UPDATE`, `ALTER`, `ATTACH`) are blocked before execution."
    ),
    "duplicate": (
        "### 👥 Is It Safe to Drop Duplicate Rows?\n\n"
        "In TableTell, the **Uniqueness (15%)** check flags rows where every column value is identical.\n\n"
        "**When it is safe to drop**:\n"
        "- When you have transactional records with unique IDs (e.g. `order_id` or `user_id`) duplicated due to an ingestion glitch.\n"
        "- When identical rows represent duplicate logging.\n\n"
        "**When to keep**:\n"
        "- When rows represent identical item purchases without a unique line-item ID.\n\n"
        "> 💡 **Protection**: TableTell's Auto-Clean gives you an **explainable proposal** showing the exact number of duplicates found before performing the deduplication into a new `v2.parquet` file."
    ),
    "telemetry": (
        "### ⚡ Telemetry & Run History\n\n"
        "The **Telemetry** tab provides end-to-end operational visibility:\n"
        "- **System Diagnostics**: Monitors DuckDB engine status, SQLite integrity, and data lake disk usage.\n"
        "- **Query Latency**: Execution durations broken down by SQL generation, DuckDB execution, and visualization synthesis.\n"
        "- **Execution Run History**: Complete audit trail of past queries, self-healing retries, and generated SQL queries stored in `data_lake/metadata/tabletell_metadata.db`."
    ),
    "cancel": (
        "### ⏹️ Real-Time Streaming & Instant Cancellation\n\n"
        "TableTell features zero-zombie compute streaming:\n"
        "- Query progress streams over **Server-Sent Events (SSE)** in real-time (`planning` -> `executing` -> `visualizing`).\n"
        "- Clicking the **'Stop'** button toggles a client-side `AbortController` and signals the backend disconnect handler to abort execution immediately.\n"
        "- Your previous prompt is automatically preserved in the query dock so you can refine and re-run."
    )
}


_LATEX_MAP = [
    (r"\bar{x}", "x̄"), (r"\hat{y}", "ŷ"), (r"\mu", "μ"), (r"\sigma", "σ"), (r"\rho", "ρ"),
    (r"\alpha", "α"), (r"\beta", "β"), (r"\lambda", "λ"), (r"\chi", "χ"), (r"\epsilon", "ε"),
    (r"\pm", "±"), (r"\cdot", "·"), (r"\times", "×"), (r"\ge", "≥"), (r"\le", "≤"),
    (r"\neq", "≠"), (r"\approx", "≈"), (r"\rightarrow", "→"), (r"\sum", "Σ"), (r"\infty", "∞"),
    (r"\%", "%"), (r"\text{--}", "–"), (r"\text{IQR}", "IQR"),
]
_SUBSCRIPTS = str.maketrans("0123456789", "₀₁₂₃₄₅₆₇₈₉")
_SUPERSCRIPTS = str.maketrans("0123456789", "⁰¹²³⁴⁵⁶⁷⁸⁹")


def _latex_to_unicode(text: str) -> str:
    """Converts inline $...$ LaTeX into readable Unicode, since the chat renderer has no math support."""
    def convert(expr: str) -> str:
        for latex, uni in _LATEX_MAP:
            expr = expr.replace(latex, uni)
        expr = re.sub(r"\\sqrt\{([^{}]*)\}", r"√(\1)", expr)
        expr = re.sub(r"\\frac\{([^{}]*)\}\{([^{}]*)\}", r"(\1)/(\2)", expr)
        expr = re.sub(r"_\{?(\d)\}?", lambda m: m.group(1).translate(_SUBSCRIPTS), expr)
        expr = re.sub(r"\^\{?(\d)\}?", lambda m: m.group(1).translate(_SUPERSCRIPTS), expr)
        expr = re.sub(r"\\text\{([^{}]*)\}", r"\1", expr)
        return expr.replace("\\", "")

    text = re.sub(r"\$\$(.+?)\$\$", lambda m: f"`{convert(m.group(1)).strip()}`", text, flags=re.S)
    text = re.sub(r"\$([^$\n]+?)\$", lambda m: convert(m.group(1)), text)
    return text


def _short_error(err: Exception) -> str:
    msg = str(err)
    m = re.search(r"'(\d{3}) ([^']+)'", msg)
    if m:
        return f"HTTP {m.group(1)} {m.group(2)}"
    return (type(err).__name__ + ": " + msg)[:120]


def _fmt_num(val: Any, decimals: int = 2) -> str:
    if val is None:
        return "N/A"
    try:
        f = float(val)
        if not math.isfinite(f):
            return "N/A"
        if abs(f) >= 1000:
            return f"{f:,.{decimals}f}"
        return f"{f:.{decimals}f}"
    except Exception:
        return str(val)


class AssistantService:
    def get_or_create_conversation(self, conversation_id: Optional[str] = None) -> Dict[str, Any]:
        """Resolves active conversation or returns default thread."""
        if conversation_id:
            conv = metadata_repo.get_or_create_default_conversation()
            return conv
        return metadata_repo.get_or_create_default_conversation()

    def get_history(self, conversation_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """Fetches chronological messages for the active assistant thread."""
        conv = self.get_or_create_conversation(conversation_id)
        return metadata_repo.list_assistant_messages(conv["id"])

    def clear_history(self, conversation_id: Optional[str] = None) -> None:
        """Clears all messages in the active thread."""
        conv = self.get_or_create_conversation(conversation_id)
        metadata_repo.clear_assistant_history(conv["id"])

    def _compute_dataset_statistics(self, dataset_id: Optional[str]) -> Dict[str, Any]:
        """
        Computes real-time DuckDB descriptive statistics, quartiles, skewness, and pairwise correlations
        for the active dataset so both the LLM and fallback engine can cite verified numbers.
        """
        if not dataset_id:
            return {}
        try:
            parquet_path = parquet_store.resolve_dataset_path(dataset_id)
            query_executor.register_dataset_view(dataset_id, parquet_path)
            conn = query_executor.conn

            schema_rows = conn.execute("DESCRIBE dataset").fetchall()
            numeric_types = ("INT", "BIGINT", "DOUBLE", "FLOAT", "DECIMAL", "NUMERIC", "REAL", "HUGEINT", "SMALLINT", "TINYINT")
            numeric_cols: List[str] = []
            categorical_cols: List[str] = []

            for col_name, col_type, *_ in schema_rows:
                upper_t = str(col_type).upper()
                if any(nt in upper_t for nt in numeric_types) and not col_name.lower().endswith("_id") and col_name.lower() != "id":
                    numeric_cols.append(col_name)
                elif "VARCHAR" in upper_t or "STRING" in upper_t:
                    categorical_cols.append(col_name)

            total_rows_res = conn.execute("SELECT COUNT(*) FROM dataset").fetchone()
            total_rows = int(total_rows_res[0]) if total_rows_res else 0

            num_stats: Dict[str, Dict[str, Any]] = {}
            for col in numeric_cols[:6]:
                q_sql = f"""
                    SELECT
                        COUNT("{col}") AS n,
                        AVG("{col}") AS mean,
                        STDDEV_SAMP("{col}") AS std,
                        VAR_SAMP("{col}") AS variance,
                        MIN("{col}") AS min_val,
                        QUANTILE_CONT("{col}", 0.25) AS q1,
                        MEDIAN("{col}") AS median,
                        QUANTILE_CONT("{col}", 0.75) AS q3,
                        MAX("{col}") AS max_val,
                        SKEWNESS("{col}") AS skewness
                    FROM dataset
                    WHERE "{col}" IS NOT NULL
                """
                row = conn.execute(q_sql).fetchone()
                if row and row[0]:
                    q1 = float(row[5]) if row[5] is not None else 0.0
                    q3 = float(row[7]) if row[7] is not None else 0.0
                    iqr = q3 - q1
                    mean_v = float(row[1]) if row[1] is not None else 0.0
                    std_v = float(row[2]) if row[2] is not None else 0.0
                    n_v = int(row[0])
                    se_v = std_v / math.sqrt(n_v) if n_v > 0 else 0.0

                    # Count 1.5x IQR outliers
                    lower_fence = q1 - 1.5 * iqr
                    upper_fence = q3 + 1.5 * iqr
                    outlier_row = conn.execute(
                        f'SELECT COUNT(*) FROM dataset WHERE "{col}" < {lower_fence} OR "{col}" > {upper_fence}'
                    ).fetchone()
                    outlier_count = int(outlier_row[0]) if outlier_row else 0

                    num_stats[col] = {
                        "n": n_v,
                        "mean": mean_v,
                        "std": std_v,
                        "variance": float(row[3]) if row[3] is not None else 0.0,
                        "se": se_v,
                        "ci95_low": mean_v - 1.96 * se_v,
                        "ci95_high": mean_v + 1.96 * se_v,
                        "cv_pct": (std_v / mean_v * 100.0) if mean_v != 0 else 0.0,
                        "min": float(row[4]) if row[4] is not None else 0.0,
                        "q1": q1,
                        "median": float(row[6]) if row[6] is not None else 0.0,
                        "q3": q3,
                        "iqr": iqr,
                        "lower_fence": lower_fence,
                        "upper_fence": upper_fence,
                        "outlier_count": outlier_count,
                        "max": float(row[8]) if row[8] is not None else 0.0,
                        "skewness": float(row[9]) if row[9] is not None and math.isfinite(float(row[9])) else 0.0,
                    }

            correlations: List[Dict[str, Any]] = []
            if len(numeric_cols) >= 2:
                cols_subset = numeric_cols[:5]
                for i in range(len(cols_subset)):
                    for j in range(i + 1, len(cols_subset)):
                        c1, c2 = cols_subset[i], cols_subset[j]
                        corr_row = conn.execute(
                            f'SELECT CORR("{c1}", "{c2}"), REGR_R2("{c1}", "{c2}"), REGR_SLOPE("{c1}", "{c2}") FROM dataset'
                        ).fetchone()
                        if corr_row and corr_row[0] is not None and math.isfinite(float(corr_row[0])):
                            r_val = float(corr_row[0])
                            r2_val = float(corr_row[1]) if corr_row[1] is not None and math.isfinite(float(corr_row[1])) else r_val * r_val
                            slope_val = float(corr_row[2]) if corr_row[2] is not None and math.isfinite(float(corr_row[2])) else 0.0
                            correlations.append({
                                "col_a": c1,
                                "col_b": c2,
                                "r": round(r_val, 4),
                                "r2": round(r2_val, 4),
                                "slope": round(slope_val, 4),
                            })
                correlations.sort(key=lambda item: abs(item["r"]), reverse=True)

            return {
                "dataset_id": dataset_id,
                "total_rows": total_rows,
                "numeric_cols": numeric_cols,
                "categorical_cols": categorical_cols,
                "numeric_stats": num_stats,
                "correlations": correlations,
            }
        except Exception:
            return {}

    def _format_live_stats_markdown(self, stats_bundle: Dict[str, Any]) -> str:
        """Formats live DuckDB descriptive statistics into a readable Markdown table."""
        num_stats = stats_bundle.get("numeric_stats") or {}
        if not num_stats:
            return ""

        ds_id = stats_bundle.get("dataset_id", "active dataset")
        lines = [
            f"\n\n---\n#### 🦆 Live DuckDB Statistical Profile for `{ds_id}` ({stats_bundle.get('total_rows', 0):,} rows)\n",
            "| Metric Column | Mean ($\\bar{x}$) | Std Dev ($s$) | Median ($Q_2$) | IQR ($Q_3 - Q_1$) | Skewness | 1.5×IQR Outliers |",
            "| :--- | ---: | ---: | ---: | ---: | ---: | ---: |",
        ]
        for col, st in num_stats.items():
            lines.append(
                f"| `{col}` | {_fmt_num(st['mean'])} | {_fmt_num(st['std'])} | {_fmt_num(st['median'])} | "
                f"{_fmt_num(st['iqr'])} | {_fmt_num(st['skewness'], 2)} | {st['outlier_count']:,} |"
            )

        corrs = stats_bundle.get("correlations") or []
        if corrs:
            top_c = corrs[0]
            lines.append(
                f"\n- **Top Pairwise Correlation**: `{top_c['col_a']}` vs. `{top_c['col_b']}` -> "
                f"**Pearson $r = {top_c['r']:+.4f}$** ($R^2 = {top_c['r2']*100:.2f}\\%$ shared variance)."
            )
        return "\n".join(lines)

    def _format_context_prompt(self, context: Optional[Dict[str, Any]], stats_bundle: Optional[Dict[str, Any]] = None) -> str:
        """Formats session context and live DuckDB statistics into a structured system block for the model."""
        if not context and not stats_bundle:
            return ""

        lines = ["CURRENT SESSION CONTEXT:"]
        if context:
            if context.get("current_tab"):
                lines.append(f"- Active Tab/Screen: '{context['current_tab']}'")
            if context.get("dataset_id"):
                ds_name = context.get("dataset_name") or context.get("dataset_id")
                rows = f" ({context['total_rows']:,} rows)" if context.get("total_rows") is not None else ""
                lines.append(f"- Active Dataset: `{ds_name}`{rows}")
            if context.get("health_score") is not None:
                score = round(float(context["health_score"]), 1)
                lines.append(f"- Dataset Quality Health Score: {score}/100")
            if context.get("columns"):
                cols = ", ".join(f"`{c}`" for c in context["columns"][:25])
                lines.append(f"- Available Columns: {cols}")
            if context.get("audit_summary"):
                summary_str = json.dumps(context["audit_summary"], default=str)
                lines.append(f"- Audit Profile Summary: {summary_str}")

        if stats_bundle and stats_bundle.get("numeric_stats"):
            lines.append("\nLIVE DUCKDB STATISTICAL PROFILE (Verified In-Process Computations):")
            for col, st in stats_bundle["numeric_stats"].items():
                lines.append(
                    f"- `{col}` (n={st['n']:,}): Mean={_fmt_num(st['mean'])}, StdDev={_fmt_num(st['std'])}, "
                    f"Min={_fmt_num(st['min'])}, Q1={_fmt_num(st['q1'])}, Median={_fmt_num(st['median'])}, "
                    f"Q3={_fmt_num(st['q3'])}, Max={_fmt_num(st['max'])}, IQR={_fmt_num(st['iqr'])}, "
                    f"Skewness={_fmt_num(st['skewness'])}, 95% CI=[{_fmt_num(st['ci95_low'])}, {_fmt_num(st['ci95_high'])}], "
                    f"1.5xIQR Outliers={st['outlier_count']}"
                )
            if stats_bundle.get("correlations"):
                corr_strs = [
                    f"`{c['col_a']}` & `{c['col_b']}` (r={c['r']:+.4f}, R²={c['r2']:.4f})"
                    for c in stats_bundle["correlations"][:5]
                ]
                lines.append(f"- Pairwise Pearson Correlations: {', '.join(corr_strs)}")

        return "\n".join(lines)

    # ------------------------------------------------------------------ #
    # LLM plumbing                                                         #
    # ------------------------------------------------------------------ #
    def _build_prompt(self, query: str, conv_id: str, context_str: str) -> str:
        recent_msgs = metadata_repo.list_assistant_messages(conv_id, limit=10)
        history_lines = []
        for m in recent_msgs[:-1]:
            content = m["content"]
            if len(content) > 1200:
                content = content[:1200] + " …"
            history_lines.append(f"{m['role'].capitalize()}: {content}")

        parts = [ASSISTANT_SYSTEM_PROMPT]
        if context_str:
            parts.append(context_str)
        if history_lines:
            parts.append("CONVERSATION SO FAR:\n" + "\n".join(history_lines))
        parts.append(
            f"User: {query}\n\n"
            "Reply as TableTell Copilot. Answer this exact question directly in your first sentence, "
            "then add only the explanation that helps."
        )
        return "\n\n".join(parts)

    def _provider_chain(self, api_key: Optional[str] = None) -> List[Any]:
        """Ordered list of (label, client, model) to try: primary client, then optional Google Gemini backup."""
        chain: List[Any] = []
        primary = get_gemini_client(api_key=api_key)
        if primary:
            chain.append(("primary", primary, settings.DEFAULT_MODEL or "gemini-3-flash-preview"))
        backup_key = getattr(settings, "GOOGLE_API_KEY", "") or os.environ.get("GOOGLE_API_KEY", "")
        if not api_key and backup_key and not isinstance(primary, GoogleGenAIClient):
            chain.append((
                "google",
                GoogleGenAIClient(api_key=backup_key),
                getattr(settings, "BACKUP_MODEL", "") or "gemini-3-flash-preview",
            ))
        return chain

    def _call_llm(self, prompt: str, api_key: Optional[str] = None) -> str:
        errors: List[str] = []
        for label, client, model in self._provider_chain(api_key=api_key):
            try:
                resp = client.models.generate_content(model=model, contents=prompt)
                text = (resp.text or "").strip()
                if text:
                    return _latex_to_unicode(text)
                errors.append(f"{label}: empty response")
            except Exception as e:
                errors.append(f"{label}: {_short_error(e)}")
        raise RuntimeError("; ".join(errors) or "No AI provider configured")

    def _offline_reply(
        self,
        query: str,
        context: Optional[Dict[str, Any]],
        stats_bundle: Dict[str, Any],
        error_msg: Optional[str],
    ) -> str:
        """Honest offline answer: tells the user the model is unreachable, then gives the closest reference note."""
        q = query.lower()
        mentions_data = any(t in q for t in ["my data", "this data", "dataset", "my column", "in my", "for my", "profile", "summary", "describe"])
        reference = self._generate_fallback_response(
            query, context=context, stats_bundle=stats_bundle if mentions_data else {}, error_msg=error_msg
        )
        reason = f" ({error_msg})" if error_msg else " (daily free limit reached or key not configured)"
        notice = (
            f"> 💡 **Statistical Reference Mode{reason}**: Serving pre-verified analytical formula and definition from TableTell's built-in statistical encyclopedia. "
            "To unlock live conversational AI answers, click the **Key / Quota** button in the navbar to enter your free Google Gemini API key (BYOK).\n\n"
        )
        return notice + _latex_to_unicode(reference)

    def ask_assistant(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        api_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Processes a user question:
        1. Saves user query to SQLite
        2. Computes live DuckDB statistical profile for the active dataset
        3. Calls the AI model chain (primary router -> Google backup), or the offline library if all fail
        4. Saves assistant answer to SQLite
        """
        conv = self.get_or_create_conversation(conversation_id)
        conv_id = conv["id"]
        metadata_repo.save_assistant_message(conv_id, role="user", content=query)

        dataset_id = context.get("dataset_id") if context else None
        stats_bundle = self._compute_dataset_statistics(dataset_id)
        context_str = self._format_context_prompt(context, stats_bundle=stats_bundle)
        prompt = self._build_prompt(query, conv_id, context_str)

        try:
            reply_content = self._call_llm(prompt, api_key=api_key)
        except Exception as e:
            reply_content = self._offline_reply(query, context, stats_bundle, str(e))

        saved_msg = metadata_repo.save_assistant_message(conv_id, role="assistant", content=reply_content)
        return {
            "status": "success",
            "reply": reply_content,
            "message_id": saved_msg["id"],
            "conversation_id": conv_id,
            "created_at": saved_msg["created_at"]
        }

    async def stream_assistant(
        self,
        query: str,
        conversation_id: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None,
        api_key: Optional[str] = None
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Server-Sent Events streaming generator for real-time token delivery.
        """
        conv = self.get_or_create_conversation(conversation_id)
        conv_id = conv["id"]
        metadata_repo.save_assistant_message(conv_id, role="user", content=query)

        yield {
            "event": "status",
            "data": json.dumps({"status": "thinking", "message": "Thinking..."})
        }
        await asyncio.sleep(0.02)

        dataset_id = context.get("dataset_id") if context else None
        stats_bundle = self._compute_dataset_statistics(dataset_id)
        context_str = self._format_context_prompt(context, stats_bundle=stats_bundle)
        prompt = self._build_prompt(query, conv_id, context_str)

        full_text = ""
        errors: List[str] = []
        for label, client, model in self._provider_chain(api_key=api_key):
            try:
                for chunk in client.models.generate_content_stream(model=model, contents=prompt):
                    token = chunk.text
                    if token:
                        full_text += token
                        yield {"event": "token", "data": json.dumps({"token": token})}
                        await asyncio.sleep(0.005)
                if full_text:
                    break
                errors.append(f"{label}: empty response")
            except Exception as e:
                errors.append(f"{label}: {_short_error(e)}")
                if full_text:
                    break

        if full_text:
            full_text = _latex_to_unicode(full_text)
        else:
            full_text = self._offline_reply(query, context, stats_bundle, "; ".join(errors) or None)
            yield {"event": "token", "data": json.dumps({"token": full_text})}

        saved_msg = metadata_repo.save_assistant_message(conv_id, role="assistant", content=full_text)
        yield {
            "event": "complete",
            "data": json.dumps({
                "reply": full_text,
                "conversation_id": conv_id,
                "message_id": saved_msg["id"]
            })
        }

    def _generate_fallback_response(
        self,
        query: str,
        context: Optional[Dict[str, Any]] = None,
        stats_bundle: Optional[Dict[str, Any]] = None,
        error_msg: Optional[str] = None
    ) -> str:
        """
        Comprehensive statistical & platform fallback engine.
        Answers statistical theory questions and computes live DuckDB descriptive statistics
        for the active dataset even when no external LLM API key is reachable.
        """
        q = query.lower()
        stats_bundle = stats_bundle or {}
        live_stats_md = self._format_live_stats_markdown(stats_bundle)

        # 1. Contextual dataset question suggestions
        if any(term in q for term in ["what can i ask", "suggest", "questions for this", "analyze this", "help me phrase"]) and context and context.get("columns"):
            cols = context["columns"]
            ds_name = context.get("dataset_name") or context.get("dataset_id") or "this dataset"
            return (
                f"### 💡 Recommended Analytical & Statistical Questions for `{ds_name}`\n\n"
                f"Based on your schema ({', '.join(f'`{c}`' for c in cols[:6])}):\n\n"
                f"1. **Summary Statistics**: *'Show mean, median, and standard deviation across all numeric columns.'*\n"
                f"2. **Category Breakdown**: *'Compare total and average values grouped by category.'*\n"
                f"3. **Time-Series Velocity**: *'Show monthly revenue trends over time as a line chart.'*\n"
                f"4. **Outlier Inspection**: *'Filter and display records above the 95th percentile.'*\n\n"
                f"> 🚀 Copy and paste any of these into the **Studio** query dock!"
                + live_stats_md
            )

        # 2. Comprehensive Statistical Topic Routing
        if any(term in q for term in ["standard deviation", "stddev", "variance", "dispersion", "spread", "volatility", "coefficient of variation"]):
            return FALLBACK_KNOWLEDGE_BASE["std_variance"] + live_stats_md

        if any(term in q for term in ["mean", "median", "mode", "average", "central tendency"]):
            return FALLBACK_KNOWLEDGE_BASE["central_tendency"] + live_stats_md

        if any(term in q for term in ["z-score", "z score", "zscore", "standardize", "standardization", "mad", "median absolute deviation"]):
            return FALLBACK_KNOWLEDGE_BASE["zscore"] + live_stats_md

        if any(term in q for term in ["iqr", "interquartile", "quartile", "percentile", "quantile", "outlier", "tukey", "box plot", "boxplot", "anomaly"]):
            return FALLBACK_KNOWLEDGE_BASE["iqr"] + live_stats_md

        if any(term in q for term in ["correlation", "pearson", "spearman", "covariance", "regression", "r-squared", "r2", "r^2", "slope", "causation", "multicollinearity", "vif"]):
            return FALLBACK_KNOWLEDGE_BASE["correlation_regression"] + live_stats_md

        if any(term in q for term in [
            "p-value", "p value", "pvalue", "hypothesis", "null hypothesis", "significance", "significant",
            "t-test", "t test", "ttest", "anova", "f-test", "chi-square", "chi square", "mann-whitney",
            "type i", "type ii", "false positive", "false negative", "statistical power", "alpha"
        ]):
            return FALLBACK_KNOWLEDGE_BASE["hypothesis_pvalue"] + live_stats_md

        if any(term in q for term in [
            "distribution", "normal distribution", "gaussian", "bell curve", "skew", "skewness", "kurtosis",
            "poisson", "binomial", "log-normal", "lognormal", "central limit", "clt", "empirical rule", "histogram"
        ]):
            return FALLBACK_KNOWLEDGE_BASE["distributions_skew_clt"] + live_stats_md

        if any(term in q for term in [
            "confidence interval", "standard error", "margin of error", "sample size", "a/b test", "ab test",
            "uplift", "simpson", "paradox", "pareto", "80/20"
        ]):
            return FALLBACK_KNOWLEDGE_BASE["confidence_ab_testing"] + live_stats_md

        if any(term in q for term in ["nominal", "ordinal", "categorical", "discrete", "continuous", "variable type", "data type"]):
            return FALLBACK_KNOWLEDGE_BASE["nominal"] + live_stats_md

        # If the user asks generally about "statistics", "stat", "summary", "profile", "describe", or "math" on the dataset
        if any(term in q for term in ["statistic", "stats", "summary", "describe", "profile", "metric", "calculate", "formula", "probability"]):
            return (
                "### 📊 Statistical Analysis & Reference Guide\n\n"
                "I can compute live DuckDB statistics on your active dataset and explain any statistical concept:\n"
                "- **Central Tendency**: Mean ($\\bar{x}$), Median ($Q_2$), Mode — and why `Mean > Median` signals right-skewness.\n"
                "- **Dispersion & Outliers**: Variance ($s^2$), Standard Deviation ($s$), Coefficient of Variation ($CV$), Tukey's `1.5×IQR` fences, and Z-scores ($z = \\frac{x-\\mu}{\\sigma}$).\n"
                "- **Relationships**: Pearson Correlation ($r$), Spearman Rank ($\\rho$), Linear Regression ($y = \\beta_0 + \\beta_1 x$), and $R^2$.\n"
                "- **Hypothesis Testing**: $p$-values, Confidence Intervals ($\\bar{x} \\pm 1.96 \\cdot SE$), Welch's $t$-test, ANOVA ($F$-test), and Chi-Square ($\\chi^2$).\n"
                "- **Distributions**: Normal (68–95–99.7% rule), Skewness, Kurtosis, Poisson, Binomial, and the Central Limit Theorem (CLT)."
                + live_stats_md
            )

        # 3. TableTell Platform & Engineering Topic Routing
        if any(term in q for term in ["what is tabletell", "product", "platform", "about tabletell", "why tabletell"]):
            return FALLBACK_KNOWLEDGE_BASE["what_is_tabletell"]
        elif any(term in q for term in ["self-heal", "self healed", "badge", "error recovery"]):
            return FALLBACK_KNOWLEDGE_BASE["self_heal"]
        elif any(term in q for term in ["duckdb", "sqlite"]):
            return FALLBACK_KNOWLEDGE_BASE["duckdb"]
        elif any(term in q for term in ["file format", "formats supported", "upload format", "csv to parquet"]):
            return FALLBACK_KNOWLEDGE_BASE["file_formats"]
        elif any(term in q for term in ["immutability", "immutable", "lakehouse", "overwritten"]):
            return FALLBACK_KNOWLEDGE_BASE["immutability"]
        elif any(term in q for term in ["privacy", "private", "security", "sent to llm", "safe"]):
            return FALLBACK_KNOWLEDGE_BASE["privacy"]
        elif any(term in q for term in ["duplicate", "drop duplicate"]):
            return FALLBACK_KNOWLEDGE_BASE["duplicate"]
        elif any(term in q for term in ["telemetry", "dag", "pipeline", "execution runs", "stored"]):
            return FALLBACK_KNOWLEDGE_BASE["telemetry"]
        elif any(term in q for term in ["cancel", "stop button", "abort"]):
            return FALLBACK_KNOWLEDGE_BASE["cancel"]
        elif any(term in q for term in ["clean", "fix", "repair", "auto-clean", "version"]):
            return FALLBACK_KNOWLEDGE_BASE["clean"]
        elif any(term in q for term in ["score", "health", "dimension", "audit"]):
            score_info = f"\n\nYour current dataset score is **{round(context['health_score'], 1)}/100**." if context and context.get("health_score") is not None else ""
            return FALLBACK_KNOWLEDGE_BASE["health_score"] + score_info
        elif any(term in q for term in ["parquet", "storage", "csv"]):
            return FALLBACK_KNOWLEDGE_BASE["parquet"]

        # 4. Default response enriched with live DuckDB dataset stats if a dataset is active
        return (
            "### ⚡ TableTell Statistical & Lakehouse Copilot\n\n"
            "You can ask me **any statistical, data science, or TableTell question**, such as:\n"
            "- **Descriptive & Outlier Statistics**: *'Explain standard deviation & variance'*, *'Mean vs. Median'*, *'How do Z-scores and 1.5x IQR detect outliers?'*\n"
            "- **Hypothesis Testing & Inference**: *'What is a p-value?'*, *'When should I use a t-test, ANOVA, or Chi-Square?'*, *'Explain 95% confidence intervals & A/B testing'*\n"
            "- **Correlation & Distributions**: *'Explain Pearson r vs. R-squared'*, *'What is skewness, kurtosis, and the Central Limit Theorem?'*\n"
            "- **Platform & Lakehouse**: *'How does Auto-Clean work?'*, *'What is the 100-point Health Score?'*, *'Why DuckDB + Parquet?'*"
            + live_stats_md
        )


assistant_service = AssistantService()
