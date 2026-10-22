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
  Table as TableIcon
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { fetchDatasets, uploadDataset, cleanDataset, fetchDatasetPreview } from '../../lib/api';
import type { CleaningResult } from '../../types/dataset';
import { toast } from '../../store/useToastStore';
import { DataGrid } from '../studio/DataGrid';

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
  const [previewData, setPreviewData] = useState<{
    columns: string[];
    rows: Record<string, unknown>[];
    row_count: number;
  } | null>(null);

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

  const handleInspectPreview = async (id: string) => {
    setPreviewDatasetId(id);
    setPreviewLoading(true);
    setPreviewData(null);

    try {
      const res = await fetchDatasetPreview(id, 10);
      setPreviewData({
        columns: (res.columns as string[]) || [],
        rows: (res.rows as Record<string, unknown>[]) || [],
        row_count: (res.row_count as number) || 0
      });
    } catch (err) {
      toast.error('Preview Failed', 'Could not fetch sample rows');
    } finally {
      setPreviewLoading(false);
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
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-8">
      {/* View Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            className="text-xl sm:text-2xl font-bold tracking-tight"
            style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
          >
            Local Parquet Data Lake & Catalog
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: 'var(--tt-text-muted)' }}>
            Vectorized columnar tables stored locally for deterministic sub-second DuckDB queries.
          </p>
        </div>

        <button
          onClick={loadData}
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:border-[#2DD4BF]"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            color: 'var(--tt-text-secondary)'
          }}
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#2DD4BF]" />
          <span>Refresh Catalog</span>
        </button>
      </div>

      {/* Lake Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="p-3.5 rounded-2xl border flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center justify-between text-muted text-xs">
            <span style={{ color: 'var(--tt-text-muted)' }}>Datasets In Lake</span>
            <Database className="w-4 h-4 text-[#2DD4BF]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
            {datasets.length}
          </div>
        </div>

        <div
          className="p-3.5 rounded-2xl border flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center justify-between text-muted text-xs">
            <span style={{ color: 'var(--tt-text-muted)' }}>Total Records</span>
            <Layers className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
            {totalRows.toLocaleString()}
          </div>
        </div>

        <div
          className="p-3.5 rounded-2xl border flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center justify-between text-muted text-xs">
            <span style={{ color: 'var(--tt-text-muted)' }}>Columnar Storage</span>
            <HardDrive className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1" style={{ color: 'var(--tt-text-primary)' }}>
            {totalKb > 1024 ? `${(totalKb / 1024).toFixed(1)} MB` : `${totalKb.toFixed(0)} KB`}
          </div>
        </div>

        <div
          className="p-3.5 rounded-2xl border flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center justify-between text-muted text-xs">
            <span style={{ color: 'var(--tt-text-muted)' }}>Avg Health Score</span>
            <Activity className="w-4 h-4 text-[#FB923C]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums mt-1 text-[#34D399]">
            {avgHealth}/100
          </div>
        </div>
      </div>

      {/* Error Notice */}
      {errorMessage && (
        <div
          className="p-3 rounded-xl border text-xs font-mono flex items-center gap-2"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderColor: 'var(--tt-error)',
            color: 'var(--tt-error)'
          }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
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
        className={`p-7 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center text-center transition-all relative ${
          isDragging ? 'border-[#2DD4BF] bg-[#2DD4BF]/5 scale-[1.01]' : ''
        }`}
        style={{
          backgroundColor: isDragging ? 'var(--tt-primary-subtle)' : 'var(--tt-bg-surface)',
          borderColor: isDragging ? 'var(--tt-primary)' : 'var(--tt-border-strong)'
        }}
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
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-2.5 border"
          style={{
            backgroundColor: 'var(--tt-primary-subtle)',
            borderColor: 'var(--tt-border-subtle)',
            color: 'var(--tt-primary)'
          }}
        >
          <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : 'text-[#2DD4BF]'}`} />
        </div>
        <div className="text-sm font-bold mb-1" style={{ color: 'var(--tt-text-primary)' }}>
          {isUploading ? 'Ingesting & Converting to Parquet...' : 'Drop or Browse CSV, Excel, or Parquet Data'}
        </div>
        <div className="text-xs max-w-md leading-relaxed" style={{ color: 'var(--tt-text-muted)' }}>
          Files are automatically converted into compressed columnar Parquet and registered in the DuckDB catalog.
        </div>
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: 'var(--tt-border-subtle)', color: 'var(--tt-text-muted)' }}>
            .CSV
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: 'var(--tt-border-subtle)', color: 'var(--tt-text-muted)' }}>
            .XLSX
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{ borderColor: 'var(--tt-border-subtle)', color: 'var(--tt-text-muted)' }}>
            .PARQUET
          </span>
        </div>
        {uploadMessage && (
          <div className="mt-3 text-xs font-mono text-[#34D399] font-medium">
            {uploadMessage}
          </div>
        )}
      </div>

      {/* Cleaning Report Banner */}
      {cleanResult && (
        <div
          className="p-4 rounded-xl border flex flex-col gap-2 animate-in fade-in"
          style={{
            backgroundColor: 'rgba(52, 211, 153, 0.1)',
            borderColor: 'var(--tt-success)',
            color: 'var(--tt-text-primary)'
          }}
        >
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-[#34D399]" />
            <span className="text-xs font-bold uppercase tracking-wide text-[#34D399]">
              OOP Cleaning Pipeline Executed Successfully
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums pt-1">
            <div className="p-2 rounded bg-black/10 dark:bg-black/30">
              <span className="text-[10px] opacity-70 block">Original Rows</span>
              <span className="font-bold">{cleanResult.original_rows.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded bg-black/10 dark:bg-black/30">
              <span className="text-[10px] opacity-70 block">Cleaned Rows</span>
              <span className="font-bold">{cleanResult.cleaned_rows.toLocaleString()}</span>
            </div>
            <div className="p-2 rounded bg-black/10 dark:bg-black/30">
              <span className="text-[10px] opacity-70 block">Duplicates Removed</span>
              <span className="font-bold">{cleanResult.removed_duplicates}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs w-full sm:w-72"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            color: 'var(--tt-text-primary)'
          }}
        >
          <Search className="w-3.5 h-3.5 opacity-60 text-[#2DD4BF]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search datasets in lake..."
            className="w-full bg-transparent outline-none text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl border" style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-surface)' }}>
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors"
            style={{
              backgroundColor: filterType === 'all' ? 'var(--tt-primary-subtle)' : 'transparent',
              color: filterType === 'all' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
              fontWeight: filterType === 'all' ? 700 : 500
            }}
          >
            All ({datasets.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('clean')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors"
            style={{
              backgroundColor: filterType === 'clean' ? 'var(--tt-primary-subtle)' : 'transparent',
              color: filterType === 'clean' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
              fontWeight: filterType === 'clean' ? 700 : 500
            }}
          >
            Cleaned
          </button>
          <button
            type="button"
            onClick={() => setFilterType('raw')}
            className="px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors"
            style={{
              backgroundColor: filterType === 'raw' ? 'var(--tt-primary-subtle)' : 'transparent',
              color: filterType === 'raw' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
              fontWeight: filterType === 'raw' ? 700 : 500
            }}
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
                className="p-4 rounded-2xl border flex flex-col justify-between transition-all duration-200 hover:border-[#2DD4BF] shadow-xs hover:shadow-lg"
                style={{
                  backgroundColor: 'var(--tt-bg-surface)',
                  borderColor: isSelected ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  boxShadow: isSelected ? '0 0 0 1px var(--tt-primary)' : 'var(--tt-shadow-card)'
                }}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 truncate">
                      <FileSpreadsheet className="w-4 h-4 text-[#2DD4BF] shrink-0" />
                      <span
                        className="text-sm font-bold font-mono truncate"
                        style={{ color: 'var(--tt-text-primary)' }}
                        title={d.dataset_id}
                      >
                        {d.dataset_id}
                      </span>
                    </div>

                    {/* Health Score Badge */}
                    <div
                      className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0"
                      style={{
                        backgroundColor:
                          d.data_health_score >= 80
                            ? 'rgba(52, 211, 153, 0.15)'
                            : 'rgba(251, 146, 60, 0.15)',
                        color: d.data_health_score >= 80 ? '#34D399' : '#FB923C'
                      }}
                    >
                      Health: {d.data_health_score}/100
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-2.5 border-y text-xs font-mono tabular-nums my-2" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--tt-text-muted)' }}>
                        Rows
                      </div>
                      <div className="font-semibold" style={{ color: 'var(--tt-text-primary)' }}>
                        {d.total_rows.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--tt-text-muted)' }}>
                        Columns
                      </div>
                      <div className="font-semibold" style={{ color: 'var(--tt-text-primary)' }}>
                        {d.total_cols}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px]" style={{ color: 'var(--tt-text-muted)' }}>
                        Format & Size
                      </div>
                      <div className="font-semibold truncate" style={{ color: 'var(--tt-text-primary)' }}>
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
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:border-[#2DD4BF]"
                      style={{
                        backgroundColor: 'var(--tt-bg-elevated)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                      title="Inspect sample records and column types"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#2DD4BF]" />
                      <span>Preview</span>
                    </button>

                    <button
                      onClick={() => handleClean(d.dataset_id)}
                      disabled={isCleaning}
                      type="button"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors hover:border-[#FB923C] disabled:opacity-50"
                      style={{
                        backgroundColor: 'var(--tt-bg-elevated)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                      title="Run OOP data cleaning pipeline"
                    >
                      <Sparkles className={`w-3.5 h-3.5 text-[#FB923C] ${isCleaning ? 'animate-spin' : ''}`} />
                      <span>{isCleaning ? 'Cleaning...' : 'Auto-Clean'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenInStudio(d.dataset_id)}
                      type="button"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm hover:opacity-90"
                      style={{
                        backgroundColor: 'var(--tt-primary)',
                        color: '#0A1214'
                      }}
                      title="Open dataset in Analytical Studio to ask questions"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-black" />
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
              <div className="flex items-center gap-2.5">
                <TableIcon className="w-4 h-4 text-[#2DD4BF]" />
                <div>
                  <div className="text-sm font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                    {previewDatasetId}
                  </div>
                  <div className="text-[11px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                    Sample Preview (First 10 records)
                  </div>
                </div>
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
    </div>
  );
};
