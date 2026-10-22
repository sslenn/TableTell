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
        <h2
          className="text-xl sm:text-2xl font-bold tracking-tight"
          style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
        >
          LangGraph DAG State Machine & Telemetry
        </h2>
        <p className="text-xs sm:text-sm" style={{ color: 'var(--tt-text-muted)' }}>
          Stateful agent graph executing deterministic SQL with autonomous self-healing recovery loops.
        </p>
      </div>

      {/* Interactive DAG Pipeline Graph */}
      <div
        className="p-6 rounded-2xl border flex flex-col gap-5"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          boxShadow: 'var(--tt-shadow-card)'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-[#2DD4BF]" />
            <span className="text-xs font-bold uppercase tracking-wider font-mono text-[#2DD4BF]">
              Interactive Graph Architecture (Click node to inspect)
            </span>
          </div>
          <span className="text-[11px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
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
                className="p-3.5 rounded-xl border flex flex-col justify-between text-left transition-all cursor-pointer hover:border-[#2DD4BF] group"
                style={{
                  backgroundColor: isSelected
                    ? 'var(--tt-primary-subtle)'
                    : node.highlight
                    ? 'rgba(251, 146, 60, 0.08)'
                    : 'var(--tt-bg-elevated)',
                  borderColor: isSelected
                    ? 'var(--tt-primary)'
                    : node.highlight
                    ? 'var(--tt-accent-warm)'
                    : 'var(--tt-border-subtle)',
                  boxShadow: isSelected ? '0 0 0 1px var(--tt-primary)' : 'none'
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon
                      className={`w-4 h-4 ${
                        node.highlight ? 'text-[#FB923C]' : 'text-[#2DD4BF]'
                      }`}
                    />
                    <span
                      className="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase"
                      style={{
                        backgroundColor: node.highlight
                          ? 'rgba(251, 146, 60, 0.2)'
                          : 'var(--tt-primary-subtle)',
                        color: node.highlight ? '#FB923C' : 'var(--tt-primary)'
                      }}
                    >
                      {node.badge}
                    </span>
                  </div>

                  <h4
                    className="text-xs font-bold mb-1 leading-snug"
                    style={{ color: 'var(--tt-text-primary)' }}
                  >
                    {node.title}
                  </h4>
                  <p className="text-[11px] leading-relaxed line-clamp-3" style={{ color: 'var(--tt-text-muted)' }}>
                    {node.desc}
                  </p>
                </div>

                <div
                  className="mt-3 pt-2 border-t text-[10px] font-mono flex items-center justify-between"
                  style={{ borderColor: 'var(--tt-border-subtle)', color: 'var(--tt-text-muted)' }}
                >
                  <span>Step {i + 1}</span>
                  <span className="font-semibold">{node.latency}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Inspector Card */}
        {selectedNode && (
          <div
            className="p-4 rounded-xl border flex flex-col gap-3 animate-in fade-in"
            style={{
              backgroundColor: 'var(--tt-bg-elevated)',
              borderColor: 'var(--tt-border-subtle)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <selectedNode.icon className="w-4 h-4 text-[#2DD4BF]" />
                <span className="text-xs font-bold font-mono" style={{ color: 'var(--tt-text-primary)' }}>
                  Node Details: {selectedNode.title}
                </span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#2DD4BF]/10 text-[#2DD4BF] font-semibold">
                Role: {selectedNode.role}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-surface)' }}>
                <span className="text-[10px] opacity-60 block text-[#38BDF8]">Inputs:</span>
                <span style={{ color: 'var(--tt-text-secondary)' }}>{selectedNode.inputs}</span>
              </div>
              <div className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-surface)' }}>
                <span className="text-[10px] opacity-60 block text-[#34D399]">Outputs:</span>
                <span style={{ color: 'var(--tt-text-secondary)' }}>{selectedNode.outputs}</span>
              </div>
              <div className="p-2.5 rounded-lg border" style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-surface)' }}>
                <span className="text-[10px] opacity-60 block text-[#FB923C]">Typical Duration:</span>
                <span className="font-bold tabular-nums" style={{ color: 'var(--tt-text-primary)' }}>{selectedNode.latency}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Architectural Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          className="p-5 rounded-2xl border flex flex-col gap-2.5"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#34D399]" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--tt-text-primary)' }}>
              Zero Math Hallucination Guarantee
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--tt-text-secondary)' }}>
            Unlike generic LLM chat interfaces that guess numerical sums and regression metrics,
            TableTell delegates 100% of arithmetic calculations to DuckDB's C++ vectorized execution engine.
            The LLM acts purely as a semantic translator and SQL compiler.
          </p>
        </div>

        <div
          className="p-5 rounded-2xl border flex flex-col gap-2.5"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)',
            boxShadow: 'var(--tt-shadow-card)'
          }}
        >
          <div className="flex items-center gap-2">
            <RotateCw className="w-4 h-4 text-[#FB923C]" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--tt-text-primary)' }}>
              Cyclic Self-Healing Engine
            </h3>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--tt-text-secondary)' }}>
            If a query fails DuckDB parser or type validation, LangGraph intercepts the traceback,
            binds the error context to the LLM agent, and re-synthesizes a repaired query in real-time
            with up to 2 retry cycles.
          </p>
        </div>
      </div>
    </div>
  );
};
