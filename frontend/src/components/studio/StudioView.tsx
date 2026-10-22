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
          tag: 'Retention KPI',
          title: 'Churn Rate by Plan Tier',
          desc: 'Calculate the percentage of accounts churned grouped by subscription tier.',
          icon: Users,
          query: 'What is the churn rate across different plan tiers? Show with a bar chart'
        },
        {
          tag: 'Revenue Driver',
          title: 'Monthly Spend by Industry',
          desc: 'Rank industries by total and average monthly subscription revenue.',
          icon: DollarSign,
          query: 'Which industry generates the highest average monthly spend?'
        },
        {
          tag: 'Behavioral Signal',
          title: 'Support Tickets vs Churn Risk',
          desc: 'Analyze whether accounts with high support ticket volume correlate with churn.',
          icon: TrendingUp,
          query: 'Compare average support tickets for churned vs active accounts'
        },
        {
          tag: 'Engagement',
          title: 'Active Days Distribution',
          desc: 'Inspect customer platform activity distribution over the last 90 days.',
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
          tag: 'Top Categories',
          title: 'Revenue by Product Category',
          desc: 'Rank sales drivers and percentage breakdown across product categories.',
          icon: Layers,
          query: 'Which product category generates the highest revenue? Show with a chart'
        },
        {
          tag: 'Price Elasticity',
          title: 'Discount Elasticity vs Volume',
          desc: 'Compare discount rates against margins and transaction velocity.',
          icon: TrendingUp,
          query: 'Compare discount rates vs total sales volume with a scatter or bubble chart'
        },
        {
          tag: 'Operations',
          title: 'Fulfillment & Delivery Status',
          desc: 'Audit shipment performance and distribution of order fulfillment states.',
          icon: BarChart2,
          query: 'Show the distribution of orders by delivery status and calculate on-time rate'
        },
        {
          tag: 'Timeline',
          title: 'Revenue Trajectory Over Time',
          desc: 'Track sales momentum, date trends, and seasonal velocity.',
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
        title: `Grouped by ${catCol}`,
        desc: `Aggregate records, sum metrics, and group counts by ${catCol}.`,
        icon: Layers,
        query: `Show the breakdown of records by ${catCol} and plot the top categories`
      },
      {
        tag: 'Distribution',
        title: `Average ${numCol} Analysis`,
        desc: `Calculate statistical summary and highest values for ${numCol}.`,
        icon: TrendingUp,
        query: `Calculate the average, min, and max for ${numCol} and rank top records`
      },
      {
        tag: 'Rankings',
        title: 'Top 10 Ranked Records',
        desc: 'Extract top performing entities ordered by key metrics.',
        icon: Award,
        query: `Show the top 10 rows in ${datasetId} ordered by ${numCol} descending`
      },
      {
        tag: 'Summary',
        title: 'Complete Table Summary',
        desc: 'Deterministic row counts and column completeness overview.',
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
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border shadow-md relative"
                style={{
                  backgroundColor: 'var(--tt-primary-subtle)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-primary)'
                }}
              >
                <Sparkles className="w-7 h-7 text-[#2DD4BF]" />
              </div>

              <h2
                className="text-2xl sm:text-3xl font-extrabold mb-1.5 tracking-tight"
                style={{
                  color: 'var(--tt-text-primary)',
                  fontFamily: 'Plus Jakarta Sans, sans-serif'
                }}
              >
                Autonomous Data Intelligence
              </h2>
              <p className="text-xs sm:text-sm max-w-xl mb-6 leading-relaxed" style={{ color: 'var(--tt-text-muted)' }}>
                Ask questions in plain English. TableTell synthesizes verified DuckDB SQL, eliminates
                math hallucination, self-heals syntax errors, and plots interactive visualizations.
              </p>

              {/* Active Dataset Overview Pill Banner */}
              {activeDatasetObj && (
                <div
                  className="w-full p-3.5 rounded-2xl border mb-6 flex flex-wrap items-center justify-between gap-3 text-left shadow-sm"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)'
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-[#2DD4BF] shrink-0" />
                    <div>
                      <div className="text-xs font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                        {activeDatasetObj.dataset_id}
                      </div>
                      <div className="text-[11px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
                        {activeDatasetObj.total_rows.toLocaleString()} rows · {activeDatasetObj.total_cols} columns · {activeDatasetObj.size_kb} KB
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor:
                          activeDatasetObj.data_health_score >= 80
                            ? 'rgba(52, 211, 153, 0.15)'
                            : 'rgba(251, 146, 60, 0.15)',
                        color: activeDatasetObj.data_health_score >= 80 ? '#34D399' : '#FB923C'
                      }}
                    >
                      Health: {activeDatasetObj.data_health_score}/100
                    </span>

                    <button
                      type="button"
                      onClick={() => setIsSchemaOpen(true)}
                      className="px-2.5 py-1 rounded-lg border text-[11px] font-mono cursor-pointer hover:border-[#2DD4BF] transition-all"
                      style={{
                        backgroundColor: 'var(--tt-bg-elevated)',
                        borderColor: 'var(--tt-border-subtle)',
                        color: 'var(--tt-primary)'
                      }}
                    >
                      View Schema
                    </button>
                  </div>
                </div>
              )}

              {/* Quick Prompt Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                {dynamicPrompts.map((p, idx) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleRunQuery(p.query)}
                      className="p-4 rounded-2xl border text-left transition-all duration-200 cursor-pointer hover:border-[#2DD4BF] hover:-translate-y-0.5 group shadow-xs hover:shadow-lg"
                      style={{
                        backgroundColor: 'var(--tt-bg-surface)',
                        borderColor: 'var(--tt-border-subtle)'
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center border"
                            style={{
                              backgroundColor: 'var(--tt-primary-subtle)',
                              borderColor: 'var(--tt-border-subtle)'
                            }}
                          >
                            <Icon className="w-3.5 h-3.5 text-[#2DD4BF]" />
                          </span>
                          <span className="text-xs font-bold" style={{ color: 'var(--tt-text-primary)' }}>
                            {p.title}
                          </span>
                        </div>
                        <span
                          className="text-[9px] font-mono uppercase px-1.5 py-0.2 rounded font-semibold opacity-70 group-hover:opacity-100"
                          style={{
                            backgroundColor: 'var(--tt-bg-elevated)',
                            color: 'var(--tt-primary)'
                          }}
                        >
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: 'var(--tt-text-secondary)' }}>
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
