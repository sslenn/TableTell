export interface PlotlyThemeOptions {
  isDark: boolean;
  title?: string;
}

export function getNordicPlotlyLayout(isDark: boolean) {
  const fontColor = isDark ? '#E2E8F0' : '#1E293B';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
  const colorway = isDark
    ? ['#2DD4BF', '#38BDF8', '#818CF8', '#F59E0B', '#10B981', '#A78BFA']
    : ['#0D9488', '#0284C7', '#6366F1', '#EA580C', '#059669', '#9333EA'];

  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    colorway,
    font: {
      color: fontColor,
      family: 'Plus Jakarta Sans, Public Sans, sans-serif',
      size: 13
    },
    margin: { t: 58, r: 28, b: 60, l: 64 },
    xaxis: {
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      tickfont: { family: 'Plus Jakarta Sans, Public Sans, sans-serif', size: 12, color: fontColor },
      automargin: true
    },
    yaxis: {
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      tickfont: { family: 'JetBrains Mono, monospace', size: 12, color: fontColor },
      automargin: true
    },
    legend: {
      font: { color: fontColor, family: 'Plus Jakarta Sans, Public Sans, sans-serif', size: 12 },
      bgcolor: 'rgba(0,0,0,0)'
    }
  };
}
