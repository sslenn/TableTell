import React, { useState } from 'react';
import { Copy, Check, Terminal } from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface SqlHighlighterProps {
  sql: string;
  className?: string;
  showLineNumbers?: boolean;
}

const SQL_KEYWORDS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET',
  'JOIN', 'LEFT', 'RIGHT', 'INNER', 'OUTER', 'FULL', 'CROSS', 'ON', 'AS', 'AND',
  'OR', 'NOT', 'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'CASE', 'WHEN',
  'THEN', 'ELSE', 'END', 'OVER', 'PARTITION', 'DESC', 'ASC', 'UNION', 'ALL',
  'WITH', 'DISTINCT', 'FILTER', 'WINDOW', 'QUALIFY', 'INTERVAL', 'TRUE', 'FALSE'
]);

const SQL_FUNCTIONS = new Set([
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'ROUND', 'COALESCE', 'DATE_TRUNC', 'EXTRACT',
  'CAST', 'STRFTIME', 'CONCAT', 'ROW_NUMBER', 'DENSE_RANK', 'RANK', 'LAG', 'LEAD',
  'FIRST_VALUE', 'LAST_VALUE', 'NTILE', 'MEDIAN', 'STDDEV', 'VARIANCE', 'ABS',
  'CEIL', 'FLOOR', 'POWER', 'SQRT', 'UPPER', 'LOWER', 'TRIM', 'REPLACE', 'SUBSTRING'
]);

export const SqlHighlighter: React.FC<SqlHighlighterProps> = ({
  sql,
  className = '',
  showLineNumbers = true
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    toast.success('SQL Query Copied', 'Ready to paste into DuckDB CLI or DBeaver');
    setTimeout(() => setCopied(false), 2000);
  };

  // Tokenize and format line by line
  const lines = sql.trim().split('\n');

  const highlightLine = (line: string): React.ReactNode[] => {
    // Check comment
    const commentIdx = line.indexOf('--');
    if (commentIdx !== -1) {
      const codePart = line.substring(0, commentIdx);
      const commentPart = line.substring(commentIdx);
      return [
        ...tokenizeCode(codePart),
        <span key="comment" className="text-stone-500 italic dark:text-stone-400">
          {commentPart}
        </span>
      ];
    }
    return tokenizeCode(line);
  };

  const tokenizeCode = (code: string): React.ReactNode[] => {
    // Regex for tokens: strings, words, numbers, punctuation
    const regex = /('([^'\\]|\\.)*'|"([^"\\]|\\.)*"|\b\d+(\.\d+)?\b|\b[a-zA-Z_][a-zA-Z0-9_]*\b|[(),;=<>!+\-*/])/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(code)) !== null) {
      // Add whitespace before token
      if (match.index > lastIndex) {
        elements.push(code.substring(lastIndex, match.index));
      }

      const token = match[0];
      const upper = token.toUpperCase();

      if (token.startsWith("'") || token.startsWith('"')) {
        // String literal
        elements.push(
          <span key={match.index} className="text-[#34D399] font-medium">
            {token}
          </span>
        );
      } else if (!isNaN(Number(token))) {
        // Number
        elements.push(
          <span key={match.index} className="text-[#FB923C] font-mono tabular-nums">
            {token}
          </span>
        );
      } else if (SQL_KEYWORDS.has(upper)) {
        // Keyword
        elements.push(
          <span key={match.index} className="text-[#2DD4BF] font-bold">
            {token}
          </span>
        );
      } else if (SQL_FUNCTIONS.has(upper)) {
        // Function
        elements.push(
          <span key={match.index} className="text-[#38BDF8] font-semibold">
            {token}
          </span>
        );
      } else {
        // Identifier / Column / Table
        elements.push(
          <span key={match.index} className="text-[#F0FDFA] opacity-90">
            {token}
          </span>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < code.length) {
      elements.push(code.substring(lastIndex));
    }

    return elements;
  };

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${className}`}
      style={{
        backgroundColor: 'var(--tt-bg-sunken)',
        borderColor: 'var(--tt-border-subtle)'
      }}
    >
      {/* Code Header Bar */}
      <div
        className="flex items-center justify-between px-3.5 py-1.5 border-b text-[11px] font-mono select-none"
        style={{
          backgroundColor: 'var(--tt-bg-elevated)',
          borderColor: 'var(--tt-border-subtle)'
        }}
      >
        <div className="flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-[#2DD4BF]" />
          <span className="font-semibold text-[#2DD4BF]">DuckDB SQL</span>
          <span className="text-[10px] opacity-60 ml-1">
            ({lines.length} {lines.length === 1 ? 'line' : 'lines'})
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border cursor-pointer transition-colors hover:border-[#2DD4BF]"
            style={{
              backgroundColor: 'var(--tt-bg-surface)',
              borderColor: 'var(--tt-border-subtle)',
              color: 'var(--tt-text-secondary)'
            }}
          >
            {copied ? (
              <Check className="w-3 h-3 text-[#34D399]" />
            ) : (
              <Copy className="w-3 h-3 text-[#2DD4BF]" />
            )}
            <span>{copied ? 'Copied' : 'Copy SQL'}</span>
          </button>
        </div>
      </div>

      {/* Code Lines View */}
      <div className="p-3 overflow-x-auto text-xs font-mono leading-relaxed">
        <table className="border-collapse w-full">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-white/5 transition-colors">
                {showLineNumbers && (
                  <td
                    className="select-none pr-3 text-right opacity-30 font-mono text-[11px] tabular-nums align-top w-6"
                    style={{ color: 'var(--tt-text-muted)' }}
                  >
                    {idx + 1}
                  </td>
                )}
                <td className="whitespace-pre font-mono align-top">
                  {highlightLine(line)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
