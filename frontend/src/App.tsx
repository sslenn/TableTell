import { useEffect, lazy, Suspense } from 'react';
import { useAppStore } from './store/useAppStore';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { ViewLoadingSkeleton } from './components/common/ViewLoadingSkeleton';

// Code-split analytical views to dramatically reduce initial JavaScript bundle
const StudioView = lazy(() =>
  import('./components/studio/StudioView').then((m) => ({ default: m.StudioView }))
);
const DatasetsView = lazy(() =>
  import('./components/datasets/DatasetsView').then((m) => ({ default: m.DatasetsView }))
);
const AuditView = lazy(() =>
  import('./components/audit/AuditView').then((m) => ({ default: m.AuditView }))
);
const TelemetryView = lazy(() =>
  import('./components/telemetry/TelemetryView').then((m) => ({ default: m.TelemetryView }))
);

export function App() {
  const { activeTab, theme } = useAppStore();

  useEffect(() => {
    // Ensure both data-theme attribute and dark class on root html element
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const getTabLabel = (tab: string) => {
    switch (tab) {
      case 'studio':
        return 'Ask & Analyze Studio';
      case 'datasets':
        return 'Data Catalog & Lake';
      case 'audit':
        return 'Data Quality & Distribution Profiler';
      case 'telemetry':
        return 'Pipeline & Execution Tracing';
      default:
        return 'Analytical View';
    }
  };

  return (
    <AppShell>
      <ErrorBoundary
        key={activeTab}
        fallbackTitle={`${getTabLabel(activeTab)} Error`}
        fallbackMessage="An unexpected error occurred while rendering this tab. You can retry the view or switch to another dataset."
      >
        <Suspense fallback={<ViewLoadingSkeleton label={`Loading ${getTabLabel(activeTab)}...`} />}>
          {activeTab === 'studio' && <StudioView />}
          {activeTab === 'datasets' && <DatasetsView />}
          {activeTab === 'audit' && <AuditView />}
          {activeTab === 'telemetry' && <TelemetryView />}
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}

export default App;
