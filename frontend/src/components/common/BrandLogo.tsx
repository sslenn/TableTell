import React from 'react';

export type LogoVariant =
  | 'tabletell-badge'
  | 'speech-grid'
  | 'agent-loop'
  | 'columnar-t'
  | 'synapse-matrix'
  | 'insight-spark'
  | 'story-quill'
  | 'radar-beacon'
  | 'waveform-table'
  | 'aperture-focus'
  | 'prism-table'
  | 'nested-tt'
  | 'growth-chevron';

interface BrandLogoProps {
  size?: number;
  className?: string;
  variant?: LogoVariant;
}

export const WaveformTableLogo: React.FC<{ size?: number; className?: string }> = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
  >
    <defs>
      <linearGradient id="tt_wf_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E293B" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
      <linearGradient id="tt_wf_cyan" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#06B6D4" />
        <stop offset="1" stopColor="#38BDF8" />
      </linearGradient>
      <linearGradient id="tt_wf_emerald" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
        <stop stopColor="#10B981" />
        <stop offset="1" stopColor="#06B6D4" />
      </linearGradient>
    </defs>
    <rect x="6" y="6" width="88" height="88" rx="22" fill="url(#tt_wf_bg)" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
    <rect x="18" y="22" width="64" height="9" rx="4.5" fill="rgba(255,255,255,0.25)" />
    <rect x="22" y="42" width="14" height="34" rx="7" fill="url(#tt_wf_cyan)" />
    <rect x="43" y="34" width="14" height="42" rx="7" fill="url(#tt_wf_emerald)" />
    <rect x="64" y="48" width="14" height="28" rx="7" fill="url(#tt_wf_cyan)" opacity="0.8" />
  </svg>
);

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 32,
  className = '',
  variant = 'tabletell-badge'
}) => {
  switch (variant) {
    // Official Permanent TableTell Brand Logo (Orb Avatar Badge)
    case 'tabletell-badge':
      return (
        <div
          className={`relative shrink-0 rounded-full select-none flex items-center justify-center ${className}`}
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          <img
            src="/tabletell-logo.png"
            alt="TableTell"
            width={size}
            height={size}
            className="w-full h-full object-contain rounded-full"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(45, 212, 191, 0.45))'
            }}
          />
        </div>
      );

    case 'waveform-table':
      return <WaveformTableLogo size={size} className={className} />;

    // 1. Table + Tell: Speech Grid
    case 'speech-grid':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_sg_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
            <filter id="tt_sg_glow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
            </filter>
          </defs>
          <path
            d="M14 18 C14 12 19 8 26 8 L74 8 C81 8 86 12 86 18 L86 64 C86 70 81 74 74 74 L36 74 L20 88 C18 90 14 88 14 85 L14 18 Z"
            fill="url(#tt_sg_bg)"
            filter="url(#tt_sg_glow)"
          />
          <rect x="24" y="20" width="52" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.95" />
          <rect x="24" y="34" width="22" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.6" />
          <rect x="50" y="34" width="26" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.6" />
          <rect x="24" y="47" width="14" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.45" />
          <rect x="42" y="47" width="18" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.45" />
          <rect x="64" y="47" width="12" height="7" rx="3.5" fill="#FFFFFF" fillOpacity="0.45" />
        </svg>
      );

    // 2. Autonomous Loop: Agent Loop (LangGraph cycle)
    case 'agent-loop':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_loop_cyan" x1="10" y1="50" x2="50" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_loop_green" x1="50" y1="50" x2="90" y2="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <filter id="tt_loop_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
            </filter>
          </defs>
          <path
            d="M50 50 C38 32 14 32 14 50 C14 68 38 68 50 50"
            stroke="url(#tt_loop_cyan)"
            strokeWidth="11"
            strokeLinecap="round"
            filter="url(#tt_loop_glow)"
          />
          <path
            d="M50 50 C62 68 86 68 86 50 C86 32 62 32 50 50"
            stroke="url(#tt_loop_green)"
            strokeWidth="11"
            strokeLinecap="round"
            filter="url(#tt_loop_glow)"
          />
          <circle cx="50" cy="50" r="4.5" fill="#FFFFFF" />
          <circle cx="27" cy="50" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
          <circle cx="73" cy="50" r="3.5" fill="#FFFFFF" fillOpacity="0.8" />
        </svg>
      );

    // 3. Modern Monogram: Columnar T
    case 'columnar-t':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_t_bar" x1="8" y1="22" x2="92" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="0.6" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#818CF8" />
            </linearGradient>
            <linearGradient id="tt_col_a" x1="36" y1="38" x2="36" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#0EA5E9" />
            </linearGradient>
            <linearGradient id="tt_col_b" x1="53" y1="38" x2="53" y2="88" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <filter id="tt_t_glow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.35" />
            </filter>
          </defs>
          <rect x="8" y="12" width="84" height="20" rx="8" fill="url(#tt_t_bar)" filter="url(#tt_t_glow)" />
          <rect x="36" y="38" width="12" height="50" rx="6" fill="url(#tt_col_a)" />
          <rect x="52" y="38" width="12" height="50" rx="6" fill="url(#tt_col_b)" />
          <circle cx="21" cy="22" r="3.5" fill="#FFFFFF" opacity="0.95" />
          <circle cx="35" cy="22" r="3.5" fill="#FFFFFF" opacity="0.65" />
          <circle cx="49" cy="22" r="3.5" fill="#FFFFFF" opacity="0.4" />
        </svg>
      );

    // 4. Neural Reasoning: Synapse Matrix
    case 'synapse-matrix':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_syn_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E293B" />
              <stop offset="1" stopColor="#0B132B" />
            </linearGradient>
            <linearGradient id="tt_syn_line" x1="15" y1="15" x2="85" y2="85" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="0.5" stopColor="#38BDF8" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <radialGradient id="tt_syn_core" cx="50" cy="50" r="50" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="0.6" stopColor="#06B6D4" />
              <stop offset="1" stopColor="#0284C7" />
            </radialGradient>
            <filter id="tt_syn_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
            </filter>
          </defs>
          <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#tt_syn_bg)" stroke="rgba(255,255,255,0.14)" strokeWidth="2.5" />
          {/* Synaptic interconnect lines */}
          <line x1="28" y1="28" x2="72" y2="28" stroke="url(#tt_syn_line)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="28" y1="50" x2="72" y2="50" stroke="url(#tt_syn_line)" strokeWidth="2.5" strokeOpacity="0.7" />
          <line x1="28" y1="72" x2="72" y2="72" stroke="url(#tt_syn_line)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="28" y1="28" x2="28" y2="72" stroke="url(#tt_syn_line)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="50" y1="28" x2="50" y2="72" stroke="url(#tt_syn_line)" strokeWidth="2.5" strokeOpacity="0.7" />
          <line x1="72" y1="28" x2="72" y2="72" stroke="url(#tt_syn_line)" strokeWidth="1.5" strokeOpacity="0.35" strokeDasharray="3 3" />
          <line x1="28" y1="28" x2="72" y2="72" stroke="url(#tt_syn_line)" strokeWidth="1.5" strokeOpacity="0.3" />
          {/* Matrix Nodes */}
          <circle cx="28" cy="28" r="4.5" fill="#38BDF8" fillOpacity="0.85" />
          <circle cx="50" cy="28" r="4" fill="#06B6D4" fillOpacity="0.7" />
          <circle cx="72" cy="28" r="4.5" fill="#38BDF8" fillOpacity="0.85" />
          <circle cx="28" cy="50" r="4.5" fill="#06B6D4" />
          <circle cx="72" cy="50" r="4.5" fill="#10B981" />
          <circle cx="28" cy="72" r="4.5" fill="#06B6D4" fillOpacity="0.85" />
          <circle cx="50" cy="72" r="4" fill="#10B981" fillOpacity="0.7" />
          <circle cx="72" cy="72" r="4.5" fill="#10B981" fillOpacity="0.85" />
          {/* Central High-Intelligence Core */}
          <circle cx="50" cy="50" r="8" fill="url(#tt_syn_core)" filter="url(#tt_syn_glow)" />
          <circle cx="50" cy="50" r="3.5" fill="#FFFFFF" />
        </svg>
      );

    // 5. Intelligence Spark: Table + AI
    case 'insight-spark':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_spark_grad" x1="50" y1="12" x2="92" y2="52" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_cell_grad" x1="12" y1="12" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#0284C7" />
            </linearGradient>
          </defs>
          <rect x="12" y="12" width="34" height="34" rx="9" fill="url(#tt_cell_grad)" />
          <rect x="12" y="54" width="34" height="34" rx="9" fill="#1E293B" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" />
          <rect x="54" y="54" width="34" height="34" rx="9" fill="url(#tt_cell_grad)" opacity="0.35" />
          <path
            d="M71 12 C71 23 80 32 91 32 C80 32 71 41 71 52 C71 41 62 32 51 32 C62 32 71 23 71 12 Z"
            fill="url(#tt_spark_grad)"
          />
          <circle cx="71" cy="32" r="3" fill="#FFFFFF" />
        </svg>
      );

    // 6. Narrative Storytelling: Story Quill
    case 'story-quill':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_quill_stem" x1="20" y1="80" x2="80" y2="20" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0891B2" />
              <stop offset="0.5" stopColor="#06B6D4" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_quill_bar1" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0284C7" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_quill_bar2" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <filter id="tt_quill_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
            </filter>
          </defs>
          {/* Ascending data columns merging into quill vane */}
          <rect x="52" y="14" width="10" height="28" rx="4" fill="url(#tt_quill_bar2)" transform="rotate(35 52 14)" />
          <rect x="64" y="24" width="10" height="34" rx="4" fill="url(#tt_quill_bar1)" transform="rotate(35 64 24)" />
          <rect x="76" y="34" width="10" height="40" rx="4" fill="url(#tt_quill_bar2)" opacity="0.75" transform="rotate(35 76 34)" />
          {/* Main Quill Stylus */}
          <path
            d="M82 18 C65 24 45 42 32 62 L20 80 L38 68 C58 55 76 35 82 18 Z"
            fill="url(#tt_quill_stem)"
            filter="url(#tt_quill_glow)"
          />
          <line x1="20" y1="80" x2="48" y2="48" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          <circle cx="16" cy="84" r="3.5" fill="#38BDF8" />
          <circle cx="16" cy="84" r="1.5" fill="#FFFFFF" />
        </svg>
      );

    // 7. Telemetry & Anomaly Radar: Radar Beacon
    case 'radar-beacon':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_rad_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0B132B" />
              <stop offset="1" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="tt_rad_sweep" x1="50" y1="50" x2="90" y2="15" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" stopOpacity="0.7" />
              <stop offset="1" stopColor="#38BDF8" stopOpacity="0.05" />
            </linearGradient>
            <filter id="tt_rad_glow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#06B6D4" floodOpacity="0.4" />
            </filter>
          </defs>
          <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#tt_rad_bg)" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="34" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.3" strokeDasharray="4 3" />
          <circle cx="50" cy="50" r="22" stroke="#06B6D4" strokeWidth="2" strokeOpacity="0.5" />
          <circle cx="50" cy="50" r="10" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="50" y1="14" x2="50" y2="86" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <line x1="14" y1="50" x2="86" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
          <path d="M50 50 L50 16 A34 34 0 0 1 84 50 Z" fill="url(#tt_rad_sweep)" />
          <circle cx="70" cy="30" r="4" fill="#38BDF8" filter="url(#tt_rad_glow)" />
          <circle cx="70" cy="30" r="1.8" fill="#FFFFFF" />
          <circle cx="32" cy="64" r="3" fill="#10B981" />
          <circle cx="62" cy="68" r="2.5" fill="#06B6D4" fillOpacity="0.8" />
          <circle cx="50" cy="50" r="4.5" fill="#FFFFFF" />
        </svg>
      );

    // 8. Storytelling Badge: Waveform Table
    case 'waveform-table':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_wf_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#1E293B" />
              <stop offset="1" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="tt_wf_cyan" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_wf_emerald" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
          </defs>
          <rect x="6" y="6" width="88" height="88" rx="22" fill="url(#tt_wf_bg)" stroke="rgba(255,255,255,0.16)" strokeWidth="3" />
          <rect x="18" y="22" width="64" height="9" rx="4.5" fill="rgba(255,255,255,0.25)" />
          <rect x="22" y="42" width="14" height="34" rx="7" fill="url(#tt_wf_cyan)" />
          <rect x="43" y="34" width="14" height="42" rx="7" fill="url(#tt_wf_emerald)" />
          <rect x="64" y="48" width="14" height="28" rx="7" fill="url(#tt_wf_cyan)" opacity="0.8" />
        </svg>
      );

    // 9. Precision Lens: Aperture Focus
    case 'aperture-focus':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_ap_bg" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0F172A" />
              <stop offset="1" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="tt_ap_blade1" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0891B2" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="tt_ap_blade2" x1="80" y1="10" x2="20" y2="90" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
            <filter id="tt_ap_glow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#38BDF8" floodOpacity="0.45" />
            </filter>
          </defs>
          <rect x="8" y="8" width="84" height="84" rx="20" fill="url(#tt_ap_bg)" stroke="rgba(255,255,255,0.12)" strokeWidth="2.5" />
          <path d="M50 14 L82 32 L68 54 L36 36 Z" fill="url(#tt_ap_blade1)" fillOpacity="0.85" />
          <path d="M82 32 L82 68 L60 68 L60 36 Z" fill="url(#tt_ap_blade2)" fillOpacity="0.75" />
          <path d="M82 68 L50 86 L36 64 L68 64 Z" fill="url(#tt_ap_blade1)" fillOpacity="0.85" />
          <path d="M50 86 L18 68 L32 46 L64 64 Z" fill="url(#tt_ap_blade2)" fillOpacity="0.75" />
          <path d="M18 68 L18 32 L40 32 L40 64 Z" fill="url(#tt_ap_blade1)" fillOpacity="0.85" />
          <path d="M18 32 L50 14 L64 36 L32 36 Z" fill="url(#tt_ap_blade2)" fillOpacity="0.75" />
          <polygon points="50,34 64,42 64,58 50,66 36,58 36,42" fill="#0F172A" stroke="#38BDF8" strokeWidth="2.5" />
          <circle cx="50" cy="50" r="5" fill="#FFFFFF" filter="url(#tt_ap_glow)" />
        </svg>
      );

    // 10. Dimensional OLAP: Prism Table
    case 'prism-table':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_prism_top" x1="14" y1="20" x2="86" y2="45" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="tt_prism_left" x1="14" y1="45" x2="50" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0284C7" />
              <stop offset="1" stopColor="#0F172A" />
            </linearGradient>
            <linearGradient id="tt_prism_right" x1="86" y1="45" x2="50" y2="86" gradientUnits="userSpaceOnUse">
              <stop stopColor="#10B981" />
              <stop offset="1" stopColor="#047857" />
            </linearGradient>
          </defs>
          <path d="M50 14 L86 32 L50 50 L14 32 Z" fill="url(#tt_prism_top)" />
          <path d="M14 32 L50 50 L50 86 L14 68 Z" fill="url(#tt_prism_left)" />
          <path d="M50 50 L86 32 L86 68 L50 86 Z" fill="url(#tt_prism_right)" />
          <path d="M32 23 L68 41 M68 23 L32 41" stroke="#FFFFFF" strokeWidth="1.5" strokeOpacity="0.45" strokeLinecap="round" />
        </svg>
      );

    // 11. Dual-T Monogram: Nested TT
    case 'nested-tt':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_outer_t" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0891B2" />
              <stop offset="1" stopColor="#1E293B" />
            </linearGradient>
            <linearGradient id="tt_inner_t" x1="0" y1="0" x2="100" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#22D3EE" />
              <stop offset="1" stopColor="#34D399" />
            </linearGradient>
            <filter id="tt_dual_glow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#22D3EE" floodOpacity="0.35" />
            </filter>
          </defs>
          <rect x="8" y="10" width="84" height="18" rx="6" fill="url(#tt_outer_t)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <rect x="38" y="28" width="24" height="62" rx="6" fill="url(#tt_outer_t)" stroke="rgba(255,255,255,0.15)" strokeWidth="2" />
          <rect x="18" y="14" width="64" height="10" rx="4" fill="url(#tt_inner_t)" filter="url(#tt_dual_glow)" />
          <rect x="44" y="24" width="12" height="56" rx="4" fill="url(#tt_inner_t)" filter="url(#tt_dual_glow)" />
          <circle cx="50" cy="19" r="2.5" fill="#FFFFFF" />
        </svg>
      );

    // 12. Performance Growth: Growth Chevron
    case 'growth-chevron':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 ${className}`}
        >
          <defs>
            <linearGradient id="tt_bar1" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#0891B2" />
              <stop offset="1" stopColor="#06B6D4" />
            </linearGradient>
            <linearGradient id="tt_bar2" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#06B6D4" />
              <stop offset="1" stopColor="#38BDF8" />
            </linearGradient>
            <linearGradient id="tt_bar3" x1="0" y1="100" x2="0" y2="0" gradientUnits="userSpaceOnUse">
              <stop stopColor="#38BDF8" />
              <stop offset="1" stopColor="#10B981" />
            </linearGradient>
          </defs>
          <rect x="14" y="46" width="18" height="42" rx="7" fill="url(#tt_bar1)" />
          <rect x="38" y="28" width="18" height="60" rx="7" fill="url(#tt_bar2)" />
          <rect x="62" y="10" width="18" height="78" rx="7" fill="url(#tt_bar3)" />
          <circle cx="71" cy="19" r="4" fill="#FFFFFF" />
        </svg>
      );

    default:
      return (
        <div
          className={`relative shrink-0 rounded-full select-none flex items-center justify-center ${className}`}
          style={{ width: `${size}px`, height: `${size}px` }}
        >
          <img
            src="/tabletell-logo.png"
            alt="TableTell"
            width={size}
            height={size}
            className="w-full h-full object-contain rounded-full"
            style={{
              filter: 'drop-shadow(0 0 10px rgba(45, 212, 191, 0.45))'
            }}
          />
        </div>
      );
  }
};

