import React, { useState } from 'react';
import {
  GitBranch,
  Shield,
  Zap,
  CheckCircle2,
  RotateCw,
  Terminal,
  Layers
} from 'lucide-react';

export const TelemetryView: React.FC = () => {
  const [selectedNodeId, setSelectedNodeId] = useState<string>('self_heal');

  const dagNodes = [
    {
      id: 'plan',
      title: 'Planning & Digest',
      desc: 'Extracts schema metadata, column vector types, and sample data from DuckDB data lake.',
      badge: 'Node 1',
      icon: Layers,
      role: 'Metadata Introspection',
      inputs: 'dataset_id, user natural language prompt',
      outputs: 'vector types, schema dict, analytical plan',
      latency: '~25ms'
    },
    {
      id: 'generate_sql',
      title: 'Deterministic SQL Synthesis',
      desc: 'Translates natural language questions into strict DuckDB SQL. Zero math hallucination.',
      badge: 'Node 2',
      icon: Terminal,
      role: 'SQL Compiler',
      inputs: 'schema metadata, analytical intent',
      outputs: 'executable DuckDB SQL string',
      latency: '~350ms'
    },
    {
      id: 'execute_sql',
      title: 'DuckDB Engine Execution',
      desc: 'Executes query sub-second against local compressed Parquet columnar tables.',
      badge: 'Node 3',
      icon: Zap,
      role: 'Vectorized Engine',
      inputs: 'SQL query',
      outputs: 'columnar Arrow record batches, execution latency',
      latency: '~8ms'
    },
    {
      id: 'self_heal',
      title: 'Autonomous Error Healing',
      desc: 'Intercepts syntax and runtime errors, inspects tracebacks, and self-repairs up to 2 retries.',
      badge: 'Conditional Branch',
      icon: RotateCw,
      highlight: true,
      role: 'Self-Correction Agent',
      inputs: 'error traceback, failed SQL, schema metadata',
      outputs: 'corrected SQL query or fallback',
      latency: '~420ms (when triggered)'
    },
    {
      id: 'visualize',
      title: 'Plotly Spec Synthesis',
      desc: 'Formats statistical charts and builds publication-ready interactive visualizations.',
      badge: 'Node 4',
      icon: CheckCircle2,
      role: 'Visual Synthesis',
      inputs: 'query result table, analytical intent',
      outputs: 'Plotly.js JSON specification',
      latency: '~280ms'
    }
  ];

  const selectedNode = dagNodes.find((n) => n.id === selectedNodeId) || dagNodes[3];

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto pb-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-tight text-[var(--tt-text-primary)]"
          style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          LangGraph DAG State Machine & Telemetry
        </h1>
        <p className="text-xs sm:text-sm text-[var(--tt-text-muted)] mt-1">
          Stateful agent graph executing deterministic SQL with autonomous self-healing recovery loops.
        </p>
      </div>

      {/* Interactive DAG Pipeline Graph */}
      <div className="p-6 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)] flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#0D9488]" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D9488]">
              Interactive Graph Architecture (Click node to inspect)
            </span>
          </div>
          <span className="text-[11px] text-[var(--tt-text-muted)]">
            Cyclic Error Recovery Topology
          </span>
        </div>

        {/* Nodes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {dagNodes.map((node, i) => {
            const Icon = node.icon;
            const isSelected = node.id === selectedNodeId;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => setSelectedNodeId(node.id)}
                className={`p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer shadow-[var(--tt-shadow-card)] ${
                  isSelected
                    ? 'bg-[#0D9488]/15 border-[#0D9488] ring-1 ring-[#0D9488]'
                    : node.highlight
                    ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/60'
                    : 'bg-[var(--tt-bg-surface)] border-[var(--tt-border-subtle)] hover:border-[#0D9488]'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon
                      className={`w-4 h-4 ${
                        node.highlight ? 'text-amber-500' : 'text-[#0D9488]'
                      }`}
                    />
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        node.highlight
                          ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                          : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {node.badge}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold mb-1 leading-snug text-[var(--tt-text-primary)]">
                    {node.title}
                  </h4>
                  <p className="text-[11px] leading-relaxed line-clamp-3 text-[var(--tt-text-muted)]">
                    {node.desc}
                  </p>
                </div>

                <div className="mt-3 pt-2 border-t border-[var(--tt-border-subtle)] text-[10px] font-mono flex items-center justify-between text-[var(--tt-text-muted)]">
                  <span>Step {i + 1}</span>
                  <span className="font-semibold text-[var(--tt-text-secondary)]">{node.latency}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Inspector Card */}
        {selectedNode && (
          <div className="p-4 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <selectedNode.icon className="w-4 h-4 text-[#0D9488]" />
                <span className="text-xs font-bold text-[var(--tt-text-primary)]">
                  Node Details: {selectedNode.title}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
                Role: {selectedNode.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-3 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)]">
                <span className="text-[10px] text-[#0284C7] block font-semibold">Inputs:</span>
                <span className="text-[var(--tt-text-secondary)] text-[11px] mt-0.5 block">{selectedNode.inputs}</span>
              </div>
              <div className="p-3 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)]">
                <span className="text-[10px] text-[#10B981] block font-semibold">Outputs:</span>
                <span className="text-[var(--tt-text-secondary)] text-[11px] mt-0.5 block">{selectedNode.outputs}</span>
              </div>
              <div className="p-3 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-card)]">
                <span className="text-[10px] text-amber-500 block font-semibold">Typical Duration:</span>
                <span className="font-bold tabular-nums text-[var(--tt-text-primary)] text-[11px] mt-0.5 block">{selectedNode.latency}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Architectural Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex flex-col gap-2.5 shadow-[var(--tt-shadow-card)]">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#10B981]" />
            <h3 className="text-sm font-bold text-[var(--tt-text-primary)]">
              Zero Math Hallucination Guarantee
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-[var(--tt-text-muted)]">
            Unlike generic LLM chat interfaces that guess numerical sums and regression metrics,
            TableTell delegates 100% of arithmetic calculations to DuckDB's C++ vectorized execution engine.
            The LLM acts purely as a semantic translator and SQL compiler.
          </p>
        </div>

        <div className="p-5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex flex-col gap-2.5 shadow-[var(--tt-shadow-card)]">
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-[var(--tt-text-primary)]">
              Cyclic Self-Healing Engine
            </h3>
          </div>
          <p className="text-xs leading-relaxed text-[var(--tt-text-muted)]">
            If a query fails DuckDB parser or type validation, LangGraph intercepts the traceback,
            binds the error context to the LLM agent, and re-synthesizes a repaired query in real-time
            with up to 2 retry cycles.
          </p>
        </div>
      </div>
    </div>
  );
};
