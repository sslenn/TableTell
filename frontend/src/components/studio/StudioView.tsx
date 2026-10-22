import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useChatStream } from '../../hooks/useChatStream';
import { TelemetryRail } from './TelemetryRail';
import { ChatMessage } from './ChatMessage';
import { CommandDock } from './CommandDock';
import { SchemaInspector } from './SchemaInspector';
import { fetchDatasetPreview } from '../../lib/api';
import {
  Sparkles,
  TrendingUp,
  Users,
  DollarSign,
  Layers,
  BarChart2,
  Database,
  Award
} from 'lucide-react';

export const StudioView: React.FC = () => {
  const {
    messages,
    datasetId,
    datasets,
    activeColumns,
    setActiveColumns,
    addMessage,
    clearMessages,
    setSuggestedPrompt
  } = useAppStore();

  const {
    isStreaming,
    currentStep,
    statusMessage,
    repairedSql,
    selfHealMessage,
    error,
    startStream
  } = useChatStream();

  const [isSchemaOpen, setIsSchemaOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeDatasetObj = datasets.find((d) => d.dataset_id === datasetId);

  // Auto-scroll when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Fetch columns whenever datasetId changes
  useEffect(() => {
    if (!datasetId) return;
    fetchDatasetPreview(datasetId, 1)
      .then((res) => {
        const cols = (res.columns as string[]) || [];
        setActiveColumns(cols);
      })
      .catch((err) => {
        console.warn('Could not load columns preview for dataset:', err);
      });
  }, [datasetId, setActiveColumns]);

  const handleRunQuery = async (queryText: string) => {
    addMessage({
      role: 'user',
      content: queryText
    });

    await startStream(
      {
        dataset_id: datasetId,
        query: queryText,
        max_retries: 2
      },
      (payload) => {
        addMessage({
          role: 'assistant',
          content: payload.summary,
          sql: payload.sql,
          plotly_spec: payload.plotly_spec,
          table: payload.table,
          self_healed: payload.self_healed,
          retries: payload.retries
        });
      }
    );
  };

  // Generate dynamic sample prompts tailored to the active dataset
  const dynamicPrompts = React.useMemo(() => {
    const colList = activeColumns.map((c) => c.toLowerCase());
    const idLower = datasetId.toLowerCase();

    // 1. SaaS / Churn dataset
    if (idLower.includes('churn') || colList.includes('churned') || colList.includes('plan_tier')) {
      return [
        {
          tag: 'Retention',
          title: 'Churn by Plan Tier',
          desc: 'Percentage of accounts churned by subscription tier.',
          icon: Users,
          query: 'What is the churn rate across different plan tiers? Show with a bar chart'
        },
        {
          tag: 'Revenue',
          title: 'Spend by Industry',
          desc: 'Rank industries by subscription revenue.',
          icon: DollarSign,
          query: 'Which industry generates the highest average monthly spend?'
        },
        {
          tag: 'Risk',
          title: 'Tickets vs Churn',
          desc: 'Correlate support volume with churn risk.',
          icon: TrendingUp,
          query: 'Compare average support tickets for churned vs active accounts'
        },
        {
          tag: 'Activity',
          title: 'Active Days Distribution',
          desc: 'Platform activity over the last 90 days.',
          icon: Layers,
          query: 'Show the distribution of active days over the last 90 days'
        }
      ];
    }

    // 2. Retail / E-commerce dataset
    if (
      idLower.includes('sales') ||
      idLower.includes('retail') ||
      colList.includes('product_category') ||
      colList.includes('revenue_usd')
    ) {
      return [
        {
          tag: 'Revenue',
          title: 'Revenue by Category',
          desc: 'Breakdown of sales drivers across categories.',
          icon: Layers,
          query: 'Which product category generates the highest revenue? Show with a chart'
        },
        {
          tag: 'Elasticity',
          title: 'Discount vs Volume',
          desc: 'Compare discount rates against margins and velocity.',
          icon: TrendingUp,
          query: 'Compare discount rates vs total sales volume with a scatter or bubble chart'
        },
        {
          tag: 'Fulfillment',
          title: 'Delivery Status',
          desc: 'Distribution of order fulfillment states.',
          icon: BarChart2,
          query: 'Show the distribution of orders by delivery status and calculate on-time rate'
        },
        {
          tag: 'Timeline',
          title: 'Revenue Trend',
          desc: 'Track sales momentum and date trends over time.',
          icon: DollarSign,
          query: 'Show the revenue trend over time with an interactive line chart'
        }
      ];
    }

    // 3. Fallback schema-adaptive prompts
    const catCol =
      activeColumns.find(
        (c) =>
          !c.endsWith('_id') &&
          !c.includes('date') &&
          !c.includes('time') &&
          !c.includes('pct') &&
          !c.includes('usd') &&
          !c.includes('amount')
      ) || activeColumns[1] || 'category';

    const numCol =
      activeColumns.find(
        (c) =>
          c.includes('spend') ||
          c.includes('revenue') ||
          c.includes('price') ||
          c.includes('amount') ||
          c.includes('score') ||
          c.includes('count') ||
          c.includes('total')
      ) || activeColumns[2] || 'value';

    return [
      {
        tag: 'Breakdown',
        title: `Group by ${catCol}`,
        desc: `Aggregate records and metrics by ${catCol}.`,
        icon: Layers,
        query: `Show the breakdown of records by ${catCol} and plot the top categories`
      },
      {
        tag: 'Distribution',
        title: `${numCol} Stats`,
        desc: `Summary and top values for ${numCol}.`,
        icon: TrendingUp,
        query: `Calculate the average, min, and max for ${numCol} and rank top records`
      },
      {
        tag: 'Rankings',
        title: 'Top 10 Records',
        desc: `Top records ordered by ${numCol} descending.`,
        icon: Award,
        query: `Show the top 10 rows in ${datasetId} ordered by ${numCol} descending`
      },
      {
        tag: 'Summary',
        title: 'Table Summary',
        desc: `Row counts and completeness for ${datasetId}.`,
        icon: Users,
        query: `Provide a statistical summary and total row count for table ${datasetId}`
      }
    ];
  }, [datasetId, activeColumns]);

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Primary Chat & Analysis Workspace */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden max-w-5xl mx-auto px-2">
        {/* Top Telemetry Header */}
        <TelemetryRail
          isStreaming={isStreaming}
          currentStep={currentStep}
          statusMessage={statusMessage}
          selfHealMessage={selfHealMessage}
          repairedSql={repairedSql}
        />

        {/* Error Notice */}
        {error && (
          <div
            className="p-3.5 rounded-xl border text-xs font-mono flex items-center justify-between mb-2 shrink-0 animate-in fade-in"
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderColor: 'var(--tt-error)',
              color: 'var(--tt-error)'
            }}
          >
            <span>{error}</span>
          </div>
        )}

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center max-w-3xl mx-auto">
              {/* Brand Hero Lockup */}
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3.5 bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488] shadow-[var(--tt-shadow-card)]">
                <Sparkles className="w-7 h-7 text-[#0D9488]" />
              </div>

              <h2
                className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight text-[var(--tt-text-primary)]"
                style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
              >
                Data Intelligence
              </h2>
              <p className="text-xs sm:text-sm max-w-md mb-6 leading-relaxed text-[var(--tt-text-muted)]">
                Query, analyze, and visualize your data in plain English.
              </p>

              {/* Active Dataset Overview Pill Banner */}
              {activeDatasetObj && (
                <div className="w-full p-3.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] mb-6 flex flex-wrap items-center justify-between gap-3 text-left shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex items-center justify-center text-[#0D9488]">
                      <Database className="w-4 h-4 text-[#0D9488] shrink-0" />
                    </div>
                    <div>
                      <div className="text-xs font-bold font-mono text-[var(--tt-text-primary)]">
                        {activeDatasetObj.dataset_id}
                      </div>
                      <div className="text-[11px] font-mono text-[var(--tt-text-muted)] mt-0.5">
                        {activeDatasetObj.total_rows.toLocaleString()} rows · {activeDatasetObj.total_cols} cols · {activeDatasetObj.size_kb} KB
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full border ${
                        activeDatasetObj.data_health_score >= 80
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-500 border-amber-500/30'
                      }`}
                    >
                      {activeDatasetObj.data_health_score}% Health
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsSchemaOpen(true)}
                      className="px-2.5 py-1 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-[11px] font-mono text-[#0D9488] font-semibold cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
                    >
                      Schema
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full text-left">
                {dynamicPrompts.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRunQuery(p.query)}
                      className="p-3.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-left transition-all duration-200 cursor-pointer hover:border-[#0D9488] hover:-translate-y-0.5 group shadow-[var(--tt-shadow-card)] hover:shadow-[var(--tt-shadow-hover)]"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-lg flex items-center justify-center bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488]">
                            <Icon className="w-3 h-3" />
                          </span>
                          <span className="text-xs font-semibold text-[var(--tt-text-primary)]">
                            {p.title}
                          </span>
                        </div>
                        <span className="text-[9px] font-mono uppercase px-2 py-0.5 rounded font-semibold bg-[var(--tt-bg-canvas)] text-[var(--tt-text-muted)] group-hover:bg-[#0D9488]/15 group-hover:text-[#0D9488] transition-colors border border-[var(--tt-border-subtle)]">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-xs line-clamp-2 text-[var(--tt-text-secondary)]">
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-2">
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Bottom Command Dock */}
        <div className="shrink-0 pt-2 pb-1">
          <CommandDock
            isStreaming={isStreaming}
            onSubmitQuery={handleRunQuery}
            onResetChat={clearMessages}
            onToggleSchema={() => setIsSchemaOpen(!isSchemaOpen)}
            isSchemaOpen={isSchemaOpen}
          />
        </div>
      </div>

      {/* Right Collapsible Schema Inspector Drawer */}
      <SchemaInspector
        isOpen={isSchemaOpen}
        onClose={() => setIsSchemaOpen(false)}
        onInsertColumn={(col) => setSuggestedPrompt(`Show breakdown for ${col}`)}
      />
    </div>
  );
};
