import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { AppShell } from './components/layout/AppShell';
import { StudioView } from './components/studio/StudioView';
import { DatasetsView } from './components/datasets/DatasetsView';
import { AuditView } from './components/audit/AuditView';
import { TelemetryView } from './components/telemetry/TelemetryView';

export function App() {
  const { activeTab, theme } = useAppStore();

  useEffect(() => {
    // Ensure initial data-theme attribute on root html element
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <AppShell>
      {activeTab === 'studio' && <StudioView />}
      {activeTab === 'datasets' && <DatasetsView />}
      {activeTab === 'audit' && <AuditView />}
      {activeTab === 'telemetry' && <TelemetryView />}
    </AppShell>
  );
}

export default App;
