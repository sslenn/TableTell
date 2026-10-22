import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Hash,
  Type,
  Calendar,
  CheckSquare
} from 'lucide-react';
import type { TableResult } from '../../types/api';
import { toast } from '../../store/useToastStore';

type DataRow = Record<string, unknown>;

interface DataGridProps {
  tableResult: TableResult;
  className?: string;
}

export const DataGrid: React.FC<DataGridProps> = ({ tableResult, className = '' }) => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [copiedCell, setCopiedCell] = useState<string | null>(null);

  const copyCellValue = (val: unknown, cellId: string) => {
    if (val === null || val === undefined) return;
    const str = String(val);
    navigator.clipboard.writeText(str);
    setCopiedCell(cellId);
    toast.info('Cell Value Copied', `"${str.length > 25 ? str.substring(0, 25) + '...' : str}"`);
    setTimeout(() => setCopiedCell(null), 1500);
  };

  const columns = useMemo<ColumnDef<DataRow, unknown>[]>(() => {
    if (!tableResult.columns) return [];

    const detectColumnType = (colKey: string) => {
      const sample = tableResult.rows?.find((r) => r[colKey] !== null && r[colKey] !== undefined)?.[colKey];
      if (typeof sample === 'number') return 'number';
      if (typeof sample === 'boolean') return 'boolean';
      if (typeof sample === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(sample)) return 'date';
      }
      return 'string';
    };

    return tableResult.columns.map((colKey) => {
      const colType = detectColumnType(colKey);
      const isNum = colType === 'number';

      return {
        accessorKey: colKey,
        header: ({ column }) => {
          const isSorted = column.getIsSorted();
          return (
            <button
              type="button"
              className={`flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors hover:text-[#2DD4BF] cursor-pointer group ${
                isNum ? 'ml-auto text-right' : 'text-left'
              }`}
              onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
              title={`Click to sort by ${colKey}`}
            >
              <span className="opacity-40 group-hover:opacity-100 transition-opacity">
                {colType === 'number' && <Hash className="w-2.5 h-2.5 inline" />}
                {colType === 'string' && <Type className="w-2.5 h-2.5 inline" />}
                {colType === 'date' && <Calendar className="w-2.5 h-2.5 inline" />}
                {colType === 'boolean' && <CheckSquare className="w-2.5 h-2.5 inline" />}
              </span>
              <span>{colKey}</span>
              {isSorted === 'asc' ? (
                <ArrowUp className="w-3 h-3 text-[#2DD4BF]" />
              ) : isSorted === 'desc' ? (
                <ArrowDown className="w-3 h-3 text-[#2DD4BF]" />
              ) : (
                <ArrowUpDown className="w-3 h-3 opacity-30 group-hover:opacity-70" />
              )}
            </button>
          );
        },
        cell: (info) => {
          const val = info.getValue();
          const cellId = `${info.row.id}_${colKey}`;
          const isCopied = copiedCell === cellId;

          return (
            <div
              onClick={() => copyCellValue(val, cellId)}
              className={`text-xs px-1 py-0.5 rounded cursor-pointer transition-colors hover:bg-[#2DD4BF]/10 ${
                isNum ? 'font-mono tabular-nums text-right' : 'text-left'
              } ${isCopied ? 'text-[#34D399] font-bold' : ''}`}
              title="Click to copy cell value"
            >
              {val !== null && val !== undefined ? String(val) : <span className="opacity-40">—</span>}
            </div>
          );
        }
      };
    });
  }, [tableResult.columns, tableResult.rows, copiedCell]);

  const data = useMemo<DataRow[]>(() => (tableResult.rows as DataRow[]) || [], [tableResult.rows]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    initialState: {
      pagination: { pageSize: 8 }
    }
  });

  const exportCsv = () => {
    if (!tableResult.rows || tableResult.rows.length === 0) return;
    const headers = tableResult.columns.join(',');
    const rows = tableResult.rows.map((r) =>
      tableResult.columns.map((col) => JSON.stringify(r[col] ?? '')).join(',')
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
    toast.success('CSV Export Ready', `Exported ${tableResult.rows.length} rows`);
  };

  if (!tableResult.rows || tableResult.rows.length === 0) {
    return (
      <div
        className="p-4 rounded-xl border text-xs text-center font-mono"
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          color: 'var(--tt-text-muted)'
        }}
      >
        Query executed successfully, returning 0 records.
      </div>
    );
  }

  const filteredRowCount = table.getFilteredRowModel().rows.length;
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const startRow = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endRow = Math.min((pageIndex + 1) * pageSize, filteredRowCount);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all flex flex-col ${className}`}
      style={{
        backgroundColor: 'var(--tt-bg-surface)',
        borderColor: 'var(--tt-border-subtle)',
        boxShadow: 'var(--tt-shadow-card)'
      }}
    >
      {/* Table Action & Filter Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b"
        style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-elevated)' }}
      >
        <div className="flex items-center gap-2">
          {/* Search Input */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-subtle)',
              color: 'var(--tt-text-primary)'
            }}
          >
            <Search className="w-3 h-3 text-[#2DD4BF] opacity-70" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Filter records..."
              className="w-32 sm:w-48 bg-transparent outline-none text-xs placeholder:opacity-50"
            />
          </div>

          <span
            className="text-[11px] px-2 py-0.5 rounded-full font-mono tabular-nums font-medium"
            style={{ backgroundColor: 'var(--tt-primary-subtle)', color: 'var(--tt-primary)' }}
          >
            {filteredRowCount.toLocaleString()} {filteredRowCount === 1 ? 'row' : 'rows'}
          </span>
          {tableResult.duration_ms !== undefined && (
            <span className="text-[11px] font-mono tabular-nums opacity-75" style={{ color: 'var(--tt-text-muted)' }}>
              ({tableResult.duration_ms}ms)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Page Size Selector */}
          <div className="flex items-center gap-1 text-[11px] font-mono opacity-80">
            <span className="text-[10px] hidden sm:inline" style={{ color: 'var(--tt-text-muted)' }}>Show:</span>
            {[8, 20, 50].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => table.setPageSize(size)}
                className="px-1.5 py-0.5 rounded text-[10px] border cursor-pointer transition-colors"
                style={{
                  backgroundColor: pageSize === size ? 'var(--tt-primary-subtle)' : 'transparent',
                  borderColor: pageSize === size ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  color: pageSize === size ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                  fontWeight: pageSize === size ? 700 : 400
                }}
              >
                {size}
              </button>
            ))}
          </div>

          <button
            onClick={exportCsv}
            type="button"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer hover:border-[#2DD4BF]"
            style={{
              borderColor: 'var(--tt-border-subtle)',
              backgroundColor: 'var(--tt-bg-surface)',
              color: 'var(--tt-text-secondary)'
            }}
          >
            <Download className="w-3.5 h-3.5 text-[#2DD4BF]" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Grid Content */}
      <div className="overflow-x-auto max-h-[380px]">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b"
                style={{
                  backgroundColor: 'var(--tt-bg-sunken)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 font-mono text-xs font-semibold select-none"
                    style={{ color: 'var(--tt-text-secondary)' }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3.5 py-6 text-center text-xs font-mono"
                  style={{ color: 'var(--tt-text-muted)' }}
                >
                  No matching records found for "{globalFilter}"
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="border-b transition-colors hover:bg-[#2DD4BF]/5"
                  style={{
                    borderColor: 'var(--tt-border-subtle)',
                    backgroundColor: idx % 2 === 0 ? 'transparent' : 'var(--tt-bg-elevated)'
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-1.5"
                      style={{ color: 'var(--tt-text-primary)' }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination Bar */}
      <div
        className="flex items-center justify-between px-3.5 py-2 border-t text-xs font-mono tabular-nums"
        style={{ borderColor: 'var(--tt-border-subtle)', backgroundColor: 'var(--tt-bg-elevated)' }}
      >
        <span style={{ color: 'var(--tt-text-muted)' }}>
          Showing {startRow}–{endRow} of {filteredRowCount} records
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="p-1 rounded border disabled:opacity-30 cursor-pointer hover:border-[#2DD4BF]"
            style={{ borderColor: 'var(--tt-border-subtle)' }}
            type="button"
            title="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-1 text-[11px]" style={{ color: 'var(--tt-text-secondary)' }}>
            Page {table.getState().pagination.pageIndex + 1} of {Math.max(1, table.getPageCount())}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="p-1 rounded border disabled:opacity-30 cursor-pointer hover:border-[#2DD4BF]"
            style={{ borderColor: 'var(--tt-border-subtle)' }}
            type="button"
            title="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
