import React, { useState } from 'react';
import {
  BarChart3,
  Table as TableIcon,
  Terminal,
  Copy,
  Check,
  Sparkles,
  Download,
  RotateCw,
  ArrowRight,
  Columns2,
  Clock,
  Zap
} from 'lucide-react';
import type { MessageItem } from '../../types/api';
import { ChartViewer } from './ChartViewer';
import { DataGrid } from './DataGrid';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { SqlHighlighter } from '../common/SqlHighlighter';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../store/useToastStore';

interface ChatMessageProps {
  message: MessageItem;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const setSuggestedPrompt = useAppStore((state) => state.setSuggestedPrompt);

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

  // Generate intelligent follow-up suggestions based on content
  const followUpPrompts = React.useMemo(() => {
    if (isUser) return [];
    const suggestions: string[] = [];
    const lower = (message.content + ' ' + (message.sql || '')).toLowerCase();

    if (lower.includes('category') || lower.includes('product')) {
      suggestions.push('Show monthly breakdown for the top category');
      suggestions.push('Compare average profit margin across categories');
    } else if (lower.includes('trend') || lower.includes('date') || lower.includes('time')) {
      suggestions.push('Compare this trend against the previous period');
      suggestions.push('What are the top peak days in this timeline?');
    } else if (lower.includes('customer') || lower.includes('user') || lower.includes('spend')) {
      suggestions.push('What are the top 5 spenders in this cohort?');
      suggestions.push('Show churn risk and activity recency for these accounts');
    } else {
      suggestions.push('Show percentage distribution of this metric');
      suggestions.push('Filter out outlier values and re-calculate');
    }
    return suggestions.slice(0, 2);
  }, [isUser, message.content, message.sql]);

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
    <div className="flex flex-col gap-3 mb-6 transition-all animate-in fade-in">
      {/* Unified Analytical Container */}
      <div
        className="rounded-2xl border overflow-hidden transition-all duration-200"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          boxShadow: 'var(--tt-shadow-card)'
        }}
      >
        {/* Header Bar: Status & Badges */}
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b"
          style={{
            borderColor: 'var(--tt-border-subtle)',
            backgroundColor: 'var(--tt-bg-elevated)'
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="w-6 h-6 rounded-lg flex items-center justify-center border shadow-xs"
              style={{
                backgroundColor: 'var(--tt-primary-subtle)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-primary)'
              }}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#2DD4BF]" />
            </span>
            <span
              className="text-xs font-bold tracking-tight"
              style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              TableTell Analytical Insight
            </span>

            {/* Execution Engine Badges */}
            <span
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono border"
              style={{
                backgroundColor: 'rgba(45, 212, 191, 0.08)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-primary)'
              }}
            >
              <Zap className="w-2.5 h-2.5 text-[#2DD4BF]" />
              <span>DuckDB Columnar</span>
            </span>

            {message.table?.duration_ms !== undefined && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono border"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.08)',
                  borderColor: 'rgba(56, 189, 248, 0.25)',
                  color: '#38BDF8'
                }}
              >
                <Clock className="w-2.5 h-2.5" />
                <span>{message.table.duration_ms}ms</span>
              </span>
            )}

            {message.self_healed && (
              <span
                className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-mono font-medium border"
                style={{
                  backgroundColor: 'rgba(251, 146, 60, 0.12)',
                  borderColor: 'rgba(251, 146, 60, 0.3)',
                  color: 'var(--tt-accent-warm)'
                }}
                title="LangGraph detected a query syntax or type issue and repaired it automatically"
              >
                <RotateCw className="w-2.5 h-2.5" />
                <span>Self-Healed (Auto-Repaired)</span>
              </span>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={copySummary}
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors hover:border-[#2DD4BF] border"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
              title="Copy narrative summary"
            >
              {copiedSummary ? <Check className="w-3 h-3 text-[#34D399]" /> : <Copy className="w-3 h-3" />}
              <span>{copiedSummary ? 'Copied' : 'Copy Text'}</span>
            </button>

            {hasTable && (
              <button
                type="button"
                onClick={exportCsv}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-mono cursor-pointer transition-colors hover:border-[#2DD4BF] border"
                style={{
                  backgroundColor: 'var(--tt-bg-surface)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
                title="Download query records as CSV"
              >
                <Download className="w-3 h-3 text-[#2DD4BF]" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Narrative Summary Body with Full Markdown Rendering */}
        <div className="p-4 border-b" style={{ borderColor: 'var(--tt-border-subtle)' }}>
          <MarkdownRenderer content={message.content} />
        </div>

        {/* Segmented View Switcher (Chart vs Grid vs Split vs SQL) */}
        {(hasChart || hasTable || hasSql) && (
          <div className="flex flex-col">
            <div
              className="flex flex-wrap items-center justify-between px-3 pt-2 pb-2 border-b gap-2"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)'
              }}
            >
              <div className="flex items-center gap-1 p-0.5 rounded-lg border" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                {hasChart && (
                  <button
                    type="button"
                    onClick={() => setActiveView('chart')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: activeView === 'chart' ? 'var(--tt-primary-subtle)' : 'transparent',
                      color: activeView === 'chart' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                      fontWeight: activeView === 'chart' ? 600 : 500
                    }}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    <span>Chart</span>
                  </button>
                )}

                {hasTable && (
                  <button
                    type="button"
                    onClick={() => setActiveView('grid')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: activeView === 'grid' ? 'var(--tt-primary-subtle)' : 'transparent',
                      color: activeView === 'grid' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                      fontWeight: activeView === 'grid' ? 600 : 500
                    }}
                  >
                    <TableIcon className="w-3.5 h-3.5" />
                    <span>Table</span>
                    <span
                      className="text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums opacity-80"
                      style={{ backgroundColor: 'var(--tt-bg-surface)' }}
                    >
                      {message.table?.rows?.length ?? 0}
                    </span>
                  </button>
                )}

                {canSplit && (
                  <button
                    type="button"
                    onClick={() => setActiveView('split')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: activeView === 'split' ? 'var(--tt-primary-subtle)' : 'transparent',
                      color: activeView === 'split' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                      fontWeight: activeView === 'split' ? 600 : 500
                    }}
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
                    style={{
                      backgroundColor: activeView === 'sql' ? 'var(--tt-primary-subtle)' : 'transparent',
                      color: activeView === 'sql' ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                      fontWeight: activeView === 'sql' ? 600 : 500
                    }}
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    <span>SQL Query</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                {activeView === 'chart' && 'Hover data points to inspect values'}
                {activeView === 'grid' && 'Click headers to sort · Click cells to copy'}
                {activeView === 'split' && 'Simultaneous visual + columnar analysis'}
                {activeView === 'sql' && 'Deterministic vectorized execution'}
              </div>
            </div>

            {/* Dynamic Viewport Panel */}
            <div className="p-3">
              {activeView === 'chart' && hasChart && (
                <div className="w-full">
                  <ChartViewer spec={message.plotly_spec!} />
                </div>
              )}

              {activeView === 'grid' && hasTable && (
                <div className="w-full">
                  <DataGrid tableResult={message.table!} />
                </div>
              )}

              {activeView === 'split' && canSplit && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 w-full">
                  <div className="w-full">
                    <ChartViewer spec={message.plotly_spec!} />
                  </div>
                  <div className="w-full">
                    <DataGrid tableResult={message.table!} />
                  </div>
                </div>
              )}

              {activeView === 'sql' && hasSql && (
                <div className="w-full">
                  <SqlHighlighter sql={message.sql!} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suggested Next Questions / Follow-ups */}
      {followUpPrompts.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pl-1">
          <span className="text-[11px] font-medium" style={{ color: 'var(--tt-text-muted)' }}>
            Suggested Follow-ups:
          </span>
          {followUpPrompts.map((promptText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setSuggestedPrompt(promptText)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-medium cursor-pointer transition-all hover:border-[#2DD4BF] hover:-translate-y-0.5 group"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              <span>{promptText}</span>
              <ArrowRight className="w-3 h-3 text-[#2DD4BF] group-hover:translate-x-0.5 transition-transform" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
