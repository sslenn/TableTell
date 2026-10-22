import React, { useState } from 'react';
import {
  BarChart3,
  Activity,
  Lightbulb,
  Info
} from 'lucide-react';
import type { ColumnStat, DatasetDistributionTopology } from '../../types/dataset';

interface DistributionProfilerProps {
  columns: ColumnStat[];
  topology?: DatasetDistributionTopology | null;
  datasetId: string;
}

export const DistributionProfiler: React.FC<DistributionProfilerProps> = ({
  columns,
  topology,
  datasetId
}) => {
  // Filter columns that have distribution profiles (typically numeric columns)
  const numericCols = columns.filter((c) => Boolean(c.distribution));

  const [selectedColName, setSelectedColName] = useState<string>(
    numericCols[0]?.column_name || ''
  );
  const [hoveredBinIdx, setHoveredBinIdx] = useState<number | null>(null);

  const selectedCol = numericCols.find((c) => c.column_name === selectedColName) || numericCols[0];
  const dist = selectedCol?.distribution;

  if (numericCols.length === 0) {
    return (
      <div
        className="p-6 rounded-2xl border text-center text-xs font-mono"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          color: 'var(--tt-text-muted)'
        }}
      >
        No continuous numeric columns available for distribution profiling in '{datasetId}'.
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
              Select Numeric Metric to Inspect Distribution:
            </span>
            <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--tt-text-muted)' }}>
              {numericCols.length} Columns with Continuous Data
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {numericCols.map((col) => {
              const isSelected = col.column_name === selectedColName;
              const hasOutliers = col.has_outliers;
              const colDist = col.distribution;

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
                  <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                  <span>{col.column_name}</span>

                  {hasOutliers && (
                    <span
                      className="text-[9px] px-1 py-0.2 rounded font-bold uppercase"
                      style={{ backgroundColor: 'rgba(248, 113, 113, 0.2)', color: '#F87171' }}
                      title="Outliers detected"
                    >
                      Outliers
                    </span>
                  )}

                  {colDist && (
                    <span className="text-[10px] opacity-60">
                      ({colDist.distribution_type.replace('_', ' ')})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

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
                  <div className="text-xs font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                    Column: '{selectedCol.column_name}'
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

            {/* Interactive Histogram Chart */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-2"
              style={{
                backgroundColor: 'var(--tt-bg-sunken)',
                borderColor: 'var(--tt-border-subtle)'
              }}
            >
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-semibold" style={{ color: 'var(--tt-text-secondary)' }}>
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

            {/* Box Plot & Outlier Summary */}
            {boxPlot && (
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2.5 text-xs font-mono"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: 'var(--tt-text-secondary)' }}>
                    Five-Number Quartile & Outlier Analysis
                  </span>
                  <span className="text-[11px]" style={{ color: (boxPlot.outliers?.length ?? 0) > 0 ? '#F87171' : '#34D399' }}>
                    {(boxPlot.outliers?.length ?? 0) > 0
                      ? `${boxPlot.outliers!.length} Outlier values detected`
                      : 'Zero extreme outliers'}
                  </span>
                </div>

                {/* Box Plot Visualization Graphic */}
                <div className="relative h-8 flex items-center my-1 px-4">
                  {/* Whisker Line (Min to Max) */}
                  <div
                    className="absolute h-0.5 bg-current opacity-30 left-4 right-4"
                    style={{ color: 'var(--tt-text-primary)' }}
                  />

                  {/* IQR Box (Q25 to Q75) */}
                  <div
                    className="absolute h-5 rounded border transition-all"
                    style={{
                      left: `${getPercent(boxPlot.q25)}%`,
                      width: `${Math.max(2, getPercent(boxPlot.q75) - getPercent(boxPlot.q25))}%`,
                      backgroundColor: 'var(--tt-primary-subtle)',
                      borderColor: 'var(--tt-primary)'
                    }}
                  />

                  {/* Median Line */}
                  <div
                    className="absolute h-6 w-1 rounded-full bg-[#FB923C] shadow-xs"
                    style={{ left: `${getPercent(boxPlot.median)}%` }}
                    title={`Median: ${boxPlot.median}`}
                  />
                </div>

                {/* Metrics Table */}
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px] tabular-nums pt-1 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                  <div>
                    <span className="opacity-60 block">Min</span>
                    <span className="font-bold">{boxPlot.min}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">Q25 (25%)</span>
                    <span className="font-bold">{boxPlot.q25}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block text-[#FB923C]">Median</span>
                    <span className="font-bold text-[#FB923C]">{boxPlot.median}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">Q75 (75%)</span>
                    <span className="font-bold">{boxPlot.q75}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">Max</span>
                    <span className="font-bold">{boxPlot.max}</span>
                  </div>
                  <div>
                    <span className="opacity-60 block">Mean</span>
                    <span className="font-bold text-[#38BDF8]">{selectedCol.mean_val ?? '—'}</span>
                  </div>
                </div>

                {/* Outlier values pill list if present */}
                {(boxPlot.outliers?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                    <span className="text-[#F87171] font-semibold">Flagged Outliers:</span>
                    {boxPlot.outliers!.map((outlierVal, i) => (
                      <span
                        key={i}
                        className="px-1.5 py-0.2 rounded border font-mono text-[10px]"
                        style={{
                          backgroundColor: 'rgba(248, 113, 113, 0.1)',
                          borderColor: 'rgba(248, 113, 113, 0.3)',
                          color: '#F87171'
                        }}
                      >
                        {outlierVal}
                      </span>
                    ))}
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
