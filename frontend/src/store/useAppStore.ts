import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MessageItem } from '../types/api';
import type { DatasetSummary, DatasetAuditReport } from '../types/dataset';

import type { LogoVariant } from '../components/common/BrandLogo';

export type AppTab = 'studio' | 'datasets' | 'audit' | 'telemetry';
export type ThemeMode = 'dark' | 'light';

interface AppState {
  theme: ThemeMode;
  logoVariant: LogoVariant;
  datasetId: string;
  activeTab: AppTab;
  messages: MessageItem[];
  datasets: DatasetSummary[];
  auditReport: DatasetAuditReport | null;
  sidebarCollapsed: boolean;
  activeColumns: string[];
  suggestedPrompt: string;
  showLanding: boolean;
  schemaInspectorOpen: boolean;
  copilotOpen: boolean;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setLogoVariant: (variant: LogoVariant) => void;
  setDatasetId: (id: string) => void;
  setActiveTab: (tab: AppTab) => void;
  setDatasets: (datasets: DatasetSummary[]) => void;
  setAuditReport: (report: DatasetAuditReport | null) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  setActiveColumns: (cols: string[]) => void;
  setSuggestedPrompt: (prompt: string) => void;
  setShowLanding: (show: boolean) => void;
  setSchemaInspectorOpen: (open: boolean) => void;
  toggleSchemaInspector: () => void;
  setCopilotOpen: (open: boolean) => void;
  toggleCopilot: () => void;
  addMessage: (message: Omit<MessageItem, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      logoVariant: 'waveform-table',
      datasetId: 'ecommerce_sales',
      activeTab: 'studio',
      messages: [],
      datasets: [],
      auditReport: null,
      sidebarCollapsed: false,
      activeColumns: [],
      suggestedPrompt: '',
      showLanding: true,
      schemaInspectorOpen: false,
      copilotOpen: false,

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },

      toggleTheme: () => {
        const next = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        set({ theme: next });
      },

      setLogoVariant: (logoVariant) => set({ logoVariant }),

      setDatasetId: (datasetId) => set({ datasetId }),
      setActiveTab: (activeTab) => set({ activeTab }),
      setDatasets: (datasets) => set({ datasets }),
      setAuditReport: (auditReport) => set({ auditReport }),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setActiveColumns: (activeColumns) => set({ activeColumns }),
      setSuggestedPrompt: (suggestedPrompt) => set({ suggestedPrompt }),
      setShowLanding: (showLanding) => set({ showLanding }),
      setSchemaInspectorOpen: (schemaInspectorOpen) => set({ schemaInspectorOpen }),
      toggleSchemaInspector: () =>
        set((s) => ({ schemaInspectorOpen: !s.schemaInspectorOpen })),
      setCopilotOpen: (copilotOpen) => set({ copilotOpen }),
      toggleCopilot: () => set((s) => ({ copilotOpen: !s.copilotOpen })),

      addMessage: (msg) => {
        const newMsg: MessageItem = {
          ...msg,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        set((state) => ({ messages: [...state.messages, newMsg] }));
      },

      clearMessages: () => set({ messages: [] })
    }),
    {
      name: 'tabletell_app_storage',
      partialize: (state) => ({
        theme: state.theme,
        datasetId: state.datasetId,
        messages: state.messages,
        sidebarCollapsed: state.sidebarCollapsed
      })
    }
  )
);
