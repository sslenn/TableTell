import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchAuditReport, cleanDataset, fetchDatasets } from '../../lib/api';
import type { DatasetAuditReport } from '../../types/dataset';
import { DistributionProfiler } from './DistributionProfiler';
import { toast } from '../../store/useToastStore';
import {
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  BarChart2,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Activity
} from 'lucide-react';

export const AuditView: React.FC = () => {
  const { datasetId, setDatasetId, setDatasets } = useAppStore();
  const [report, setReport] = useState<DatasetAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'distributions' | 'columns'>('overview');

  const loadAudit = React.useCallback(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    fetchAuditReport(datasetId, true)
      .then((data) => {
        setReport(data);
        toast.info('Dataset Re-Profiled', `Calculated quality metrics for ${datasetId}`);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Audit failed';
        setError(msg);
        toast.error('Profiling Failed', msg);
      })
      .finally(() => setLoading(false));
  }, [datasetId]);

  useEffect(() => {
    let active = true;
    if (!datasetId) return;

    fetchAuditReport(datasetId)
      .then((res) => {
        if (active) setReport(res);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Audit failed');
      });

    return () => {
      active = false;
    };
  }, [datasetId]);

  const handleCleanDataset = async () => {
    if (!datasetId) return;
    setCleaning(true);
    setCleanMessage(null);
    setError(null);

    try {
      const res = await cleanDataset(datasetId);
      const rowDiff = res.original_rows - res.cleaned_rows;
      const cleanId = `${datasetId}_clean`;
      setCleanMessage(
        `Cleaning complete: Processed ${res.original_rows.toLocaleString()} rows (removed ${res.removed_duplicates} duplicates, dropped ${rowDiff > 0 ? rowDiff : 0} rows). New version ready.`
      );
      toast.success('Cleaned Successfully', `Created '${cleanId}' with 0 duplicates`);

      // Update catalog and switch active dataset to cleaned version
      const catalog = await fetchDatasets();
      setDatasets(catalog);
      setDatasetId(cleanId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cleaning pipeline failed';
      setError(msg);
      toast.error('Clean Failed', msg);
    } finally {
      setCleaning(false);
    }
  };

  const detectedIssues = report ? (report.issues || report.cleaning_recommendations || []) : [];
  const structuredIssues = report?.structured_issues || [];
  const dimensions = report?.dimensions || [];
  const numericCount = report?.columns.filter((c) => Boolean(c.distribution)).length ?? 0;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Data Quality & Distribution Profiling
          </h2>
          <p className="text-xs" style={{ color: 'var(--tt-text-muted)' }}>
            Empirical distribution topology, statistical moments, multi-dimensional health scoring, and rules audit for '{datasetId}'.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {detectedIssues.length > 0 && (
            <button
              onClick={handleCleanDataset}
              disabled={cleaning || loading}
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50 shadow-sm"
              style={{
                backgroundColor: 'var(--tt-primary)',
                color: '#0A1214'
              }}
            >
              <Sparkles className={`w-3.5 h-3.5 ${cleaning ? 'animate-spin' : ''}`} />
              <span>{cleaning ? 'Applying Transformations...' : 'Auto-Clean Dataset'}</span>
            </button>
          )}

          <button
            onClick={loadAudit}
            disabled={loading || cleaning}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:border-[#2DD4BF] disabled:opacity-50"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-subtle)',
              color: 'var(--tt-text-secondary)'
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#2DD4BF] ${loading ? 'animate-spin' : ''}`} />
            <span>Re-Profile Dataset</span>
          </button>
        </div>
      </div>

      {cleanMessage && (
        <div
          className="p-3.5 rounded-xl border flex items-center gap-2 text-xs font-mono"
          style={{
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            borderColor: 'var(--tt-success)',
            color: 'var(--tt-success)'
          }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 text-[#34D399]" />
          <span>{cleanMessage}</span>
        </div>
      )}

      {error && (
        <div
          className="p-3 rounded-xl border text-xs font-mono"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'var(--tt-error)',
            color: 'var(--tt-error)'
          }}
        >
          {error}
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-5">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3.5">
            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                boxShadow: 'var(--tt-shadow-card)'
              }}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--tt-text-muted)' }}>
                <span>Overall Health Score</span>
                <ShieldCheck className="w-4 h-4 text-[#34D399]" />
              </div>
              <div
                className="text-2xl font-bold font-mono tabular-nums mt-1"
                style={{ color: report.data_health_score >= 80 ? '#34D399' : '#FB923C' }}
              >
                {report.data_health_score}/100
              </div>
            </div>

            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                boxShadow: 'var(--tt-shadow-card)'
              }}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--tt-text-muted)' }}>
                <span>Total Columns</span>
                <Layers className="w-4 h-4 text-[#38BDF8]" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
                {report.total_cols}
              </div>
            </div>

            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                boxShadow: 'var(--tt-shadow-card)'
              }}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--tt-text-muted)' }}>
                <span>Total Rows</span>
                <BarChart2 className="w-4 h-4 text-[#2DD4BF]" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
                {report.total_rows.toLocaleString()}
              </div>
            </div>

            <div
              className="p-4 rounded-xl border flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                boxShadow: 'var(--tt-shadow-card)'
              }}
            >
              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--tt-text-muted)' }}>
                <span>Duplicate Rows</span>
                <AlertCircle className="w-4 h-4 text-[#FB923C]" />
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
                {report.duplicate_rows}
              </div>
            </div>
          </div>

          {/* Sub-Tab Navigation Switcher */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl border"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-subtle)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: activeSubTab === 'overview' ? 'var(--tt-primary-subtle)' : 'transparent',
                color: activeSubTab === 'overview' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                fontWeight: activeSubTab === 'overview' ? 700 : 500
              }}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quality Dimensions & Rules</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('distributions')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: activeSubTab === 'distributions' ? 'var(--tt-primary-subtle)' : 'transparent',
                color: activeSubTab === 'distributions' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                fontWeight: activeSubTab === 'distributions' ? 700 : 500
              }}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Distribution Topology & Profiler</span>
              <span
                className="text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums opacity-80"
                style={{ backgroundColor: 'var(--tt-bg-elevated)' }}
              >
                {numericCount} metrics
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('columns')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer"
              style={{
                backgroundColor: activeSubTab === 'columns' ? 'var(--tt-primary-subtle)' : 'transparent',
                color: activeSubTab === 'columns' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                fontWeight: activeSubTab === 'columns' ? 700 : 500
              }}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Schema & Null Rates</span>
            </button>
          </div>

          {/* Tab 1: Quality Dimensions & Findings */}
          {activeSubTab === 'overview' && (
            <div className="flex flex-col gap-5">
              {/* Distribution Teaser Pill */}
              {report.topology && (
                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition-all hover:border-[#2DD4BF]"
                  onClick={() => setActiveSubTab('distributions')}
                  style={{
                    backgroundColor: 'var(--tt-bg-elevated)',
                    borderColor: 'var(--tt-border-subtle)'
                  }}
                >
                  <div className="flex items-center gap-2.5 text-xs font-mono">
                    <Activity className="w-4 h-4 text-[#2DD4BF]" />
                    <span style={{ color: 'var(--tt-text-primary)' }}>
                      <strong>Distribution Topology Ready:</strong> {report.topology.total_analyzed} numeric metrics classified ({report.topology.normal_count} normal, {report.topology.skewed_count} skewed, {report.topology.uniform_count} uniform).
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-[#2DD4BF] font-semibold">
                    <span>Inspect Distributions</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              )}

              {/* 5 Quality Dimensions Breakdown */}
              {dimensions.length > 0 && (
                <div
                  className="p-4 rounded-2xl border flex flex-col gap-3"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    boxShadow: 'var(--tt-shadow-card)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#2DD4BF]">
                      Quality Dimensions Breakdown (Configurable Weights)
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                      Deterministic Scoring
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
                    {dimensions.map((dim) => (
                      <div
                        key={dim.dimension}
                        className="p-2.5 rounded-xl border flex flex-col justify-between"
                        style={{
                          backgroundColor: 'var(--tt-bg-elevated)',
                          borderColor: 'var(--tt-border-subtle)'
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold" style={{ color: 'var(--tt-text-primary)' }}>
                            {dim.dimension}
                          </span>
                          <span className="text-[9px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                            {Math.round(dim.weight * 100)}% wt
                          </span>
                        </div>

                        <div
                          className="text-lg font-bold font-mono tabular-nums"
                          style={{ color: dim.score >= 80 ? '#34D399' : dim.score >= 60 ? '#FB923C' : '#F87171' }}
                        >
                          {dim.score}%
                        </div>

                        <p className="text-[10px] mt-1 leading-tight line-clamp-2" style={{ color: 'var(--tt-text-muted)' }}>
                          {dim.explanation}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Health Audit Findings / Recommendations Section */}
              {detectedIssues.length > 0 ? (
                <div
                  className="p-4 rounded-2xl border flex flex-col gap-3"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'rgba(251, 146, 60, 0.3)',
                    boxShadow: 'var(--tt-shadow-card)'
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-[#FB923C]" />
                      <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#FB923C]">
                        Quality Audit Findings ({detectedIssues.length} Anomali{detectedIssues.length > 1 ? 'es' : 'y'} Flagged)
                      </span>
                    </div>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                      Actionable Proposals
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    {structuredIssues.length > 0 ? (
                      structuredIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl border flex flex-col gap-1.5 text-xs font-mono"
                          style={{
                            backgroundColor: issue.severity === 'critical' ? 'rgba(248, 113, 113, 0.08)' : 'rgba(251, 146, 60, 0.08)',
                            borderColor: issue.severity === 'critical' ? 'rgba(248, 113, 113, 0.3)' : 'rgba(251, 146, 60, 0.25)',
                            color: 'var(--tt-text-primary)'
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={{
                                  backgroundColor: issue.severity === 'critical' ? '#F87171' : '#FB923C',
                                  color: '#0A1214'
                                }}
                              >
                                {issue.severity}
                              </span>
                              <span className="font-bold">{issue.rule_id}</span>
                            </div>
                            <span className="text-[10px] opacity-75">{issue.dimension.toUpperCase()}</span>
                          </div>
                          <div className="text-xs">{issue.evidence}</div>
                          <div className="flex items-center gap-1.5 text-[11px] opacity-90 text-[#2DD4BF]">
                            <Sparkles className="w-3 h-3" />
                            <span>Proposed: {issue.proposed_action}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      detectedIssues.map((issue, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-xs font-mono p-2 rounded-lg"
                          style={{
                            backgroundColor: 'rgba(251, 146, 60, 0.08)',
                            color: 'var(--tt-text-primary)'
                          }}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-[#FB923C] shrink-0" />
                          <span>{issue}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="p-3.5 rounded-2xl border flex items-center gap-2.5 text-xs font-mono"
                  style={{
                    backgroundColor: 'rgba(52, 211, 153, 0.08)',
                    borderColor: 'rgba(52, 211, 153, 0.25)',
                    color: 'var(--tt-text-primary)'
                  }}
                >
                  <CheckCircle2 className="w-4 h-4 text-[#34D399] shrink-0" />
                  <span>Optimal Quality Verified: No critical missing values, duplicates, or format anomalies detected.</span>
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Distribution Profiler */}
          {activeSubTab === 'distributions' && (
            <DistributionProfiler
              columns={report.columns}
              topology={report.topology}
              datasetId={datasetId}
            />
          )}

          {/* Tab 3: Column Schema Table */}
          {activeSubTab === 'columns' && (
            <div
              className="rounded-2xl border overflow-hidden"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                boxShadow: 'var(--tt-shadow-card)'
              }}
            >
              <div
                className="px-4 py-3 border-b text-xs font-bold uppercase tracking-wider font-mono flex items-center justify-between"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-muted)'
                }}
              >
                <span>Column Schema & Null Ratio Profiling</span>
                <span className="text-[10px] font-normal opacity-75">{report.columns.length} Total Columns</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr
                      className="border-b font-mono font-semibold"
                      style={{
                        backgroundColor: 'var(--tt-bg-sunken)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                    >
                      <th className="px-4 py-2.5">Column Name</th>
                      <th className="px-4 py-2.5">Semantic Type</th>
                      <th className="px-4 py-2.5">Data Type</th>
                      <th className="px-4 py-2.5">Null Count</th>
                      <th className="px-4 py-2.5">Null %</th>
                      <th className="px-4 py-2.5">Distinct</th>
                      <th className="px-4 py-2.5">Distribution</th>
                      <th className="px-4 py-2.5">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.columns.map((col, idx) => {
                      const colName = col.column_name;
                      const colType = col.data_type;
                      const semantic = col.semantic_type || 'categorical';
                      const nullCount = col.null_count ?? 0;
                      const nullPct = col.null_pct ?? 0;
                      const distinctCount = col.distinct_count ?? 0;
                      const sampleValues = col.sample_values ?? [];
                      const colDist = col.distribution;

                      return (
                        <tr
                          key={colName || idx}
                          className="border-b transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                          style={{
                            borderColor: 'var(--tt-border-subtle)',
                            backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--tt-bg-elevated)'
                          }}
                        >
                          <td className="px-4 py-2.5 font-mono font-bold" style={{ color: 'var(--tt-text-primary)' }}>
                            {colName}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className="px-2 py-0.5 rounded font-mono text-[10px] font-semibold"
                              style={{
                                backgroundColor: 'var(--tt-primary-subtle)',
                                color: 'var(--tt-primary)'
                              }}
                            >
                              {semantic}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] opacity-75">
                            {colType}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums" style={{ color: 'var(--tt-text-primary)' }}>
                            {nullCount}
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums">
                            <span style={{ color: nullPct > 0 ? '#FB923C' : '#34D399' }}>
                              {nullPct}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 font-mono tabular-nums" style={{ color: 'var(--tt-text-primary)' }}>
                            {distinctCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px]">
                            {colDist ? (
                              <button
                                type="button"
                                onClick={() => setActiveSubTab('distributions')}
                                className="underline cursor-pointer hover:text-[#2DD4BF]"
                                style={{ color: colDist.distribution_type === 'normal' ? '#34D399' : '#FB923C' }}
                              >
                                {colDist.distribution_type.replace('_', ' ')}
                              </button>
                            ) : (
                              <span className="opacity-40">—</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-[11px] opacity-80 truncate max-w-xs" style={{ color: 'var(--tt-text-secondary)' }}>
                            {Array.isArray(sampleValues) && sampleValues.length > 0 ? sampleValues.slice(0, 3).join(', ') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
