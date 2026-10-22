import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Activity,
  Lightbulb,
  Info,
  Tag,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  ScatterChart,
  ShieldCheck,
  Trash2,
  Wand2
} from 'lucide-react';
import type { ColumnStat, DatasetDistributionTopology } from '../../types/dataset';

interface DistributionProfilerProps {
  columns: ColumnStat[];
  topology?: DatasetDistributionTopology | null;
  datasetId: string;
}

export type ProfilerVisualMode = 'histogram' | 'boxplot' | 'scatter';

export const DistributionProfiler: React.FC<DistributionProfilerProps> = ({
  columns,
  topology,
  datasetId
}) => {
  // Filter columns that have distribution profiles (numeric) or categorical statistics
  const profilableCols = columns.filter((c) => Boolean(c.distribution || c.categorical_stats));

  const [selectedColName, setSelectedColName] = useState<string>(
    profilableCols[0]?.column_name || ''
  );
  const [visualMode, setVisualMode] = useState<ProfilerVisualMode>('histogram');
  const [hoveredBinIdx, setHoveredBinIdx] = useState<number | null>(null);
  const [hoveredOutlier, setHoveredOutlier] = useState<{ val: number; delta: number; severity: string } | null>(null);
  const [hoveredScatterPoint, setHoveredScatterPoint] = useState<{ index: number; val: number; isOutlier: boolean; delta: number } | null>(null);

  const selectedCol = profilableCols.find((c) => c.column_name === selectedColName) || profilableCols[0];
  const dist = selectedCol?.distribution;
  const catStats = selectedCol?.categorical_stats;
  const isCategorical = Boolean(!dist && catStats);

  if (profilableCols.length === 0) {
    return (
      <div
        className="p-6 rounded-2xl border text-center text-xs font-mono"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          color: 'var(--tt-text-muted)'
        }}
      >
        No analyzable columns available for profiling in '{datasetId}'.
      </div>
    );
  }

  // Calculate histogram max count for proportional heights
  const maxBinCount = dist?.bins && dist.bins.length > 0
    ? Math.max(...dist.bins.map((b) => b.count))
    : 1;

  // Box plot positioning relative to min & max
  const boxPlot = dist?.box_plot;
  const range = (boxPlot?.max ?? 1) - (boxPlot?.min ?? 0);
  const getPercent = (val: number | null | undefined) => {
    if (val === null || val === undefined || range <= 0) return 0;
    return Math.max(0, Math.min(100, ((val - (boxPlot?.min ?? 0)) / range) * 100));
  };

  const getDistributionBadgeColor = (type: string) => {
    switch (type) {
      case 'normal':
        return { bg: 'rgba(52, 211, 153, 0.15)', text: '#34D399', border: 'rgba(52, 211, 153, 0.3)' };
      case 'right_skewed':
      case 'left_skewed':
        return { bg: 'rgba(251, 146, 60, 0.15)', text: '#FB923C', border: 'rgba(251, 146, 60, 0.3)' };
      case 'uniform':
        return { bg: 'rgba(56, 189, 248, 0.15)', text: '#38BDF8', border: 'rgba(56, 189, 248, 0.3)' };
      case 'zero_inflated':
        return { bg: 'rgba(248, 113, 113, 0.15)', text: '#F87171', border: 'rgba(248, 113, 113, 0.3)' };
      default:
        return { bg: 'var(--tt-primary-subtle)', text: 'var(--tt-primary)', border: 'var(--tt-border-subtle)' };
    }
  };

  const badgeStyle = dist ? getDistributionBadgeColor(dist.distribution_type) : null;

  // Extract observation points for Scatter Plot visualization
  const observationPoints = useMemo(() => {
    if (dist?.sample_observations && dist.sample_observations.length > 0) {
      return dist.sample_observations;
    }
    // Fallback: derive from sample_values
    const numericSamples = (selectedCol?.sample_values || [])
      .map((v) => Number(v))
      .filter((v) => !isNaN(v));
    if (numericSamples.length >= 10) {
      return numericSamples;
    }
    // Synthesize structured sample from five-number summary and outliers if needed
    if (boxPlot && boxPlot.min !== null && boxPlot.max !== null) {
      const pts: number[] = [];
      const min = boxPlot.min ?? 0;
      const max = boxPlot.max ?? 100;
      const median = boxPlot.median ?? (min + max) / 2;
      const q25 = boxPlot.q25 ?? (min + median) / 2;
      const q75 = boxPlot.q75 ?? (median + max) / 2;
      for (let i = 0; i < 48; i++) {
        // Deterministic pseudo-random generation using index
        const pseudo = ((Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1 + 1) / 2;
        const val = pseudo < 0.25 ? min + pseudo * 4 * (q25 - min) :
                    pseudo < 0.75 ? q25 + (pseudo - 0.25) * 2 * (q75 - q25) :
                    q75 + (pseudo - 0.75) * 4 * (max - q75);
        pts.push(Math.round(val * 100) / 100);
      }
      // Guarantee all detected outliers are represented
      (boxPlot.outliers || []).forEach((outVal) => {
        pts.push(outVal);
      });
      return pts;
    }
    return [];
  }, [dist, selectedCol, boxPlot]);

  // Outlier Disposition & Treatment Strategy evaluation
  const disposition = useMemo(() => {
    if (!selectedCol) return null;
    const bp = dist?.box_plot;
    const outlierCount = selectedCol.outlier_count || bp?.outliers?.length || 0;
    const outlierPct = selectedCol.outlier_pct || 0;
    const minVal = Number(selectedCol.min_val ?? bp?.min ?? 0);
    const maxVal = Number(selectedCol.max_val ?? bp?.max ?? 0);
    const skewness = dist?.skewness ?? 0;
    const colName = selectedCol.column_name.toLowerCase();

    if (outlierCount === 0) {
      return {
        decision: 'CLEAN' as const,
        title: 'Zero Extreme Outliers',
        badgeBg: 'rgba(52, 211, 153, 0.15)',
        badgeText: '#34D399',
        badgeBorder: 'rgba(52, 211, 153, 0.3)',
        Icon: ShieldCheck,
        reason: `All observations for '${selectedCol.column_name}' fall cleanly within 1.5x IQR boundaries. Standard parametric metrics (Mean, Std Dev) are statistically sound.`,
        biRule: 'Direct aggregation (SUM, AVG) and standard executive dashboard reporting can be used safely without risk of distortion.',
        mlRule: 'Standard feature scaling (Z-score normalization / StandardScaler) is recommended with zero data pruning required.',
        outlierCount: 0,
        outlierPct: 0
      };
    }

    // 1. Check for physical domain impossibility or sentinel values -> REMOVE
    const isImpossibleNegative = minVal < 0 && (
      colName.includes('price') || colName.includes('revenue') || colName.includes('amount') ||
      colName.includes('age') || colName.includes('qty') || colName.includes('quantity') ||
      colName.includes('count') || colName.includes('duration') || colName.includes('spend')
    );
    const isSentinelError = maxVal === 99999 || maxVal === 999999 || minVal === -999;

    if (isImpossibleNegative || isSentinelError) {
      return {
        decision: 'REMOVE' as const,
        title: 'RECOMMENDATION: REMOVE (Corrupt / Impossible Observations)',
        badgeBg: 'rgba(248, 113, 113, 0.15)',
        badgeText: '#F87171',
        badgeBorder: 'rgba(248, 113, 113, 0.35)',
        Icon: Trash2,
        reason: `Values detected (e.g. min: ${minVal}, max: ${maxVal}) violate physical domain constraints or represent sentinel test placeholders (${selectedCol.column_name} cannot be negative or sentinel 99999).`,
        biRule: 'Filter out or set these corrupted cells to NULL prior to aggregation to prevent phantom variance from skewing executive KPIs.',
        mlRule: 'Drop these corrupted rows or treat them as missing values to be imputed; training on physically impossible numbers introduces systematic bias.',
        outlierCount,
        outlierPct
      };
    }

    // 2. Check for legitimate high-value business metric -> RETAIN
    const isBusinessMetric = colName.includes('revenue') || colName.includes('sales') ||
      colName.includes('price') || colName.includes('amount') || colName.includes('salary') ||
      colName.includes('spend') || colName.includes('profit') || colName.includes('balance') ||
      colName.includes('views') || colName.includes('downloads') || colName.includes('score');

    if (isBusinessMetric && skewness > 0.4 && minVal >= 0) {
      return {
        decision: 'RETAIN' as const,
        title: 'RECOMMENDATION: RETAIN (Legitimate High-Value Business Events)',
        badgeBg: 'rgba(45, 212, 191, 0.15)',
        badgeText: '#2DD4BF',
        badgeBorder: 'rgba(45, 212, 191, 0.35)',
        Icon: ShieldCheck,
        reason: `These high values represent authentic top-tier business activity (e.g. enterprise contracts, wholesale transactions, viral engagement) following a natural Pareto/power-law distribution. Deleting them would artificially erase valid revenue and obscure whale customer segments.`,
        biRule: `Report both Median (${bp?.median ?? '—'}) and Mean (${selectedCol.mean_val ?? '—'}), supplemented with percentile thresholds (P90, P99), to preserve true financial totals while avoiding distorted central tendency.`,
        mlRule: `Do NOT delete these rows. For linear models and neural networks sensitive to gradient leverage, apply Log Transformation (log1p) or Winsorization (capping at P99). For tree-based models (XGBoost, LightGBM, Random Forest), keep raw values as decision trees are naturally invariant to monotonic feature scaling.`,
        outlierCount,
        outlierPct
      };
    }

    // 3. Otherwise -> TREAT (Parametric Distortion)
    return {
      decision: 'TREAT' as const,
      title: 'RECOMMENDATION: TREAT (Winsorize / Cap to Prevent Parametric Distortion)',
      badgeBg: 'rgba(251, 146, 60, 0.15)',
      badgeText: '#FB923C',
      badgeBorder: 'rgba(251, 146, 60, 0.35)',
      Icon: Wand2,
      reason: `Detected ${outlierCount} observation(s) (${outlierPct}%) extending beyond the 1.5x IQR Tukey fence. While these may be real observations, their extreme leverage destabilizes ordinary least squares (OLS) regression slopes, distance-based clustering (K-Means), and variance estimations.`,
      biRule: 'Present Median and Interquartile Range (IQR) for operational dashboards. Segment extreme records into an isolated outlier review cohort.',
      mlRule: 'Apply Winsorization (capping values at the 1st and 99th or 5th and 95th percentiles) or RobustScaler (scaling features by median and IQR). This bounds gradient spikes while preserving 100% of the training dataset.',
      outlierCount,
      outlierPct
    };
  }, [selectedCol, dist]);

  return (
    <div className="flex flex-col gap-5">
      {/* Topology Overview Header Card */}
      {topology && (
        <div
          className="p-4 rounded-2xl border flex flex-col gap-3.5 transition-all"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#2DD4BF]" />
              <span
                className="text-xs font-bold uppercase tracking-wider font-mono"
                style={{ color: 'var(--tt-text-primary)' }}
              >
                Dataset Distribution Topology ({topology.total_analyzed} Metrics Analyzed)
              </span>
            </div>
            <span className="text-[11px] font-mono" style={{ color: 'var(--tt-text-muted)' }}>
              Deterministic Empirical Classification
            </span>
          </div>

          {/* Topology Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <span className="text-[10px] opacity-70">Normal (Bell)</span>
              <span className="text-base font-bold text-[#34D399] tabular-nums mt-0.5">
                {topology.normal_count}
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <span className="text-[10px] opacity-70">Skewed / Long-Tail</span>
              <span className="text-base font-bold text-[#FB923C] tabular-nums mt-0.5">
                {topology.skewed_count}
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <span className="text-[10px] opacity-70">Uniform (Flat)</span>
              <span className="text-base font-bold text-[#38BDF8] tabular-nums mt-0.5">
                {topology.uniform_count}
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <span className="text-[10px] opacity-70">Multimodal</span>
              <span className="text-base font-bold text-[#A78BFA] tabular-nums mt-0.5">
                {topology.multimodal_count}
              </span>
            </div>

            <div
              className="p-2.5 rounded-xl border flex flex-col justify-between"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <span className="text-[10px] opacity-70">Categorical</span>
              <span className="text-base font-bold tabular-nums mt-0.5" style={{ color: 'var(--tt-text-primary)' }}>
                {topology.categorical_count}
              </span>
            </div>
          </div>

          {/* Key Findings List */}
          {topology.key_findings.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
              {topology.key_findings.map((finding, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] shrink-0 mt-1.5" />
                  <span style={{ color: 'var(--tt-text-secondary)' }}>{finding}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Column Inspector Grid */}
      <div
        className="rounded-2xl border p-4 flex flex-col gap-4"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          boxShadow: 'var(--tt-shadow-card)'
        }}
      >
        {/* Column Select Tabs */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#2DD4BF]">
              Select Numerical or Categorical Dimension to Inspect:
            </span>
            <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--tt-text-muted)' }}>
              {profilableCols.length} Columns Available ({columns.filter((c) => Boolean(c.distribution)).length} numeric, {columns.filter((c) => Boolean(!c.distribution && c.categorical_stats)).length} categorical)
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {profilableCols.map((col) => {
              const isSelected = col.column_name === selectedColName;
              const hasOutliers = col.has_outliers;
              const colDist = col.distribution;
              const isColCat = Boolean(!colDist && col.categorical_stats);

              return (
                <button
                  key={col.column_name}
                  type="button"
                  onClick={() => setSelectedColName(col.column_name)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono cursor-pointer transition-all hover:border-[#2DD4BF]"
                  style={{
                    backgroundColor: isSelected ? 'var(--tt-primary-subtle)' : 'var(--tt-bg-elevated)',
                    borderColor: isSelected ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                    color: isSelected ? 'var(--tt-primary)' : 'var(--tt-text-primary)',
                    fontWeight: isSelected ? 700 : 500
                  }}
                >
                  {isColCat ? (
                    <Tag className="w-3.5 h-3.5 shrink-0 text-[#38BDF8]" />
                  ) : (
                    <BarChart3 className="w-3.5 h-3.5 shrink-0 text-[#2DD4BF]" />
                  )}
                  <span>{col.column_name}</span>

                  {hasOutliers && (
                    <span
                      className="text-[9px] px-1 py-0.2 rounded font-bold uppercase"
                      style={{ backgroundColor: 'rgba(251, 146, 60, 0.2)', color: '#FB923C' }}
                      title="Anomalies or outliers detected"
                    >
                      Anomaly
                    </span>
                  )}

                  {colDist ? (
                    <span className="text-[10px] opacity-60">
                      ({colDist.distribution_type.replace('_', ' ')})
                    </span>
                  ) : isColCat ? (
                    <span className="text-[10px] opacity-60">
                      (categorical)
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Categorical Column Detail View */}
        {selectedCol && isCategorical && catStats && (
          <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
            {/* Header Banner */}
            <div
              className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
              style={{
                backgroundColor: selectedCol.has_outliers ? 'rgba(251, 146, 60, 0.12)' : 'rgba(45, 212, 191, 0.10)',
                borderColor: selectedCol.has_outliers ? 'rgba(251, 146, 60, 0.3)' : 'rgba(45, 212, 191, 0.25)'
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: selectedCol.has_outliers ? 'rgba(251, 146, 60, 0.4)' : 'rgba(45, 212, 191, 0.3)',
                    color: selectedCol.has_outliers ? '#FB923C' : '#2DD4BF'
                  }}
                >
                  {selectedCol.has_outliers ? 'CATEGORICAL ANOMALIES FLAGGED' : 'CLEAN CATEGORICAL DISTRIBUTION'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                      Column: '{selectedCol.column_name}'
                    </span>
                    <span className="text-[11px] font-mono text-[#2DD4BF]">
                      ({selectedCol.distinct_count} distinct categories)
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="px-2 py-0.5 rounded border text-[11px]" style={{ backgroundColor: 'var(--tt-bg-surface)', borderColor: 'var(--tt-border-subtle)' }}>
                  Cardinality: {catStats.cardinality_ratio ? `${Math.round(catStats.cardinality_ratio * 100)}%` : '—'}
                </span>
                {catStats.rare_count ? (
                  <span className="px-2 py-0.5 rounded border text-[11px] text-[#FB923C]" style={{ backgroundColor: 'rgba(251, 146, 60, 0.1)', borderColor: 'rgba(251, 146, 60, 0.3)' }}>
                    {catStats.rare_count} Rare Outlier(s)
                  </span>
                ) : null}
              </div>
            </div>

            {/* Top Category Distribution Bars */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-3"
              style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-[#2DD4BF]">Top Category Frequency Distribution</span>
                <span className="text-[11px] opacity-70">Showing top {catStats.top_values?.length || 0} occurrences</span>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                {(catStats.top_values || []).map((item, idx) => (
                  <div key={idx} className="flex flex-col gap-1 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="truncate max-w-[280px]" style={{ color: 'var(--tt-text-primary)' }}>
                        {item.value || '(Empty String)'}
                      </span>
                      <span className="tabular-nums opacity-80 text-[11px]">
                        {item.count.toLocaleString()} rows ({item.pct}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--tt-bg-surface)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, Math.max(2, item.pct))}%`,
                          backgroundColor: idx === 0 ? '#2DD4BF' : '#38BDF8'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Categorical Anomaly Findings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              {/* Fuzzy Typos Card */}
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2"
                style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
              >
                <div className="flex items-center gap-1.5 text-[#FB923C] font-semibold font-mono">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Fuzzy Typo Matches & Near-Duplicates</span>
                </div>
                {catStats.fuzzy_duplicates && catStats.fuzzy_duplicates.length > 0 ? (
                  <div className="flex flex-col gap-1.5 font-mono text-[11px]">
                    {catStats.fuzzy_duplicates.map((f, i) => (
                      <div key={i} className="p-2 rounded border flex items-center justify-between" style={{ backgroundColor: 'var(--tt-bg-surface)', borderColor: 'rgba(251, 146, 60, 0.25)' }}>
                        <div>
                          <span className="text-[#F87171] font-semibold">{f.original}</span>
                          <span className="opacity-60 mx-1.5">➔</span>
                          <span className="text-[#34D399] font-semibold">{f.suggested_canonical}</span>
                        </div>
                        <span className="text-[10px] opacity-70">
                          {Math.round(f.similarity * 100)}% match
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#34D399] text-[11px] py-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>No near-duplicate typos detected.</span>
                  </div>
                )}
              </div>

              {/* Rare Outliers & Formatting Card */}
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2"
                style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}
              >
                <div className="flex items-center gap-1.5 text-[#38BDF8] font-semibold font-mono">
                  <Tag className="w-3.5 h-3.5" />
                  <span>Rare Categories (&lt; 1% occurrence)</span>
                </div>
                {catStats.rare_categories && catStats.rare_categories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {catStats.rare_categories.slice(0, 8).map((r, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded border font-mono text-[10px]"
                        style={{
                          backgroundColor: 'rgba(251, 146, 60, 0.1)',
                          borderColor: 'rgba(251, 146, 60, 0.3)',
                          color: '#FB923C'
                        }}
                      >
                        {r.value} ({r.count})
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#34D399] text-[11px] py-1 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Zero rare singleton outliers detected.</span>
                  </div>
                )}

                {(catStats.whitespace_anomalies && catStats.whitespace_anomalies.length > 0) && (
                  <div className="pt-2 border-t text-[11px] font-mono text-[#FB923C]" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                    ⚠️ {catStats.whitespace_anomalies.length} value(s) contain unstripped leading/trailing spaces.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Selected Column Detail View */}
        {selectedCol && dist && (
          <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
            {/* Classification & Summary Hero Banner */}
            <div
              className="p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3"
              style={{
                backgroundColor: badgeStyle?.bg || 'var(--tt-bg-elevated)',
                borderColor: badgeStyle?.border || 'var(--tt-border-subtle)'
              }}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="px-2.5 py-1 rounded-md text-xs font-mono font-bold uppercase tracking-wider border"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: badgeStyle?.border,
                    color: badgeStyle?.text
                  }}
                >
                  {dist.distribution_type.replace('_', ' ').toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                      Column: '{selectedCol.column_name}'
                    </span>
                    <span
                      className="px-1.5 py-0.2 rounded text-[10px] font-mono font-semibold border"
                      style={{
                        backgroundColor: 'rgba(45, 212, 191, 0.12)',
                        borderColor: 'rgba(45, 212, 191, 0.3)',
                        color: '#2DD4BF'
                      }}
                    >
                      {selectedCol.statistical_type || 'Continuous (Ratio)'}
                    </span>
                  </div>
                  <div className="text-[11px] opacity-75 font-mono" style={{ color: 'var(--tt-text-secondary)' }}>
                    Confidence: {Math.round(dist.confidence * 100)}% · Modality: {dist.modality}
                  </div>
                </div>
              </div>

              {/* Statistical Coefficients */}
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-70">Skewness</span>
                  <span className="font-bold" style={{ color: Math.abs(dist.skewness ?? 0) > 0.5 ? '#FB923C' : '#34D399' }}>
                    {dist.skewness ?? '0.00'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-70">Kurtosis</span>
                  <span className="font-bold" style={{ color: 'var(--tt-text-primary)' }}>
                    {dist.kurtosis ?? '0.00'}
                  </span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[10px] opacity-70">Mean/Median</span>
                  <span className="font-bold text-[#38BDF8]">
                    {dist.mean_median_ratio ?? '1.00'}x
                  </span>
                </div>
              </div>
            </div>

            {/* Visualization Mode Selector Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b" style={{ borderColor: 'var(--tt-border-subtle)' }}>
              <div className="flex items-center gap-1.5 p-1 rounded-xl border" style={{ backgroundColor: 'var(--tt-bg-canvas)', borderColor: 'var(--tt-border-subtle)' }}>
                <button
                  type="button"
                  id="tab-histogram-view"
                  onClick={() => setVisualMode('histogram')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    visualMode === 'histogram'
                      ? 'bg-[#0D9488]/15 border border-[#0D9488]/40 text-[#2DD4BF] font-bold shadow-xs'
                      : 'border border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)]'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  <span>Equal-Width Histogram</span>
                </button>

                <button
                  type="button"
                  id="tab-boxplot-view"
                  onClick={() => setVisualMode('boxplot')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    visualMode === 'boxplot'
                      ? 'bg-[#0D9488]/15 border border-[#0D9488]/40 text-[#2DD4BF] font-bold shadow-xs'
                      : 'border border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)]'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#2DD4BF]" />
                  <span>Tukey Box Plot (1.5x IQR)</span>
                </button>

                <button
                  type="button"
                  id="tab-scatter-view"
                  onClick={() => setVisualMode('scatter')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer ${
                    visualMode === 'scatter'
                      ? 'bg-[#0D9488]/15 border border-[#0D9488]/40 text-[#38BDF8] font-bold shadow-xs'
                      : 'border border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)]'
                  }`}
                >
                  <ScatterChart className="w-3.5 h-3.5 text-[#38BDF8]" />
                  <span>Observation Scatter Plot</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-[11px] font-mono">
                {visualMode === 'histogram' && (
                  <span className="text-[var(--tt-text-muted)]">Equal-Width Frequency Bins & Modality</span>
                )}
                {visualMode === 'boxplot' && (
                  <span className={(boxPlot?.outliers?.length ?? 0) > 0 ? 'text-[#FB923C] font-semibold' : 'text-[#34D399]'}>
                    {(boxPlot?.outliers?.length ?? 0) > 0
                      ? `${boxPlot!.outliers!.length} Outlier Value(s) Outside 1.5x IQR`
                      : 'Zero Outliers (Within 1.5x IQR)'}
                  </span>
                )}
                {visualMode === 'scatter' && (
                  <span className="text-[#38BDF8] font-semibold">
                    {observationPoints.length} Observation Data Points Plotted
                  </span>
                )}
              </div>
            </div>

            {/* Visual 1: Interactive Histogram Chart */}
            {visualMode === 'histogram' && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-2 animate-in fade-in"
                style={{
                  backgroundColor: 'var(--tt-bg-sunken)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-semibold text-[#2DD4BF]">
                    Frequency Distribution (Equal-Width Histogram)
                  </span>
                  <span className="text-[11px] opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                    {hoveredBinIdx !== null && dist.bins[hoveredBinIdx]
                      ? `Bin: ${dist.bins[hoveredBinIdx].bin_label} | Count: ${dist.bins[hoveredBinIdx].count.toLocaleString()} (${dist.bins[hoveredBinIdx].pct}%)`
                      : 'Hover over bars to inspect bin ranges'}
                  </span>
                </div>

                {/* Histogram Bars Canvas */}
                <div className="h-44 flex items-end gap-1.5 pt-4 pb-1 px-1">
                  {dist.bins.map((b, idx) => {
                    const heightPercent = maxBinCount > 0 ? Math.max(6, (b.count / maxBinCount) * 100) : 6;
                    const isHovered = hoveredBinIdx === idx;

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setHoveredBinIdx(idx)}
                        onMouseLeave={() => setHoveredBinIdx(null)}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer relative"
                      >
                        {/* Bar */}
                        <div
                          className="w-full rounded-t transition-all duration-200"
                          style={{
                            height: `${heightPercent}%`,
                            backgroundColor: isHovered ? '#14B8A6' : 'var(--tt-primary)',
                            opacity: isHovered ? 1 : 0.85
                          }}
                        />
                        {/* Sub-label */}
                        <span className="text-[9px] font-mono truncate w-full text-center opacity-60 mt-1">
                          {b.bin_start}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono px-1 opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                  <span>Min: {boxPlot?.min ?? '—'}</span>
                  <span>Median: {boxPlot?.median ?? '—'}</span>
                  <span>Max: {boxPlot?.max ?? '—'}</span>
                </div>
              </div>
            )}

            {/* Visual 2: Enhanced Tukey Box Plot & Whiskers */}
            {visualMode === 'boxplot' && boxPlot && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-4 animate-in fade-in"
                style={{
                  backgroundColor: 'var(--tt-bg-sunken)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#2DD4BF]">
                      Tukey Box-and-Whisker Plot (1.5x IQR Fence)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded border bg-[var(--tt-bg-surface)] text-[var(--tt-text-muted)] border-[var(--tt-border-subtle)]">
                      IQR: {((boxPlot.q75 ?? 0) - (boxPlot.q25 ?? 0)).toFixed(2)}
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: (boxPlot.outliers?.length ?? 0) > 0 ? '#FB923C' : '#34D399' }}>
                    {(boxPlot.outliers?.length ?? 0) > 0
                      ? `${boxPlot.outliers!.length} extreme observation(s) outside whiskers`
                      : 'All points within 1.5x IQR whiskers'}
                  </span>
                </div>

                {/* Box Plot Graphic Canvas */}
                <div className="py-6 px-4 rounded-xl border flex flex-col justify-center relative overflow-hidden" style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}>
                  {/* Axis Baseline */}
                  <div className="relative h-14 flex items-center">
                    {/* Continuous Whisker Line from Lower Bound to Upper Bound */}
                    <div
                      className="absolute h-0.5 bg-[var(--tt-text-muted)] opacity-50"
                      style={{
                        left: `${getPercent(boxPlot.lower_bound ?? boxPlot.min)}%`,
                        width: `${Math.max(1, getPercent(boxPlot.upper_bound ?? boxPlot.max) - getPercent(boxPlot.lower_bound ?? boxPlot.min))}%`
                      }}
                    />

                    {/* Lower Whisker End-Cap */}
                    <div
                      className="absolute h-6 w-0.5 bg-[var(--tt-text-muted)] -translate-x-1/2"
                      style={{ left: `${getPercent(boxPlot.lower_bound ?? boxPlot.min)}%` }}
                      title={`Lower Fence (Q1 - 1.5x IQR): ${boxPlot.lower_bound}`}
                    />

                    {/* Upper Whisker End-Cap */}
                    <div
                      className="absolute h-6 w-0.5 bg-[var(--tt-text-muted)] -translate-x-1/2"
                      style={{ left: `${getPercent(boxPlot.upper_bound ?? boxPlot.max)}%` }}
                      title={`Upper Fence (Q3 + 1.5x IQR): ${boxPlot.upper_bound}`}
                    />

                    {/* IQR Box (Q25 to Q75) */}
                    <div
                      className="absolute h-10 rounded-md border-2 transition-all flex items-center justify-center cursor-default group"
                      style={{
                        left: `${getPercent(boxPlot.q25)}%`,
                        width: `${Math.max(2, getPercent(boxPlot.q75) - getPercent(boxPlot.q25))}%`,
                        backgroundColor: 'rgba(45, 212, 191, 0.18)',
                        borderColor: '#2DD4BF',
                        boxShadow: '0 0 12px rgba(45, 212, 191, 0.15)'
                      }}
                      title={`Interquartile Range (IQR): ${boxPlot.q25} to ${boxPlot.q75}`}
                    >
                      <span className="text-[9px] font-mono font-bold text-[#2DD4BF] opacity-0 group-hover:opacity-100 transition-opacity">
                        IQR (50%)
                      </span>
                    </div>

                    {/* Median Accent Divider */}
                    <div
                      className="absolute h-12 w-1.5 rounded-full bg-[#FB923C] shadow-md -translate-x-1/2 z-10"
                      style={{ left: `${getPercent(boxPlot.median)}%` }}
                      title={`Median: ${boxPlot.median}`}
                    />

                    {/* Plotted Outlier Dots Beyond Whiskers */}
                    {(boxPlot.outliers || []).map((outVal, idx) => {
                      const pos = getPercent(outVal);
                      const isHigh = outVal > (boxPlot.upper_bound ?? Infinity);
                      const delta = isHigh
                        ? outVal - (boxPlot.upper_bound ?? 0)
                        : (boxPlot.lower_bound ?? 0) - outVal;

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredOutlier({ val: outVal, delta: Math.round(delta * 100) / 100, severity: delta > ((boxPlot.q75 ?? 1) - (boxPlot.q25 ?? 0)) * 1.5 ? 'Extreme (>3x IQR)' : 'Moderate (1.5x-3x IQR)' })}
                          onMouseLeave={() => setHoveredOutlier(null)}
                          className="absolute w-3.5 h-3.5 rounded-full bg-[#EF4444] border-2 border-[#FCA5A5] -translate-x-1/2 cursor-pointer transition-transform hover:scale-150 z-20 animate-pulse"
                          style={{
                            left: `${pos}%`,
                            boxShadow: '0 0 8px rgba(239, 68, 68, 0.8)'
                          }}
                        />
                      );
                    })}
                  </div>

                  {/* Active Outlier Hover Tooltip */}
                  {hoveredOutlier && (
                    <div className="mt-2 p-2 rounded-lg border text-xs font-mono flex items-center justify-between" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#F87171' }}>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        <span className="font-bold">Outlier Value: {hoveredOutlier.val.toLocaleString()}</span>
                        <span>({hoveredOutlier.severity})</span>
                      </div>
                      <span>Excursion: +{hoveredOutlier.delta.toLocaleString()} past boundary</span>
                    </div>
                  )}
                </div>

                {/* Five-Number Summary Table */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2 text-[11px] font-mono tabular-nums pt-1 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Min</span>
                    <span className="font-bold text-[var(--tt-text-primary)]">{boxPlot.min}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Q1 (25%)</span>
                    <span className="font-bold text-[var(--tt-text-primary)]">{boxPlot.q25}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#FB923C]/10 border border-[#FB923C]/30 text-[#FB923C]">
                    <span className="text-[10px] opacity-80 block">Median</span>
                    <span className="font-bold">{boxPlot.median}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Q3 (75%)</span>
                    <span className="font-bold text-[var(--tt-text-primary)]">{boxPlot.q75}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Max</span>
                    <span className="font-bold text-[var(--tt-text-primary)]">{boxPlot.max}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[#0D9488]/10 border border-[#0D9488]/30 text-[#2DD4BF]">
                    <span className="text-[10px] opacity-80 block">IQR</span>
                    <span className="font-bold">{((boxPlot.q75 ?? 0) - (boxPlot.q25 ?? 0)).toFixed(2)}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Lower Fence</span>
                    <span className="font-bold text-[var(--tt-text-muted)]">{boxPlot.lower_bound ?? '—'}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] opacity-60 block">Upper Fence</span>
                    <span className="font-bold text-[var(--tt-text-muted)]">{boxPlot.upper_bound ?? '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Visual 3: Observation Scatter Plot with Boundary Lines */}
            {visualMode === 'scatter' && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 animate-in fade-in"
                style={{
                  backgroundColor: 'var(--tt-bg-sunken)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#38BDF8]">
                      Observation Scatter Plot (Unusual Observations vs. Fences)
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded border bg-[var(--tt-bg-surface)] text-[var(--tt-text-muted)] border-[var(--tt-border-subtle)]">
                      N = {observationPoints.length}
                    </span>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#2DD4BF]" />
                      <span className="text-[var(--tt-text-muted)]">In-Bounds</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444] animate-pulse" />
                      <span className="text-[#F87171] font-semibold">Anomalous Outlier</span>
                    </span>
                    <span className="flex items-center gap-1 text-[var(--tt-text-muted)]">
                      <span className="w-3 border-t border-dashed border-[#FB923C]" />
                      <span>1.5x IQR Fence</span>
                    </span>
                  </div>
                </div>

                {/* SVG Scatter Chart Canvas */}
                <div className="p-3 rounded-xl border relative" style={{ backgroundColor: 'var(--tt-bg-elevated)', borderColor: 'var(--tt-border-subtle)' }}>
                  {(() => {
                    const plotMin = Number(boxPlot?.min ?? Math.min(...observationPoints, 0));
                    const plotMax = Number(boxPlot?.max ?? Math.max(...observationPoints, 100));
                    const yRange = plotMax - plotMin || 1;
                    const svgHeight = 220;
                    const svgWidth = 800;
                    const padY = 24;
                    const padX = 36;
                    const usableHeight = svgHeight - padY * 2;
                    const usableWidth = svgWidth - padX * 2;

                    const getY = (val: number) => {
                      const normalized = (val - plotMin) / yRange;
                      return svgHeight - padY - normalized * usableHeight;
                    };

                    const upperY = boxPlot?.upper_bound !== null && boxPlot?.upper_bound !== undefined ? getY(boxPlot.upper_bound) : null;
                    const lowerY = boxPlot?.lower_bound !== null && boxPlot?.lower_bound !== undefined ? getY(boxPlot.lower_bound) : null;
                    const medianY = boxPlot?.median !== null && boxPlot?.median !== undefined ? getY(boxPlot.median) : null;

                    return (
                      <div className="relative w-full">
                        <svg
                          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                          className="w-full h-56 select-none overflow-visible"
                        >
                          {/* Upper Fence Dashed Line */}
                          {upperY !== null && upperY >= padY && upperY <= svgHeight - padY && (
                            <g>
                              <line
                                x1={padX}
                                y1={upperY}
                                x2={svgWidth - padX}
                                y2={upperY}
                                stroke="#FB923C"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                              />
                              <text
                                x={svgWidth - padX - 4}
                                y={upperY - 5}
                                textAnchor="end"
                                fill="#FB923C"
                                fontSize="10"
                                fontFamily="monospace"
                              >
                                Upper Fence ({boxPlot?.upper_bound})
                              </text>
                            </g>
                          )}

                          {/* Median Reference Line */}
                          {medianY !== null && (
                            <g>
                              <line
                                x1={padX}
                                y1={medianY}
                                x2={svgWidth - padX}
                                y2={medianY}
                                stroke="#2DD4BF"
                                strokeWidth="1"
                                strokeDasharray="2 4"
                                opacity="0.6"
                              />
                              <text
                                x={padX + 4}
                                y={medianY - 4}
                                fill="#2DD4BF"
                                fontSize="9"
                                fontFamily="monospace"
                                opacity="0.8"
                              >
                                Median: {boxPlot?.median}
                              </text>
                            </g>
                          )}

                          {/* Lower Fence Dashed Line */}
                          {lowerY !== null && lowerY >= padY && lowerY <= svgHeight - padY && (
                            <g>
                              <line
                                x1={padX}
                                y1={lowerY}
                                x2={svgWidth - padX}
                                y2={lowerY}
                                stroke="#FB923C"
                                strokeWidth="1.5"
                                strokeDasharray="4 4"
                              />
                              <text
                                x={svgWidth - padX - 4}
                                y={lowerY + 12}
                                textAnchor="end"
                                fill="#FB923C"
                                fontSize="10"
                                fontFamily="monospace"
                              >
                                Lower Fence ({boxPlot?.lower_bound})
                              </text>
                            </g>
                          )}

                          {/* Observation Points */}
                          {observationPoints.map((val, idx) => {
                            const posX = padX + (idx / Math.max(1, observationPoints.length - 1)) * usableWidth;
                            const posY = getY(val);
                            const isOutlier = Boolean(
                              (boxPlot?.upper_bound !== null && boxPlot?.upper_bound !== undefined && val > boxPlot.upper_bound) ||
                              (boxPlot?.lower_bound !== null && boxPlot?.lower_bound !== undefined && val < boxPlot.lower_bound)
                            );

                            return (
                              <g
                                key={idx}
                                onMouseEnter={() => setHoveredScatterPoint({ index: idx + 1, val, isOutlier, delta: Math.round((val - (boxPlot?.median ?? 0)) * 100) / 100 })}
                                onMouseLeave={() => setHoveredScatterPoint(null)}
                                className="cursor-pointer group"
                              >
                                {isOutlier && (
                                  <circle
                                    cx={posX}
                                    cy={posY}
                                    r="8"
                                    fill="rgba(239, 68, 68, 0.25)"
                                    className="animate-ping"
                                  />
                                )}
                                <circle
                                  cx={posX}
                                  cy={posY}
                                  r={isOutlier ? 5 : 3.5}
                                  fill={isOutlier ? '#EF4444' : '#2DD4BF'}
                                  stroke={isOutlier ? '#FCA5A5' : '#0D9488'}
                                  strokeWidth={isOutlier ? 2 : 1}
                                  className="transition-transform group-hover:scale-150"
                                />
                              </g>
                            );
                          })}
                        </svg>

                        {/* Hover Tooltip for Scatter Point */}
                        {hoveredScatterPoint && (
                          <div
                            className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-lg border text-xs font-mono shadow-lg flex items-center gap-3 z-30"
                            style={{
                              backgroundColor: 'var(--tt-bg-surface)',
                              borderColor: hoveredScatterPoint.isOutlier ? 'rgba(239, 68, 68, 0.4)' : 'var(--tt-border-subtle)',
                              color: hoveredScatterPoint.isOutlier ? '#F87171' : 'var(--tt-text-primary)'
                            }}
                          >
                            <span className="font-bold">Observation #{hoveredScatterPoint.index}</span>
                            <span>Value: {hoveredScatterPoint.val.toLocaleString()}</span>
                            <span className={hoveredScatterPoint.isOutlier ? 'font-bold' : 'text-[#2DD4BF]'}>
                              {hoveredScatterPoint.isOutlier ? '⚠️ Outlier (Outside 1.5x IQR)' : '✓ In-Bounds'}
                            </span>
                            <span className="text-[10px] opacity-70">
                              (Δ from Median: {hoveredScatterPoint.delta > 0 ? `+${hoveredScatterPoint.delta}` : hoveredScatterPoint.delta})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--tt-text-muted)] px-1">
                  <span>Horizontal Axis: Sequential Observation Sequence (1 to {observationPoints.length})</span>
                  <span>Vertical Axis: Continuous Metric Scale [{boxPlot?.min ?? '—'} to {boxPlot?.max ?? '—'}]</span>
                </div>
              </div>
            )}

            {/* Prescriptive Outlier Disposition & Treatment Strategy Card */}
            {disposition && (
              <div
                className="p-4 rounded-xl border flex flex-col gap-3 transition-all"
                style={{
                  backgroundColor: disposition.badgeBg,
                  borderColor: disposition.badgeBorder
                }}
              >
                {/* Header Verdict */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <disposition.Icon className="w-4 h-4 shrink-0" style={{ color: disposition.badgeText }} />
                    <span className="text-xs font-mono font-bold tracking-wider uppercase" style={{ color: disposition.badgeText }}>
                      {disposition.title}
                    </span>
                  </div>

                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-mono font-bold border uppercase"
                    style={{
                      backgroundColor: 'var(--tt-bg-surface)',
                      borderColor: disposition.badgeBorder,
                      color: disposition.badgeText
                    }}
                  >
                    Action: {disposition.decision}
                  </span>
                </div>

                {/* Statistical and Domain Rationale (Why's That) */}
                <div
                  className="p-3 rounded-lg border text-xs font-mono leading-relaxed"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-text-primary)'
                  }}
                >
                  <span className="font-bold block mb-1" style={{ color: disposition.badgeText }}>
                    Why This Disposition? (Statistical & Domain Diagnosis):
                  </span>
                  {disposition.reason}
                </div>

                {/* Practical Guidance Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  {/* Reporting / BI Dashboard Guidance */}
                  <div
                    className="p-3 rounded-lg border flex flex-col gap-1.5"
                    style={{ backgroundColor: 'var(--tt-bg-surface)', borderColor: 'var(--tt-border-subtle)' }}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#2DD4BF]">
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>Executive Reporting & BI Dashboards</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--tt-text-secondary)]">
                      {disposition.biRule}
                    </p>
                  </div>

                  {/* Machine Learning / Data Science Guidance */}
                  <div
                    className="p-3 rounded-lg border flex flex-col gap-1.5"
                    style={{ backgroundColor: 'var(--tt-bg-surface)', borderColor: 'var(--tt-border-subtle)' }}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-[#38BDF8]">
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>Machine Learning & Parametric Modeling</span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--tt-text-secondary)]">
                      {disposition.mlRule}
                    </p>
                  </div>
                </div>

                {/* Outlier Values Pill List if detected */}
                {disposition.outlierCount > 0 && boxPlot?.outliers && boxPlot.outliers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t text-[11px] font-mono" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                    <span className="text-[#F87171] font-bold">Flagged Sample Values:</span>
                    {boxPlot.outliers.slice(0, 10).map((outlierVal, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded border text-[10px] font-mono font-semibold"
                        style={{
                          backgroundColor: 'rgba(248, 113, 113, 0.1)',
                          borderColor: 'rgba(248, 113, 113, 0.3)',
                          color: '#F87171'
                        }}
                      >
                        {outlierVal.toLocaleString()}
                      </span>
                    ))}
                    {boxPlot.outliers.length > 10 && (
                      <span className="text-[10px] text-[var(--tt-text-muted)]">
                        +{boxPlot.outliers.length - 10} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Narrative & Business Impact Recommendation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-1.5"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex items-center gap-1.5 text-[#2DD4BF] font-semibold font-mono">
                  <Info className="w-3.5 h-3.5" />
                  <span>Statistical Shape Summary</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--tt-text-primary)' }}>
                  {dist.summary}
                </p>
              </div>

              <div
                className="p-3.5 rounded-xl border flex flex-col gap-1.5"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex items-center gap-1.5 text-[#FB923C] font-semibold font-mono">
                  <Lightbulb className="w-3.5 h-3.5" />
                  <span>Analytical & Business Recommendation</span>
                </div>
                <p className="leading-relaxed" style={{ color: 'var(--tt-text-primary)' }}>
                  {dist.business_recommendation}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
