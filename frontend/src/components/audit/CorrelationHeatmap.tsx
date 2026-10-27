import React, { useEffect, useState } from 'react';
import { fetchDatasetCorrelations } from '../../lib/api';
import type { CorrelationReport } from '../../types/dataset';
import {
  Activity,
  AlertTriangle,
  Sparkles,
  Zap
} from 'lucide-react';

interface CorrelationHeatmapProps {
  datasetId: string;
}

export const CorrelationHeatmap: React.FC<CorrelationHeatmapProps> = ({ datasetId }) => {
  const [data, setData] = useState<CorrelationReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    col1: string;
    col2: string;
    val: number;
    i: number;
    j: number;
  } | null>(null);

  useEffect(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    fetchDatasetCorrelations(datasetId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to compute correlation matrix');
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading) {
    return (
      <div
        className="p-8 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-center flex flex-col items-center justify-center gap-3 animate-pulse"
      >
        <Zap className="w-6 h-6 text-[#0D9488] animate-spin" />
        <span className="text-xs font-mono text-[var(--tt-text-muted)]">
          Calculating vectorized Pearson correlation matrix in DuckDB...
        </span>
      </div>
    );
  }

  if (error || !data || data.columns.length < 2) {
    return (
      <div className="p-6 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-center text-xs font-mono text-[var(--tt-text-muted)]">
        {error || 'Need at least 2 numeric dimensions to compute cross-feature correlations.'}
      </div>
    );
  }

  const { columns, matrix, significant_pairs, collinearity_warnings, analyst_digest } = data;

  // Color generator based on Pearson correlation value (-1.0 to +1.0)
  const getCellBg = (r: number, isDiag: boolean) => {
    if (isDiag) return 'rgba(13, 148, 136, 0.25)'; // Diagonal is 1.0 identity
    if (r >= 0.7) return 'rgba(16, 185, 129, 0.45)'; // Strong positive green/teal
    if (r >= 0.4) return 'rgba(16, 185, 129, 0.25)';
    if (r > 0.1) return 'rgba(16, 185, 129, 0.10)';
    if (r <= -0.7) return 'rgba(239, 68, 68, 0.45)'; // Strong negative red/crimson
    if (r <= -0.4) return 'rgba(239, 68, 68, 0.25)';
    if (r < -0.1) return 'rgba(239, 68, 68, 0.10)';
    return 'rgba(255, 255, 255, 0.03)';
  };

  const getCellTextColor = (r: number) => {
    if (Math.abs(r) >= 0.6) return '#FFFFFF';
    return 'var(--tt-text-primary)';
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Analyst Digest */}
      <div className="p-5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0D9488]" />
            <h3 className="text-sm font-bold text-[var(--tt-text-primary)]">
              Exploratory Data Analysis: Pearson Correlation Matrix
            </h3>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-[var(--tt-border-subtle)] text-[var(--tt-text-muted)]">
            Vectorized DuckDB CORR() • Zero-Copy Arrow
          </span>
        </div>

        {analyst_digest && analyst_digest.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
            {analyst_digest.map((digest, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-xs text-[var(--tt-text-secondary)] leading-relaxed"
                dangerouslySetInnerHTML={{
                  __html: digest.replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--tt-text-primary)]">$1</strong>')
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Multicollinearity Warning Banner if exists */}
      {collinearity_warnings && collinearity_warnings.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1 text-xs">
            <span className="font-bold text-amber-500">
              Collinearity Risk Detected ({collinearity_warnings.length} pairs with |r| ≥ 0.85)
            </span>
            <p className="text-[var(--tt-text-secondary)]">
              Redundant features introduce variance inflation in multivariable regression models. Consider feature selection or PCA.
            </p>
          </div>
        </div>
      )}

      {/* Interactive Matrix Heatmap */}
      <div className="p-5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)] overflow-x-auto">
        <div className="min-w-[500px]">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-2 text-[11px] font-mono text-[var(--tt-text-muted)] text-left border-b border-[var(--tt-border-subtle)]">
                  Feature / Dimension
                </th>
                {columns.map((c, idx) => (
                  <th
                    key={idx}
                    className="p-2 text-[11px] font-mono text-[var(--tt-text-muted)] text-center border-b border-[var(--tt-border-subtle)] truncate max-w-[100px]"
                    title={c}
                  >
                    {c.length > 10 ? `${c.slice(0, 9)}…` : c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((rowCol, i) => (
                <tr key={i} className="hover:bg-white/[0.02]">
                  <td
                    className="p-2 text-xs font-mono font-medium text-[var(--tt-text-primary)] border-r border-[var(--tt-border-subtle)] truncate max-w-[130px]"
                    title={rowCol}
                  >
                    {rowCol}
                  </td>
                  {columns.map((colCol, j) => {
                    const r = matrix[i]?.[j] ?? 0;
                    const isDiag = i === j;
                    const isHovered = hoveredCell?.i === i && hoveredCell?.j === j;

                    return (
                      <td
                        key={j}
                        onMouseEnter={() =>
                          setHoveredCell({ col1: rowCol, col2: colCol, val: r, i, j })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                        className={`p-2.5 text-center text-xs font-mono font-semibold transition-all cursor-pointer relative ${
                          isHovered ? 'ring-2 ring-[#0D9488] z-10 scale-105' : ''
                        }`}
                        style={{
                          backgroundColor: getCellBg(r, isDiag),
                          color: getCellTextColor(r)
                        }}
                        title={`${rowCol} vs ${colCol}: r = ${r}`}
                      >
                        {isDiag ? '1.0' : r.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Dynamic Tooltip / Legend */}
        <div className="mt-4 pt-3 border-t border-[var(--tt-border-subtle)] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-[var(--tt-text-muted)]">Scale:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-red-500/50 inline-block" />
              <span className="text-[10px] font-mono text-[var(--tt-text-muted)]">-1.0 (Inverse)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white/10 inline-block" />
              <span className="text-[10px] font-mono text-[var(--tt-text-muted)]">0.0 (None)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-500/50 inline-block" />
              <span className="text-[10px] font-mono text-[var(--tt-text-muted)]">+1.0 (Direct)</span>
            </div>
          </div>

          {hoveredCell && (
            <div className="text-xs font-mono text-[#0D9488]">
              <strong>{hoveredCell.col1}</strong> ↔ <strong>{hoveredCell.col2}</strong> :{' '}
              <span className="font-bold">r = {hoveredCell.val.toFixed(3)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Significant Correlation Cards */}
      {significant_pairs && significant_pairs.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#0D9488]" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--tt-text-primary)]">
              Key Pairwise Relationships (|r| ≥ 0.40)
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {significant_pairs.map((p, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex flex-col gap-2 shadow-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-[var(--tt-text-primary)] truncate">
                    {p.col1} ↔ {p.col2}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      p.correlation >= 0
                        ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                        : 'border-red-500/30 bg-red-500/15 text-red-500'
                    }`}
                  >
                    r = {p.correlation.toFixed(2)}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--tt-text-secondary)] leading-relaxed">
                  {p.insight}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
