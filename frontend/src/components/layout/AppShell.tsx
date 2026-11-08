import { useAuthConfig } from '../auth/ClerkAuthProvider';
import React, { useEffect, useState, useRef } from 'react';
import { UserButton } from '@clerk/react';
import {
  MessageSquare,
  Database,
  Activity,
  GitBranch,
  ExternalLink,
  ChevronDown,
  Search,
  Check,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  ChevronRight,
  User,
  Home,
  Columns3,
  Sparkles,
  Key,
  Zap
} from 'lucide-react';
import { useAppStore, type AppTab } from '../../store/useAppStore';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { ToastContainer } from '../common/ToastContainer';
import { OfflineBanner } from '../common/OfflineBanner';
import { TableTellAssistant } from '../assistant/TableTellAssistant';
import { ApiKeyModal } from '../common/ApiKeyModal';
import { fetchDatasets, fetchQuotaStatus, type QuotaStatus } from '../../lib/api';
import { getCustomApiKey, onCustomApiKeyChange } from '../../lib/apiKeyStorage';
import { logger } from '../../lib/logger';
import { toast } from '../../store/useToastStore';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const { isAuthEnabled } = useAuthConfig();
  const {
    activeTab,
    setActiveTab,
    datasetId,
    setDatasetId,
    datasets,
    setDatasets,
    sidebarCollapsed,
    toggleSidebar,
    clearMessages,
    setShowLanding,
    activeColumns,
    schemaInspectorOpen,
    toggleSchemaInspector,
    copilotOpen,
    toggleCopilot
  } = useAppStore();

  const activeDataset = datasets.find((d) => d.dataset_id === datasetId);

  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [headerDatasetOpen, setHeaderDatasetOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'clean' | 'raw'>('all');
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [quotaStatus, setQuotaStatus] = useState<QuotaStatus | null>(null);
  const [hasCustomKey, setHasCustomKey] = useState<boolean>(Boolean(getCustomApiKey()));
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headerDatasetRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  // Load and listen to quota / BYOK state
  useEffect(() => {
    const loadQuota = () => {
      fetchQuotaStatus()
        .then(setQuotaStatus)
        .catch(() => {});
    };
    loadQuota();
    const unsubscribe = onCustomApiKeyChange((key) => {
      setHasCustomKey(Boolean(key));
      loadQuota();
    });
    const handleOpenModal = () => setApiKeyModalOpen(true);
    window.addEventListener('open-api-key-modal', handleOpenModal);
    return () => {
      unsubscribe();
      window.removeEventListener('open-api-key-modal', handleOpenModal);
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDatasetDropdownOpen(false);
      }
      if (headerDatasetRef.current && !headerDatasetRef.current.contains(event.target as Node)) {
        setHeaderDatasetOpen(false);
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts: Ctrl+B / Cmd+B toggles the sidebar, Escape closes open menus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
      if (e.key === 'Escape') {
        setDatasetDropdownOpen(false);
        setHeaderDatasetOpen(false);
        setUserDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  useEffect(() => {
    fetchDatasets()
      .then((res) => {
        setDatasets(res);
        if (res.length > 0 && !res.some((d) => d.dataset_id === datasetId)) {
          setDatasetId(res[0].dataset_id);
        }
      })
      .catch((err) => {
        logger.error('Failed to load datasets', err);
        toast.error('Could not load datasets', err instanceof Error ? err.message : undefined);
      });
  }, [setDatasets, datasetId, setDatasetId]);

  const navItems: { id: AppTab; label: string; icon: React.ElementType }[] = [
    { id: 'studio', label: 'Ask & Analyze', icon: MessageSquare },
    { id: 'datasets', label: 'Data Catalog', icon: Database },
    { id: 'audit', label: 'Data Quality', icon: Activity },
    { id: 'telemetry', label: 'Pipeline & Trace', icon: GitBranch }
  ];



  const filteredDatasets = React.useMemo(() => {
    return datasets.filter((d) => {
      const matchesSearch = d.dataset_id.toLowerCase().includes(datasetSearch.toLowerCase());
      const isClean = d.dataset_id.toLowerCase().includes('clean');
      if (!matchesSearch) return false;
      if (filterType === 'clean') return isClean;
      if (filterType === 'raw') return !isClean;
      return true;
    });
  }, [datasets, datasetSearch, filterType]);

  return (
    <div className="flex h-screen w-screen overflow-hidden select-none bg-[var(--tt-bg-canvas)]">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Global Draggable AI Copilot */}
      <TableTellAssistant />

      {/* Left Navigation Sidebar */}
      <aside
        className={`${sidebarCollapsed ? 'w-16' : 'w-64'
          } shrink-0 flex flex-col justify-between border-r border-[var(--tt-border-subtle)] p-4 transition-all duration-300 relative bg-[var(--tt-bg-surface)] z-20`}
      >
        <div className="flex flex-col gap-5">
          {/* Brand Lockup */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <button
              type="button"
              className="flex items-center gap-3 cursor-pointer group min-w-0 text-left rounded-lg"
              onClick={() => setActiveTab('studio')}
              aria-label="TableTell home"
              title="TableTell — Data Analyst Assistant"
            >
              <BrandLogo
                size={sidebarCollapsed ? 32 : 34}
                variant="waveform-table"
                className="transition-transform duration-300 group-hover:scale-105 shrink-0"
              />
              {!sidebarCollapsed && (
                <div className="flex flex-col min-w-0">
                  <div
                    className="font-extrabold text-[16px] tracking-tight text-[var(--tt-text-primary)] leading-tight select-none"
                    style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    TableTell
                  </div>
                  <div className="text-xs font-medium text-[var(--tt-text-muted)] tracking-tight truncate leading-normal select-none">
                    Lakehouse Studio
                  </div>
                </div>
              )}
            </button>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] text-xs cursor-pointer text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)] transition-all shrink-0 ml-1"
                aria-label="Collapse sidebar"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Dataset Card & Dropdown */}
          {!sidebarCollapsed ? (
            <div className="relative" ref={dropdownRef}>
              <div className="font-mono text-[11px] font-semibold text-[var(--tt-text-muted)] tracking-wider uppercase mb-1.5 px-0.5">
                ACTIVE DATASET
              </div>

              <button
                type="button"
                onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
                aria-haspopup="true"
                aria-expanded={datasetDropdownOpen}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] hover:bg-[var(--tt-bg-elevated)] text-xs transition-all cursor-pointer shadow-[var(--tt-shadow-card)]"
              >
                <div className="flex items-center gap-2.5 min-w-0 text-left">
                  <span className="w-2 h-2 rounded-full bg-[#34D399] shrink-0" />
                  <div className="truncate">
                    <div className="font-mono font-semibold text-xs text-[var(--tt-text-primary)] truncate">
                      {datasetId || 'Select dataset'}
                    </div>
                    {activeDataset && (
                      <div className="text-[11px] text-[var(--tt-text-muted)] truncate mt-0.5">
                        {activeDataset.total_rows.toLocaleString()} rows · {activeDataset.total_cols} cols
                      </div>
                    )}
                  </div>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[var(--tt-text-muted)] shrink-0 transition-transform ${datasetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Dropdown Panel */}
              {datasetDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl border border-[var(--tt-border-strong)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-floating)] p-2.5 z-50 flex flex-col gap-2"
                >
                  {/* Search Bar */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-xs"
                  >
                    <Search className="w-3 h-3 text-[#0D9488]" />
                    <input
                      type="text"
                      value={datasetSearch}
                      onChange={(e) => setDatasetSearch(e.target.value)}
                      placeholder="Search tables..."
                      aria-label="Search tables"
                      className="w-full bg-transparent outline-none text-xs text-[var(--tt-text-primary)]"
                      autoFocus
                    />
                  </div>

                  {/* Classification Filter Tabs */}
                  <div className="flex items-center gap-1 border-b border-[var(--tt-border-subtle)] pb-1.5">
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'all' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                        }`}
                    >
                      All ({datasets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('clean')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'clean' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                        }`}
                    >
                      Cleaned
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('raw')}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'raw' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                        }`}
                    >
                      Raw
                    </button>
                  </div>

                  {/* Dataset List */}
                  <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-0.5">
                    {filteredDatasets.length === 0 ? (
                      <div className="text-center py-4 text-xs text-[var(--tt-text-muted)]">
                        No tables matched
                      </div>
                    ) : (
                      filteredDatasets.map((d) => {
                        const isSelected = d.dataset_id === datasetId;
                        const isClean = d.dataset_id.toLowerCase().includes('clean');
                        return (
                          <button
                            key={d.dataset_id}
                            type="button"
                            onClick={() => {
                              setDatasetId(d.dataset_id);
                              setDatasetDropdownOpen(false);
                              toast.info('Active Workspace Changed', `Switched to ${d.dataset_id}`);
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer text-xs group ${isSelected ? 'bg-[#0D9488]/15 text-[#0D9488]' : 'hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-primary)]'
                              }`}
                          >
                            <div className="flex flex-col truncate pr-2">
                              <span className="truncate font-semibold">{d.dataset_id}</span>
                              <span className="text-[10px] text-[var(--tt-text-muted)]">
                                {d.total_rows.toLocaleString()} rows · {d.total_cols} cols
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isClean ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                                  }`}
                              >
                                {isClean ? 'Clean' : 'Raw'}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#0D9488]" />}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Collapsed Workspace Pill */
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={`Active dataset ${datasetId}. Expand sidebar`}
              title={`Active: ${datasetId} (Click to expand)`}
              className="flex items-center justify-center p-2.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
            >
              <Database className="w-4 h-4 text-[#0D9488]" />
            </button>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1" aria-label="Main navigation">
            {!sidebarCollapsed && (
              <div aria-hidden="true" className="font-mono text-[11px] font-semibold text-[var(--tt-text-muted)] tracking-wider uppercase mb-1.5 px-0.5">
                NAVIGATION
              </div>
            )}
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  aria-label={sidebarCollapsed ? item.label : undefined}
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                    } rounded-xl text-sm font-medium transition-all text-left cursor-pointer border ${isActive
                      ? 'bg-[#0D9488]/15 border-[#0D9488]/30 text-[#0D9488] dark:text-[#2DD4BF] font-semibold'
                      : 'border-transparent text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-text-primary)]'
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0D9488] dark:text-[#2DD4BF]' : 'text-[var(--tt-text-muted)]'}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer: Docked AI Guide + API Docs */}
        <div className="pt-3 border-t border-[var(--tt-border-subtle)] flex flex-col gap-2.5">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleCopilot}
              className={`w-full p-2.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
                copilotOpen
                  ? 'border-[#0D9488] bg-[#0D9488]/10'
                  : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] hover:border-[#0D9488]/50'
              }`}
              title="Open TableTell AI Guide"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-[#0D9488]/15 border border-[#0D9488]/35 text-[#0D9488] dark:text-[#2DD4BF] grid place-items-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5" />
                </span>
                <div className="truncate">
                  <div className="text-xs font-semibold text-[var(--tt-text-primary)] leading-tight">
                    AI Guide
                  </div>
                  <div className="text-[11px] text-[var(--tt-text-muted)] truncate">
                    Ask how to use Studio
                  </div>
                </div>
              </div>
              <span className="font-mono text-xs font-semibold text-[#0D9488] dark:text-[#2DD4BF] shrink-0 ml-2">
                {copilotOpen ? 'Close' : 'Open'}
              </span>
            </button>
          )}

          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] cursor-pointer text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:border-[var(--tt-border-strong)] transition-all"
                aria-label="Expand sidebar"
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-4 h-4 text-[#0D9488]" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-2 py-0.5">
              <a
                href="/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-[var(--tt-text-muted)] hover:text-[#0D9488] dark:hover:text-[#2DD4BF] font-mono transition-colors group"
                title="Open FastAPI Swagger Interactive Documentation (/docs)"
              >
                <span>API Docs</span>
                <ExternalLink className="w-3 h-3 opacity-40 group-hover:opacity-100 transition-opacity" />
              </a>

              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-transparent hover:border-[var(--tt-border-subtle)] text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)] transition-all cursor-pointer"
                aria-label="Collapse sidebar"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main App Workspace */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--tt-bg-canvas)] focus:outline-none"
      >
        <OfflineBanner />

        {/* Top Header */}
        <header className="h-14 shrink-0 border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center justify-between gap-4 px-5 transition-all select-none">
          {/* Left: Breadcrumbs & Dataset Quick Switcher */}
          <div className="flex items-center gap-2 min-w-0">
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] text-xs cursor-pointer hover:bg-[var(--tt-bg-elevated)] transition-all mr-1 text-[var(--tt-text-muted)] shrink-0"
                aria-label="Expand sidebar"
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-3.5 h-3.5 text-[#0D9488]" />
              </button>
            )}

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs text-[var(--tt-text-muted)] min-w-0">
              <button
                type="button"
                onClick={() => setShowLanding(true)}
                className="hover:text-[var(--tt-text-primary)] cursor-pointer flex items-center p-1.5 rounded-lg border border-transparent hover:border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] transition-all shrink-0"
                aria-label="Back to Landing Page"
                title="Back to Landing Page (Overview)"
              >
                <Home className="w-3.5 h-3.5 text-[var(--tt-text-muted)] hover:text-[#0D9488] transition-colors" />
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--tt-text-muted)] opacity-35 shrink-0" />

              {/* Active Section Label with Tab Icon */}
              {(() => {
                const currentNav = navItems.find((n) => n.id === activeTab);
                const NavIcon = currentNav?.icon || MessageSquare;
                return (
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--tt-text-secondary)] whitespace-nowrap shrink-0">
                    <NavIcon className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                    <span className="hidden md:inline">{currentNav?.label || 'Overview'}</span>
                  </div>
                );
              })()}

              <ChevronRight className="w-3.5 h-3.5 text-[var(--tt-text-muted)] opacity-35 shrink-0" />

              {/* Unified Dataset Switcher Pill with inline metadata */}
              <div className="relative min-w-0" ref={headerDatasetRef}>
                <button
                  type="button"
                  id="header-dataset-selector-btn"
                  onClick={() => setHeaderDatasetOpen(!headerDatasetOpen)}
                  aria-haspopup="true"
                  aria-expanded={headerDatasetOpen}
                  aria-label={`Active dataset: ${datasetId}. Switch dataset`}
                  className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-mono border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-primary)] cursor-pointer transition-all hover:border-[var(--tt-border-strong)] whitespace-nowrap"
                  title={
                    activeDataset
                      ? `${datasetId} — ${activeDataset.total_rows.toLocaleString()} rows · ${activeDataset.total_cols || activeColumns.length} cols`
                      : 'Switch Active Dataset'
                  }
                >
                  <span className="w-2 h-2 rounded-full bg-[#2DD4BF] shrink-0" />
                  <span className="font-semibold max-w-[140px] sm:max-w-[200px] lg:max-w-[240px] truncate">
                    {datasetId}
                  </span>
                  {activeDataset && (
                    <span className="hidden xl:inline-flex items-center gap-1.5 pl-1.5 border-l border-[var(--tt-border-subtle)] text-[11px] text-[var(--tt-text-muted)] font-normal">
                      <span>{activeDataset.total_rows.toLocaleString()}r</span>
                      {activeDataset.data_health_score !== undefined && (
                        <span
                          className={`font-semibold ${
                            activeDataset.data_health_score >= 80
                              ? 'text-emerald-500 dark:text-[#34D399]'
                              : activeDataset.data_health_score >= 50
                              ? 'text-amber-500'
                              : 'text-red-500'
                          }`}
                        >
                          {Math.round(activeDataset.data_health_score)}%
                        </span>
                      )}
                    </span>
                  )}
                  <ChevronDown className={`w-3 h-3 text-[var(--tt-text-muted)] shrink-0 transition-transform ${headerDatasetOpen ? 'rotate-180' : ''}`} />
                </button>

                {headerDatasetOpen && (
                  <div
                    id="header-dataset-dropdown-panel"
                    className="absolute left-0 top-full mt-1.5 w-76 rounded-2xl border border-[var(--tt-border-strong)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-floating)] p-2.5 z-50 flex flex-col gap-2 animate-in fade-in"
                  >
                    {/* Search Bar */}
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] text-xs">
                      <Search className="w-3 h-3 text-[#0D9488]" />
                      <input
                        type="text"
                        value={datasetSearch}
                        onChange={(e) => setDatasetSearch(e.target.value)}
                        placeholder="Search tables..."
                        aria-label="Search tables"
                        className="w-full bg-transparent outline-none text-xs text-[var(--tt-text-primary)] placeholder-[var(--tt-text-muted)]"
                        autoFocus
                      />
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 border-b border-[var(--tt-border-subtle)] pb-1.5">
                      <button
                        type="button"
                        onClick={() => setFilterType('all')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'all' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                          }`}
                      >
                        All ({datasets.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('clean')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'clean' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                          }`}
                      >
                        Cleaned
                      </button>
                      <button
                        type="button"
                        onClick={() => setFilterType('raw')}
                        className={`px-2 py-0.5 rounded text-[10px] font-medium cursor-pointer transition-colors ${filterType === 'raw' ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold' : 'text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)]'
                          }`}
                      >
                        Raw
                      </button>
                    </div>

                    {/* Table List */}
                    <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-0.5">
                      {filteredDatasets.length === 0 ? (
                        <div className="text-center py-4 text-xs text-[var(--tt-text-muted)]">
                          No tables matched
                        </div>
                      ) : (
                        filteredDatasets.map((d) => {
                          const isSelected = d.dataset_id === datasetId;
                          const isClean = d.dataset_id.toLowerCase().includes('clean');
                          return (
                            <button
                              key={d.dataset_id}
                              type="button"
                              onClick={() => {
                                setDatasetId(d.dataset_id);
                                setHeaderDatasetOpen(false);
                                toast.info('Active Dataset Switched', `Now querying ${d.dataset_id}`);
                              }}
                              className={`flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer text-xs ${isSelected ? 'bg-[#0D9488]/15 text-[#0D9488] font-semibold' : 'hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-primary)]'
                                }`}
                            >
                              <div className="flex flex-col truncate pr-2">
                                <span className="truncate font-semibold">{d.dataset_id}</span>
                                <span className="text-[10px] text-[var(--tt-text-muted)]">
                                  {d.total_rows.toLocaleString()} rows · {d.total_cols} cols
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${isClean ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'
                                    }`}
                                >
                                  {isClean ? 'Clean' : 'Raw'}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-[#0D9488]" />}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Workspace Actions + System Utilities */}
          <div className="flex items-center gap-2 shrink-0">
            {activeTab === 'studio' && (
              <>
                <button
                  type="button"
                  onClick={toggleSchemaInspector}
                  aria-pressed={schemaInspectorOpen}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-mono font-semibold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                    schemaInspectorOpen
                      ? 'border-[#0D9488] bg-[#0D9488]/15 text-[#0D9488] dark:text-[#2DD4BF] dark:border-[#2DD4BF]/50'
                      : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] text-[var(--tt-text-secondary)] hover:text-[#0D9488] dark:hover:text-[#2DD4BF] hover:border-[#0D9488]/40'
                  }`}
                  title="Inspect Schema & Column Statistics"
                >
                  <Columns3 className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                  <span>Schema{activeColumns.length > 0 ? ` (${activeColumns.length})` : ''}</span>
                </button>

                <button
                  type="button"
                  onClick={clearMessages}
                  className="hidden sm:inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)] cursor-pointer transition-all whitespace-nowrap shrink-0"
                  title="Start a new analytical query"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                  <span>New Query</span>
                </button>

                <div className="hidden sm:block h-4 w-px bg-[var(--tt-border-subtle)] mx-0.5 shrink-0" />
              </>
            )}

            {/* Compact BYOK & Quota Pill */}
            <button
              type="button"
              onClick={() => setApiKeyModalOpen(true)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border text-xs font-mono font-medium cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                hasCustomKey || quotaStatus?.byok_active
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-secondary)] hover:text-[var(--tt-text-primary)]'
              }`}
              title={
                hasCustomKey || quotaStatus?.byok_active
                  ? 'BYOK Mode Active: Unlimited queries using your private key'
                  : `Free Daily Quota: ${quotaStatus?.remaining ?? 20} queries remaining today (Click to add your own Gemini key)`
              }
            >
              {hasCustomKey || quotaStatus?.byok_active ? (
                <>
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="font-semibold text-emerald-400">BYOK</span>
                </>
              ) : (
                <>
                  <Key className="w-3.5 h-3.5 text-[#0D9488] shrink-0" />
                  <span className="font-semibold text-[#0D9488]">{quotaStatus?.remaining ?? 20}</span>
                  <span className="hidden md:inline text-[var(--tt-text-muted)]">left</span>
                </>
              )}
            </button>

            {/* Theme Toggle Icon Button */}
            <ThemeToggle />

            {/* Logged-In User Profile & Account Menu */}
            {isAuthEnabled ? (
              <div className="flex items-center pl-0.5 shrink-0">
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: 'w-8 h-8 ring-2 ring-[#0D9488]/40 hover:scale-105 transition-transform shadow-[var(--tt-shadow-card)]',
                      userButtonPopoverCard: 'bg-[#112022] border border-[#2DD4BF]/25 shadow-2xl rounded-2xl text-[#F0FDFA]',
                      userButtonPopoverActionButton: 'text-[#F0FDFA] hover:bg-[#182F32] hover:text-[#2DD4BF]',
                      userButtonPopoverActionButtonText: 'text-xs text-[#F0FDFA]',
                      userButtonPopoverFooter: 'hidden',
                    }
                  }}
                />
              </div>
            ) : (
              <div className="relative shrink-0" ref={userDropdownRef}>
                <button
                  type="button"
                  id="user-profile-menu-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  aria-haspopup="true"
                  aria-expanded={userDropdownOpen}
                  aria-label="Account menu"
                  className="relative flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] cursor-pointer hover:border-[var(--tt-border-strong)] transition-all group select-none"
                  title="User Profile & Session (Active Analyst)"
                >
                  <span className="font-extrabold text-[11px] text-[#0D9488] group-hover:scale-105 transition-transform">
                    TT
                  </span>
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[var(--tt-bg-surface)]" />
                </button>

                {/* User Profile Popover */}
                {userDropdownOpen && (
                  <div
                    id="user-profile-dropdown-panel"
                    className="absolute right-0 top-full mt-1.5 w-68 rounded-2xl border border-[var(--tt-border-strong)] bg-[var(--tt-bg-surface)] shadow-[var(--tt-shadow-floating)] p-3 z-50 flex flex-col gap-2.5 animate-in fade-in select-none"
                  >
                    {/* User Profile Header */}
                    <div className="flex items-center gap-3 pb-2.5 border-b border-[var(--tt-border-subtle)]">
                      <div className="w-10 h-10 rounded-full bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488] font-extrabold text-sm flex items-center justify-center shrink-0">
                        TT
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-[var(--tt-text-primary)] truncate">Data Analyst</span>
                          <span className="bg-emerald-500/15 text-emerald-500 text-[9px] font-bold uppercase px-1.5 py-0.2 rounded border border-emerald-500/30">
                            Admin
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--tt-text-muted)] truncate font-mono">
                          analyst@tabletell.local
                        </span>
                      </div>
                    </div>

                    {/* Active Workspace & Engine Details */}
                    <div className="flex flex-col gap-1 text-[11px] text-[var(--tt-text-secondary)] font-mono">
                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-[var(--tt-bg-canvas)]">
                        <span className="text-[var(--tt-text-muted)]">Engine:</span>
                        <span className="font-semibold text-[#0D9488]">DuckDB Vectorized</span>
                      </div>
                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-[var(--tt-bg-canvas)]">
                        <span className="text-[var(--tt-text-muted)]">Active Table:</span>
                        <span className="font-semibold text-[var(--tt-text-primary)] truncate max-w-[120px]">{datasetId}</span>
                      </div>
                      <div className="flex items-center justify-between py-1 px-2 rounded-lg bg-[var(--tt-bg-canvas)]">
                        <span className="text-[var(--tt-text-muted)]">Auth State:</span>
                        <span className="flex items-center gap-1 text-emerald-500 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                          Persistent Session
                        </span>
                      </div>
                    </div>

                    {/* Quick Session Actions */}
                    <div className="pt-1.5 border-t border-[var(--tt-border-subtle)] flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          toast.info('Active Account', 'You are logged in with Administrative privileges');
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-text-primary)] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-[var(--tt-text-muted)]" />
                          <span>Analyst Profile</span>
                        </div>
                        <span className="text-[10px] text-[var(--tt-text-muted)]">Verified</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setUserDropdownOpen(false);
                          toast.success('Session Active', 'Authentication state remains intact');
                        }}
                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Logged In (Session Intact)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className={`flex-1 min-h-0 ${activeTab === 'studio' ? 'h-full overflow-hidden p-3 sm:p-4' : 'overflow-y-auto p-6 lg:p-8'}`}>
          {children}
        </div>
      </main>

      {/* AI Engine & BYOK Quota Modal */}
      <ApiKeyModal isOpen={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
    </div>
  );
};

