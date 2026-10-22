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
  addMessage: (message: Omit<MessageItem, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      logoVariant: 'tabletell-badge',
      datasetId: 'ecommerce_sales',
      activeTab: 'studio',
      messages: [],
      datasets: [],
      auditReport: null,
      sidebarCollapsed: false,
      activeColumns: [],
      suggestedPrompt: '',

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
