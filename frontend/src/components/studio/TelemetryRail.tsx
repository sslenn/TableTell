import React from 'react';
import { Database, Cpu, CheckCircle2, RefreshCw, AlertTriangle, BarChart3 } from 'lucide-react';
import type { StreamStatusStep } from '../../types/api';

interface TelemetryRailProps {
  isStreaming: boolean;
  currentStep: StreamStatusStep | null;
  statusMessage: string;
  selfHealMessage?: string | null;
  repairedSql?: string | null;
}

export const TelemetryRail: React.FC<TelemetryRailProps> = ({
  isStreaming,
  currentStep,
  statusMessage,
  selfHealMessage,
  repairedSql
}) => {
  if (!isStreaming && !selfHealMessage && !statusMessage) {
    return (
      <div
        className="flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          color: 'var(--tt-text-muted)'
        }}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#34D399]" />
          <span className="font-medium">DuckDB · LangGraph Active</span>
        </div>
        <span className="text-[11px] font-mono tabular-nums">Sub-second latency</span>
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
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold tracking-wider uppercase"
            style={{
              backgroundColor: 'var(--tt-primary-subtle)',
              color: 'var(--tt-primary)'
            }}
          >
            ACTIVE
          </span>
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
