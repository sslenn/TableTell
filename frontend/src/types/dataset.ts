export interface DatasetSummary {
  dataset_id: string;
  filename: string;
  total_rows: number;
  total_cols: number;
  data_health_score: number;
  size_kb: number;
  current_version?: number;
  source_format?: string;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  bin_label: string;
  count: number;
  pct: number;
}

export interface BoxPlotStats {
  min?: number | null;
  q25?: number | null;
  median?: number | null;
  q75?: number | null;
  max?: number | null;
  lower_bound?: number | null;
  upper_bound?: number | null;
  outliers?: number[];
}

export interface DistributionProfile {
  distribution_type: string;
  confidence: number;
  skewness?: number | null;
  kurtosis?: number | null;
  mean_median_ratio?: number | null;
  modality: string;
  is_symmetric: boolean;
  summary: string;
  business_recommendation: string;
  bins: HistogramBin[];
  box_plot?: BoxPlotStats | null;
  density_curve?: { x: number; y: number }[];
  sample_observations?: number[];
}

export interface DatasetDistributionTopology {
  total_analyzed: number;
  normal_count: number;
  skewed_count: number;
  uniform_count: number;
  multimodal_count: number;
  categorical_count: number;
  key_findings: string[];
}

export interface ColumnStat {
  column_name: string;
  data_type: string;
  semantic_type?: string;
  variable_type?: string;
  statistical_type?: string;
  null_count: number;
  null_pct: number;
  distinct_count: number;
  sample_values: (string | number | boolean | null)[];
  min_val?: number | null;
  max_val?: number | null;
  mean_val?: number | null;
  is_identifier?: boolean;
  has_outliers?: boolean;
  outlier_count?: number;
  outlier_pct?: number;
  distribution?: DistributionProfile | null;
  categorical_stats?: {
    top_values?: { value: string; count: number; pct: number }[];
    rare_categories?: { value: string; count: number; pct: number }[];
    rare_count?: number;
    casing_anomalies?: { variant: string; canonical: string }[];
    whitespace_anomalies?: string[];
    fuzzy_duplicates?: { original: string; suggested_canonical: string; similarity: number }[];
    cardinality_ratio?: number;
    is_high_cardinality?: boolean;
  } | null;
}

export interface DimensionAuditRule {
  rule_name: string;
  passed: boolean;
  description: string;
}

export interface QualityDimensionScore {
  dimension: string;
  weight: number;
  score: number;
  checks_passed: number;
  checks_failed: number;
  explanation: string;
  rules_checked?: DimensionAuditRule[];
}

export interface QualityIssue {
  rule_id: string;
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  affected_columns: string[];
  affected_rows: number;
  affected_pct: number;
  evidence: string;
  proposed_action: string;
  approval_required: boolean;
}

export interface DatasetAuditReport {
  dataset_id: string;
  version?: number;
  total_rows: number;
  total_cols: number;
  data_health_score: number;
  columns: ColumnStat[];
  column_names?: string[];
  duplicate_rows: number;
  cleaning_recommendations?: string[];
  issues?: string[];
  dimensions?: QualityDimensionScore[];
  structured_issues?: QualityIssue[];
  topology?: DatasetDistributionTopology | null;
}

export interface CleaningRecommendation {
  recommendation_id: string;
  rule_id: string;
  action_type: string;
  affected_columns: string[];
  affected_rows: number;
  affected_pct: number;
  evidence: string;
  proposed_action: string;
  reason: string;
  expected_impact: string;
  risk_level: 'low' | 'medium' | 'high';
  approval_required: boolean;
  approved: boolean;
}

export interface CleaningPlan {
  plan_id: string;
  dataset_id: string;
  source_version: number;
  created_at: string;
  recommendations: CleaningRecommendation[];
}

export interface CleaningResult {
  dataset_id: string;
  cleaned_dataset_id?: string;
  original_rows: number;
  cleaned_rows: number;
  removed_duplicates: number;
  imputed_nulls: number;
  clean_parquet_file: string;
  source_version?: number;
  new_version?: number;
  health_score_before?: number;
  health_score_after?: number;
  changelog?: string[];
}
