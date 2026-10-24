import React from 'react';
import { Database, Cpu, CheckCircle2, RefreshCw, AlertTriangle, BarChart3, Table, Square } from 'lucide-react';
import type { StreamStatusStep } from '../../types/api';
import { useAppStore } from '../../store/useAppStore';

interface TelemetryRailProps {
  isStreaming: boolean;
  currentStep: StreamStatusStep | null;
  statusMessage: string;
  selfHealMessage?: string | null;
  repairedSql?: string | null;
  onCancelQuery?: () => void;
  onToggleSchema?: () => void;
  isSchemaOpen?: boolean;
}

export const TelemetryRail: React.FC<TelemetryRailProps> = ({
  isStreaming,
  currentStep,
  statusMessage,
  selfHealMessage,
  repairedSql,
  onCancelQuery,
  onToggleSchema,
  isSchemaOpen
}) => {
  const { datasetId, datasets, activeColumns } = useAppStore();
  const activeDataset = datasets.find((d) => d.dataset_id === datasetId);

  if (!isStreaming && !selfHealMessage && !statusMessage) {
    return (
      <div
        className="flex items-center justify-between px-3.5 py-2 rounded-xl border text-xs mb-2 transition-all shadow-[var(--tt-shadow-card)]"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          color: 'var(--tt-text-secondary)'
        }}
      >
        {/* Left: Active Dataset & Metrics */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 font-semibold shrink-0" style={{ color: 'var(--tt-text-primary)' }}>
            <Database className="w-3.5 h-3.5 text-[#0D9488]" />
            <span className="font-mono truncate max-w-[160px] sm:max-w-[220px]" title={datasetId}>
              {datasetId || 'No dataset selected'}
            </span>
          </div>

          {activeDataset && (
            <>
              <span className="text-[var(--tt-border-strong)] opacity-40">•</span>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--tt-text-muted)] shrink-0">
                <span>{activeDataset.total_rows.toLocaleString()} rows</span>
                <span>•</span>
                <span>{activeDataset.total_cols || activeColumns.length} cols</span>

                {activeDataset.data_health_score !== undefined && (
                  <span
                    className="px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide"
                    style={{
                      backgroundColor:
                        activeDataset.data_health_score >= 80
                          ? 'rgba(16, 185, 129, 0.12)'
                          : activeDataset.data_health_score >= 50
                          ? 'rgba(245, 158, 11, 0.12)'
                          : 'rgba(239, 68, 68, 0.12)',
                      color:
                        activeDataset.data_health_score >= 80
                          ? '#10B981'
                          : activeDataset.data_health_score >= 50
                          ? '#F59E0B'
                          : '#EF4444'
                    }}
                    title={`Data health score: ${Math.round(activeDataset.data_health_score)}%`}
                  >
                    {Math.round(activeDataset.data_health_score)}% Health
                  </span>
                )}
              </div>
            </>
          )}

          {!activeDataset && activeColumns.length > 0 && (
            <>
              <span className="text-[var(--tt-border-strong)] opacity-40">•</span>
              <span className="text-[11px] font-mono text-[var(--tt-text-muted)]">
                {activeColumns.length} columns active
              </span>
            </>
          )}
        </div>

        {/* Right: Actions & DuckDB Lake Status */}
        <div className="flex items-center gap-3 shrink-0">
          {onToggleSchema && (
            <button
              type="button"
              onClick={onToggleSchema}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium transition-all cursor-pointer ${
                isSchemaOpen
                  ? 'border-[#0D9488] text-[#0D9488] bg-[#0D9488]/10'
                  : 'border-[var(--tt-border-subtle)] text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)]'
              }`}
              title="Inspect Schema & Column Statistics"
            >
              <Table className="w-3 h-3 text-[#0D9488]" />
              <span>Schema</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 text-[11px] font-medium">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-mono text-[var(--tt-text-muted)]">DuckDB Ready</span>
          </div>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 'planning', label: 'Plan & Schema', icon: Cpu },
    { id: 'generating_sql', label: 'Formulate SQL', icon: Database },
    { id: 'executing', label: 'DuckDB Engine', icon: CheckCircle2 },
    { id: 'visualize', label: 'Plotly Render', icon: BarChart3 }
  ];

  return (
    <div
      className="p-3.5 rounded-xl border flex flex-col gap-2.5 transition-all duration-300"
      style={{
        backgroundColor: 'var(--tt-bg-surface)',
        borderColor: currentStep === 'self_healing' ? 'var(--tt-accent-warm)' : 'var(--tt-border-strong)',
        boxShadow: 'var(--tt-shadow-card)'
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw
            className={`w-3.5 h-3.5 ${isStreaming ? 'animate-spin text-[#2DD4BF]' : 'text-[#34D399]'}`}
          />
          <span className="text-xs font-semibold" style={{ color: 'var(--tt-text-primary)' }}>
            LangGraph Execution Pipeline
          </span>
        </div>
        {isStreaming && (
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase"
              style={{
                backgroundColor: 'var(--tt-primary-subtle)',
                color: 'var(--tt-primary)'
              }}
            >
              ACTIVE
            </span>
            {onCancelQuery && (
              <button
                type="button"
                onClick={onCancelQuery}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Cancel ongoing query execution"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Cancel</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Pipeline Node Indicators */}
      <div className="flex items-center gap-2 overflow-x-auto py-1">
        {steps.map((st, i) => {
          const Icon = st.icon;
          const isActive = currentStep === st.id;
          const isDone = !isStreaming || (currentStep !== 'planning' && i === 0);

          return (
            <React.Fragment key={st.id}>
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all"
                style={{
                  backgroundColor: isActive
                    ? 'var(--tt-primary-subtle)'
                    : 'var(--tt-bg-elevated)',
                  borderColor: isActive ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  borderWidth: 1,
                  color: isActive ? 'var(--tt-primary)' : isDone ? 'var(--tt-text-secondary)' : 'var(--tt-text-muted)'
                }}
              >
                <Icon className="w-3 h-3" />
                <span>{st.label}</span>
              </div>
              {i < steps.length - 1 && (
                <span className="text-xs text-muted" style={{ color: 'var(--tt-border-strong)' }}>
                  →
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Live Status Description */}
      {statusMessage && (
        <div className="text-xs font-mono" style={{ color: 'var(--tt-text-secondary)' }}>
          {statusMessage}
        </div>
      )}

      {/* Self-Healing Alert Notice */}
      {selfHealMessage && (
        <div
          className="flex items-start gap-2 p-2 rounded-lg text-xs"
          style={{
            backgroundColor: 'rgba(251, 146, 60, 0.1)',
            borderColor: 'var(--tt-accent-warm)',
            borderWidth: 1,
            color: 'var(--tt-accent-warm)'
          }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Self-Healing DAG Recovery Loop</span>
            <span className="text-[11px] opacity-90">{selfHealMessage}</span>
            {repairedSql && (
              <pre
                className="p-1.5 rounded text-[10px] font-mono overflow-x-auto mt-1"
                style={{ backgroundColor: 'var(--tt-bg-sunken)' }}
              >
                {repairedSql}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
