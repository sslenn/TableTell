import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = '' }) => {
  return (
    <div className={`prose-nordic text-sm leading-relaxed break-words [overflow-wrap:anywhere] min-w-0 max-w-full overflow-hidden ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1
              className="text-base sm:text-lg font-bold tracking-tight mt-3 mb-2 pl-3 border-l-2 border-[#2DD4BF] break-words [overflow-wrap:anywhere] whitespace-normal leading-snug min-w-0 max-w-full"
              style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              className="text-sm sm:text-base font-bold tracking-tight mt-3 mb-1.5 pl-2.5 border-l-2 border-[#2DD4BF]/70 break-words [overflow-wrap:anywhere] whitespace-normal leading-snug min-w-0 max-w-full"
              style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              className="text-xs sm:text-sm font-bold tracking-tight mt-2.5 mb-1 text-[#2DD4BF] font-mono uppercase break-words [overflow-wrap:anywhere] whitespace-normal leading-snug min-w-0 max-w-full"
            >
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-2 leading-relaxed break-words [overflow-wrap:anywhere] min-w-0 max-w-full" style={{ color: 'var(--tt-text-primary)' }}>
              {children}
            </p>
          ),
          hr: () => (
            <hr className="my-2.5 border-0 border-t border-[var(--tt-border-subtle)] w-full" />
          ),
          ul: ({ children }) => (
            <ul className="my-2 space-y-1.5 pl-4 list-disc marker:text-[#2DD4BF] min-w-0 max-w-full">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 space-y-1.5 pl-4 list-decimal marker:text-[#2DD4BF] font-mono text-xs min-w-0 max-w-full">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-xs sm:text-sm pl-1 break-words [overflow-wrap:anywhere] leading-relaxed min-w-0 max-w-full" style={{ color: 'var(--tt-text-secondary)' }}>
              {children}
            </li>
          ),
          strong: ({ children }) => (
            <strong
              className="font-bold tracking-wide break-words [overflow-wrap:anywhere]"
              style={{ color: 'var(--tt-text-primary)' }}
            >
              {children}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic opacity-90 break-words [overflow-wrap:anywhere]" style={{ color: 'var(--tt-text-secondary)' }}>
              {children}
            </em>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="border-l-2 pl-3 py-1 my-2 text-xs italic rounded-r-md break-words [overflow-wrap:anywhere] min-w-0 max-w-full"
              style={{
                borderColor: 'var(--tt-primary)',
                backgroundColor: 'var(--tt-primary-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ className: codeClassName, children }) => {
            const isInline = !codeClassName;
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium border break-all [overflow-wrap:anywhere] inline"
                  style={{
                    backgroundColor: 'var(--tt-bg-elevated)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-primary)'
                  }}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre
                className="p-3 rounded-xl border my-2 font-mono text-xs max-w-full overflow-x-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
                style={{
                  backgroundColor: 'var(--tt-bg-sunken)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-primary)'
                }}
              >
                <code className="break-words [overflow-wrap:anywhere]">{children}</code>
              </pre>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto my-3 rounded-lg border max-w-full scrollbar-thin" style={{ borderColor: 'var(--tt-border-subtle)' }}>
              <table className="w-full text-xs text-left border-collapse font-mono">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead style={{ backgroundColor: 'var(--tt-bg-elevated)', color: 'var(--tt-text-primary)' }}>
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 border-b font-semibold tracking-wider text-[11px] uppercase" style={{ borderColor: 'var(--tt-border-subtle)' }}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 border-b tabular-nums break-words" style={{ borderColor: 'var(--tt-border-subtle)', color: 'var(--tt-text-secondary)' }}>
              {children}
            </td>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
