import React, { useEffect, useRef, useState } from 'react';
import Plotly from 'plotly.js-dist-min';
import { useAppStore } from '../../store/useAppStore';
import { getNordicPlotlyLayout } from '../../lib/plotlyTheme';
import { Maximize2, Minimize2, Download, RotateCcw, BarChart3 } from 'lucide-react';
import { toast } from '../../store/useToastStore';

interface ChartViewerProps {
  spec: Record<string, unknown>;
  className?: string;
  title?: string;
}

function buildResolvedPlotlyLayout(
  specLayout: Partial<Plotly.Layout> | undefined,
  specData: Plotly.Data[] | undefined,
  isDark: boolean
): Partial<Plotly.Layout> {
  const baseLayout = (specLayout as any) || {};
  const nordicLayout = getNordicPlotlyLayout(isDark) as any;
  const labelColor = isDark ? '#94A3B8' : '#64748B';

  // 1. Explicit axis titles from base layout
  let xTitle =
    typeof baseLayout.xaxis?.title === 'string'
      ? baseLayout.xaxis.title
      : baseLayout.xaxis?.title?.text || '';

  let yTitle =
    typeof baseLayout.yaxis?.title === 'string'
      ? baseLayout.yaxis.title
      : baseLayout.yaxis?.title?.text || '';

  // 2. Intelligent inference from chart title if explicit axis titles aren't present
  const chartTitle =
    typeof baseLayout.title === 'string'
      ? baseLayout.title
      : baseLayout.title?.text || '';

  if (chartTitle && (!xTitle || !yTitle)) {
    // Pattern 1: "<Metric/Y> by <Dimension/X>" e.g. "Total Records by Gender"
    const byMatch = chartTitle.match(/^(.*?)\s+by\s+(.*?)$/i);
    if (byMatch) {
      if (!yTitle) yTitle = byMatch[1].trim();
      if (!xTitle) xTitle = byMatch[2].trim();
    } else {
      // Pattern 2: "Trend: <Metric/Y> over <Temporal/X>"
      const overMatch = chartTitle.match(/^(?:trend:\s*)?(.*?)\s+over\s+(.*?)$/i);
      if (overMatch) {
        if (!yTitle) yTitle = overMatch[1].trim();
        if (!xTitle) xTitle = overMatch[2].trim();
      } else {
        // Pattern 3: "<Y> vs <X>"
        const vsMatch = chartTitle.match(/^(.*?)\s+(?:vs|versus)\s+(.*?)$/i);
        if (vsMatch) {
          if (!yTitle) yTitle = vsMatch[1].trim();
          if (!xTitle) xTitle = vsMatch[2].trim();
        }
      }
    }
  }

  // 3. Fallback from trace name
  if (!yTitle && specData && specData.length > 0) {
    const firstTrace = specData[0] as any;
    if (firstTrace?.name && firstTrace.name !== 'trace 0') {
      yTitle = firstTrace.name;
    }
  }

  const axisTitleFont = {
    family: 'Plus Jakarta Sans, sans-serif',
    size: 12,
    color: labelColor
  };

  return {
    ...baseLayout,
    ...nordicLayout,
    autosize: true,
    margin: {
      ...nordicLayout.margin,
      ...(baseLayout.margin || {}),
      b: Math.max(55, baseLayout.margin?.b || 55),
      l: Math.max(60, baseLayout.margin?.l || 60)
    },
    xaxis: {
      ...nordicLayout.xaxis,
      ...(baseLayout.xaxis || {}),
      automargin: true,
      title: xTitle
        ? {
            text: xTitle,
            font: axisTitleFont,
            standoff: 14,
            ...(typeof baseLayout.xaxis?.title === 'object' ? baseLayout.xaxis.title : {})
          }
        : undefined
    },
    yaxis: {
      ...nordicLayout.yaxis,
      ...(baseLayout.yaxis || {}),
      automargin: true,
      title: yTitle
        ? {
            text: yTitle,
            font: axisTitleFont,
            standoff: 14,
            ...(typeof baseLayout.yaxis?.title === 'object' ? baseLayout.yaxis.title : {})
          }
        : undefined
    }
  };
}

export const ChartViewer: React.FC<ChartViewerProps> = ({ spec, className = '', title }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const modalContainerRef = useRef<HTMLDivElement>(null);
  const theme = useAppStore((state) => state.theme);
  const isDark = theme === 'dark';
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Render chart in normal container
  useEffect(() => {
    if (!containerRef.current || !spec) return;

    const data = (spec.data as Plotly.Data[]) || [];
    const mergedLayout = buildResolvedPlotlyLayout(
      spec.layout as Partial<Plotly.Layout>,
      data,
      isDark
    );

    const config: Partial<Plotly.Config> = {
      responsive: true,
      displayModeBar: false // We provide our own custom Nordic toolbar!
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
  }, [spec, isDark]);

  // Render in fullscreen modal if active
  useEffect(() => {
    if (!isFullscreen || !modalContainerRef.current || !spec) return;

    const data = (spec.data as Plotly.Data[]) || [];
    const mergedLayout = buildResolvedPlotlyLayout(
      spec.layout as Partial<Plotly.Layout>,
      data,
      isDark
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

  return (
    <>
      <div
        className={`w-full overflow-hidden rounded-xl border flex flex-col transition-all ${className}`}
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)',
          boxShadow: 'var(--tt-shadow-card)'
        }}
      >
        {/* Chart Custom Nordic Toolbar */}
        <div
          className="flex items-center justify-between px-3 py-1.5 border-b text-[11px] font-mono select-none"
          style={{
            backgroundColor: 'var(--tt-bg-elevated)',
            borderColor: 'var(--tt-border-subtle)'
          }}
        >
          <div className="flex items-center gap-1.5 truncate">
            <BarChart3 className="w-3.5 h-3.5 text-[#2DD4BF]" />
            <span className="font-semibold text-[#2DD4BF] truncate">
              {title || 'Vectorized Plotly Chart'}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleResetZoom}
              title="Reset axis zoom"
              className="p-1 rounded border cursor-pointer opacity-75 hover:opacity-100 hover:border-[#2DD4BF] transition-all"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              <RotateCcw className="w-3 h-3" />
            </button>

            <button
              type="button"
              onClick={handleDownloadPng}
              title="Export high-res PNG"
              className="p-1 rounded border cursor-pointer opacity-75 hover:opacity-100 hover:border-[#2DD4BF] transition-all"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              <Download className="w-3 h-3 text-[#2DD4BF]" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(true)}
              title="Expand to Fullscreen"
              className="p-1 rounded border cursor-pointer opacity-75 hover:opacity-100 hover:border-[#2DD4BF] transition-all"
              style={{
                backgroundColor: 'var(--tt-bg-surface)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-text-secondary)'
              }}
            >
              <Maximize2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Chart Canvas */}
        <div className="p-2 w-full">
          <div ref={containerRef} className="w-full min-h-[360px]" />
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
                  Interactive Visualization Studio
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
};
