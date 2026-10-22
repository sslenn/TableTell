export interface PlotlyThemeOptions {
  isDark: boolean;
  title?: string;
}

export function getNordicPlotlyLayout(isDark: boolean) {
  const fontColor = isDark ? '#CBD5E1' : '#334155';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
  const colorway = isDark
    ? ['#06B6D4', '#38BDF8', '#818CF8', '#F59E0B', '#10B981', '#A78BFA']
    : ['#0284C7', '#0EA5E9', '#6366F1', '#EA580C', '#059669', '#9333EA'];

  return {
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    colorway,
    font: {
      color: fontColor,
      family: 'Public Sans, sans-serif',
      size: 12
    },
    margin: { t: 40, r: 24, b: 40, l: 48 },
    xaxis: {
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      tickfont: { family: 'JetBrains Mono, monospace', size: 11, color: fontColor }
    },
    yaxis: {
      gridcolor: gridColor,
      zerolinecolor: gridColor,
      tickfont: { family: 'JetBrains Mono, monospace', size: 11, color: fontColor }
    },
    legend: {
      font: { color: fontColor, family: 'Public Sans, sans-serif' },
      bgcolor: 'rgba(0,0,0,0)'
    }
  };
}
