"""
Distribution Profiling Engine for TableTell.
Vectorized statistical classification, histogram binning, box plot statistics,
and dataset-level distribution topology generation.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from app.schemas.quality import (
    DistributionProfile,
    HistogramBin,
    BoxPlotStats,
    DatasetDistributionTopology
)


def compute_column_distribution(
    series: pd.Series,
    col_name: str,
    total_rows: int
) -> Optional[DistributionProfile]:
    """
    Computes statistical distribution profile for a numeric column.
    Generates histogram bins, box-plot quartiles, skewness, kurtosis,
    distribution classification, and actionable business recommendations.
    """
    valid_series = pd.to_numeric(series, errors="coerce").dropna()
    if len(valid_series) < 3:
        return None

    min_val = float(valid_series.min())
    max_val = float(valid_series.max())
    mean_val = float(valid_series.mean())
    median_val = float(valid_series.median())
    std_val = float(valid_series.std()) if len(valid_series) > 1 else 0.0

    # 1. Five-number summary and IQR outliers
    q25 = float(valid_series.quantile(0.25))
    q75 = float(valid_series.quantile(0.75))
    iqr = q75 - q25
    lower_bound = q25 - 1.5 * iqr
    upper_bound = q75 + 1.5 * iqr

    outlier_series = valid_series[(valid_series < lower_bound) | (valid_series > upper_bound)]
    outliers_list = [round(float(x), 2) for x in outlier_series.unique()[:10]]

    box_plot = BoxPlotStats(
        min=round(min_val, 2),
        q25=round(q25, 2),
        median=round(median_val, 2),
        q75=round(q75, 2),
        max=round(max_val, 2),
        lower_bound=round(lower_bound, 2),
        upper_bound=round(upper_bound, 2),
        outliers=outliers_list
    )

    # 2. Skewness and Kurtosis
    skewness = float(valid_series.skew()) if len(valid_series) >= 3 else 0.0
    if np.isnan(skewness):
        skewness = 0.0
    kurtosis = float(valid_series.kurt()) if len(valid_series) >= 4 else 0.0
    if np.isnan(kurtosis):
        kurtosis = 0.0

    mean_median_ratio = round(mean_val / median_val, 2) if median_val != 0 else (1.0 if mean_val == 0 else 999.0)

    # 3. Histogram Bins (Adaptive 8 to 12 bins)
    num_bins = min(12, max(6, int(np.sqrt(len(valid_series)))))
    bins: List[HistogramBin] = []

    if min_val == max_val:
        bins.append(HistogramBin(
            bin_start=round(min_val, 2),
            bin_end=round(max_val, 2),
            bin_label=f"{min_val:.2f}",
            count=len(valid_series),
            pct=100.0
        ))
    else:
        counts, edges = np.histogram(valid_series, bins=num_bins)
        total_valid = len(valid_series)
        for i in range(len(counts)):
            b_start = round(float(edges[i]), 2)
            b_end = round(float(edges[i + 1]), 2)
            cnt = int(counts[i])
            pct = round((cnt / total_valid) * 100, 1) if total_valid > 0 else 0.0
            bins.append(HistogramBin(
                bin_start=b_start,
                bin_end=b_end,
                bin_label=f"{b_start:g} - {b_end:g}",
                count=cnt,
                pct=pct
            ))

    # 4. Approximate Density Curve
    density_curve: List[Dict[str, float]] = []
    if len(bins) > 1:
        for b in bins:
            midpoint = round((b.bin_start + b.bin_end) / 2.0, 2)
            density_curve.append({
                "x": midpoint,
                "y": round(b.pct / 100.0, 4)
            })

    # 5. Modality Detection & Uniformity
    bin_counts = [b.count for b in bins]
    avg_bin_count = float(np.mean(bin_counts)) if bin_counts else 0.0
    std_bin_count = float(np.std(bin_counts)) if bin_counts else 0.0
    cv_bins = (std_bin_count / avg_bin_count) if avg_bin_count > 0 else 0.0
    is_uniform_candidate = cv_bins < 0.28 and abs(skewness) < 0.45 and kurtosis < -0.6

    modality = "uniform" if is_uniform_candidate else "unimodal"
    if not is_uniform_candidate and len(bins) >= 5:
        peak_indices = []
        for i in range(1, len(bins) - 1):
            # Significant peak check to prevent sample noise from triggering false multimodal
            if (
                bins[i].count > bins[i - 1].count * 1.18
                and bins[i].count > bins[i + 1].count * 1.18
                and bins[i].count > avg_bin_count * 1.15
            ):
                peak_indices.append(i)
        if len(peak_indices) == 2:
            modality = "bimodal"
        elif len(peak_indices) > 2:
            modality = "multimodal"

    # 6. Distribution Classification
    zero_ratio = (valid_series == 0).sum() / len(valid_series)
    is_symmetric = abs(skewness) < 0.35

    if zero_ratio > 0.35 and len(valid_series.unique()) > 2:
        distribution_type = "zero_inflated"
        confidence = 0.90
        summary = (
            f"Zero-inflated sparse distribution with {zero_ratio * 100:.1f}% zero values. "
            f"Distinct hurdle between inactive records and positive values."
        )
        recommendation = (
            f"Treat as a two-part hurdle process. Analyze zero-frequency separately from positive amounts."
        )
    elif is_uniform_candidate:
        distribution_type = "uniform"
        confidence = 0.88
        summary = (
            f"Evenly spread uniform distribution across range [{min_val:.2f}, {max_val:.2f}] (CV: {cv_bins:.2f}). "
            f"Records are evenly dispersed with no central peak."
        )
        recommendation = (
            f"Values have equal representation across buckets. Stratified sampling works reliably."
        )
    elif modality in ["bimodal", "multimodal"]:
        distribution_type = modality
        confidence = 0.82
        summary = (
            f"{modality.capitalize()} distribution with multiple distinct sub-population clusters. "
            f"Values divide into separate groups rather than a single bell curve."
        )
        recommendation = (
            f"Investigate underlying segmentation (e.g., customer tiers or geographic cohorts) "
            f"before applying aggregate metrics."
        )
    elif abs(skewness) < 0.5 and abs(kurtosis) < 1.2:
        distribution_type = "normal"
        confidence = round(max(0.75, 1.0 - (abs(skewness) * 0.4 + abs(kurtosis) * 0.15)), 2)
        summary = (
            f"Symmetric Gaussian distribution (skewness: {skewness:.2f}, kurtosis: {kurtosis:.2f}). "
            f"Predictable spread centered at mean {mean_val:.2f}."
        )
        recommendation = (
            f"Standard parametric methods (mean, standard deviation, Z-score outlier detection) "
            f"and linear regressions are fully statistically valid."
        )
    elif skewness > 0.5:
        distribution_type = "right_skewed"
        confidence = min(0.98, round(0.78 + min(0.18, skewness * 0.05), 2))
        summary = (
            f"Right-skewed long-tail distribution (skewness: {skewness:.2f}, mean/median ratio: {mean_median_ratio:.2f}). "
            f"Majority of records cluster at lower values with high-value positive outliers."
        )
        recommendation = (
            f"Use median ({median_val:.2f}) and IQR rather than mean ({mean_val:.2f}) for reporting central tendency. "
            f"Consider log-transformation (log1p) prior to machine learning modeling."
        )
    elif skewness < -0.5:
        distribution_type = "left_skewed"
        confidence = min(0.98, round(0.78 + min(0.18, abs(skewness) * 0.05), 2))
        summary = (
            f"Left-skewed distribution with negative tail (skewness: {skewness:.2f}). "
            f"Most records cluster toward the higher values."
        )
        recommendation = (
            f"Use median ({median_val:.2f}) and percentiles. Beware of lower-tail drop-offs and floor effects."
        )
    elif kurtosis < -1.0 and abs(skewness) < 0.5:
        distribution_type = "uniform"
        confidence = 0.85
        summary = (
            f"Platykurtic uniform distribution across range [{min_val:.2f}, {max_val:.2f}]. "
            f"Records are evenly dispersed with no central peak."
        )
        recommendation = (
            f"Values have equal representation across buckets. Stratified sampling works reliably."
        )
    else:
        distribution_type = "moderate_skew"
        confidence = 0.70
        summary = (
            f"Moderate skew distribution (skewness: {skewness:.2f}, kurtosis: {kurtosis:.2f})."
        )
        recommendation = (
            f"Inspect median ({median_val:.2f}) alongside mean ({mean_val:.2f}) to avoid distortion."
        )

    # 7. Sample observations for scatter plots & visual observation inspection
    sample_size = min(80, len(valid_series))
    step = max(1, len(valid_series) // sample_size)
    sample_obs = [round(float(x), 2) for x in valid_series.iloc[::step][:sample_size]]
    # Ensure outlier samples are included in the sample observations if any exist
    if not outlier_series.empty and len(outliers_list) > 0:
        for out_val in outliers_list[:8]:
            if out_val not in sample_obs:
                sample_obs.append(out_val)

    return DistributionProfile(
        distribution_type=distribution_type,
        confidence=confidence,
        skewness=round(skewness, 2),
        kurtosis=round(kurtosis, 2),
        mean_median_ratio=mean_median_ratio,
        modality=modality,
        is_symmetric=is_symmetric,
        summary=summary,
        business_recommendation=recommendation,
        bins=bins,
        box_plot=box_plot,
        density_curve=density_curve,
        sample_observations=sample_obs
    )


def compute_dataset_distribution_topology(
    columns: List[Dict[str, Any]]
) -> DatasetDistributionTopology:
    """
    Synthesizes overall distribution topology across all analyzed columns.
    Provides counts by distribution family and high-level analytical findings.
    """
    normal_c = 0
    skewed_c = 0
    uniform_c = 0
    multimodal_c = 0
    categorical_c = 0
    total_analyzed = 0
    outlier_col_names = []

    for col in columns:
        dist: Optional[Dict[str, Any]] = col.get("distribution")
        semantic = col.get("semantic_type", "categorical")

        if dist and isinstance(dist, dict):
            total_analyzed += 1
            dtype = dist.get("distribution_type", "")
            if dtype == "normal":
                normal_c += 1
            elif "skew" in dtype or dtype == "zero_inflated":
                skewed_c += 1
            elif dtype == "uniform":
                uniform_c += 1
            elif dtype in ["bimodal", "multimodal"]:
                multimodal_c += 1

            if col.get("has_outliers"):
                outlier_col_names.append(col.get("column_name", ""))
        elif semantic == "categorical":
            categorical_c += 1

    findings: List[str] = []
    if skewed_c > 0:
        findings.append(
            f"{skewed_c} numeric metric{'' if skewed_c == 1 else 's'} exhibit right-skewed or long-tail behavior typical of transaction volumes."
        )
    if normal_c > 0:
        findings.append(
            f"{normal_c} metric{'' if normal_c == 1 else 's'} follow a normal Gaussian curve suitable for standard linear regressions."
        )
    if outlier_col_names:
        sample_cols = ", ".join(f"'{c}'" for c in outlier_col_names[:3])
        findings.append(
            f"Statistical outliers (>1.5x IQR) detected in {len(outlier_col_names)} column{'' if len(outlier_col_names) == 1 else 's'} ({sample_cols})."
        )
    if multimodal_c > 0:
        findings.append(
            f"{multimodal_c} column{'' if multimodal_c == 1 else 's'} display multimodal clustering, suggesting hidden customer or operational segments."
        )

    if not findings:
        findings.append("All analyzed columns exhibit uniform or well-balanced categorical distributions.")

    return DatasetDistributionTopology(
        total_analyzed=total_analyzed,
        normal_count=normal_c,
        skewed_count=skewed_c,
        uniform_count=uniform_c,
        multimodal_count=multimodal_c,
        categorical_count=categorical_c,
        key_findings=findings
    )
