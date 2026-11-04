import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Table as TableIcon,
  Terminal,
  Copy,
  Check,
  Download,
  RotateCw,
  Maximize2,
  Columns2
} from 'lucide-react';
import type { MessageItem } from '../../types/api';
import { ChartViewer, type ChartViewerHandle } from './ChartViewer';
import { DataGrid } from './DataGrid';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { SqlHighlighter } from '../common/SqlHighlighter';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../store/useToastStore';

interface ChatMessageProps {
  message: MessageItem;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const setSuggestedPrompt = useAppStore((state) => state.setSuggestedPrompt);
  const chartRef = useRef<ChartViewerHandle>(null);

  const hasChart = Boolean(message.plotly_spec && Object.keys(message.plotly_spec).length > 0);
  const hasTable = Boolean(message.table && message.table.rows && message.table.rows.length > 0);
  const hasSql = Boolean(message.sql);

  // If both chart and table exist, allow split view
  const canSplit = hasChart && hasTable;

  const initialTab: 'chart' | 'grid' | 'split' | 'sql' = canSplit
    ? 'chart'
    : hasChart
    ? 'chart'
    : hasTable
    ? 'grid'
    : hasSql
    ? 'sql'
    : 'chart';

  const [activeView, setActiveView] = useState<'chart' | 'grid' | 'split' | 'sql'>(initialTab);
  const [copiedSummary, setCopiedSummary] = useState(false);

  const copySummary = () => {
    if (!message.content) return;
    navigator.clipboard.writeText(message.content);
    setCopiedSummary(true);
    toast.success('Narrative Summary Copied', 'Markdown text saved to clipboard');
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const exportCsv = () => {
    if (!message.table?.rows || message.table.rows.length === 0) return;
    const headers = message.table.columns.join(',');
    const rows = message.table.rows.map((r) =>
      message.table!.columns.map((col) => JSON.stringify(r[col] ?? '')).join(',')
    );
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tabletell_query_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('CSV Export Downloaded', `Exported ${message.table.rows.length} rows`);
  };

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 group animate-in fade-in">
        <div
          className="max-w-[80%] rounded-2xl px-4 py-3 text-sm font-medium border shadow-xs transition-all leading-relaxed"
          style={{
            backgroundColor: 'var(--tt-bg-elevated)',
            borderColor: 'var(--tt-border-strong)',
            color: 'var(--tt-text-primary)'
          }}
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 mb-5 transition-all animate-in fade-in">
      {/* Unified Analytical Card (S3: Single Merged Header Bar + High-Contrast Canvas) */}
      <div
        className="rounded-2xl border overflow-hidden transition-all duration-200 shadow-xl"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)'
        }}
      >
        {(hasChart || hasTable || hasSql) ? (
          <div className="flex flex-col">
            {/* Single Unified View Switcher + Merged Chart/Table Actions Bar */}
            <div
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)'
              }}
            >
              {/* Left: Segmented View Tabs */}
              <div
                className="flex items-center gap-1 p-1 rounded-xl border"
                style={{
                  backgroundColor: 'var(--tt-bg-canvas)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                {hasChart && (
                  <button
                    type="button"
                    onClick={() => setActiveView('chart')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                      activeView === 'chart'
                        ? 'bg-[#2DD4BF]/15 text-[#0D9488] dark:text-[#2DD4BF] border-[#2DD4BF]/30 font-semibold'
                        : 'border-transparent text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)] font-medium'
                    }`}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Chart</span>
                  </button>
                )}

                {hasTable && (
                  <button
                    type="button"
                    onClick={() => setActiveView('grid')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                      activeView === 'grid'
                        ? 'bg-[#2DD4BF]/15 text-[#0D9488] dark:text-[#2DD4BF] border-[#2DD4BF]/30 font-semibold'
                        : 'border-transparent text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)] font-medium'
                    }`}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table</span>
                    <span className="font-mono text-xs opacity-75 ml-0.5 tabular-nums">
                      {message.table?.rows?.length ?? 0}
                    </span>
                  </button>
                )}

                {canSplit && (
                  <button
                    type="button"
                    onClick={() => setActiveView('split')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                      activeView === 'split'
                        ? 'bg-[#2DD4BF]/15 text-[#0D9488] dark:text-[#2DD4BF] border-[#2DD4BF]/30 font-semibold'
                        : 'border-transparent text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)] font-medium'
                    }`}
                    title="View Chart and Data Table side-by-side"
                  >
                    <Columns2 className="w-3.5 h-3.5" />
                    <span>Split Canvas</span>
                  </button>
                )}

                {hasSql && (
                  <button
                    type="button"
                    onClick={() => setActiveView('sql')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer border ${
                      activeView === 'sql'
                        ? 'bg-[#2DD4BF]/15 text-[#0D9488] dark:text-[#2DD4BF] border-[#2DD4BF]/30 font-semibold'
                        : 'border-transparent text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)] font-medium'
                    }`}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>SQL Query</span>
                  </button>
                )}
              </div>

              {/* Right: Merged Receipt Pill + Action Controls */}
              <div className="flex flex-wrap items-center gap-2">
                {message.self_healed && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-md font-mono font-medium border"
                    style={{
                      backgroundColor: 'rgba(251, 146, 60, 0.12)',
                      borderColor: 'rgba(251, 146, 60, 0.3)',
                      color: 'var(--tt-accent-warm)'
                    }}
                    title="LangGraph detected a query syntax or type issue and repaired it automatically"
                  >
                    <RotateCw className="w-3 h-3" />
                    <span>Self-Healed</span>
                  </span>
                )}

                <span className="font-mono text-xs text-emerald-600 dark:text-[#34D399] bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-md">
                  ✓ {message.table?.duration_ms !== undefined ? `${message.table.duration_ms}ms · ` : ''}DuckDB
                </span>

                {(activeView === 'chart' || activeView === 'split') && hasChart && (
                  <>
                    <button
                      type="button"
                      onClick={() => chartRef.current?.resetZoom()}
                      title="Reset axis zoom"
                      className="px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors hover:border-[#2DD4BF]"
                      style={{
                        backgroundColor: 'var(--tt-bg-canvas)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                    >
                      ↺ Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => chartRef.current?.downloadPng()}
                      title="Export high-res PNG"
                      className="px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors hover:border-[#2DD4BF]"
                      style={{
                        backgroundColor: 'var(--tt-bg-canvas)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                    >
                      ↓ PNG
                    </button>
                    <button
                      type="button"
                      onClick={() => chartRef.current?.openFullscreen()}
                      title="Expand to Fullscreen"
                      className="px-2.5 py-1 rounded-lg border text-xs cursor-pointer transition-colors hover:border-[#2DD4BF] inline-flex items-center gap-1"
                      style={{
                        backgroundColor: 'var(--tt-bg-canvas)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-text-secondary)'
                      }}
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>Expand</span>
                    </button>
                  </>
                )}

                {activeView === 'grid' && hasTable && (
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors hover:border-[#2DD4BF] border"
                    style={{
                      backgroundColor: 'var(--tt-bg-canvas)',
                      borderColor: 'var(--tt-border-subtle)',
                      color: 'var(--tt-text-secondary)'
                    }}
                    title="Download query records as CSV"
                  >
                    <Download className="w-3 h-3 text-[#2DD4BF]" />
                    <span>Export CSV</span>
                  </button>
                )}

                {activeView === 'sql' && message.content && (
                  <button
                    type="button"
                    onClick={copySummary}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono cursor-pointer transition-colors hover:border-[#2DD4BF] border"
                    style={{
                      backgroundColor: 'var(--tt-bg-canvas)',
                      borderColor: 'var(--tt-border-subtle)',
                      color: 'var(--tt-text-secondary)'
                    }}
                    title="Copy narrative summary"
                  >
                    {copiedSummary ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Dynamic Viewport Panel */}
            <div className="p-5 bg-[#F8FAFC] dark:bg-[#0E141B]">
              {activeView === 'chart' && hasChart && (
                <div className="w-full">
                  <ErrorBoundary
                    compact
                    fallbackTitle="Chart could not be rendered"
                    fallbackMessage="The visualization spec produced unexpected coordinates. You can review the raw SQL or Table tab."
                  >
                    <ChartViewer
                      ref={chartRef}
                      spec={message.plotly_spec!}
                      summary={message.content}
                      embedded
                    />
                  </ErrorBoundary>
                </div>
              )}

              {activeView === 'grid' && hasTable && (
                <div className="w-full space-y-3">
                  {message.content && (
                    <div className="pb-2 border-b border-[var(--tt-border-subtle)]">
                      <MarkdownRenderer content={message.content} />
                    </div>
                  )}
                  <DataGrid tableResult={message.table!} />
                </div>
              )}

              {activeView === 'split' && canSplit && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                  <div className="w-full">
                    <ErrorBoundary
                      compact
                      fallbackTitle="Chart could not be rendered"
                      fallbackMessage="The visualization spec produced unexpected coordinates. You can review the raw SQL or Table tab."
                    >
                      <ChartViewer
                        ref={chartRef}
                        spec={message.plotly_spec!}
                        summary={message.content}
                        embedded
                      />
                    </ErrorBoundary>
                  </div>
                  <div className="w-full">
                    <DataGrid tableResult={message.table!} />
                  </div>
                </div>
              )}

              {activeView === 'sql' && hasSql && (
                <div className="w-full space-y-3">
                  {message.content && (
                    <div className="pb-2 border-b border-[var(--tt-border-subtle)]">
                      <MarkdownRenderer content={message.content} />
                    </div>
                  )}
                  <SqlHighlighter sql={message.sql!} />
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Fallback for pure text messages without chart/table/sql */
          <div className="p-4">
            <MarkdownRenderer content={message.content} />
          </div>
        )}
      </div>

      {/* S4: High-Contrast NEXT DRILLDOWN Row */}
      {!isUser && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span
            className="text-xs font-mono font-semibold flex items-center gap-1.5 mr-1"
            style={{ color: 'var(--tt-text-secondary)' }}
          >
            <span className="w-2 h-2 rounded-full bg-[#2DD4BF]" />
            NEXT DRILLDOWN:
          </span>
          <button
            type="button"
            onClick={() =>
              setSuggestedPrompt(
                'Decompose key growth drivers and calculate Pareto concentration for the top metric in this result'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#2DD4BF]/40 bg-[#2DD4BF]/12 text-[#0D9488] dark:text-[#5EEAD4] hover:bg-[#2DD4BF]/20 transition-colors cursor-pointer"
            title="Run automated root-cause driver decomposition"
          >
            <span>⊕</span>
            <span>Analyze Drivers (Why?)</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setSuggestedPrompt(
                'Compute Pareto 80/20 concentration and cumulative share percentage for this metric'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:border-[#2DD4BF] text-[var(--tt-text-primary)] transition-colors cursor-pointer"
            title="Compute cumulative distribution & 80/20 concentration"
          >
            <span>◪</span>
            <span>Pareto 80/20</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setSuggestedPrompt('Calculate percentage variance and spread relative to the group mean')
            }
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:border-[#2DD4BF] text-[var(--tt-text-primary)] transition-colors cursor-pointer"
            title="Calculate group variance and delta vs mean"
          >
            <span>∿</span>
            <span>Variance &amp; Delta</span>
          </button>
        </div>
      )}
    </div>
  );
};
