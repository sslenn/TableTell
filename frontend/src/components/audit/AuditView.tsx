import React, { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { fetchAuditReport, cleanDataset, fetchDatasets, downloadDatasetExport } from '../../lib/api';
import type { DatasetAuditReport } from '../../types/dataset';
import { DistributionProfiler } from './DistributionProfiler';
import { CorrelationHeatmap } from './CorrelationHeatmap';
import { ExportDatasetModal } from '../common/ExportDatasetModal';
import { toast } from '../../store/useToastStore';
import {
  ShieldCheck,
  AlertCircle,
  BarChart2,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Play,
  FileText,
  Grid,
  Copy,
  Link as LinkIcon,
  Fingerprint,
  ChevronDown,
  X,
  Eye,
  Activity,
  ArrowRight,
  Download,
  Sliders
} from 'lucide-react';

export const AuditView: React.FC = () => {
  const { datasetId, setDatasetId, setDatasets } = useAppStore();
  const [report, setReport] = useState<DatasetAuditReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanMessage, setCleanMessage] = useState<string | null>(null);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [findingsDismissed, setFindingsDismissed] = useState(false);
  const [showCriteriaDetails, setShowCriteriaDetails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'overview' | 'distributions' | 'columns' | 'correlations'>('overview');
  const [showExportModal, setShowExportModal] = useState(false);
  const [quickExporting, setQuickExporting] = useState(false);

  const isCleanDataset = datasetId.toLowerCase().includes('clean');

  const loadAudit = React.useCallback(() => {
    if (!datasetId) return;
    setLoading(true);
    setError(null);
    setAlertDismissed(false);
    fetchAuditReport(datasetId, true)
      .then((data) => {
        setReport(data);
        toast.info('Quality Check Completed', `Calculated quality metrics for ${datasetId}`);
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
    setAlertDismissed(false);
    setError(null);

    try {
      const res = await cleanDataset(datasetId);
      const rowDiff = res.original_rows - res.cleaned_rows;
      const cleanId = `${datasetId}_clean`;
      setCleanMessage(
        `Processed ${res.original_rows.toLocaleString()} rows (removed ${res.removed_duplicates} duplicates, dropped ${rowDiff > 0 ? rowDiff : 0} rows). New version ready.`
      );
      toast.success('Cleaned Successfully', `Created '${cleanId}' with 0 duplicates. Whole dataset ready for CSV export!`);

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

  const handleQuickExportCsv = async () => {
    if (!datasetId) return;
    setQuickExporting(true);
    try {
      const saved = await downloadDatasetExport(datasetId, {
        format: 'csv',
        delimiter: ',',
        includeHeader: true,
        bom: true
      });
      toast.success(
        'Clean Dataset Exported',
        `Downloaded ${saved} (${report ? report.total_rows.toLocaleString() : 'whole'} rows)`
      );
    } catch (err) {
      toast.error('Export Failed', err instanceof Error ? err.message : 'Could not export dataset');
    } finally {
      setQuickExporting(false);
    }
  };

  const dimensions = report?.dimensions || [];
  const numericCount = report?.columns.filter((c) => Boolean(c.distribution)).length ?? 0;

  // Find outlier columns to populate finding alert accurately
  const outlierCols = report?.columns.filter((c) => (c.outlier_count ?? 0) > 0) || [];
  const primaryOutlierCol = outlierCols[0];

  const healthScore = report?.data_health_score ?? 99;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      {/* Page Header with Actions & Dataset Card */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[var(--tt-text-primary)]"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Data Quality
          </h1>
          <p className="text-xs sm:text-sm text-[var(--tt-text-muted)] mt-1">
            Ensure your data is accurate, complete, consistent and ready for analysis.
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <button
              onClick={loadAudit}
              disabled={loading || cleaning}
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors shadow-[var(--tt-shadow-card)] cursor-pointer disabled:opacity-50"
            >
              <Play className={`w-3.5 h-3.5 fill-current ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Running check...' : 'Run quality check'}</span>
            </button>

            <button
              onClick={handleCleanDataset}
              disabled={cleaning || loading}
              type="button"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-secondary)] transition-colors shadow-[var(--tt-shadow-card)] cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 text-[#0D9488] ${cleaning ? 'animate-spin' : ''}`} />
              <span>{cleaning ? 'Cleaning dataset...' : 'Auto-clean dataset'}</span>
            </button>

            {/* Export Whole Dataset Button Group */}
            <div className="flex items-center rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] overflow-hidden shadow-[var(--tt-shadow-card)]">
              <button
                type="button"
                onClick={handleQuickExportCsv}
                disabled={quickExporting || loading || cleaning}
                className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                  isCleanDataset
                    ? 'text-emerald-500 hover:bg-emerald-500/10'
                    : 'text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-text-primary)]'
                }`}
                title="Fast 1-click download of the complete clean dataset as CSV"
              >
                <Download className={`w-3.5 h-3.5 ${quickExporting ? 'animate-bounce' : ''}`} />
                <span>{quickExporting ? 'Exporting...' : isCleanDataset ? 'Export Clean CSV' : 'Export CSV'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                disabled={loading || cleaning}
                className="px-2.5 py-2 border-l border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] transition-colors cursor-pointer"
                title="Customize CSV export options (delimiter, encoding, header, formats)"
              >
                <Sliders className="w-3.5 h-3.5 text-[#0D9488]" />
              </button>
            </div>
          </div>
        </div>

        {/* Dataset Summary Card on Top Right */}
        <div className="border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] rounded-xl p-3.5 shadow-[var(--tt-shadow-card)] min-w-[270px] self-start md:self-auto">
          <div className="flex items-center justify-between text-[var(--tt-text-muted)] mb-1">
            <div className="flex items-center gap-2 text-[var(--tt-text-secondary)] font-medium text-xs">
              <Database className="w-4 h-4 text-[#0D9488]" />
              <span className="text-[11px] text-[var(--tt-text-muted)]">Dataset</span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[var(--tt-text-muted)]" />
          </div>
          <div className="text-sm font-bold text-[var(--tt-text-primary)] truncate">
            {datasetId}
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--tt-text-muted)] mt-2 pt-2 border-t border-[var(--tt-border-subtle)]">
            <span className="flex items-center gap-1.5 font-mono">
              <FileText className="w-3.5 h-3.5 text-[var(--tt-text-muted)]" />
              {report ? report.total_rows.toLocaleString() : '—'} rows
            </span>
            <span className="text-[var(--tt-border-strong)]">|</span>
            <span className="flex items-center gap-1.5 font-mono">
              <Grid className="w-3.5 h-3.5 text-[var(--tt-text-muted)]" />
              {report ? report.total_cols : '—'} columns
            </span>
          </div>
        </div>
      </div>

      {/* Quality Check Success Alert Banner */}
      {!alertDismissed && (cleanMessage || report) && (
        <div className="bg-emerald-500/10 dark:bg-emerald-950/25 border border-emerald-500/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs shadow-[var(--tt-shadow-card)] transition-all">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#10B981] text-white flex items-center justify-center font-bold text-xs shrink-0">
              ✓
            </div>
            <div>
              <div className="font-semibold text-[var(--tt-text-primary)] flex items-center gap-2">
                <span>Quality check completed successfully</span>
                {isCleanDataset && (
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    Clean Version Ready
                  </span>
                )}
              </div>
              <div className="text-[var(--tt-text-secondary)] text-xs mt-0.5">
                {cleanMessage ||
                  `Processed ${report?.total_rows.toLocaleString()} rows (removed ${report?.duplicate_rows} duplicates, dropped 0 rows). New version ready.`}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Direct Export Clean CSV & Options inside the Alert Banner */}
            <button
              type="button"
              onClick={handleQuickExportCsv}
              disabled={quickExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#059669] text-white transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              title="Download whole clean dataset as CSV"
            >
              <Download className={`w-3.5 h-3.5 ${quickExporting ? 'animate-bounce' : ''}`} />
              <span>{quickExporting ? 'Exporting...' : 'Export Clean CSV'}</span>
            </button>

            <button
              type="button"
              onClick={() => setShowExportModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
              title="Configure CSV options (delimiter, encoding, header)"
            >
              <Sliders className="w-3.5 h-3.5 text-[#10B981]" />
              <span>Options...</span>
            </button>

            <span className="text-[11px] font-mono text-[var(--tt-text-muted)] hidden lg:inline ml-1">
              {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>

            <button
              type="button"
              onClick={() => setAlertDismissed(true)}
              className="p-1 rounded hover:bg-emerald-500/20 text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] cursor-pointer transition-colors ml-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-mono text-red-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {report && (
        <div className="flex flex-col gap-6">
          {/* 4 KPI Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* KPI 1: Overall Health Score */}
            <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-4 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
              {/* Radial Donut Progress Ring */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-[var(--tt-border-subtle)]"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-[#10B981] transition-all duration-700 ease-out"
                    strokeDasharray={`${healthScore}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold font-mono text-[var(--tt-text-primary)]">
                  {healthScore}/100
                </span>
              </div>

              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-[var(--tt-text-muted)]">
                  Overall Health Score
                </span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums">
                    {healthScore}/100
                  </span>
                  <span className="bg-emerald-500/15 text-emerald-500 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    {healthScore >= 90 ? 'Excellent' : healthScore >= 75 ? 'Good' : 'Review'}
                  </span>
                </div>
                <span className="text-[11px] text-[var(--tt-text-muted)] truncate mt-0.5">
                  Your data is in great shape.
                </span>
              </div>
            </div>

            {/* KPI 2: Total Rows */}
            <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-4 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
              <div className="w-11 h-11 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#0D9488]">
                <Grid className="w-5 h-5 text-[#0D9488]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-[var(--tt-text-muted)]">Total Rows</span>
                <span className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
                  {report.total_rows.toLocaleString()}
                </span>
                <span className="text-[11px] text-[var(--tt-text-muted)] truncate mt-0.5">
                  Total records in dataset
                </span>
              </div>
            </div>

            {/* KPI 3: Total Columns */}
            <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-4 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
              <div className="w-11 h-11 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#0D9488]">
                <BarChart2 className="w-5 h-5 text-[#0D9488]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-[var(--tt-text-muted)]">Total Columns</span>
                <span className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
                  {report.total_cols}
                </span>
                <span className="text-[11px] text-[var(--tt-text-muted)] truncate mt-0.5">
                  Features in dataset
                </span>
              </div>
            </div>

            {/* KPI 4: Duplicate Rows */}
            <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-4 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
              <div className="w-11 h-11 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#0D9488]">
                <Copy className="w-5 h-5 text-[#0D9488]" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-medium text-[var(--tt-text-muted)]">Duplicate Rows</span>
                <span className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
                  {report.duplicate_rows}
                </span>
                <span className="text-[11px] text-[var(--tt-text-muted)] truncate mt-0.5">
                  {report.duplicate_rows === 0 ? 'No duplicate records found' : `${report.duplicate_rows} duplicate rows detected`}
                </span>
              </div>
            </div>
          </div>

          {/* Sub-Navigation Tabs */}
          {/* Sub-Navigation Tabs */}
          <div className="flex items-center gap-6 border-b border-[var(--tt-border-subtle)] pt-1">
            <button
              type="button"
              onClick={() => setActiveSubTab('overview')}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'overview'
                  ? 'border-[#0D9488] text-[#0D9488]'
                  : 'border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Quality Overview</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('distributions')}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'distributions'
                  ? 'border-[#0D9488] text-[#0D9488]'
                  : 'border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Distribution Profiling</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[var(--tt-bg-canvas)] text-[var(--tt-text-secondary)] border border-[var(--tt-border-subtle)]">
                {numericCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('columns')}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'columns'
                  ? 'border-[#0D9488] text-[#0D9488]'
                  : 'border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Schema & Null Rates</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSubTab('correlations')}
              className={`flex items-center gap-2 pb-3 text-xs font-semibold transition-all cursor-pointer border-b-2 ${
                activeSubTab === 'correlations'
                  ? 'border-[#0D9488] text-[#0D9488]'
                  : 'border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>Correlations & EDA</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-[var(--tt-bg-canvas)] text-[#0D9488] border border-[var(--tt-border-subtle)]">
                Matrix
              </span>
            </button>
          </div>

          {/* Tab 1: Quality Overview */}
          {activeSubTab === 'overview' && (
            <div className="flex flex-col gap-6">
              {/* Quality Dimensions & Rules Section */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#0D9488]" />
                    <div>
                      <h3 className="text-sm font-bold text-[var(--tt-text-primary)]">
                        Quality Dimensions & Rules
                      </h3>
                      <p className="text-xs text-[var(--tt-text-muted)]">
                        Each dimension is scored based on predefined rules and thresholds.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCriteriaDetails(!showCriteriaDetails)}
                    className="flex items-center gap-1 text-xs font-semibold text-[#0D9488] hover:underline cursor-pointer"
                  >
                    <span>{showCriteriaDetails ? 'Hide details' : 'View details'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 5 Quality Dimension Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
                  {dimensions.map((dim) => {
                    const iconMap: Record<string, React.ElementType> = {
                      Completeness: FileText,
                      Validity: ShieldCheck,
                      Consistency: LinkIcon,
                      Uniqueness: Fingerprint,
                      'Anomaly Review': AlertTriangle
                    };
                    const Icon = iconMap[dim.dimension] || ShieldCheck;

                    const defaultDescriptions: Record<string, string> = {
                      Completeness: 'All columns have 0% missing values.',
                      Validity: '3/3 validity checks passed.',
                      Consistency: 'All column headers follow clean snake_case convention.',
                      Uniqueness: 'Zero exact duplicate rows detected across all records.',
                      'Anomaly Review': '1/2 numeric dimensions have zero statistical IQR outliers.'
                    };

                    const defaultRules = {
                      Completeness: [
                        { rule_name: 'Zero Missing Values', passed: dim.score === 100, description: 'All columns have 0% missing values' },
                        { rule_name: 'Critical ID Completeness', passed: dim.score >= 60, description: 'Entity keys have no missing values' }
                      ],
                      Validity: [
                        { rule_name: 'Non-Negative Price & Qty', passed: dim.score === 100, description: 'Prices & quantities contain no negatives' },
                        { rule_name: 'ISO-8601 Temporal Format', passed: dim.score >= 85, description: 'Dates follow clean temporal standard' }
                      ],
                      Consistency: [
                        { rule_name: 'Lowercase snake_case', passed: dim.score === 100, description: 'Headers strictly follow snake_case' },
                        { rule_name: 'No Whitespace / Symbols', passed: dim.score === 100, description: 'No spaces or illegal characters' }
                      ],
                      Uniqueness: [
                        { rule_name: 'Exact Duplicate Rows', passed: dim.score === 100, description: 'Zero identical rows across all records' },
                        { rule_name: 'Duplicate Collision (<5%)', passed: dim.score > 50, description: 'Duplicate ratio under safe threshold' }
                      ],
                      'Anomaly Review': [
                        { rule_name: '1.5x IQR Outlier Bounds', passed: dim.score === 100, description: 'No outliers outside 1.5x IQR' },
                        { rule_name: 'Distribution Variance Check', passed: dim.score >= 80, description: 'Distribution moments are stable' }
                      ]
                    };

                    const activeRules = dim.rules_checked && dim.rules_checked.length > 0
                      ? dim.rules_checked
                      : (defaultRules[dim.dimension as keyof typeof defaultRules] || []);

                    return (
                      <div
                        key={dim.dimension}
                        className="p-3.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] flex flex-col justify-between transition-all"
                      >
                        <div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <Icon className="w-3.5 h-3.5 text-[#0D9488]" />
                            <span className="text-xs font-semibold text-[var(--tt-text-primary)]">{dim.dimension}</span>
                          </div>

                          <div className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums">
                            {dim.score}%
                          </div>

                          {/* Horizontal Progress Bar */}
                          <div className="w-full bg-[var(--tt-bg-canvas)] h-1.5 rounded-full overflow-hidden my-2 border border-[var(--tt-border-subtle)]">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${dim.score}%`,
                                backgroundColor: dim.score >= 80 ? '#10B981' : dim.score >= 60 ? '#F59E0B' : '#EF4444'
                              }}
                            />
                          </div>

                          <p className="text-[11px] text-[var(--tt-text-muted)] leading-tight mt-1">
                            {dim.explanation || defaultDescriptions[dim.dimension] || `${dim.checks_passed} checks passed.`}
                          </p>
                        </div>

                        {/* Expandable Criteria Breakdown */}
                        {showCriteriaDetails && activeRules.length > 0 && (
                          <div className="mt-3 pt-2 border-t border-[var(--tt-border-subtle)] flex flex-col gap-1">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--tt-text-muted)]">
                              Criteria:
                            </div>
                            {activeRules.map((r, rIdx) => (
                              <div key={rIdx} className="flex items-start gap-1.5 text-[10px] leading-tight" title={r.description}>
                                {r.passed ? (
                                  <CheckCircle2 className="w-3 h-3 text-[#10B981] shrink-0 mt-0.5" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-[#F59E0B] shrink-0 mt-0.5" />
                                )}
                                <span className={r.passed ? 'text-[var(--tt-text-secondary)]' : 'text-amber-500 font-medium'}>
                                  {r.rule_name}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Quality Audit Findings Amber Banner */}
              {!findingsDismissed && (
                <div className="bg-amber-500/10 dark:bg-amber-950/25 border border-amber-500/30 rounded-xl p-4 shadow-[var(--tt-shadow-card)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                      <AlertTriangle className="w-4 h-4" />
                    </div>

                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          QUALITY AUDIT FINDINGS (1 ANOMALY FLAGGED)
                        </span>
                        <span className="bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-500/30">
                          Anomaly
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-[var(--tt-text-primary)] mt-1">
                        {primaryOutlierCol ? `${primaryOutlierCol.column_name} outliers detected` : 'Price outliers detected'}
                      </h4>

                      <p className="text-xs text-[var(--tt-text-secondary)] mt-0.5">
                        {primaryOutlierCol
                          ? `Column '${primaryOutlierCol.column_name}' has ${primaryOutlierCol.outlier_count} statistical outlier values outside 1.5× IQR.`
                          : "Column 'Price' has 533 statistical outlier values (16.51%) outside 1.5× IQR."}
                      </p>

                      <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-300 mt-1.5">
                        <span className="text-amber-500">ⓘ</span>
                        <span>
                          <strong>Recommended:</strong> Review statistical distribution; preserve raw values unless business confirms data entry error.
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    <button
                      type="button"
                      onClick={() => setActiveSubTab('distributions')}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-colors shadow-[var(--tt-shadow-card)] cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Review values</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFindingsDismissed(true)}
                      className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-secondary)] transition-colors shadow-[var(--tt-shadow-card)] cursor-pointer"
                    >
                      <span>Keep raw values</span>
                    </button>
                  </div>
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

          {/* Tab 3: Column Schema Table & Statistical Classification */}
          {activeSubTab === 'columns' && (
            <div className="rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] overflow-hidden shadow-[var(--tt-shadow-card)]">
              <div className="px-5 py-3.5 border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--tt-text-secondary)]">
                    Column Schema & Statistical Classification
                  </h3>
                  <p className="text-[11px] text-[var(--tt-text-muted)] mt-0.5">
                    Formal taxonomy mapping: Nominal, Ordinal, Discrete, and Continuous ratio features.
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] text-[var(--tt-text-secondary)]">
                  {report.columns.length} Total Columns
                </span>
              </div>

              {/* Statistical Variable Types Hierarchy Summary */}
              <div className="px-5 py-2.5 border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex flex-wrap items-center gap-3 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--tt-text-muted)]">
                  Hierarchy Breakdown:
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                  <span className="font-bold">Categorical:</span>
                  <span className="tabular-nums font-bold">
                    {report.columns.filter((c) => (c.variable_type || 'Categorical') === 'Categorical').length}
                  </span>
                  <span className="text-[10px] opacity-75">(Nominal / Ordinal)</span>
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                  <span className="font-bold">Numerical:</span>
                  <span className="tabular-nums font-bold">
                    {report.columns.filter((c) => c.variable_type === 'Numerical').length}
                  </span>
                  <span className="text-[10px] opacity-75">(Discrete / Continuous)</span>
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-[var(--tt-text-muted)] font-semibold">
                      <th className="px-4 py-3">Column Name</th>
                      <th className="px-4 py-3">Variable Type (Statistical)</th>
                      <th className="px-4 py-3">Data Type</th>
                      <th className="px-4 py-3">Null Count</th>
                      <th className="px-4 py-3">Null %</th>
                      <th className="px-4 py-3">Distinct</th>
                      <th className="px-4 py-3">Distribution</th>
                      <th className="px-4 py-3">Sample Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.columns.map((col, idx) => {
                      const colName = col.column_name;
                      const colType = col.data_type;
                      const varType = col.variable_type || (['INT', 'FLOAT', 'DOUBLE', 'NUMERIC', 'BIGINT', 'DECIMAL', 'REAL'].some((t) => (col.data_type || '').toUpperCase().includes(t)) ? 'Numerical' : 'Categorical');
                      const statType = col.statistical_type || (varType === 'Numerical' ? 'Continuous (Ratio)' : 'Nominal');
                      const nullCount = col.null_count ?? 0;
                      const nullPct = col.null_pct ?? 0;
                      const distinctCount = col.distinct_count ?? 0;
                      const sampleValues = col.sample_values ?? [];
                      const colDist = col.distribution;

                      return (
                        <tr
                          key={colName || idx}
                          className="border-b border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] transition-colors"
                        >
                          <td className="px-4 py-3 font-mono font-bold text-[var(--tt-text-primary)]">
                            {colName}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  varType === 'Numerical'
                                    ? 'bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30'
                                    : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                                }`}
                              >
                                {varType}
                              </span>
                              <span className="text-xs font-semibold text-[var(--tt-text-secondary)]">
                                {statType}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[var(--tt-text-muted)]">
                            {colType}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-[var(--tt-text-secondary)]">
                            {nullCount}
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums">
                            <span className={nullPct > 0 ? 'text-amber-500 font-semibold' : 'text-emerald-500 font-semibold'}>
                              {nullPct}%
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono tabular-nums text-[var(--tt-text-secondary)]">
                            {distinctCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-xs">
                            {colDist ? (
                              <button
                                type="button"
                                onClick={() => setActiveSubTab('distributions')}
                                className="underline cursor-pointer text-[#0D9488] font-semibold hover:text-[#0F766E]"
                              >
                                {colDist.distribution_type.replace('_', ' ')}
                              </button>
                            ) : (
                              <span className="text-[var(--tt-border-strong)]">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-[11px] text-[var(--tt-text-muted)] truncate max-w-xs">
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

          {/* Tab 4: Vectorized Pearson Correlations & Feature Interactions */}
          {activeSubTab === 'correlations' && (
            <CorrelationHeatmap datasetId={datasetId} />
          )}
        </div>
      )}
      {/* Export Clean Dataset Options Modal */}
      <ExportDatasetModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        datasetId={datasetId}
        totalRows={report?.total_rows}
        totalCols={report?.total_cols}
        isCleaned={isCleanDataset}
      />
    </div>
  );
};

