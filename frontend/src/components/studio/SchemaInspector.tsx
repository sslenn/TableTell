import React, { useState } from 'react';
import {
  Search,
  X,
  Hash,
  Type,
  Calendar,
  CheckSquare,
  Database,
  ArrowRight
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { toast } from '../../store/useToastStore';

interface SchemaInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertColumn: (col: string) => void;
}

export const SchemaInspector: React.FC<SchemaInspectorProps> = ({
  isOpen,
  onClose,
  onInsertColumn
}) => {
  const { datasetId, datasets, activeColumns } = useAppStore();
  const [columnSearch, setColumnSearch] = useState('');

  const activeDatasetObj = datasets.find((d) => d.dataset_id === datasetId);

  const filteredCols = activeColumns.filter((col) =>
    col.toLowerCase().includes(columnSearch.toLowerCase())
  );

  const getColIcon = (col: string) => {
    const lower = col.toLowerCase();
    if (lower.includes('date') || lower.includes('time') || lower.includes('year') || lower.includes('month')) {
      return <Calendar className="w-3.5 h-3.5 text-[#38BDF8]" />;
    }
    if (
      lower.includes('id') ||
      lower.includes('count') ||
      lower.includes('price') ||
      lower.includes('revenue') ||
      lower.includes('spend') ||
      lower.includes('score') ||
      lower.includes('amount') ||
      lower.includes('days') ||
      lower.includes('num') ||
      lower.includes('total')
    ) {
      return <Hash className="w-3.5 h-3.5 text-[#34D399]" />;
    }
    if (lower.includes('is_') || lower.includes('has_') || lower.includes('churn') || lower.includes('flag')) {
      return <CheckSquare className="w-3.5 h-3.5 text-[#FB923C]" />;
    }
    return <Type className="w-3.5 h-3.5 text-[#2DD4BF]" />;
  };

  if (!isOpen) return null;

  return (
    <aside
      className="w-80 shrink-0 border-l flex flex-col h-full transition-all duration-200 select-none"
      style={{
        backgroundColor: 'var(--tt-bg-surface)',
        borderColor: 'var(--tt-border-subtle)'
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-3.5 border-b"
        style={{
          backgroundColor: 'var(--tt-bg-elevated)',
          borderColor: 'var(--tt-border-subtle)'
        }}
      >
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-[#2DD4BF]" />
          <div>
            <div className="text-xs font-bold leading-tight" style={{ color: 'var(--tt-text-primary)' }}>
              Schema Inspector
            </div>
            <div className="text-[10px] font-mono opacity-70" style={{ color: 'var(--tt-text-muted)' }}>
              {datasetId}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md border text-muted opacity-60 hover:opacity-100 hover:border-[#2DD4BF] cursor-pointer transition-all"
          style={{ borderColor: 'var(--tt-border-subtle)' }}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dataset Summary Card */}
      {activeDatasetObj && (
        <div
          className="p-3 m-3 rounded-xl border flex flex-col gap-2"
          style={{
            backgroundColor: 'var(--tt-bg-elevated)',
            borderColor: 'var(--tt-border-subtle)'
          }}
        >
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span style={{ color: 'var(--tt-text-muted)' }}>Health Score</span>
            <span
              className="px-2 py-0.2 rounded-full font-bold"
              style={{
                backgroundColor:
                  activeDatasetObj.data_health_score >= 80
                    ? 'rgba(52, 211, 153, 0.15)'
                    : 'rgba(251, 146, 60, 0.15)',
                color: activeDatasetObj.data_health_score >= 80 ? '#34D399' : '#FB923C'
              }}
            >
              {activeDatasetObj.data_health_score}/100
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-mono tabular-nums pt-1 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
            <div>
              <span className="text-[10px] opacity-60 block" style={{ color: 'var(--tt-text-muted)' }}>
                Total Records
              </span>
              <span className="font-bold" style={{ color: 'var(--tt-text-primary)' }}>
                {activeDatasetObj.total_rows.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="text-[10px] opacity-60 block" style={{ color: 'var(--tt-text-muted)' }}>
                Columns
              </span>
              <span className="font-bold" style={{ color: 'var(--tt-text-primary)' }}>
                {activeDatasetObj.total_cols}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Column Search */}
      <div className="px-3 pb-2">
        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs"
          style={{
            backgroundColor: 'var(--tt-bg-elevated)',
            borderColor: 'var(--tt-border-subtle)',
            color: 'var(--tt-text-primary)'
          }}
        >
          <Search className="w-3.5 h-3.5 text-[#2DD4BF] opacity-70" />
          <input
            type="text"
            value={columnSearch}
            onChange={(e) => setColumnSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full bg-transparent outline-none text-xs"
          />
        </div>
      </div>

      {/* Column List */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1.5">
        <div className="text-[10px] font-mono uppercase tracking-wider px-1 opacity-60" style={{ color: 'var(--tt-text-muted)' }}>
          Columns ({filteredCols.length}) · Click to Insert
        </div>

        {filteredCols.length === 0 ? (
          <div className="text-center py-6 text-xs font-mono" style={{ color: 'var(--tt-text-muted)' }}>
            No matching columns
          </div>
        ) : (
          filteredCols.map((col) => (
            <button
              key={col}
              type="button"
              onClick={() => {
                onInsertColumn(col);
                toast.info('Column Inserted', `Added "${col}" to prompt`);
              }}
              className="flex items-center justify-between p-2 rounded-lg border text-left text-xs font-mono cursor-pointer transition-all hover:border-[#2DD4BF] hover:bg-[#2DD4BF]/10 group"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-primary)'
              }}
            >
              <div className="flex items-center gap-2 truncate">
                {getColIcon(col)}
                <span className="truncate font-medium">{col}</span>
              </div>
              <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 text-[#2DD4BF] transition-opacity shrink-0" />
            </button>
          ))
        )}
      </div>
    </aside>
  );
};
