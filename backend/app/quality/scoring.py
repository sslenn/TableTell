"""
Explainable Health Scoring Engine for TableTell.
Calculates multi-dimensional quality scores with configurable weights and transparent breakdowns.
"""

from typing import Dict, Any, List, Tuple, Optional
from app.core.config import settings
from app.schemas.quality import (
    QualityDimensionScore,
    DimensionAuditRule,
    QualityIssue,
    DatasetAuditReport,
    ColumnStat,
    DatasetDistributionTopology
)
from app.quality.rules import (
    evaluate_completeness_rules,
    evaluate_uniqueness_rules,
    evaluate_validity_rules,
    evaluate_consistency_rules,
    evaluate_anomaly_rules
)


class QualityScoringEngine:
    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or settings.QUALITY_WEIGHTS

    def evaluate_quality(self, profile: Dict[str, Any], dataset_id: str, version: int = 1) -> DatasetAuditReport:
        """
        Calculates explainable health score across 5 standard dimensions:
        - Completeness (default 25%)
        - Validity (default 25%)
        - Consistency (default 20%)
        - Uniqueness (default 15%)
        - Anomaly Review (default 15%)
        """
        all_issues: List[QualityIssue] = []
        dimensions: List[QualityDimensionScore] = []
        weighted_sum = 0.0

        # 1. Completeness
        w_comp = self.weights.get("completeness", 0.25)
        p_comp, f_comp, iss_comp, exp_comp = evaluate_completeness_rules(profile)
        all_issues.extend(iss_comp)
        # Score calculation: penalize heavily for critical identifier nulls
        crit_null_issues = [i for i in iss_comp if i.severity == "critical"]
        base_comp_score = 100
        if crit_null_issues:
            # Drop up to 40 points for missing IDs
            crit_pct = sum(i.affected_pct for i in crit_null_issues)
            base_comp_score -= min(40, int(crit_pct * 3.5))
        # General null penalty
        gen_null_pct = sum(i.affected_pct for i in iss_comp if i.severity != "critical")
        base_comp_score -= min(30, int(gen_null_pct * 0.5))
        s_comp = max(10, min(100, base_comp_score))

        comp_rules = [
            DimensionAuditRule(
                rule_name="Zero Missing Values",
                passed=f_comp == 0,
                description=f"{p_comp}/{max(1, p_comp + f_comp)} columns have 0% missing values."
            ),
            DimensionAuditRule(
                rule_name="Critical ID Completeness",
                passed=len(crit_null_issues) == 0,
                description="Entity IDs (order_id, customer_id, transaction_no) have no missing keys."
            )
        ]

        dimensions.append(QualityDimensionScore(
            dimension="Completeness",
            weight=w_comp,
            score=s_comp,
            checks_passed=p_comp,
            checks_failed=f_comp,
            explanation=exp_comp,
            rules_checked=comp_rules
        ))
        weighted_sum += s_comp * w_comp

        # 2. Validity
        w_val = self.weights.get("validity", 0.25)
        p_val, f_val, iss_val, exp_val = evaluate_validity_rules(profile)
        all_issues.extend(iss_val)
        val_penalty = len([i for i in iss_val if i.severity in ["critical", "warning"]]) * 15
        s_val = max(10, min(100, 100 - val_penalty))

        neg_issues = [i for i in iss_val if i.rule_id == "RULE_VALIDITY_NEGATIVE_NUMERIC"]
        date_issues = [i for i in iss_val if i.rule_id == "RULE_VALIDITY_DATE_FORMAT"]
        val_rules = [
            DimensionAuditRule(
                rule_name="Non-Negative Price & Qty",
                passed=len(neg_issues) == 0,
                description="Prices and quantities contain zero unexpected negative values."
            ),
            DimensionAuditRule(
                rule_name="ISO-8601 Temporal Format",
                passed=len(date_issues) == 0,
                description="Dates and timestamps follow clean standardized temporal format."
            )
        ]

        dimensions.append(QualityDimensionScore(
            dimension="Validity",
            weight=w_val,
            score=s_val,
            checks_passed=p_val,
            checks_failed=f_val,
            explanation=exp_val,
            rules_checked=val_rules
        ))
        weighted_sum += s_val * w_val

        # 3. Consistency
        w_cons = self.weights.get("consistency", 0.20)
        p_cons, f_cons, iss_cons, exp_cons = evaluate_consistency_rules(profile)
        all_issues.extend(iss_cons)
        s_cons = 100 if f_cons == 0 else max(50, 100 - (f_cons * 10))

        cons_rules = [
            DimensionAuditRule(
                rule_name="Lowercase snake_case",
                passed=f_cons == 0,
                description="Column headers strictly adhere to lowercase snake_case convention."
            ),
            DimensionAuditRule(
                rule_name="No Whitespace / Symbols",
                passed=f_cons == 0,
                description="Column headers are free of spaces and illegal SQL characters (!@#$%^&*()-+=)."
            )
        ]

        dimensions.append(QualityDimensionScore(
            dimension="Consistency",
            weight=w_cons,
            score=s_cons,
            checks_passed=p_cons,
            checks_failed=f_cons,
            explanation=exp_cons,
            rules_checked=cons_rules
        ))
        weighted_sum += s_cons * w_cons

        # 4. Uniqueness
        w_uniq = self.weights.get("uniqueness", 0.15)
        p_uniq, f_uniq, iss_uniq, exp_uniq = evaluate_uniqueness_rules(profile)
        all_issues.extend(iss_uniq)
        dup_rows = profile.get("duplicate_rows", 0)
        tot_rows = profile.get("total_rows", 1)
        if dup_rows > 0 and tot_rows > 0:
            dup_ratio = dup_rows / tot_rows
            s_uniq = max(10, min(100, int(round(100 - (dup_ratio * 100 * 3)))))
        else:
            s_uniq = 100

        dup_pct = round((dup_rows / max(1, tot_rows)) * 100, 2)
        uniq_rules = [
            DimensionAuditRule(
                rule_name="Exact Duplicate Rows",
                passed=dup_rows == 0,
                description=f"Zero identical rows detected across all columns ({dup_rows:,} duplicates found)."
            ),
            DimensionAuditRule(
                rule_name="Duplicate Collision Rate (<5%)",
                passed=dup_pct <= 5.0,
                description=f"Duplicate percentage ({dup_pct}%) is within safe tolerance threshold (<5%)."
            )
        ]

        dimensions.append(QualityDimensionScore(
            dimension="Uniqueness",
            weight=w_uniq,
            score=s_uniq,
            checks_passed=p_uniq,
            checks_failed=f_uniq,
            explanation=exp_uniq,
            rules_checked=uniq_rules
        ))
        weighted_sum += s_uniq * w_uniq

        # 5. Anomaly Review
        w_anom = self.weights.get("anomaly", 0.15)
        p_anom, f_anom, iss_anom, exp_anom = evaluate_anomaly_rules(profile)
        all_issues.extend(iss_anom)
        s_anom = max(70, 100 - (f_anom * 8))

        anom_rules = [
            DimensionAuditRule(
                rule_name="1.5x IQR & Categorical Outliers",
                passed=f_anom == 0,
                description=f"{p_anom}/{max(1, p_anom + f_anom)} dimensions are free of statistical IQR outliers and categorical typos."
            ),
            DimensionAuditRule(
                rule_name="Distribution Variance Stability",
                passed=s_anom >= 80,
                description="Distribution moments and categorical variance are well-bounded for aggregations."
            )
        ]

        dimensions.append(QualityDimensionScore(
            dimension="Anomaly Review",
            weight=w_anom,
            score=s_anom,
            checks_passed=p_anom,
            checks_failed=f_anom,
            explanation=exp_anom,
            rules_checked=anom_rules
        ))
        weighted_sum += s_anom * w_anom

        final_health_score = int(round(weighted_sum))
        final_health_score = max(10, min(100, final_health_score))

        # Format legacy issues string list for full frontend compatibility
        legacy_issues = [issue.evidence for issue in all_issues]

        column_stats_list = [
            ColumnStat(
                column_name=c["column_name"],
                data_type=c["data_type"],
                semantic_type=c.get("semantic_type", "categorical"),
                variable_type=c.get("variable_type", "Categorical"),
                statistical_type=c.get("statistical_type", "Nominal"),
                null_count=c["null_count"],
                null_pct=c["null_pct"],
                distinct_count=c["distinct_count"],
                sample_values=c.get("sample_values", []),
                min_val=c.get("min_val"),
                max_val=c.get("max_val"),
                mean_val=c.get("mean_val"),
                is_identifier=c.get("is_identifier", False),
                has_outliers=c.get("has_outliers", False),
                outlier_count=c.get("outlier_count", 0),
                outlier_pct=c.get("outlier_pct", 0.0),
                distribution=c.get("distribution"),
                categorical_stats=c.get("categorical_stats")
            )
            for c in profile.get("columns", [])
        ]

        topology_raw = profile.get("topology")
        topology_obj = DatasetDistributionTopology(**topology_raw) if topology_raw else None

        return DatasetAuditReport(
            dataset_id=dataset_id,
            version=version,
            total_rows=profile.get("total_rows", 0),
            total_cols=profile.get("total_cols", 0),
            data_health_score=final_health_score,
            duplicate_rows=profile.get("duplicate_rows", 0),
            columns=column_stats_list,
            column_names=profile.get("column_names", []),
            dtypes=profile.get("dtypes", {}),
            null_summary=profile.get("null_summary", {}),
            dimensions=dimensions,
            issues=legacy_issues,
            structured_issues=all_issues,
            cleaning_recommendations=legacy_issues,
            topology=topology_obj
        )


quality_scoring_engine = QualityScoringEngine()
