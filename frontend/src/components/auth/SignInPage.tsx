import React from 'react';
import { SignIn } from '@clerk/react';
import { dark } from '@clerk/themes';
import { Lock } from 'lucide-react';
import { BrandLogo } from '../common/BrandLogo';

export const SignInPage: React.FC = () => {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#070D0E] text-[#F0FDFA] relative overflow-hidden select-none px-4 py-8">
      {/* Background Architectural Ambient Lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] rounded-full bg-[#0D9488]/15 blur-[160px] pointer-events-none" />
      <div className="absolute bottom-10 right-1/4 w-[400px] h-[400px] rounded-full bg-[#0284C7]/10 blur-[150px] pointer-events-none" />
      <div className="absolute top-10 left-1/4 w-[350px] h-[350px] rounded-full bg-[#14B8A6]/8 blur-[180px] pointer-events-none" />

      {/* Subtle Dot Matrix Overlay */}
      <div
        className="absolute inset-0 opacity-[0.035] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#2DD4BF 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Central Sign-In Container */}
      <div className="w-full max-w-md relative z-10 flex flex-col items-center">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 mb-4 text-center">
          <div className="w-11 h-11 rounded-2xl bg-[#0D9488]/15 border border-[#2DD4BF]/30 flex items-center justify-center text-[#2DD4BF] shadow-[0_0_24px_rgba(45,212,191,0.2)]">
            <BrandLogo size={26} variant="tabletell-badge" />
          </div>
          <div className="flex flex-col items-center">
            <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-[#F0FDFA] via-[#99F6E4] to-[#2DD4BF] bg-clip-text text-transparent">
              TableTell
            </h1>
            <p className="text-[10px] font-bold text-[#5EEAD4] uppercase tracking-widest font-mono">
              Autonomous AI Data Analyst
            </p>
          </div>
        </div>

        {/* Master Sign-In Card Container */}
        <div className="w-full relative">
          {/* Ambient Radiant Glow Behind the Card */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#2DD4BF]/20 via-[#0D9488]/10 to-transparent rounded-3xl blur-2xl pointer-events-none" />

          {/* Card Frame */}
          <div className="relative rounded-2xl border border-[#2DD4BF]/30 bg-[#0E181A]/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8),0_0_35px_rgba(13,148,136,0.15)] backdrop-blur-2xl p-5 sm:p-6">
            {/* Glowing Top Edge Indicator */}
            <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-[#2DD4BF] to-transparent" />

            {/* Clerk Native Sign-In Widget with Dark Telemetry Theme */}
            <SignIn
              appearance={{
                theme: dark,
                variables: {
                  colorPrimary: '#0D9488',
                  colorBackground: 'transparent',
                  colorForeground: '#F0FDFA',
                  colorMutedForeground: '#99F6E4',
                  borderRadius: '0.625rem',
                },
                elements: {
                  rootBox: 'w-full',
                  card: 'bg-transparent shadow-none border-0 p-0 w-full',
                  headerTitle: '!text-[#F0FDFA] !font-extrabold text-lg tracking-tight text-center',
                  headerSubtitle: '!text-[#99F6E4]/70 text-xs text-center mt-0.5',
                  socialButtonsBlockButton:
                    '!w-full !h-10 !bg-[#142426] hover:!bg-[#1C3336] !border !border-[#2DD4BF]/25 hover:!border-[#2DD4BF]/50 !text-[#F0FDFA] font-medium rounded-[10px] text-xs transition-all cursor-pointer shadow-sm',
                  socialButtonsBlockButtonText: '!text-[#F0FDFA] !font-semibold text-xs',
                  socialButtonsProviderIcon: 'w-4 h-4',
                  dividerRow: 'my-2.5',
                  dividerLine: '!bg-[#2DD4BF]/20',
                  dividerText: '!text-[#5EEAD4]/60 text-[10px] uppercase font-mono tracking-wider',
                  formFieldLabel: '!text-[#99F6E4] text-xs font-semibold mb-1',
                  formFieldInput:
                    '!w-full !h-10 !bg-[#060B0C] !border !border-[#2DD4BF]/25 !text-[#F0FDFA] focus:!border-[#2DD4BF] focus:!ring-2 focus:!ring-[#2DD4BF]/20 rounded-[10px] text-xs px-3.5 transition-all shadow-inner',
                  formButtonPrimary:
                    '!w-full !h-10 !bg-gradient-to-r !from-[#0D9488] !to-[#14B8A6] hover:!from-[#14B8A6] hover:!to-[#2DD4BF] !text-[#041A1C] !font-bold text-xs rounded-[10px] transition-all shadow-[0_4px_16px_rgba(13,148,136,0.35)] cursor-pointer mt-1',
                  footerActionText: '!text-[#99F6E4]/70 text-xs',
                  footerActionLink: '!text-[#2DD4BF] hover:!text-[#5EEAD4] !font-bold text-xs transition-colors',
                  footer: '!border-t !border-[#2DD4BF]/15 pt-2.5 mt-2.5',
                },
              }}
            />

            {/* Security Assurance */}
            <div className="mt-3 pt-2.5 border-t border-[#2DD4BF]/10 flex items-center justify-center gap-1.5 text-[11px] text-[#5EEAD4]/60 font-mono">
              <Lock className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span>256-Bit Encrypted Session • Enterprise Access</span>
            </div>
          </div>
        </div>

        {/* Minimal Footer Attribution */}
        <p className="mt-4 text-[11px] font-mono text-[#99F6E4]/40 text-center">
          TableTell Lakehouse Intelligence • Powered by DuckDB & LangGraph
        </p>
      </div>
    </div>
  );
};
