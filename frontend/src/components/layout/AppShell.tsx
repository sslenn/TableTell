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
  Home
} from 'lucide-react';
import { useAppStore, type AppTab } from '../../store/useAppStore';
import { BrandLogo } from '../common/BrandLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { ToastContainer } from '../common/ToastContainer';
import { TableTellAssistant } from '../assistant/TableTellAssistant';
import { fetchDatasets } from '../../lib/api';
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
    clearMessages
  } = useAppStore();

  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [headerDatasetOpen, setHeaderDatasetOpen] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'clean' | 'raw'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const headerDatasetRef = useRef<HTMLDivElement>(null);
  const userDropdownRef = useRef<HTMLDivElement>(null);

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

  // Keyboard shortcut Ctrl+B / Cmd+B for sidebar toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
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
      .catch((err) => console.error('Failed to load datasets:', err));
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
            <div
              className="flex items-center gap-3 cursor-pointer group min-w-0"
              onClick={() => setActiveTab('studio')}
              title="TableTell — Data Analyst Assistant"
            >
              <BrandLogo
                size={sidebarCollapsed ? 32 : 36}
                variant="tabletell-badge"
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
                  <div className="text-[11px] font-medium text-[var(--tt-text-muted)] tracking-tight truncate leading-normal select-none">
                    Data Analyst Assistant
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] text-xs cursor-pointer text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:bg-[var(--tt-bg-elevated)] transition-all shrink-0 ml-1"
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Active Workspace Card & Dropdown */}
          {!sidebarCollapsed ? (
            <div className="relative" ref={dropdownRef}>
              <div className="text-[10px] font-semibold text-[var(--tt-text-muted)] tracking-wider uppercase mb-1.5 px-0.5">
                ACTIVE WORKSPACE
              </div>

              <button
                type="button"
                onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs transition-all cursor-pointer shadow-[var(--tt-shadow-card)]"
              >
                <div className="flex items-center gap-2.5 truncate">
                  <div className="w-6 h-6 rounded-lg bg-[var(--tt-bg-elevated)] border border-[var(--tt-border-subtle)] flex items-center justify-center shrink-0 text-[#0D9488]">
                    <Database className="w-3.5 h-3.5" />
                  </div>
                  <span className="truncate font-semibold text-[var(--tt-text-primary)]">TableTell Workspace</span>
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
              title={`Active: ${datasetId} (Click to expand)`}
              className="flex items-center justify-center p-2.5 rounded-xl border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
            >
              <Database className="w-4 h-4 text-[#0D9488]" />
            </button>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-semibold text-[var(--tt-text-muted)] tracking-wider uppercase mb-1 px-0.5">
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
                  className={`flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-3 px-3 py-2.5'
                    } rounded-xl text-xs font-medium transition-all text-left cursor-pointer ${isActive
                      ? 'bg-[#0D9488]/15 text-[#0D9488] font-bold'
                      : 'text-[var(--tt-text-secondary)] hover:bg-[var(--tt-bg-elevated)] hover:text-[var(--tt-text-primary)]'
                    }`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#0D9488]' : 'text-[var(--tt-text-muted)]'}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="pt-3 border-t border-[var(--tt-border-subtle)]">
          {sidebarCollapsed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-canvas)] cursor-pointer text-[var(--tt-text-muted)] hover:text-[var(--tt-text-primary)] hover:border-[var(--tt-border-strong)] transition-all"
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
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main App Workspace */}
      <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[var(--tt-bg-canvas)]">
        {/* Top Header */}
        <header className="h-14 shrink-0 border-b border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] flex items-center justify-between px-6 transition-all select-none">
          {/* Left: Breadcrumbs & Dataset Quick Switcher */}
          <div className="flex items-center gap-2.5">
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border border-[var(--tt-border-subtle)] text-xs cursor-pointer hover:bg-[var(--tt-bg-elevated)] transition-all mr-1 text-[var(--tt-text-muted)]"
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-3.5 h-3.5 text-[#0D9488]" />
              </button>
            )}

            {/* Breadcrumb Trail */}
            <div className="flex items-center gap-2 text-xs text-[var(--tt-text-muted)]">
              <button
                type="button"
                onClick={() => setActiveTab('studio')}
                className="hover:text-[var(--tt-text-primary)] cursor-pointer flex items-center p-1.5 rounded-lg border border-transparent hover:border-[var(--tt-border-subtle)] hover:bg-[var(--tt-bg-elevated)] transition-all"
                title="Go to Ask & Analyze (Home)"
              >
                <Home className="w-3.5 h-3.5 text-[var(--tt-text-muted)] hover:text-[#0D9488] transition-colors" />
              </button>

              <ChevronRight className="w-3.5 h-3.5 text-[var(--tt-text-muted)] opacity-40 shrink-0" />

              {/* Active Section Label with Tab Icon */}
              {(() => {
                const currentNav = navItems.find((n) => n.id === activeTab);
                const NavIcon = currentNav?.icon || MessageSquare;
                return (
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--tt-text-secondary)]">
                    <NavIcon className="w-3.5 h-3.5 text-[#0D9488]" />
                    <span className="hidden sm:inline">{currentNav?.label || 'Overview'}</span>
                  </div>
                );
              })()}

              <ChevronRight className="w-3.5 h-3.5 text-[var(--tt-text-muted)] opacity-40 shrink-0" />

              {/* Dataset Switcher Pill with its OWN anchored Dropdown */}
              <div className="relative" ref={headerDatasetRef}>
                <button
                  type="button"
                  id="header-dataset-selector-btn"
                  onClick={() => setHeaderDatasetOpen(!headerDatasetOpen)}
                  className="inline-flex items-center gap-2 h-8 px-2.5 rounded-lg text-xs font-semibold border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-[var(--tt-text-primary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)]"
                  title="Switch Active Dataset"
                >
                  <Database className="w-3.5 h-3.5 text-[#0D9488]" />
                  <span className="max-w-[140px] sm:max-w-[200px] md:max-w-[260px] truncate">{datasetId}</span>
                  <ChevronDown className={`w-3 h-3 text-[var(--tt-text-muted)] transition-transform ${headerDatasetOpen ? 'rotate-180' : ''}`} />
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

          {/* Right: Actions, Connected Badge, and User Avatar */}
          <div className="flex items-center gap-2.5">
            {/* Quick Action: New Query (Studio) */}
            {activeTab === 'studio' && (
              <button
                type="button"
                onClick={clearMessages}
                className="hidden sm:flex items-center gap-1.5 h-8 px-3 py-1 rounded-lg border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] text-xs font-medium text-[var(--tt-text-secondary)] cursor-pointer transition-all shadow-[var(--tt-shadow-card)]"
                title="Start a new analytical query"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#0D9488]" />
                <span>New Query</span>
              </button>
            )}

            {/* Theme Toggle Button */}
            <ThemeToggle />

            {/* Logged-In User Profile & Account Menu */}
            {isAuthEnabled ? (
              <div className="flex items-center pl-1">
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
              <div className="relative" ref={userDropdownRef}>
                <button
                  type="button"
                  id="user-profile-menu-btn"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                  className="flex items-center gap-2 h-8 pl-1.5 pr-2.5 py-0.5 rounded-full border border-[var(--tt-border-subtle)] bg-[var(--tt-bg-surface)] hover:bg-[var(--tt-bg-elevated)] cursor-pointer shadow-[var(--tt-shadow-card)] hover:border-[var(--tt-border-strong)] transition-all group select-none"
                  title="User Profile & Session (Active Analyst)"
                >
                  {/* Avatar with Online Indicator */}
                  <div className="relative">
                    <div className="w-6 h-6 rounded-full bg-[#0D9488]/15 border border-[#0D9488]/30 text-[#0D9488] font-extrabold text-[11px] flex items-center justify-center group-hover:scale-105 transition-transform">
                      TT
                    </div>
                    <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-[#10B981] ring-2 ring-[var(--tt-bg-surface)]" />
                  </div>

                  {/* User Name & Status */}
                  <div className="hidden sm:flex items-center gap-1.5 text-left">
                    <span className="text-xs font-bold leading-tight text-[var(--tt-text-primary)]">
                      Analyst
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  </div>

                  <ChevronDown
                    className={`w-3 h-3 text-[var(--tt-text-muted)] transition-transform ${userDropdownOpen ? 'rotate-180' : ''
                      }`}
                  />
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
    </div>
  );
};

