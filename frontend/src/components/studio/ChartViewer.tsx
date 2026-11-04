import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useAppStore } from '../../store/useAppStore';
import { getNordicPlotlyLayout } from '../../lib/plotlyTheme';
import { Maximize2, Minimize2, Download, RotateCcw, BarChart3 } from 'lucide-react';
import { toast } from '../../store/useToastStore';

export interface ChartViewerHandle {
  resetZoom: () => void;
  downloadPng: () => void;
  openFullscreen: () => void;
}

interface ChartViewerProps {
  spec: Record<string, unknown>;
  className?: string;
  title?: string;
  summary?: string;
  embedded?: boolean;
}

function extractChartMeta(
  specLayout: Partial<Plotly.Layout> | undefined,
  specData: Plotly.Data[] | undefined
): { chartTitle: string; xTitle: string; yTitle: string } {
  const baseLayout = (specLayout as any) || {};

  let xTitle =
    typeof baseLayout.xaxis?.title === 'string'
      ? baseLayout.xaxis.title
      : baseLayout.xaxis?.title?.text || '';

  let yTitle =
    typeof baseLayout.yaxis?.title === 'string'
      ? baseLayout.yaxis.title
      : baseLayout.yaxis?.title?.text || '';

  const chartTitle =
    typeof baseLayout.title === 'string'
      ? baseLayout.title
      : baseLayout.title?.text || '';

  if (chartTitle && (!xTitle || !yTitle)) {
    const byMatch = chartTitle.match(/^(.*?)\s+by\s+(.*?)$/i);
    if (byMatch) {
      if (!yTitle) yTitle = byMatch[1].trim();
      if (!xTitle) xTitle = byMatch[2].trim();
    } else {
      const overMatch = chartTitle.match(/^(?:trend:\s*)?(.*?)\s+over\s+(.*?)$/i);
      if (overMatch) {
        if (!yTitle) yTitle = overMatch[1].trim();
        if (!xTitle) xTitle = overMatch[2].trim();
      } else {
        const vsMatch = chartTitle.match(/^(.*?)\s+(?:vs|versus)\s+(.*?)$/i);
        if (vsMatch) {
          if (!yTitle) yTitle = vsMatch[1].trim();
          if (!xTitle) xTitle = vsMatch[2].trim();
        }
      }
    }
  }

  if (!yTitle && specData && specData.length > 0) {
    const firstTrace = specData[0] as any;
    if (firstTrace?.name && firstTrace.name !== 'trace 0') {
      yTitle = firstTrace.name;
    }
  }

  return {
    chartTitle: chartTitle || 'Analytical Breakdown',
    xTitle: xTitle || 'Category',
    yTitle: yTitle || 'Value'
  };
}

function normalizeTracesForReadability(
  rawTraces: Plotly.Data[] | undefined,
  isDark: boolean
): Plotly.Data[] {
  if (!rawTraces || !Array.isArray(rawTraces)) return [];

  const valueTextColor = isDark ? '#F8FAFC' : '#0F172A';

  return rawTraces.map((trace: any, traceIdx: number) => {
    if (trace?.type === 'bar') {
      const isHorizontal = trace.orientation === 'h';
      const vals: unknown[] = (isHorizontal ? trace.x : trace.y) || [];
      const numericVals = vals.map((v) => Number(v));
      const maxVal = numericVals.reduce((acc, n) => (Number.isFinite(n) && n > acc ? n : acc), -Infinity);

      // Highlight the leading bar in teal (#5EEAD4 / #2DD4BF) and remaining bars in sky-blue (#38BDF8), matching the Studio preview
      const barColors =
        rawTraces.length === 1 && numericVals.length > 1
          ? numericVals.map((n) =>
              n === maxVal
                ? isDark
                  ? '#5EEAD4'
                  : '#0D9488'
                : isDark
                ? '#38BDF8'
                : '#0284C7'
            )
          : traceIdx === 0
          ? isDark
            ? '#5EEAD4'
            : '#0D9488'
          : '#38BDF8';

      const hasAutoValues = Array.isArray(vals) && vals.length <= 16;

      return {
        ...trace,
        text: trace.text ?? (hasAutoValues ? vals : undefined),
        textposition: 'outside',
        cliponaxis: false,
        marker: {
          ...(trace.marker || {}),
          color: barColors,
          cornerradius: 6,
          line: { width: 0 }
        },
        textfont: {
          family: 'JetBrains Mono, monospace',
          size: 12,
          weight: 700,
          color: valueTextColor
        }
      };
    }
    return trace;
  });
}

function buildResolvedPlotlyLayout(
  specLayout: Partial<Plotly.Layout> | undefined,
  specData: Plotly.Data[] | undefined,
  isDark: boolean,
  hideInternalTitle: boolean
): Partial<Plotly.Layout> {
  const baseLayout = (specLayout as any) || {};
  const nordicLayout = getNordicPlotlyLayout(isDark) as any;
  const labelColor = isDark ? '#CBD5E1' : '#475569';
  const titleColor = isDark ? '#F8FAFC' : '#0F172A';
  const { chartTitle, xTitle, yTitle } = extractChartMeta(specLayout, specData);

  const axisTitleFont = {
    family: 'Plus Jakarta Sans, sans-serif',
    size: 12,
    color: labelColor
  };

  return {
    ...baseLayout,
    ...nordicLayout,
    autosize: true,
    title: hideInternalTitle
      ? undefined
      : {
          text: chartTitle,
          font: {
            family: 'Plus Jakarta Sans, sans-serif',
            size: 16,
            color: titleColor
          },
          x: 0.02,
          xanchor: 'left'
        },
    margin: {
      ...nordicLayout.margin,
      ...(baseLayout.margin || {}),
      t: hideInternalTitle ? 32 : 58,
      r: 20,
      b: Math.max(48, baseLayout.margin?.b || 48),
      l: Math.max(48, baseLayout.margin?.l || 48)
    },
    xaxis: {
      ...nordicLayout.xaxis,
      ...(baseLayout.xaxis || {}),
      automargin: true,
      showgrid: false,
      title: hideInternalTitle
        ? undefined
        : xTitle
        ? {
            text: xTitle,
            font: axisTitleFont,
            standoff: 12
          }
        : undefined
    },
    yaxis: {
      ...nordicLayout.yaxis,
      ...(baseLayout.yaxis || {}),
      automargin: true,
      title: hideInternalTitle
        ? undefined
        : yTitle
        ? {
            text: yTitle,
            font: axisTitleFont,
            standoff: 12
          }
        : undefined
    }
  };
}

export const ChartViewer = forwardRef<ChartViewerHandle, ChartViewerProps>(
  ({ spec, className = '', title, summary, embedded = false }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const modalContainerRef = useRef<HTMLDivElement>(null);
    const theme = useAppStore((state) => state.theme);
    const isDark = theme === 'dark';
    const [isFullscreen, setIsFullscreen] = useState(false);

    const meta = useMemo(
      () => extractChartMeta(spec?.layout as Partial<Plotly.Layout>, spec?.data as Plotly.Data[]),
      [spec]
    );

    // Strip markdown bold/bullet formatting for the crisp 1-line subtitle under the chart title
    const cleanSubtitle = useMemo(() => {
      if (!summary) return '';
      const firstSentence = summary
        .replace(/[#*_`>-]/g, '')
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean)[0];
      return firstSentence || '';
    }, [summary]);

    const handleDownloadPng = async () => {
      const el = containerRef.current;
      if (!el) return;
      try {
        await Plotly.downloadImage(el, {
          format: 'png',
          width: 1200,
          height: 700,
          filename: `tabletell_chart_${Date.now()}`
        });
        toast.success('Chart Image Exported', 'Downloaded high-resolution PNG');
      } catch {
        toast.error('Export Failed', 'Could not render PNG from canvas');
      }
    };

    const handleResetZoom = () => {
      const el = containerRef.current;
      if (!el) return;
      Plotly.relayout(el, {
        xaxis: { autorange: true },
        yaxis: { autorange: true }
      });
      toast.info('Zoom Reset', 'Viewport restored to default bounds');
    };

    useImperativeHandle(ref, () => ({
      resetZoom: handleResetZoom,
      downloadPng: handleDownloadPng,
      openFullscreen: () => setIsFullscreen(true)
    }));

    // Render chart in normal container
    useEffect(() => {
      if (!containerRef.current || !spec) return;

      const data = normalizeTracesForReadability(spec.data as Plotly.Data[], isDark);
      const mergedLayout = buildResolvedPlotlyLayout(
        spec.layout as Partial<Plotly.Layout>,
        data,
        isDark,
        embedded
      );

      const config: Partial<Plotly.Config> = {
        responsive: true,
        displayModeBar: false
      };

      Plotly.react(containerRef.current, data, mergedLayout, config);

      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
          Plotly.Plots.resize(containerRef.current);
        }
      });

      resizeObserver.observe(containerRef.current);

      return () => {
        resizeObserver.disconnect();
      };
    }, [spec, isDark, embedded]);

    // Render in fullscreen modal if active
    useEffect(() => {
      if (!isFullscreen || !modalContainerRef.current || !spec) return;

      const data = normalizeTracesForReadability(spec.data as Plotly.Data[], isDark);
      const mergedLayout = buildResolvedPlotlyLayout(
        spec.layout as Partial<Plotly.Layout>,
        data,
        isDark,
        false
      );

      Plotly.react(modalContainerRef.current, data, mergedLayout, {
        responsive: true,
        displayModeBar: true,
        displaylogo: false
      });

      const resizeObserver = new ResizeObserver(() => {
        if (modalContainerRef.current) {
          Plotly.Plots.resize(modalContainerRef.current);
        }
      });
      resizeObserver.observe(modalContainerRef.current);

      return () => resizeObserver.disconnect();
    }, [isFullscreen, spec, isDark]);

    return (
      <>
        <div
          className={`w-full overflow-hidden flex flex-col transition-all ${
            embedded ? '' : 'rounded-xl border shadow-[var(--tt-shadow-card)]'
          } ${className}`}
          style={
            embedded
              ? undefined
              : {
                  backgroundColor: 'var(--tt-bg-surface)',
                  borderColor: 'var(--tt-border-subtle)'
                }
          }
        >
          {/* Standalone Toolbar (only shown when not embedded inside ChatMessage's unified bar) */}
          {!embedded && (
            <div
              className="flex items-center justify-between px-3.5 py-2 border-b text-xs font-mono select-none"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)'
              }}
            >
              <div className="flex items-center gap-1.5 truncate">
                <BarChart3 className="w-3.5 h-3.5 text-[#2DD4BF]" />
                <span className="font-semibold text-[#2DD4BF] truncate">
                  {title || meta.chartTitle}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleResetZoom}
                  title="Reset axis zoom"
                  className="px-2 py-1 rounded border text-xs cursor-pointer hover:border-[#2DD4BF] transition-all flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-text-secondary)'
                  }}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPng}
                  title="Export high-res PNG"
                  className="px-2 py-1 rounded border text-xs cursor-pointer hover:border-[#2DD4BF] transition-all flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-text-secondary)'
                  }}
                >
                  <Download className="w-3 h-3 text-[#2DD4BF]" />
                  <span>PNG</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFullscreen(true)}
                  title="Expand to Fullscreen"
                  className="px-2 py-1 rounded border text-xs cursor-pointer hover:border-[#2DD4BF] transition-all flex items-center gap-1"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-subtle)',
                    color: 'var(--tt-text-secondary)'
                  }}
                >
                  <Maximize2 className="w-3 h-3" />
                  <span>Expand</span>
                </button>
              </div>
            </div>
          )}

          {/* Embedded Chart Header: Title + Lead Summary on Left, Y/X Axis Legend on Right */}
          {embedded && (
            <div className="flex flex-wrap items-baseline justify-between gap-2 px-2 pt-1 pb-2">
              <div className="min-w-0">
                <h3
                  className="text-base font-bold tracking-tight"
                  style={{ color: 'var(--tt-text-primary)' }}
                >
                  {title || meta.chartTitle}
                </h3>
                {cleanSubtitle && (
                  <p
                    className="text-xs mt-0.5 line-clamp-2"
                    style={{ color: 'var(--tt-text-muted)' }}
                  >
                    {cleanSubtitle}
                  </p>
                )}
              </div>
              <span
                className="font-mono text-xs shrink-0"
                style={{ color: 'var(--tt-text-muted)' }}
              >
                Y: {meta.yTitle} · X: {meta.xTitle}
              </span>
            </div>
          )}

          {/* Chart Canvas */}
          <div className="w-full">
            <div ref={containerRef} className="w-full min-h-[290px]" />
          </div>
        </div>

        {/* Fullscreen Modal View */}
        {isFullscreen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/70 backdrop-blur-md animate-in fade-in">
            <div
              className="w-full h-full max-w-6xl max-h-[90vh] rounded-2xl border flex flex-col overflow-hidden shadow-2xl"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-strong)'
              }}
            >
              <div
                className="flex items-center justify-between px-5 py-3 border-b"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)'
                }}
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#2DD4BF]" />
                  <span className="font-bold text-sm" style={{ color: 'var(--tt-text-primary)' }}>
                    {title || meta.chartTitle}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPng}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-mono cursor-pointer hover:border-[#2DD4BF] transition-all"
                    style={{
                      backgroundColor: 'var(--tt-bg-surface)',
                      borderColor: 'var(--tt-border-subtle)',
                      color: 'var(--tt-text-secondary)'
                    }}
                  >
                    <Download className="w-3.5 h-3.5 text-[#2DD4BF]" />
                    <span>Download PNG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFullscreen(false)}
                    className="p-1.5 rounded-lg border cursor-pointer hover:border-[#2DD4BF] transition-all"
                    style={{
                      backgroundColor: 'var(--tt-bg-surface)',
                      borderColor: 'var(--tt-border-subtle)',
                      color: 'var(--tt-text-primary)'
                    }}
                  >
                    <Minimize2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 w-full h-full min-h-0">
                <div ref={modalContainerRef} className="w-full h-full min-h-[450px]" />
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
);
