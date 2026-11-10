import React, { useEffect, useRef, useState } from 'react';
import { WaveformTableLogo } from '../common/BrandLogo';

interface LandingPageProps {
  onLaunchStudio: (datasetId?: string, suggestedQuery?: string) => void;
  onSignIn: () => void;
}

const HEALTH_DIMENSIONS: [string, number][] = [
  ['Completeness', 92],
  ['Validity', 88],
  ['Consistency', 84],
  ['Uniqueness', 97],
  ['Anomaly', 71],
];

const BAR_PREVIEW: { height: number; color: string; isAlert?: boolean }[] = [
  { height: 62, color: '#38BDF8' },
  { height: 48, color: '#38BDF8' },
  { height: 100, color: '#F87171', isAlert: true },
  { height: 55, color: '#38BDF8' },
  { height: 40, color: '#38BDF8' },
];

const HERO_REGIONS: { label: string; heightPx: number; gradient: string; delayMs: number }[] = [
  { label: 'APAC', heightPx: 92, gradient: 'linear-gradient(#2DD4BF, #0D9488)', delayMs: 0 },
  { label: 'EU', heightPx: 72, gradient: 'linear-gradient(#38BDF8, #0284C7)', delayMs: 100 },
  { label: 'NA', heightPx: 56, gradient: 'linear-gradient(#38BDF8, #0284C7)', delayMs: 200 },
  { label: 'LATAM', heightPx: 32, gradient: 'linear-gradient(#FBBF24, #D97706)', delayMs: 300 },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onLaunchStudio, onSignIn }) => {
  const [scrolled, setScrolled] = useState(false);
  const [activeNav, setActiveNav] = useState<'how' | 'trust' | 'docs'>('how');
  const [activeSteps, setActiveSteps] = useState<boolean[]>([false, false, false, false]);
  const [spineHeight, setSpineHeight] = useState<number>(0);
  const [typedQuery, setTypedQuery] = useState('');
  const [heroDemoReady, setHeroDemoReady] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineWrapRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pillRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Hero typewriter effect
  useEffect(() => {
    const fullText = 'Which region drives the most revenue?';
    let idx = 0;
    setTypedQuery('');
    setHeroDemoReady(false);

    const interval = window.setInterval(() => {
      idx += 1;
      setTypedQuery(fullText.slice(0, idx));
      if (idx >= fullText.length) {
        window.clearInterval(interval);
        window.setTimeout(() => setHeroDemoReady(true), 260);
      }
    }, 34);

    return () => window.clearInterval(interval);
  }, []);

  // Tighten floating pill nav on scroll
  useEffect(() => {
    const el = containerRef.current;
    const handleScroll = () => {
      const y = el ? el.scrollTop : window.scrollY;
      setScrolled(y > 40);
    };
    el?.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      el?.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Scroll-driven timeline observer
  useEffect(() => {
    const rows = rowRefs.current.filter(Boolean) as HTMLDivElement[];
    if (rows.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.25) return;
          const idx = Number((entry.target as HTMLElement).dataset.stepIndex);
          if (Number.isNaN(idx)) return;

          setActiveSteps((prev) => {
            if (prev[idx]) return prev;
            const next = [...prev];
            for (let i = 0; i <= idx; i++) next[i] = true;
            return next;
          });

          const rowEl = rowRefs.current[idx];
          const pillEl = pillRefs.current[idx];
          if (rowEl && pillEl) {
            const targetH = rowEl.offsetTop + pillEl.offsetTop + pillEl.offsetHeight / 2;
            setSpineHeight((prev) => Math.max(prev, targetH));
          }
        });
      },
      { threshold: [0, 0.25, 0.55] }
    );

    rows.forEach((r) => observer.observe(r));
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string, navKey?: 'how' | 'trust' | 'docs') => {
    if (navKey) setActiveNav(navKey);
    if (id === 'top') {
      containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const target = document.getElementById(id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div
      ref={containerRef}
      className="h-screen w-screen overflow-y-auto overflow-x-hidden bg-[#0B1015] text-[#F8FAFC] antialiased selection:bg-[#2DD4BF]/25 selection:text-[#5EEAD4]"
      style={{
        fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        backgroundImage:
          'linear-gradient(rgba(45,212,191,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.055) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }}
    >
      {/* Ambient Radial Top Glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-[420px] z-0"
        style={{
          background: 'radial-gradient(700px 320px at 65% 12%, rgba(45,212,191,0.12), transparent 70%)',
        }}
      />

      {/* ===================== FLOATING PILL NAVBAR ===================== */}
      <header className="sticky top-3 z-50 px-6 sm:px-10 lg:px-16 xl:px-20 pt-3">
        <nav
          aria-label="Primary"
          className={`relative mx-auto flex items-center justify-between gap-3 px-3 py-2 rounded-full border border-[#24303F] bg-[#131A22]/75 backdrop-blur-xl transition-all duration-500 ${
            scrolled
              ? 'max-w-6xl shadow-[0_14px_34px_-12px_rgba(0,0,0,0.65),0_0_24px_-6px_rgba(45,212,191,0.3)] border-[#2DD4BF]/30'
              : 'max-w-[1440px] shadow-[0_10px_28px_-12px_rgba(0,0,0,0.45)]'
          }`}
        >
          {/* Top hairline gradient accent */}
          <div
            className="pointer-events-none absolute inset-x-10 -top-[1px] h-[1px]"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(45,212,191,0.55), transparent)',
            }}
          />

          {/* Left: Brand */}
          <div className="flex items-center gap-2.5 pl-2">
            <button
              type="button"
              onClick={() => scrollToSection('top')}
              className="flex items-center gap-2.5 cursor-pointer group text-left rounded-full focus:outline-none"
            >
              <WaveformTableLogo size={28} className="transition-transform group-hover:scale-105" />
              <span className="font-bold tracking-tight text-[#F8FAFC] text-base">TableTell</span>
            </button>
          </div>

          {/* Center: Navigation Links */}
          <div className="hidden md:flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => scrollToSection('how-it-works', 'how')}
              className={`text-sm px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                activeNav === 'how'
                  ? 'text-[#F8FAFC] bg-[#2DD4BF]/15 font-medium'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#2DD4BF]/10'
              }`}
            >
              How it works
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('receipt-trace', 'trust')}
              className={`text-sm px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                activeNav === 'trust'
                  ? 'text-[#F8FAFC] bg-[#2DD4BF]/15 font-medium'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#2DD4BF]/10'
              }`}
            >
              Trust
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('cli-footer', 'docs')}
              className={`text-sm px-3.5 py-1.5 rounded-full transition-colors cursor-pointer ${
                activeNav === 'docs'
                  ? 'text-[#F8FAFC] bg-[#2DD4BF]/15 font-medium'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#2DD4BF]/10'
              }`}
            >
              Docs
            </button>
          </div>

          {/* Right: Sign in + Try free */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onSignIn}
              className="hidden sm:inline-block text-sm px-3.5 py-1.5 rounded-full text-[#94A3B8] hover:text-[#F8FAFC] transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => onLaunchStudio('ecommerce_sales')}
              className="text-sm font-bold px-4 py-2 rounded-full text-[#041A1C] cursor-pointer transition-all hover:-translate-y-0.5 hover:brightness-110 shadow-[0_4px_16px_rgba(45,212,191,0.35)]"
              style={{
                background: 'linear-gradient(135deg, #0D9488 0%, #2DD4BF 100%)',
              }}
            >
              Try free
            </button>
          </div>
        </nav>
      </header>

      {/* ===================== MAIN CONTENT ===================== */}
      <main className="relative z-10 w-full max-w-[1440px] mx-auto px-6 sm:px-10 lg:px-16 xl:px-20">
        {/* HERO: TWO-COLUMN TELEMETRY STUDIO DEMO + 3 PILLARS */}
        <section className="pt-10 pb-8">
          <div className="grid md:grid-cols-2 gap-10 lg:gap-16 items-center pb-14">
            {/* Left Column: Headline & Actions */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.08] text-[#F8FAFC]">
                Ask your data.
                <br />
                <span
                  style={{
                    background: 'linear-gradient(90deg, #2DD4BF 0%, #38BDF8 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  Get computed answers.
                </span>
              </h1>

              <p className="mt-5 text-base sm:text-lg leading-relaxed max-w-xl text-[#CBD5E1]">
                TableTell audits and cleans your raw spreadsheets into analysis-ready data, then
                turns plain-English questions into verified DuckDB SQL and charts you can audit.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onLaunchStudio('retail_superstore_sales', 'Which sub-category has the lowest profit margin and discount leak?')
                  }
                  className="px-5 py-2.5 rounded-lg font-semibold text-sm text-[#041A1C] cursor-pointer transition-all hover:-translate-y-0.5 hover:brightness-110 shadow-[0_6px_20px_rgba(45,212,191,0.35)]"
                  style={{
                    background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
                  }}
                >
                  Analyze Superstore Demo (10k rows) →
                </button>
                <button
                  type="button"
                  onClick={() => scrollToSection('how-it-works', 'how')}
                  className="px-5 py-2.5 rounded-lg text-sm border border-[#3B4B5E] text-[#F8FAFC] hover:border-[#2DD4BF] transition-colors cursor-pointer"
                >
                  Watch 60s demo
                </button>
              </div>

              {/* Instant 1-Click Portfolio Demo Datasets */}
              <div className="mt-5 flex flex-col gap-2">
                <span className="text-xs font-semibold text-[#2DD4BF] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#2DD4BF] animate-ping" />
                  One-Click Benchmark Datasets (No Upload Required):
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('retail_superstore_sales', 'Which sub-category has the lowest profit margin?')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#2DD4BF]/40 bg-[#2DD4BF]/10 hover:bg-[#2DD4BF]/20 text-xs font-mono text-[#F8FAFC] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>⚡ Superstore Sales</span>
                    <span className="text-[10px] text-[#2DD4BF] font-semibold">(10k rows)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('ecommerce_customer_churn', 'Compare customer churn rate by complaint and tenure cohort')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#38BDF8]/40 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-xs font-mono text-[#F8FAFC] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>⚡ Customer Churn</span>
                    <span className="text-[10px] text-[#38BDF8] font-semibold">(5k rows)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('saas_subscription_financials', 'What percentage of ARR comes from Enterprise tier and what are the LTV to CAC ratios?')}
                    className="px-2.5 py-1.5 rounded-lg border border-[#FBBF24]/40 bg-[#FBBF24]/10 hover:bg-[#FBBF24]/20 text-xs font-mono text-[#F8FAFC] transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
                  >
                    <span>⚡ SaaS Financials</span>
                    <span className="text-[10px] text-[#FBBF24] font-semibold">(1.2k rows)</span>
                  </button>
                </div>
              </div>

              <div className="mt-6 font-mono text-xs flex gap-5 text-[#94A3B8]">
                <span>CSV · XLSX · PARQUET</span>
                <span>NO SQL NEEDED</span>
              </div>
            </div>

            {/* Right Column: Live Studio Terminal Window */}
            <div className="rounded-xl p-4 bg-[#131A22] border border-[#24303F] shadow-[0_20px_35px_-5px_rgba(0,0,0,0.9),0_0_0_1px_rgba(45,212,191,0.12)]">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F87171]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FBBF24]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#34D399]" />
                <span className="font-mono text-xs ml-2 text-[#94A3B8]">
                  studio · ecommerce_sales_v2
                </span>
              </div>

              {/* Prompt Input Box */}
              <div className="rounded-lg px-3 py-2.5 text-sm bg-[#0B1015] border border-[#24303F]">
                <span className="text-[#5EEAD4]">›</span>{' '}
                <span className="text-[#F8FAFC]">{typedQuery}</span>
                <span className="text-[#2DD4BF] animate-pulse ml-0.5">▍</span>
              </div>

              {/* Generated SQL + Animated Chart Output */}
              <div
                className={`transition-opacity duration-500 ${
                  heroDemoReady ? 'opacity-100' : 'opacity-0'
                }`}
              >
                <div className="mt-3 font-mono text-xs leading-relaxed rounded-lg p-3 bg-[#0B1015] text-[#CBD5E1] border border-[#24303F]">
                  <span className="text-[#38BDF8]">SELECT</span> region,{' '}
                  <span className="text-[#38BDF8]">SUM</span>(revenue){' '}
                  <span className="text-[#38BDF8]">AS</span> rev
                  <br />
                  <span className="text-[#38BDF8]">FROM</span> ecommerce_sales{' '}
                  <span className="text-[#38BDF8]">GROUP BY</span> 1{' '}
                  <span className="text-[#38BDF8]">ORDER BY</span> 2{' '}
                  <span className="text-[#38BDF8]">DESC</span>
                </div>

                {/* 4 Region Bars */}
                <div className="mt-3 flex items-end gap-3 h-28 px-2 pt-2">
                  {HERO_REGIONS.map((bar) => (
                    <div
                      key={bar.label}
                      className="flex-1 h-full flex flex-col justify-end items-center gap-1.5"
                    >
                      <div
                        className="w-full rounded-t origin-bottom transition-transform duration-700 ease-out"
                        style={{
                          height: `${bar.heightPx}px`,
                          background: bar.gradient,
                          transform: heroDemoReady ? 'scaleY(1)' : 'scaleY(0)',
                          transitionDelay: `${bar.delayMs}ms`,
                        }}
                      />
                      <span className="text-xs text-[#94A3B8]">{bar.label}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 flex justify-between font-mono text-xs text-[#94A3B8]">
                  <span className="text-[#34D399]">✓ 4 rows · 38ms</span>
                  <span>run_8f2a1c</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Pillar Cards */}
          <div id="receipt-trace" className="grid md:grid-cols-3 gap-4 lg:gap-6 scroll-mt-24">
            <div className="rounded-xl p-5 lg:p-6 bg-[#131A22] border border-[#24303F]">
              <div className="font-mono text-xs mb-2 text-[#2DD4BF]">01 · COMPUTED</div>
              <div className="font-semibold mb-1 text-[#F8FAFC]">The engine does the math</div>
              <p className="text-sm text-[#94A3B8]">
                The AI writes SQL. DuckDB runs every sum, average and join.
              </p>
            </div>

            <div className="rounded-xl p-5 lg:p-6 bg-[#131A22] border border-[#24303F]">
              <div className="font-mono text-xs mb-2 text-[#38BDF8]">02 · SELF-HEALING</div>
              <div className="font-semibold mb-1 text-[#F8FAFC]">Fixes its own errors</div>
              <p className="text-sm text-[#94A3B8]">
                When a query fails, the agent reads the error, repairs the SQL and reruns it.
              </p>
            </div>

            <div className="rounded-xl p-5 lg:p-6 bg-[#131A22] border border-[#24303F]">
              <div className="font-mono text-xs mb-2 text-[#FBBF24]">03 · AUDITABLE</div>
              <div className="font-semibold mb-1 text-[#F8FAFC]">Every answer has a receipt</div>
              <p className="text-sm text-[#94A3B8]">
                Query, data version and run time are logged. Original files are never changed.
              </p>
            </div>
          </div>
        </section>

        {/* ===================== SCROLL-DRIVEN 4-STEP TIMELINE ===================== */}
        <section id="how-it-works" className="relative py-14 scroll-mt-20">
          {/* Decorative Left & Right Circuit Lines */}
          <svg
            aria-hidden="true"
            className="hidden md:block pointer-events-none absolute top-36 bottom-10 left-0 w-16 opacity-50"
            viewBox="0 0 70 600"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M8 0 V260 L40 300 V600"
              stroke="#24303F"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M28 0 V180 L52 210 V420 L20 460 V600"
              stroke="#24303F"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <svg
            aria-hidden="true"
            className="hidden md:block pointer-events-none absolute top-36 bottom-10 right-0 w-16 opacity-50 -scale-x-100"
            viewBox="0 0 70 600"
            preserveAspectRatio="none"
            fill="none"
          >
            <path
              d="M8 0 V260 L40 300 V600"
              stroke="#24303F"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
            <path
              d="M28 0 V180 L52 210 V420 L20 460 V600"
              stroke="#24303F"
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          {/* Section Heading */}
          <div className="text-center pb-6">
            <div className="font-mono text-xs text-[#2DD4BF] mb-3 tracking-wider">HOW IT WORKS</div>
            <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              From raw CSV to trusted answer
              <br />
              in{' '}
              <span
                className="italic font-normal"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                four
              </span>{' '}
              steps.
            </h2>
          </div>

          {/* Timeline Spine + Alternating Feature Rows */}
          <div ref={timelineWrapRef} className="relative max-w-6xl mx-auto mt-6 md:px-14 lg:px-16">
            {/* Static Spine */}
            <div className="absolute top-0 bottom-0 left-[22px] md:left-1/2 -translate-x-1/2 w-[1.5px] bg-[#24303F]" />
            {/* Animated Glowing Fill Spine */}
            <div
              className="absolute top-0 left-[22px] md:left-1/2 -translate-x-1/2 w-[1.5px] bg-[#2DD4BF] shadow-[0_0_10px_#2DD4BF] transition-[height] duration-1000 ease-out"
              style={{ height: `${spineHeight}px` }}
            />

            {/* STEP 01 (Right Card) */}
            <div
              ref={(el) => {
                rowRefs.current[0] = el;
              }}
              data-step-index={0}
              className="relative grid grid-cols-[44px_1fr] md:grid-cols-[1fr_88px_1fr] py-7 md:py-9 items-start"
            >
              {/* Text (Left on Desktop) */}
              <div
                className={`col-start-2 md:col-start-1 md:row-start-1 pl-3.5 md:pl-0 md:pr-5 md:text-right transition-all duration-700 ${
                  activeSteps[0] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <h3 className="text-lg font-semibold text-[#F8FAFC]">Drop in your file</h3>
                <p className="text-sm mt-1.5 leading-relaxed text-[#94A3B8]">
                  CSV, Excel or Parquet. The original is kept untouched and converted into a fast
                  columnar copy.
                </p>
              </div>

              {/* Center Node + Elbow Connector */}
              <div className="col-start-1 row-start-1 row-span-2 md:col-start-2 md:row-span-1 relative flex justify-center">
                <div
                  ref={(el) => {
                    pillRefs.current[0] = el;
                  }}
                  className={`relative z-10 h-[26px] min-w-[36px] px-2 rounded-[7px] grid place-items-center font-mono text-xs border transition-all duration-500 ${
                    activeSteps[0]
                      ? 'bg-[#2DD4BF] text-[#041A1C] border-[#2DD4BF] font-bold shadow-[0_0_0_4px_rgba(45,212,191,0.18),0_0_18px_rgba(45,212,191,0.45)]'
                      : 'bg-[#131A22] text-[#94A3B8] border-[#24303F]'
                  }`}
                >
                  01
                </div>
                <div
                  className={`hidden md:block absolute top-[13px] left-[calc(50%+18px)] w-[78px] h-[46px] border-t-[1.5px] border-r-[1.5px] rounded-tr-xl transition-colors duration-500 delay-150 ${
                    activeSteps[0] ? 'border-[#2DD4BF]' : 'border-[#24303F]'
                  }`}
                >
                  <span
                    className={`absolute -bottom-1 -right-1 w-[7px] h-[7px] rounded-full transition-colors duration-500 delay-300 ${
                      activeSteps[0] ? 'bg-[#2DD4BF]' : 'bg-[#24303F]'
                    }`}
                  />
                </div>
              </div>

              {/* Card (Right on Desktop) */}
              <div
                className={`col-start-2 md:col-start-3 md:row-start-1 mt-3.5 md:mt-14 pl-3.5 md:pl-0 transition-all duration-700 delay-150 ${
                  activeSteps[0] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div
                  className="rounded-[14px] p-[18px] border border-[#24303F] bg-[#131A22]"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(45,212,191,0.09) 1px, transparent 1.2px)',
                    backgroundSize: '12px 12px',
                  }}
                >
                  <div className="rounded-[10px] bg-[#090D12] border border-[#24303F] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#24303F] text-xs text-[#94A3B8]">
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <span className="ml-1">Upload</span>
                    </div>
                    <div className="font-mono text-xs leading-6 p-3">
                      <div>
                        <span className="text-[#2DD4BF]">▸</span> ecommerce_sales.csv{' '}
                        <span className="text-[#94A3B8]">· 6.2 MB</span>
                      </div>
                      <div>
                        <span className="text-[#34D399]">✓</span> raw preserved{' '}
                        <span className="text-[#94A3B8]">→ data_lake/raw/</span>
                      </div>
                      <div>
                        <span className="text-[#34D399]">✓</span> converted{' '}
                        <span className="text-[#94A3B8]">→</span> v1.parquet
                      </div>
                      <div className="text-[#94A3B8]">48,210 rows · 14 columns</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 02 (Left Card) */}
            <div
              ref={(el) => {
                rowRefs.current[1] = el;
              }}
              data-step-index={1}
              className="relative grid grid-cols-[44px_1fr] md:grid-cols-[1fr_88px_1fr] py-7 md:py-9 items-start"
            >
              {/* Card (Left on Desktop) */}
              <div
                className={`col-start-2 row-start-2 md:col-start-1 md:row-start-1 mt-3.5 md:mt-14 pl-3.5 md:pl-0 transition-all duration-700 delay-150 ${
                  activeSteps[1] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div
                  className="rounded-[14px] p-[18px] border border-[#24303F] bg-[#131A22]"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(45,212,191,0.09) 1px, transparent 1.2px)',
                    backgroundSize: '12px 12px',
                  }}
                >
                  <div className="rounded-[10px] bg-[#090D12] border border-[#24303F] p-4">
                    <div className="flex items-end justify-between mb-3">
                      <div>
                        <div className="text-xs text-[#94A3B8]">Data health</div>
                        <div className="text-3xl font-extrabold tabular-nums text-[#2DD4BF]">
                          87<span className="text-base text-[#94A3B8]">/100</span>
                        </div>
                      </div>
                      <span className="font-mono text-xs px-2 py-1 rounded-md border border-[#2DD4BF] text-[#2DD4BF]">
                        auto-clean → v2
                      </span>
                    </div>
                    {HEALTH_DIMENSIONS.map(([label, score]) => (
                      <div key={label} className="flex items-center gap-3 text-xs mb-1.5">
                        <span className="w-24 text-[#94A3B8]">{label}</span>
                        <div className="h-1.5 flex-1 rounded-full bg-[#24303F] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-[width] duration-1000 ease-out delay-300"
                            style={{
                              width: activeSteps[1] ? `${score}%` : '0%',
                              backgroundColor: score < 80 ? '#FBBF24' : '#2DD4BF',
                            }}
                          />
                        </div>
                        <span className="tabular-nums w-6 text-right">{score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Center Node + Elbow Connector */}
              <div className="col-start-1 row-start-1 row-span-2 md:col-start-2 md:row-span-1 relative flex justify-center">
                <div
                  ref={(el) => {
                    pillRefs.current[1] = el;
                  }}
                  className={`relative z-10 h-[26px] min-w-[36px] px-2 rounded-[7px] grid place-items-center font-mono text-xs border transition-all duration-500 ${
                    activeSteps[1]
                      ? 'bg-[#2DD4BF] text-[#041A1C] border-[#2DD4BF] font-bold shadow-[0_0_0_4px_rgba(45,212,191,0.18),0_0_18px_rgba(45,212,191,0.45)]'
                      : 'bg-[#131A22] text-[#94A3B8] border-[#24303F]'
                  }`}
                >
                  02
                </div>
                <div
                  className={`hidden md:block absolute top-[13px] right-[calc(50%+18px)] w-[78px] h-[46px] border-t-[1.5px] border-l-[1.5px] rounded-tl-xl transition-colors duration-500 delay-150 ${
                    activeSteps[1] ? 'border-[#2DD4BF]' : 'border-[#24303F]'
                  }`}
                >
                  <span
                    className={`absolute -bottom-1 -left-1 w-[7px] h-[7px] rounded-full transition-colors duration-500 delay-300 ${
                      activeSteps[1] ? 'bg-[#2DD4BF]' : 'bg-[#24303F]'
                    }`}
                  />
                </div>
              </div>

              {/* Text (Right on Desktop) */}
              <div
                className={`col-start-2 row-start-1 md:col-start-3 pl-3.5 md:pl-5 transition-all duration-700 ${
                  activeSteps[1] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <h3 className="text-lg font-semibold text-[#F8FAFC]">Get a health score</h3>
                <p className="text-sm mt-1.5 leading-relaxed text-[#94A3B8]">
                  Five checks run before you analyze anything: completeness, validity, consistency,
                  uniqueness and anomalies. Clean up in one click, and every fix is saved as a new
                  version.
                </p>
              </div>
            </div>

            {/* STEP 03 (Right Card) */}
            <div
              ref={(el) => {
                rowRefs.current[2] = el;
              }}
              data-step-index={2}
              className="relative grid grid-cols-[44px_1fr] md:grid-cols-[1fr_88px_1fr] py-7 md:py-9 items-start"
            >
              {/* Text (Left on Desktop) */}
              <div
                className={`col-start-2 md:col-start-1 md:row-start-1 pl-3.5 md:pl-0 md:pr-5 md:text-right transition-all duration-700 ${
                  activeSteps[2] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <h3 className="text-lg font-semibold text-[#F8FAFC]">Ask in plain English</h3>
                <p className="text-sm mt-1.5 leading-relaxed text-[#94A3B8]">
                  The agent writes SQL from your columns. If the query fails, it reads the error,
                  repairs the query and runs it again.
                </p>
              </div>

              {/* Center Node + Elbow Connector */}
              <div className="col-start-1 row-start-1 row-span-2 md:col-start-2 md:row-span-1 relative flex justify-center">
                <div
                  ref={(el) => {
                    pillRefs.current[2] = el;
                  }}
                  className={`relative z-10 h-[26px] min-w-[36px] px-2 rounded-[7px] grid place-items-center font-mono text-xs border transition-all duration-500 ${
                    activeSteps[2]
                      ? 'bg-[#2DD4BF] text-[#041A1C] border-[#2DD4BF] font-bold shadow-[0_0_0_4px_rgba(45,212,191,0.18),0_0_18px_rgba(45,212,191,0.45)]'
                      : 'bg-[#131A22] text-[#94A3B8] border-[#24303F]'
                  }`}
                >
                  03
                </div>
                <div
                  className={`hidden md:block absolute top-[13px] left-[calc(50%+18px)] w-[78px] h-[46px] border-t-[1.5px] border-r-[1.5px] rounded-tr-xl transition-colors duration-500 delay-150 ${
                    activeSteps[2] ? 'border-[#2DD4BF]' : 'border-[#24303F]'
                  }`}
                >
                  <span
                    className={`absolute -bottom-1 -right-1 w-[7px] h-[7px] rounded-full transition-colors duration-500 delay-300 ${
                      activeSteps[2] ? 'bg-[#2DD4BF]' : 'bg-[#24303F]'
                    }`}
                  />
                </div>
              </div>

              {/* Card (Right on Desktop) */}
              <div
                className={`col-start-2 md:col-start-3 md:row-start-1 mt-3.5 md:mt-14 pl-3.5 md:pl-0 transition-all duration-700 delay-150 ${
                  activeSteps[2] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div
                  className="rounded-[14px] p-[18px] border border-[#24303F] bg-[#131A22]"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(45,212,191,0.09) 1px, transparent 1.2px)',
                    backgroundSize: '12px 12px',
                  }}
                >
                  <div className="rounded-[10px] bg-[#090D12] border border-[#24303F] overflow-hidden">
                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-[#24303F] text-xs text-[#94A3B8]">
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <i className="w-2 h-2 rounded-full bg-[#24303F] inline-block" />
                      <span className="ml-1">Studio</span>
                    </div>
                    <div className="p-3">
                      <div className="text-sm rounded-lg px-3 py-2 mb-2 bg-[#131A22] border border-[#24303F]">
                        Which channel drove the March dip?
                      </div>
                      <div className="font-mono text-xs leading-6 rounded-lg p-2.5 border border-[#24303F]">
                        <span className="text-[#38BDF8]">SELECT</span> channel,{' '}
                        <span className="text-[#38BDF8]">SUM</span>(
                        <span className="text-[#F87171] line-through">revnue</span>{' '}
                        <span className="text-[#34D399]">revenue</span>)
                        <br />
                        <span className="text-[#38BDF8]">FROM</span> sales_v2{' '}
                        <span className="text-[#38BDF8]">WHERE</span> month = 3{' '}
                        <span className="text-[#38BDF8]">GROUP BY</span> 1
                      </div>
                      <div className="font-mono text-xs mt-2 text-[#FBBF24]">
                        ↻ self-healed · binder error fixed
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* STEP 04 (Left Card) */}
            <div
              ref={(el) => {
                rowRefs.current[3] = el;
              }}
              data-step-index={3}
              className="relative grid grid-cols-[44px_1fr] md:grid-cols-[1fr_88px_1fr] py-7 md:py-9 items-start"
            >
              {/* Card (Left on Desktop) */}
              <div
                className={`col-start-2 row-start-2 md:col-start-1 md:row-start-1 mt-3.5 md:mt-14 pl-3.5 md:pl-0 transition-all duration-700 delay-150 ${
                  activeSteps[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <div
                  className="rounded-[14px] p-[18px] border border-[#24303F] bg-[#131A22]"
                  style={{
                    backgroundImage: 'radial-gradient(rgba(45,212,191,0.09) 1px, transparent 1.2px)',
                    backgroundSize: '12px 12px',
                  }}
                >
                  <div className="rounded-[10px] bg-[#090D12] border border-[#24303F] p-4">
                    <div className="flex items-end gap-2.5 h-24 mb-3">
                      {BAR_PREVIEW.map((bar, idx) => (
                        <div
                          key={idx}
                          className="flex-1 rounded-t origin-bottom transition-transform duration-700 ease-out"
                          style={{
                            height: `${bar.height}%`,
                            backgroundColor: bar.color,
                            opacity: bar.isAlert ? 1 : 0.75,
                            transform: activeSteps[3] ? 'scaleY(1)' : 'scaleY(0)',
                            transitionDelay: `${350 + idx * 80}ms`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="text-sm leading-relaxed">
                      <b className="text-[#F87171]">Paid social −38%</b> explains 91% of the March
                      drop. Other channels held flat.
                    </div>
                    <div className="font-mono text-xs mt-3 pt-2 flex justify-between border-t border-[#24303F] text-[#94A3B8]">
                      <span className="text-[#34D399]">✓ computed · 38ms</span>
                      <span>run_8f2a1c · v2</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Center Node + Elbow Connector */}
              <div className="col-start-1 row-start-1 row-span-2 md:col-start-2 md:row-span-1 relative flex justify-center">
                <div
                  ref={(el) => {
                    pillRefs.current[3] = el;
                  }}
                  className={`relative z-10 h-[26px] min-w-[36px] px-2 rounded-[7px] grid place-items-center font-mono text-xs border transition-all duration-500 ${
                    activeSteps[3]
                      ? 'bg-[#2DD4BF] text-[#041A1C] border-[#2DD4BF] font-bold shadow-[0_0_0_4px_rgba(45,212,191,0.18),0_0_18px_rgba(45,212,191,0.45)]'
                      : 'bg-[#131A22] text-[#94A3B8] border-[#24303F]'
                  }`}
                >
                  04
                </div>
                <div
                  className={`hidden md:block absolute top-[13px] right-[calc(50%+18px)] w-[78px] h-[46px] border-t-[1.5px] border-l-[1.5px] rounded-tl-xl transition-colors duration-500 delay-150 ${
                    activeSteps[3] ? 'border-[#2DD4BF]' : 'border-[#24303F]'
                  }`}
                >
                  <span
                    className={`absolute -bottom-1 -left-1 w-[7px] h-[7px] rounded-full transition-colors duration-500 delay-300 ${
                      activeSteps[3] ? 'bg-[#2DD4BF]' : 'bg-[#24303F]'
                    }`}
                  />
                </div>
              </div>

              {/* Text (Right on Desktop) */}
              <div
                className={`col-start-2 row-start-1 md:col-start-3 pl-3.5 md:pl-5 transition-all duration-700 ${
                  activeSteps[3] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
              >
                <h3 className="text-lg font-semibold text-[#F8FAFC]">Get an answer with receipts</h3>
                <p className="text-sm mt-1.5 leading-relaxed text-[#94A3B8]">
                  You get a chart and a plain-English summary. Each one is computed by DuckDB and
                  logged with its query, data version and run time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== COMPARISON SECTION ===================== */}
        <section id="comparison" className="pb-12 pt-4 scroll-mt-24">
          <div className="grid md:grid-cols-2 gap-4 lg:gap-6">
            <div className="rounded-xl p-6 border border-dashed border-[#3B4B5E] bg-[#0B1015]/60">
              <div className="font-mono text-xs text-[#94A3B8] mb-3">GENERIC AI CHAT</div>
              <ul className="text-sm space-y-2.5 text-[#94A3B8]">
                <li>✕ Numbers produced by a language model</li>
                <li>✕ No way to check how it got there</li>
                <li>✕ A failed query is a dead end</li>
                <li>✕ Messy data quietly skews results</li>
              </ul>
            </div>

            <div className="rounded-xl p-6 bg-[#131A22] border border-[#2DD4BF]/35 shadow-[0_0_30px_rgba(45,212,191,0.08)]">
              <div className="font-mono text-xs text-[#2DD4BF] mb-3">TABLETELL</div>
              <ul className="text-sm space-y-2.5 text-[#F8FAFC]">
                <li>
                  <span className="text-[#34D399] mr-1.5">✓</span> Numbers computed by DuckDB
                </li>
                <li>
                  <span className="text-[#34D399] mr-1.5">✓</span> SQL and data version on every
                  answer
                </li>
                <li>
                  <span className="text-[#34D399] mr-1.5">✓</span> Agent repairs and reruns failed
                  queries
                </li>
                <li>
                  <span className="text-[#34D399] mr-1.5">✓</span> Data health score before you
                  analyze
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ===================== 4-COLUMN MINIMAL FOOTER ===================== */}
        <footer
          id="cli-footer"
          className="mt-8 border-t border-[#1E293B] pt-14 pb-16 scroll-mt-24"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
            {/* Left Column: Brand + TableTell Tagline + Social Buttons */}
            <div className="md:col-span-5">
              <button
                type="button"
                onClick={() => scrollToSection('top')}
                className="inline-flex items-center gap-2.5 cursor-pointer group focus:outline-none"
              >
                <WaveformTableLogo
                  size={28}
                  className="transition-transform group-hover:scale-105"
                />
                <span className="font-bold tracking-tight text-lg text-[#F8FAFC]">TableTell</span>
              </button>

              <p className="mt-4 text-sm leading-relaxed text-[#94A3B8] max-w-xs">
                Conversational lakehouse intelligence. Ask questions in plain English, compute
                answers on DuckDB, and audit every chart back to its Parquet version.
              </p>

              {/* 4 Rounded-Square Social Icons */}
              <div className="mt-6 flex items-center gap-2.5">
                {/* GitHub */}
                <a
                  href="https://github.com/sslenn/TableTell"
                  target="_blank"
                  rel="noreferrer"
                  aria-label="GitHub"
                  title="GitHub Repository"
                  className="w-10 h-10 rounded-[10px] grid place-items-center border border-[#24303F] bg-[#0B1015]/80 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3B4B5E] transition-colors"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                </a>

                {/* X */}
                <a
                  href="#x"
                  onClick={(e) => e.preventDefault()}
                  aria-label="X"
                  title="X / Twitter"
                  className="w-10 h-10 rounded-[10px] grid place-items-center border border-[#24303F] bg-[#0B1015]/80 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3B4B5E] transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.9 2H22l-7.6 8.7L23 22h-6.8l-5.3-6.9L4.8 22H1.7l8.1-9.3L1 2h7l4.8 6.3L18.9 2zm-1.2 18h1.9L7.4 4H5.4l12.3 16z" />
                  </svg>
                </a>

                {/* LinkedIn */}
                <a
                  href="#linkedin"
                  onClick={(e) => e.preventDefault()}
                  aria-label="LinkedIn"
                  title="LinkedIn"
                  className="w-10 h-10 rounded-[10px] grid place-items-center border border-[#24303F] bg-[#0B1015]/80 text-[#94A3B8] hover:text-[#F8FAFC] hover:border-[#3B4B5E] transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
                  </svg>
                </a>

                {/* Launch Studio Quick Icon */}
                <button
                  type="button"
                  onClick={() => onLaunchStudio('ecommerce_sales')}
                  aria-label="Launch Studio"
                  title="Launch TableTell Studio"
                  className="w-10 h-10 rounded-[10px] grid place-items-center border border-[#24303F] bg-[#0B1015]/80 text-[#94A3B8] hover:text-[#2DD4BF] hover:border-[#2DD4BF]/50 transition-colors cursor-pointer"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Column 2: Product */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-[#F8FAFC] mb-4">Product</h3>
              <ul className="space-y-3 text-sm text-[#94A3B8]">
                <li>
                  <button
                    type="button"
                    onClick={() => onLaunchStudio('ecommerce_sales')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    TableTell Studio
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works', 'how')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    5D Data Health
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works', 'how')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Auto-Clean Pipeline
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() =>
                      onLaunchStudio(
                        'ecommerce_sales',
                        'Show revenue breakdown by product category and region'
                      )
                    }
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Sample Datasets
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Architecture */}
            <div className="md:col-span-2">
              <h3 className="text-sm font-semibold text-[#F8FAFC] mb-4">Architecture</h3>
              <ul className="space-y-3 text-sm text-[#94A3B8]">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('receipt-trace', 'trust')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    DuckDB Engine
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('receipt-trace', 'trust')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Self-Healing SQL
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('receipt-trace', 'trust')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Parquet Versioning
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('comparison', 'trust')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Why TableTell
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Resources */}
            <div className="md:col-span-3">
              <h3 className="text-sm font-semibold text-[#F8FAFC] mb-4">Resources</h3>
              <ul className="space-y-3 text-sm text-[#94A3B8]">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('how-it-works', 'docs')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Documentation
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('receipt-trace', 'trust')}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    SQL Receipt Spec
                  </button>
                </li>
                <li>
                  <a
                    href="https://github.com/sslenn/TableTell"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#F8FAFC] transition-colors"
                  >
                    GitHub Repository
                  </a>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="hover:text-[#F8FAFC] transition-colors cursor-pointer text-left"
                  >
                    Workspace Sign In
                  </button>
                </li>
                <li>
                  <a
                    href="https://github.com/sslenn/TableTell"
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-[#F8FAFC] transition-colors"
                  >
                    MIT License
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
};

