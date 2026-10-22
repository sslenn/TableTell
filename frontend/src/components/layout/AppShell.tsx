import React, { useEffect, useState, useRef } from 'react';
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
  Zap,
  PlusCircle,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { useAppStore, type AppTab } from '../../store/useAppStore';
import { BrandLogo, type LogoVariant } from '../common/BrandLogo';
import { ThemeToggle } from '../common/ThemeToggle';
import { ToastContainer } from '../common/ToastContainer';
import { fetchDatasets } from '../../lib/api';
import { toast } from '../../store/useToastStore';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
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
    logoVariant,
    setLogoVariant
  } = useAppStore();

  const [datasetDropdownOpen, setDatasetDropdownOpen] = useState(false);
  const [logoDropdownOpen, setLogoDropdownOpen] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'clean' | 'raw'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const logoDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDatasetDropdownOpen(false);
      }
      if (logoDropdownRef.current && !logoDropdownRef.current.contains(event.target as Node)) {
        setLogoDropdownOpen(false);
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

  const logoOptions: { id: LogoVariant; title: string; category: string; subtitle: string }[] = [
    {
      id: 'speech-grid',
      title: 'Speech Grid',
      category: 'Conversational',
      subtitle: 'Table columns inside a speech bubble ("Chat with your data")'
    },
    {
      id: 'agent-loop',
      title: 'Agent Loop',
      category: 'Autonomous AI',
      subtitle: 'Self-healing LangGraph infinity loop with state node checkpoints'
    },
    {
      id: 'synapse-matrix',
      title: 'Synapse Matrix',
      category: 'Neural Reasoning',
      subtitle: '3x3 structured table connected by glowing AI synapse pathways'
    },
    {
      id: 'story-quill',
      title: 'Story Quill',
      category: 'Narrative',
      subtitle: 'Ascending columnar data bars forming an executive narrative quill'
    },
    {
      id: 'columnar-t',
      title: 'Columnar T',
      category: 'Monogram',
      subtitle: 'Clean geometric "T" combining table header & DuckDB column pillars'
    },
    {
      id: 'insight-spark',
      title: 'Insight Spark',
      category: 'Intelligence',
      subtitle: 'Structured table grid cells morphing into an AI intelligence spark'
    },
    {
      id: 'radar-beacon',
      title: 'Radar Beacon',
      category: 'Telemetry',
      subtitle: 'Telemetry scanner identifying anomalies & coordinate signals in real time'
    },
    {
      id: 'aperture-focus',
      title: 'Aperture Focus',
      category: 'Precision',
      subtitle: 'Multi-blade optical iris focusing in on the single core metric truth'
    },
    {
      id: 'waveform-table',
      title: 'Waveform Table',
      category: 'Storytelling',
      subtitle: 'High-contrast Obsidian badge with analytical storytelling wavebars'
    },
    {
      id: 'prism-table',
      title: 'Prism Table',
      category: '3D OLAP',
      subtitle: 'Isometric dimensional data cube with etched matrix coordinate lines'
    },
    {
      id: 'nested-tt',
      title: 'Nested TT',
      category: 'Monogram',
      subtitle: 'Precision dual-T monogram capturing the TableTell identity'
    },
    {
      id: 'growth-chevron',
      title: 'Growth Chevron',
      category: 'Performance',
      subtitle: 'Ascending columnar vectors symbolizing speed & business growth'
    }
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

  const activeDatasetObj = datasets.find((d) => d.dataset_id === datasetId);

  return (
    <div className="flex h-screen w-screen overflow-hidden select-none" style={{ backgroundColor: 'var(--tt-bg-canvas)' }}>
      {/* Toast Notification Container */}
      <ToastContainer />

      {/* Left Navigation Sidebar */}
      <aside
        className={`${
          sidebarCollapsed ? 'w-16' : 'w-64'
        } shrink-0 flex flex-col justify-between border-r p-3 transition-all duration-300 relative`}
        style={{
          backgroundColor: 'var(--tt-bg-surface)',
          borderColor: 'var(--tt-border-subtle)'
        }}
      >
        <div className="flex flex-col gap-4">
          {/* Brand Lockup */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-1`}>
            <div
              className="flex items-center gap-2.5 cursor-pointer"
              onClick={() => setActiveTab('studio')}
            >
              <BrandLogo size={sidebarCollapsed ? 30 : 34} variant={logoVariant} />
              {!sidebarCollapsed && (
                <div>
                  <div
                    className="font-extrabold text-base tracking-tight leading-none"
                    style={{ color: 'var(--tt-text-primary)', fontFamily: 'Plus Jakarta Sans, sans-serif' }}
                  >
                    TableTell
                  </div>
                  <div className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--tt-text-muted)' }}>
                    Autonomous Data Analyst
                  </div>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1 rounded-md border text-xs cursor-pointer opacity-70 hover:opacity-100 hover:border-[#2DD4BF] transition-all"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
                title="Collapse sidebar (Ctrl+B)"
              >
                <PanelLeftClose className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Searchable Dataset Combobox */}
          {!sidebarCollapsed ? (
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between px-1 mb-1">
                <span className="text-[10px] font-mono font-bold tracking-wider uppercase" style={{ color: 'var(--tt-text-muted)' }}>
                  Active Workspace
                </span>
                <span className="text-[10px] font-mono opacity-60" style={{ color: 'var(--tt-text-muted)' }}>
                  {datasets.length} tables
                </span>
              </div>

              <button
                type="button"
                onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
                className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl border text-xs font-mono transition-all cursor-pointer hover:border-[#2DD4BF] shadow-xs"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: datasetDropdownOpen ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-primary)'
                }}
              >
                <div className="flex items-center gap-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-[#34D399] shrink-0" />
                  <span className="truncate font-semibold">{datasetId}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 shrink-0 opacity-70 transition-transform ${datasetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Popover Dropdown Panel */}
              {datasetDropdownOpen && (
                <div
                  className="absolute left-0 top-full mt-1.5 w-72 rounded-2xl border shadow-2xl p-2.5 z-50 flex flex-col gap-2 animate-in fade-in"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-strong)',
                    boxShadow: 'var(--tt-shadow-floating)'
                  }}
                >
                  {/* Search Bar */}
                  <div
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono"
                    style={{
                      backgroundColor: 'var(--tt-bg-elevated)',
                      borderColor: 'var(--tt-border-subtle)',
                      color: 'var(--tt-text-primary)'
                    }}
                  >
                    <Search className="w-3 h-3 opacity-60 text-[#2DD4BF]" />
                    <input
                      type="text"
                      value={datasetSearch}
                      onChange={(e) => setDatasetSearch(e.target.value)}
                      placeholder="Search tables..."
                      className="w-full bg-transparent outline-none text-xs"
                      autoFocus
                    />
                  </div>

                  {/* Classification Filter Tabs */}
                  <div className="flex items-center gap-1 border-b pb-1.5" style={{ borderColor: 'var(--tt-border-subtle)' }}>
                    <button
                      type="button"
                      onClick={() => setFilterType('all')}
                      className="px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors"
                      style={{
                        backgroundColor: filterType === 'all' ? 'var(--tt-primary-subtle)' : 'transparent',
                        color: filterType === 'all' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                        fontWeight: filterType === 'all' ? 700 : 500
                      }}
                    >
                      All ({datasets.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('clean')}
                      className="px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors"
                      style={{
                        backgroundColor: filterType === 'clean' ? 'var(--tt-primary-subtle)' : 'transparent',
                        color: filterType === 'clean' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                        fontWeight: filterType === 'clean' ? 700 : 500
                      }}
                    >
                      Cleaned
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterType('raw')}
                      className="px-2 py-0.5 rounded text-[10px] font-mono cursor-pointer transition-colors"
                      style={{
                        backgroundColor: filterType === 'raw' ? 'var(--tt-primary-subtle)' : 'transparent',
                        color: filterType === 'raw' ? 'var(--tt-primary)' : 'var(--tt-text-muted)',
                        fontWeight: filterType === 'raw' ? 700 : 500
                      }}
                    >
                      Raw
                    </button>
                  </div>

                  {/* Dataset List */}
                  <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-0.5">
                    {filteredDatasets.length === 0 ? (
                      <div className="text-center py-4 text-xs font-mono" style={{ color: 'var(--tt-text-muted)' }}>
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
                            className="flex items-center justify-between p-2 rounded-lg text-left transition-colors cursor-pointer text-xs font-mono group hover:bg-[#2DD4BF]/10"
                            style={{
                              backgroundColor: isSelected ? 'var(--tt-primary-subtle)' : 'transparent',
                              color: isSelected ? 'var(--tt-primary)' : 'var(--tt-text-primary)'
                            }}
                          >
                            <div className="flex flex-col truncate pr-2">
                              <span className="truncate font-semibold">{d.dataset_id}</span>
                              <span className="text-[10px] opacity-60">
                                {d.total_rows.toLocaleString()} rows · {d.total_cols} cols
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase"
                                style={{
                                  backgroundColor: isClean ? 'rgba(52, 211, 153, 0.15)' : 'rgba(251, 146, 60, 0.15)',
                                  color: isClean ? '#34D399' : '#FB923C'
                                }}
                              >
                                {isClean ? 'Clean' : 'Raw'}
                              </span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-[#2DD4BF]" />}
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
              className="flex items-center justify-center p-2.5 rounded-xl border cursor-pointer hover:border-[#2DD4BF] transition-all"
              style={{
                backgroundColor: 'var(--tt-bg-elevated)',
                borderColor: 'var(--tt-border-subtle)',
                color: 'var(--tt-primary)'
              }}
            >
              <Zap className="w-4 h-4 text-[#2DD4BF]" />
            </button>
          )}

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {!sidebarCollapsed && (
              <div
                className="text-[10px] font-mono font-bold tracking-wider uppercase px-1 mb-1"
                style={{ color: 'var(--tt-text-muted)' }}
              >
                Navigation
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
                  className={`flex items-center ${
                    sidebarCollapsed ? 'justify-center px-2 py-2.5' : 'gap-2.5 px-3 py-2'
                  } rounded-xl text-xs font-medium transition-all text-left cursor-pointer hover:border-[#2DD4BF] relative group`}
                  style={{
                    backgroundColor: isActive ? 'var(--tt-primary-subtle)' : 'transparent',
                    color: isActive ? 'var(--tt-primary)' : 'var(--tt-text-secondary)',
                    fontWeight: isActive ? 600 : 500
                  }}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  {/* Glowing active bar on left */}
                  {isActive && !sidebarCollapsed && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#2DD4BF]" />
                  )}
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#2DD4BF]' : 'group-hover:text-[#2DD4BF]'}`} />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="flex flex-col gap-2.5 pt-3 border-t" style={{ borderColor: 'var(--tt-border-subtle)' }}>
          {sidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-md border cursor-pointer hover:border-[#2DD4BF]"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-4 h-4 text-[#2DD4BF]" />
              </button>
              <ThemeToggle />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                  <span className="text-[11px] font-mono" style={{ color: 'var(--tt-text-muted)' }}>
                    DuckDB In-Memory Lake
                  </span>
                </div>
                <ThemeToggle />
              </div>

              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-[11px] font-mono transition-colors hover:border-[#2DD4BF]"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
              >
                <span>FastAPI OpenAPI</span>
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            </>
          )}
        </div>
      </aside>

      {/* Main App Workspace */}
      <main className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
        {/* Top Header */}
        <header
          className="h-14 shrink-0 border-b flex items-center justify-between px-5 transition-all select-none"
          style={{
            backgroundColor: 'var(--tt-bg-surface)',
            borderColor: 'var(--tt-border-subtle)'
          }}
        >
          {/* Left: Breadcrumbs & Dataset Quick Switcher */}
          <div className="flex items-center gap-3">
            {sidebarCollapsed && (
              <button
                type="button"
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg border text-xs cursor-pointer hover:border-cyan-500/50 transition-all mr-1"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
                title="Expand sidebar (Ctrl+B)"
              >
                <PanelLeftOpen className="w-3.5 h-3.5 text-cyan-400" />
              </button>
            )}

            {/* Section Indicator */}
            <div className="flex items-center gap-2">
              <span
                className="text-xs font-semibold tracking-wide flex items-center gap-1.5"
                style={{ color: 'var(--tt-text-muted)' }}
              >
                {(() => {
                  const current = navItems.find((n) => n.id === activeTab);
                  if (!current) return null;
                  const Icon = current.icon;
                  return (
                    <>
                      <Icon className="w-3.5 h-3.5" />
                      <span>{current.label}</span>
                    </>
                  );
                })()}
              </span>

              <ChevronRight className="w-3.5 h-3.5 opacity-30" />

              {/* Dataset Switcher Pill */}
              <button
                type="button"
                onClick={() => setDatasetDropdownOpen(!datasetDropdownOpen)}
                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border cursor-pointer transition-all hover:border-cyan-500/40 hover:bg-slate-800/50"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-primary)'
                }}
                title="Active dataset (click to switch)"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="font-semibold">{datasetId}</span>
                {activeDatasetObj && (
                  <span className="hidden sm:inline-block text-[10px] opacity-60 ml-0.5" style={{ color: 'var(--tt-text-muted)' }}>
                    ({activeDatasetObj.total_rows.toLocaleString()} rows · {activeDatasetObj.total_cols} cols)
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${datasetDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>

          {/* Right: Actions, Logo Selector, and Telemetry Engine Status */}
          <div className="flex items-center gap-2.5">
            {/* Logo Variant Selector Dropdown */}
            <div className="relative" ref={logoDropdownRef}>
              <button
                type="button"
                id="logo-variant-selector-btn"
                onClick={() => setLogoDropdownOpen(!logoDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:border-cyan-500/40"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: logoDropdownOpen ? 'var(--tt-primary)' : 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-primary)'
                }}
                title="Switch Brand Logo Style"
              >
                <BrandLogo size={18} variant={logoVariant} />
                <span className="hidden md:inline font-mono text-[11px]">Logo: {logoOptions.find(l => l.id === logoVariant)?.title.split(' ')[0]}</span>
                <ChevronDown className={`w-3 h-3 opacity-60 transition-transform ${logoDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {logoDropdownOpen && (
                <div
                  id="logo-variant-dropdown-panel"
                  className="absolute right-0 top-full mt-1.5 w-92 max-h-[460px] overflow-y-auto rounded-xl border shadow-2xl p-2 z-50 flex flex-col gap-1.5"
                  style={{
                    backgroundColor: 'var(--tt-bg-surface)',
                    borderColor: 'var(--tt-border-strong)',
                    boxShadow: 'var(--tt-shadow-floating)'
                  }}
                >
                  <div className="sticky top-0 pb-1.5 pt-0.5 px-2 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center justify-between border-b z-10" style={{ color: 'var(--tt-text-muted)', backgroundColor: 'var(--tt-bg-surface)', borderColor: 'var(--tt-border-subtle)' }}>
                    <span>12 Brand Concepts</span>
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                  </div>
                  {logoOptions.map((opt) => {
                    const isSelected = logoVariant === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setLogoVariant(opt.id);
                          setLogoDropdownOpen(false);
                          toast.info(`Logo set to ${opt.title}`);
                        }}
                        className="flex items-start gap-3 p-2.5 rounded-lg text-left transition-all cursor-pointer border"
                        style={{
                          backgroundColor: isSelected ? 'var(--tt-primary-subtle)' : 'var(--tt-bg-elevated)',
                          borderColor: isSelected ? 'var(--tt-primary)' : 'transparent',
                          color: 'var(--tt-text-primary)'
                        }}
                      >
                        <BrandLogo size={28} variant={opt.id} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-semibold">{opt.title}</span>
                            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'var(--tt-bg-surface)', color: 'var(--tt-text-muted)', border: '1px solid var(--tt-border-subtle)' }}>
                              {opt.category}
                            </span>
                          </div>
                          <p className="text-[10px] leading-relaxed mt-0.5 line-clamp-2" style={{ color: 'var(--tt-text-muted)' }}>
                            {opt.subtitle}
                          </p>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-1" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Action: New Query (Studio) */}
            {activeTab === 'studio' && (
              <button
                type="button"
                onClick={clearMessages}
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:border-cyan-500/50"
                style={{
                  backgroundColor: 'var(--tt-bg-elevated)',
                  borderColor: 'var(--tt-border-subtle)',
                  color: 'var(--tt-text-secondary)'
                }}
                title="Start a new analytical query"
              >
                <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>New Query</span>
              </button>
            )}

            {/* Live Engine Indicator */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono"
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                borderColor: 'rgba(16, 185, 129, 0.25)',
                color: '#10B981'
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-semibold hidden md:inline">DuckDB</span>
              <span className="text-[10px] opacity-80 font-mono">0.4ms</span>
            </div>
          </div>
        </header>

        {/* Dynamic Tab Body: Fixed for Studio, Scrollable for other tabs */}
        <div className={`flex-1 min-h-0 ${activeTab === 'studio' ? 'h-full overflow-hidden p-3 sm:p-4' : 'overflow-y-auto p-5'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
