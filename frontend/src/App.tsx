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
    // Ensure both data-theme attribute and dark class on root html element
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
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
