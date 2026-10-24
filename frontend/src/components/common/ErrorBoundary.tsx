import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  compact?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false
  };

  public static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[TableTell ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      const {
        fallbackTitle = 'Component Encountered an Error',
        fallbackMessage = 'An unexpected rendering error occurred. The rest of the application remains functional.',
        compact = false
      } = this.props;

      if (compact) {
        return (
          <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-xs flex items-center justify-between gap-3 text-red-400">
            <div className="flex items-center gap-2 truncate">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
              <span className="truncate font-medium">{this.state.error?.message || fallbackTitle}</span>
            </div>
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-semibold transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        );
      }

      return (
        <div className="w-full h-full min-h-[300px] flex items-center justify-center p-6 bg-[var(--tt-bg-canvas)]">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-[var(--tt-bg-surface)] p-6 shadow-[var(--tt-shadow-card)] flex flex-col items-center text-center">
            {/* Warning Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-base font-bold text-[var(--tt-text-primary)] mb-1">
              {fallbackTitle}
            </h3>

            <p className="text-xs text-[var(--tt-text-secondary)] mb-5 max-w-sm leading-relaxed">
              {fallbackMessage}
            </p>

            {/* Error Message Box */}
            {this.state.error && (
              <div className="w-full mb-4 text-left">
                <div className="p-3 rounded-xl bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)] font-mono text-[11px] text-red-400 break-words">
                  {this.state.error.name}: {this.state.error.message}
                </div>

                {this.state.errorInfo?.componentStack && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                      className="text-[10px] text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] flex items-center gap-1 font-mono transition-colors"
                    >
                      <span>{this.state.showDetails ? 'Hide technical stack' : 'View technical stack'}</span>
                      {this.state.showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>

                    {this.state.showDetails && (
                      <pre className="mt-1.5 p-3 rounded-xl bg-[var(--tt-bg-canvas)] border border-[var(--tt-border-subtle)] text-[10px] text-[var(--tt-text-muted)] overflow-x-auto max-h-40 font-mono leading-tight">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 w-full justify-center pt-1">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#0D9488] hover:bg-[#0F766E] text-white transition-all shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Retry View</span>
              </button>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--tt-text-secondary)] border border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] transition-colors cursor-pointer"
              >
                Reload Window
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
