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
  messagesByDataset: Record<string, MessageItem[]>;
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
      messagesByDataset: {},
      datasets: [],
      auditReport: null,
      sidebarCollapsed: false,
      activeColumns: [],
      suggestedPrompt: '',
      showLanding: !Boolean((import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '').trim()),
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

      setDatasetId: (nextDatasetId) =>
        set((state) => {
          if (nextDatasetId === state.datasetId) {
            return { datasetId: nextDatasetId };
          }
          const prevId = state.datasetId;
          const prevMessages = state.messages.filter(
            (m) => !m.datasetId || m.datasetId === prevId
          );
          const updatedMap = {
            ...(state.messagesByDataset || {}),
            ...(prevId ? { [prevId]: prevMessages } : {})
          };
          const nextMessages = (updatedMap[nextDatasetId] || []).filter(
            (m) => m.datasetId === nextDatasetId
          );
          return {
            datasetId: nextDatasetId,
            messages: nextMessages,
            messagesByDataset: updatedMap,
            activeColumns: [],
            auditReport: null,
            suggestedPrompt: ''
          };
        }),

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
        const currentDatasetId = get().datasetId;
        const newMsg: MessageItem = {
          ...msg,
          datasetId: msg.datasetId || currentDatasetId,
          id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        set((state) => {
          const nextList = [...state.messages, newMsg];
          return {
            messages: nextList,
            messagesByDataset: {
              ...(state.messagesByDataset || {}),
              [currentDatasetId]: nextList
            }
          };
        });
      },

      clearMessages: () =>
        set((state) => ({
          messages: [],
          messagesByDataset: {
            ...(state.messagesByDataset || {}),
            [state.datasetId]: []
          }
        }))
    }),
    {
      name: 'tabletell_app_storage',
      partialize: (state) => ({
        theme: state.theme,
        datasetId: state.datasetId,
        suggestedPrompt: state.suggestedPrompt,
        messages: state.messages,
        messagesByDataset: state.messagesByDataset,
        sidebarCollapsed: state.sidebarCollapsed
      })
    }
  )
);
