import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Settings2,
  Check,
  X,
  FileText,
  Sparkles,
  Database,
  Sliders
} from 'lucide-react';
import { downloadDatasetExport, type ExportDatasetOptions } from '../../lib/api';
import { toast } from '../../store/useToastStore';

interface ExportDatasetModalProps {
  isOpen: boolean;
  onClose: () => void;
  datasetId: string;
  totalRows?: number;
  totalCols?: number;
  isCleaned?: boolean;
}

export const ExportDatasetModal: React.FC<ExportDatasetModalProps> = ({
  isOpen,
  onClose,
  datasetId,
  totalRows,
  totalCols,
  isCleaned = true
}) => {
  const [format, setFormat] = useState<'csv' | 'tsv' | 'json' | 'parquet'>('csv');
  const [delimiter, setDelimiter] = useState<string>(',');
  const [includeHeader, setIncludeHeader] = useState<boolean>(true);
  const [bom, setBom] = useState<boolean>(true);
  const [customFilename, setCustomFilename] = useState<string>(`${datasetId}.csv`);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [activePreset, setActivePreset] = useState<'standard' | 'excel' | 'custom'>('excel');

  if (!isOpen) return null;

  const handlePresetChange = (preset: 'standard' | 'excel' | 'custom') => {
    setActivePreset(preset);
    if (preset === 'excel') {
      setFormat('csv');
      setDelimiter(',');
      setIncludeHeader(true);
      setBom(true);
      setCustomFilename(`${datasetId}.csv`);
    } else if (preset === 'standard') {
      setFormat('csv');
      setDelimiter(',');
      setIncludeHeader(true);
      setBom(false);
      setCustomFilename(`${datasetId}.csv`);
    }
  };

  const handleFormatChange = (newFormat: 'csv' | 'tsv' | 'json' | 'parquet') => {
    setFormat(newFormat);
    setActivePreset('custom');
    const baseName = customFilename.replace(/\.(csv|tsv|json|parquet)$/i, '');
    setCustomFilename(`${baseName}.${newFormat}`);
    if (newFormat === 'tsv') {
      setDelimiter('\t');
    } else if (newFormat === 'csv') {
      setDelimiter(',');
    }
  };

  const handleExecuteExport = async () => {
    if (!datasetId) return;
    setIsExporting(true);

    const options: ExportDatasetOptions = {
      format,
      delimiter: format === 'csv' || format === 'tsv' ? delimiter : undefined,
      includeHeader: format === 'csv' || format === 'tsv' ? includeHeader : undefined,
      bom: format === 'csv' || format === 'tsv' ? bom : undefined,
      filename: customFilename.trim() || undefined
    };

    try {
      const savedName = await downloadDatasetExport(datasetId, options);
      toast.success(
        'Export Complete',
        `Downloaded ${savedName}${totalRows ? ` (${totalRows.toLocaleString()} rows)` : ''}`
      );
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to export dataset';
      toast.error('Export Error', msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-xl bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-[#0D9488]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-[var(--tt-text-primary)]">
                  Export Clean Dataset
                </h3>
                {isCleaned && (
                  <span className="flex items-center gap-1 text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="w-2.5 h-2.5" />
                    Clean
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--tt-text-muted)] mt-0.5">
                Export complete dataset without row limits or truncations
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* Dataset Summary Card */}
          <div className="p-3.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              <Database className="w-4 h-4 text-[#0D9488] shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--tt-text-primary)] truncate font-mono">
                  {datasetId}
                </div>
                <div className="text-[11px] text-[var(--tt-text-muted)] flex items-center gap-2 mt-0.5">
                  {totalRows !== undefined && <span>{totalRows.toLocaleString()} rows</span>}
                  {totalCols !== undefined && (
                    <>
                      <span>•</span>
                      <span>{totalCols} columns</span>
                    </>
                  )}
                  <span>•</span>
                  <span className="text-[#10B981] font-medium">100% full dataset</span>
                </div>
              </div>
            </div>
            <span className="text-[11px] px-2.5 py-1 rounded-md bg-[#0D9488]/15 text-[#0D9488] font-mono font-medium">
              DuckDB Lake
            </span>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-xs font-semibold text-[var(--tt-text-primary)] mb-2 block flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-[#0D9488]" />
              Export Presets
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handlePresetChange('excel')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'excel'
                    ? 'border-[#0D9488] bg-[#0D9488]/10 text-[var(--tt-text-primary)]'
                    : 'border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-subtle)] text-[var(--tt-text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Excel CSV</span>
                  {activePreset === 'excel' && <Check className="w-3 h-3 text-[#0D9488]" />}
                </div>
                <p className="text-[10px] text-[var(--tt-text-muted)] mt-1">
                  UTF-8 BOM + Comma. Best for Microsoft Excel & Google Sheets.
                </p>
              </button>

              <button
                type="button"
                onClick={() => handlePresetChange('standard')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'standard'
                    ? 'border-[#0D9488] bg-[#0D9488]/10 text-[var(--tt-text-primary)]'
                    : 'border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-subtle)] text-[var(--tt-text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Standard CSV</span>
                  {activePreset === 'standard' && <Check className="w-3 h-3 text-[#0D9488]" />}
                </div>
                <p className="text-[10px] text-[var(--tt-text-muted)] mt-1">
                  Pure UTF-8 without BOM. Best for Python, R, and Data Pipelines.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setActivePreset('custom')}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  activePreset === 'custom'
                    ? 'border-[#0D9488] bg-[#0D9488]/10 text-[var(--tt-text-primary)]'
                    : 'border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-subtle)] text-[var(--tt-text-secondary)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">Custom Options</span>
                  {activePreset === 'custom' && <Check className="w-3 h-3 text-[#0D9488]" />}
                </div>
                <p className="text-[10px] text-[var(--tt-text-muted)] mt-1">
                  Customize delimiter, formats, headers, or TSV / Parquet / JSON.
                </p>
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div>
            <label className="text-xs font-semibold text-[var(--tt-text-primary)] mb-2 block">
              File Format
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'csv', name: 'CSV (.csv)', desc: 'Comma separated' },
                { id: 'tsv', name: 'TSV (.tsv)', desc: 'Tab separated' },
                { id: 'json', name: 'JSON (.json)', desc: 'Record objects' },
                { id: 'parquet', name: 'Parquet (.parquet)', desc: 'Binary columnar' }
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => handleFormatChange(f.id as any)}
                  className={`p-2 rounded-xl border text-center transition-all cursor-pointer ${
                    format === f.id
                      ? 'border-[#0D9488] bg-[#0D9488]/15 text-[#0D9488] font-bold'
                      : 'border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-subtle)] text-[var(--tt-text-secondary)]'
                  }`}
                >
                  <div className="text-xs font-mono">{f.name}</div>
                  <div className="text-[10px] text-[var(--tt-text-muted)] mt-0.5">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Delimiter & CSV Options (Only for CSV/TSV) */}
          {(format === 'csv' || format === 'tsv') && (
            <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)] space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--tt-text-primary)]">
                <Settings2 className="w-3.5 h-3.5 text-[#0D9488]" />
                CSV Delimiter & Header Configuration
              </div>

              {/* Delimiter Radio / Buttons */}
              <div>
                <label className="text-[11px] text-[var(--tt-text-muted)] block mb-1.5">
                  Field Separator / Delimiter
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Comma (,)', value: ',' },
                    { label: 'Semicolon (;)', value: ';' },
                    { label: 'Tab (\\t)', value: '\t' },
                    { label: 'Pipe (|)', value: '|' }
                  ].map((d) => (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        setDelimiter(d.value);
                        setActivePreset('custom');
                      }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors cursor-pointer ${
                        delimiter === d.value
                          ? 'border-[#0D9488] bg-[#0D9488]/20 text-[#0D9488] font-bold'
                          : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-[var(--tt-text-secondary)] hover:border-[var(--tt-border-strong)]'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-2 pt-1 border-t border-[var(--tt-border-subtle)]">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[var(--tt-text-primary)]">
                  <input
                    type="checkbox"
                    checked={includeHeader}
                    onChange={(e) => {
                      setIncludeHeader(e.target.checked);
                      setActivePreset('custom');
                    }}
                    className="w-4 h-4 rounded border-[var(--tt-border-subtle)] text-[#0D9488] focus:ring-[#0D9488] cursor-pointer"
                  />
                  <span>Include column headers in the first row</span>
                </label>

                <label className="flex items-start gap-2.5 cursor-pointer text-xs text-[var(--tt-text-primary)]">
                  <input
                    type="checkbox"
                    checked={bom}
                    onChange={(e) => {
                      setBom(e.target.checked);
                      setActivePreset('custom');
                    }}
                    className="w-4 h-4 rounded border-[var(--tt-border-subtle)] text-[#0D9488] focus:ring-[#0D9488] cursor-pointer mt-0.5"
                  />
                  <div>
                    <span>Excel Compatibility (Prepend UTF-8 BOM)</span>
                    <p className="text-[10px] text-[var(--tt-text-muted)]">
                      Prevents Excel from misinterpreting international characters and accents
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Target Filename */}
          <div>
            <label className="text-xs font-semibold text-[var(--tt-text-primary)] mb-1.5 block">
              Download Filename
            </label>
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)] focus-within:border-[#0D9488] text-xs">
              <FileText className="w-4 h-4 text-[var(--tt-text-muted)] shrink-0" />
              <input
                type="text"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
                placeholder={`${datasetId}.${format}`}
                className="w-full bg-transparent outline-none font-mono text-[var(--tt-text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-[var(--tt-border-subtle)] bg-[var(--tt-bg-subtle)] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isExporting}
              onClick={handleExecuteExport}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-all shadow-[var(--tt-shadow-card)] cursor-pointer disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${isExporting ? 'animate-bounce' : ''}`} />
              <span>{isExporting ? 'Exporting full dataset...' : `Export Dataset (.${format})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
