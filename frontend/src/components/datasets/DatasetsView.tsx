import React, { useState, useEffect } from 'react';
import {
  UploadCloud,
  CheckCircle,
  Sparkles,
  FileSpreadsheet,
  RefreshCw,
  Search,
  MessageSquare,
  AlertCircle,
  Database,
  Layers,
  HardDrive,
  Activity,
  Eye,
  X,
  Table as TableIcon,
  Download,
  Sliders,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { fetchDatasets, uploadDataset, cleanDataset, fetchDatasetPreview, downloadDatasetExport, deleteDataset } from '../../lib/api';
import type { CleaningResult } from '../../types/dataset';
import { toast } from '../../store/useToastStore';
import { DataGrid } from '../studio/DataGrid';
import { ExportDatasetModal } from '../common/ExportDatasetModal';

export const DatasetsView: React.FC = () => {
  const { datasets, setDatasets, datasetId, setDatasetId, setActiveTab } = useAppStore();
  const [isUploading, setIsUploading] = useState(false);
  const [cleaningId, setCleaningId] = useState<string | null>(null);
  const [cleanResult, setCleanResult] = useState<CleaningResult | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'clean' | 'raw'>('all');
  const [isDragging, setIsDragging] = useState(false);

  // Preview Modal state
  const [previewDatasetId, setPreviewDatasetId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewLimit, setPreviewLimit] = useState<number>(50);
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    row_count: number;
    duration_ms?: number;
  } | null>(null);

  // Export Modal state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportTargetDataset, setExportTargetDataset] = useState<string | null>(null);
  const [exportTargetRows, setExportTargetRows] = useState<number | undefined>(undefined);
  const [exportTargetCols, setExportTargetCols] = useState<number | undefined>(undefined);
  const [exportTargetIsClean, setExportTargetIsClean] = useState(false);

  // Delete Confirmation Modal state
  const [datasetToDelete, setDatasetToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadData = React.useCallback(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch((err) => console.error('Failed to load datasets:', err));
  }, [setDatasets]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFileUpload = async (file: File) => {
    if (!file) return;

    setIsUploading(true);
    setUploadMessage(null);
    setErrorMessage(null);

    try {
      const res = await uploadDataset(file);
      setUploadMessage(`Successfully ingested ${file.name} as '${res.dataset_id}'.`);
      toast.success('Dataset Ingested', `Created local table '${res.dataset_id}'`);
      setDatasetId(res.dataset_id);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(msg);
      toast.error('Ingestion Failed', msg);
    } finally {
      setIsUploading(false);
      setFileInputKey((k) => k + 1);
    }
  };

  const handleClean = async (id: string) => {
    setCleaningId(id);
    setCleanResult(null);
    setErrorMessage(null);

    try {
      const res = await cleanDataset(id);
      setCleanResult(res);
      toast.success('Cleaned Successfully', `Removed ${res.removed_duplicates} duplicates`);
      loadData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cleaning pipeline failed';
      setErrorMessage(msg);
      toast.error('Clean Failed', msg);
    } finally {
      setCleaningId(null);
    }
  };

  const handleOpenInStudio = (id: string) => {
    setDatasetId(id);
    setActiveTab('studio');
    toast.info('Workspace Switched', `Active dataset: ${id}`);
  };

  const handleInspectPreview = async (id: string, limit: number = 50) => {
    setPreviewDatasetId(id);
    setPreviewLimit(limit);
    setPreviewLoading(true);

    try {
      const res = await fetchDatasetPreview(id, limit);
      setPreviewData({
        columns: (res.columns as string[]) || [],
        rows: (res.rows as Record<string, unknown>[]) || [],
        row_count: (res.row_count as number) || 0,
        duration_ms: (res.duration_ms as number) || undefined
      });
    } catch (err) {
      toast.error('Preview Failed', 'Could not fetch records');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleQuickExport = async (id: string, rows?: number) => {
    try {
      const saved = await downloadDatasetExport(id, {
        format: 'csv',
        delimiter: ',',
        includeHeader: true,
        bom: true
      });
      toast.success(
        'Dataset Exported',
        `Downloaded ${saved}${rows ? ` (${rows.toLocaleString()} rows)` : ''}`
      );
    } catch (err) {
      toast.error('Export Failed', err instanceof Error ? err.message : 'Export failed');
    }
  };

  const openExportModal = (id: string, rows?: number, cols?: number, isClean = false) => {
    setExportTargetDataset(id);
    setExportTargetRows(rows);
    setExportTargetCols(cols);
    setExportTargetIsClean(isClean);
    setExportModalOpen(true);
  };

  const handleDeleteDataset = async () => {
    if (!datasetToDelete) return;
    setIsDeleting(true);

    try {
      await deleteDataset(datasetToDelete);
      toast.success('Dataset Deleted', `Removed '${datasetToDelete}' from the lake`);

      // If active workspace dataset was deleted, pick the next available
      if (datasetId === datasetToDelete) {
        const remaining = datasets.filter((d) => d.dataset_id !== datasetToDelete);
        setDatasetId(remaining[0]?.dataset_id || '');
      }

      // If currently previewing the deleted dataset, close preview
      if (previewDatasetId === datasetToDelete) {
        setPreviewDatasetId(null);
        setPreviewData(null);
      }

      loadData();
      setDatasetToDelete(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete dataset';
      toast.error('Deletion Error', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredList = React.useMemo(() => {
    return datasets.filter((d) => {
      const matchesSearch = d.dataset_id.toLowerCase().includes(searchQuery.toLowerCase());
      const isClean = d.dataset_id.toLowerCase().includes('clean');
      if (!matchesSearch) return false;
      if (filterType === 'clean') return isClean;
      if (filterType === 'raw') return !isClean;
      return true;
    });
  }, [datasets, searchQuery, filterType]);

  // Aggregate stats across catalog
  const totalRows = datasets.reduce((sum, d) => sum + (d.total_rows || 0), 0);
  const totalKb = datasets.reduce((sum, d) => sum + (d.size_kb || 0), 0);
  const avgHealth =
    datasets.length > 0
      ? Math.round(datasets.reduce((sum, d) => sum + (d.data_health_score || 0), 0) / datasets.length)
      : 100;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight text-[var(--tt-text-primary)]"
            style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Data Catalog & Ingestion
          </h1>
          <p className="text-xs sm:text-sm text-[var(--tt-text-muted)] mt-1">
            Local DuckDB tables and vectorized Parquet files ready for sub-second analytical queries.
          </p>
        </div>

        <button
          onClick={loadData}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0D9488]" />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Lake Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-3.5 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
          <div className="w-10 h-10 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#0D9488]">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-[var(--tt-text-muted)]">Tables in Lake</span>
            <div className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
              {datasets.length}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-3.5 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
          <div className="w-10 h-10 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#10B981]">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-[var(--tt-text-muted)]">Total Records</span>
            <div className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
              {totalRows.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-3.5 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
          <div className="w-10 h-10 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#0284C7]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-[var(--tt-text-muted)]">Columnar Storage</span>
            <div className="text-xl font-bold font-mono text-[var(--tt-text-primary)] tabular-nums mt-0.5">
              {totalKb > 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${totalKb.toFixed(0)} KB`}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center gap-3.5 shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
          <div className="w-10 h-10 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center shrink-0 text-[#F59E0B]">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-medium text-[var(--tt-text-muted)]">Avg Health Score</span>
            <div className="text-xl font-bold font-mono text-[#10B981] tabular-nums mt-0.5">
              {avgHealth}/100
            </div>
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs font-mono text-red-500 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Drag & Drop Upload Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFileUpload(file);
        }}
        className={`p-8 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all relative ${
          isDragging
            ? 'border-[#0D9488] bg-[#0D9488]/10'
            : 'border-[var(--tt-border-strong)] bg-[var(--tt-bg-surface)] hover:border-[#0D9488]'
        } shadow-[var(--tt-shadow-card)]`}
      >
        <input
          key={fileInputKey}
          type="file"
          accept=".csv,.xlsx,.parquet"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f);
          }}
          disabled={isUploading}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488]">
          <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : 'text-[#0D9488]'}`} />
        </div>
        <div className="text-sm font-bold text-[var(--tt-text-primary)] mb-1">
          {isUploading ? 'Ingesting & Converting to Parquet...' : 'Drop or Browse CSV, Excel, or Parquet Data'}
        </div>
        <div className="text-xs text-[var(--tt-text-muted)] max-w-md leading-relaxed">
          Files are automatically converted into compressed columnar Parquet and registered in the DuckDB catalog.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-[var(--tt-text-secondary)]">
            .CSV
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-[var(--tt-text-secondary)]">
            .XLSX
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-[var(--tt-text-secondary)]">
            .PARQUET
          </span>
        </div>
        {uploadMessage && (
          <div className="mt-3 text-xs font-mono text-[#10B981] font-medium">
            {uploadMessage}
          </div>
        )}
      </div>

      {/* Cleaning Report Banner */}
      {cleanResult && (
        <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 dark:bg-emerald-950/25 flex flex-col gap-3 text-xs shadow-[var(--tt-shadow-card)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-[#10B981]" />
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Cleaning Pipeline Executed Successfully
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleQuickExport(cleanResult.cleaned_dataset_id || cleanResult.dataset_id, cleanResult.cleaned_rows)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#10B981] hover:bg-[#059669] text-white transition-colors cursor-pointer shadow-sm"
                title="Download whole cleaned dataset as CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Clean CSV</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  openExportModal(cleanResult.cleaned_dataset_id || cleanResult.dataset_id, cleanResult.cleaned_rows, undefined, true)
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer"
                title="Configure CSV export options"
              >
                <Sliders className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Options...</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 font-mono tabular-nums pt-1">
            <div className="p-2.5 rounded-lg bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)]">
              <span className="text-[10px] text-[var(--tt-text-muted)] block">Original Rows</span>
              <span className="font-bold text-[var(--tt-text-primary)]">{cleanResult.original_rows.toLocaleString()}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)]">
              <span className="text-[10px] text-[var(--tt-text-muted)] block">Cleaned Rows</span>
              <span className="font-bold text-[var(--tt-text-primary)]">{cleanResult.cleaned_rows.toLocaleString()}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)]">
              <span className="text-[10px] text-[var(--tt-text-muted)] block">Duplicates Removed</span>
              <span className="font-bold text-[#10B981]">{cleanResult.removed_duplicates}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-xs w-full sm:w-72 shadow-[var(--tt-shadow-card)]">
          <Search className="w-3.5 h-3.5 text-[#0D9488]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search datasets in lake..."
            className="w-full bg-transparent outline-none text-xs text-[var(--tt-text-primary)]"
          />
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)]">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === 'all'
                ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold'
                : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
            }`}
          >
            All ({datasets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('clean')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === 'clean'
                ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold'
                : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
            }`}
          >
            Cleaned
          </button>
          <button
            type="button"
            onClick={() => setFilterType('raw')}
            className={`px-3 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
              filterType === 'raw'
                ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold'
                : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      {/* Parquet Catalog Grid */}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredList.map((d) => {
            const isSelected = d.dataset_id === datasetId;
            const isCleaning = cleaningId === d.dataset_id;

            return (
              <div
                key={d.dataset_id}
                className={`p-4 rounded-xl border transition-all duration-200 shadow-[var(--tt-shadow-card)] flex flex-col justify-between ${
                  isSelected
                    ? 'border-[#0D9488] ring-1 ring-[#0D9488] bg-[var(--tt-bg-surface)]'
                    : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:border-[#0D9488]'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-4 h-4 text-[#0D9488] shrink-0" />
                      <span
                        className="text-sm font-bold font-mono truncate text-[var(--tt-text-primary)]"
                        title={d.dataset_id}
                      >
                        {d.dataset_id}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Health Score Badge */}
                      <div
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                          d.data_health_score >= 80
                            ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                            : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                        }`}
                      >
                        Health: {d.data_health_score}/100
                      </div>

                      {/* Delete Dataset Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDatasetToDelete(d.dataset_id);
                        }}
                        className="p-1 rounded-md text-[var(--tt-text-muted)] hover:text-red-500 hover:bg-red-500/10 transition-colors cursor-pointer"
                        title={`Delete dataset '${d.dataset_id}'`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2.5 border-y border-[var(--tt-border-subtle)] text-xs font-mono tabular-nums my-2">
                    <div>
                      <div className="text-[10px] text-[var(--tt-text-muted)]">Rows</div>
                      <div className="font-semibold text-[var(--tt-text-primary)]">
                        {d.total_rows.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--tt-text-muted)]">Columns</div>
                      <div className="font-semibold text-[var(--tt-text-primary)]">
                        {d.total_cols}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[var(--tt-text-muted)]">Format & Size</div>
                      <div className="font-semibold truncate text-[var(--tt-text-primary)]">
                        {d.source_format?.toUpperCase() || 'PARQUET'} · {d.size_kb} KB
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleInspectPreview(d.dataset_id)}
                      type="button"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
                      title="Inspect sample records and column types"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#0D9488]" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleClean(d.dataset_id)}
                      disabled={isCleaning}
                      type="button"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)] disabled:opacity-50"
                      title="Run data cleaning pipeline"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-[#F59E0B] ${isCleaning ? 'animate-spin' : ''}`} />
                      <span>{isCleaning ? 'Cleaning...' : 'Auto-Clean'}</span>
                    </button>

                    <button
                      onClick={() =>
                        openExportModal(
                          d.dataset_id,
                          d.total_rows,
                          d.total_cols,
                          d.dataset_id.toLowerCase().includes('clean')
                        )
                      }
                      type="button"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
                      title="Export dataset as CSV with options"
                    >
                      <Download className="w-3.5 h-3.5 text-[#0D9488]" />
                      <span>Export CSV</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenInStudio(d.dataset_id)}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-all cursor-pointer shadow-[var(--tt-shadow-card)]"
                      title="Open dataset in Analytical Studio to ask questions"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Ask in Studio</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Dataset Preview Modal */}
      {previewDatasetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full h-full max-w-5xl max-h-[85vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-strong)'
            }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-5 py-3.5 border-b"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)'
              }}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2.5">
                  <TableIcon className="w-4 h-4 text-[#2DD4BF]" />
                  <div>
                    <div className="text-sm font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                      {previewDatasetId}
                    </div>
                    <div className="text-[11px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                      {(() => {
                        const targetDs = datasets.find((d) => d.dataset_id === previewDatasetId);
                        const total = targetDs?.total_rows || previewData?.row_count || 0;
                        const loaded = previewData?.rows?.length || 0;
                        if (!previewData && previewLoading) return 'Loading records...';
                        if (loaded >= total && total > 0) return `All ${total.toLocaleString()} records loaded`;
                        return `Showing ${loaded.toLocaleString()} of ${total.toLocaleString()} records`;
                      })()}
                    </div>
                  </div>
                </div>

                {/* Row Limit Selector */}
                {previewDatasetId && (
                  <div className="flex items-center gap-1 text-[11px] font-mono bg-[var(--tt-bg-surface)] p-1 rounded-lg border border-[var(--tt-border-subtle)]">
                    <span className="text-[10px] px-1 text-[var(--tt-text-muted)]">Fetch:</span>
                    {[50, 100, 500].map((lim) => (
                      <button
                        key={lim}
                        type="button"
                        onClick={() => handleInspectPreview(previewDatasetId, lim)}
                        disabled={previewLoading}
                        className="px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all disabled:opacity-50"
                        style={{
                          backgroundColor: previewLimit === lim ? 'var(--tt-primary-subtle)' : 'transparent',
                          borderColor: previewLimit === lim ? 'var(--tt-primary)' : 'transparent',
                          color: previewLimit === lim ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                          fontWeight: previewLimit === lim ? 700 : 500
                        }}
                      >
                        {lim}
                      </button>
                    ))}
                    {(() => {
                      const targetDs = datasets.find((d) => d.dataset_id === previewDatasetId);
                      const total = targetDs?.total_rows || 1000;
                      const isAll = previewLimit >= total;
                      return (
                        <button
                          type="button"
                          onClick={() => handleInspectPreview(previewDatasetId, Math.max(total, 1000))}
                          disabled={previewLoading}
                          className="px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all disabled:opacity-50"
                          title={`Load all ${total.toLocaleString()} records`}
                          style={{
                            backgroundColor: isAll ? 'var(--tt-primary-subtle)' : 'transparent',
                            borderColor: isAll ? 'var(--tt-primary)' : 'transparent',
                            color: isAll ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                            fontWeight: isAll ? 700 : 500
                          }}
                        >
                          All ({total.toLocaleString()})
                        </button>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenInStudio(previewDatasetId);
                    setPreviewDatasetId(null);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--tt-primary)',
                    color: '#0A1214'
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Analyze in Studio</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDatasetToDelete(previewDatasetId)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-500 hover:bg-red-500/10 border border-red-500/30 transition-colors cursor-pointer"
                  title="Delete dataset"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewDatasetId(null)}
                  className="p-1.5 rounded-lg border cursor-pointer hover:border-[#2DD4BF] transition-all"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-text-primary)'
                  }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-4 overflow-y-auto min-h-0">
              {previewLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-xs font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                  <RefreshCw className="w-6 h-6 animate-spin text-[#2DD4BF] mb-2" />
                  <span>Reading columnar Parquet file...</span>
                </div>
              ) : previewData ? (
                <DataGrid tableResult={previewData} />
              ) : (
                <div className="text-center py-20 text-xs font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                  No preview available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Export Dataset Modal */}
      {exportTargetDataset && (
        <ExportDatasetModal
          isOpen={exportModalOpen}
          onClose={() => {
            setExportModalOpen(false);
            setExportTargetDataset(null);
          }}
          datasetId={exportTargetDataset}
          totalRows={exportTargetRows}
          totalCols={exportTargetCols}
          isCleaned={exportTargetIsClean}
        />
      )}

      {/* Delete Confirmation Modal */}
      {datasetToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[var(--tt-bg-surface)] border border-red-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-[var(--tt-border-subtle)] bg-red-500/10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center text-red-500 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--tt-text-primary)]">
                  Delete Dataset
                </h3>
                <p className="text-xs text-red-400 mt-0.5">
                  Permanent data lake deletion
                </p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-3">
              <p className="text-xs text-[var(--tt-text-secondary)] leading-relaxed">
                Are you sure you want to permanently delete{' '}
                <span className="font-mono font-bold text-[var(--tt-text-primary)] bg-[var(--tt-bg-subtle)] px-1.5 py-0.5 rounded border border-[var(--tt-border-subtle)]">
                  {datasetToDelete}
                </span>
                ?
              </p>
              <div className="p-3 rounded-xl bg-red-500/5 border border-red-500/20 text-[11px] text-[var(--tt-text-muted)] space-y-1">
                <div className="flex items-center gap-1.5 text-red-400 font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Irreversible Action</span>
                </div>
                <p>
                  This will permanently remove the uploaded raw file, all processed version Parquets, and data quality profiles from storage.
                </p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)] flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDatasetToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteDataset}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Trash2 className={`w-3.5 h-3.5 ${isDeleting ? 'animate-bounce' : ''}`} />
                <span>{isDeleting ? 'Deleting...' : 'Delete Dataset'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
