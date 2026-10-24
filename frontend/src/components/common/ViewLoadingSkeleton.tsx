import React from 'react';

interface ViewLoadingSkeletonProps {
  label?: string;
}

export const ViewLoadingSkeleton: React.FC<ViewLoadingSkeletonProps> = ({
  label = 'Loading view...'
}) => {
  return (
    <div className="flex-1 w-full h-full p-6 flex flex-col gap-6 animate-pulse bg-[var(--tt-bg-canvas)] overflow-hidden">
      {/* Top Header Placeholder */}
      <div className="flex items-center justify-between gap-4 pb-4 border-b border-[var(--tt-border-subtle)]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--tt-bg-elevated)] border border-[var(--tt-border-subtle)]" />
          <div className="flex flex-col gap-2">
            <div className="w-48 h-4 rounded-md bg-[var(--tt-bg-elevated)]" />
            <div className="w-32 h-3 rounded-md bg-[var(--tt-bg-sunken)]" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-24 h-8 rounded-xl bg-[var(--tt-bg-elevated)] border border-[var(--tt-border-subtle)]" />
          <div className="w-20 h-8 rounded-xl bg-[var(--tt-bg-elevated)] border border-[var(--tt-border-subtle)]" />
        </div>
      </div>

      {/* Main Grid Placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-28 rounded-2xl bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] p-4 flex flex-col justify-between">
          <div className="w-20 h-3 rounded bg-[var(--tt-bg-sunken)]" />
          <div className="w-32 h-6 rounded bg-[var(--tt-bg-elevated)]" />
        </div>
        <div className="h-28 rounded-2xl bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] p-4 flex flex-col justify-between">
          <div className="w-20 h-3 rounded bg-[var(--tt-bg-sunken)]" />
          <div className="w-28 h-6 rounded bg-[var(--tt-bg-elevated)]" />
        </div>
        <div className="h-28 rounded-2xl bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] p-4 flex flex-col justify-between">
          <div className="w-20 h-3 rounded bg-[var(--tt-bg-sunken)]" />
          <div className="w-36 h-6 rounded bg-[var(--tt-bg-elevated)]" />
        </div>
      </div>

      {/* Large Content Area Placeholder */}
      <div className="flex-1 min-h-[300px] rounded-2xl bg-[var(--tt-bg-surface)] border border-[var(--tt-border-subtle)] p-6 flex flex-col justify-between">
        <div className="flex flex-col gap-3">
          <div className="w-1/3 h-4 rounded bg-[var(--tt-bg-elevated)]" />
          <div className="w-full h-10 rounded-xl bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)]" />
          <div className="w-4/5 h-3 rounded bg-[var(--tt-bg-sunken)]" />
          <div className="w-3/5 h-3 rounded bg-[var(--tt-bg-sunken)]" />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-[var(--tt-border-subtle)]">
          <span className="text-[11px] font-mono text-[var(--tt-text-muted)]">{label}</span>
          <div className="w-24 h-7 rounded-lg bg-[var(--tt-bg-elevated)]" />
        </div>
      </div>
    </div>
  );
};
